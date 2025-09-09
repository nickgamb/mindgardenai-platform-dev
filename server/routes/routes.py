import logging
from flask import jsonify, request, session
import requests
# from services.device_settings import update_device_settings, get_device_settings  # Removed for mgflow focus
from flask_socketio import emit
from services.auth import requires_auth, get_jwks, get_signing_key, login, logout, get_user_info, callback, validate_universal_logout_jwt, ALL_PERMISSIONS
from utils.auth0_utils import logout_user_by_email, logout_user_by_id
from services.database import (
    add_participant, get_participants,
    update_participant, delete_participant, add_storage_item, get_storage_items,
    update_storage_item, delete_storage_item, add_model, get_models,
    update_model, delete_model, add_analytics, get_analytics,
    update_analytics, delete_analytics,
    # New mgflow assistant functions
    add_mgflow, get_user_mgflows, update_mgflow, delete_mgflow,
    add_file, get_user_files, delete_file,
    add_transform, get_transforms, update_transform, delete_transform
)
import threading
import time
from flask_socketio import SocketIO, emit
from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from apispec_webframeworks.flask import FlaskPlugin

# Initialize global variables for mgflow flows
running_flows = {}
mgflow_threads = {}
flow_events = {}

# Global variable to store the SocketIO instance
socketio = None

def setup_routes(app, socket_io):
    global running, current_experiment, experiment_thread, experiment_event, socketio
    socketio = socket_io

    # Fetch Auth0 configurations from Flask config
    API_IDENTIFIER = app.config['AUTH0_API_IDENTIFIER']
    AUTH0_DOMAIN = app.config['AUTH0_DOMAIN']

    # Set up Swagger UI
    spec = APISpec(
        title="MindGarden Platform API",
        version="1.0.0",
        openapi_version="3.0.2",
        plugins=[FlaskPlugin(), MarshmallowPlugin()],
        servers=[{"url": "http://localhost:5000"}]  # Development server
    )

    # Security scheme
    spec.components.securitySchemes = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }

    # Add custom x-permissions section to the spec
    # TODO: We need to pull this in a more automated way
    spec.options['x-permissions'] = [
        {"name": permission, "description": f"Permission to {permission.replace(':', ' ')}"}
        for permission in ALL_PERMISSIONS
    ]

    # Import and setup routes from other modules
    from .auth_routes import setup_auth_routes
    from .storage_routes import setup_storage_routes
    from .model_routes import setup_model_routes
    from .analytics_routes import setup_analytics_routes
    from .data_routes import setup_data_routes
    from .user_settings_routes import setup_user_settings_routes
    from .participants_routes import setup_participants_routes
    from .device_routes import setup_device_routes
    from .websocket_routes import setup_websocket_routes
    from .experiments_routes import setup_experiments_routes

    from .transform_routes import setup_transform_routes
    from .flow_routes import setup_flow_routes
    # MG Flow routes (formerly mgflow routes)
    from .mgflow_routes import setup_mgflow_routes
    from .file_routes import setup_file_routes
    from .webhook_routes import setup_webhook_routes
    from .api_connection_routes import setup_api_connection_routes
    from .schema_routes import setup_schema_routes
    from .graph_routes import setup_graph_routes
    from .plugins_routes import setup_plugins_routes

    # Register all the route modules
    setup_auth_routes(app)

    setup_storage_routes(app)
    setup_model_routes(app)
    setup_analytics_routes(app)
    setup_data_routes(app)
    setup_user_settings_routes(app)
    setup_participants_routes(app)
    setup_device_routes(app)
    setup_websocket_routes(socket_io)

    setup_transform_routes(app)
    setup_flow_routes(app, socket_io)
    setup_experiments_routes(app)
    # MG Flow routes
    setup_mgflow_routes(app)
    setup_file_routes(app)
    setup_webhook_routes(app, socket_io)
    setup_api_connection_routes(app)
    setup_schema_routes(app)
    setup_graph_routes(app)
    setup_plugins_routes(app)

    @app.route('/api/openapi.json', methods=['GET'])
    @requires_auth
    def get_openapi_spec():
        """
        Serve the OpenAPI specification.
        ---
        get:
          summary: Get OpenAPI specification
          description: Retrieve the OpenAPI specification for the API.
          tags:
            - openapi
          security:
            - BearerAuth: []
          responses:
            '200':
              description: Successful response
              content:
                application/json:
                  schema:
                    type: object
            '401':
              description: Unauthorized
        """
        return jsonify(spec.to_dict())

    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def handle_options(path=''):
        """
        Handle OPTIONS requests for CORS preflight.
        ---
        options:
          summary: Handle OPTIONS requests
          description: Respond to OPTIONS requests for CORS preflight.
          tags:
            - options
          parameters:
            - in: path
              name: path
              schema:
                type: string
              description: Any path
          responses:
            '204':
              description: Successful response with no content
        """
        return '', 204

    @app.route('/api/status', methods=['GET'])
    def get_status():
        """
        Get the current system status.
        ---
        get:
          summary: Get system status
          description: Retrieve the current status of the system.
          tags:
            - status
          security:
            - BearerAuth: []
          responses:
            '200':
              description: Successful response
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                      message:
                        type: string
            '401':
              description: Unauthorized
            '500':
              description: Failed to retrieve system status
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                      message:
                        type: string
        """
        # Implement status retrieval logic here
        # For now, we'll just return a placeholder response
        return jsonify({"status": "success", "message": "System status: OK"})

    # Add all routes to the openapi spec
    with app.test_request_context():
        for rule in app.url_map.iter_rules():
            if rule.endpoint != 'static':
                try:
                    spec.path(view=app.view_functions[rule.endpoint], security=[{"BearerAuth": []}])
                except AttributeError as e:
                    logging.warning(f"Could not add {rule.endpoint} to OpenAPI spec: {str(e)}")
                except Exception as e:
                    logging.error(f"Error adding {rule.endpoint} to OpenAPI spec: {str(e)}")
