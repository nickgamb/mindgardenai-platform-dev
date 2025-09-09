"""
EMOTIV Device Detection Module

Provides enhanced device detection and identification for EMOTIV devices.
Based on emokit patterns for maximum compatibility.
Enhanced with udev rules information.
"""

import logging
import platform
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger('device.emotiv.detection')

# EMOTIV device identifiers from udev rules
EMOTIV_VENDOR_ID = 4660  # 0x1234 in hex
EMOTIV_ALT_VENDOR_ID = 8609  # 0x21a1 in hex (from udev rules)
EMOTIV_PRODUCT_ID = 60674  # 0xED02 in hex

# Device identifiers from udev rules
EMOTIV_MANUFACTURER = "Emotiv Systems Pty Ltd"
EMOTIV_PRODUCT_NAME = "Receiver Dongle L01"
EMOTIV_INTERFACE_NAME = "Emotiv RAW DATA"

DEVICE_MODELS = {
    'EPOC': {
        'serial_prefixes': ['UD'],
        'product_names': ['EPOC', 'Emotiv EPOC'],
        'features': ['14 EEG channels', '2 motion sensors', 'HID interface'],
        'year_range': (2009, 2015),
        'packet_size': 32,  # Old format
        'new_format': False
    },
    'EPOC+': {
        'serial_prefixes': ['UD2015', 'UD2016'],
        'product_names': ['EPOC+', 'Emotiv EPOC+'],
        'features': ['14 EEG channels', '2 motion sensors', 'HID interface', 'Research mode'],
        'year_range': (2015, 2018),
        'packet_size': 64,  # New format
        'new_format': True
    },
    'EPOC X': {
        'serial_prefixes': ['UD2018', 'UD2019', 'UD2020', 'UD2021', 'UD2022', 'UD2023'],
        'product_names': ['EPOC X', 'Emotiv EPOC X'],
        'features': ['14 EEG channels', '2 motion sensors', 'HID interface', 'USB interface', 'BLE interface'],
        'year_range': (2018, 2030),
        'packet_size': 64,  # New format
        'new_format': True
    }
}

class EmotivDeviceDetector:
    """Enhanced device detection for EMOTIV devices"""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.platform = platform.system()
    
    def is_emotiv_device(self, device_info: Dict) -> bool:
        """Check if device is an EMOTIV device using multiple criteria"""
        try:
            # Check vendor ID (both standard and alternative)
            vendor_id = device_info.get('vendor_id', 0)
            if vendor_id not in [EMOTIV_VENDOR_ID, EMOTIV_ALT_VENDOR_ID]:
                return False
            
            # If we have the right vendor ID, check additional criteria
            # But be more lenient - if vendor ID matches, it's likely EMOTIV
            
            # Check manufacturer string
            manufacturer = device_info.get('manufacturer_string', '').lower()
            if EMOTIV_MANUFACTURER.lower() in manufacturer:
                return True
            
            # Check product string
            product_string = device_info.get('product_string', '').lower()
            if any(name.lower() in product_string for name in ['epoc', 'emotiv']):
                return True
            
            # Check interface name (from udev rules)
            interface = device_info.get('interface_string', '').lower()
            if EMOTIV_INTERFACE_NAME.lower() in interface:
                return True
            
            # Check serial number pattern
            serial_number = device_info.get('serial_number', '')
            if serial_number and serial_number.startswith('UD'):
                return True
            
            # Additional checks for BLE devices
            if 'name' in device_info:
                device_name = device_info['name'].lower()
                if any(pattern.lower() in device_name for pattern in ['epoc', 'emotiv']):
                    return True
            
            # If we have the right vendor ID but none of the above match,
            # still consider it EMOTIV (vendor ID is the primary indicator)
            if vendor_id == EMOTIV_VENDOR_ID:
                logger.debug(f"Recognizing device as EMOTIV based on vendor ID: {vendor_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking if device is EMOTIV: {e}")
            return False
    
    def detect_device_model(self, device_info: Dict) -> Optional[str]:
        """Detect EMOTIV device model based on device information"""
        try:
            serial_number = device_info.get('serial_number', '')
            product_string = device_info.get('product_string', '')
            manufacturer = device_info.get('manufacturer_string', '')
            
            # First, check by year from serial (most accurate for newer devices)
            if serial_number and len(serial_number) >= 8:
                try:
                    # Extract year from serial number (format: UDYYYYMMDD...)
                    year_str = serial_number[2:6]
                    year = int(year_str)
                    
                    for model, info in DEVICE_MODELS.items():
                        min_year, max_year = info['year_range']
                        if min_year <= year <= max_year:
                            if self.verbose:
                                logger.info(f"Detected {model} by year {year} from serial")
                            return model
                except (ValueError, IndexError):
                    pass
            
            # Check by product name
            if product_string:
                product_lower = product_string.lower()
                for model, info in DEVICE_MODELS.items():
                    for name in info['product_names']:
                        if name.lower() in product_lower:
                            if self.verbose:
                                logger.info(f"Detected {model} by product name: {name}")
                            return model
            
            # Check by serial number prefix (fallback for older devices)
            if serial_number:
                for model, info in DEVICE_MODELS.items():
                    for prefix in info['serial_prefixes']:
                        if serial_number.startswith(prefix):
                            if self.verbose:
                                logger.info(f"Detected {model} by serial prefix: {prefix}")
                            return model
            
            # Fallback: try to determine from available features
            if 'connection_type' in device_info:
                if device_info['connection_type'] == 'bluetooth_le':
                    return 'EPOC X'  # Most likely to have BLE
                elif device_info['connection_type'] == 'usb':
                    return 'EPOC X'  # USB is newer feature
            
            return None
            
        except Exception as e:
            logger.error(f"Error detecting device model: {e}")
            return None
    
    def get_device_features(self, model: str) -> List[str]:
        """Get features for a specific device model"""
        if model in DEVICE_MODELS:
            return DEVICE_MODELS[model]['features']
        return []
    
    def get_device_packet_size(self, model: str) -> int:
        """Get packet size for a specific device model"""
        if model in DEVICE_MODELS:
            return DEVICE_MODELS[model]['packet_size']
        return 64  # Default to new format
    
    def get_device_format(self, model: str) -> bool:
        """Get format type for a specific device model (True = new format, False = old format)"""
        if model in DEVICE_MODELS:
            return DEVICE_MODELS[model]['new_format']
        return True  # Default to new format
    
    def validate_device_info(self, device_info: Dict) -> bool:
        """Validate device information completeness"""
        required_fields = ['vendor_id', 'product_id']
        optional_fields = ['serial_number', 'manufacturer_string', 'product_string']
        
        # Check required fields
        for field in required_fields:
            if field not in device_info:
                logger.warning(f"Missing required field: {field}")
                return False
        
        # Check if we have at least one optional field
        has_optional = any(field in device_info for field in optional_fields)
        if not has_optional:
            logger.warning("No optional identification fields found")
            return False
        
        return True
    
    def get_device_summary(self, device_info: Dict) -> Dict:
        """Get comprehensive device summary"""
        try:
            model = self.detect_device_model(device_info)
            features = self.get_device_features(model) if model else []
            
            summary = {
                'vendor_id': device_info.get('vendor_id'),
                'product_id': device_info.get('product_id'),
                'serial_number': device_info.get('serial_number'),
                'manufacturer': device_info.get('manufacturer_string'),
                'product': device_info.get('product_string'),
                'interface': device_info.get('interface_string'),
                'model': model,
                'features': features,
                'connection_type': device_info.get('connection_type', 'unknown'),
                'is_valid': self.validate_device_info(device_info),
                'is_emotiv': self.is_emotiv_device(device_info)
            }
            
            # Add platform-specific info
            if self.platform == 'Linux':
                summary['udev_path'] = '/dev/eeg/encrypted'
                summary['raw_path'] = '/dev/eeg/raw'
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting device summary: {e}")
            return {}
    
    def get_udev_rules_info(self) -> Dict:
        """Get information about udev rules for Linux"""
        return {
            'vendor_id_hex': f"0x{EMOTIV_VENDOR_ID:04x}",
            'alt_vendor_id_hex': f"0x{EMOTIV_ALT_VENDOR_ID:04x}",
            'manufacturer': EMOTIV_MANUFACTURER,
            'product_name': EMOTIV_PRODUCT_NAME,
            'interface_name': EMOTIV_INTERFACE_NAME,
            'encrypted_path': '/dev/eeg/encrypted',
            'raw_path': '/dev/eeg/raw',
            'permissions': '0444'
        } 