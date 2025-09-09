"""
HID Interface Module for EMOTIV

Handles low-level HID communication and AES decryption for EMOTIV devices.
Updated to use modular crypto and sensor parsing based on emokit patterns.
"""

import logging
import time
from typing import Optional, List, Tuple, Dict, Any

# Try to import hidapi, but handle gracefully if not available
try:
    import hidapi
    HIDAPI_AVAILABLE = True
except ImportError:
    HIDAPI_AVAILABLE = False
    logging.warning("hidapi not available - HID functionality will be disabled")

# Import our new modular components
from .crypto import EmotivCrypto
from .sensors import EmotivSensorParser
from .device_detection import EmotivDeviceDetector

logger = logging.getLogger('device.emotiv.hid')

class HIDInterface:
    """Handles HID communication with EMOTIV devices using modular components"""
    
    # EMOTIV constants
    EMOTIV_VENDOR_ID = 4660
    EPOC_X_PRODUCT_ID = 60674  # EPOC X (0xed02)
    
    def __init__(self, vendor_id: int = None, product_id: int = None):
        self.vendor_id = vendor_id or self.EMOTIV_VENDOR_ID
        self.product_id = product_id or self.EPOC_X_PRODUCT_ID
        
        self.hid_device = None
        self.crypto = None
        self.sensor_parser = None
        self.device_detector = None
        self.device_serial = None
        self.device_model = None
        self.packet_size = None  # Will be set based on detected device model
        self.is_initialized = False
        
        # Initialize hidapi if available
        if HIDAPI_AVAILABLE:
            # System hidapi doesn't have hid_init() - it's automatically initialized
            logger.info(f"HID interface initialized for vendor {self.vendor_id}, product {self.product_id}")
        else:
            logger.warning("HID interface disabled - hidapi not available")
        
        # Initialize modular components
        self.sensor_parser = EmotivSensorParser(verbose=True)
        try:
            self.device_detector = EmotivDeviceDetector(verbose=True)
        except Exception as e:
            logger.warning(f"Could not initialize device detector: {e}")
            self.device_detector = None
    
    def _convert_c_string(self, c_string):
        """Convert CFFI cdata string (char* or wchar_t*) to Python string using system hidapi's ffi."""
        if not c_string:
            return None
        try:
            import hidapi
            ffi = hidapi.ffi
            result = ffi.string(c_string)
            if isinstance(result, bytes):
                return result.decode('utf-8')
            return result
        except Exception as e:
            logger.debug(f"Error converting CFFI object with ffi.string(): {e}")
            return None
    
    def _convert_c_string_bytes(self, c_string):
        """Convert CFFI cdata string (char* or wchar_t*) to Python bytes using system hidapi's ffi."""
        if not c_string:
            return None
        try:
            import hidapi
            ffi = hidapi.ffi
            result = ffi.string(c_string)
            if isinstance(result, bytes):
                return result
            return result.encode('utf-8') if result else None
        except Exception as e:
            logger.debug(f"Error converting CFFI object with ffi.string(): {e}")
            return None
    
    def scan_devices(self) -> List[Dict[str, Any]]:
        """Scan for available EMOTIV devices using enhanced detection"""
        if not HIDAPI_AVAILABLE:
            logger.warning("Cannot scan for HID devices - hidapi not available")
            return []
            
        devices = []
        try:
            # Convert the C pointer to a list of device info dictionaries
            device_list = hidapi.hidapi.hid_enumerate(self.vendor_id, self.product_id)
            if device_list:
                # Convert the linked list to Python list
                current = device_list
                while current:
                    # Use emokit's approach: access serial_number directly
                    serial_number = self._convert_c_string(current.serial_number)
                    
                    device_info = {
                        'vendor_id': current.vendor_id,
                        'product_id': current.product_id,
                        'serial_number': serial_number,
                        'path': self._convert_c_string_bytes(current.path),  # Use bytes for hid_open_path
                        'manufacturer_string': self._convert_c_string(current.manufacturer_string),
                        'product_string': self._convert_c_string(current.product_string)
                    }
                    
                    if device_info['vendor_id'] == self.vendor_id:
                         # Use device detector to validate and get additional info
                         if self.device_detector and self.device_detector.is_emotiv_device(device_info):
                             device_model = self.device_detector.detect_device_model(device_info)
                             device_features = self.device_detector.get_device_features(device_model) if device_model else []
                             
                             enhanced_device = {
                                 'vendor_id': device_info['vendor_id'],
                                 'product_id': device_info['product_id'],
                                 'serial_number': device_info['serial_number'],
                                 'path': device_info['path'],
                                 'manufacturer_string': device_info.get('manufacturer_string', ''),
                                 'product_string': device_info.get('product_string', ''),
                                 'device_model': device_model,
                                 'features': device_features,
                                 'connection_type': 'hid'
                             }
                             
                             devices.append(enhanced_device)
                             logger.info(f"Found EMOTIV device: {device_info['serial_number']} (Model: {device_model})")
                         else:
                             # Fallback: accept device if vendor ID matches (for compatibility)
                             enhanced_device = {
                                 'vendor_id': device_info['vendor_id'],
                                 'product_id': device_info['product_id'],
                                 'serial_number': device_info['serial_number'],
                                 'path': device_info['path'],
                                 'manufacturer_string': device_info.get('manufacturer_string', ''),
                                 'product_string': device_info.get('product_string', ''),
                                 'device_model': None,
                                 'features': [],
                                 'connection_type': 'hid'
                             }
                             
                             devices.append(enhanced_device)
                             logger.info(f"Found EMOTIV device (fallback): {device_info['serial_number']}")
                    
                    # Move to next device in linked list
                    current = current.next
                
            logger.info(f"Found {len(devices)} EMOTIV devices")
            return devices
            
        except Exception as e:
            logger.error(f"Error scanning for devices: {e}")
            return []
    
    def connect(self, serial_number: str = None) -> bool:
        """Connect to EMOTIV device using enhanced detection and crypto"""
        try:
            if self.is_initialized:
                return True
            
            logger.info("Scanning for EMOTIV devices...")
            
            # Find EMOTIV device 
            target_device = None
            emotiv_devices = []
            
            # Convert the C pointer to a list of device info dictionaries
            device_list = hidapi.hidapi.hid_enumerate(self.vendor_id, self.product_id)
            if device_list:
                # Convert the linked list to Python list
                current = device_list
                while current:
                    # Use emokit's approach: access serial_number directly
                    serial_number = self._convert_c_string(current.serial_number)
                    logger.debug(f"Converted serial number: '{serial_number}' from {current.serial_number}")
                    
                    device_info = {
                        'vendor_id': current.vendor_id,
                        'product_id': current.product_id,
                        'serial_number': serial_number,
                        'path': self._convert_c_string_bytes(current.path),  # Use bytes for hid_open_path
                        'manufacturer_string': self._convert_c_string(current.manufacturer_string),
                        'product_string': self._convert_c_string(current.product_string)
                    }
                    
                    logger.debug(f"Checking HID device: Vendor={device_info['vendor_id']}, Product={device_info['product_id']}, Serial={device_info.get('serial_number', 'None')}")
                    
                    if device_info['vendor_id'] == self.vendor_id:
                        logger.debug(f"Found matching vendor ID: {device_info['vendor_id']}")
                        
                        # Accept any device with matching vendor ID as EMOTIV
                        emotiv_devices.append(device_info)
                        logger.debug(f"Added EMOTIV device: {device_info.get('serial_number', 'Unknown')}")
                    
                    # Move to next device in linked list
                    current = current.next
                 
                # Use the first available HID device since we have the serial number from USB
            if len(emotiv_devices) >= 1:
                target_device = emotiv_devices[0]  # Use first device
                logger.info(f"Using first EMOTIV HID device: {target_device.get('serial_number', 'Unknown')}")
            else:
                logger.error(f"No EMOTIV devices found (looking for vendor_id: {self.vendor_id})")
                # List all HID devices for debugging
                logger.info("Available HID devices:")
                device_list = hidapi.hidapi.hid_enumerate(self.vendor_id, self.product_id)
                if device_list:
                    current = device_list
                    while current:
                        # Use emokit's approach: access serial_number directly
                        serial_number = self._convert_c_string(current.serial_number)
                        
                        device_info = {
                            'vendor_id': current.vendor_id,
                            'product_id': current.product_id,
                            'serial_number': serial_number,
                            'path': self._convert_c_string(current.path),
                            'manufacturer_string': self._convert_c_string(current.manufacturer_string),
                            'product_string': self._convert_c_string(current.product_string)
                        }
                        logger.info(f"  Vendor: {device_info['vendor_id']}, Product: {device_info['product_id']}, Serial: {device_info.get('serial_number', 'None')}")
                        current = current.next
                return False
            
            # Accept any EMOTIV device since we have the serial number from USB
            logger.info(f"Found EMOTIV HID device for connection")
            
            # Connect to device using path like emokit (preferred method)
            if target_device['path']:
                logger.debug(f"Using hid_open_path with path: {target_device['path']}")
                # hid_open_path expects bytes, not string
                path_bytes = target_device['path'] if isinstance(target_device['path'], bytes) else target_device['path'].encode('utf-8')
                self.hid_device = hidapi.hidapi.hid_open_path(path_bytes)
            else:
                # Fallback to vendor/product/serial method
                logger.debug(f"No path available, using hid_open with vendor/product/serial")
                # For hid_open, we need to pass None for serial if it's not available
                serial_for_open = target_device['serial_number'] if target_device['serial_number'] else None
                self.hid_device = hidapi.hidapi.hid_open(target_device['vendor_id'], target_device['product_id'], serial_for_open)
            
            # Use the HID device's serial number for crypto (preferred)
            # The crypto needs the actual device serial number for decryption
            if target_device['serial_number'] and target_device['serial_number'] != "HID_DEVICE_SERIAL":
                self.device_serial = target_device['serial_number']
                logger.info(f"Using HID device serial number for crypto: {self.device_serial}")
            elif serial_number:
                # Fallback to USB dongle's serial if HID serial is not available
                self.device_serial = serial_number
                logger.info(f"Using USB dongle serial number for crypto: {self.device_serial}")
            else:
                logger.warning("No serial number available for crypto initialization")
                self.device_serial = None
            
            # Detect device model and set packet size
            logger.debug(f"Device detection info: vendor_id={target_device.get('vendor_id')}, product_id={target_device.get('product_id')}, serial={target_device.get('serial_number')}, product_string={target_device.get('product_string')}")
            
            if self.device_detector:
                self.device_model = self.device_detector.detect_device_model(target_device)
                logger.debug(f"Device detector result: {self.device_model}")
                if self.device_model:
                    self.packet_size = self.device_detector.get_device_packet_size(self.device_model)
                    logger.info(f"Detected device model: {self.device_model}, packet size: {self.packet_size} bytes")
                else:
                    # For EPOC X devices, default to 64 bytes even if detection fails
                    # Check if this might be an EPOC X based on product ID
                    if target_device.get('product_id') == self.EPOC_X_PRODUCT_ID:
                        self.device_model = 'EPOC X'
                        self.packet_size = 64
                        logger.info(f"Assuming EPOC X based on product ID, packet size: {self.packet_size} bytes")
                    else:
                        # Fallback to new format (64 bytes) if model detection fails
                        self.packet_size = 64
                        logger.warning(f"Could not detect device model, using fallback packet size: {self.packet_size} bytes")
            else:
                # Use fallback packet size if device detector is not available
                # For EPOC X devices, default to 64 bytes
                if target_device.get('product_id') == self.EPOC_X_PRODUCT_ID:
                    self.device_model = 'EPOC X'
                    self.packet_size = 64
                    logger.info(f"Assuming EPOC X based on product ID (no detector), packet size: {self.packet_size} bytes")
                else:
                    self.packet_size = 64
                    logger.warning(f"Device detector not available, using fallback packet size: {self.packet_size} bytes")
            
            # Set device to blocking mode for EMOTIV devices (they seem to work better this way)
            hidapi.hidapi.hid_set_nonblocking(self.hid_device, 0)
            
            # Try to activate the device by sending a feature report
            try:
                ffi = hidapi.ffi
                buffer = ffi.new('unsigned char[]', 8)
                buffer[0] = 1  # Activation pattern
                logger.debug(f"About to send activation feature report with pattern: {[buffer[i] for i in range(8)]}")
                result = hidapi.hidapi.hid_send_feature_report(self.hid_device, buffer, 8)
                logger.info(f"Device activation feature report sent, result: {result}")
                logger.debug(f"Activation result type: {type(result)}")
                
                # Try additional activation patterns
                activation_patterns = [
                    [1, 1, 1, 1, 1, 1, 1, 1],  # All ones
                    [0, 1, 0, 1, 0, 1, 0, 1],  # Alternating
                    [1, 0, 0, 0, 0, 0, 0, 0],  # Just first bit
                ]
                
                for i, pattern in enumerate(activation_patterns):
                    try:
                        buffer = ffi.new('unsigned char[]', 8)
                        for j, val in enumerate(pattern):
                            buffer[j] = val
                        result = hidapi.hidapi.hid_send_feature_report(self.hid_device, buffer, 8)
                        logger.debug(f"Activation pattern {i+1} sent, result: {result}")
                    except Exception as e:
                        logger.debug(f"Activation pattern {i+1} failed: {e}")
                        
            except Exception as e:
                logger.warning(f"Could not send activation feature report: {e}")
            
            logger.info(f"Successfully opened EMOTIV device: {self.device_serial}")
            
            # Test if device is ready to send data
            logger.debug("Testing device readiness with a quick read attempt...")
            try:
                ffi = hidapi.ffi
                # Try 32-byte read first (per emokit documentation for EPOC devices)
                test_buffer = ffi.new("unsigned char[]", 32)
                test_result = hidapi.hidapi.hid_read_timeout(self.hid_device, test_buffer, 32, 100)
                logger.debug(f"Device readiness test (32-byte): read result = {test_result}")
                if test_result > 0:
                    logger.debug(f"Device is ready and sent {test_result} bytes")
                    # If 32 bytes work, update packet size
                    self.packet_size = 32
                    logger.info(f"Updated packet size to 32 bytes based on successful read")
                else:
                    # Try 64-byte read as fallback
                    test_buffer = ffi.new("unsigned char[]", 64)
                    test_result = hidapi.hidapi.hid_read_timeout(self.hid_device, test_buffer, 64, 100)
                    logger.debug(f"Device readiness test (64-byte): read result = {test_result}")
                    if test_result > 0:
                        logger.debug(f"Device is ready and sent {test_result} bytes")
                        self.packet_size = 64
                        logger.info(f"Updated packet size to 64 bytes based on successful read")
                    else:
                        logger.debug(f"Device not ready yet (result: {test_result})")
            except Exception as e:
                logger.debug(f"Device readiness test failed: {e}")
            
            # Request feature report to determine device type (consumer vs research)
            device_type = None
            try:
                logger.debug("Requesting feature report to determine device type...")
                ffi = hidapi.ffi
                feature_buffer = ffi.new('unsigned char[]', 32)
                result = hidapi.hidapi.hid_get_feature_report(self.hid_device, feature_buffer, 32)
                if result > 0:
                    feature_data = list(ffi.buffer(feature_buffer, result))
                    logger.debug(f"Feature report received: {feature_data[:8]}...")
                    # Check if this is a research device (specific bit pattern)
                    if len(feature_data) >= 8:
                        # Simple heuristic: if first byte is 0x00, likely research device
                        device_type = 'research' if feature_data[0] == 0x00 else 'consumer'
                        logger.info(f"Detected device type: {device_type}")
                    else:
                        device_type = 'consumer'  # Default to consumer
                        logger.info("Feature report too short, defaulting to consumer device")
                else:
                    device_type = 'consumer'  # Default to consumer
                    logger.warning(f"Feature report request failed (result: {result}), defaulting to consumer device")
            except Exception as e:
                device_type = 'consumer'  # Default to consumer
                logger.warning(f"Error requesting feature report: {e}, defaulting to consumer device")
            
            # Initialize crypto with actual device serial and device type
            if self.device_serial:
                self.crypto = EmotivCrypto(self.device_serial, device_type=device_type, verbose=True)
                logger.info(f"Crypto module initialized successfully for {device_type} device")
            else:
                logger.warning("No device serial available, crypto module not initialized")
                self.crypto = None
            
            self.is_initialized = True
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to EMOTIV device: {e}")
            self.cleanup()
            return False
    
    def disconnect(self) -> bool:
        """Disconnect from EMOTIV device"""
        try:
            logger.info("Disconnecting from EMOTIV device...")
            
            if self.hid_device:
                hidapi.hidapi.hid_close(self.hid_device)
                self.hid_device = None
                logger.info("HID device closed")
            
            self.crypto = None
            self.device_serial = None
            self.is_initialized = False
            
            # Give OS time to release the device
            time.sleep(1)
            
            logger.info("EMOTIV device disconnected successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting from EMOTIV device: {e}")
            return False
    
    def read_packet(self, timeout: int = 1000) -> Optional[List[int]]:
        """Read and decrypt a data packet from EMOTIV device using modular components"""
        if not self.is_initialized or not self.hid_device:
            logger.error("Device not initialized")
            return None
        
        # Additional connection state debugging
        logger.debug(f"HID device connected: {self.is_connected()}")
        logger.debug(f"HID device handle: {self.hid_device}")
        logger.debug(f"Device initialized: {self.is_initialized}")
        logger.debug(f"Packet size: {self.packet_size}")
        logger.debug(f"Device model: {self.device_model}")
        
        # Test if device handle is still valid
        try:
            if self.hid_device:
                # Try to get device info to verify handle is still valid
                test_info = hidapi.hidapi.hid_get_product_string(self.hid_device)
                logger.debug(f"Device handle test - product string: {test_info}")
        except Exception as e:
            logger.debug(f"Device handle test failed: {e}")
        
        try:
            logger.debug(f"Attempting to read {self.packet_size} bytes from HID device with timeout...")
            
            # Try to wake up the device if it's not sending data
            if not hasattr(self, '_last_data_time'):
                self._last_data_time = 0
                self._consecutive_timeouts = 0
            
            current_time = time.time()
            if current_time - self._last_data_time > 5:  # If no data for 5 seconds
                self._consecutive_timeouts += 1
                if self._consecutive_timeouts > 3:  # After 3 consecutive timeouts
                    logger.debug("Device seems inactive, trying to wake it up...")
                    self._try_wake_up_device()
                    self._consecutive_timeouts = 0
            
            # Try both blocking and timeout reads for EMOTIV devices
            try:
                # First try blocking read
                ffi = hidapi.ffi
                buffer = ffi.new("unsigned char[]", self.packet_size)
                logger.debug(f"Attempting blocking read for {self.packet_size} bytes...")
                logger.debug(f"HID device handle: {self.hid_device}")
                logger.debug(f"Buffer size: {self.packet_size}")
                result = hidapi.hidapi.hid_read(self.hid_device, buffer, self.packet_size)
                logger.debug(f"Blocking read result: {result}")
                logger.debug(f"Result type: {type(result)}")
                
                if result > 0:
                    # Convert CFFI buffer to Python list
                    raw_data = list(ffi.buffer(buffer, result))
                    logger.debug(f"HID blocking read completed, got {len(raw_data)} bytes: {raw_data[:8]}...")
                    self._last_data_time = time.time()  # Track successful data read
                    self._consecutive_timeouts = 0  # Reset timeout counter
                else:
                    # Try timeout read as fallback
                    logger.debug(f"Blocking read returned {result}, trying timeout read with 1000ms timeout...")
                    logger.debug(f"About to call hid_read_timeout with timeout=1000ms")
                    result = hidapi.hidapi.hid_read_timeout(self.hid_device, buffer, self.packet_size, 1000)
                    logger.debug(f"Timeout read result: {result}")
                    logger.debug(f"Timeout result type: {type(result)}")
                    
                    if result > 0:
                        raw_data = list(ffi.buffer(buffer, result))
                        logger.debug(f"HID timeout read completed, got {len(raw_data)} bytes: {raw_data[:8]}...")
                        self._last_data_time = time.time()
                        self._consecutive_timeouts = 0
                    else:
                        logger.debug(f"Both blocking and timeout reads failed: result={result}")
                        # Try a shorter timeout as a last resort
                        logger.debug("Trying shorter timeout read (100ms)...")
                        logger.debug(f"About to call hid_read_timeout with timeout=100ms")
                        result = hidapi.hidapi.hid_read_timeout(self.hid_device, buffer, self.packet_size, 100)
                        logger.debug(f"Short timeout read result: {result}")
                        logger.debug(f"Short timeout result type: {type(result)}")
                        
                        if result > 0:
                            raw_data = list(ffi.buffer(buffer, result))
                            logger.debug(f"HID short timeout read completed, got {len(raw_data)} bytes: {raw_data[:8]}...")
                            self._last_data_time = time.time()
                            self._consecutive_timeouts = 0
                        else:
                            logger.debug(f"All read attempts failed: result={result}")
                            # Try to read with a smaller buffer to see if device is sending anything
                            logger.debug("Trying to read with smaller buffer to test device responsiveness...")
                            try:
                                small_buffer = ffi.new("unsigned char[]", 8)
                                small_result = hidapi.hidapi.hid_read_timeout(self.hid_device, small_buffer, 8, 100)
                                logger.debug(f"Small buffer read result: {small_result}")
                                if small_result > 0:
                                    small_data = list(ffi.buffer(small_buffer, small_result))
                                    logger.debug(f"Small buffer got data: {small_data}")
                            except Exception as e:
                                logger.debug(f"Small buffer read failed: {e}")
                            
                            # Try different packet sizes to see if device responds
                            logger.debug("Trying different packet sizes...")
                            for test_size in [32, 64, 128]:
                                try:
                                    test_buffer = ffi.new("unsigned char[]", test_size)
                                    test_result = hidapi.hidapi.hid_read_timeout(self.hid_device, test_buffer, test_size, 100)
                                    logger.debug(f"Test read with {test_size}-byte buffer: result={test_result}")
                                    if test_result > 0:
                                        test_data = list(ffi.buffer(test_buffer, test_result))
                                        logger.debug(f"Test buffer got {test_result} bytes: {test_data[:8]}...")
                                        # Update packet size if we found a working size
                                        self.packet_size = test_size
                                        logger.info(f"Found working packet size: {test_size} bytes")
                                        break
                                except Exception as e:
                                    logger.debug(f"Test read with {test_size}-byte buffer failed: {e}")
                            
                            # If still no data, check if electrodes are in contact
                            logger.debug("No data received - checking if electrodes are properly in contact")
                            logger.debug("For EPOC X: Ensure saline-based electrodes are properly hydrated and in contact with scalp")
                            
                            return None
            except Exception as e:
                logger.debug(f"HID read error: {e}")
                import traceback
                logger.debug(f"HID read traceback: {traceback.format_exc()}")
                return None
            
            if not raw_data:
                logger.debug("No raw data received from HID device")
                return None
            
            # Validate data format like emokit
            raw_data = self._validate_data(raw_data)
            if raw_data is None:
                logger.debug(f"Invalid data length: {len(raw_data) if raw_data else 'None'} for {self.device_model}")
                return None
            
            logger.debug(f"Received raw data: {len(raw_data)} bytes - {raw_data[:8]}..." if len(raw_data) > 8 else f"Received raw data: {len(raw_data)} bytes - {raw_data}")
            
            # Decrypt data using crypto module
            if self.crypto:
                decrypted_data = self.crypto.decrypt_packet(bytes(raw_data))
                if decrypted_data:
                    logger.debug(f"Decrypted data: {len(decrypted_data)} bytes - {decrypted_data[:8]}..." if len(decrypted_data) > 8 else f"Decrypted data: {len(decrypted_data)} bytes - {decrypted_data}")
                else:
                    logger.warning("Failed to decrypt packet")
                    return None
            else:
                decrypted_data = bytes(raw_data)
                logger.debug("No crypto module, using raw data")
            
            # Parse sensor data using sensor parser
            if self.sensor_parser and decrypted_data:
                sensor_values = self.sensor_parser.parse_sensor_data(decrypted_data)
                if sensor_values:
                    # Convert sensor values to channel list
                    channels = []
                    for channel in self.sensor_parser.get_available_channels():
                        if channel in sensor_values:
                            channels.append(int(sensor_values[channel] * 1000))  # Convert to integer
                        else:
                            channels.append(0)
                    
                    logger.debug(f"Parsed {len(channels)} channels using sensor parser")
                    return channels
            
            # Fallback to simple parsing if sensor parser fails
            channels = self._parse_packet_fallback(decrypted_data)
            logger.debug(f"Parsed {len(channels)} channels using fallback method")
            return channels
            
        except Exception as e:
            logger.error(f"Error reading packet: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def _parse_packet_fallback(self, decrypted_data: bytes) -> List[int]:
        """Fallback packet parsing method"""
        try:
            # Convert bytes to channel values (16-bit big-endian)
            channels = [int.from_bytes(decrypted_data[i:i+2], 'big') for i in range(0, len(decrypted_data), 2)]
            
            logger.debug(f"Fallback parsed {len(channels)} channels from {len(decrypted_data)} bytes")
            return channels
            
        except Exception as e:
            logger.error(f"Error in fallback packet parsing: {e}")
            return []
    
    def get_device_info(self) -> Optional[Dict[str, Any]]:
        """Get connected device information with enhanced details"""
        if not self.is_initialized:
            return None
        
        try:
            devices = self.scan_devices()
            for device in devices:
                if device['serial_number'] == self.device_serial:
                    # Add crypto and sensor parser info
                    device.update({
                        'crypto_initialized': self.crypto is not None,
                        'sensor_parser_available': self.sensor_parser is not None,
                        'available_sensors': self.sensor_parser.get_available_channels() if self.sensor_parser else [],
                        'connection_type': 'hid'
                    })
                    return device
            
            return {
                'vendor_id': self.vendor_id,
                'product_id': self.product_id,
                'serial_number': self.device_serial,
                'connected': True,
                'crypto_initialized': self.crypto is not None,
                'sensor_parser_available': self.sensor_parser is not None,
                'connection_type': 'hid'
            }
            
        except Exception as e:
            logger.error(f"Error getting device info: {e}")
            return None
    
    def cleanup(self):
        """Cleanup HID resources"""
        try:
            self.disconnect()
            self.sensor_parser = None
            self.device_detector = None
        except Exception as e:
            logger.error(f"Error during HID cleanup: {e}")
    
    def _validate_data(self, data, new_format=None):
        """Validate data format like emokit"""
        if data is None:
            return None
            
        logger.debug(f"Validating data: length={len(data)}, device_model={self.device_model}, new_format={new_format}")
        
        # Determine format based on device model if not specified
        if new_format is None:
            # EPOC X should always use new format (64 bytes)
            if self.device_model == 'EPOC X':
                new_format = True
                logger.debug("EPOC X detected, using new format (64 bytes)")
            else:
                new_format = self.device_model in ['EPOC+', 'EPOC X'] if self.device_model else False
                logger.debug(f"Format detection: new_format={new_format} for device_model={self.device_model}")
            
        if new_format:
            # New format (EPOC+, EPOC X) - 64 bytes
            if len(data) == 64:
                data.insert(0, 0)
                logger.debug("Added padding byte for new format")
            if len(data) != 65:
                logger.debug(f"Invalid new format data length: {len(data)} (expected 65)")
                return None
        else:
            # Old format (EPOC) - 32 bytes
            if len(data) == 32:
                data.insert(0, 0)
                logger.debug("Added padding byte for old format")
            if len(data) != 33:
                logger.debug(f"Invalid old format data length: {len(data)} (expected 33)")
                return None
        
        logger.debug(f"Data validation successful: final length={len(data)}")
        return data
    
    def _try_wake_up_device(self):
        """Try to wake up the device by sending various activation signals"""
        try:
            logger.debug("Attempting to wake up device with activation patterns...")
            ffi = hidapi.ffi
            
            # Try different activation patterns
            wake_patterns = [
                [1, 1, 1, 1, 1, 1, 1, 1],  # All ones
                [0, 1, 0, 1, 0, 1, 0, 1],  # Alternating
                [1, 0, 0, 0, 0, 0, 0, 0],  # Just first bit
                [0, 0, 0, 0, 0, 0, 0, 1],  # Just last bit
                [1, 0, 1, 0, 1, 0, 1, 0],  # Alternating from 1
            ]
            
            for i, pattern in enumerate(wake_patterns):
                try:
                    buffer = ffi.new('unsigned char[]', 8)
                    for j, val in enumerate(pattern):
                        buffer[j] = val
                    result = hidapi.hidapi.hid_send_feature_report(self.hid_device, buffer, 8)
                    logger.debug(f"Wake pattern {i+1} ({pattern}) sent, result: {result}")
                    time.sleep(0.1)  # Small delay between attempts
                except Exception as e:
                    logger.debug(f"Wake pattern {i+1} failed: {e}")
                    
            # Try reading with different buffer sizes to see if device responds
            logger.debug("Testing device response with different buffer sizes...")
            for size in [32, 64, 128]:
                try:
                    buffer = ffi.new('unsigned char[]', size)
                    result = hidapi.hidapi.hid_read_timeout(self.hid_device, buffer, size, 100)
                    logger.debug(f"Test read with {size}-byte buffer: result={result}")
                    if result > 0:
                        logger.debug(f"Device responded with {result} bytes using {size}-byte buffer")
                        break
                except Exception as e:
                    logger.debug(f"Read with {size}-byte buffer failed: {e}")
                    
        except Exception as e:
            logger.debug(f"Wake up attempt failed: {e}")
            import traceback
            logger.debug(f"Wake up traceback: {traceback.format_exc()}")
    
    def is_connected(self) -> bool:
        """Check if device is connected"""
        return self.is_initialized and self.hid_device is not None