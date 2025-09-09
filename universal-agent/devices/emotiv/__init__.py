"""
EMOTIV Device Module

Implements EMOTIV EPOC X device support for the Universal Agent.
Uses both HID (USB dongle) and Bluetooth LE interfaces with automatic fallback.
"""

from .emotiv_device import EmotivDevice

__all__ = ['EmotivDevice']