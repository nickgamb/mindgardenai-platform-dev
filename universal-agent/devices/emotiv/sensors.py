"""
EMOTIV Sensor Mapping Module

Provides bit mappings and data extraction for EMOTIV sensor channels.
Based on emokit patterns for accurate sensor value extraction.
Enhanced with battery detection and quality assessment.
"""

import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger('device.emotiv.sensors')

# Battery level mapping from emokit
BATTERY_VALUES = {
    "255": 100, "254": 100, "253": 100, "252": 100, "251": 100, "250": 100,
    "249": 100, "248": 100, "247": 99, "246": 97, "245": 93, "244": 89,
    "243": 85, "242": 82, "241": 77, "240": 72, "239": 66, "238": 62,
    "237": 55, "236": 46, "235": 32, "234": 20, "233": 12, "232": 6,
    "231": 4, "230": 3, "229": 2, "228": 2, "227": 2, "226": 1,
    "225": 0, "224": 0,
}

EEG_CHANNELS = [
    'F3', 'FC5', 'AF3', 'F7', 'T7', 'P7', 'O1', 'O2', 'P8', 'T8', 'F8', 'AF4', 'FC6', 'F4'
]

MOTION_CHANNELS = ['X', 'Y', 'Z']

# 14-bit sensor mappings (from emokit)
SENSORS_14_BITS = {
    'F3': [10, 11, 12], 'FC6': [13, 14, 15], 'P7': [16, 17, 18], 'T8': [19, 20, 21],
    'F7': [22, 23, 24], 'F8': [25, 26, 27], 'T7': [28, 29, 30], 'P8': [31, 32, 33],
    'AF4': [34, 35, 36], 'F4': [37, 38, 39], 'AF3': [40, 41, 42], 'O2': [43, 44, 45],
    'O1': [46, 47, 48], 'FC5': [49, 50, 51], 'X': [52, 53], 'Y': [54, 55],
    'Z': [56, 57], 'Unknown': [58, 59, 60]
}

# 16-bit sensor mappings (for newer devices)
SENSORS_16_BYTES = {
    'F3': [0, 1], 'FC6': [2, 3], 'P7': [4, 5], 'T8': [6, 7],
    'F7': [8, 9], 'F8': [10, 11], 'T7': [12, 13], 'P8': [14, 15],
    'AF4': [16, 17], 'F4': [18, 19], 'AF3': [20, 21], 'O2': [22, 23],
    'O1': [24, 25], 'FC5': [26, 27], 'X': [28, 29], 'Y': [30, 31],
    'Z': [32, 33], 'Unknown': [34, 35]
}

# Quality bits for sensor contact quality
QUALITY_BITS = [64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79]

# Sensor quality bit mapping
SENSOR_QUALITY_BIT = {
    0: 'F3', 1: 'FC6', 2: 'P7', 3: 'T8', 4: 'F7', 5: 'F8', 6: 'T7', 7: 'P8',
    8: 'AF4', 9: 'F4', 10: 'AF3', 11: 'O2', 12: 'O1', 13: 'FC5', 14: 'X', 15: 'Y'
}

class EmotivSensorParser:
    """Parses EMOTIV sensor data using emokit bit mappings with enhanced features"""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.eeg_channels = EEG_CHANNELS
        self.motion_channels = MOTION_CHANNELS
        self.last_counter = 0
        self.battery_level = None
        
    def parse_sensor_data(self, decrypted_data: bytes) -> Dict[str, float]:
        """Parse sensor data from decrypted packet"""
        try:
            if len(decrypted_data) < 32:
                logger.warning(f"Insufficient data length: {len(decrypted_data)} bytes")
                return {}
            
            # Convert to list of integers
            data = list(decrypted_data)
            
            # Check for battery level in counter
            counter = data[0]
            if counter > 127:
                self.battery_level = BATTERY_VALUES.get(str(counter), 0)
                logger.debug(f"Battery level detected: {self.battery_level}%")
            
            # Determine packet format based on data length
            if len(data) >= 64:
                # New format (16-bit sensors)
                return self._parse_new_format(data)
            else:
                # Old format (14-bit sensors)
                return self._parse_old_format(data)
                
        except Exception as e:
            logger.error(f"Error parsing sensor data: {e}")
            return {}
    
    def _parse_old_format(self, data: List[int]) -> Dict[str, float]:
        """Parse old format packet (14-bit sensors)"""
        sensor_values = {}
        
        # Parse EEG channels using 14-bit mapping
        for channel, bits in SENSORS_14_BITS.items():
            if 'GYRO' not in channel and channel != 'Unknown':
                value = self._get_sensor_level(data, bits)
                sensor_values[channel] = value
        
        # Parse gyroscope data
        if 'X' in SENSORS_14_BITS:
            sensor_values['X'] = self._get_gyro_level(data, SENSORS_14_BITS['X'])
        if 'Y' in SENSORS_14_BITS:
            sensor_values['Y'] = self._get_gyro_level(data, SENSORS_14_BITS['Y'])
        if 'Z' in SENSORS_14_BITS:
            sensor_values['Z'] = self._get_gyro_level(data, SENSORS_14_BITS['Z'])
        
        return sensor_values
    
    def _parse_new_format(self, data: List[int]) -> Dict[str, float]:
        """Parse new format packet (16-bit sensors)"""
        sensor_values = {}
        
        # Parse EEG channels using 16-bit mapping
        for channel, bytes_indices in SENSORS_16_BYTES.items():
            if channel not in ['X', 'Y', 'Z', 'Unknown']:
                if len(bytes_indices) >= 2:
                    whole = data[bytes_indices[1]] / 0.031
                    precision = data[bytes_indices[0]] / 3.1
                    value = whole + precision
                    sensor_values[channel] = value
        
        # Parse motion data
        for channel in ['X', 'Y', 'Z']:
            if channel in SENSORS_16_BYTES:
                bytes_indices = SENSORS_16_BYTES[channel]
                if len(bytes_indices) >= 2:
                    value = self._get_gyro_level(data, bytes_indices)
                    sensor_values[channel] = value
        
        return sensor_values
    
    def _get_sensor_level(self, data: bytes, bits: List[int]) -> float:
        """Extract 14-bit EEG sensor level"""
        try:
            level = 0
            for i, bit in enumerate(bits):
                if bit < len(data):
                    level += (data[bit] << (i * 8))
            
            # Convert to microvolts (approximate conversion)
            level = (level & 0x3FFF) - 8192
            return level * 0.51  # Conversion factor to microvolts
            
        except Exception as e:
            logger.error(f"Error extracting sensor level: {e}")
            return 0.0
    
    def _get_gyro_level(self, data: bytes, bits: List[int]) -> float:
        """Extract 16-bit gyro sensor level"""
        try:
            level = 0
            for i, bit in enumerate(bits):
                if bit < len(data):
                    level += (data[bit] << (i * 8))
            
            # Convert to degrees per second
            level = (level & 0xFFFF) - 32768
            return level * 0.07  # Conversion factor to degrees/s
            
        except Exception as e:
            logger.error(f"Error extracting gyro level: {e}")
            return 0.0
    
    def get_sensor_quality(self, data: bytes) -> Dict[str, int]:
        """Extract sensor quality information"""
        try:
            quality_data = {}
            data_list = list(data)
            
            if len(data_list) < 80:
                return {}
            
            # Extract quality level
            quality_level = 0
            for i, bit in enumerate(QUALITY_BITS):
                if bit < len(data_list):
                    quality_level += (data_list[bit] << i)
            
            # Map quality to sensors
            sensor_bit = data_list[0] if data_list else 0
            if sensor_bit in SENSOR_QUALITY_BIT:
                sensor_name = SENSOR_QUALITY_BIT[sensor_bit]
                quality_data[sensor_name] = quality_level
            else:
                quality_data['Unknown'] = quality_level
            
            return quality_data
            
        except Exception as e:
            logger.error(f"Error extracting sensor quality: {e}")
            return {}
    
    def get_battery_level(self) -> Optional[int]:
        """Get the last detected battery level"""
        return self.battery_level
    
    def get_quality_scale(self, quality_value: int, old_model: bool = False) -> str:
        """Convert quality value to human-readable scale"""
        if old_model:
            if quality_value >= 8192:
                return "Excellent"
            elif quality_value >= 6144:
                return "Good"
            elif quality_value >= 4096:
                return "Fair"
            elif quality_value >= 2048:
                return "Poor"
            else:
                return "Very Poor"
        else:
            if quality_value >= 8192:
                return "Excellent"
            elif quality_value >= 6144:
                return "Good"
            elif quality_value >= 4096:
                return "Fair"
            elif quality_value >= 2048:
                return "Poor"
            else:
                return "Very Poor"
    
    def get_available_channels(self) -> List[str]:
        """Get list of available sensor channels"""
        return self.eeg_channels + self.motion_channels
    
    def is_eeg_channel(self, channel: str) -> bool:
        """Check if channel is an EEG sensor"""
        return channel in self.eeg_channels
    
    def is_motion_channel(self, channel: str) -> bool:
        """Check if channel is a motion sensor"""
        return channel in self.motion_channels
    
    def get_packet_info(self, data: bytes) -> Dict[str, any]:
        """Get comprehensive packet information"""
        try:
            data_list = list(data)
            if not data_list:
                return {}
            
            counter = data_list[0]
            is_sync = counter == 0xe9
            
            return {
                'counter': counter,
                'is_sync': is_sync,
                'battery_level': self.battery_level,
                'packet_size': len(data),
                'format': 'new' if len(data) >= 64 else 'old'
            }
            
        except Exception as e:
            logger.error(f"Error getting packet info: {e}")
            return {} 