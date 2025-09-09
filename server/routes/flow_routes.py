import logging
import json
import time
import threading
import subprocess
import tempfile
import os
import csv
import requests
import pandas as pd
import math
from flask import request, session, jsonify
from flask_socketio import emit
from services.auth import requires_auth, requires_rbac
from services.database import (
    get_user_files, get_storage_items, get_transforms, 
    get_analytics, get_api_connection, update_storage_item
)
from services.data_router import get_node_input_data, get_trigger_inputs, get_visual_inputs
from services.scheduler import init_scheduler
from apscheduler.triggers.interval import IntervalTrigger

def setup_flow_routes(app, socketio):
    """Setup flow execution routes"""
    
    @app.route('/api/flows/execute', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_execute_flow():
        """Execute a study flow"""
        print("🎯 POST /api/flows/execute - Flow execution request")
        
        try:
            # Use email as primary user id; also capture subject for cross-compat
            user_info = session.get('user', {})
            if not user_info or not user_info.get('email'):
                print("❌ No user email found in session")
                return jsonify({"error": "User not authenticated"}), 401
            
            user_email = user_info['email']
            user_sub = user_info.get('sub')
            flow_data = request.json.get('flow', {})
            
            print(f"👤 User ID (email): {user_email}")
            print(f"🔄 Flow data: {json.dumps(flow_data, indent=2)}")
            
            # Start flow execution in background thread
            execution_thread = threading.Thread(
                target=execute_flow_background,
                args=(flow_data, user_email, user_sub, socketio)
            )
            execution_thread.daemon = True
            execution_thread.start()
            
            return jsonify({
                "status": "success", 
                "message": "Flow execution started",
                "execution_id": f"flow_{int(time.time())}"
            })
            
        except Exception as e:
            print(f"❌ Error starting flow execution: {str(e)}")
            return jsonify({
                "status": "error", 
                "message": f"Failed to start flow execution: {str(e)}"
            }), 500

    # =============================
    # Flow Monitors (MGQL-based)
    # =============================
    MONITORS = {}

    @app.route('/api/flows/monitors', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_create_flow_monitor():
        """
        Create a MGQL-based graph monitor that triggers a flow when condition matches.
        Payload: { flow, trigger_node_id, monitor: { storage_id, mgql, interval_seconds } }
        """
        try:
            user_info = session.get('user', {})
            if not user_info or not user_info.get('email'):
                return jsonify({"error": "User not authenticated"}), 401
            user_email = user_info['email']
            user_sub = user_info.get('sub')

            body = request.get_json() or {}
            flow_data = body.get('flow') or {}
            trigger_node_id = body.get('trigger_node_id')
            monitor = body.get('monitor') or {}
            storage_id = monitor.get('storage_id')
            mgql = (monitor.get('mgql') or '').strip()
            interval_seconds = int(monitor.get('interval_seconds') or 60)

            if not mgql:
                return jsonify({"error": "mgql is required"}), 400

            init_scheduler()
            monitor_id = f"mon_{int(time.time())}_{abs(hash(mgql)) % 10000}"

            # Store monitor metadata in-memory for MVP
            MONITORS[monitor_id] = {
                'user_email': user_email,
                'user_sub': user_sub,
                'flow': flow_data,
                'trigger_node_id': trigger_node_id,
                'storage_id': storage_id,
                'mgql': mgql,
                'interval_seconds': interval_seconds,
                'last_count': None,
            }

            from routes.graph_routes import translate_mgql_to_cypher
            def _tick():
                try:
                    cyph, params = translate_mgql_to_cypher(mgql)
                    rows = []
                    try:
                        rows = cypher_query(cyph, params)
                    except Exception as qe:
                        print(f"⚠️ Monitor query failed: {qe}")
                        return
                    count = len(rows or [])
                    prev = MONITORS.get(monitor_id, {}).get('last_count')
                    MONITORS[monitor_id]['last_count'] = count
                    # Simple condition: fire when count > 0 and changed since last
                    if count > 0 and count != prev:
                        try:
                            execute_flow_background(flow_data, user_email, user_sub, socketio)
                            print(f"🚨 Monitor fired: {monitor_id} (count={count})")
                        except Exception as fe:
                            print(f"❌ Monitor flow execution failed: {fe}")
                except Exception as e:
                    print(f"❌ Monitor tick error: {e}")

            sched = init_scheduler()
            sched.add_job(
                func=_tick,
                trigger=IntervalTrigger(seconds=interval_seconds),
                id=monitor_id,
                name=f"MGQL Monitor: {monitor_id}",
                replace_existing=True
            )

            return jsonify({"status": "success", "monitor_id": monitor_id})
        except Exception as e:
            print(f"❌ Failed to create flow monitor: {e}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/flows/monitors/<monitor_id>', methods=['DELETE'])
    @requires_auth
    @requires_rbac
    def api_delete_flow_monitor(monitor_id):
        try:
            sched = init_scheduler()
            try:
                sched.remove_job(monitor_id)
            except Exception:
                pass
            MONITORS.pop(monitor_id, None)
            return jsonify({"status": "success"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

def execute_flow_background(flow_data, user_email, user_sub, socketio):
    """Execute flow in background thread with real-time status updates"""
    try:
        print("🚀 Starting background flow execution...")
        
        nodes = flow_data.get('nodes', [])
        edges = flow_data.get('edges', [])
        
        if not nodes:
            emit_status(socketio, user_id, 'error', 'No nodes found in flow')
            return
            
        # Build execution graph
        execution_order = build_execution_order(nodes, edges)
        print(f"📋 Execution order: {[node['id'] for node in execution_order]}")
        
        # Execute nodes in order
        flow_context = {}  # Store data between nodes
        
        for node in execution_order:
            node_id = node['id']
            node_type = node['type']
            node_config = node.get('data', {}).get('config', {})
            
            print(f"⚡ Executing node {node_id} ({node_type})")
            
            # Emit node start status
            emit_node_status(socketio, user_email, node_id, 'running', f'Executing {node_type} node...')
            
            try:
                # Execute node based on type
                # Pass both identifiers so downstream can fall back if needed
                result = execute_node(node_id, node_type, node_config, flow_context, user_email, user_sub)
                
                # Store result in context for next nodes
                flow_context[node_id] = result
                
                # Emit frontend events if present
                if isinstance(result, dict):
                    # Check for frontend events in experiment results
                    if result.get('frontend_event'):
                        print(f"📡 Emitting frontend event for experiment: {node_id}")
                        socketio.emit('experiment_frontend', result['frontend_event'], room=user_id)
                    
                    
                
                # Emit success status
                emit_node_status(socketio, user_email, node_id, 'success', f'{node_type} completed successfully')
                
                # Small delay for visual feedback
                time.sleep(0.5)
                
            except Exception as e:
                error_msg = f'{node_type} failed: {str(e)}'
                print(f"❌ Node {node_id} error: {error_msg}")
                
                # Emit error status
                emit_node_status(socketio, user_email, node_id, 'error', error_msg)
                
                # Abort flow on error
                emit_status(socketio, user_email, 'error', f'Flow aborted: {error_msg}')
                return
        
        # Flow completed successfully
        emit_status(socketio, user_email, 'success', 'Flow execution completed successfully!')
        
    except Exception as e:
        print(f"❌ Background flow execution error: {str(e)}")
        emit_status(socketio, user_email, 'error', f'Flow execution failed: {str(e)}')

def build_execution_order(nodes, edges):
    """Build execution order based on edges (connections)"""
    # For now, simple implementation - execute nodes in order they appear
    # TODO: Implement proper topological sorting based on edges
    return nodes

def execute_node(node_id, node_type, config, context, user_email, user_sub=None):
    """Execute a single node based on its type"""
    print(f"🔧 Executing {node_type} node {node_id} with config: {config}")
    
    if node_type == 'file':
        return execute_file_node(node_id, config, context, user_email)
    elif node_type == 'api':
        # Pass both user identifiers so API node can reliably look up connections
        return execute_api_node(node_id, config, context, user_email, user_sub)
    elif node_type == 'storage':
        return execute_storage_node(node_id, config, context, user_email, user_sub)
    elif node_type == 'transform':
        return execute_transform_node(node_id, config, context, user_email, user_sub)
    elif node_type == 'analytics':
        return execute_analytics_node(node_id, config, context, user_email)
    elif node_type == 'flow_trigger':
        return execute_flow_trigger_node(node_id, config, context, user_email)
    elif node_type == 'ai_tools':
        return execute_ai_tools_node(node_id, config, context, user_email)
    elif node_type == 'visual_preview':
        return execute_visual_preview_node(node_id, config, context, user_email)
    elif node_type == 'plugins':
        return execute_plugins_node(node_id, config, context, user_email, user_sub)

    else:
        raise Exception(f"Unknown node type: {node_type}")

def execute_file_node(node_id, config, context, user_id):
    """Execute file node - load CSV/JSON data from uploaded files"""
    print(f"📁 Executing file node: {node_id}")
    print(f"🔍 Config: {config}")
    
    file_id = config.get('file_id')  # Changed from 'id' to 'file_id' to match frontend
    file_name = config.get('file_name')
    file_type = config.get('file_type', 'csv').lower()
    
    print(f"🔍 Looking for file - ID: {file_id}, Name: {file_name}, Type: {file_type}")
    
    # Get user files from database
    user_files = get_user_files(user_id)
    print(f"📋 Available files for user {user_id}:")
    for f in user_files:
        print(f"   - ID: {f['id']}, Name: '{f['file_name']}', Path: '{f['file_path']}'")
    
    file_obj = None
    
    if file_id:
        # Look up by file ID in database (most reliable)
        file_obj = next((f for f in user_files if f['id'] == file_id), None)
        if file_obj:
            print(f"📄 Found file by ID {file_id}: {file_obj['file_name']}")
        else:
            print(f"❌ No file found with ID {file_id}")
            print(f"📋 Available file IDs: {[f['id'] for f in user_files]}")
    
    if not file_obj and file_name:
        # Look up by original file name in database
        print(f"🔍 Searching for file with name: '{file_name}'")
        for f in user_files:
            print(f"   Comparing '{f['file_name']}' with '{file_name}'")
            if f['file_name'] == file_name:
                file_obj = f
                break
        
        if file_obj:
            print(f"📄 Found file by name '{file_name}': {file_obj['file_name']} (path: {file_obj['file_path']})")
        else:
            print(f"❌ No file found in database with name '{file_name}'")
            print(f"📋 Available file names: {[f['file_name'] for f in user_files]}")
    
    if not file_obj:
        # Provide a helpful error message with available files
        available_files = []
        for f in user_files:
            available_files.append({
                'id': f['id'],
                'name': f['file_name'],
                'type': f['file_type']
            })
        
        error_msg = f"File not found - ID: {file_id}, Name: {file_name}\n"
        error_msg += f"Available files for user {user_id}:\n"
        for f in available_files:
            error_msg += f"  - ID: {f['id']}, Name: '{f['name']}', Type: {f['type']}\n"
        
        raise Exception(error_msg)
    
    # Use the actual file_path from the database (which includes the timestamped filename)
    file_path = file_obj.get('file_path')
    
    if not file_path:
        # Fallback: construct path from file_name (for backward compatibility)
        file_path = f"data/uploads/{file_obj['file_name']}"
    
    print(f"🔍 Final file path: {file_path}")
    print(f"🔍 File exists: {os.path.exists(file_path)}")
    
    if not os.path.exists(file_path):
        raise Exception(f"File does not exist on filesystem: {file_path}")
    
    print(f"📖 Loading file: {file_path}")
    
    try:
        if file_type == 'csv':
            # Load CSV data using pandas for better handling
            df = pd.read_csv(file_path)
            data = df.to_dict('records')  # Convert to list of dictionaries
            
            return {
                'status': 'success',
                'data': data,
                'file_info': {
                    'name': file_obj['file_name'],
                    'type': file_type,
                    'records': len(data),
                    'columns': list(df.columns) if not df.empty else []
                },
                'message': f'Loaded {len(data)} records from {file_obj["file_name"]}'
            }
        elif file_type == 'json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            record_count = len(data) if isinstance(data, list) else 1
            
            return {
                'status': 'success',
                'data': data,
                'file_info': {
                    'name': file_obj['file_name'],
                    'type': file_type,
                    'records': record_count
                },
                'message': f'Loaded {record_count} records from {file_obj["file_name"]}'
            }
        else:
            raise Exception(f"Unsupported file type: {file_type}")
            
    except Exception as e:
        raise Exception(f"Failed to load file {file_obj['file_name']}: {str(e)}")

def execute_api_node(node_id, config, context, user_id, user_sub=None):
    """Execute API node - make HTTP requests to external APIs (including Veza)"""
    print(f"🌐 Executing API node: {node_id}")
    
    api_type = config.get('api_type', 'rest')
    method = config.get('method', 'GET').upper()
    endpoint = config.get('endpoint', '')
    api_name = config.get('api_name', 'API')
    # Accept both 'connection_id' (legacy) and 'api_connection_id' (current frontend)
    api_connection_id = config.get('connection_id') or config.get('api_connection_id')
    parameters = config.get('parameters', {})
    
    # Get input data from previous nodes
    input_data = None
    for ctx_key, ctx_value in context.items():
        if isinstance(ctx_value, dict) and 'data' in ctx_value:
            input_data = ctx_value['data']
            break
    
    # Determine base URL from configuration
    base_url = config.get('base_url')
    
    if not base_url and api_connection_id:
        # Try to get base URL from API connection
        try:
            # Look up API connection from database (use provided user_sub when available)
            lookup_user_id = user_sub or session.get('user', {}).get('sub') or user_id
            if not lookup_user_id:
                print("❌ No user_id found for API connection lookup")
                return None
            connection = get_api_connection(api_connection_id, lookup_user_id)
            if connection:
                base_url = connection['base_url']
                print(f"🔗 Found API connection '{connection['name']}' with base URL: {base_url}")
            else:
                print(f"⚠️ API connection {api_connection_id} not found for user {lookup_user_id}")
        except Exception as e:
            print(f"⚠️ Could not retrieve API connection {api_connection_id}: {e}")
    
    if not base_url:
        # Fall back to environment variables and defaults based on API type
        if api_type == 'veza':
            base_url = os.environ.get('VEZA_API_URL', 'https://api.vezacorp.com')
        else:
            base_url = os.environ.get('API_BASE_URL') or config.get('base_url', 'https://api.example.com')
    
    print(f"🔗 Using base URL: {base_url} (api_type: {api_type})")
    
    # Process parameter mappings
    def resolve_parameter_value(param_config, input_data):
        """Resolve parameter value based on mapping configuration"""
        if not param_config:
            return None
            
        mapping_type = param_config.get('mappingType')
        
        if mapping_type == 'static':
            return param_config.get('value')
        elif mapping_type == 'field':
            source_path = param_config.get('source')
            if source_path and input_data:
                # Parse source path like "nodeName.fieldName"
                parts = source_path.split('.')
                if len(parts) >= 2:
                    field_name = parts[-1]
                    # Navigate through the data structure
                    current_data = input_data
                    for part in parts[:-1]:
                        if isinstance(current_data, dict) and part in current_data:
                            current_data = current_data[part]
                        else:
                            return None
                    
                    if isinstance(current_data, dict) and field_name in current_data:
                        return current_data[field_name]
                    elif isinstance(current_data, list) and len(current_data) > 0:
                        # For list data, try to get field from first item
                        first_item = current_data[0]
                        if isinstance(first_item, dict) and field_name in first_item:
                            return first_item[field_name]
            return None
        elif mapping_type == 'expression':
            expression = param_config.get('expression')
            if expression and input_data:
                try:
                    # Create a safe evaluation context
                    context = {
                        'row': input_data if isinstance(input_data, dict) else (input_data[0] if input_data and len(input_data) > 0 else {}),
                        'data': input_data,
                        'Math': math,
                        'String': str,
                        'Number': float,
                        'Boolean': bool
                    }
                    # Use eval with restricted globals and locals
                    return eval(expression, {"__builtins__": {}}, context)
                except Exception as e:
                    print(f"⚠️ Error evaluating expression '{expression}': {e}")
                    return None
        return None
    
    # Process body mappings (from AttributeMapper)
    def resolve_body_mappings(body_mappings, input_data):
        """Resolve body mappings using AttributeMapper-style configuration with enhanced Veza OAA support"""
        if not body_mappings or not input_data:
            return {}
        
        resolved_body = {}
        
        for output_field, mapping_config in body_mappings.items():
            if not mapping_config:
                continue
                
            mapping_type = mapping_config.get('type')
            
            if mapping_type == 'direct':
                source_field = mapping_config.get('source')
                if source_field and input_data:
                    # Handle single field mapping
                    if isinstance(input_data, list) and len(input_data) > 0:
                        resolved_body[output_field] = input_data[0].get(source_field)
                    else:
                        resolved_body[output_field] = input_data.get(source_field)
                        
            elif mapping_type == 'constant':
                resolved_body[output_field] = mapping_config.get('value')
                
            elif mapping_type == 'expression':
                expression = mapping_config.get('expression')
                if expression and input_data:
                    try:
                        # Create evaluation context
                        context = {
                            'row': input_data if isinstance(input_data, dict) else (input_data[0] if input_data and len(input_data) > 0 else {}),
                            'data': input_data,
                            'Math': math,
                            'String': str,
                            'Number': float,
                            'Boolean': bool
                        }
                        resolved_body[output_field] = eval(expression, {"__builtins__": {}}, context)
                    except Exception as e:
                        print(f"⚠️ Error evaluating body mapping expression '{expression}': {e}")
                        resolved_body[output_field] = None
                        
            elif mapping_type == 'full_data':
                # Special mapping for Veza OAA - use the entire transformed data
                if isinstance(input_data, dict) and 'data' in input_data:
                    # If input_data has a 'data' key (from transform), use that
                    resolved_body[output_field] = input_data['data']
                else:
                    # Otherwise use the entire input_data
                    resolved_body[output_field] = input_data
                    
            elif mapping_type == 'veza_oaa_format':
                # Special mapping for Veza OAA API format
                if isinstance(input_data, dict) and 'data' in input_data:
                    # Transform data is in input_data['data']
                    transformed_data = input_data['data']
                    if isinstance(transformed_data, list):
                        # Format for Veza OAA datasource creation
                        resolved_body[output_field] = {
                            'entities': transformed_data,
                            'metadata': input_data.get('metadata', {}),
                            'total_records': len(transformed_data)
                        }
                    else:
                        resolved_body[output_field] = transformed_data
                else:
                    # Fall back to using input_data directly
                    resolved_body[output_field] = input_data
        
        return resolved_body
    
    # Build URL with path parameters
    url_path = endpoint
    path_params = {}
    query_params = {}
    body_params = {}
    
    for param_name, param_config in parameters.items():
        if not param_config or not param_config.get('mappingType'):
            continue
            
        param_value = resolve_parameter_value(param_config, input_data)
        if param_value is not None:
            # Determine parameter location (this would come from OpenAPI spec)
            # For now, assume path parameters are in curly braces in the URL
            if f"{{{param_name}}}" in url_path:
                path_params[param_name] = str(param_value)
            elif method in ['GET', 'DELETE']:
                query_params[param_name] = param_value
            else:
                body_params[param_name] = param_value
    
    # Replace path parameters in URL
    for param_name, param_value in path_params.items():
        url_path = url_path.replace(f"{{{param_name}}}", str(param_value))
    
    # Build full URL
    full_url = f"{base_url}{url_path}"
    
    # Add query parameters for GET/DELETE requests
    if query_params and method in ['GET', 'DELETE']:
        query_string = '&'.join([f"{k}={v}" for k, v in query_params.items()])
        full_url = f"{full_url}?{query_string}"
    
    # Prepare request payload
    request_payload = None
    if method in ['POST', 'PUT', 'PATCH']:
        # First try body mappings (from AttributeMapper)
        body_mappings = config.get('body_mappings', {})
        if body_mappings:
            request_payload = resolve_body_mappings(body_mappings, input_data)
            print(f"📦 Using body mappings: {list(body_mappings.keys())}")
        elif body_params:
            request_payload = body_params
            print(f"📦 Using legacy body parameters: {list(body_params.keys())}")
        elif input_data:
            # Fall back to input data if no specific body parameters mapped
            request_payload = input_data
            print(f"📦 Using full input data as request body")
    
    # Prepare headers for the request
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'MindGarden-Platform/1.0'
    }
    
    # Add authentication headers from selected API connection when available
    if api_connection_id:
        try:
            session_user_id = user_sub or session.get('user', {}).get('sub') or user_id
            if session_user_id:
                connection = get_api_connection(api_connection_id, session_user_id)
                if connection and connection.get('api_token'):
                    # Resolve auth config if present
                    openapi_info = connection.get('openapi_info') or {}
                    xconn = openapi_info.get('x-connection') if isinstance(openapi_info, dict) else None
                    auth_cfg = (xconn or {}).get('auth') or {}
                    auth_header_name = auth_cfg.get('header_name', 'Authorization')
                    auth_value_template = auth_cfg.get('value_template', 'Bearer {token}')
                    headers[auth_header_name] = auth_value_template.replace('{token}', connection['api_token'])
                    print(f"🔑 Using API token with header '{auth_header_name}' from connection '{connection['name']}'")
                else:
                    print("⚠️ Warning: No API token found in API connection")
            else:
                print("⚠️ Warning: No session user_id found for API connection lookup")
        except Exception as e:
            print(f"⚠️ Warning: Could not retrieve API token from connection: {e}")
    
    # Add custom headers from config if specified
    custom_headers = config.get('headers', {})
    headers.update(custom_headers)
    
    # Calculate record count for logging
    record_count = 0
    if isinstance(input_data, list):
        record_count = len(input_data)
    elif isinstance(input_data, dict):
        record_count = input_data.get('entities', []) if 'entities' in input_data else 1
    elif input_data:
        record_count = 1
    
    print(f"🚀 Making API call: {method} {full_url}")
    if request_payload:
        print(f"📊 Payload preview: {json.dumps(request_payload, indent=2)[:500]}...")
    if path_params:
        print(f"📍 Path parameters: {path_params}")
    if query_params:
        print(f"🔍 Query parameters: {query_params}")
    print(f"🔑 Headers: {list(headers.keys())}")
    
    try:
        # Make the actual HTTP request
        if method == 'GET':
            response = requests.get(full_url, headers=headers, timeout=30)
        elif method == 'POST':
            response = requests.post(full_url, headers=headers, json=request_payload, timeout=30)
        elif method == 'PUT':
            response = requests.put(full_url, headers=headers, json=request_payload, timeout=30)
        elif method == 'PATCH':
            response = requests.patch(full_url, headers=headers, json=request_payload, timeout=30)
        elif method == 'DELETE':
            response = requests.delete(full_url, headers=headers, timeout=30)
        else:
            raise Exception(f"Unsupported HTTP method: {method}")
        
        print(f"📡 Response status: {response.status_code}")
        print(f"📡 Response headers: {dict(response.headers)}")
        
        # Parse response
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {'text': response.text}
        
        # Check for HTTP errors
        response.raise_for_status()
        
        print(f"✅ API call successful: {response.status_code}")
        
        return {
            'status': 'success',
            # Expose response JSON at top-level for downstream nodes (transform/storage)
            'data': response_data,
            'response': {
                'status_code': response.status_code,
                'data': response_data,
                'headers': dict(response.headers),
                'records_processed': record_count,
                'endpoint': url_path,
                'method': method,
                'url': full_url,
                'parameters_used': {
                    'path': path_params,
                    'query': query_params,
                    'body': body_params,
                    'body_mappings': config.get('body_mappings', {})
                }
            },
            'api_info': {
                'name': api_name,
                'type': api_type,
                'endpoint': url_path,
                'method': method,
                'base_url': base_url,
                'full_url': full_url
            },
            'message': f'Successfully called {api_name} API ({record_count} records processed)'
        }
        
    except requests.exceptions.Timeout:
        error_msg = f"API call timed out after 30 seconds: {method} {full_url}"
        print(f"❌ {error_msg}")
        raise Exception(error_msg)
        
    except requests.exceptions.ConnectionError as e:
        error_msg = f"Connection error for API call: {method} {full_url} - {str(e)}"
        print(f"❌ {error_msg}")
        raise Exception(error_msg)
        
    except requests.exceptions.HTTPError as e:
        error_msg = f"HTTP error {response.status_code} for API call: {method} {full_url}"
        print(f"❌ {error_msg}")
        print(f"📡 Response: {response.text}")
        raise Exception(error_msg)
        
    except Exception as e:
        error_msg = f"Unexpected error during API call: {method} {full_url} - {str(e)}"
        print(f"❌ {error_msg}")
        raise Exception(error_msg)

def execute_storage_node(node_id, config, context, user_email, user_sub=None):
    """Execute storage node - store or retrieve data"""
    # Accept both 'id' and 'storage_id' from frontend
    storage_id = config.get('storage_id')
    if not storage_id:
        raise Exception("No storage connection selected")
    
    # Get storage details
    storage_items = get_storage_items(user_email)
    used_user_id = user_email
    # Fallback: some storage items may have been saved under the Auth0 subject instead of email
    if not storage_items:
        alt_user_id = user_sub
        if alt_user_id and alt_user_id != user_email:
            print(f"🔁 No storage for {user_email}; retrying with subject {alt_user_id}")
            storage_items = get_storage_items(alt_user_id)
            used_user_id = alt_user_id
    storage = next((s for s in storage_items if s['id'] == storage_id), None)
    
    if not storage:
        raise Exception(f"Storage connection {storage_id} not found")
    
    storage_name = storage.get('file_name') or config.get('storage_name', f"storage_{storage_id}")
    storage_type = storage.get('file_type') or config.get('storage_type', 'data')
    print(f"💾 Using storage: {storage_name} ({storage_type})")
    
    # Check if we have data to store from previous nodes
    data_to_store = None
    for ctx_key, ctx_value in context.items():
        if isinstance(ctx_value, dict) and 'data' in ctx_value:
            data_to_store = ctx_value
            break
    
    if data_to_store:
        # Store data
        print(f"📝 Storing data to {storage_name}")
        
        # Get storage mappings if configured
        storage_mappings = config.get('storage_mappings', {})
        
        # Create output directory if it doesn't exist
        output_dir = 'data/outputs'
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate filename based on storage name and timestamp
        timestamp = int(time.time())
        filename = f"{storage_name.lower().replace(' ', '_')}_{timestamp}"
        
        try:
            data_saved_for_db = None
            if storage_type == 'blob_storage':
                # Store as JSON file (simulating blob storage)
                output_file = f"{output_dir}/{filename}.json"
                
                # Apply storage mappings if configured
                if storage_mappings and isinstance(data_to_store.get('data'), list):
                    mapped_data = []
                    for record in data_to_store['data']:
                        mapped_record = {}
                        for output_field, mapping_config in storage_mappings.items():
                            if mapping_config and mapping_config.get('type') == 'direct':
                                source_field = mapping_config.get('source')
                                if source_field and source_field in record:
                                    mapped_record[output_field] = record[source_field]
                        if mapped_record:
                            mapped_data.append(mapped_record)
                    
                    # Store mapped data
                    with open(output_file, 'w', encoding='utf-8') as f:
                        json.dump({
                            'storage_name': storage_name,
                            'timestamp': timestamp,
                            'data': mapped_data,
                            'total_records': len(mapped_data)
                        }, f, indent=2, default=str)
                    data_saved_for_db = mapped_data
                else:
                    # Store full data
                    with open(output_file, 'w', encoding='utf-8') as f:
                        json.dump({
                            'storage_name': storage_name,
                            'timestamp': timestamp,
                            'data': data_to_store
                        }, f, indent=2, default=str)
                    # Prefer storing just the payload if present
                    data_saved_for_db = data_to_store.get('data', data_to_store)
                
                print(f"✅ Data stored to: {output_file}")

                # Update storage record so StorageDataViewer reflects latest write
                try:
                    existing_details = {}
                    try:
                        existing_details = json.loads(storage.get('file_path') or '{}')
                    except Exception:
                        existing_details = {}
                    existing_details['description'] = existing_details.get('description', storage_name)
                    existing_details['data'] = data_saved_for_db
                    existing_details['created_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(timestamp))
                    update_storage_item(
                        storage_id,
                        used_user_id,
                        storage_name,
                        storage_type,
                        len(json.dumps(existing_details.get('data', ''))),
                        json.dumps(existing_details)
                    )
                except Exception as e:
                    print(f"⚠️ Could not update storage record with latest data: {e}")
                
                return {
                    'type': 'storage_write',
                    'storage_id': storage_id,
                    'data_stored': True,
                    'file_path': output_file,
                    'records_stored': len(data_to_store.get('data', [])) if isinstance(data_to_store.get('data'), list) else 1,
                    'data': data_to_store
                }
                
            elif storage_type == 'graph' or storage_type == 'neo4j':
                # Ingest into graph backend using mappings
                try:
                    from services.graph import bulk_ingest
                except Exception as e:
                    raise Exception(f"Graph service unavailable: {e}")

                payload_nodes = []
                payload_edges = []

                # Expect data_to_store['data'] to be list[dict] or dict
                records = data_to_store.get('data', data_to_store)
                if isinstance(records, dict):
                    records = [records]

                # Minimal mapping support: use database_schema for node fields, and storage_mappings to map attributes
                # Node label defaults to 'Record' if not specified in config
                node_label = config.get('graph_node_label') or 'Record'
                id_field = config.get('graph_id_field') or 'id'

                for rec in records or []:
                    node_id = str(rec.get(id_field) or f"{node_label}:{hash(str(rec))}")
                    props = {}
                    if isinstance(storage_mappings, dict) and storage_mappings:
                        for out_field, mapping in storage_mappings.items():
                            if not mapping:
                                continue
                            mtype = mapping.get('type')
                            if mtype == 'direct':
                                if 'source' in mapping and mapping['source'] in rec:
                                    props[out_field] = rec.get(mapping['source'])
                                elif 'sources' in mapping and isinstance(mapping['sources'], list):
                                    props[out_field] = [rec.get(s) for s in mapping['sources'] if s in rec]
                            elif mtype == 'constant':
                                props[out_field] = mapping.get('value')
                    else:
                        props = rec
                    payload_nodes.append({ 'label': node_label, 'id': node_id, 'props': props })

                # Relationship autowire (optional): if config supplies edge mapping
                rel_cfg = config.get('graph_relationship') or {}
                if isinstance(rel_cfg, dict) and rel_cfg.get('type') and rel_cfg.get('from') and rel_cfg.get('to'):
                    etype = rel_cfg['type']
                    frm = rel_cfg['from']
                    to = rel_cfg['to']
                    # Build edges by matching on id fields in the current payload only
                    from_label = frm.get('label') or node_label
                    to_label = to.get('label') or node_label
                    from_id_field = frm.get('idField') or id_field
                    to_id_field = to.get('idField') or id_field
                    # Index nodes by label+id for quick lookup
                    index = {(n['label'], n['id']): True for n in payload_nodes}
                    for rec in records or []:
                        fid = str(rec.get(from_id_field)) if rec.get(from_id_field) is not None else None
                        tid = str(rec.get(to_id_field)) if rec.get(to_id_field) is not None else None
                        if fid and tid and ((from_label, fid) in index) and ((to_label, tid) in index):
                            payload_edges.append({
                                'type': etype,
                                'from': { 'label': from_label, 'id': fid },
                                'to': { 'label': to_label, 'id': tid },
                                'props': {}
                            })

                result = bulk_ingest(payload_nodes, payload_edges)
                return {
                    'type': 'storage_write',
                    'storage_id': storage_id,
                    'data_stored': True,
                    'graph_result': result,
                    'records_stored': len(records or []),
                    'data': data_to_store
                }

            elif storage_type == 'database':
                # Store to SQLite database (simulating database storage)
                output_file = f"{output_dir}/{filename}.db"
                
                # For now, store as JSON file (simulating database)
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump({
                        'storage_name': storage_name,
                        'timestamp': timestamp,
                        'data': data_to_store
                    }, f, indent=2, default=str)
                
                print(f"✅ Data stored to database: {output_file}")
                
                return {
                    'type': 'storage_write',
                    'storage_id': storage_id,
                    'data_stored': True,
                    'file_path': output_file,
                    'records_stored': len(data_to_store.get('data', [])) if isinstance(data_to_store.get('data'), list) else 1,
                    'data': data_to_store
                }
                
            else:
                # Default to JSON file storage
                output_file = f"{output_dir}/{filename}.json"
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump({
                        'storage_name': storage_name,
                        'timestamp': timestamp,
                        'data': data_to_store
                    }, f, indent=2, default=str)
                
                print(f"✅ Data stored to: {output_file}")
                
                return {
                    'type': 'storage_write',
                    'storage_id': storage_id,
                    'data_stored': True,
                    'file_path': output_file,
                    'records_stored': len(data_to_store.get('data', [])) if isinstance(data_to_store.get('data'), list) else 1,
                    'data': data_to_store
                }
                
        except Exception as e:
            error_msg = f"Failed to store data to {storage['name']}: {str(e)}"
            print(f"❌ {error_msg}")
            raise Exception(error_msg)
            
    else:
        # Retrieve data
        print(f"📖 Retrieving data from {storage_name}")
        # TODO: Implement actual retrieval logic
        return {
            'type': 'storage_read',
            'storage_id': storage_id,
            'data': {'message': 'Retrieved data from storage'}
        }

def execute_transform_node(node_id, config, context, user_email, user_sub=None):
    """Execute transform node - apply transform to data"""
    # Handle both 'id' and 'transform_id' field names for backward compatibility
    transform_id = config.get('id') or config.get('transform_id')
    
    transform_obj = None
    if transform_id:
        # Get transform details if a specific transform was selected
        # Prefer transforms stored under user_email; fallback to user_sub if none
        transforms = get_transforms(user_email)
        if not transforms and user_sub and user_sub != user_email:
            print(f"🔁 No transforms for {user_email}; retrying with subject {user_sub}")
            transforms = get_transforms(user_sub)
        # Coerce to int if possible for comparison
        try:
            tid = int(transform_id)
        except Exception:
            tid = transform_id
        transform_obj = next((t for t in transforms if t['id'] == tid or str(t['id']) == str(transform_id)), None)
        # Fallback: resolve by name if id lookup failed but a name is present in config
        if not transform_obj:
            tname = config.get('transform_name') or config.get('name')
            if tname:
                transform_obj = next((t for t in transforms if str(t.get('name')) == str(tname)), None)
        if not transform_obj:
            # Strict: fail if a specific transform was selected but not found
            raise Exception(f"Transform {transform_id} not found")
        else:
            print(f"🔧 Applying transform: {transform_obj['name']} ({transform_obj['transform_type']})")
    else:
        print("🔧 No transform selected, will attempt to apply direct parameter/attribute mappings...")
    
    # Get input data from previous nodes
    input_data = None
    sample_rate = 250  # Default sample rate
    channels = []
    
    # Prefer upstream transformed_data first, then generic data
    for ctx_key, ctx_value in context.items():
        if isinstance(ctx_value, dict) and 'data' in ctx_value:
            input_data = ctx_value['data']
            sample_rate = ctx_value.get('sample_rate', 250)
            channels = ctx_value.get('channels', [])
            break
        elif isinstance(ctx_value, dict) and 'transformed_data' in ctx_value:
            td = ctx_value['transformed_data']
            if isinstance(td, dict) and 'data' in td:
                input_data = td['data']
                sample_rate = td.get('sample_rate', 250)
                channels = td.get('channels', [])
                break
    
    if not input_data:
        raise Exception("No input data found for transform")
    
    # Check if we have a transform script or just parameter mappings
    transform_script = '' if not transform_obj else transform_obj.get('parameters', '')
    # Accept multiple config keys for mappings (backward compatibility)
    parameter_mappings = (
        config.get('parameter_mappings')
        or config.get('attribute_mappings')
        or config.get('mappings')
        or {}
    )
    
    try:
        # If no script is provided, we'll do direct parameter/attribute mapping transformation
        if not transform_script.strip():
            print(f"🎯 No transform script provided, applying direct parameter mappings...")
            
            if not parameter_mappings:
                raise Exception("No transform script and no parameter mappings configured")
            
            # Apply parameter mappings directly to transform the data
            transformed_result = apply_parameter_mappings_to_data(input_data, parameter_mappings)
            
        else:
            # Execute transform script (JavaScript)
            print(f"🎯 Executing JavaScript transform script...")
            
            # Handle parameter mappings if configured
            mapped_parameters = {}
            
            if parameter_mappings:
                print(f"🔧 Applying parameter mappings: {list(parameter_mappings.keys())}")
                
                for param_name, mapping_config in parameter_mappings.items():
                    mapping_type = mapping_config.get('type')
                    
                    if mapping_type == 'direct':
                        # Handle single source field (legacy) or multiple sources (new)
                        source_field = mapping_config.get('source')
                        sources = mapping_config.get('sources', [])
                        
                        if source_field and input_data:
                            # Single field mapping (legacy)
                            if isinstance(input_data, list) and len(input_data) > 0:
                                mapped_parameters[param_name] = input_data[0].get(source_field)
                            else:
                                mapped_parameters[param_name] = input_data.get(source_field)
                        elif sources and input_data:
                            # Multiple field mapping (new)
                            if isinstance(input_data, list) and len(input_data) > 0:
                                # For array data, collect values from first row
                                row = input_data[0]
                                if isinstance(sources, list):
                                    mapped_parameters[param_name] = [row.get(field) for field in sources if field in row]
                                else:
                                    mapped_parameters[param_name] = []
                            else:
                                # For single object data
                                if isinstance(sources, list):
                                    mapped_parameters[param_name] = [input_data.get(field) for field in sources if field in input_data]
                                else:
                                    mapped_parameters[param_name] = []
                                
                    elif mapping_type == 'constant':
                        mapped_parameters[param_name] = mapping_config.get('value')
                        
                    elif mapping_type == 'expression':
                        expression = mapping_config.get('expression')
                        if expression and input_data:
                            try:
                                # Create evaluation context
                                context = {
                                    'row': input_data if isinstance(input_data, dict) else (input_data[0] if input_data and len(input_data) > 0 else {}),
                                    'data': input_data,
                                    'Math': math,
                                    'String': str,
                                    'Number': float,
                                    'Boolean': bool
                                }
                                mapped_parameters[param_name] = eval(expression, {"__builtins__": {}}, context)
                            except Exception as e:
                                print(f"⚠️ Error evaluating expression '{expression}' for parameter '{param_name}': {e}")
                                mapped_parameters[param_name] = None
                    elif mapping_type == 'concatenate':
                        # Join multiple fields/literals with a delimiter
                        delimiter = mapping_config.get('delimiter', ' ')
                        parts = mapping_config.get('parts') or mapping_config.get('sources') or []
                        values = []
                        row = input_data[0] if isinstance(input_data, list) and input_data else (input_data if isinstance(input_data, dict) else {})
                        for p in parts:
                            try:
                                if isinstance(p, dict):
                                    if p.get('type') == 'field' and p.get('name'):
                                        val = row.get(p['name'])
                                        if val is not None and val != '':
                                            values.append(str(val))
                                    elif p.get('type') == 'literal':
                                        values.append(str(p.get('value', '')))
                                elif isinstance(p, str):
                                    # Treat as field name
                                    val = row.get(p)
                                    if val is not None and val != '':
                                        values.append(str(val))
                            except Exception:
                                continue
                        mapped_parameters[param_name] = delimiter.join(values)
                    elif mapping_type == 'split':
                        # Split a single field by delimiter into an array
                        source_field = mapping_config.get('source')
                        delimiter = mapping_config.get('delimiter', ',')
                        row = input_data[0] if isinstance(input_data, list) and input_data else (input_data if isinstance(input_data, dict) else {})
                        val = row.get(source_field) if isinstance(row, dict) and source_field else None
                        mapped_parameters[param_name] = [s for s in str(val).split(delimiter)] if val not in [None, ''] else []
            
            # Prepare data for JavaScript execution
            transform_input = {
                'data': input_data,
                'channels': channels,
                'sampleRate': sample_rate,
                **mapped_parameters  # Include mapped parameters
            }
            
            # Execute JavaScript transform
            transformed_result = execute_javascript_transform(transform_script, transform_input)
        
        print(f"✅ Transform applied successfully")
        
        transform_name_safe = transform_obj['name'] if transform_obj else 'Direct Mapping'
        
        transformed_data = {
            'data': transformed_result,
            'channels': channels,
            'sample_rate': sample_rate,
            'transform_applied': transform_name_safe,
            'transformed': True,
            'timestamp': time.time()
        }
        
        return {
            'type': 'transformed_data',
            'data': transformed_data,
            'transform_id': transform_id,
            'transform_name': transform_name_safe
        }
        
    except Exception as e:
        print(f"❌ Transform execution failed: {str(e)}")
        raise Exception(f"Transform execution failed: {str(e)}")


def apply_parameter_mappings_to_data(input_data, parameter_mappings):
    """
    Apply parameter mappings directly to transform data without a script
    This allows for basic field mapping and expressions without writing JavaScript
    """
    print(f"🔧 Applying direct parameter mappings to data...")
    
    if not input_data:
        return input_data
    
    # Handle array of records
    if isinstance(input_data, list):
        transformed_records = []
        
        for record in input_data:
            transformed_record = apply_mappings_to_record(record, parameter_mappings)
            transformed_records.append(transformed_record)
        
        return transformed_records
    
    # Handle single record
    else:
        return apply_mappings_to_record(input_data, parameter_mappings)


def apply_mappings_to_record(record, parameter_mappings):
    """
    Apply parameter mappings to a single record
    """
    transformed_record = record.copy() if isinstance(record, dict) else {}
    
    for param_name, mapping_config in parameter_mappings.items():
        mapping_type = mapping_config.get('type')
        
        if mapping_type == 'direct':
            # Direct field mapping
            # Support both 'source' and 'sourceField' keys
            source_field = (
                mapping_config.get('source')
                or mapping_config.get('sourceField')
            )
            sources = mapping_config.get('sources', [])
            
            if source_field and source_field in record:
                transformed_record[param_name] = record[source_field]
            elif sources:
                # Multiple field mapping - create array of values
                values = []
                for field in sources:
                    if field in record:
                        values.append(record[field])
                transformed_record[param_name] = values
        
        elif mapping_type == 'constant':
            # Constant value
            transformed_record[param_name] = mapping_config.get('value')
        
        elif mapping_type == 'expression':
            # Expression evaluation
            expression = mapping_config.get('expression')
            if expression:
                try:
                    # Create evaluation context
                    context = {
                        'row': record,
                        'data': record,
                        'Math': math,
                        'String': str,
                        'Number': float,
                        'Boolean': bool
                    }
                    result = eval(expression, {"__builtins__": {}}, context)
                    transformed_record[param_name] = result
                except Exception as e:
                    print(f"⚠️ Error evaluating expression '{expression}' for parameter '{param_name}': {e}")
                    transformed_record[param_name] = None
        elif mapping_type == 'concatenate':
            delimiter = mapping_config.get('delimiter', ' ')
            parts = mapping_config.get('parts') or mapping_config.get('sources') or []
            values = []
            for p in parts:
                try:
                    if isinstance(p, dict):
                        if p.get('type') == 'field' and p.get('name'):
                            val = record.get(p['name'])
                            if val is not None and val != '':
                                values.append(str(val))
                        elif p.get('type') == 'literal':
                            values.append(str(p.get('value', '')))
                    elif isinstance(p, str):
                        val = record.get(p)
                        if val is not None and val != '':
                            values.append(str(val))
                except Exception:
                    continue
            transformed_record[param_name] = delimiter.join(values)
        elif mapping_type == 'split':
            source_field = mapping_config.get('source')
            delimiter = mapping_config.get('delimiter', ',')
            val = record.get(source_field) if source_field in record else None
            transformed_record[param_name] = [s for s in str(val).split(delimiter)] if val not in [None, ''] else []
    
    return transformed_record

def execute_javascript_transform(script, input_data):
    """Execute JavaScript transform script using Node.js"""
    try:
        # Create a temporary file for the JavaScript execution
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as temp_file:
            # Write the complete JavaScript program
            js_program = f"""
const fs = require('fs');

// Input data with mapped parameters
const inputData = {json.dumps(input_data)};

// User's transform script
{script}

try {{
    // Execute the transform function with mapped parameters
    let result;
    if (typeof transformCsvToOaa !== 'undefined') {{
        // Pass mapped parameters as individual arguments
        const params = Object.keys(inputData).filter(key => !['data', 'channels', 'sampleRate'].includes(key));
        if (params.length > 0) {{
            result = transformCsvToOaa(inputData.data, inputData);
        }} else {{
            result = transformCsvToOaa(inputData.data, inputData.config || {{}});
        }}
    }} else if (typeof applyTransform !== 'undefined') {{
        const params = Object.keys(inputData).filter(key => !['data', 'channels', 'sampleRate'].includes(key));
        if (params.length > 0) {{
            result = applyTransform(inputData.data, inputData);
        }} else {{
            result = applyTransform(inputData.data, inputData.config || {{}});
        }}
    }} else {{
        throw new Error('No transform function found (expected transformCsvToOaa or applyTransform)');
    }}
    
    // Write result to stdout as JSON
    console.log(JSON.stringify({{
        success: true,
        data: result
    }}));
    
}} catch (error) {{
    console.log(JSON.stringify({{
        success: false,
        error: error.message
    }}));
    process.exit(1);
}}
"""
            temp_file.write(js_program)
            temp_file_path = temp_file.name
        
        try:
            # Execute the JavaScript file with Node.js
            result = subprocess.run(
                ['node', temp_file_path],
                capture_output=True,
                text=True,
                timeout=30  # 30 second timeout
            )
            
            if result.returncode != 0:
                raise Exception(f"JavaScript execution failed: {result.stderr}")
            
            # Parse the result
            try:
                output = json.loads(result.stdout.strip())
                if not output.get('success'):
                    raise Exception(output.get('error', 'Unknown JavaScript error'))
                
                return output.get('data')
                
            except json.JSONDecodeError:
                raise Exception(f"Invalid JSON output from transform: {result.stdout}")
                
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except OSError:
                pass
                
    except subprocess.TimeoutExpired:
                    raise Exception("Transform execution timed out (30 seconds)")
    except FileNotFoundError:
                    raise Exception("Node.js not found - required for transform execution")
    except Exception as e:
        raise Exception(f"Transform execution error: {str(e)}")

def execute_analytics_node(node_id, config, context, user_id):
    """Execute analytics node - run analysis on data"""
    analytics_id = config.get('id')
    if not analytics_id:
        raise Exception("No analytics selected")
    
    # Get analytics details
    analytics_list = get_analytics(user_id)
    analytics_obj = next((a for a in analytics_list if a['id'] == analytics_id), None)
    
    if not analytics_obj:
        raise Exception(f"Analytics {analytics_id} not found")
    
    print(f"🔧 Running analytics: {analytics_obj['name']} ({analytics_obj['analysis_type']})")
    
    # Get input data from previous nodes
    input_data = None
    sample_rate = 250
    channels = []
    storage_data = None
    
    for ctx_key, ctx_value in context.items():
        if isinstance(ctx_value, dict) and 'data' in ctx_value:
            input_data = ctx_value['data']
            sample_rate = ctx_value.get('sample_rate', 250)
            channels = ctx_value.get('channels', [])
            storage_data = ctx_value.get('storage_data')  # For historical data analysis
            break
    
    if not input_data:
        raise Exception("No input data found for analytics")
    
    # Execute analytics script (JavaScript)
    try:
        print(f"🎯 Executing JavaScript analytics script...")
        analytics_script = analytics_obj.get('parameters', '')
        
        if not analytics_script.strip():
            raise Exception("Analytics script is empty")
        
        # Prepare data for JavaScript execution
        analytics_input = {
            'data': input_data,
            'channels': channels,
            'sampleRate': sample_rate,
            'storageData': storage_data
        }
        
        # Execute JavaScript analytics
        analytics_result = execute_javascript_analytics(analytics_script, analytics_input)
        
        print(f"✅ Analytics completed successfully")
        
        return {
            'type': 'analytics_results',
            'data': analytics_result,
            'analytics_id': analytics_id,
            'analytics_name': analytics_obj['name'],
            'analysis_type': analytics_obj['analysis_type']
        }
        
    except Exception as e:
        print(f"❌ Analytics execution failed: {str(e)}")
        raise Exception(f"Analytics execution failed: {str(e)}")

def execute_javascript_analytics(script, input_data):
    """Execute JavaScript analytics script using Node.js"""
    try:
        # Create a temporary file for the JavaScript execution
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as temp_file:
            # Write the complete JavaScript program
            js_program = f"""
const fs = require('fs');

// Input data
const inputData = {json.dumps(input_data)};

// User's analytics script
{script}

try {{
    // Execute the analytics function
    let result;
    if (typeof analyzeEEGData !== 'undefined') {{
        result = analyzeEEGData(inputData.data, inputData.channels, inputData.sampleRate, inputData.storageData);
    }} else if (typeof runAnalytics !== 'undefined') {{
        result = runAnalytics(inputData.data, inputData.channels, inputData.sampleRate, inputData.storageData);
    }} else {{
        throw new Error('No analytics function found (expected analyzeEEGData or runAnalytics)');
    }}
    
    // Write result to stdout as JSON
    console.log(JSON.stringify({{
        success: true,
        data: result
    }}));
    
}} catch (error) {{
    console.log(JSON.stringify({{
        success: false,
        error: error.message
    }}));
    process.exit(1);
}}
"""
            temp_file.write(js_program)
            temp_file_path = temp_file.name
        
        try:
            # Execute the JavaScript file with Node.js
            result = subprocess.run(
                ['node', temp_file_path],
                capture_output=True,
                text=True,
                timeout=60  # 60 second timeout for analytics
            )
            
            if result.returncode != 0:
                raise Exception(f"JavaScript execution failed: {result.stderr}")
            
            # Parse the result
            try:
                output = json.loads(result.stdout.strip())
                if not output.get('success'):
                    raise Exception(output.get('error', 'Unknown JavaScript error'))
                
                return output.get('data')
                
            except json.JSONDecodeError:
                raise Exception(f"Invalid JSON output from analytics: {result.stdout}")
                
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except OSError:
                pass
                
    except subprocess.TimeoutExpired:
        raise Exception("Analytics execution timed out (60 seconds)")
    except FileNotFoundError:
        raise Exception("Node.js not found - required for analytics execution")
    except Exception as e:
        raise Exception(f"Analytics execution error: {str(e)}")


def emit_status(socketio, user_id, status, message):
    """Emit flow execution status"""
    socketio.emit('flow_status', {
        'status': status,
        'message': message,
        'timestamp': time.time()
    }, room=user_id)

def emit_node_status(socketio, user_id, node_id, status, message):
    """Emit node execution status"""
    socketio.emit('node_status', {
        'node_id': node_id,
        'status': status,
        'message': message,
        'timestamp': time.time()
    }, room=user_id)

# ============================================================================
# NEW NODE TYPE IMPLEMENTATIONS
# ============================================================================

def execute_flow_trigger_node(node_id, config, context, user_id):
    """Execute flow trigger node - initiates flow execution"""
    trigger_type = config.get('trigger_type', 'flow_start')
    trigger_name = config.get('trigger_name', 'Flow Trigger')
    
    print(f"🚀 Executing flow trigger: {trigger_name} ({trigger_type})")
    
    # Different trigger types
    if trigger_type == 'flow_start':
        return {
            'type': 'flow_trigger',
            'trigger_type': trigger_type,
            'trigger_name': trigger_name,
            'timestamp': time.time(),
            'status': 'triggered'
        }
    elif trigger_type == 'schedule':
        # TODO: Implement scheduled triggers
        print(f"⏰ Scheduled trigger not yet implemented: {trigger_type}")
        return {
            'type': 'flow_trigger',
            'trigger_type': trigger_type,
            'trigger_name': trigger_name,
            'timestamp': time.time(),
            'status': 'triggered'
        }
    elif trigger_type == 'webhook':
        # TODO: Implement webhook triggers
        print(f"🔗 Webhook trigger not yet implemented: {trigger_type}")
        return {
            'type': 'flow_trigger',
            'trigger_type': trigger_type,
            'trigger_name': trigger_name,
            'timestamp': time.time(),
            'status': 'triggered'
        }
    
    return {
        'type': 'flow_trigger',
        'trigger_type': trigger_type,
        'trigger_name': trigger_name,
        'timestamp': time.time(),
        'status': 'triggered'
    }

def execute_plugins_node(node_id, config, context, user_email, user_sub=None):
    """Execute plugins node - run SDK/library functions"""
    print(f"🔌 Executing plugins node: {node_id}")
    
    plugin_name = config.get('plugin_name')
    function_name = config.get('function_name')
    parameter_mappings = config.get('parameter_mappings', {})
    api_connection_id = config.get('api_connection_id')
    
    print(f"🔌 Plugin: {plugin_name}, Function: {function_name}")
    print(f"🔧 Parameter mappings: {parameter_mappings}")
    print(f"🔗 API Connection ID: {api_connection_id}")
    
    if not plugin_name or not function_name:
        raise Exception("Plugin name and function name are required")
    
    # Get input data from previous nodes
    # Prefer transformed_data first (output of transform node), then fall back to raw data
    input_data = None
    for ctx_key, ctx_value in context.items():
        if isinstance(ctx_value, dict) and 'transformed_data' in ctx_value:
            td = ctx_value['transformed_data']
            if isinstance(td, dict) and 'data' in td:
                input_data = td['data']
                print("🔗 Plugins node using transformed_data from context")
                break
    if input_data is None:
        for ctx_key, ctx_value in context.items():
            if isinstance(ctx_value, dict) and 'data' in ctx_value:
                input_data = ctx_value['data']
                print("🔗 Plugins node using raw data from context")
                break
    
    try:
        if plugin_name == 'oaa_sdk':
            # Use user_sub for API connection lookups (how connections are stored)
            # Fall back to user_email if user_sub is not available
            user_id_for_lookup = user_sub if user_sub else user_email
            return execute_oaa_sdk_function(function_name, parameter_mappings, input_data, user_id_for_lookup, api_connection_id)
        elif plugin_name == 'okta_sdk':
            user_id_for_lookup = user_sub if user_sub else user_email
            return execute_okta_sdk_function(function_name, parameter_mappings, input_data, user_id_for_lookup, api_connection_id)
        else:
            raise Exception(f"Unknown plugin: {plugin_name}")
            
    except Exception as e:
        print(f"❌ Plugin execution error: {str(e)}")
        raise Exception(f"Plugin execution failed: {str(e)}")

def execute_oaa_sdk_function(function_name, parameter_mappings, input_data, user_id, api_connection_id=None):
    """Execute OAA SDK function with mapped parameters"""
    print(f"🔍 Executing OAA SDK function: {function_name}")
    
    # Import OAA client (add path if needed)
    import sys
    import os
    oaa_path = os.path.join(os.path.dirname(__file__), '..', 'lib')
    if oaa_path not in sys.path:
        sys.path.append(oaa_path)
    
    try:
        from oaaclient.client import OAAClient
        
        # Get Veza credentials from API connection or fallback to environment
        veza_url = None
        veza_api_key = None
        
        if api_connection_id:
            # Get credentials from API connection
            try:
                print(f"🔍 Looking up API connection {api_connection_id} for user {user_id}")
                connection = get_api_connection(api_connection_id, user_id)
                if connection:
                    veza_url = connection['base_url']
                    veza_api_key = connection['api_token']
                    print(f"🔗 Using API connection '{connection['name']}' - URL: {veza_url}")
                else:
                    print(f"⚠️ API connection {api_connection_id} not found for user {user_id}")
            except Exception as e:
                print(f"⚠️ Could not retrieve API connection {api_connection_id}: {e}")
        
        # Fall back to environment variables if no connection or connection failed
        if not veza_url or not veza_api_key:
            print("🔄 Falling back to environment variables")
            veza_url = os.getenv('VEZA_URL')
            veza_api_key = os.getenv('VEZA_API_KEY')
            
            if not veza_url or not veza_api_key:
                raise Exception("No API connection selected and VEZA_URL/VEZA_API_KEY environment variables not set")
        
        # Create OAA client
        client = OAAClient(url=veza_url, api_key=veza_api_key)
        
        # Map parameters from input data
        function_params = map_parameters(parameter_mappings, input_data)
        print(f"📊 Mapped function parameters: {function_params}")
        
        # Execute the function with convenience aliasing
        if hasattr(client, function_name):
            # Special-case: allow dict application_object for push_application
            if function_name == 'push_application' and isinstance(function_params.get('application_object'), dict):
                # Ensure provider exists when create_provider is truthy
                provider_name = function_params.get('provider_name')
                data_source_name = function_params.get('data_source_name')
                create_provider_flag = str(function_params.get('create_provider')).lower() in ['true', '1', 'yes', 'y']
                if create_provider_flag and provider_name:
                    try:
                        provider = client.get_provider(provider_name)
                        if not provider:
                            client.create_provider(provider_name, custom_template='application')
                    except Exception:
                        # Best-effort create; if it still fails, let the push report the error
                        pass
                # Validate minimal payload and log counts to help debug InvalidArgument
                meta = function_params.get('application_object') or {}
                try:
                    apps = (meta.get('applications') or [])
                    users_count = 0
                    if apps and isinstance(apps[0], dict):
                        users_count = len(apps[0].get('local_users') or [])
                    cpd = (meta.get('custom_property_definition', {}) or {}).get('applications', [{}])
                    if isinstance(cpd, list) and cpd:
                        cpd0 = cpd[0]
                    else:
                        cpd0 = {}
                    prop_defs_len = len(cpd0.get('property_definitions', [])) if isinstance(cpd0.get('property_definitions'), list) else 0
                    lup_len = len(cpd0.get('local_user_properties', {}) or {})
                    print(f"👥 OAA push_application (dict) users_count={users_count}, fields={prop_defs_len}, local_user_properties={lup_len}")
                except Exception:
                    pass
                try:
                    result = client.push_metadata(
                        provider_name=provider_name,
                        data_source_name=data_source_name,
                        metadata=meta,
                        save_json=function_params.get('save_json', False),
                        options=function_params.get('options')
                    )
                except Exception as e:
                    # Log more diagnostics about the payload to understand InvalidArgument
                    try:
                        apps0 = (meta.get('applications') or [{}])[0]
                        lup = (((meta.get('custom_property_definition') or {}).get('applications') or [{}])[0]).get('local_user_properties') or {}
                        print(f"🧪 Push diagnostics: local_users={len(apps0.get('local_users') or [])}, declared_props={len(lup)} keys={list(lup.keys())[:10]}")
                        print(f"🧪 First user sample: {json.dumps((apps0.get('local_users') or [{}])[0], indent=2)[:500]}")
                    except Exception:
                        pass
                    raise
            else:
                # Log a brief preview of application_object if present to aid debugging
                if 'application_object' in function_params and isinstance(function_params['application_object'], dict):
                    try:
                        apps = function_params['application_object'].get('applications') or []
                        users_count = 0
                        if apps and isinstance(apps[0], dict):
                            users_count = len(apps[0].get('local_users') or [])
                        print(f"👥 OAA {function_name} users_count={users_count}")
                    except Exception:
                        pass
                function = getattr(client, function_name)
                try:
                    result = function(**function_params)
                except Exception as e:
                    # Attempt to print any details included on OAA errors
                    err_msg = str(e)
                    details = getattr(e, 'details', None)
                    if details:
                        print(f"🛑 OAA error details: {json.dumps(details, indent=2)}")
                    raise
            
            # Flatten the result data to root level for easier mapping
            flattened_result = {
                'type': 'plugins',
                'plugin_name': 'oaa_sdk',
                'function_name': function_name,
                'timestamp': time.time(),
                'status': 'success',
                '_raw_data': result  # Keep original result for debugging
            }
            
            # Add result fields to root level for mapping
            if isinstance(result, dict):
                # Add all result fields to the root, avoiding conflicts with metadata
                for key, value in result.items():
                    if key not in ['type', 'plugin_name', 'function_name', 'timestamp', 'status']:
                        flattened_result[key] = value
            else:
                # For non-dict results, store as 'result'
                flattened_result['result'] = result
                
            return flattened_result
        else:
            # Convenience: allow passing a raw application_object (dict) and map to push_metadata
            if function_name == 'push_application' and 'application_object' in function_params and isinstance(function_params['application_object'], dict):
                provider_name = function_params.get('provider_name')
                data_source_name = function_params.get('data_source_name')
                metadata = function_params['application_object']
                result = client.push_metadata(provider_name=provider_name, data_source_name=data_source_name, metadata=metadata, save_json=function_params.get('save_json', False), options=function_params.get('options'))
            else:
                raise Exception(f"Function {function_name} not found in OAA SDK")
            
    except ImportError as e:
        print(f"⚠️ Could not import OAA client: {str(e)}")
        # For demo purposes, return mock data with realistic structure
        mock_result = {}
        if function_name == 'create_provider':
            mock_result = {
                'provider_id': f'mock_provider_{int(time.time())}',
                'name': function_params.get('name', 'Mock Provider'),
                'template': function_params.get('custom_template', 'custom'),
                'status': 'created'
            }
        elif function_name == 'create_data_source':
            mock_result = {
                'data_source_id': f'mock_datasource_{int(time.time())}',
                'name': function_params.get('name', 'Mock Data Source'),
                'provider_id': function_params.get('provider_id', 'mock_provider_123'),
                'status': 'created'
            }
        elif function_name == 'get_provider':
            mock_result = {
                'provider_id': function_params.get('provider_id', 'mock_provider_123'),
                'name': 'Mock Provider',
                'template': 'custom',
                'icon': '',
                'created_time': '2024-01-01T00:00:00Z'
            }
        else:
            mock_result = {
                'result': f"Mock result for {function_name} (OAA SDK not available)",
                'status': 'success'
            }
            
        return {
            'type': 'plugins',
            'plugin_name': 'oaa_sdk',
            'function_name': function_name,
            'timestamp': time.time(),
            'status': 'success',
            '_raw_data': mock_result,
            **mock_result  # Flatten mock result to root level
        }
    except Exception as e:
        print(f"❌ OAA SDK execution error: {str(e)}")
        raise Exception(f"OAA SDK execution failed: {str(e)}")

def execute_okta_sdk_function(function_name, parameter_mappings, input_data, user_id, api_connection_id=None):
    """Execute Okta SDK function with mapped parameters similar to OAA executor"""
    print(f"🔍 Executing Okta SDK function: {function_name}")
    try:
        from okta.client import Client as OktaClient
    except Exception as e:
        raise Exception(f"Okta SDK not available: {e}")

    # Get Okta connection credentials from selected API connection
    base_url = None
    api_token = None
    if api_connection_id:
        try:
            connection = get_api_connection(api_connection_id, user_id)
            if connection:
                base_url = connection.get('base_url')
                api_token = connection.get('api_token')
                print(f"🔗 Using API connection '{connection['name']}' - URL: {base_url}")
        except Exception as e:
            print(f"⚠️ Could not retrieve API connection {api_connection_id}: {e}")

    if not base_url or not api_token:
        # Fall back to env
        base_url = os.getenv('OKTA_BASE_URL') or base_url
        api_token = os.getenv('OKTA_API_TOKEN') or api_token
        if not base_url or not api_token:
            raise Exception("No API connection selected and OKTA_BASE_URL/OKTA_API_TOKEN not set")

    # Map parameters from input data
    function_params = map_parameters(parameter_mappings, input_data)
    print(f"📊 Mapped Okta function parameters: {function_params}")

    # Initialize Okta client
    client_config = {
        'orgUrl': base_url.rstrip('/'),
        'token': api_token
    }
    client = OktaClient(client_config)

    # Minimal dynamic dispatch for common operations
    # Support a small set: list_users, get_user, create_user, list_groups, add_user_to_group
    async def _run():
        if function_name == 'list_users':
            q = function_params.get('query')
            res, err, _ = await client.list_users({'search': q} if q else {})
            if err: raise Exception(str(err))
            return [u.to_dict() for u in res]
        if function_name == 'get_user':
            uid = function_params.get('user_id')
            if not uid: raise Exception('user_id required')
            user, err, _ = await client.get_user(uid)
            if err: raise Exception(str(err))
            return user.to_dict()
        if function_name == 'list_groups':
            res, err, _ = await client.list_groups()
            if err: raise Exception(str(err))
            return [g.to_dict() for g in res]
        if function_name == 'add_user_to_group':
            gid = function_params.get('group_id')
            uid = function_params.get('user_id')
            if not gid or not uid: raise Exception('group_id and user_id required')
            _, err, _ = await client.add_user_to_group(gid, uid)
            if err: raise Exception(str(err))
            return {'status': 'added', 'group_id': gid, 'user_id': uid}
        if function_name == 'create_user':
            prof = function_params.get('profile') or {}
            creds = function_params.get('credentials') or {}
            body = {'profile': prof, 'credentials': creds}
            user, err, _ = await client.create_user(body)
            if err: raise Exception(str(err))
            return user.to_dict()
        if function_name == 'list_applications':
            # basic list applications
            res, err, _ = await client.list_applications()
            if err: raise Exception(str(err))
            return [a.to_dict() for a in res]
        if function_name == 'list_app_assignments':
            # requires application id
            app_id = function_params.get('app_id')
            if not app_id: raise Exception('app_id required')
            res, err, _ = await client.list_application_assignments(app_id)
            if err: raise Exception(str(err))
            return [x.to_dict() for x in res]
        raise Exception(f"Unknown Okta function: {function_name}")

    # Okta SDK is async; run synchronously via asyncio
    import asyncio as _asyncio
    try:
        loop = _asyncio.get_event_loop()
    except RuntimeError:
        loop = _asyncio.new_event_loop()
        _asyncio.set_event_loop(loop)
    result = loop.run_until_complete(_run())

    return {
        'type': 'plugins',
        'plugin_name': 'okta_sdk',
        'function_name': function_name,
        'timestamp': time.time(),
        'status': 'success',
        'result': result
    }

def map_parameters(parameter_mappings, input_data):
    """Map input data to function parameters based on mappings"""
    mapped_params = {}
    
    # Get the actual data from input_data (could be nested)
    data_source = input_data
    if isinstance(input_data, dict) and 'data' in input_data:
        data_source = input_data['data']
    
    def _coerce_bool(value):
        if isinstance(value, str):
            if value.lower() in ['true', '1', 'yes', 'y']:
                return True
            if value.lower() in ['false', '0', 'no', 'n']:
                return False
        return value

    def _build_minimal_oaa_application_object(rows, selected_fields, user_field_hints=None):
        """Construct a minimal OAA application payload from tabular rows and a set of field names.
        Aligns with oaaclient.templates.CustomApplication.get_payload() schema.
        """
        rows = rows if isinstance(rows, list) else ([rows] if isinstance(rows, dict) else [])
        import re

        def _val(r, keys):
            for k in keys:
                if k and k in r and r[k] not in [None, '']:
                    return r[k]
            return None

        def _normalize_property_name(name: str) -> str:
            if not isinstance(name, str) or not name:
                return 'f_unnamed'
            s1 = re.sub(r'([A-Z]+)', r'_\1', name)
            s2 = re.sub(r'[^a-zA-Z0-9_]+', '_', s1)
            s3 = s2.lower().strip('_')
            if not re.match(r'^[a-z]', s3):
                s3 = f"f_{s3}"
            s3 = re.sub(r'_+', '_', s3)
            return s3

        hints = user_field_hints or {}

        # Map original field name -> normalized property name
        field_name_map = { f: _normalize_property_name(f) for f in selected_fields }

        # Build local_users
        local_users = []
        for r in rows:
            id_candidates = []
            if hints.get('idField'): id_candidates.append(hints['idField'])
            id_candidates += ['user_id', 'employeeID', 'sAMAccountName', 'id'] + selected_fields
            name = _val(r, id_candidates) or _val(r, ['email', 'mail'])

            display_candidates = []
            if hints.get('displayNameField'): display_candidates.append(hints['displayNameField'])
            display_candidates += ['displayName', 'name'] + selected_fields
            display_name = _val(r, display_candidates) or name

            email_val = _val(r, [hints.get('emailField')]) or _val(r, ['email', 'mail'])

            if name is None:
                # As a last resort, synthesize id from selected fields
                name = '-'.join([str(r.get(f)) for f in selected_fields if f in r]) or 'user'

            # Only include selected fields as custom_properties (normalized keys)
            custom_props = {}
            for f in selected_fields:
                if f in r and r[f] not in [None, '']:
                    custom_props[field_name_map.get(f, f)] = r[f]

            user_entry = {
                'name': str(name),
                'custom_properties': custom_props
            }
            # display_name is not a base LocalUser field; include as custom property instead
            if display_name and 'display_name' not in user_entry['custom_properties']:
                user_entry['custom_properties']['display_name'] = str(display_name)
            if email_val:
                user_entry['email'] = str(email_val)
                # include identity to help Veza link IdP identities
                user_entry['identities'] = [str(email_val)]

            local_users.append(user_entry)

        # Define property definitions for local users to match custom_properties
        # Default all selected fields to STRING to avoid schema mismatches (Veza expects enum string values)
        local_user_properties = { field_name_map[f]: 'STRING' for f in selected_fields }

        application_object = {
            'custom_property_definition': {
                'applications': [
                    {
                        'application_type': 'csv_application',
                        'application_properties': {},
                        'local_user_properties': local_user_properties,
                        'local_group_properties': {},
                        'local_role_properties': {},
                        'role_assignment_properties': {},
                        'local_access_creds_properties': {},
                        'resources': []
                    }
                ]
            },
            'applications': [
                {
                    'name': 'Generated Application',
                    'application_type': 'csv_application',
                    'description': 'Generated from input mapping',
                    'local_users': local_users,
                    'local_groups': [],
                    'local_roles': [],
                    'local_access_creds': [],
                    'tags': [],
                    'custom_properties': {}
                }
            ],
            'permissions': [],
            'identity_to_permissions': []
        }
        return application_object

    def _normalize_oaa_application_object(app_obj: dict) -> dict:
        """Normalize a transform-produced application_object to match oaaclient template expectations.
        - Converts legacy 'property_definitions' array into 'local_user_properties'
        - Ensures required keys exist
        - Adds any missing local_user_properties referenced by local_users.custom_properties (as STRING)
        """
        try:
            if not isinstance(app_obj, dict):
                return app_obj
            meta = dict(app_obj)
            cpd = (meta.get('custom_property_definition') or {})
            apps_list = cpd.get('applications') or []
            if not apps_list:
                # Create minimal structure
                cpd = {'applications': [{'application_type': 'csv_application'}]}
                meta['custom_property_definition'] = cpd
                apps_list = cpd['applications']
            first = apps_list[0] if isinstance(apps_list, list) and apps_list else {}
            # If legacy property_definitions present, map to local_user_properties
            prop_defs = first.get('property_definitions')
            lup = first.get('local_user_properties')
            if isinstance(prop_defs, list) and (not lup or not isinstance(lup, dict)):
                mapped = {}
                for item in prop_defs:
                    try:
                        name = item.get('name')
                        dtype = (item.get('data_type') or '').upper()
                        oaa_type = 'STRING'
                        if dtype in ['BOOLEAN', 'NUMBER', 'STRING', 'STRING_LIST', 'TIMESTAMP']:
                            oaa_type = dtype
                        mapped[name] = oaa_type
                    except Exception:
                        continue
                first['local_user_properties'] = mapped
                # remove legacy field
                try:
                    del first['property_definitions']
                except Exception:
                    pass
                # write back
                cpd['applications'][0] = first
                meta['custom_property_definition'] = cpd

            # Ensure all custom_properties used by users are declared in local_user_properties
            if not isinstance(first.get('local_user_properties'), dict):
                first['local_user_properties'] = {}
            declared = first['local_user_properties']
            try:
                apps_payload = (meta.get('applications') or [])
                if apps_payload and isinstance(apps_payload[0], dict):
                    local_users = apps_payload[0].get('local_users') or []
                    added_count = 0
                    for u in local_users:
                        if not isinstance(u, dict):
                            continue
                        custom_props = u.get('custom_properties') or {}
                        if isinstance(custom_props, dict):
                            for key in custom_props.keys():
                                if key not in declared:
                                    declared[key] = 'STRING'
                                    added_count += 1
                    if added_count:
                        print(f"🛠️ Normalized application_object: added {added_count} local_user_properties")
            except Exception:
                pass

            # Ensure application_type is present
            if 'application_type' not in first:
                first['application_type'] = 'csv_application'
                cpd['applications'][0] = first
                meta['custom_property_definition'] = cpd

            # Sanitize applications payload
            apps_payload = meta.get('applications')
            if not isinstance(apps_payload, list) or not apps_payload:
                apps_payload = [{}]
            app0 = apps_payload[0] if isinstance(apps_payload, list) else {}
            if not isinstance(app0, dict):
                app0 = {}
            # Default required app fields
            if not app0.get('name'):
                app0['name'] = 'Generated Application'
            app_type = app0.get('application_type')
            if not isinstance(app_type, str) or not app_type.strip():
                app0['application_type'] = 'csv_application'
            # Ensure local_users structure is valid and clean
            local_users = app0.get('local_users') or []
            cleaned_users = []
            for u in local_users if isinstance(local_users, list) else []:
                if not isinstance(u, dict):
                    continue
                cu = {}
                # name is required; coerce to string if present
                if u.get('name') not in [None, '']:
                    cu['name'] = str(u['name'])
                # email optional
                if u.get('email') not in [None, '']:
                    cu['email'] = str(u['email'])
                # identities should be list[str]
                identities = u.get('identities')
                if isinstance(identities, list):
                    ids = [str(x) for x in identities if x not in [None, '']]
                    if ids:
                        cu['identities'] = ids
                elif isinstance(identities, str) and identities.strip():
                    cu['identities'] = [identities]
                # custom_properties: drop null/empty keys
                cps = u.get('custom_properties') if isinstance(u.get('custom_properties'), dict) else {}
                cps_clean = {k: v for k, v in cps.items() if k and v not in [None, '']}
                if cps_clean:
                    cu['custom_properties'] = cps_clean
                # Keep only if at least has name or custom_properties
                if cu:
                    cleaned_users.append(cu)
            app0['local_users'] = cleaned_users
            # Ensure maps exist for other optional arrays
            app0.setdefault('local_groups', [])
            app0.setdefault('local_roles', [])
            app0.setdefault('local_access_creds', [])
            app0.setdefault('tags', [])
            app0.setdefault('custom_properties', {})
            meta['applications'] = [app0]
            return meta
        except Exception:
            return app_obj

    for param_name, mapping in parameter_mappings.items():
        try:
            if mapping.get('type') == 'direct':
                # Special handling for application_object
                if param_name == 'application_object':
                    source_field = mapping.get('source')
                    sources = mapping.get('sources')
                    # 0) If the transform output wrapped the application object under a key, pass it through
                    if isinstance(data_source, dict):
                        # Common case: { application_object: { ... } }
                        if 'application_object' in data_source and isinstance(data_source['application_object'], dict):
                            mapped_params[param_name] = _normalize_oaa_application_object(data_source['application_object'])
                            continue
                        # If a single source key was chosen via multi-select and it resolves to an app object
                        if isinstance(sources, list) and len(sources) == 1:
                            k = sources[0]
                            if k in data_source and isinstance(data_source[k], dict) and (
                                'applications' in data_source[k] and 'custom_property_definition' in data_source[k]
                            ):
                                mapped_params[param_name] = _normalize_oaa_application_object(data_source[k])
                                continue
                    # 1) If transform already produced an OAA application_object, pass it through
                    if isinstance(data_source, dict) and 'applications' in data_source and 'custom_property_definition' in data_source:
                        mapped_params[param_name] = _normalize_oaa_application_object(data_source)
                    elif source_field:
                        # 2) If a specific field was selected, try to pass that object through
                        if isinstance(data_source, dict) and source_field in data_source and isinstance(data_source[source_field], dict):
                            mapped_params[param_name] = _normalize_oaa_application_object(data_source[source_field])
                        elif isinstance(data_source, list) and len(data_source) > 0 and isinstance(data_source[0], dict) and source_field in data_source[0] and isinstance(data_source[0][source_field], dict):
                            mapped_params[param_name] = _normalize_oaa_application_object(data_source[0][source_field])
                        else:
                            # Fallback to synthesize if not found
                            selected_fields = sources if isinstance(sources, list) and len(sources) > 0 else []
                            if not selected_fields:
                                if isinstance(data_source, list) and len(data_source) > 0 and isinstance(data_source[0], dict):
                                    selected_fields = list(data_source[0].keys())
                                elif isinstance(data_source, dict):
                                    selected_fields = list(data_source.keys())
                                if source_field and source_field not in selected_fields:
                                    selected_fields = [source_field] + selected_fields
                            mapped_params[param_name] = _build_minimal_oaa_application_object(
                                data_source,
                                selected_fields,
                                mapping.get('userFieldHints') if isinstance(mapping, dict) else None
                            )
                    else:
                        # 3) No explicit source; synthesize from selected fields or all fields
                        selected_fields = sources if isinstance(sources, list) and len(sources) > 0 else []
                        if not selected_fields:
                            if isinstance(data_source, list) and len(data_source) > 0 and isinstance(data_source[0], dict):
                                selected_fields = list(data_source[0].keys())
                            elif isinstance(data_source, dict):
                                selected_fields = list(data_source.keys())
                        mapped_params[param_name] = _build_minimal_oaa_application_object(
                            data_source,
                            selected_fields,
                            mapping.get('userFieldHints') if isinstance(mapping, dict) else None
                        )
                else:
                    # Direct field mapping for non-application params
                    source_field = mapping.get('source')
                    sources = mapping.get('sources')
                    if sources and isinstance(sources, list):
                        # For non-object params, collect values from first row or object
                        if isinstance(data_source, list) and len(data_source) > 0 and isinstance(data_source[0], dict):
                            row = data_source[0]
                            mapped_params[param_name] = [row.get(f) for f in sources if f in row]
                        elif isinstance(data_source, dict):
                            mapped_params[param_name] = [data_source.get(f) for f in sources if f in data_source]
                    elif source_field and isinstance(data_source, list) and len(data_source) > 0:
                        # If data is a list (like CSV rows), take from first row
                        if isinstance(data_source[0], dict) and source_field in data_source[0]:
                            mapped_params[param_name] = data_source[0][source_field]
                    elif source_field and isinstance(data_source, dict) and source_field in data_source:
                        # If data is a dict, get the field directly
                        mapped_params[param_name] = data_source[source_field]
                    
            elif mapping.get('type') == 'constant':
                # Constant value
                mapped_params[param_name] = _coerce_bool(mapping.get('value'))
                
            elif mapping.get('type') == 'expression':
                # Expression evaluation (basic support)
                expression = mapping.get('expression', '')
                if expression:
                    # For now, just return the expression as-is
                    # In a full implementation, you'd evaluate the expression
                    mapped_params[param_name] = expression
            elif mapping.get('type') == 'concatenate':
                delimiter = mapping.get('delimiter', ' ')
                parts = mapping.get('parts') or mapping.get('sources') or []
                values = []
                row = data_source[0] if isinstance(data_source, list) and data_source else (data_source if isinstance(data_source, dict) else {})
                for p in parts:
                    try:
                        if isinstance(p, dict):
                            if p.get('type') == 'field' and p.get('name'):
                                val = row.get(p['name'])
                                if val is not None and val != '':
                                    values.append(str(val))
                            elif p.get('type') == 'literal':
                                values.append(str(p.get('value', '')))
                        elif isinstance(p, str):
                            val = row.get(p)
                            if val is not None and val != '':
                                values.append(str(val))
                    except Exception:
                        continue
                mapped_params[param_name] = delimiter.join(values)
            elif mapping.get('type') == 'split':
                source_field = mapping.get('source')
                delimiter = mapping.get('delimiter', ',')
                row = data_source[0] if isinstance(data_source, list) and data_source else (data_source if isinstance(data_source, dict) else {})
                val = row.get(source_field) if isinstance(row, dict) and source_field else None
                mapped_params[param_name] = [s for s in str(val).split(delimiter)] if val not in [None, ''] else []
                    
        except Exception as e:
            print(f"⚠️ Warning: Could not map parameter {param_name}: {str(e)}")
            continue
    
    print(f"🔧 Parameter mapping result: {mapped_params}")
    return mapped_params

def execute_ai_tools_node(node_id, config, context, user_id):
    """Execute AI tools node - run AI operations"""
    tool_type = config.get('tool_type', 'completion')
    model_choice = config.get('model_choice', 'gpt-4')
    custom_prompt = config.get('custom_prompt', '')
    
    print(f"🤖 Executing AI tools: {tool_type} with model {model_choice}")
    
    # Get input data
    input_data = get_node_input_data(context)
    
    # For now, simulate AI operations since we don't have alden-core integration yet
    try:
        if tool_type == 'completion':
            # Simulate completion
            result = {
                'data': f"AI completion result for prompt: {custom_prompt[:50]}...",
                'visual': None
            }
        elif tool_type == 'analysis':
            # Simulate analysis
            result = {
                'data': f"AI analysis result for {len(input_data.get('data_inputs', []))} data inputs",
                'visual': {
                    'type': 'chart',
                    'data': {'labels': ['Input 1', 'Input 2'], 'values': [75, 85]}
                }
            }
        elif tool_type == 'classification':
            # Simulate classification
            result = {
                'data': f"AI classification result: Class A (confidence: 0.85)",
                'visual': None
            }
        elif tool_type == 'summarization':
            # Simulate summarization
            result = {
                'data': f"AI summarization result: Key points extracted from {len(input_data.get('data_inputs', []))} inputs",
                'visual': None
            }
        else:
            # Default to completion
            result = {
                'data': f"Default AI operation result",
                'visual': None
            }
        
        return {
            'type': 'ai_result',
            'tool_type': tool_type,
            'model': model_choice,
            'data': result.get('data'),
            'visual': result.get('visual'),
            'timestamp': time.time()
        }
        
    except Exception as e:
        raise Exception(f"AI operation failed: {str(e)}")

def execute_visual_preview_node(node_id, config, context, user_id):
    """Execute visual preview node - display visualizations"""
    preview_type = config.get('preview_type', 'plot')
    preview_name = config.get('preview_name', 'Visual Preview')
    
    print(f"👁️ Executing visual preview: {preview_name} ({preview_type})")
    
    # Get visual input data
    visual_data = None
    for ctx_key, ctx_value in context.items():
        if isinstance(ctx_value, dict) and 'visual' in ctx_value:
            visual_data = ctx_value['visual']
            break
    
    if not visual_data:
        # Create sample visual data if none provided
        visual_data = {
            'type': preview_type,
            'data': {
                'labels': ['Sample 1', 'Sample 2', 'Sample 3'],
                'values': [10, 20, 30]
            }
        }
        print(f"⚠️ No visual data found, using sample data")
    
    # Store preview data for frontend display
    preview_id = f"preview_{node_id}_{int(time.time())}"
    
    # TODO: Store in database or cache for frontend retrieval
    # For now, just return the preview data
    preview_data = {
        'preview_id': preview_id,
        'type': preview_type,
        'name': preview_name,
        'data': visual_data,
        'timestamp': time.time()
    }
    
    return {
        'type': 'visual_preview',
        'preview_id': preview_id,
        'preview_type': preview_type,
        'preview_name': preview_name,
        'preview_data': preview_data,
        'status': 'displayed'
    }

 