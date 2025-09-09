"""
BLE Interface Module for IDUN

Handles low-level Bluetooth Low Energy communication for IDUN devices.
"""

import logging
import asyncio
from typing import Optional, List, Dict, Any, Callable
from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice

logger = logging.getLogger('device.idun.ble')

class BLEInterface:
    """Handles BLE communication with IDUN devices"""
    
    # IDUN Guardian constants
    DEVICE_NAME_PREFIX = "IGEB"
    SERVICE_UUID = "beffd56c-c915-48f5-930d-4c1feee0fcc3"
    EEG_CHARACTERISTIC_UUID = "beffd56c-c915-48f5-930d-4c1feee0fcc4"
    SCAN_TIMEOUT = 10.0
    
    def __init__(self):
        self.client: Optional[BleakClient] = None
        self.device: Optional[BLEDevice] = None
        self.is_connected = False
        self.is_streaming = False
        self.data_callback: Optional[Callable[[bytes], None]] = None
        
        logger.info("BLE interface initialized for IDUN devices")
    
    async def scan_devices(self, timeout: float = None) -> List[Dict[str, Any]]:
        """Scan for available IDUN devices"""
        devices = []
        scan_timeout = timeout or self.SCAN_TIMEOUT
        
        try:
            logger.info(f"Scanning for IDUN devices (timeout: {scan_timeout}s)...")
            discovered_devices = await BleakScanner.discover(timeout=scan_timeout)
            
            for device in discovered_devices:
                if device.name and device.name.startswith(self.DEVICE_NAME_PREFIX):
                    devices.append({
                        'name': device.name,
                        'address': device.address,
                        'rssi': device.rssi,
                        'metadata': device.metadata
                    })
                    logger.info(f"Found IDUN device: {device.name} ({device.address})")
            
            logger.info(f"Found {len(devices)} IDUN devices")
            return devices
            
        except Exception as e:
            logger.error(f"Error scanning for devices: {e}")
            return []
    
    async def connect(self, device_address: str = None) -> bool:
        """Connect to IDUN device"""
        try:
            if self.is_connected:
                logger.info("Already connected to IDUN device")
                return True
            
            # Find device if address not specified
            if not device_address:
                devices = await self.scan_devices()
                if not devices:
                    logger.error("No IDUN devices found")
                    return False
                
                # Connect to first found device
                device_address = devices[0]['address']
                logger.info(f"Connecting to first found device: {device_address}")
            
            # Create BLE client
            self.client = BleakClient(device_address)
            
            # Connect to device
            logger.info(f"Connecting to IDUN device at {device_address}...")
            await self.client.connect()
            
            self.is_connected = True
            logger.info(f"Successfully connected to IDUN device: {device_address}")
            
            # Get device info
            device_name = await self.client.read_gatt_char("00002a00-0000-1000-8000-00805f9b34fb")  # Device Name characteristic
            logger.info(f"Connected device name: {device_name.decode() if device_name else 'Unknown'}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to IDUN device: {e}")
            await self.disconnect()
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from IDUN device"""
        try:
            if self.is_streaming:
                await self.stop_streaming()
            
            if self.client and self.is_connected:
                logger.info("Disconnecting from IDUN device...")
                await self.client.disconnect()
                logger.info("Disconnected from IDUN device")
            
            self.client = None
            self.device = None
            self.is_connected = False
            
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting from IDUN device: {e}")
            return False
    
    def set_data_callback(self, callback: Callable[[bytes], None]):
        """Set callback function for incoming EEG data"""
        self.data_callback = callback
        logger.info("Data callback set for IDUN device")
    
    async def start_streaming(self) -> bool:
        """Start EEG data streaming"""
        try:
            if not self.is_connected or not self.client:
                logger.error("Device not connected")
                return False
            
            if self.is_streaming:
                logger.info("Already streaming data")
                return True
            
            logger.info("Starting EEG data streaming...")
            
            # Define notification handler
            async def notification_handler(sender, data: bytearray):
                try:
                    if self.data_callback:
                        self.data_callback(bytes(data))
                except Exception as e:
                    logger.error(f"Error in notification handler: {e}")
            
            # Start notifications
            await self.client.start_notify(self.EEG_CHARACTERISTIC_UUID, notification_handler)
            
            self.is_streaming = True
            logger.info("EEG data streaming started")
            return True
            
        except Exception as e:
            logger.error(f"Error starting streaming: {e}")
            return False
    
    async def stop_streaming(self) -> bool:
        """Stop EEG data streaming"""
        try:
            if not self.is_streaming:
                logger.info("Not currently streaming")
                return True
            
            if self.client and self.is_connected:
                logger.info("Stopping EEG data streaming...")
                await self.client.stop_notify(self.EEG_CHARACTERISTIC_UUID)
                logger.info("EEG data streaming stopped")
            
            self.is_streaming = False
            return True
            
        except Exception as e:
            logger.error(f"Error stopping streaming: {e}")
            return False
    
    def parse_eeg_data(self, data: bytes) -> Optional[List[float]]:
        """Parse raw EEG data from device"""
        try:
            if len(data) < 2:
                logger.warning(f"Insufficient data length: {len(data)} bytes")
                return None
            
            # Parse as 16-bit signed integer (little endian)
            # IDUN typically sends 1 channel of data per packet
            values = []
            for i in range(0, len(data), 2):
                if i + 1 < len(data):
                    raw_value = int.from_bytes(data[i:i+2], byteorder='little', signed=True)
                    # Convert to voltage - this may need calibration based on device specs
                    voltage = raw_value * 0.0001  # Rough conversion factor
                    values.append(voltage)
            
            return values
            
        except Exception as e:
            logger.error(f"Error parsing EEG data: {e}")
            return None
    
    async def get_device_info(self) -> Optional[Dict[str, Any]]:
        """Get connected device information"""
        if not self.is_connected or not self.client:
            return None
        
        try:
            device_info = {
                'connected': True,
                'streaming': self.is_streaming,
                'address': self.client.address if self.client else None
            }
            
            # Try to read device name
            try:
                device_name = await self.client.read_gatt_char("00002a00-0000-1000-8000-00805f9b34fb")
                device_info['name'] = device_name.decode() if device_name else 'Unknown'
            except:
                device_info['name'] = 'Unknown'
            
            # Try to read battery level
            try:
                battery_level = await self.client.read_gatt_char("00002a19-0000-1000-8000-00805f9b34fb")
                device_info['battery_level'] = int.from_bytes(battery_level, byteorder='little') if battery_level else None
            except:
                device_info['battery_level'] = None
            
            return device_info
            
        except Exception as e:
            logger.error(f"Error getting device info: {e}")
            return None
    
    def cleanup(self):
        """Cleanup BLE resources"""
        try:
            # Note: Cleanup will be handled by the async disconnect method
            # This is here for interface compatibility
            pass
        except Exception as e:
            logger.error(f"Error during BLE cleanup: {e}")