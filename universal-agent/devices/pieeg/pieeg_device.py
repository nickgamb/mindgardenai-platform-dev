"""
PiEEG Device Implementation

Implements PiEEG device support using SPI/GPIO interface with ADS1299.
Supports both 8 and 16 channel configurations.
"""

import logging
import time
import numpy as np
from typing import Dict, List, Optional, Any
from devices.base_device import BaseDevice, EEGSample, DeviceConnectionError, DeviceStreamingError

logger = logging.getLogger('device.pieeg')

class PiEEGDevice(BaseDevice):
    """PiEEG device implementation with SPI/GPIO interface"""
    
    # Gain settings for ADS1299
    GAIN_SETTINGS = {
        1: 0x10,   # Gain = 1
        2: 0x20,   # Gain = 2  
        4: 0x30,   # Gain = 4
        6: 0x00,   # Gain = 6 (default)
        8: 0x40,   # Gain = 8
        12: 0x50,  # Gain = 12
        24: 0x60   # Gain = 24
    }
    
    def __init__(self, device_id: str, config: Dict[str, Any]):
        super().__init__(device_id, config)
        
        # PiEEG specific configuration
        self.num_channels = config.get('channels', 8)
        self.gain = config.get('gain', 6)
        self.spi_bus = config.get('spi_bus', 0)
        self.spi_device = config.get('spi_device', 0)
        self.gpio_pin = config.get('gpio_pin', 37)
        
        # Validate configuration
        if self.num_channels not in [8, 16]:
            raise ValueError("PiEEG supports only 8 or 16 channels")
        
        if self.gain not in self.GAIN_SETTINGS:
            raise ValueError(f"Unsupported gain: {self.gain}. Supported: {list(self.GAIN_SETTINGS.keys())}")
        
        # Interface will be created lazily at stream time (polling GPIO/SPI)
        self._gpio_interface = None
        
        # Channel configuration
        self.channel_names = [f"CH{i+1}" for i in range(self.num_channels)]
        self.channels = self.channel_names
        
        # Calibration and processing
        self.calibration_values = [0.0] * self.num_channels
        self.is_calibrated = False
        
        # Data processing settings
        self.ref_enabled = config.get('ref_enabled', True)
        self.biasout_enabled = config.get('biasout_enabled', True)
        self.baseline_correction = config.get('baseline_correction', False)
        self.enable_filters = config.get('enable_filters', False)
        self.filter_band = config.get('filter_band', [1.0, 40.0])  # [low, high] Hz
        self.notch_hz = config.get('notch_hz', 60.0)
        
        # Conversion factors
        self.vref = 2.4  # Reference voltage
        self.adc_resolution = 0x800000  # 24-bit ADC
        
        logger.info(f"PiEEG device initialized: {self.num_channels} channels, gain {self.gain}")
    
    def connect(self) -> bool:
        """Connect to PiEEG device - pieeg_read module handles everything"""
        try:
            if self.is_connected:
                return True
            
            logger.info(f"Connecting to PiEEG device {self.device_id}")
            
            # pieeg_read module is already initialized on import
            self.is_connected = True
            logger.info(f"PiEEG device {self.device_id} connected successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to PiEEG device {self.device_id}: {e}")
            self.cleanup()
            return False
    
    def disconnect(self) -> bool:
        """Disconnect from PiEEG device"""
        try:
            if not self.is_connected:
                return True
            
            logger.info(f"Disconnecting PiEEG device {self.device_id}")
            
            # Stop streaming if active
            if self.is_streaming:
                self.stop_streaming()
            
            # Cleanup using subprocess wrapper (preferred to avoid threading issues)
            try:
                from . import pieeg_subprocess  # Local import
                pieeg_subprocess.cleanup()
            except Exception as import_err:
                logger.debug(f"pieeg_subprocess cleanup import error (safe to ignore if never started): {import_err}")
            
            self.is_connected = False
            logger.info(f"PiEEG device {self.device_id} disconnected successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting PiEEG device {self.device_id}: {e}")
            return False
    
    def start_streaming(self) -> bool:
        """Start streaming EEG data from PiEEG using pieeg_read module directly"""
        try:
            if self.is_streaming:
                return True
            
            if not self.is_connected:
                raise DeviceStreamingError("Device not connected")
            
            logger.info(f"Starting streaming for PiEEG device {self.device_id}")
            
            # Initialize polling GPIO/SPI interface lazily
            if self._gpio_interface is None:
                from .gpio_interface import GPIOInterface  # Local import
                self._gpio_interface = GPIOInterface(
                    spi_bus=self.spi_bus,
                    spi_device=self.spi_device,
                    board_pin=self.gpio_pin if self.gpio_pin else 37,
                    gain=self.gain,
                )

            if not self._gpio_interface.initialize():
                raise DeviceStreamingError("Failed to initialize GPIO/SPI interface")

            # Start background streaming thread using BaseDevice helpers
            # Reset simple filter state to avoid stale baseline on re-start
            if hasattr(self, '_filt_state'):
                try:
                    self._filt_state = {
                        'hp': [0.0] * self.num_channels,
                        'lp': [0.0] * self.num_channels,
                    }
                except Exception:
                    pass
            if hasattr(self, '_prev_x'):
                try:
                    self._prev_x = [0.0] * self.num_channels
                except Exception:
                    pass
            self.is_streaming = True
            logger.info(f"Streaming started for PiEEG device {self.device_id} (polling)")
            self._start_stream_thread()
            return True
            
        except Exception as e:
            logger.error(f"Error starting streaming for PiEEG device {self.device_id}: {e}")
            return False
    
    def _stream_worker(self):
        """Override streaming worker for PiEEG - no artificial rate limiting"""
        logger.info(f"Starting PiEEG stream worker for device {self.device_id}")
        self.start_time = time.time()
        
        try:
            while not self.stop_event.is_set() and self.is_streaming:
                try:
                    # Read sample from device (this will wait for DRDY signal)
                    sample = self._read_sample()
                    
                    if sample and self.data_callback:
                        logger.debug(f"Calling data callback for device {self.device_id} with sample")
                        self.data_callback(sample)
                        self.samples_sent += 1
                        logger.debug(f"Sample sent successfully. Total samples: {self.samples_sent}")
                    elif not sample:
                        logger.debug(f"No sample received from device {self.device_id}")
                    elif not self.data_callback:
                        logger.debug(f"No data callback set for device {self.device_id}")
                    
                    # No artificial rate limiting - let the device control the rate
                    # GPIO.wait_for_edge() already handles the timing
                        
                except Exception as e:
                    self.errors_count += 1
                    logger.error(f"Error in PiEEG stream worker for {self.device_id}: {e}")
                    
                    if self.error_callback:
                        self.error_callback(e)
                    
                    # Don't exit on single errors, but pause briefly
                    time.sleep(0.1)
                    
        except Exception as e:
            logger.error(f"Fatal error in PiEEG stream worker for {self.device_id}: {e}")
            if self.error_callback:
                self.error_callback(e)
        finally:
            logger.info(f"PiEEG stream worker stopped for device {self.device_id}")
    
    def stop_streaming(self) -> bool:
        """Stop streaming EEG data from PiEEG using pieeg_read module directly"""
        try:
            if not self.is_streaming:
                return True
            
            logger.info(f"Stopping streaming for PiEEG device {self.device_id}")
            
            # Stop the streaming thread and hardware
            self.is_streaming = False
            self._stop_stream_thread()
            try:
                if self._gpio_interface:
                    self._gpio_interface.stop()
            finally:
                logger.info(f"Streaming stopped for PiEEG device {self.device_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping streaming for PiEEG device {self.device_id}: {e}")
            return False
    
    def calibrate(self) -> bool:
        """Perform device calibration"""
        try:
            if not self.is_connected:
                logger.error("Device not connected for calibration")
                return False
            
            logger.info(f"Starting calibration for PiEEG device {self.device_id}")
            
            # Collect calibration data
            calibration_duration = 5.0  # seconds
            calibration_data = [[] for _ in range(self.num_channels)]
            
            start_time = time.time()
            samples_collected = 0
            
            while time.time() - start_time < calibration_duration:
                # Read a sample
                sample = self._read_sample()
                if sample and len(sample.data) >= self.num_channels:
                    for i in range(self.num_channels):
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
        return {
            'device_id': self.device_id,
            'device_model': self.device_model,
            'device_type': 'pieeg',
            'num_channels': self.num_channels,
            'channel_names': self.channel_names,
            'sample_rate': self.sample_rate,
            'gain': self.gain,
            'resolution': '24-bit',
            'connection_type': 'SPI/GPIO',
            'is_calibrated': self.is_calibrated,
            'calibration_values': self.calibration_values,
            'supported_gains': list(self.GAIN_SETTINGS.keys()),
            'spi_bus': self.spi_bus,
            'spi_device': self.spi_device,
            'gpio_pin': self.gpio_pin
        }
    
    def _read_sample(self) -> Optional[EEGSample]:
        """Read a single EEG sample from PiEEG using pieeg_read module"""
        try:
            if not self._gpio_interface:
                return None
            sample_data = self._gpio_interface.read_one_sample(timeout_seconds=1.0)
            if not sample_data:
                return None

            # Optional console sample print (commented out by default)
            # print(f"Sample {self.samples_sent + 1}: {sample_data}")

            # Optional simple filtering (bandpass + notch) if enabled
            if self.enable_filters:
                try:
                    # Use gently tuned one-pole HP/LP (alpha = dt/(RC+dt)) for minimal distortion
                    low_hz, high_hz = float(self.filter_band[0]), float(self.filter_band[1])
                    fs = float(self.sample_rate)
                    dt = 1.0 / max(fs, 1.0)
                    # RC from cutoff fc: RC = 1/(2*pi*fc)
                    import math
                    def one_pole_alpha(fc: float) -> float:
                        if fc <= 0.0:
                            return 0.0
                        rc = 1.0 / (2.0 * math.pi * fc)
                        a = dt / (rc + dt)
                        return max(0.0, min(a, 0.2))  # cap for gentler response

                    a_hp = one_pole_alpha(max(low_hz, 0.1))
                    a_lp = one_pole_alpha(max(high_hz, 1.0))
                    if not hasattr(self, '_filt_state'):
                        self._filt_state = {
                            'hp': [0.0] * self.num_channels,
                            'lp': [0.0] * self.num_channels,
                        }
                    filtered = []
                    prev_x = getattr(self, '_prev_x', [0.0]*self.num_channels)
                    for i in range(self.num_channels):
                        x = float(sample_data[i])
                        # High-pass via leaky differentiator (gentle)
                        hp_prev = self._filt_state['hp'][i]
                        hp = hp_prev + a_hp * ((x - prev_x[i]) - hp_prev)
                        self._filt_state['hp'][i] = hp
                        # Low-pass via leaky integrator (gentle)
                        lp_prev = self._filt_state['lp'][i]
                        lp = lp_prev + a_lp * (hp - lp_prev)
                        self._filt_state['lp'][i] = lp
                        filtered.append(lp)
                    self._prev_x = sample_data[:self.num_channels]
                    sample_data = filtered
                except Exception:
                    pass

            # Apply calibration if available
            if self.is_calibrated and self.baseline_correction:
                calibrated_data = [
                    voltage - self.calibration_values[i]
                    for i, voltage in enumerate(sample_data[:self.num_channels])
                ]
            else:
                calibrated_data = sample_data[:self.num_channels]

            # Create EEG sample
            sample = EEGSample(
                timestamp=time.time(),
                channels=self.channel_names,
                data=calibrated_data,
                sample_rate=self.sample_rate,
                device_id=self.device_id,
                device_model=self.device_model,
                metadata={
                    'gain': self.gain,
                    'is_calibrated': self.is_calibrated,
                    'raw_packet_size': len(sample_data)
                }
            )

            return sample
            
        except Exception as e:
            logger.error(f"Error reading sample from PiEEG: {e}")
            return None
    
    def set_gain(self, gain: int) -> bool:
        """Set amplifier gain (requires reconnection)"""
        if gain not in self.GAIN_SETTINGS:
            logger.error(f"Unsupported gain: {gain}")
            return False
        
        self.gain = gain
        
        # If connected, need to reconfigure
        if self.is_connected:
            logger.info("Reconfiguring device with new gain setting")
            was_streaming = self.is_streaming
            
            if was_streaming:
                self.stop_streaming()
            
            self.disconnect()
            success = self.connect()
            
            if success and was_streaming:
                self.start_streaming()
            
            return success
        
        return True
    
    def get_channel_impedances(self) -> Optional[List[float]]:
        """Get electrode impedances (if supported by hardware)"""
        # This would require specific ADS1299 impedance measurement implementation
        # For now, return None to indicate not supported
        logger.info("Impedance measurement not implemented for PiEEG")
        return None
    
    def validate_config(self) -> bool:
        """Validate PiEEG specific configuration"""
        if not super().validate_config():
            return False
        
        if self.num_channels not in [8, 16]:
            logger.error(f"Invalid channel count: {self.num_channels}")
            return False
        
        if self.gain not in self.GAIN_SETTINGS:
            logger.error(f"Invalid gain setting: {self.gain}")
            return False
        
        return True
    
    def get_available_devices(self) -> List[Dict[str, Any]]:
        """Scan for available PiEEG devices connected via SPI/GPIO"""
        devices = []
        
        try:
            logger.info("Scanning for PiEEG devices...")
            
            # Check if SPI interface is available
            import spidev
            import gpiod
            
            # Check for SPI devices (minimal testing to avoid interference)
            spi_devices = []
            for bus in range(2):  # Check SPI0 and SPI1
                for device in range(2):  # Check device 0 and 1
                    try:
                        # Just check if the device file exists instead of opening SPI
                        import os
                        spi_path = f"/dev/spidev{bus}.{device}"
                        if os.path.exists(spi_path):
                            spi_devices.append(f"spidev{bus}.{device}")
                            logger.info(f"Found SPI device: spidev{bus}.{device}")
                    except Exception:
                        pass
            
            # Check for GPIO availability
            gpio_available = False
            try:
                chip = gpiod.Chip('/dev/gpiochip0')
                chip.close()
                gpio_available = True
                logger.info("GPIO interface available")
            except Exception as e:
                logger.warning(f"GPIO interface not available: {e}")
            
            # If we have SPI and GPIO, we can potentially connect to PiEEG
            if spi_devices and gpio_available:
                # Try to detect PiEEG on different SPI configurations
                for spi_device in spi_devices:
                    # Use GPIO pin 37 (like the working example)
                    gpio_pin = 37
                    try:
                        # Parse SPI device name (e.g., "spidev0.0" -> bus=0, device=0)
                        spi_parts = spi_device.replace('spidev', '').split('.')
                        spi_bus = int(spi_parts[0])
                        spi_device_num = int(spi_parts[1])
                        
                        # Since pieeg_read module is already initialized on import,
                        # we can assume PiEEG is available if SPI and GPIO are working
                        device_info = {
                            'name': f'PiEEG-{spi_device}-GPIO{gpio_pin}',
                            'address': f'{spi_device}:{gpio_pin}',
                            'spi_device': spi_device,
                            'gpio_pin': gpio_pin,
                            'device_id': 0x00,  # Default device ID
                            'connection_type': 'spi_gpio',
                            'device_model': 'pieeg_8',  # Default to 8 channels
                            'features': ['eeg', 'spi', 'gpio'],
                            'metadata': {
                                'spi_bus': spi_bus,
                                'spi_device': spi_device_num,
                                'gpio_pin': gpio_pin,
                                'ads1299_id': 0x00
                            }
                        }
                        devices.append(device_info)
                        logger.info(f"Found PiEEG device: {device_info['name']}")
                        
                    except Exception as e:
                        logger.debug(f"Failed to detect PiEEG on {spi_device} GPIO{gpio_pin}: {e}")
                        continue
            
            if not devices:
                logger.info("No PiEEG devices found")
            else:
                logger.info(f"Found {len(devices)} PiEEG device(s)")
            
            return devices
            
        except Exception as e:
            logger.error(f"Error scanning for PiEEG devices: {e}")
            return []
    
    def cleanup(self):
        """Cleanup PiEEG specific resources"""
        logger.info(f"Cleaning up PiEEG device {self.device_id}")
        try:
            try:
                if self._gpio_interface:
                    self._gpio_interface.cleanup()
            except Exception as import_err:
                logger.debug(f"GPIO interface cleanup warning: {import_err}")
        except Exception as e:
            logger.error(f"Error during PiEEG cleanup: {e}")
        finally:
            super().cleanup()