from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import add_mgflow, get_user_mgflows, get_mgflow, update_mgflow, delete_mgflow
from services.scheduler import schedule_flow_execution, cancel_scheduled_flow, init_scheduler
import logging
import json
from datetime import datetime


def setup_mgflow_routes(app):
    # Delegate to the same handlers as mgflow_routes, preserving endpoints
    # We keep the URL paths (/api/mgflows) for compatibility; only code naming changes to MG Flow.

    @app.route('/api/mgflows', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_mgflows():
        try:
            user_info = session.get('user')
            if not user_info or not user_info.get('email'):
                return jsonify({'error': 'User information not found in session'}), 401
            user_email = user_info['email']
            mgflows = get_user_mgflows(user_email)
            return jsonify({'mgflows': mgflows})
        except Exception as e:
            logging.error(f"Error getting mgflows: {str(e)}")
            return jsonify({'error': 'Failed to fetch mgflows'}), 500

    @app.route('/api/mgflows', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_create_mgflow():
        try:
            user_info = session.get('user')
            if not user_info or not user_info.get('email'):
                return jsonify({'error': 'User information not found in session'}), 401
            user_email = user_info['email']
            data = request.get_json()
            if not data or 'name' not in data:
                return jsonify({'error': 'MGFlow name is required'}), 400
            name = data['name']
            description = data.get('description', '')
            mgflow_flow = data.get('mgflow_flow', '{}')
            shared_with = data.get('shared_with', [])
            if not isinstance(shared_with, list):
                return jsonify({'error': 'shared_with must be an array'}), 400
            shared_with_str = ','.join(shared_with) if shared_with else None
            mgflow_id = add_mgflow(user_email, name, description, mgflow_flow, shared_with_str)
            return jsonify({'message': 'MGFlow created successfully', 'mgflow_id': mgflow_id})
        except Exception as e:
            logging.error(f"Error creating mgflow: {str(e)}")
            return jsonify({'error': 'Failed to create mgflow'}), 500

    @app.route('/api/mgflows/<int:mgflow_id>', methods=['PUT'])
    @requires_auth
    @requires_rbac
    def api_update_mgflow(mgflow_id):
        try:
            user_info = session.get('user')
            if not user_info or not user_info.get('email'):
                return jsonify({'error': 'User information not found in session'}), 401
            user_email = user_info['email']
            data = request.get_json()
            if not data:
                return jsonify({'error': 'Request body is required'}), 400
            name = data.get('name')
            description = data.get('description')
            mgflow_flow = data.get('mgflow_flow')
            shared_with = data.get('shared_with', [])
            if shared_with is not None and not isinstance(shared_with, list):
                return jsonify({'error': 'shared_with must be an array'}), 400
            shared_with_str = ','.join(shared_with) if shared_with else None
            success = update_mgflow(mgflow_id, user_email, name, description, mgflow_flow, shared_with_str)
            if success:
                if mgflow_flow:
                    try:
                        flow_data = json.loads(mgflow_flow)
                        cancel_scheduled_flow(mgflow_id)
                        init_scheduler()
                        for node in flow_data.get('nodes', []):
                            if (node.get('type') == 'flow_trigger' and node.get('data', {}).get('config', {}).get('trigger_type') == 'scheduled'):
                                config = node['data']['config']
                                schedule_date = config.get('schedule_date')
                                schedule_time = config.get('schedule_time')
                                if schedule_date and schedule_time:
                                    schedule_datetime_str = f"{schedule_date} {schedule_time}"
                                    schedule_datetime = datetime.strptime(schedule_datetime_str, "%Y-%m-%d %H:%M")
                                    schedule_flow_execution(
                                        mgflow_id=mgflow_id,
                                        trigger_node_id=node['id'],
                                        schedule_datetime=schedule_datetime,
                                        flow_data=flow_data,
                                        user_id=user_email,
                                        socketio=None
                                    )
                    except Exception as e:
                        logging.error(f"❌ Error processing scheduled triggers: {e}")
                return jsonify({'message': 'MGFlow updated successfully'})
            else:
                return jsonify({'error': 'MGFlow not found or not authorized'}), 404
        except Exception as e:
            logging.error(f"Error updating mgflow: {str(e)}")
            return jsonify({'error': 'Failed to update mgflow'}), 500

    @app.route('/api/mgflows/<int:mgflow_id>', methods=['DELETE'])
    @requires_auth
    @requires_rbac
    def api_delete_mgflow(mgflow_id):
        try:
            user_info = session.get('user')
            if not user_info or not user_info.get('email'):
                return jsonify({'error': 'User information not found in session'}), 401
            user_email = user_info['email']
            success = delete_mgflow(mgflow_id, user_email)
            if success:
                try:
                    cancel_scheduled_flow(mgflow_id)
                    logging.info(f"🗑️ Cancelled scheduled flows for deleted mgflow: {mgflow_id}")
                except Exception as e:
                    logging.error(f"❌ Error cancelling scheduled flows: {e}")
                return jsonify({'message': 'MGFlow deleted successfully'})
            else:
                return jsonify({'error': 'MGFlow not found or not authorized'}), 404
        except Exception as e:
            logging.error(f"Error deleting mgflow: {str(e)}")
            return jsonify({'error': 'Failed to delete mgflow'}), 500

