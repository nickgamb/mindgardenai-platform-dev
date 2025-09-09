from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import add_device, get_registered_devices, update_device, delete_device
from services.user_settings import get_user_settings


def setup_device_routes(app):
    def neurotech_enabled(user_id: str) -> bool:
        settings = get_user_settings(user_id) or {}
        return bool(settings.get('featureFlags', {}).get('neuroTechWorkloads', True))

    @app.route('/api/devices', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_devices():
        user_id = session['user']['sub']
        if not neurotech_enabled(user_id):
            return jsonify({'devices': []})
        devices = get_registered_devices(user_id)
        return jsonify({'devices': devices})

    @app.route('/api/devices', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_register_device():
        user_id = session['user']['sub']
        if not neurotech_enabled(user_id):
            return jsonify({'error': 'NeuroTech Workloads disabled'}), 403
        data = request.json or {}
        device = add_device(
            user_id,
            data.get('device_id') or data.get('id') or data.get('name'),
            data.get('device_name') or data.get('name') or 'Device',
            data.get('device_type') or data.get('type'),
            data.get('device_model') or data.get('model'),
            data.get('device_settings') or data.get('settings') or {},
        )
        return jsonify({'device': device}), 201

    @app.route('/api/devices/<device_id>', methods=['PUT'])
    @requires_auth
    @requires_rbac
    def api_update_device(device_id):
        user_id = session['user']['sub']
        if not neurotech_enabled(user_id):
            return jsonify({'error': 'NeuroTech Workloads disabled'}), 403
        data = request.json or {}
        device = update_device(
            user_id,
            device_id,
            data.get('device_name') or data.get('name') or 'Device',
            data.get('device_type') or data.get('type'),
            data.get('device_model') or data.get('model'),
            data.get('device_settings') or data.get('settings') or {},
        )
        return jsonify({'device': device})

    @app.route('/api/devices/<device_id>', methods=['DELETE'])
    @requires_auth
    @requires_rbac
    def api_delete_device(device_id):
        user_id = session['user']['sub']
        if not neurotech_enabled(user_id):
            return jsonify({'error': 'NeuroTech Workloads disabled'}), 403
        delete_device(user_id, device_id)
        return jsonify({'status': 'success'})


