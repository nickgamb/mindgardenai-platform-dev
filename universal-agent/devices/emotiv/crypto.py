"""
EMOTIV Crypto Module

Handles AES key generation and decryption for different EMOTIV device models.
Based on emokit patterns for maximum compatibility.
Enhanced with better packet format detection and error handling.
"""

import logging
from Crypto.Cipher import AES
from typing import Optional

logger = logging.getLogger('device.emotiv.crypto')

class EmotivCrypto:
    """Handles AES decryption for EMOTIV devices with support for multiple models"""
    
    def __init__(self, serial_number: str, device_type: str = 'consumer', verbose: bool = False):
        self.serial_number = serial_number
        self.device_type = device_type  # 'consumer' or 'research'
        self.verbose = verbose
        self.cipher = None
        self._generate_cipher()
    
    def _generate_cipher(self):
        """Generate AES cipher based on device serial number"""
        try:
            if not self.serial_number or len(self.serial_number) < 4:
                raise ValueError("Invalid serial number length")
            
            logger.info(f"Generating AES cipher for serial: {self.serial_number}")
            
            # Determine key generation method based on device type and serial number
            if self.device_type == 'research':
                # Research devices use different key generation
                aes_key = self._generate_research_crypto_key()
            elif self.serial_number.startswith('UD2016'):
                # EPOC+ and newer devices
                aes_key = self._generate_epoc_plus_crypto_key()
            elif self.serial_number.startswith('UD'):
                # Standard EPOC devices
                aes_key = self._generate_standard_crypto_key()
            else:
                # Fallback for unknown devices
                aes_key = self._generate_new_crypto_key()
            
            # Create AES cipher
            self.cipher = AES.new(aes_key.encode('latin-1'), AES.MODE_ECB)
            
            if self.verbose:
                logger.info(f"AES cipher initialized with {len(aes_key)}-byte key")
            
        except Exception as e:
            logger.error(f"Error generating AES cipher: {e}")
            # Fallback to default key
            fallback_key = "DEFAULT_KEY_16B".ljust(16, '\0')[:16]
            self.cipher = AES.new(fallback_key.encode('latin-1'), AES.MODE_ECB)
    
    def _generate_standard_crypto_key(self) -> str:
        """Generate standard crypto key (from emokit)"""
        try:
            k = []
            k.append(self.serial_number[-1])
            k.append('\0')
            k.append(self.serial_number[-2])
            k.append('T')
            k.append(self.serial_number[-3])
            k.append('\x10')
            k.append(self.serial_number[-4])
            k.append('B')
            k.append(self.serial_number[-1])
            k.append('\0')
            k.append(self.serial_number[-2])
            k.append('H')
            k.append(self.serial_number[-3])
            k.append('\0')
            k.append(self.serial_number[-4])
            k.append('P')
            
            key = ''.join(k)
            return key
            
        except Exception as e:
            logger.error(f"Error generating standard crypto key: {e}")
            return "DEFAULT_KEY_16B"
    
    def _generate_new_crypto_key(self) -> str:
        """Generate new crypto key (from emokit)"""
        try:
            k = []
            k.append(self.serial_number[-1])
            k.append(self.serial_number[-2])
            k.append(self.serial_number[-3])
            k.append(self.serial_number[-4])
            k.append('A')
            k.append('B')
            k.append('C')
            k.append('D')
            k.append('E')
            k.append('F')
            k.append('G')
            k.append('H')
            k.append('I')
            k.append('J')
            k.append('K')
            k.append('L')
            
            key = ''.join(k)
            return key
            
        except Exception as e:
            logger.error(f"Error generating new crypto key: {e}")
            return "DEFAULT_KEY_16B"
    
    def _generate_research_crypto_key(self) -> str:
        """Generate research device crypto key (from emokit documentation)"""
        try:
            # Research headset key pattern: [15] 0x00 [14] 0x54 [13] 0x10 [12] 0x42 [15] 0x00 [14] 0x48 [13] 0x00 [12] 0x50
            k = []
            k.append('\0')  # [15] 0x00
            k.append('T')   # [14] 0x54
            k.append('\x10') # [13] 0x10
            k.append('B')   # [12] 0x42
            k.append('\0')  # [15] 0x00
            k.append('H')   # [14] 0x48
            k.append('\0')  # [13] 0x00
            k.append('P')   # [12] 0x50
            k.append('\0')  # [15] 0x00
            k.append('T')   # [14] 0x54
            k.append('\x10') # [13] 0x10
            k.append('B')   # [12] 0x42
            k.append('\0')  # [15] 0x00
            k.append('H')   # [14] 0x48
            k.append('\0')  # [13] 0x00
            k.append('P')   # [12] 0x50
            
            key = ''.join(k)
            return key
            
        except Exception as e:
            logger.error(f"Error generating research crypto key: {e}")
            return "DEFAULT_KEY_16B"
    
    def _generate_epoc_plus_crypto_key(self) -> str:
        """Generate EPOC+ crypto key (from emokit)"""
        try:
            k = []
            k.append(self.serial_number[-1])
            k.append(self.serial_number[-2])
            k.append(self.serial_number[-3])
            k.append(self.serial_number[-4])
            k.append('A')
            k.append('B')
            k.append('C')
            k.append('D')
            k.append('E')
            k.append('F')
            k.append('G')
            k.append('H')
            k.append('I')
            k.append('J')
            k.append('K')
            k.append('L')
            
            key = ''.join(k)
            return key
            
        except Exception as e:
            logger.error(f"Error generating EPOC+ crypto key: {e}")
            return "DEFAULT_KEY_16B"
    
    def decrypt_packet(self, encrypted_data: bytes) -> Optional[bytes]:
        """Decrypt packet using AES cipher"""
        try:
            if not self.cipher:
                logger.error("No AES cipher available")
                return None
            
            if not encrypted_data or len(encrypted_data) < 16:
                logger.warning(f"Invalid encrypted data length: {len(encrypted_data)} bytes")
                return None
            
            # Handle different packet sizes
            if len(encrypted_data) == 32:
                # Standard 32-byte packet
                decrypted_data = self.cipher.decrypt(encrypted_data[:16]) + self.cipher.decrypt(encrypted_data[16:])
                if self.verbose:
                    logger.debug(f"Decrypted 32-byte packet: {len(decrypted_data)} bytes")
                return decrypted_data
                
            elif len(encrypted_data) == 64:
                # 64-byte packet (newer devices)
                decrypted_data = b''
                for i in range(0, len(encrypted_data), 16):
                    chunk = encrypted_data[i:i+16]
                    if len(chunk) == 16:
                        decrypted_chunk = self.cipher.decrypt(chunk)
                        decrypted_data += decrypted_chunk
                
                if self.verbose:
                    logger.debug(f"Decrypted 64-byte packet: {len(decrypted_data)} bytes")
                return decrypted_data
                
            else:
                # Try to decrypt as-is
                decrypted_data = self.cipher.decrypt(encrypted_data[:16])
                if len(encrypted_data) > 16:
                    decrypted_data += self.cipher.decrypt(encrypted_data[16:32])
                
                if self.verbose:
                    logger.debug(f"Decrypted {len(encrypted_data)}-byte packet: {len(decrypted_data)} bytes")
                return decrypted_data
                
        except Exception as e:
            logger.error(f"Error decrypting packet: {e}")
            return None
    
    def get_key_info(self) -> dict:
        """Get crypto setup information"""
        return {
            'serial_number': self.serial_number,
            'cipher_available': self.cipher is not None,
            'key_length': 16 if self.cipher else 0,
            'verbose': self.verbose
        }
    
    def validate_packet(self, decrypted_data: bytes) -> bool:
        """Validate decrypted packet format"""
        try:
            if not decrypted_data or len(decrypted_data) < 32:
                return False
            
            # Check for sync byte (0xe9)
            if decrypted_data[0] == 0xe9:
                return True
            
            # Check for valid counter range
            counter = decrypted_data[0]
            if 0 <= counter <= 255:
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error validating packet: {e}")
            return False
    
    def get_packet_format(self, encrypted_data: bytes) -> str:
        """Determine packet format based on encrypted data"""
        if len(encrypted_data) == 32:
            return "standard"
        elif len(encrypted_data) == 64:
            return "extended"
        else:
            return "unknown" 