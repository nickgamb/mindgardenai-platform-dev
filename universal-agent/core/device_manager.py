"""
Device Manager Module

Coordinates device instances, manages streaming, and handles device lifecycle.
"""

import logging
import time
from typing import Dict, Optional, Any
from devices.base_device import BaseDevice, EEGSample
from devices.pieeg.pieeg_device import PiEEGDevice
from devices.emotiv.emotiv_device import EmotivDevice
from devices.idun.idun_device import IdunDevice
import os
import requests
import json
import time
from config.settings import get_config

logger = logging.getLogger('device')

class DeviceManager:
    """Manages device instances and coordinates streaming"""
    
    def __init__(self, config):
        self.config = config
        self.devices: Dict[str, BaseDevice] = {}
        self.active_streams: Dict[str, Dict] = {}
        self.socketio_instance = None
        # Ingest settings
        self.api_base = os.environ.get('MINDGARDEN_API_BASE', 'https://api.example.com')
        self.ingest_mode = os.environ.get('DATA_PUSH_MODE', 'http').lower()  # 'http' or 'socket'
        self._http_batch: Dict[str, list] = {}  # device_id -> list of samples
        self._http_batch_last_ts: Dict[str, float] = {}
        self._http_batch_interval_sec = float(os.environ.get('DATA_PUSH_INTERVAL_SEC', '0.03'))  # ~33ms
        # Always print once so this shows even if logger level is higher
        print(f"🧩 Agent ingest mode: {self.ingest_mode} (interval {self._http_batch_interval_sec}s)")
        print(f"🧩 Agent API base for ingest: {self.api_base}")
        try:
            logger.info(f"Data ingest mode: {self.ingest_mode} (interval {self._http_batch_interval_sec}s)")
            logger.info(f"API base for ingest: {self.api_base}")
        except Exception:
            pass
        
        # Device type mapping
        self.device_classes = {
            'pieeg_8': PiEEGDevice,
            'pieeg_16': PiEEGDevice,
            'emotiv_epoc_x': EmotivDevice,
            'idun_guardian': IdunDevice
        }
        
        logger.info("Device manager initialized")
    
    def create_device(self, device_model: str, device_id: str, device_config: Dict[str, Any]) -> bool:
        """Create and initialize a device instance"""
        try:
            logger.info(f"Creating device: {device_id} (model: {device_model})")
            
            if device_model not in self.device_classes:
                logger.error(f"Unsupported device model: {device_model}")
                logger.error(f"Supported models: {list(self.device_classes.keys())}")
                return False
            
            if device_id in self.devices:
                logger.warning(f"Device {device_id} already exists")
                return True
            
            # Get device class and create instance
            device_class = self.device_classes[device_model]
            logger.info(f"Using device class: {device_class.__name__}")
            
            device_config.update({
                'device_model': device_model,
                'sample_rate': self.config.SUPPORTED_DEVICES[device_model]['sample_rate'],
                'channels': self.config.SUPPORTED_DEVICES[device_model]['channels']
            })
            
            logger.info(f"Device config: {device_config}")
            
            device = device_class(device_id, device_config)
            logger.info(f"Device instance created: {type(device)}")
            
            # Set callbacks
            device.set_data_callback(lambda sample: self._handle_data_sample(sample))
            device.set_error_callback(lambda error: self._handle_device_error(device_id, error))
            
            # Validate configuration
            if not device.validate_config():
                logger.error(f"Invalid device configuration for {device_id}")
                return False
            
            self.devices[device_id] = device
            logger.info(f"✅ Created device: {device_id} ({device_model}) - Total devices: {len(self.devices)}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error creating device {device_id}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    def connect_device(self, device_id: str) -> Dict[str, Any]:
        """Connect to a device"""
        try:
            logger.info(f"Attempting to connect device: {device_id}")
            logger.info(f"Available devices: {list(self.devices.keys())}")
            
            if device_id not in self.devices:
                logger.error(f"Device {device_id} not found in device manager")
                return {'success': False, 'error': f'Device {device_id} not found'}
            
            device = self.devices[device_id]
            logger.info(f"Found device: {type(device)} - Connected: {device.is_connected}")
            
            if device.is_connected:
                return {'success': True, 'message': 'Device already connected'}
            
            logger.info(f"Calling device.connect() for {device_id}")
            success = device.connect()
            
            if success:
                logger.info(f"✅ Device {device_id} connected successfully")
                return {'success': True, 'message': 'Device connected'}
            else:
                logger.error(f"❌ Failed to connect device {device_id}")
                return {'success': False, 'error': 'Physical device connection failed'}
                
        except Exception as e:
            logger.error(f"❌ Error connecting device {device_id}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {'success': False, 'error': str(e)}
    
    def disconnect_device(self, device_id: str) -> Dict[str, Any]:
        """Disconnect from a device"""
        try:
            if device_id not in self.devices:
                return {'success': False, 'error': f'Device {device_id} not found'}
            
            device = self.devices[device_id]
            
            # Stop streaming first if active
            if device.is_streaming:
                self.stop_streaming(device_id)
            
            success = device.disconnect()
            
            if success:
                logger.info(f"Device {device_id} disconnected successfully")
                return {'success': True, 'message': 'Device disconnected'}
            else:
                logger.error(f"Failed to disconnect device {device_id}")
                return {'success': False, 'error': 'Disconnection failed'}
                
        except Exception as e:
            logger.error(f"Error disconnecting device {device_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    def start_streaming(self, device_model: str, device_id: str, socketio_instance) -> Dict[str, Any]:
        """Start streaming from a device"""
        try:
            self.socketio_instance = socketio_instance
            
            # Create device if it doesn't exist
            if device_id not in self.devices:
                device_config = {
                    'device_model': device_model,
                    'sample_rate': self.config.SUPPORTED_DEVICES[device_model]['sample_rate'],
                    'channels': self.config.SUPPORTED_DEVICES[device_model]['channels']
                }
                
                if not self.create_device(device_model, device_id, device_config):
                    return {'success': False, 'error': 'Failed to create device'}
            
            device = self.devices[device_id]
            
            # Connect if not connected
            if not device.is_connected:
                connect_result = self.connect_device(device_id)
                if not connect_result['success']:
                    return connect_result
            
            # Start streaming
            if device.is_streaming:
                return {'success': True, 'message': 'Device already streaming'}
            
            success = device.start_streaming()
            
            if success:
                self.active_streams[device_id] = {
                    'device_model': device_model,
                    'start_time': time.time(),
                    'samples_sent': 0
                }
                
                logger.info(f"Streaming started for device {device_id}")
                return {'success': True, 'message': 'Streaming started'}
            else:
                logger.error(f"Failed to start streaming for device {device_id}")
                return {'success': False, 'error': 'Failed to start streaming'}
                
        except Exception as e:
            logger.error(f"Error starting streaming for device {device_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    def stop_streaming(self, device_id: str) -> Dict[str, Any]:
        """Stop streaming from a device"""
        try:
            if device_id not in self.devices:
                return {'success': False, 'error': f'Device {device_id} not found'}
            
            device = self.devices[device_id]
            
            if not device.is_streaming:
                return {'success': True, 'message': 'Device not streaming'}
            
            success = device.stop_streaming()
            
            if success:
                # Remove from active streams
                if device_id in self.active_streams:
                    del self.active_streams[device_id]
                
                logger.info(f"Streaming stopped for device {device_id}")
                return {'success': True, 'message': 'Streaming stopped'}
            else:
                logger.error(f"Failed to stop streaming for device {device_id}")
                return {'success': False, 'error': 'Failed to stop streaming'}
                
        except Exception as e:
            logger.error(f"Error stopping streaming for device {device_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    def stop_all_streaming(self):
        """Stop streaming for all devices"""
        logger.info("Stopping all streaming")
        for device_id in list(self.active_streams.keys()):
            self.stop_streaming(device_id)
    
    def calibrate_device(self, device_id: str) -> Dict[str, Any]:
        """Calibrate a device"""
        try:
            if device_id not in self.devices:
                return {'success': False, 'error': f'Device {device_id} not found'}
            
            device = self.devices[device_id]
            
            if not device.is_connected:
                return {'success': False, 'error': 'Device not connected'}
            
            success = device.calibrate()
            
            if success:
                logger.info(f"Device {device_id} calibrated successfully")
                return {'success': True, 'message': 'Calibration completed'}
            else:
                logger.error(f"Failed to calibrate device {device_id}")
                return {'success': False, 'error': 'Calibration failed'}
                
        except Exception as e:
            logger.error(f"Error calibrating device {device_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_device_status(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific device"""
        if device_id not in self.devices:
            return None
        
        device = self.devices[device_id]
        status = device.get_status()
        
        # Add streaming info if active
        if device_id in self.active_streams:
            stream_info = self.active_streams[device_id]
            status.update({
                'stream_start_time': stream_info['start_time'],
                'stream_duration': time.time() - stream_info['start_time']
            })
        
        return status
    
    def get_all_device_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all devices"""
        status = {}
        for device_id in self.devices:
            status[device_id] = self.get_device_status(device_id)
        
        return status
    
    def remove_device(self, device_id: str) -> bool:
        """Remove a device instance"""
        try:
            if device_id not in self.devices:
                return True
            
            device = self.devices[device_id]
            
            # Stop streaming and disconnect
            if device.is_streaming:
                self.stop_streaming(device_id)
            if device.is_connected:
                self.disconnect_device(device_id)
            
            # Cleanup and remove
            device.cleanup()
            del self.devices[device_id]
            
            logger.info(f"Removed device: {device_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error removing device {device_id}: {e}")
            return False
    
    def _handle_data_sample(self, sample: EEGSample):
        """Handle EEG data sample from device"""
        try:
            if self.ingest_mode == 'http':
                self._enqueue_http_sample(sample)
                return
            if not self.socketio_instance:
                return
            
            # Update stream statistics
            device_id = sample.device_id
            if device_id in self.active_streams:
                self.active_streams[device_id]['samples_sent'] += 1
            
            # Convert to server format
            data_packet = {
                'device_id': sample.device_id,
                'timestamp': str(sample.timestamp),
                'channels': sample.channels,
                'data': sample.data,
                'sample_rate': sample.sample_rate,
                'device_model': sample.device_model
            }
            
            # Console logging for streaming data
            print(f"🧠 EEG STREAM [{sample.device_id}] - Sample #{self.active_streams.get(device_id, {}).get('samples_sent', 0)}")
            print(f"   Timestamp: {sample.timestamp}")
            print(f"   Channels: {len(sample.channels)} ({', '.join(sample.channels)})")
            print(f"   Data: {sample.data[:4]}..." if len(sample.data) > 4 else f"   Data: {sample.data}")
            print(f"   Sample Rate: {sample.sample_rate} Hz")
            print(f"   Device Model: {sample.device_model}")
            print("   " + "-" * 50)
            
            # Emit to WebSocket
            self.socketio_instance.emit('eeg_data', data_packet)
            
        except Exception as e:
            logger.error(f"Error handling data sample: {e}")

    def _enqueue_http_sample(self, sample: EEGSample):
        """Batch and POST samples to server ingest endpoint without blocking device loop."""
        try:
            device_id = sample.device_id
            batch = self._http_batch.setdefault(device_id, [])
            now = time.time()
            self._http_batch_last_ts.setdefault(device_id, now)

            batch.append({'timestamp': str(sample.timestamp), 'data': sample.data})

            # Send if interval elapsed or batch too large
            should_send = (now - self._http_batch_last_ts[device_id]) >= self._http_batch_interval_sec or len(batch) >= 16
            if not should_send:
                return

            payload = {
                'device_id': device_id,
                'device_model': sample.device_model,
                'sample_rate': sample.sample_rate,
                'channels': sample.channels,
                'samples': list(batch),
            }

            # Auth header if available
            headers = {'Content-Type': 'application/json'}
            try:
                from core.auth import AuthManager  # avoid circular at import time
            except Exception:
                AuthManager = None
            token = None
            try:
                # Attempt to reuse stored token file via AuthManager
                if AuthManager is not None:
                    am = AuthManager(get_config())
                    stored = am.load_stored_token()
                    token = (stored or {}).get('access_token')
            except Exception:
                pass
            if token:
                headers['Authorization'] = f'Bearer {token}'
            else:
                # One-time heads-up to help configure auth
                warn_key = f"_http_token_warn_{device_id}"
                if not getattr(self, warn_key, False):
                    logger.warning("HTTP ingest running without access token. Ensure the agent is registered and tokens.json exists.")
                    setattr(self, warn_key, True)

            url = f"{self.api_base}/api/ingest/eeg"
            try:
                resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=2)
                # One-time success log per device to confirm path
                first_ok_key = f"_http_first_ok_{device_id}"
                if getattr(self, first_ok_key, False) is False:
                    print(f"📤 Agent HTTP ingest POST -> {resp.status_code} for {device_id} (sent {len(payload['samples'])} samples)")
                    setattr(self, first_ok_key, True)
            except Exception as e:
                logger.debug(f"HTTP ingest POST failed (non-fatal): {e}")
            finally:
                batch.clear()
                self._http_batch_last_ts[device_id] = now
            return
        except Exception as e:
            try:
                logger.debug(f"HTTP ingest enqueue error: {e}")
            except Exception:
                pass
    
    def _handle_device_error(self, device_id: str, error: Exception):
        """Handle device error"""
        logger.error(f"Device {device_id} error: {error}")
        
        try:
            if self.socketio_instance:
                self.socketio_instance.emit('device_error', {
                    'device_id': device_id,
                    'error': str(error),
                    'timestamp': time.time()
                })
        except Exception as e:
            logger.error(f"Error emitting device error: {e}")
    
    def cleanup(self):
        """Cleanup all devices and resources"""
        logger.info("Cleaning up device manager")
        
        try:
            # Stop all streaming
            self.stop_all_streaming()
            
            # Cleanup all devices
            for device_id in list(self.devices.keys()):
                self.remove_device(device_id)
            
            self.devices.clear()
            self.active_streams.clear()
            
            logger.info("Device manager cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during device manager cleanup: {e}")
    
    def is_device_supported(self, device_model: str) -> bool:
        """Check if device model is supported"""
        return device_model in self.device_classes
    
    def get_supported_devices(self) -> Dict[str, Dict[str, Any]]:
        """Get list of supported device models"""
        return self.config.SUPPORTED_DEVICES