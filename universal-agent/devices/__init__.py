"""
MindGarden Universal Agent - Device Modules

This package contains device-specific implementations:
- BaseDevice: Abstract device interface
- PiEEGDevice: PiEEG SPI/GPIO implementation
- EmotivDevice: EMOTIV Bluetooth HID implementation
- IdunDevice: IDUN Guardian Bluetooth LE implementation
"""

__version__ = '1.0.0'
__author__ = 'MindGarden AI'

from .base_device import BaseDevice
from .pieeg.pieeg_device import PiEEGDevice
from .emotiv.emotiv_device import EmotivDevice
from .idun.idun_device import IdunDevice

__all__ = ['BaseDevice', 'PiEEGDevice', 'EmotivDevice', 'IdunDevice']