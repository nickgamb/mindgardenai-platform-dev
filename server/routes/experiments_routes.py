from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import get_user_experiments, add_experiment, update_experiment, delete_experiment
from services.user_settings import get_user_settings


def setup_experiments_routes(app):
    def neurotech_enabled(user_id: str) -> bool:
        settings = get_user_settings(user_id) or {}
        return bool(settings.get('featureFlags', {}).get('neuroTechWorkloads', True))

    @app.route('/api/experiments', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_experiments():
        user_id = session['user']['sub']
        if not neurotech_enabled(user_id):
            return jsonify({'experiments': []})
        return jsonify({'experiments': get_user_experiments(user_id)})

    @app.route('/api/experiments', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_create_experiment():
        user_id = session['user']['sub']
        if not neurotech_enabled(user_id):
            return jsonify({'error': 'NeuroTech Workloads disabled'}), 403
        data = request.json or {}
        name = data.get('name')
        description = data.get('description')
        code = data.get('code')
        ok, msg = add_experiment(user_id, name, description, code)
        if ok:
            return jsonify({'status': 'success', 'message': msg}), 201
        return jsonify({'status': 'error', 'message': msg}), 500

    @app.route('/api/experiments/<int:experiment_id>', methods=['PUT'])
    @requires_auth
    @requires_rbac
    def api_update_experiment(experiment_id):
        user_id = session['user']['sub']
        if not neurotech_enabled(user_id):
            return jsonify({'error': 'NeuroTech Workloads disabled'}), 403
        data = request.json or {}
        ok, msg = update_experiment(user_id, experiment_id, data.get('name'), data.get('description'), data.get('code'))
        if ok:
            return jsonify({'status': 'success', 'message': msg})
        return jsonify({'status': 'error', 'message': msg}), 500

    @app.route('/api/experiments/<int:experiment_id>', methods=['DELETE'])
    @requires_auth
    @requires_rbac
    def api_delete_experiment(experiment_id):
        user_id = session['user']['sub']
        if not neurotech_enabled(user_id):
            return jsonify({'error': 'NeuroTech Workloads disabled'}), 403
        ok, msg = delete_experiment(user_id, experiment_id)
        if ok:
            return jsonify({'status': 'success', 'message': msg})
        return jsonify({'status': 'error', 'message': msg}), 500


