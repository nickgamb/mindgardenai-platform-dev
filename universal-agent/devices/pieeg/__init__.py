"""
PiEEG Device Module

Implements PiEEG device support for the Universal Agent.
Supports both 8 and 16 channel configurations via SPI/GPIO interface.
"""

from .pieeg_device import PiEEGDevice

__all__ = ['PiEEGDevice']