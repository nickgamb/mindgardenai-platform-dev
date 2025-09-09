import logging
import json
import time
from flask import request, session
from flask_socketio import emit, join_room, leave_room
from services.auth import requires_auth
from services.user_settings import get_user_settings
from services.database import get_registered_devices
import random

# Global variables for mgflow flow management
active_mgflow_rooms = {}
mgflow_status = {}

def setup_websocket_routes(socketio):
    """
    Setup WebSocket routes for MindGarden Platform
    Provides real-time updates for mgflow flows
    """
    
    @socketio.on('connect')
    def handle_connect():
        """Handle client connection"""
        try:
            print(f"🔌 Client connected: {request.sid}")
            emit('connection_status', {'status': 'connected', 'message': 'Connected to MindGarden Platform'})
        except Exception as e:
            print(f"❌ Connection error: {e}")
            emit('error', {'message': 'Connection failed'})

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        print(f"🔌 Client disconnected: {request.sid}")
        # Clean up any rooms the client was in
        for room_id in list(active_mgflow_rooms.keys()):
            if request.sid in active_mgflow_rooms[room_id]:
                active_mgflow_rooms[room_id].remove(request.sid)
                if not active_mgflow_rooms[room_id]:
                    del active_mgflow_rooms[room_id]

    @socketio.on('join_mgflow')
    @requires_auth
    def handle_join_mgflow(data):
        """
        Join a mgflow room to receive real-time updates
        Args:
            data: {'mgflow_id': str}
        """
        try:
            mgflow_id = data.get('mgflow_id')
            if not mgflow_id:
                emit('error', {'message': 'mgflow_id is required'})
            return
        
            room_name = f"mgflow_{mgflow_id}"
            join_room(room_name)
            
            # Track active rooms
            if room_name not in active_mgflow_rooms:
                active_mgflow_rooms[room_name] = []
            if request.sid not in active_mgflow_rooms[room_name]:
                active_mgflow_rooms[room_name].append(request.sid)
            
            print(f"👥 Client {request.sid} joined mgflow room: {room_name}")
            emit('joined_mgflow', {
                'mgflow_id': mgflow_id,
                'status': 'joined',
                'message': f'Joined mgflow {mgflow_id} room'
            })
                
        except Exception as e:
            print(f"❌ Error joining mgflow room: {e}")
            emit('error', {'message': 'Failed to join mgflow room'})

    @socketio.on('leave_mgflow')
    @requires_auth
    def handle_leave_mgflow(data):
        """
        Leave a mgflow room
        Args:
            data: {'mgflow_id': str}
        """
        try:
            mgflow_id = data.get('mgflow_id')
            if not mgflow_id:
                emit('error', {'message': 'mgflow_id is required'})
                return
            
            room_name = f"mgflow_{mgflow_id}"
            leave_room(room_name)
            
            # Remove from tracking
            if room_name in active_mgflow_rooms and request.sid in active_mgflow_rooms[room_name]:
                active_mgflow_rooms[room_name].remove(request.sid)
                if not active_mgflow_rooms[room_name]:
                    del active_mgflow_rooms[room_name]
            
            print(f"👥 Client {request.sid} left mgflow room: {room_name}")
            emit('left_mgflow', {
                'mgflow_id': mgflow_id,
                'status': 'left',
                'message': f'Left mgflow {mgflow_id} room'
            })
            
        except Exception as e:
            print(f"❌ Error leaving mgflow room: {e}")
            emit('error', {'message': 'Failed to leave mgflow room'})

    @socketio.on('join_user_room')
    def handle_join_user_room():
        """Join a per-user room so the client can receive user-scoped events."""
        try:
            user = session.get('user')
            if not user:
                emit('error', {'message': 'Not authenticated'})
                return
            room_name = user.get('email') or user.get('sub')
            if not room_name:
                emit('error', {'message': 'Unable to determine user room'})
                return
            join_room(room_name)
            print(f"👤 Client {request.sid} joined user room: {room_name}")
            emit('joined_user_room', {
                'room': room_name,
                'status': 'joined'
            })
        except Exception as e:
            print(f"❌ Error joining user room: {e}")
            emit('error', {'message': 'Failed to join user room'})

    @socketio.on('ping')
    def handle_ping():
        """Handle ping for connection testing"""
        emit('pong', {'timestamp': str(int(time.time()))})

    @socketio.on_error_default
    def default_error_handler(e):
        """Handle any unhandled WebSocket errors"""
        print(f"❌ WebSocket error: {e}")
        emit('error', {'message': 'An unexpected error occurred'})

    # --- NeuroTech device streaming (gated by feature flag) ---
    @socketio.on('start_streaming')
    def handle_start_streaming(data):
        try:
            user = session.get('user')
            if not user:
                emit('streaming_error', {'error': 'Not authenticated'})
                return
            user_id = user.get('sub')
            settings = get_user_settings(user_id) or {}
            if not settings.get('featureFlags', {}).get('neuroTechWorkloads', True):
                emit('streaming_error', {'error': 'NeuroTech Workloads disabled'})
                return

            device_id = data.get('device_id')
            device_model = data.get('device_model')
            simulator_mode = data.get('simulator_mode', False)

            # Emit started event with channels/sample rate
            channels = []
            model = (device_model or '').lower()
            if model == 'emotiv_epoc_x':
                channels = ['AF3','F7','F3','FC5','T7','P7','O1','O2','P8','T8','FC6','F4','F8','AF4']
                sr = 128
            elif model == 'pieeg_16':
                channels = [f'CH{i+1}' for i in range(16)]
                sr = 250
            else:
                channels = [f'CH{i+1}' for i in range(8)]
                sr = 250
            emit('streaming_started', {'device_id': device_id, 'channels': channels, 'sample_rate': sr})

            # Simulator loop (lightweight placeholder)
            if simulator_mode:
                start_ts = time.time()
                for _ in range(300):  # send a few seconds of data
                    values = [random.uniform(-50, 50) for _ in channels]
                    emit('eeg_data', {
                        'device_id': device_id,
                        'timestamp': time.time(),
                        'channels': channels,
                        'data': values,
                        'sample_rate': sr
                    })
                    time.sleep(0.05)
                emit('streaming_stopped', {'device_id': device_id})
        except Exception as e:
            print(f"❌ start_streaming error: {e}")
            emit('streaming_error', {'error': 'Failed to start streaming'})


def broadcast_mgflow_update(mgflow_id, update_data):
    """
    Broadcast a mgflow update to all clients in the mgflow room
    
    Args:
        mgflow_id (str): ID of the mgflow
        update_data (dict): Update data to broadcast
    """
    from main import socketio  # Import here to avoid circular imports
    
    room_name = f"mgflow_{mgflow_id}"
    if room_name in active_mgflow_rooms:
        socketio.emit('mgflow_update', {
            'mgflow_id': mgflow_id,
            'timestamp': str(int(time.time())),
            **update_data
        }, room=room_name)
        print(f"📡 Broadcasted mgflow update to room {room_name}: {update_data}")


def broadcast_mgflow_log(mgflow_id, log_data):
    """
    Broadcast mgflow logs to all clients in the mgflow room
    
    Args:
        mgflow_id (str): ID of the mgflow
        log_data (dict): Log data to broadcast
    """
    from main import socketio  # Import here to avoid circular imports
    
    room_name = f"mgflow_{mgflow_id}"
    if room_name in active_mgflow_rooms:
        socketio.emit('mgflow_log', {
            'mgflow_id': mgflow_id,
            'timestamp': str(int(time.time())),
            **log_data
        }, room=room_name)
        print(f"📋 Broadcasted mgflow log to room {room_name}: {log_data}")


# Utility functions for future mgflow flow integration
def notify_mgflow_started(mgflow_id, mgflow_name):
    """Notify that a mgflow has started"""
    broadcast_mgflow_update(mgflow_id, {
        'status': 'started',
        'message': f'MGFlow "{mgflow_name}" has started'
    })

def notify_mgflow_completed(mgflow_id, mgflow_name, success=True):
    """Notify that a mgflow has completed"""
    status = 'completed' if success else 'failed'
    message = f'MGFlow "{mgflow_name}" {"completed successfully" if success else "failed"}'
    
    broadcast_mgflow_update(mgflow_id, {
        'status': status,
        'message': message,
        'success': success
    })

def notify_mgflow_progress(mgflow_id, step_name, progress_percent):
    """Notify mgflow progress"""
    broadcast_mgflow_update(mgflow_id, {
        'status': 'progress',
        'step': step_name,
        'progress': progress_percent,
        'message': f'Executing: {step_name} ({progress_percent}%)'
    })