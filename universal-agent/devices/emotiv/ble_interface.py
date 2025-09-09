"""
BLE Interface Module for EMOTIV

Handles Bluetooth Low Energy communication for EMOTIV EPOC X devices.
Updated to use modular crypto and sensor parsing based on emokit patterns.
Used as fallback when HID dongle is not available.
"""

import logging
import asyncio
from typing import Optional, List, Dict, Any, Callable
from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice

# Import our new modular components
from .crypto import EmotivCrypto
from .sensors import EmotivSensorParser
from .device_detection import EmotivDeviceDetector

logger = logging.getLogger('device.emotiv.ble')

class EmotivBLEInterface:
    """Handles BLE communication with EMOTIV EPOC X devices using modular components"""
    
    # EMOTIV EPOC X BLE constants
    DEVICE_NAME_PATTERNS = ["EPOC", "EPOC+", "EPOCX", "EMOTIV"]
    VENDOR_ID = 0x1234  # EMOTIV vendor ID
    
    # Generic BLE characteristics (EMOTIV may use custom UUIDs)
    EEG_SERVICE_UUID = "0000fe23-0000-1000-8000-00805f9b34fb"
    EEG_CHARACTERISTIC_UUID = "0000fe24-0000-1000-8000-00805f9b34fb"
    
    # Alternative service UUIDs that EMOTIV might use
    ALTERNATIVE_SERVICES = [
        "beffd56c-c915-48f5-930d-4c1feee0fcc3",  # Common EEG service
        "12345678-1234-1234-1234-123456789abc",  # EMOTIV custom service
    ]
    
    SCAN_TIMEOUT = 15.0
    
    def __init__(self):
        self.client: Optional[BleakClient] = None
        self.device: Optional[BLEDevice] = None
        self.is_connected = False
        self.is_streaming = False
        self.data_callback: Optional[Callable[[bytes], None]] = None
        self.eeg_characteristic_uuid = None
        
        # Initialize modular components
        self.crypto = None
        self.sensor_parser = None
        self.device_detector = None
        self.device_serial = None
        
        # Initialize modular components
        self.sensor_parser = EmotivSensorParser(verbose=True)
        self.device_detector = EmotivDeviceDetector(verbose=True)
        
        logger.info("EMOTIV BLE interface initialized with modular components")
    
    async def scan_devices(self, timeout: float = None) -> List[Dict[str, Any]]:
        """Scan for available EMOTIV BLE devices using enhanced detection"""
        devices = []
        scan_timeout = timeout or self.SCAN_TIMEOUT
        
        try:
            logger.info(f"Scanning for EMOTIV BLE devices (timeout: {scan_timeout}s)...")
            discovered_devices = await BleakScanner.discover(timeout=scan_timeout)
            
            for device in discovered_devices:
                if self._is_emotiv_device(device):
                    # Use device detector to validate and get additional info
                    device_info = {
                        'name': device.name,
                        'address': device.address,
                        'rssi': device.rssi,
                        'metadata': device.metadata,
                        'connection_type': 'bluetooth_le'
                    }
                    
                    # Try to detect device model and features
                    if self.device_detector:
                        device_model = self.device_detector.detect_device_model(device_info)
                        device_features = self.device_detector.get_device_features(device_model) if device_model else []
                        device_info.update({
                            'device_model': device_model,
                            'features': device_features
                        })
                    
                    devices.append(device_info)
                    logger.info(f"Found EMOTIV BLE device: {device.name} ({device.address}) - Model: {device_info.get('device_model', 'Unknown')}")
            
            logger.info(f"Found {len(devices)} EMOTIV BLE devices")
            return devices
            
        except Exception as e:
            logger.error(f"Error scanning for EMOTIV BLE devices: {e}")
            return []
    
    def _is_emotiv_device(self, device: BLEDevice) -> bool:
        """Check if a BLE device is an EMOTIV device using enhanced detection"""
        if not device.name:
            return False
        
        device_name = device.name.upper()
        
        # Check for EMOTIV device name patterns
        for pattern in self.DEVICE_NAME_PATTERNS:
            if pattern.upper() in device_name:
                return True
        
        # Could also check manufacturer data if available
        if hasattr(device, 'metadata') and device.metadata:
            manufacturer_data = device.metadata.get('manufacturer_data', {})
            if self.VENDOR_ID in manufacturer_data:
                return True
        
        # Use device detector for additional validation
        if self.device_detector:
            device_info = {
                'name': device.name,
                'address': device.address,
                'metadata': device.metadata
            }
            return self.device_detector.is_emotiv_device(device_info)
        
        return False
    
    async def connect(self, device_address: str = None) -> bool:
        """Connect to EMOTIV BLE device using enhanced detection and crypto"""
        try:
            if self.is_connected:
                logger.info("Already connected to EMOTIV BLE device")
                return True
            
            # Find device if address not specified
            if not device_address:
                devices = await self.scan_devices()
                if not devices:
                    logger.error("No EMOTIV BLE devices found")
                    return False
                
                # Connect to first found device
                device_address = devices[0]['address']
                device_model = devices[0].get('device_model', 'Unknown')
                logger.info(f"Connecting to first found EMOTIV BLE device: {device_address} (Model: {device_model})")
            
            # Create BLE client
            self.client = BleakClient(device_address)
            
            # Connect to device
            logger.info(f"Connecting to EMOTIV BLE device at {device_address}...")
            await self.client.connect()
            
            # Discover services and characteristics
            if not await self._discover_services():
                logger.error("Failed to discover EMOTIV services")
                await self.disconnect()
                return False
            
            # Try to get device serial for crypto initialization
            try:
                # Try to read device serial from BLE characteristic
                device_serial = await self._get_device_serial()
                if device_serial:
                    self.device_serial = device_serial
                    # Initialize crypto with device serial
                    self.crypto = EmotivCrypto(device_serial, verbose=True)
                    logger.info(f"Initialized crypto for device serial: {device_serial}")
                else:
                    # Use a default serial for BLE devices
                    self.device_serial = "BLE_EMOTIV_DEVICE"
                    logger.info("Using default serial for BLE device")
            except Exception as e:
                logger.warning(f"Could not initialize crypto for BLE device: {e}")
                self.device_serial = "BLE_EMOTIV_DEVICE"
            
            self.is_connected = True
            logger.info(f"Successfully connected to EMOTIV BLE device: {device_address}")
            
            # Get device info
            try:
                device_name = await self.client.read_gatt_char("00002a00-0000-1000-8000-00805f9b34fb")
                logger.info(f"Connected EMOTIV device name: {device_name.decode() if device_name else 'Unknown'}")
            except:
                pass
            
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to EMOTIV BLE device: {e}")
            await self.disconnect()
            return False
    
    async def _get_device_serial(self) -> Optional[str]:
        """Try to get device serial number from BLE characteristics"""
        try:
            # Try common characteristic UUIDs for device serial
            serial_characteristics = [
                "00002a25-0000-1000-8000-00805f9b34fb",  # Serial Number String
                "00002a24-0000-1000-8000-00805f9b34fb",  # Model Number String
            ]
            
            for char_uuid in serial_characteristics:
                try:
                    serial_data = await self.client.read_gatt_char(char_uuid)
                    if serial_data:
                        serial_str = serial_data.decode().strip()
                        if serial_str and len(serial_str) > 4:
                            logger.info(f"Found device serial: {serial_str}")
                            return serial_str
                except:
                    continue
            
            return None
            
        except Exception as e:
            logger.debug(f"Could not read device serial: {e}")
            return None
    
    async def _discover_services(self) -> bool:
        """Discover EMOTIV BLE services and characteristics"""
        try:
            services = await self.client.get_services()
            
            # Look for EEG characteristic in known services
            for service in services:
                logger.debug(f"Found service: {service.uuid}")
                
                for characteristic in service.characteristics:
                    logger.debug(f"  Characteristic: {characteristic.uuid} - {characteristic.properties}")
                    
                    # Look for characteristics that can notify (likely EEG data)
                    if "notify" in characteristic.properties:
                        # This might be our EEG data characteristic
                        self.eeg_characteristic_uuid = characteristic.uuid
                        logger.info(f"Found potential EEG characteristic: {characteristic.uuid}")
                        return True
            
            # If we didn't find a notification characteristic, try known UUIDs
            for char_uuid in [self.EEG_CHARACTERISTIC_UUID] + self.ALTERNATIVE_SERVICES:
                try:
                    char = self.client.services.get_characteristic(char_uuid)
                    if char and "notify" in char.properties:
                        self.eeg_characteristic_uuid = char_uuid
                        logger.info(f"Using known EEG characteristic: {char_uuid}")
                        return True
                except:
                    continue
            
            logger.warning("No suitable EEG characteristic found, will use fallback")
            return False
            
        except Exception as e:
            logger.error(f"Error discovering services: {e}")
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from EMOTIV BLE device"""
        try:
            if self.is_streaming:
                await self.stop_streaming()
            
            if self.client and self.is_connected:
                logger.info("Disconnecting from EMOTIV BLE device...")
                await self.client.disconnect()
                logger.info("Disconnected from EMOTIV BLE device")
            
            self.client = None
            self.device = None
            self.is_connected = False
            self.eeg_characteristic_uuid = None
            self.crypto = None
            self.device_serial = None
            
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting from EMOTIV BLE device: {e}")
            return False
    
    def set_data_callback(self, callback: Callable[[bytes], None]):
        """Set callback function for incoming EEG data"""
        self.data_callback = callback
        logger.info("Data callback set for EMOTIV BLE device")
    
    async def start_streaming(self) -> bool:
        """Start EEG data streaming via BLE"""
        try:
            if not self.is_connected or not self.client:
                logger.error("EMOTIV BLE device not connected")
                return False
            
            if self.is_streaming:
                logger.info("Already streaming EMOTIV BLE data")
                return True
            
            if not self.eeg_characteristic_uuid:
                logger.error("No EEG characteristic available for streaming")
                return False
            
            logger.info("Starting EMOTIV BLE data streaming...")
            
            # Define notification handler
            async def notification_handler(sender, data: bytearray):
                try:
                    # Process data using modular components
                    processed_data = self._process_ble_data(bytes(data))
                    if processed_data and self.data_callback:
                        self.data_callback(processed_data)
                except Exception as e:
                    logger.error(f"Error in EMOTIV BLE notification handler: {e}")
            
            # Start notifications
            await self.client.start_notify(self.eeg_characteristic_uuid, notification_handler)
            
            self.is_streaming = True
            logger.info("EMOTIV BLE data streaming started")
            return True
            
        except Exception as e:
            logger.error(f"Error starting EMOTIV BLE streaming: {e}")
            return False
    
    def _process_ble_data(self, raw_data: bytes) -> Optional[bytes]:
        """Process BLE data using modular components"""
        try:
            if len(raw_data) < 32:  # EMOTIV typically sends 32-byte packets
                logger.warning(f"Insufficient EMOTIV BLE data length: {len(raw_data)} bytes")
                return None
            
            # Try to decrypt data using crypto module
            if self.crypto:
                decrypted_data = self.crypto.decrypt_packet(raw_data)
                if decrypted_data:
                    logger.debug(f"Decrypted BLE data: {len(decrypted_data)} bytes")
                    return decrypted_data
                else:
                    logger.warning("Failed to decrypt BLE packet")
                    return raw_data  # Return raw data as fallback
            else:
                logger.debug("No crypto module, using raw BLE data")
                return raw_data
            
        except Exception as e:
            logger.error(f"Error processing BLE data: {e}")
            return raw_data  # Return raw data as fallback
    
    async def stop_streaming(self) -> bool:
        """Stop EEG data streaming via BLE"""
        try:
            if not self.is_streaming:
                logger.info("EMOTIV BLE not currently streaming")
                return True
            
            if self.client and self.is_connected and self.eeg_characteristic_uuid:
                logger.info("Stopping EMOTIV BLE data streaming...")
                await self.client.stop_notify(self.eeg_characteristic_uuid)
                logger.info("EMOTIV BLE data streaming stopped")
            
            self.is_streaming = False
            return True
            
        except Exception as e:
            logger.error(f"Error stopping EMOTIV BLE streaming: {e}")
            return False
    
    def parse_eeg_data(self, data: bytes) -> Optional[List[int]]:
        """Parse raw EEG data from EMOTIV BLE device using modular components"""
        try:
            if len(data) < 32:  # EMOTIV typically sends 32-byte packets
                logger.warning(f"Insufficient EMOTIV BLE data length: {len(data)} bytes")
                return None
            
            # Try to parse using sensor parser
            if self.sensor_parser:
                sensor_values = self.sensor_parser.parse_sensor_data(data)
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
            channels = []
            for i in range(0, min(len(data), 28), 2):  # 14 channels * 2 bytes
                if i + 1 < len(data):
                    channel_value = int.from_bytes(data[i:i+2], 'big')
                    channels.append(channel_value)
            
            logger.debug(f"Fallback parsed {len(channels)} channels from BLE data")
            return channels
            
        except Exception as e:
            logger.error(f"Error parsing EMOTIV BLE data: {e}")
            return None
    
    async def get_device_info(self) -> Optional[Dict[str, Any]]:
        """Get connected EMOTIV BLE device information with enhanced details"""
        if not self.is_connected or not self.client:
            return None
        
        try:
            device_info = {
                'connected': True,
                'streaming': self.is_streaming,
                'address': self.client.address if self.client else None,
                'connection_type': 'bluetooth_le',
                'crypto_initialized': self.crypto is not None,
                'sensor_parser_available': self.sensor_parser is not None,
                'available_sensors': self.sensor_parser.get_available_channels() if self.sensor_parser else [],
                'device_serial': self.device_serial
            }
            
            # Try to read device name
            try:
                device_name = await self.client.read_gatt_char("00002a00-0000-1000-8000-00805f9b34fb")
                device_info['name'] = device_name.decode() if device_name else 'Unknown'
            except:
                device_info['name'] = 'EMOTIV BLE Device'
            
            # Try to read battery level
            try:
                battery_level = await self.client.read_gatt_char("00002a19-0000-1000-8000-00805f9b34fb")
                device_info['battery_level'] = int.from_bytes(battery_level, byteorder='little') if battery_level else None
            except:
                device_info['battery_level'] = None
            
            # Try to read firmware version
            try:
                firmware = await self.client.read_gatt_char("00002a26-0000-1000-8000-00805f9b34fb")
                device_info['firmware_version'] = firmware.decode() if firmware else None
            except:
                device_info['firmware_version'] = None
            
            return device_info
            
        except Exception as e:
            logger.error(f"Error getting EMOTIV BLE device info: {e}")
            return None
    
    def cleanup(self):
        """Cleanup BLE resources"""
        try:
            # Cleanup will be handled by the async disconnect method
            self.sensor_parser = None
            self.device_detector = None
        except Exception as e:
            logger.error(f"Error during EMOTIV BLE cleanup: {e}")