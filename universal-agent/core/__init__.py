"""
MindGarden Universal Agent - Core Modules

This package contains the core functionality for the Universal Agent:
- AuthManager: Auth0 integration and server communication
- DeviceManager: Device coordination and streaming management  
- CloudflareClient: Cloudflare tunnel management
- WebSocketHandler: WebSocket communication with MindGarden server
"""

__version__ = '1.0.0'
__author__ = 'MindGarden AI'

from .auth import AuthManager
from .device_manager import DeviceManager
from .cloudflare_client import CloudflareClient
from .websocket_server import WebSocketHandler

__all__ = ['AuthManager', 'DeviceManager', 'CloudflareClient', 'WebSocketHandler']