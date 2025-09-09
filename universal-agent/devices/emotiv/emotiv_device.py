"""
EMOTIV Device Implementation

Implements EMOTIV EPOC X device support using both HID and BLE interfaces.
Automatically tries HID (USB dongle) first, then falls back to Bluetooth LE.
Supports 14 EEG channels plus motion sensors.
"""

import logging
import time
import asyncio
import threading
import numpy as np
from typing import Dict, List, Optional, Any
from devices.base_device import BaseDevice, EEGSample, DeviceConnectionError, DeviceStreamingError
from .hid_interface import HIDInterface
from .usb_interface import USBInterface
from .ble_interface import EmotivBLEInterface
from .sensors import EmotivSensorParser

logger = logging.getLogger('device.emotiv')

class EmotivDevice(BaseDevice):
    """EMOTIV EPOC X device implementation with USB, HID, and BLE interfaces"""
    
    # EMOTIV EPOC X channel configuration
    EEG_CHANNELS = [
        'AF3', 'F7', 'F3', 'FC5', 'T7', 'P7', 'O1', 'O2',
        'P8', 'T8', 'FC6', 'F4', 'F8', 'AF4'
    ]
    
    MOTION_CHANNELS = ['GYROX', 'GYROY']
    
    def __init__(self, device_id: str, config: Dict[str, Any]):
        super().__init__(device_id, config)
        
        # EMOTIV specific configuration - use device_serial if provided, else device_id
        self.serial_number = config.get('device_serial') or config.get('serial_number') or device_id
        self.include_motion = config.get('include_motion', True)
        self.prefer_hid = config.get('prefer_hid', True)  # Try HID first by default
        self.device_address = config.get('device_address')  # For specific BLE device
        
        # Set sample rate for EMOTIV (typically 128 Hz)
        self.sample_rate = 128
        
        # Configure channels
        self.eeg_channels = self.EEG_CHANNELS.copy()
        if self.include_motion:
            self.channels = self.eeg_channels + self.MOTION_CHANNELS
        else:
            self.channels = self.eeg_channels
        
        # Initialize interfaces
        self.hid_interface = HIDInterface()
        self.usb_interface = USBInterface()
        self.ble_interface = EmotivBLEInterface()
        
        # Initialize sensor parser
        self.sensor_parser = EmotivSensorParser(verbose=True)
        
        # Connection state
        self.connection_type = None  # 'hid' or 'ble'
        self.active_interface = None
        
        # Async event loop for BLE operations
        self.loop = None
        self.loop_thread = None
        self._loop_running = False
        
        # Data processing
        self.calibration_values = [0.0] * len(self.eeg_channels)
        self.is_calibrated = False
        
        # Conversion factors for EMOTIV (device-specific)
        self.adc_resolution = 65536  # 16-bit ADC
        self.voltage_range = 4.5  # Voltage range in volts
        self.scale_factor = self.voltage_range / self.adc_resolution
        
        logger.info(f"EMOTIV device initialized: {len(self.channels)} channels (USB, HID, and BLE support)")
    
    def _start_event_loop(self):
        """Start the asyncio event loop in a separate thread for BLE"""
        try:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            self._loop_running = True
            
            logger.info("Started asyncio event loop for EMOTIV BLE operations")
            self.loop.run_forever()
            
        except Exception as e:
            logger.error(f"Error in EMOTIV BLE event loop: {e}")
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
            logger.info("Stopped EMOTIV BLE event loop")
    
    def _run_async(self, coro):
        """Run an async coroutine from sync context"""
        if not self.loop or not self._loop_running:
            return None
        
        future = asyncio.run_coroutine_threadsafe(coro, self.loop)
        try:
            return future.result(timeout=30.0)
        except Exception as e:
            logger.error(f"Error running EMOTIV async operation: {e}")
            return None

    def connect(self) -> bool:
        """Connect to EMOTIV device via USB+HID (best), HID alone (ok), or BLE (fallback)"""
        try:
            if self.is_connected:
                return True
            
            logger.info(f"Connecting to EMOTIV device {self.device_id}")
            
            # Strategy 1: Try USB + HID (best case - USB establishes dongle, HID reads data)
            logger.info("Attempting USB + HID connection (best case)...")
            if self._try_usb_connection():
                # USB connection successful, now try HID for data reading
                logger.info("USB dongle connected, attempting HID data interface...")
                if self._try_hid_connection():
                    return True
                else:
                    # USB alone is no good - disconnect and try other strategies
                    logger.info("HID failed after USB - USB alone is no good, trying other strategies...")
                    self.disconnect()
            
            # Strategy 2: Try HID directly (ok case - direct HID connection)
            logger.info("Attempting direct HID connection...")
            if self._try_hid_connection():
                return True
            
            # Strategy 3: Try BLE fallback
            logger.info("HID connection failed, attempting BLE fallback...")
            if self._try_ble_connection():
                return True
            
            raise DeviceConnectionError("Failed to connect via USB+HID, direct HID, and BLE")
            
        except Exception as e:
            logger.error(f"Error connecting to EMOTIV device {self.device_id}: {e}")
            self.cleanup()
            return False
    
    def _try_usb_connection(self) -> bool:
        """Try to connect via direct USB interface"""
        try:
            if self.usb_interface.connect(self.serial_number):
                self.connection_type = 'usb'
                self.active_interface = self.usb_interface
                
                # Get device info
                device_info = self.usb_interface.get_device_info()
                if device_info:
                    self.serial_number = device_info.get('serial_number', self.serial_number)
                    logger.info(f"Connected to EMOTIV device via USB: {self.serial_number}")
                
                self.is_connected = True
                logger.info(f"EMOTIV device {self.device_id} connected successfully via USB")
                return True
                
        except Exception as e:
            logger.warning(f"USB connection attempt failed: {e}")
        
        return False
    
    def _try_hid_connection(self) -> bool:
        """Try to connect via HID interface"""
        try:
            if self.hid_interface.connect(self.serial_number):
                self.connection_type = 'hid'
                self.active_interface = self.hid_interface
                
                # Get device info
                device_info = self.hid_interface.get_device_info()
                if device_info:
                    self.serial_number = device_info.get('serial_number', self.serial_number)
                    logger.info(f"Connected to EMOTIV device via HID: {self.serial_number}")
                
                self.is_connected = True
                logger.info(f"EMOTIV device {self.device_id} connected successfully via HID")
                return True
                
        except Exception as e:
            logger.warning(f"HID connection attempt failed: {e}")
        
        return False
    
    def _try_ble_connection(self) -> bool:
        """Try to connect via BLE interface"""
        try:
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
                    logger.error("Failed to start BLE event loop")
                    return False
            
            # Set up BLE data callback
            self.ble_interface.set_data_callback(self._handle_ble_data)
            
            # Connect to BLE device
            success = self._run_async(self.ble_interface.connect(self.device_address))
            if success:
                self.connection_type = 'ble'
                self.active_interface = self.ble_interface
                
                # Get device info
                device_info = self._run_async(self.ble_interface.get_device_info())
                if device_info:
                    logger.info(f"Connected to EMOTIV device via BLE: {device_info.get('name', 'Unknown')}")
                
                self.is_connected = True
                logger.info(f"EMOTIV device {self.device_id} connected successfully via BLE")
                return True
                
        except Exception as e:
            logger.warning(f"BLE connection attempt failed: {e}")
            self._stop_event_loop()
        
        return False
    
    def disconnect(self) -> bool:
        """Disconnect from EMOTIV device"""
        try:
            if not self.is_connected:
                return True
            
            logger.info(f"Disconnecting EMOTIV device {self.device_id} (via {self.connection_type})")
            
            # Stop streaming if active
            if self.is_streaming:
                self.stop_streaming()
            
            # Disconnect based on connection type
            if self.connection_type == 'usb':
                self.usb_interface.disconnect()
            elif self.connection_type == 'hid':
                self.hid_interface.disconnect()
            elif self.connection_type == 'ble':
                if self.loop and self._loop_running:
                    self._run_async(self.ble_interface.disconnect())
                self._stop_event_loop()
            
            self.connection_type = None
            self.active_interface = None
            self.is_connected = False
            logger.info(f"EMOTIV device {self.device_id} disconnected successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting EMOTIV device {self.device_id}: {e}")
            return False
    
    def start_streaming(self) -> bool:
        """Start streaming EEG data from EMOTIV"""
        try:
            if self.is_streaming:
                return True
            
            if not self.is_connected:
                raise DeviceStreamingError("Device not connected")
            
            logger.info(f"Starting streaming for EMOTIV device {self.device_id} via {self.connection_type}")
            
            # Reconnect if interface was cleaned up during stop_streaming
            if self.connection_type == 'hid' and self.hid_interface and not self.hid_interface.is_connected():
                logger.info("HID interface was cleaned up, reconnecting...")
                if not self.hid_interface.connect(self.serial_number):
                    raise DeviceStreamingError("Failed to reconnect HID interface")
                logger.info("HID interface reconnected successfully")
            
            elif self.connection_type == 'usb' and self.usb_interface and not self.usb_interface.is_connected():
                logger.info("USB interface was cleaned up, reconnecting...")
                if not self.usb_interface.connect(self.serial_number):
                    raise DeviceStreamingError("Failed to reconnect USB interface")
                logger.info("USB interface reconnected successfully")
            
            if self.connection_type == 'hid':
                # Start background streaming thread for HID
                self.is_streaming = True
                if not self._start_stream_thread():
                    self.is_streaming = False
                    raise DeviceStreamingError("Failed to start HID streaming thread")
            
            elif self.connection_type == 'usb':
                # Start background streaming thread for USB (same as HID)
                self.is_streaming = True
                if not self._start_stream_thread():
                    self.is_streaming = False
                    raise DeviceStreamingError("Failed to start USB streaming thread")
            
            elif self.connection_type == 'ble':
                # Start BLE streaming via notifications
                success = self._run_async(self.ble_interface.start_streaming())
                if not success:
                    raise DeviceStreamingError("Failed to start BLE streaming")
                self.is_streaming = True
            
            else:
                raise DeviceStreamingError(f"Unknown connection type: {self.connection_type}")
            
            logger.info(f"Streaming started for EMOTIV device {self.device_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting streaming for EMOTIV device {self.device_id}: {e}")
            return False
    
    def stop_streaming(self) -> bool:
        """Stop streaming EEG data from EMOTIV"""
        try:
            if not self.is_streaming:
                return True
            
            logger.info(f"Stopping streaming for EMOTIV device {self.device_id} via {self.connection_type}")
            
            if self.connection_type == 'hid':
                # Stop background thread for HID
                self._stop_stream_thread()
                # Clean up HID interface to ensure proper state for restart
                if self.hid_interface:
                    logger.debug("Cleaning up HID interface after stopping stream")
                    self.hid_interface.cleanup()
            
            elif self.connection_type == 'usb':
                # Stop background thread for USB (same as HID)
                self._stop_stream_thread()
                # Clean up USB interface to ensure proper state for restart
                if self.usb_interface:
                    logger.debug("Cleaning up USB interface after stopping stream")
                    self.usb_interface.cleanup()
            
            elif self.connection_type == 'ble':
                # Stop BLE streaming
                if self.loop and self._loop_running:
                    self._run_async(self.ble_interface.stop_streaming())
            
            self.is_streaming = False
            logger.info(f"Streaming stopped for EMOTIV device {self.device_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping streaming for EMOTIV device {self.device_id}: {e}")
            return False
    
    def calibrate(self) -> bool:
        """Perform device calibration"""
        try:
            if not self.is_connected:
                logger.error("Device not connected for calibration")
                return False
            
            logger.info(f"Starting calibration for EMOTIV device {self.device_id}")
            
            # Collect calibration data
            calibration_duration = 5.0  # seconds
            calibration_data = [[] for _ in range(len(self.eeg_channels))]
            
            start_time = time.time()
            samples_collected = 0
            
            while time.time() - start_time < calibration_duration:
                # Read a sample
                sample = self._read_sample()
                if sample and len(sample.data) >= len(self.eeg_channels):
                    for i in range(len(self.eeg_channels)):
                        calibration_data[i].append(sample.data[i])
                    samples_collected += 1
                
                # Control sampling rate
                time.sleep(1.0 / self.sample_rate)
            
            # Calculate calibration values (baseline offset)
            if samples_collected > 0:
                self.calibration_values = [
                    np.mean(channel_data) if channel_data else 0.0 
                    for channel_data in calibration_data
                ]
                self.is_calibrated = True
                
                logger.info(f"Calibration completed: {samples_collected} samples, "
                          f"offsets: {[f'{val:.6f}' for val in self.calibration_values]}")
                return True
            else:
                logger.error("No calibration data collected")
                return False
            
        except Exception as e:
            logger.error(f"Error during calibration: {e}")
            return False
    
    def get_device_info(self) -> Dict[str, Any]:
        """Get device information and capabilities"""
        base_info = {
            'device_id': self.device_id,
            'device_model': self.device_model,
            'device_type': 'emotiv',
            'num_channels': len(self.channels),
            'eeg_channels': len(self.eeg_channels),
            'channel_names': self.channels,
            'eeg_channel_names': self.eeg_channels,
            'sample_rate': self.sample_rate,
            'resolution': '16-bit',
            'connection_type': self.connection_type or 'HID/Bluetooth LE',
            'active_connection': self.connection_type,
            'is_calibrated': self.is_calibrated,
            'calibration_values': self.calibration_values,
            'serial_number': self.serial_number,
            'include_motion': self.include_motion,
            'prefer_hid': self.prefer_hid,
            'sensor_parser_available': self.sensor_parser is not None,
            'available_sensors': self.sensor_parser.get_available_channels() if self.sensor_parser else []
        }
        
        # Get interface-specific info
        if self.connection_type == 'hid' and self.hid_interface:
            hid_info = self.hid_interface.get_device_info() or {}
            base_info.update({
                'vendor_id': hid_info.get('vendor_id'),
                'product_id': hid_info.get('product_id'),
                'manufacturer': hid_info.get('manufacturer_string'),
                'product_name': hid_info.get('product_string')
            })
        
        elif self.connection_type == 'ble' and self.ble_interface and self.loop and self._loop_running:
            try:
                ble_info = self._run_async(self.ble_interface.get_device_info()) or {}
                base_info.update({
                    'ble_name': ble_info.get('name'),
                    'ble_address': ble_info.get('address'),
                    'battery_level': ble_info.get('battery_level'),
                    'firmware_version': ble_info.get('firmware_version')
                })
            except Exception as e:
                logger.error(f"Error getting BLE device info: {e}")
        
        return base_info
    
    def _read_sample(self) -> Optional[EEGSample]:
        """Read a single EEG sample from EMOTIV (USB/HID mode only)"""
        try:
            if self.connection_type not in ['usb', 'hid']:
                # BLE data comes via callback, not polling
                logger.debug("Not in USB/HID mode, skipping sample read")
                return None
            
            logger.debug(f"Reading sample from EMOTIV device {self.device_id} via {self.connection_type}")
            
            # Read raw data packet from active interface
            if self.connection_type == 'usb':
                raw_channels = self.usb_interface.read_packet()
            else:  # hid
                raw_channels = self.hid_interface.read_packet()
                
            if not raw_channels:
                logger.debug(f"No raw channels received from {self.connection_type.upper()} interface")
                return None
            
            logger.debug(f"Received {len(raw_channels)} raw channels from {self.connection_type.upper()}: {raw_channels[:4]}..." if len(raw_channels) > 4 else f"Received {len(raw_channels)} raw channels from {self.connection_type.upper()}: {raw_channels}")
            
            # Process the data into EEG sample using sensor parser
            sample = self._process_eeg_data_with_parser(raw_channels, len(raw_channels))
            if sample:
                logger.debug(f"Successfully created EEG sample with {len(sample.data)} data points")
            else:
                logger.debug("Failed to process EEG data into sample")
            
            return sample
            
        except Exception as e:
            logger.error(f"Error reading {self.connection_type} sample from EMOTIV: {e}")
            return None
    
    def _handle_ble_data(self, data: bytes):
        """Handle EEG data from BLE interface"""
        try:
            # Parse the raw BLE data
            parsed_data = self.ble_interface.parse_eeg_data(data)
            if not parsed_data:
                return
            
            # Process the data and create EEG sample
            sample = self._process_eeg_data(parsed_data, len(data))
            if sample and self.data_callback:
                self.data_callback(sample)
                
        except Exception as e:
            logger.error(f"Error handling BLE data: {e}")
    
    def _process_eeg_data(self, raw_channels: List[int], raw_data_size: int) -> Optional[EEGSample]:
        """Process raw channel data into EEG sample (common for both HID and BLE)"""
        try:
            # Convert raw values to voltages
            eeg_data = []
            for i, raw_value in enumerate(raw_channels[:len(self.eeg_channels)]):
                # Convert 16-bit unsigned to signed
                if raw_value > 32767:
                    signed_value = raw_value - 65536
                else:
                    signed_value = raw_value
                
                # Convert to voltage
                voltage = signed_value * self.scale_factor
                eeg_data.append(voltage)
            
            # Apply calibration if available
            if self.is_calibrated:
                calibrated_eeg = [
                    voltage - self.calibration_values[i] 
                    for i, voltage in enumerate(eeg_data)
                ]
            else:
                calibrated_eeg = eeg_data
            
            # Add motion data if enabled
            final_data = calibrated_eeg.copy()
            if self.include_motion and len(raw_channels) > len(self.eeg_channels):
                # Extract motion sensor data (gyro X, Y)
                motion_start = len(self.eeg_channels)
                for i in range(min(2, len(raw_channels) - motion_start)):
                    motion_raw = raw_channels[motion_start + i]
                    # Convert motion data (implementation depends on EMOTIV specs)
                    motion_value = (motion_raw - 32768) / 1000.0  # Rough conversion
                    final_data.append(motion_value)
            
            # Create EEG sample
            sample = EEGSample(
                timestamp=time.time(),
                channels=self.channels,
                data=final_data,
                sample_rate=self.sample_rate,
                device_id=self.device_id,
                device_model=self.device_model,
                metadata={
                    'is_calibrated': self.is_calibrated,
                    'include_motion': self.include_motion,
                    'connection_type': self.connection_type,
                    'raw_data_size': raw_data_size
                }
            )
            
            return sample
            
        except Exception as e:
            logger.error(f"Error processing EMOTIV EEG data: {e}")
            return None
    
    def _process_eeg_data_with_parser(self, raw_channels: List[int], raw_data_size: int) -> Optional[EEGSample]:
        """Process raw channel data into EEG sample using sensor parser"""
        try:
            # Convert raw channels to bytes for sensor parser
            raw_data = bytes(raw_channels)
            
            # Parse sensor data using the sensor parser
            sensor_values = self.sensor_parser.parse_sensor_data(raw_data)
            
            if not sensor_values:
                logger.warning("No sensor values parsed")
                return None
            
            # Get quality data
            quality_data = self.sensor_parser.get_sensor_quality(raw_data)
            
            # Convert sensor values to list in channel order
            final_data = []
            for channel in self.channels:
                if channel in sensor_values:
                    final_data.append(sensor_values[channel])
                else:
                    final_data.append(0.0)  # Default value if channel not found
            
            # Create EEG sample
            sample = EEGSample(
                timestamp=time.time(),
                channels=self.channels,
                data=final_data,
                sample_rate=self.sample_rate,
                device_id=self.device_id,
                device_model=self.device_model,
                metadata={
                    'is_calibrated': self.is_calibrated,
                    'include_motion': self.include_motion,
                    'connection_type': self.connection_type,
                    'raw_data_size': raw_data_size,
                    'sensor_quality': quality_data,
                    'parsed_sensors': list(sensor_values.keys())
                }
            )
            
            return sample
            
        except Exception as e:
            logger.error(f"Error processing EMOTIV EEG data with parser: {e}")
            return None
    
    def get_available_devices(self) -> List[Dict[str, Any]]:
        """Get list of available EMOTIV devices (USB, HID, and BLE)"""
        devices = []
        
        # Scan for USB devices
        try:
            usb_devices = self.usb_interface.scan_devices()
            for device in usb_devices:
                device['connection_type'] = 'usb'
            devices.extend(usb_devices)
        except Exception as e:
            logger.error(f"Error scanning for EMOTIV USB devices: {e}")
        
        # Scan for HID devices
        try:
            hid_devices = self.hid_interface.scan_devices()
            for device in hid_devices:
                device['connection_type'] = 'hid'
            devices.extend(hid_devices)
        except Exception as e:
            logger.error(f"Error scanning for EMOTIV HID devices: {e}")
        
        # Scan for BLE devices
        try:
            if not self._loop_running:
                # Start temporary event loop for scanning
                temp_loop = asyncio.new_event_loop()
                temp_interface = EmotivBLEInterface()
                
                async def scan_async():
                    return await temp_interface.scan_devices()
                
                ble_devices = temp_loop.run_until_complete(scan_async())
                temp_loop.close()
                
                for device in ble_devices:
                    device['connection_type'] = 'ble'
                devices.extend(ble_devices)
            else:
                ble_devices = self._run_async(self.ble_interface.scan_devices()) or []
                for device in ble_devices:
                    device['connection_type'] = 'ble'
                devices.extend(ble_devices)
                
        except Exception as e:
            logger.error(f"Error scanning for EMOTIV BLE devices: {e}")
        
        logger.info(f"Found {len(devices)} EMOTIV devices total (USB + HID + BLE)")
        return devices
    
    def set_serial_number(self, serial_number: str) -> bool:
        """Set specific device serial number to connect to"""
        if self.is_connected:
            logger.error("Cannot change serial number while connected")
            return False
        
        self.serial_number = serial_number
        return True
    
    def get_contact_quality(self) -> Optional[List[float]]:
        """Get electrode contact quality (if available)"""
        # EMOTIV devices may provide contact quality data in some packets
        # This would require specific packet parsing implementation
        logger.info("Contact quality measurement not implemented for EMOTIV")
        return None
    
    def validate_config(self) -> bool:
        """Validate EMOTIV specific configuration"""
        if not super().validate_config():
            return False
        
        if self.sample_rate != 128:
            logger.warning(f"EMOTIV sample rate should be 128 Hz, got {self.sample_rate}")
        
        return True
    
    def cleanup(self):
        """Cleanup EMOTIV specific resources"""
        logger.info(f"Cleaning up EMOTIV device {self.device_id}")
        try:
            # Stop streaming and disconnect
            if self.is_streaming:
                self.stop_streaming()
            if self.is_connected:
                self.disconnect()
            
            # Cleanup interfaces
            if self.hid_interface:
                self.hid_interface.cleanup()
            if self.usb_interface:
                self.usb_interface.cleanup()
            if self.ble_interface:
                self.ble_interface.cleanup()
            
            # Cleanup sensor parser
            if self.sensor_parser:
                # Sensor parser doesn't need explicit cleanup, but we can mark it
                self.sensor_parser = None
            
            # Stop event loop
            self._stop_event_loop()
            
        except Exception as e:
            logger.error(f"Error during EMOTIV cleanup: {e}")
        finally:
            super().cleanup()
    
    def check_device_status(self) -> Dict[str, Any]:
        """Check the status of the connected device"""
        status = {
            'device_id': self.device_id,
            'device_model': self.device_model,
            'connection_type': self.connection_type,
            'is_connected': self.is_connected,
            'is_streaming': self.is_streaming,
            'samples_sent': self.samples_sent,
            'last_sample_time': getattr(self, 'last_sample_time', None)
        }
        
        # Add interface-specific status
        if self.connection_type == 'usb' and self.usb_interface:
            usb_status = self.usb_interface.check_device_status()
            status['usb_status'] = usb_status
        elif self.connection_type == 'hid' and self.hid_interface:
            hid_status = self.hid_interface.get_device_info()
            status['hid_status'] = hid_status
        elif self.connection_type == 'bluetooth_le' and self.ble_interface:
            # BLE status would need to be async, so we'll just note it's connected
            status['ble_status'] = {'connected': self.ble_interface.is_connected}
        
        # Add sensor parser info if available
        if hasattr(self, 'sensor_parser') and self.sensor_parser:
            status['sensor_parser'] = {
                'available': True,
                'channels': self.sensor_parser.get_available_channels(),
                'battery_level': self.sensor_parser.get_battery_level()
            }
        
        return status
    
    def activate_device(self) -> bool:
        """Try to activate the device for streaming"""
        try:
            logger.info(f"Attempting to activate device {self.device_id} for streaming...")
            
            if self.connection_type == 'usb' and self.usb_interface:
                # Try to activate USB device
                status = self.usb_interface.check_device_status()
                if not status.get('device_active', False):
                    logger.info("USB device not active, attempting activation...")
                    # The activation is handled in check_device_status
                    status = self.usb_interface.check_device_status()
                    return status.get('device_active', False)
                return True
            elif self.connection_type == 'hid' and self.hid_interface:
                # HID devices are usually always ready
                return True
            elif self.connection_type == 'bluetooth_le' and self.ble_interface:
                # BLE devices need to be in streaming mode
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error activating device: {e}")
            return False