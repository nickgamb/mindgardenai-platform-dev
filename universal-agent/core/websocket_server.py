"""
WebSocket Server Module

Handles WebSocket communication with the MindGarden server for device control.
"""

import logging
from flask_socketio import emit
from typing import Dict, Any

logger = logging.getLogger('websocket')

class WebSocketHandler:
    """Handles WebSocket events and communication"""
    
    def __init__(self, socketio, device_manager, config):
        self.socketio = socketio
        self.device_manager = device_manager
        self.config = config
        self.setup_handlers()
        
        logger.info("WebSocket handler initialized")
    
    def setup_handlers(self):
        """Setup WebSocket event handlers"""
        
        @self.socketio.on('connect')
        def handle_connect():
            logger.info("WebSocket client connected")
            emit('connected', {
                'status': 'Connected to Universal Agent',
                'version': '1.0.0',
                'supported_devices': list(self.config.SUPPORTED_DEVICES.keys())
            })
        
        @self.socketio.on('disconnect')
        def handle_disconnect():
            logger.info("WebSocket client disconnected")
        
        @self.socketio.on('ping')
        def handle_ping(data=None):
            """Handle ping requests for connection keep-alive"""
            emit('pong', {'timestamp': data.get('timestamp') if data else None})
        
        @self.socketio.on('device_status')
        def handle_device_status(data):
            """Handle device status requests"""
            try:
                device_id = data.get('device_id')
                
                if device_id:
                    status = self.device_manager.get_device_status(device_id)
                    if status:
                        emit('device_status_response', {
                            'device_id': device_id,
                            'status': status
                        })
                    else:
                        emit('device_error', {
                            'error': f'Device {device_id} not found'
                        })
                else:
                    # Return all device statuses
                    all_status = self.device_manager.get_all_device_status()
                    emit('device_status_response', {
                        'all_devices': all_status
                    })
                    
            except Exception as e:
                logger.error(f"Error handling device status request: {e}")
                emit('device_error', {'error': str(e)})
        
        @self.socketio.on('start_streaming')
        def handle_start_streaming(data):
            """Handle start streaming command from server"""
            try:
                logger.info(f"Received start_streaming command: {data}")
                
                device_id = data.get('device_id')
                device_model = data.get('device_model')
                
                if not device_id:
                    emit('streaming_error', {'error': 'Missing device_id'})
                    return
                
                if not device_model:
                    emit('streaming_error', {'error': 'Missing device_model'})
                    return
                
                # Validate device model
                if not self.device_manager.is_device_supported(device_model):
                    emit('streaming_error', {
                        'error': f'Unsupported device model: {device_model}'
                    })
                    return
                
                # Start streaming
                result = self.device_manager.start_streaming(
                    device_model, 
                    device_id, 
                    self.socketio
                )
                
                if result['success']:
                    emit('streaming_started', {
                        'device_id': device_id,
                        'device_model': device_model,
                        'status': result['message']
                    })
                    logger.info(f"Streaming started for device {device_id}")
                else:
                    emit('streaming_error', {
                        'device_id': device_id,
                        'error': result['error']
                    })
                    logger.error(f"Failed to start streaming: {result['error']}")
                    
            except Exception as e:
                logger.error(f"Error handling start_streaming: {e}")
                emit('streaming_error', {'error': str(e)})
        
        @self.socketio.on('stop_streaming')
        def handle_stop_streaming(data):
            """Handle stop streaming command from server"""
            try:
                logger.info(f"Received stop_streaming command: {data}")
                
                device_id = data.get('device_id')
                
                if not device_id:
                    emit('streaming_error', {'error': 'Missing device_id'})
                    return
                
                # Stop streaming
                result = self.device_manager.stop_streaming(device_id)
                
                if result['success']:
                    emit('streaming_stopped', {
                        'device_id': device_id,
                        'status': result['message']
                    })
                    logger.info(f"Streaming stopped for device {device_id}")
                else:
                    emit('streaming_error', {
                        'device_id': device_id,
                        'error': result['error']
                    })
                    logger.error(f"Failed to stop streaming: {result['error']}")
                    
            except Exception as e:
                logger.error(f"Error handling stop_streaming: {e}")
                emit('streaming_error', {'error': str(e)})
        
        @self.socketio.on('calibrate_device')
        def handle_calibrate_device(data):
            """Handle device calibration command"""
            try:
                logger.info(f"Received calibrate_device command: {data}")
                
                device_id = data.get('device_id')
                
                if not device_id:
                    emit('calibration_error', {'error': 'Missing device_id'})
                    return
                
                # Calibrate device
                result = self.device_manager.calibrate_device(device_id)
                
                if result['success']:
                    emit('calibration_completed', {
                        'device_id': device_id,
                        'status': result['message']
                    })
                    logger.info(f"Calibration completed for device {device_id}")
                else:
                    emit('calibration_error', {
                        'device_id': device_id,
                        'error': result['error']
                    })
                    logger.error(f"Calibration failed: {result['error']}")
                    
            except Exception as e:
                logger.error(f"Error handling calibrate_device: {e}")
                emit('calibration_error', {'error': str(e)})
        
        @self.socketio.on('connect_device')
        def handle_connect_device(data):
            """Handle device connection command"""
            try:
                logger.info(f"Received connect_device command: {data}")
                
                device_id = data.get('device_id')
                
                if not device_id:
                    emit('connection_error', {'error': 'Missing device_id'})
                    return
                
                # Connect device
                result = self.device_manager.connect_device(device_id)
                
                if result['success']:
                    emit('device_connected', {
                        'device_id': device_id,
                        'status': result['message']
                    })
                    logger.info(f"Device connected: {device_id}")
                else:
                    emit('connection_error', {
                        'device_id': device_id,
                        'error': result['error']
                    })
                    logger.error(f"Device connection failed: {result['error']}")
                    
            except Exception as e:
                logger.error(f"Error handling connect_device: {e}")
                emit('connection_error', {'error': str(e)})
        
        @self.socketio.on('disconnect_device')
        def handle_disconnect_device(data):
            """Handle device disconnection command"""
            try:
                logger.info(f"Received disconnect_device command: {data}")
                
                device_id = data.get('device_id')
                
                if not device_id:
                    emit('disconnection_error', {'error': 'Missing device_id'})
                    return
                
                # Disconnect device
                result = self.device_manager.disconnect_device(device_id)
                
                if result['success']:
                    emit('device_disconnected', {
                        'device_id': device_id,
                        'status': result['message']
                    })
                    logger.info(f"Device disconnected: {device_id}")
                else:
                    emit('disconnection_error', {
                        'device_id': device_id,
                        'error': result['error']
                    })
                    logger.error(f"Device disconnection failed: {result['error']}")
                    
            except Exception as e:
                logger.error(f"Error handling disconnect_device: {e}")
                emit('disconnection_error', {'error': str(e)})
        
        @self.socketio.on('get_supported_devices')
        def handle_get_supported_devices():
            """Return list of supported device models"""
            try:
                supported = self.device_manager.get_supported_devices()
                emit('supported_devices', {
                    'devices': supported
                })
                
            except Exception as e:
                logger.error(f"Error getting supported devices: {e}")
                emit('error', {'error': str(e)})
    
    def emit_data(self, data: Dict[str, Any]):
        """Emit EEG data to connected clients"""
        try:
            self.socketio.emit('eeg_data', data)
        except Exception as e:
            logger.error(f"Error emitting data: {e}")
    
    def emit_error(self, error: str, device_id: str = None):
        """Emit error to connected clients"""
        try:
            error_data = {'error': error}
            if device_id:
                error_data['device_id'] = device_id
            
            self.socketio.emit('device_error', error_data)
            
        except Exception as e:
            logger.error(f"Error emitting error: {e}")
    
    def emit_status_update(self, device_id: str, status: Dict[str, Any]):
        """Emit device status update"""
        try:
            self.socketio.emit('device_status_update', {
                'device_id': device_id,
                'status': status
            })
            
        except Exception as e:
            logger.error(f"Error emitting status update: {e}")
    
    def cleanup(self):
        """Cleanup WebSocket resources"""
        logger.info("WebSocket handler cleanup completed")