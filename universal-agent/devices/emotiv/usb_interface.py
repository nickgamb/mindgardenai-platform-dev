"""
USB Interface Module for EMOTIV

Handles direct USB communication and AES decryption for EMOTIV devices using pyusb.
"""

import logging
import time
import usb.core
from typing import Optional, List, Tuple, Dict, Any

from .crypto import EmotivCrypto

logger = logging.getLogger('device.emotiv.usb')

class USBInterface:
    """Handles direct USB communication with EMOTIV devices"""
    
    # EMOTIV constants
    EMOTIV_VENDOR_ID = 4660
    EMOTIV_PRODUCT_ID = 60674  # 0xed02
    MODEL = 6  # EPOC X
    PACKET_SIZE = 32
    
    def __init__(self, vendor_id: int = None, product_id: int = None):
        self.vendor_id = vendor_id or self.EMOTIV_VENDOR_ID
        self.product_id = product_id or self.EMOTIV_PRODUCT_ID
        
        self.usb_device = None
        self.crypto = None
        self.device_serial = None
        self.is_initialized = False
        self.ep_in = None
        
        logger.info(f"USB interface initialized for vendor {self.vendor_id}, product {self.product_id}")
    
    def scan_devices(self) -> List[Dict[str, Any]]:
        """Scan for available EMOTIV devices"""
        devices = []
        try:
            logger.info(f"Scanning for USB devices with vendor_id={self.vendor_id}, product_id={self.product_id}")
            
            # Find all devices with matching vendor/product
            found_devices = list(usb.core.find(find_all=True, idVendor=self.vendor_id, idProduct=self.product_id))
            logger.info(f"Found {len(found_devices)} USB devices with matching vendor/product")
            
            for device in found_devices:
                logger.debug(f"Processing USB device: {device}")
                device_info = self._get_device_info(device)
                if device_info:
                    logger.info(f"Found EMOTIV USB device: {device_info['serial_number']}")
                    devices.append(device_info)
                else:
                    logger.debug(f"Could not get info for USB device: {device}")
            
            logger.info(f"Found {len(devices)} EMOTIV USB devices")
            return devices
            
        except Exception as e:
            logger.error(f"Error scanning for USB devices: {e}")
            return []
    
    def connect(self, serial_number: str = None) -> bool:
        """Connect to EMOTIV device via direct USB access"""
        try:
            if self.is_initialized:
                return True
            
            logger.info("Scanning for EMOTIV devices...")
            
            # Find EMOTIV device
            target_device = None
            for device in usb.core.find(find_all=True, idVendor=self.vendor_id, idProduct=self.product_id):
                device_info = self._get_device_info(device)
                if device_info:
                    logger.debug(f"Found USB device: {device_info['serial_number']}")
                    
                    # Only accept exact serial match or no serial specified
                    # Also accept any EMOTIV device if the requested serial is a fallback (starts with EMOTIV_)
                    if (serial_number is None or 
                        device_info['serial_number'] == serial_number or
                        (serial_number and serial_number.startswith('EMOTIV_'))):
                        target_device = device
                        logger.info(f"Found EMOTIV device: {device_info['serial_number']}")
                        break
                    else:
                        logger.debug(f"Serial number doesn't match: expected={serial_number}, got={device_info['serial_number']}")
            
            if not target_device:
                logger.error(f"No EMOTIV device found (looking for vendor_id: {self.vendor_id}, product_id: {self.product_id})")
                return False
            
            # Get device info
            device_info = self._get_device_info(target_device)
            if not device_info:
                logger.error("Could not get device information")
                return False
            
            logger.info(f"Found EMOTIV device: {device_info['serial_number']}")
            
            # Use the serial number from device info
            device_serial = device_info['serial_number']
            logger.info(f"Using device serial: {device_serial}")
            
            # Configure device
            target_device.set_configuration()
            logger.info("Device configured")
            
            # Find the EEG data interface (interface 1)
            self.usb_device = target_device
            self.device_serial = device_serial
            
            # Get interface 1 (EEG Signals)
            interface = target_device.get_active_configuration()[(1, 0)]
            logger.info(f"Interface 1: {interface}")
            
            # Get the IN endpoint for reading data
            self.ep_in = usb.util.find_descriptor(
                interface,
                custom_match=lambda e: 
                    usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_IN
            )
            
            if not self.ep_in:
                logger.error("Could not find IN endpoint")
                return False
            
            logger.info(f"Using endpoint: {self.ep_in.bEndpointAddress}")
            
            # Try to detach the HID driver from interface 1 (EEG Signals)
            try:
                if target_device.is_kernel_driver_active(1):
                    target_device.detach_kernel_driver(1)
                    logger.info("Detached kernel driver from interface 1")
            except Exception as e:
                logger.warning(f"Could not detach kernel driver: {e}")
            
            # Initialize crypto with actual device serial
            self.crypto = EmotivCrypto(device_serial, verbose=True)
            self.device_serial = device_serial
            
            # Try to activate the device or check if it's ready to send data
            try:
                # Some EMOTIV devices need a control transfer to activate streaming
                # This is a common pattern for HID devices
                logger.info("Attempting to activate device for data streaming...")
                
                # Try a control transfer to interface 1 (EEG Signals)
                # This might activate the device or put it in streaming mode
                try:
                    # Set interface to alternate setting 0 (default)
                    self.usb_device.set_interface_altsetting(1, 0)
                    logger.info("Set interface 1 to alternate setting 0")
                except Exception as e:
                    logger.warning(f"Could not set interface alternate setting: {e}")
                
                # Try to send a control transfer to activate streaming
                try:
                    # Some devices need a specific control transfer to start streaming
                    # This is device-specific and may vary
                    result = self.usb_device.ctrl_transfer(
                        0x21,  # REQUEST_TYPE_CLASS | RECIPIENT_INTERFACE | ENDPOINT_OUT
                        0x09,  # SET_REPORT
                        0x0100,  # Report ID 1, Report Type Output
                        1,  # Interface 1
                        b'\x00' * 8  # 8 bytes of zeros (common activation pattern)
                    )
                    logger.info(f"Control transfer result: {result}")
                except Exception as e:
                    logger.debug(f"Control transfer failed (this may be normal): {e}")
                
            except Exception as e:
                logger.warning(f"Could not activate device: {e}")
            
            logger.info("Crypto module initialized successfully")
            
            self.is_initialized = True
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to EMOTIV device: {e}")
            self.cleanup()
            return False
    
    def disconnect(self) -> bool:
        """Disconnect from EMOTIV device"""
        try:
            if self.usb_device:
                # pyusb devices don't have a close() method, just set to None
                self.usb_device = None
            
            self.is_initialized = False
            self.ep_in = None
            self.crypto = None
            
            logger.info("Disconnected from EMOTIV device")
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting: {e}")
            return False
    
    def read_packet(self, timeout: int = 100) -> Optional[List[int]]:
        """Read and decrypt a data packet from EMOTIV device"""
        if not self.is_initialized or not self.usb_device:
            logger.error("Device not initialized")
            return None
        
        try:
            logger.debug(f"Attempting to read {self.PACKET_SIZE} bytes from USB device...")
            
            # Try to read data with timeout
            try:
                raw_data = self.usb_device.read(self.ep_in.bEndpointAddress, self.PACKET_SIZE, timeout=timeout)
                logger.debug(f"USB read operation completed, got {len(raw_data) if raw_data else 0} bytes")
            except usb.core.USBError as e:
                if e.args == ('Operation timed out',):
                    logger.debug("USB read timeout - no data available (this is normal if headset is not actively sending data)")
                    return None
                else:
                    logger.error(f"USB error reading packet: {e}")
                    return None
            
            if not raw_data:
                logger.debug("No raw data received from USB device")
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
                logger.warning("No crypto module available")
                return None
            
            # Convert to channel data
            channels = self._parse_packet(decrypted_data)
            logger.debug(f"Parsed {len(channels)} channels: {channels[:4]}..." if len(channels) > 4 else f"Parsed {len(channels)} channels: {channels}")
            return channels
            
        except Exception as e:
            logger.error(f"Error reading packet: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def check_device_status(self) -> Dict[str, Any]:
        """Check if device is ready to send data"""
        status = {
            'connected': self.is_initialized,
            'endpoint': self.ep_in.bEndpointAddress if self.ep_in else None,
            'serial': self.device_serial,
            'crypto_initialized': self.crypto is not None,
            'device_active': False,
            'data_available': False
        }
        
        if self.is_initialized and self.usb_device:
            try:
                # Check if device is still connected
                try:
                    # Try to get device descriptor to check if still connected
                    self.usb_device.get_device_descriptor()
                    status['device_connected'] = True
                except Exception as e:
                    status['device_connected'] = False
                    status['connection_error'] = str(e)
                    return status
                
                # Try a very short read to see if data is available
                try:
                    raw_data = self.usb_device.read(self.ep_in.bEndpointAddress, self.PACKET_SIZE, timeout=10)
                    status['data_available'] = len(raw_data) > 0
                    status['data_size'] = len(raw_data) if raw_data else 0
                    status['device_active'] = True
                except usb.core.USBError as e:
                    if e.args == ('Operation timed out',):
                        status['data_available'] = False
                        status['timeout'] = True
                        status['device_active'] = False
                    else:
                        status['error'] = str(e)
                except Exception as e:
                    status['error'] = str(e)
                
                # Try to activate device if not active
                if not status['device_active']:
                    logger.debug("Device not active, attempting to activate...")
                    try:
                        # Try control transfer to activate
                        result = self.usb_device.ctrl_transfer(
                            0x21,  # REQUEST_TYPE_CLASS | RECIPIENT_INTERFACE | ENDPOINT_OUT
                            0x09,  # SET_REPORT
                            0x0100,  # Report ID 1, Report Type Output
                            1,  # Interface 1
                            b'\x01' * 8  # 8 bytes of ones (activation pattern)
                        )
                        status['activation_attempted'] = True
                        status['activation_result'] = result
                    except Exception as e:
                        status['activation_error'] = str(e)
                
            except Exception as e:
                status['error'] = str(e)
        
        return status
    
    def _parse_packet(self, decrypted_data: bytes) -> List[int]:
        """Parse decrypted packet into channel data"""
        try:
            # Convert bytes to channel values (16-bit big-endian)
            channels = [int.from_bytes(decrypted_data[i:i+2], 'big') for i in range(0, len(decrypted_data), 2)]
            
            logger.debug(f"Parsed {len(channels)} channels from {len(decrypted_data)} bytes")
            return channels
            
        except Exception as e:
            logger.error(f"Error parsing packet: {e}")
            return []
    
    def get_device_info(self) -> Optional[Dict[str, Any]]:
        """Get device information"""
        if not self.is_initialized:
            return None
        
        return {
            'vendor_id': self.vendor_id,
            'product_id': self.product_id,
            'serial_number': self.device_serial,
            'manufacturer': 'Emotiv',
            'product': 'Brain Computer Interface USB Receiver/Dongle',
            'interface': 'USB Direct'
        }
    
    def cleanup(self):
        """Clean up resources"""
        self.disconnect()
    
    def is_connected(self) -> bool:
        """Check if device is connected"""
        return self.is_initialized and self.usb_device is not None 

    def _get_device_info(self, device) -> Optional[Dict[str, Any]]:
        """Get device information from USB device"""
        try:
            # Get device descriptor using correct pyusb API
            device_desc = None
            try:
                # Try the correct pyusb method
                device_desc = device.get_device_descriptor()
            except AttributeError:
                # Try alternative method
                try:
                    device_desc = usb.util.get_device_descriptor(device)
                except:
                    logger.debug("Device doesn't have get_device_descriptor method, using fallback")
            
            # Get string descriptors
            manufacturer = ""
            product = ""
            serial_number = ""
            
            # Try to get serial from device string first (this works reliably)
            try:
                device_str = str(device)
                logger.debug(f"Device string: {device_str}")
                
                # Look for the serial number pattern in the device string
                if 'iSerialNumber' in device_str:
                    import re
                    # Match the exact format: "iSerialNumber : 0x3 UD202311230073B5"
                    serial_match = re.search(r'iSerialNumber\s*:\s*0x[0-9a-fA-F]+\s+([A-Z0-9]+)', device_str)
                    if serial_match:
                        serial_number = serial_match.group(1)
                        logger.debug(f"Extracted serial number from descriptor: {serial_number}")
                    else:
                        # Try a simpler pattern
                        simple_match = re.search(r'iSerialNumber\s*:\s*([A-Z0-9]+)', device_str)
                        if simple_match:
                            serial_number = simple_match.group(1)
                            logger.debug(f"Extracted serial number with simple pattern: {serial_number}")
                else:
                    logger.debug("No 'iSerialNumber' found in device string")
            except Exception as e:
                logger.debug(f"Could not extract serial from device string: {e}")
            
            # If we still don't have a serial number and device_desc is available, try USB string descriptors
            if not serial_number and device_desc:
                try:
                    if device_desc.iManufacturer:
                        manufacturer = usb.util.get_string(device, device_desc.iManufacturer)
                except:
                    pass
                    
                try:
                    if device_desc.iProduct:
                        product = usb.util.get_string(device, device_desc.iProduct)
                except:
                    pass
                    
                try:
                    if device_desc.iSerialNumber:
                        serial_number = usb.util.get_string(device, device_desc.iSerialNumber)
                        logger.debug(f"Extracted serial number from USB device: {serial_number}")
                    else:
                        logger.debug("No serial number descriptor found in USB device")
                except Exception as e:
                    logger.debug(f"Could not read serial number from USB device: {e}")
                
                # If we still don't have a serial number, try alternative methods
                if not serial_number:
                    try:
                        # Try to get serial number from device attributes
                        if hasattr(device, 'serial_number'):
                            serial_number = device.serial_number
                            logger.debug(f"Got serial number from device attribute: {serial_number}")
                    except:
                        pass
            
            # If still no serial, return None - no fallback generation
            if not serial_number:
                logger.error("Could not extract serial number from device - device may not be properly connected or recognized")
                return None
            
            # Get vendor/product from device_desc or device attributes
            vendor_id = device_desc.idVendor if device_desc else (device.idVendor if hasattr(device, 'idVendor') else 0)
            product_id = device_desc.idProduct if device_desc else (device.idProduct if hasattr(device, 'idProduct') else 0)
            
            return {
                'vendor_id': vendor_id,
                'product_id': product_id,
                'manufacturer_string': manufacturer,
                'product_string': product,
                'serial_number': serial_number,
                'device': device
            }
            
        except Exception as e:
            logger.error(f"Error getting device info: {e}")
            return None 