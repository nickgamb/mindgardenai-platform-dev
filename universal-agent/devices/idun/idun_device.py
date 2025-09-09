"""
IDUN Device Implementation

Implements IDUN Guardian device support using Bluetooth Low Energy interface.
Supports single-channel EEG acquisition via BLE.
"""

import logging
import time
import asyncio
import threading
import numpy as np
from typing import Dict, List, Optional, Any
from devices.base_device import BaseDevice, EEGSample, DeviceConnectionError, DeviceStreamingError
from .ble_interface import BLEInterface

logger = logging.getLogger('device.idun')

class IdunDevice(BaseDevice):
    """IDUN Guardian device implementation with BLE interface"""
    
    # IDUN Guardian channel configuration
    EEG_CHANNELS = ['CH1']  # Single channel device
    
    def __init__(self, device_id: str, config: Dict[str, Any]):
        super().__init__(device_id, config)
        
        # IDUN specific configuration
        self.device_address = config.get('device_address')
        self.auto_connect = config.get('auto_connect', True)
        
        # Set sample rate for IDUN (variable, default to 250 Hz)
        self.sample_rate = config.get('sample_rate', 250)
        
        # Configure channels
        self.channels = self.EEG_CHANNELS.copy()
        
        # Initialize BLE interface
        self.ble_interface = BLEInterface()
        self.ble_interface.set_data_callback(self._handle_ble_data)
        
        # Async event loop for BLE operations
        self.loop = None
        self.loop_thread = None
        self._loop_running = False
        
        # Data processing
        self.calibration_values = [0.0] * len(self.channels)
        self.is_calibrated = False
        
        # Sample counting for rate calculation
        self.sample_count = 0
        self.last_sample_time = None
        
        logger.info(f"IDUN device initialized: {len(self.channels)} channels")
    
    def _start_event_loop(self):
        """Start the asyncio event loop in a separate thread"""
        try:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            self._loop_running = True
            
            logger.info("Started asyncio event loop for BLE operations")
            self.loop.run_forever()
            
        except Exception as e:
            logger.error(f"Error in event loop: {e}")
        finally:
            self._loop_running = False
    
    def _stop_event_loop(self):
        """Stop the asyncio event loop"""
        if self.loop and self._loop_running:
            self.loop.call_soon_threadsafe(self.loop.stop)
            
            if self.loop_thread and self.loop_thread.is_alive():
                self.loop_thread.join(timeout=5.0)
            
            self.loop = None
            self.loop_thread = None
            self._loop_running = False
            logger.info("Stopped asyncio event loop")
    
    def _run_async(self, coro):
        """Run an async coroutine from sync context"""
        if not self.loop or not self._loop_running:
            return None
        
        future = asyncio.run_coroutine_threadsafe(coro, self.loop)
        try:
            return future.result(timeout=30.0)
        except Exception as e:
            logger.error(f"Error running async operation: {e}")
            return None
    
    def connect(self) -> bool:
        """Connect to IDUN device via BLE"""
        try:
            if self.is_connected:
                return True
            
            logger.info(f"Connecting to IDUN device {self.device_id}")
            
            # Start event loop if not running
            if not self._loop_running:
                self.loop_thread = threading.Thread(target=self._start_event_loop, daemon=True)
                self.loop_thread.start()
                
                # Wait for loop to start
                for _ in range(50):  # 5 second timeout
                    if self._loop_running:
                        break
                    time.sleep(0.1)
                
                if not self._loop_running:
                    raise DeviceConnectionError("Failed to start event loop")
            
            # Connect to device
            success = self._run_async(self.ble_interface.connect(self.device_address))
            if not success:
                raise DeviceConnectionError("Failed to connect to IDUN device")
            
            self.is_connected = True
            logger.info(f"IDUN device {self.device_id} connected successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to IDUN device {self.device_id}: {e}")
            self.cleanup()
            return False
    
    def disconnect(self) -> bool:
        """Disconnect from IDUN device"""
        try:
            if not self.is_connected:
                return True
            
            logger.info(f"Disconnecting IDUN device {self.device_id}")
            
            # Stop streaming if active
            if self.is_streaming:
                self.stop_streaming()
            
            # Disconnect BLE interface
            if self.loop and self._loop_running:
                self._run_async(self.ble_interface.disconnect())
            
            # Stop event loop
            self._stop_event_loop()
            
            self.is_connected = False
            logger.info(f"IDUN device {self.device_id} disconnected successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting IDUN device {self.device_id}: {e}")
            return False
    
    def start_streaming(self) -> bool:
        """Start streaming EEG data from IDUN"""
        try:
            if self.is_streaming:
                return True
            
            if not self.is_connected:
                raise DeviceStreamingError("Device not connected")
            
            logger.info(f"Starting streaming for IDUN device {self.device_id}")
            
            # Start BLE streaming
            success = self._run_async(self.ble_interface.start_streaming())
            if not success:
                raise DeviceStreamingError("Failed to start BLE streaming")
            
            self.is_streaming = True
            self.sample_count = 0
            self.last_sample_time = time.time()
            
            logger.info(f"Streaming started for IDUN device {self.device_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting streaming for IDUN device {self.device_id}: {e}")
            return False
    
    def stop_streaming(self) -> bool:
        """Stop streaming EEG data from IDUN"""
        try:
            if not self.is_streaming:
                return True
            
            logger.info(f"Stopping streaming for IDUN device {self.device_id}")
            
            # Stop BLE streaming
            if self.loop and self._loop_running:
                self._run_async(self.ble_interface.stop_streaming())
            
            self.is_streaming = False
            logger.info(f"Streaming stopped for IDUN device {self.device_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping streaming for IDUN device {self.device_id}: {e}")
            return False
    
    def calibrate(self) -> bool:
        """Perform device calibration"""
        try:
            if not self.is_connected:
                logger.error("Device not connected for calibration")
                return False
            
            logger.info(f"Starting calibration for IDUN device {self.device_id}")
            
            # Collect calibration data
            calibration_duration = 5.0  # seconds
            calibration_data = []
            
            # Start temporary streaming for calibration
            was_streaming = self.is_streaming
            if not was_streaming:
                if not self.start_streaming():
                    return False
            
            start_time = time.time()
            while time.time() - start_time < calibration_duration:
                # Let the BLE callback collect data
                time.sleep(0.1)
            
            # Stop temporary streaming if we started it
            if not was_streaming:
                self.stop_streaming()
            
            # For now, set a simple baseline calibration
            # In a real implementation, you'd collect actual baseline data
            self.calibration_values = [0.0] * len(self.channels)
            self.is_calibrated = True
            
            logger.info(f"Calibration completed for IDUN device {self.device_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error during calibration: {e}")
            return False
    
    def get_device_info(self) -> Dict[str, Any]:
        """Get device information and capabilities"""
        base_info = {
            'device_id': self.device_id,
            'device_model': self.device_model,
            'device_type': 'idun',
            'num_channels': len(self.channels),
            'channel_names': self.channels,
            'sample_rate': self.sample_rate,
            'resolution': '16-bit',
            'connection_type': 'Bluetooth LE',
            'is_calibrated': self.is_calibrated,
            'calibration_values': self.calibration_values,
            'device_address': self.device_address,
            'sample_count': self.sample_count
        }
        
        # Get BLE device info if connected
        if self.is_connected and self.loop and self._loop_running:
            try:
                ble_info = self._run_async(self.ble_interface.get_device_info())
                if ble_info:
                    base_info.update({
                        'ble_name': ble_info.get('name'),
                        'ble_address': ble_info.get('address'),
                        'battery_level': ble_info.get('battery_level')
                    })
            except Exception as e:
                logger.error(f"Error getting BLE device info: {e}")
        
        return base_info
    
    def _handle_ble_data(self, data: bytes):
        """Handle EEG data from BLE interface"""
        try:
            # Parse the raw data
            parsed_data = self.ble_interface.parse_eeg_data(data)
            if not parsed_data:
                return
            
            # Apply calibration if available
            if self.is_calibrated:
                calibrated_data = [
                    value - self.calibration_values[i] 
                    for i, value in enumerate(parsed_data[:len(self.channels)])
                ]
            else:
                calibrated_data = parsed_data[:len(self.channels)]
            
            # Ensure we have the right number of channels
            while len(calibrated_data) < len(self.channels):
                calibrated_data.append(0.0)
            
            # Create EEG sample
            sample = EEGSample(
                timestamp=time.time(),
                channels=self.channels,
                data=calibrated_data,
                sample_rate=self.sample_rate,
                device_id=self.device_id,
                device_model=self.device_model,
                metadata={
                    'is_calibrated': self.is_calibrated,
                    'raw_data_length': len(data),
                    'sample_count': self.sample_count
                }
            )
            
            # Update sample counting
            self.sample_count += 1
            
            # Call the data callback if set
            if self.data_callback:
                self.data_callback(sample)
                
        except Exception as e:
            logger.error(f"Error handling BLE data: {e}")
    
    def _read_sample(self) -> Optional[EEGSample]:
        """Read a single EEG sample from IDUN (not used - data comes via callback)"""
        # This method is required by the base class but not used for IDUN
        # since data comes asynchronously via BLE notifications
        return None
    
    def get_available_devices(self) -> List[Dict[str, Any]]:
        """Get list of available IDUN devices"""
        try:
            if not self.loop or not self._loop_running:
                # Start temporary event loop for scanning
                temp_loop = asyncio.new_event_loop()
                temp_interface = BLEInterface()
                
                async def scan_async():
                    return await temp_interface.scan_devices()
                
                devices = temp_loop.run_until_complete(scan_async())
                temp_loop.close()
                
                return devices
            else:
                return self._run_async(self.ble_interface.scan_devices()) or []
                
        except Exception as e:
            logger.error(f"Error scanning for IDUN devices: {e}")
            return []
    
    def set_device_address(self, address: str) -> bool:
        """Set specific device address to connect to"""
        if self.is_connected:
            logger.error("Cannot change device address while connected")
            return False
        
        self.device_address = address
        return True
    
    def validate_config(self) -> bool:
        """Validate IDUN specific configuration"""
        if not super().validate_config():
            return False
        
        if len(self.channels) != 1:
            logger.warning(f"IDUN typically has 1 channel, got {len(self.channels)}")
        
        return True
    
    def cleanup(self):
        """Cleanup IDUN specific resources"""
        logger.info(f"Cleaning up IDUN device {self.device_id}")
        try:
            # Stop streaming and disconnect
            if self.is_streaming:
                self.stop_streaming()
            if self.is_connected:
                self.disconnect()
            
            # Stop event loop
            self._stop_event_loop()
            
        except Exception as e:
            logger.error(f"Error during IDUN cleanup: {e}")
        finally:
            super().cleanup()