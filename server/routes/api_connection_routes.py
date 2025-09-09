from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import (
    get_api_connections, get_api_connection, add_api_connection, 
    delete_api_connection, update_api_connection
)
import logging
import os
import json
import yaml
import tempfile
import uuid
from datetime import datetime
import requests
import time
from urllib.parse import urljoin

def setup_api_connection_routes(app):
    @app.route('/api/api-connections', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_connections():
        """
        Get all API connections for the authenticated user.
        ---
        get:
          summary: Get API connections
          description: Retrieve all API connections for the authenticated user.
          tags:
            - api-connections
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
                      api_connections:
                        type: array
                        items:
                          type: object
                          properties:
                            id:
                              type: string
                            name:
                              type: string
                            api_type:
                              type: string
                            base_url:
                              type: string
                            description:
                              type: string
                            status:
                              type: string
                            created_at:
                              type: string
            '401':
              description: Unauthorized
            '500':
              description: Failed to fetch API connections
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            
            # Get user's API connections from database (follows same pattern as files, transforms, etc.)
            api_connections = get_api_connections(user_id)
            
            print(f"✅ Fetched {len(api_connections)} API connections for user {user_id}")
            return jsonify({"api_connections": api_connections})
            
        except Exception as e:
            print(f"❌ Error fetching API connections: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/api-connections/<connection_id>', methods=['PUT'])
    @requires_auth
    @requires_rbac
    def api_update_connection(connection_id):
        """
        Update an existing API connection (including token and base_url).
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                return jsonify({"error": "User not authenticated"}), 401

            data = request.get_json() or {}

            # Whitelist allowed fields for update
            allowed_fields = ['name', 'description', 'api_type', 'base_url', 'status', 'api_token', 'endpoints_available', 'openapi_info']
            update_fields = {k: v for k, v in data.items() if k in allowed_fields}

            # If client sent additional_config (e.g., auth preferences), merge into openapi_info.x-connection
            additional_config = data.get('additional_config') or {}
            if additional_config:
                current = get_api_connection(connection_id, user_id)
                if not current:
                    return jsonify({"error": "API connection not found"}), 404
                oi = current.get('openapi_info') or {}
                if not isinstance(oi, dict):
                    oi = {}
                xconn = oi.get('x-connection') or {}
                xconn.update(additional_config)
                oi['x-connection'] = xconn
                update_fields['openapi_info'] = oi

            if not update_fields:
                return jsonify({"error": "No valid fields provided for update"}), 400

            success = update_api_connection(connection_id, user_id, **update_fields)
            if not success:
                return jsonify({"error": "API connection not found or not updated"}), 404

            # Return updated resource
            updated = get_api_connection(connection_id, user_id)
            return jsonify({"message": "API connection updated successfully", "connection": updated}), 200
        except Exception as e:
            print(f"❌ Error updating API connection: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/api-connections', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_create_connection():
        """
        Create a new API connection.
        ---
        post:
          summary: Create API connection
          description: Create a new API connection for the authenticated user.
          tags:
            - api-connections
          security:
            - BearerAuth: []
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    name:
                      type: string
                      description: Name for the API connection
                    api_type:
                      type: string
                      description: Type of API (veza, custom, etc.)
                    base_url:
                      type: string
                      description: Base URL for the API
                    api_token:
                      type: string
                      description: API token/key for authentication
                    description:
                      type: string
                      description: Description of the connection
          responses:
            '201':
              description: API connection created successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
                      connection_id:
                        type: string
            '400':
              description: Invalid request data
            '401':
              description: Unauthorized
            '500':
              description: Failed to create API connection
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            data = request.get_json()
            
            required_fields = ['name', 'api_type', 'base_url']
            for field in required_fields:
                if not data.get(field):
                    return jsonify({"error": f"Missing required field: {field}"}), 400
            
            # Generate unique connection ID
            connection_id = f"{data['api_type']}-{uuid.uuid4().hex[:8]}"
            
            # Check if there's a test result and set status accordingly
            test_result = data.get('test_result', {})
            initial_status = 'active' if test_result.get('success', False) else 'inactive'
            
            # Prepare endpoints_available for different API types
            endpoints_available = []
            openapi_info = None
            
            if data['api_type'] == 'veza':
                # Load and parse the actual Veza OpenAPI specification
                veza_spec = load_veza_openapi_spec()
                if veza_spec:
                    # Parse the Veza OpenAPI spec to extract endpoints
                    veza_connection_info = parse_openapi_spec(
                        veza_spec, 
                        data['name'], 
                        data.get('description', 'Veza API integration')
                    )
                    
                    # Override the base_url with the user-provided one
                    veza_connection_info['base_url'] = data['base_url']
                    veza_connection_info['api_type'] = 'veza'
                    
                    endpoints_available = veza_connection_info['endpoints_available']
                    openapi_info = veza_connection_info['openapi_info']
                    
                    logging.info(f"🔍 Loaded {len(endpoints_available)} endpoints from Veza OpenAPI spec")
                else:
                    logging.warning("⚠️ Could not load Veza OpenAPI spec, using default endpoints")
                    # Fallback endpoints for Veza
                    endpoints_available = [
                        {"path": "/api/v1/providers/custom", "method": "GET", "summary": "List custom providers"},
                        {"path": "/api/v1/providers/custom/{id}/datasources", "method": "POST", "summary": "Push datasource to provider"}
                    ]
            elif data['api_type'] == 'okta':
                okta_spec = load_okta_openapi_spec()
                if okta_spec:
                    okta_info = parse_openapi_spec(
                        okta_spec,
                        data['name'],
                        data.get('description', 'Okta Management API')
                    )
                    okta_info['base_url'] = data['base_url']
                    okta_info['api_type'] = 'okta'
                    endpoints_available = okta_info['endpoints_available']
                    openapi_info = okta_spec
                    logging.info(f"🔍 Loaded {len(endpoints_available)} endpoints from Okta OpenAPI spec")
                else:
                    logging.warning("⚠️ Could not load Okta OpenAPI spec, endpoints will be empty")
            else:
                # For custom APIs, endpoints will be populated from OpenAPI spec upload
                # or left empty for manual configuration
                pass
            
            # Merge additional_config (e.g., auth header preferences) into openapi_info
            additional_config = data.get('additional_config') or {}
            if additional_config:
                if openapi_info is None:
                    openapi_info = {}
                if isinstance(openapi_info, dict):
                    # Store under OpenAPI extension key
                    existing_cfg = openapi_info.get('x-connection') or {}
                    existing_cfg.update(additional_config)
                    openapi_info['x-connection'] = existing_cfg
            
            # Save to database
            success = add_api_connection(
                connection_id=connection_id,
                user_id=user_id,
                name=data['name'],
                description=data.get('description', ''),
                api_type=data['api_type'],
                base_url=data['base_url'],
                api_token=data.get('api_token'),
                endpoints_available=endpoints_available,
                openapi_info=openapi_info,
                status=initial_status
            )
            
            if not success:
                return jsonify({"error": "Failed to save API connection to database"}), 500
            
            logging.info(f"✅ Created API connection {connection_id} for user {user_id}")
            return jsonify({
                "message": "API connection created successfully",
                "connection_id": connection_id,
                "connection": {
                    "id": connection_id,
                    "name": data['name'],
                    "description": data.get('description', ''),
                    "api_type": data['api_type'],
                    "base_url": data['base_url'],
                    "endpoints_available": endpoints_available,
                    "status": initial_status
                }
            }), 201
            
        except Exception as e:
            print(f"❌ Error creating API connection: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/api-connections/<connection_id>', methods=['DELETE'])
    @requires_auth
    @requires_rbac
    def api_delete_connection(connection_id):
        """
        Delete an API connection.
        ---
        delete:
          summary: Delete API connection
          description: Delete an API connection for the authenticated user.
          tags:
            - api-connections
          security:
            - BearerAuth: []
          parameters:
            - in: path
              name: connection_id
              required: true
              schema:
                type: string
              description: The ID of the API connection to delete
          responses:
            '200':
              description: API connection deleted successfully
            '401':
              description: Unauthorized
            '404':
              description: API connection not found
            '500':
              description: Failed to delete API connection
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            
            # Prevent deletion of built-in Veza connection
            if connection_id == 'veza-default':
                return jsonify({"error": "Cannot delete built-in Veza API connection"}), 400
            
            # Delete from database
            success = delete_api_connection(connection_id, user_id)
            if success:
                print(f"✅ Deleted API connection {connection_id} for user {user_id}")
                return jsonify({"message": "API connection deleted successfully"})
            else:
                return jsonify({"error": "API connection not found"}), 404
            
        except Exception as e:
            print(f"❌ Error deleting API connection: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/api-connections/upload-openapi', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_upload_openapi():
        """
        Upload OpenAPI spec to create custom API connection.
        ---
        post:
          summary: Upload OpenAPI specification
          description: Upload an OpenAPI/Swagger spec file to create a custom API connection
          tags:
            - api-connections
          security:
            - BearerAuth: []
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    openapi_file:
                      type: string
                      format: binary
                      description: OpenAPI/Swagger spec file (JSON or YAML)
                    connection_name:
                      type: string
                      description: Name for the API connection
                    description:
                      type: string
                      description: Description of the API connection
          responses:
            '201':
              description: API connection created from OpenAPI spec
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
                      connection_id:
                        type: string
                      endpoints_count:
                        type: integer
            '400':
              description: Invalid OpenAPI spec or missing data
            '401':
              description: Unauthorized
            '500':
              description: Failed to process OpenAPI spec
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            
            # Check if file was uploaded
            if 'openapi_file' not in request.files:
                return jsonify({"error": "No OpenAPI file uploaded"}), 400
            
            file = request.files['openapi_file']
            if file.filename == '':
                return jsonify({"error": "No file selected"}), 400
            
            connection_name = request.form.get('connection_name', '').strip()
            description = request.form.get('description', '').strip()
            # Optional overrides passed alongside the spec
            base_url_override = request.form.get('base_url', '').strip()
            api_token = request.form.get('api_token', '').strip()
            auth_header_name = request.form.get('auth_header_name', '').strip()
            auth_value_template = request.form.get('auth_value_template', '').strip()
            
            if not connection_name:
                return jsonify({"error": "Connection name is required"}), 400
            
            # Parse OpenAPI spec
            try:
                file_content = file.read().decode('utf-8')
                
                # Try parsing as JSON first, then YAML
                try:
                    openapi_spec = json.loads(file_content)
                except json.JSONDecodeError:
                    try:
                        openapi_spec = yaml.safe_load(file_content)
                    except yaml.YAMLError as ye:
                        return jsonify({"error": f"Invalid OpenAPI file format: {str(ye)}"}), 400
                
            except Exception as e:
                return jsonify({"error": f"Failed to read file: {str(e)}"}), 400
            
            # Validate OpenAPI spec structure
            if not isinstance(openapi_spec, dict):
                return jsonify({"error": "OpenAPI spec must be a valid JSON/YAML object"}), 400
            
            if 'openapi' not in openapi_spec and 'swagger' not in openapi_spec:
                return jsonify({"error": "File does not appear to be a valid OpenAPI/Swagger spec"}), 400
            
            # Extract information from OpenAPI spec
            connection_info = parse_openapi_spec(openapi_spec, connection_name, description)

            # Allow user-provided base_url to override any discovered value
            if base_url_override:
                connection_info['base_url'] = base_url_override
            
            # Generate unique ID
            connection_id = f"custom-{uuid.uuid4().hex[:8]}"
            
            # Inject connection configuration (auth) into spec under OpenAPI extension
            if isinstance(openapi_spec, dict) and (auth_header_name or auth_value_template):
                xconn = openapi_spec.get('x-connection') or {}
                auth_cfg = xconn.get('auth') or {}
                if auth_header_name:
                    auth_cfg['header_name'] = auth_header_name
                if auth_value_template:
                    auth_cfg['value_template'] = auth_value_template
                xconn['auth'] = auth_cfg
                openapi_spec['x-connection'] = xconn

            # Save to database (store FULL OpenAPI spec in openapi_info so clients can retrieve schemas)
            success = add_api_connection(
                connection_id=connection_id,
                user_id=user_id,
                name=connection_info['name'],
                description=connection_info['description'],
                api_type=connection_info['api_type'],
                base_url=connection_info['base_url'],
                api_token=api_token if api_token else None,
                endpoints_available=connection_info['endpoints_available'],
                openapi_info=openapi_spec
            )
            
            if not success:
                return jsonify({"error": "Failed to save API connection to database"}), 500
            
            print(f"✅ Created custom API connection from OpenAPI spec: {connection_name}")
            return jsonify({
                "message": "API connection created successfully from OpenAPI spec",
                "connection_id": connection_id,
                "endpoints_count": len(connection_info.get('endpoints_available', [])),
                "connection": {**connection_info, 'id': connection_id}
            }), 201
            
        except Exception as e:
            print(f"❌ Error processing OpenAPI upload: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/api-connections/test', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_test_connection_details():
        """
        Test API connection details by making a real HTTP call.
        ---
        post:
          summary: Test API connection details
          description: Test API connection details by making a real HTTP call to verify connectivity and authentication
          tags:
            - api-connections
          security:
            - BearerAuth: []
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    base_url:
                      type: string
                      description: Base URL for the API
                    api_token:
                      type: string
                      description: API token for authentication
                    api_type:
                      type: string
                      description: Type of API (veza, custom, etc.)
          responses:
            '200':
              description: Connection test completed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      success:
                        type: boolean
                      message:
                        type: string
                      details:
                        type: object
                        properties:
                          endpoint:
                            type: string
                          status:
                            type: string
                          response_time:
                            type: string
                          error:
                            type: string
            '401':
              description: Unauthorized
            '500':
              description: Failed to test API connection
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            
            data = request.get_json()
            base_url = data.get('base_url')
            api_token = data.get('api_token')
            api_type = data.get('api_type', 'custom')
            
            if not base_url:
                return jsonify({
                    "success": False,
                    "message": "No base URL provided",
                    "details": {
                        "endpoint": "N/A",
                        "status": "Failed",
                        "error": "Missing base URL"
                    }
                }), 200
            
            if not api_token:
                return jsonify({
                    "success": False,
                    "message": "No API token provided",
                    "details": {
                        "endpoint": base_url,
                        "status": "Failed",
                        "error": "Missing API token"
                    }
                }), 200
            
            # Determine test endpoint based on API type
            test_endpoint = None
            if api_type == 'veza':
                # For Veza API, use a simple GET endpoint that should always work
                test_endpoint = '/api/v1/providers/custom'
            else:
                # For custom APIs, try a generic health check
                test_endpoint = '/health'
            
            # Make the test request
            start_time = time.time()
            # Build auth header using provided preferences when present
            auth_header_name = data.get('auth_header_name') or 'Authorization'
            auth_value_template = data.get('auth_value_template') or 'Bearer {token}'
            headers = {
                auth_header_name: auth_value_template.replace('{token}', api_token),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            test_url = urljoin(base_url, test_endpoint)
            
            try:
                response = requests.get(
                    test_url,
                    headers=headers,
                    timeout=10,  # 10 second timeout
                    verify=True  # Verify SSL certificates
                )
                
                response_time = f"{(time.time() - start_time) * 1000:.0f}ms"
                
                if response.status_code == 200:
                    return jsonify({
                        "success": True,
                        "message": "Connection successful! API is reachable and credentials are valid.",
                        "details": {
                            "endpoint": test_url,
                            "status": "Connected",
                            "response_time": response_time,
                            "status_code": response.status_code
                        }
                    }), 200
                else:
                    return jsonify({
                        "success": False,
                        "message": f"Connection failed: HTTP {response.status_code}",
                        "details": {
                            "endpoint": test_url,
                            "status": "Failed",
                            "response_time": response_time,
                            "status_code": response.status_code,
                            "error": f"HTTP {response.status_code}: {response.text[:200]}"
                        }
                    }), 200
                    
            except requests.exceptions.Timeout:
                return jsonify({
                    "success": False,
                    "message": "Connection failed: Request timeout",
                    "details": {
                        "endpoint": test_url,
                        "status": "Failed",
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": "Request timeout after 10 seconds"
                    }
                }), 200
                
            except requests.exceptions.ConnectionError:
                return jsonify({
                    "success": False,
                    "message": "Connection failed: Unable to reach the API",
                    "details": {
                        "endpoint": test_url,
                        "status": "Failed",
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": "Connection error - check the base URL and network connectivity"
                    }
                }), 200
                
            except requests.exceptions.SSLError:
                return jsonify({
                    "success": False,
                    "message": "Connection failed: SSL certificate error",
                    "details": {
                        "endpoint": test_url,
                        "status": "Failed",
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": "SSL certificate verification failed"
                    }
                }), 200
                
            except Exception as e:
                return jsonify({
                    "success": False,
                    "message": f"Connection failed: {str(e)}",
                    "details": {
                        "endpoint": test_url,
                        "status": "Failed",
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": str(e)
                    }
                }), 200
                
        except Exception as e:
            print(f"❌ Error testing API connection details: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/api-connections/<connection_id>/test', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_test_connection(connection_id):
        """
        Test an API connection by making a real HTTP call.
        ---
        post:
          summary: Test API connection
          description: Test an API connection by making a real HTTP call to verify connectivity and authentication
          tags:
            - api-connections
          security:
            - BearerAuth: []
          parameters:
            - in: path
              name: connection_id
              required: true
              schema:
                type: string
              description: The ID of the API connection to test
          responses:
            '200':
              description: Connection test completed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      success:
                        type: boolean
                      message:
                        type: string
                      details:
                        type: object
                        properties:
                          endpoint:
                            type: string
                          status:
                            type: string
                          response_time:
                            type: string
                          error:
                            type: string
            '401':
              description: Unauthorized
            '404':
              description: API connection not found
            '500':
              description: Failed to test API connection
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            
            # Get the API connection from database
            connection = get_api_connection(connection_id, user_id)
            if not connection:
                return jsonify({"error": "API connection not found"}), 404
            
            base_url = connection.get('base_url')
            api_token = connection.get('api_token')
            api_type = connection.get('api_type')
            
            if not base_url:
                return jsonify({
                    "success": False,
                    "message": "No base URL configured for this connection",
                    "details": {
                        "endpoint": "N/A",
                        "status": "Failed",
                        "error": "Missing base URL"
                    }
                }), 200
            
            if not api_token:
                return jsonify({
                    "success": False,
                    "message": "No API token configured for this connection",
                    "details": {
                        "endpoint": base_url,
                        "status": "Failed",
                        "error": "Missing API token"
                    }
                }), 200
            
            # Determine test endpoint based on API type
            test_endpoint = None
            if api_type == 'veza':
                # For Veza API, use a simple GET endpoint that should always work
                test_endpoint = '/api/v1/providers/custom'
            else:
                # For custom APIs, try to find a suitable GET endpoint from the OpenAPI spec
                endpoints_available = connection.get('endpoints_available', [])
                if endpoints_available:
                    # Find the first GET endpoint that looks like a good test endpoint
                    for endpoint in endpoints_available:
                        if endpoint.get('method') == 'GET':
                            path = endpoint.get('path', '')
                            # Prefer endpoints that are likely to be safe to call (health, info, etc.)
                            if any(keyword in path.lower() for keyword in ['health', 'info', 'status', 'version']):
                                test_endpoint = path
                                break
                    # If no safe endpoint found, use the first GET endpoint
                    if not test_endpoint:
                        for endpoint in endpoints_available:
                            if endpoint.get('method') == 'GET':
                                test_endpoint = endpoint.get('path', '')
                                break
                
                # If no suitable endpoint found, try a generic health check
                if not test_endpoint:
                    test_endpoint = '/health'
            
            # Make the test request
            start_time = time.time()
            # Load auth config from connection openapi_info
            oi = connection.get('openapi_info') or {}
            xconn = oi.get('x-connection') if isinstance(oi, dict) else None
            auth_cfg = (xconn or {}).get('auth') or {}
            auth_header_name = auth_cfg.get('header_name', 'Authorization')
            auth_value_template = auth_cfg.get('value_template', 'Bearer {token}')
            headers = {
                auth_header_name: auth_value_template.replace('{token}', api_token),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            test_url = urljoin(base_url, test_endpoint)
            
            try:
                response = requests.get(
                    test_url,
                    headers=headers,
                    timeout=10,  # 10 second timeout
                    verify=True  # Verify SSL certificates
                )
                
                response_time = f"{(time.time() - start_time) * 1000:.0f}ms"
                
                if response.status_code == 200:
                    return jsonify({
                        "success": True,
                        "message": "Connection successful! API is reachable and credentials are valid.",
                        "details": {
                            "endpoint": test_url,
                            "status": "Connected",
                            "response_time": response_time,
                            "status_code": response.status_code
                        }
                    }), 200
                else:
                    return jsonify({
                        "success": False,
                        "message": f"Connection failed: HTTP {response.status_code}",
                        "details": {
                            "endpoint": test_url,
                            "status": "Failed",
                            "response_time": response_time,
                            "status_code": response.status_code,
                            "error": f"HTTP {response.status_code}: {response.text[:200]}"
                        }
                    }), 200
                    
            except requests.exceptions.Timeout:
                return jsonify({
                    "success": False,
                    "message": "Connection failed: Request timeout",
                    "details": {
                        "endpoint": test_url,
                        "status": "Failed",
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": "Request timeout after 10 seconds"
                    }
                }), 200
                
            except requests.exceptions.ConnectionError:
                return jsonify({
                    "success": False,
                    "message": "Connection failed: Unable to reach the API",
                    "details": {
                        "endpoint": test_url,
                        "status": "Failed",
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": "Connection error - check the base URL and network connectivity"
                    }
                }), 200
                
            except requests.exceptions.SSLError:
                return jsonify({
                    "success": False,
                    "message": "Connection failed: SSL certificate error",
                    "details": {
                        "endpoint": test_url,
                        "status": "Failed",
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": "SSL certificate verification failed"
                    }
                }), 200
                
            except Exception as e:
                return jsonify({
                    "success": False,
                    "message": f"Connection failed: {str(e)}",
                    "details": {
                        "endpoint": test_url,
                        "status": "Failed",
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": str(e)
                    }
                }), 200
                
        except Exception as e:
            print(f"❌ Error testing API connection: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/api-connections/test-endpoint', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_test_endpoint():
        """
        Test a specific API endpoint with custom request body.
        ---
        post:
          summary: Test API endpoint
          description: Test a specific API endpoint with custom request body
          tags:
            - api-connections
          security:
            - BearerAuth: []
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    connection_id:
                      type: string
                      description: ID of the API connection
                    endpoint:
                      type: string
                      description: API endpoint path to test
                    method:
                      type: string
                      description: HTTP method (GET, POST, PUT, DELETE, etc.)
                    body:
                      type: string
                      description: Request body (JSON string)
          responses:
            '200':
              description: Endpoint test completed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      success:
                        type: boolean
                      message:
                        type: string
                      details:
                        type: object
                        properties:
                          endpoint:
                            type: string
                          method:
                            type: string
                          status_code:
                            type: integer
                          response_time:
                            type: string
                          response:
                            type: object
                          error:
                            type: string
            '401':
              description: Unauthorized
            '404':
              description: API connection not found
            '500':
              description: Failed to test API endpoint
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            
            data = request.get_json()
            connection_id = data.get('connection_id')
            endpoint = data.get('endpoint')
            method = data.get('method', 'GET')
            request_body = data.get('body')
            
            if not connection_id:
                return jsonify({"error": "Connection ID is required"}), 400
            
            if not endpoint:
                return jsonify({"error": "Endpoint is required"}), 400
            
            # Get the API connection from database
            connection = get_api_connection(connection_id, user_id)
            if not connection:
                return jsonify({"error": "API connection not found"}), 404
            
            base_url = connection.get('base_url')
            api_token = connection.get('api_token')
            
            if not base_url:
                return jsonify({
                    "success": False,
                    "message": "No base URL configured for this connection",
                    "details": {
                        "endpoint": endpoint,
                        "method": method,
                        "status_code": None,
                        "response_time": "0ms",
                        "error": "Missing base URL"
                    }
                }), 200
            
            if not api_token:
                return jsonify({
                    "success": False,
                    "message": "No API token configured for this connection",
                    "details": {
                        "endpoint": endpoint,
                        "method": method,
                        "status_code": None,
                        "response_time": "0ms",
                        "error": "Missing API token"
                    }
                }), 200
            
            # Prepare headers using connection's auth config
            oi = connection.get('openapi_info') or {}
            xconn = oi.get('x-connection') if isinstance(oi, dict) else None
            auth_cfg = (xconn or {}).get('auth') or {}
            auth_header_name = auth_cfg.get('header_name', 'Authorization')
            auth_value_template = auth_cfg.get('value_template', 'Bearer {token}')
            headers = {
                auth_header_name: auth_value_template.replace('{token}', api_token),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            # Prepare request data
            request_data = None
            if request_body and method.upper() in ['POST', 'PUT', 'PATCH']:
                try:
                    request_data = json.loads(request_body)
                except json.JSONDecodeError:
                    return jsonify({
                        "success": False,
                        "message": "Invalid JSON in request body",
                        "details": {
                            "endpoint": endpoint,
                            "method": method,
                            "status_code": None,
                            "response_time": "0ms",
                            "error": "Invalid JSON format"
                        }
                    }), 200
            
            # Make the test request
            start_time = time.time()
            test_url = urljoin(base_url, endpoint)
            
            try:
                if method.upper() == 'GET':
                    response = requests.get(
                        test_url,
                        headers=headers,
                        timeout=30,
                        verify=True
                    )
                elif method.upper() == 'POST':
                    response = requests.post(
                        test_url,
                        headers=headers,
                        json=request_data,
                        timeout=30,
                        verify=True
                    )
                elif method.upper() == 'PUT':
                    response = requests.put(
                        test_url,
                        headers=headers,
                        json=request_data,
                        timeout=30,
                        verify=True
                    )
                elif method.upper() == 'DELETE':
                    response = requests.delete(
                        test_url,
                        headers=headers,
                        timeout=30,
                        verify=True
                    )
                elif method.upper() == 'PATCH':
                    response = requests.patch(
                        test_url,
                        headers=headers,
                        json=request_data,
                        timeout=30,
                        verify=True
                    )
                else:
                    return jsonify({
                        "success": False,
                        "message": f"Unsupported HTTP method: {method}",
                        "details": {
                            "endpoint": endpoint,
                            "method": method,
                            "status_code": None,
                            "response_time": "0ms",
                            "error": f"Method {method} not supported"
                        }
                    }), 200
                
                response_time = f"{(time.time() - start_time) * 1000:.0f}ms"
                
                # Parse response
                response_data = None
                try:
                    if response.headers.get('content-type', '').startswith('application/json'):
                        response_data = response.json()
                    else:
                        response_data = response.text
                except:
                    response_data = response.text
                
                if 200 <= response.status_code < 300:
                    return jsonify({
                        "success": True,
                        "message": f"API call successful (HTTP {response.status_code})",
                        "details": {
                            "endpoint": test_url,
                            "method": method,
                            "status_code": response.status_code,
                            "response_time": response_time,
                            "response": response_data
                        }
                    }), 200
                else:
                    return jsonify({
                        "success": False,
                        "message": f"API call failed (HTTP {response.status_code})",
                        "details": {
                            "endpoint": test_url,
                            "method": method,
                            "status_code": response.status_code,
                            "response_time": response_time,
                            "response": response_data,
                            "error": f"HTTP {response.status_code}: {response.text[:200]}"
                        }
                    }), 200
                    
            except requests.exceptions.Timeout:
                return jsonify({
                    "success": False,
                    "message": "Request timeout",
                    "details": {
                        "endpoint": test_url,
                        "method": method,
                        "status_code": None,
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": "Request timeout after 30 seconds"
                    }
                }), 200
                
            except requests.exceptions.ConnectionError:
                return jsonify({
                    "success": False,
                    "message": "Connection error",
                    "details": {
                        "endpoint": test_url,
                        "method": method,
                        "status_code": None,
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": "Connection error - check the base URL and network connectivity"
                    }
                }), 200
                
            except requests.exceptions.SSLError:
                return jsonify({
                    "success": False,
                    "message": "SSL certificate error",
                    "details": {
                        "endpoint": test_url,
                        "method": method,
                        "status_code": None,
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": "SSL certificate verification failed"
                    }
                }), 200
                
            except Exception as e:
                return jsonify({
                    "success": False,
                    "message": f"Request failed: {str(e)}",
                    "details": {
                        "endpoint": test_url,
                        "method": method,
                        "status_code": None,
                        "response_time": f"{(time.time() - start_time) * 1000:.0f}ms",
                        "error": str(e)
                    }
                }), 200
                
        except Exception as e:
            print(f"❌ Error testing API endpoint: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/api-connections/<connection_id>/openapi', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_connection_openapi(connection_id):
        """Return the saved OpenAPI spec (JSON or YAML) for a specific connection.
        If the connection is of type 'veza' and no full spec is stored, fall back to bundled Veza spec.
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                return jsonify({"error": "User not authenticated"}), 401

            connection = get_api_connection(connection_id, user_id)
            if not connection:
                return jsonify({"error": "Connection not found"}), 404

            openapi_info = connection.get('openapi_info')
            if isinstance(openapi_info, dict) and ('openapi' in openapi_info or 'swagger' in openapi_info):
                # Return JSON spec
                return jsonify(openapi_info)

            # If Veza and no full spec stored, serve bundled YAML
            if connection.get('api_type') == 'veza':
                veza_spec = load_veza_openapi_spec()
                if not veza_spec:
                    return jsonify({"error": "Failed to load Veza OpenAPI specification"}), 500
                import yaml as _yaml
                yaml_content = _yaml.dump(veza_spec, default_flow_style=False, allow_unicode=True)
                return yaml_content, 200, {'Content-Type': 'text/yaml'}

            return jsonify({"error": "No OpenAPI spec available for this connection"}), 404
        except Exception as e:
            print(f"❌ Error serving connection OpenAPI spec: {str(e)}")
            return jsonify({"error": str(e)}), 500


def load_veza_openapi_spec():
    """Load and parse the Veza OpenAPI specification"""
    veza_openapi_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'veza_openapi.yaml')
    
    try:
        with open(veza_openapi_file, 'r', encoding='utf-8') as f:
            veza_spec = yaml.safe_load(f)
        return veza_spec
    except Exception as e:
        logging.error(f"Failed to load Veza OpenAPI spec: {e}")
        return None

def load_okta_openapi_spec():
    """Load Okta Management OpenAPI specification from folder"""
    try:
        okta_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'okta_openapi')
        spec_path = os.path.join(okta_dir, 'management-oneOfInheritance.yaml')
        with open(spec_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        logging.error(f"Failed to load Okta OpenAPI spec from management-oneOfInheritance.yaml: {e}")
        return None

def parse_openapi_spec(spec, name, description):
    """Parse OpenAPI specification and extract connection information"""
    
    # Extract base URL
    base_url = "https://api.example.com"  # Default fallback
    
    if 'servers' in spec and spec['servers']:
        # OpenAPI 3.x format
        base_url = spec['servers'][0].get('url', base_url)
    elif 'host' in spec:
        # Swagger 2.x format
        scheme = spec.get('schemes', ['https'])[0]
        base_path = spec.get('basePath', '')
        base_url = f"{scheme}://{spec['host']}{base_path}"
    
    # Extract API info
    info = spec.get('info', {})
    api_title = info.get('title', name)
    api_version = info.get('version', '1.0.0')
    api_description = description or info.get('description', f'Custom API: {api_title}')
    
    # Extract endpoints
    paths = spec.get('paths', {})
    endpoints_available = []
    
    for path, methods in paths.items():
        if isinstance(methods, dict):
            for method, details in methods.items():
                if method.upper() in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
                    endpoint_desc = ""
                    if isinstance(details, dict):
                        endpoint_desc = details.get('summary', details.get('description', ''))
                        # Limit description length for better UI
                        if endpoint_desc and len(endpoint_desc) > 80:
                            endpoint_desc = endpoint_desc[:77] + "..."
                    
                    # Create endpoint object with structured data
                    endpoint = {
                        "path": path,
                        "method": method.upper(),
                        "summary": endpoint_desc  # Use 'summary' to match frontend expectations
                    }
                    endpoints_available.append(endpoint)
    
    return {
        'name': name,
        'api_type': 'custom',
        'base_url': base_url,
        'description': api_description,
        'status': 'configured',
        'openapi_info': {
            'title': api_title,
            'version': api_version,
            'spec_version': spec.get('openapi', spec.get('swagger', 'unknown'))
        },
        'endpoints_available': sorted(endpoints_available, key=lambda x: f"{x['method']} {x['path']}")
    }