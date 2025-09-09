"""
Base Device Interface

Abstract base class for all EEG devices supported by the Universal Agent.
"""

import logging
import threading
import time
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass

logger = logging.getLogger('device')

@dataclass
class EEGSample:
    """Represents a single EEG sample"""
    timestamp: float
    channels: List[str]
    data: List[float]
    sample_rate: int
    device_id: str
    device_model: str
    metadata: Optional[Dict[str, Any]] = None

class DeviceError(Exception):
    """Base exception for device-related errors"""
    pass

class DeviceConnectionError(DeviceError):
    """Raised when device connection fails"""
    pass

class DeviceStreamingError(DeviceError):
    """Raised when device streaming fails"""
    pass

class BaseDevice(ABC):
    """Abstract base class for all EEG devices"""
    
    def __init__(self, device_id: str, config: Dict[str, Any]):
        self.device_id = device_id
        self.config = config
        self.device_model = config.get('device_model', 'unknown')
        self.sample_rate = config.get('sample_rate', 250)
        self.channels = config.get('channels', [])
        
        # State management
        self.is_connected = False
        self.is_streaming = False
        self.stream_thread = None
        self.stop_event = threading.Event()
        
        # Callbacks
        self.data_callback: Optional[Callable[[EEGSample], None]] = None
        self.error_callback: Optional[Callable[[Exception], None]] = None
        
        # Statistics
        self.samples_sent = 0
        self.errors_count = 0
        self.start_time = None
        
        logger.info(f"Initialized device: {self.device_id} ({self.device_model})")
    
    @abstractmethod
    def connect(self) -> bool:
        """
        Connect to the physical device.
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        pass
    
    @abstractmethod
    def disconnect(self) -> bool:
        """
        Disconnect from the physical device.
        
        Returns:
            bool: True if disconnection successful, False otherwise
        """
        pass
    
    @abstractmethod
    def start_streaming(self) -> bool:
        """
        Start streaming EEG data.
        
        Returns:
            bool: True if streaming started successfully, False otherwise
        """
        pass
    
    @abstractmethod
    def stop_streaming(self) -> bool:
        """
        Stop streaming EEG data.
        
        Returns:
            bool: True if streaming stopped successfully, False otherwise
        """
        pass
    
    @abstractmethod
    def get_device_info(self) -> Dict[str, Any]:
        """
        Get device information and capabilities.
        
        Returns:
            Dict containing device information
        """
        pass
    
    @abstractmethod
    def calibrate(self) -> bool:
        """
        Perform device calibration if supported.
        
        Returns:
            bool: True if calibration successful, False otherwise
        """
        pass
    
    @abstractmethod
    def _read_sample(self) -> Optional[EEGSample]:
        """
        Read a single EEG sample from the device.
        
        Returns:
            EEGSample if successful, None if no data available
        """
        pass
    
    def set_data_callback(self, callback: Callable[[EEGSample], None]):
        """Set callback function for EEG data"""
        self.data_callback = callback
        logger.info(f"Data callback set for device {self.device_id}")
    
    def set_error_callback(self, callback: Callable[[Exception], None]):
        """Set callback function for errors"""
        self.error_callback = callback
        logger.info(f"Error callback set for device {self.device_id}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current device status"""
        uptime = time.time() - self.start_time if self.start_time else 0
        
        return {
            'device_id': self.device_id,
            'device_model': self.device_model,
            'is_connected': self.is_connected,
            'is_streaming': self.is_streaming,
            'sample_rate': self.sample_rate,
            'channels': len(self.channels),
            'samples_sent': self.samples_sent,
            'errors_count': self.errors_count,
            'uptime': uptime
        }
    
    def _stream_worker(self):
        """Worker thread for continuous data streaming"""
        logger.info(f"Starting stream worker for device {self.device_id}")
        self.start_time = time.time()
        
        try:
            while not self.stop_event.is_set() and self.is_streaming:
                try:
                    # Read sample from device
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
                    
                    # Control streaming rate
                    if self.sample_rate > 0:
                        time.sleep(1.0 / self.sample_rate)
                        
                except Exception as e:
                    self.errors_count += 1
                    logger.error(f"Error in stream worker for {self.device_id}: {e}")
                    
                    if self.error_callback:
                        self.error_callback(e)
                    
                    # Don't exit on single errors, but pause briefly
                    time.sleep(0.1)
                    
        except Exception as e:
            logger.error(f"Fatal error in stream worker for {self.device_id}: {e}")
            if self.error_callback:
                self.error_callback(e)
        finally:
            logger.info(f"Stream worker stopped for device {self.device_id}")
    
    def _start_stream_thread(self):
        """Start the streaming thread"""
        if self.stream_thread and self.stream_thread.is_alive():
            logger.warning(f"Stream thread already running for {self.device_id}")
            return False
        
        self.stop_event.clear()
        self.stream_thread = threading.Thread(target=self._stream_worker, daemon=True)
        self.stream_thread.start()
        
        logger.info(f"Stream thread started for device {self.device_id}")
        return True
    
    def _stop_stream_thread(self):
        """Stop the streaming thread"""
        if not self.stream_thread:
            return True
        
        logger.info(f"Stopping stream thread for device {self.device_id}")
        self.stop_event.set()
        
        # Wait for thread to finish with timeout
        self.stream_thread.join(timeout=5.0)
        
        if self.stream_thread.is_alive():
            logger.warning(f"Stream thread did not stop gracefully for {self.device_id}")
            return False
        
        self.stream_thread = None
        logger.info(f"Stream thread stopped for device {self.device_id}")
        return True
    
    def reset_statistics(self):
        """Reset device statistics"""
        self.samples_sent = 0
        self.errors_count = 0
        self.start_time = None
        logger.info(f"Statistics reset for device {self.device_id}")
    
    def validate_config(self) -> bool:
        """Validate device configuration"""
        required_fields = ['device_model', 'sample_rate']
        
        for field in required_fields:
            if field not in self.config:
                logger.error(f"Missing required config field: {field}")
                return False
        
        if self.sample_rate <= 0:
            logger.error(f"Invalid sample rate: {self.sample_rate}")
            return False
        
        return True
    
    def cleanup(self):
        """Cleanup device resources"""
        logger.info(f"Cleaning up device {self.device_id}")
        try:
            if self.is_streaming:
                self.stop_streaming()
            if self.is_connected:
                self.disconnect()
        except Exception as e:
            logger.error(f"Error during device cleanup: {e}")
    
    def __del__(self):
        """Destructor - ensure cleanup"""
        self.cleanup()