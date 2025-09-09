import logging
import json
import inspect
import sys
import os
from flask import request, session, jsonify
from services.auth import requires_auth, requires_rbac

# Add the OAA client path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'lib'))

def setup_plugins_routes(app):
    """Setup plugins introspection routes"""
    
    @app.route('/api/plugins', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_plugins():
        """Get list of available plugins"""
        print("🎯 GET /api/plugins - Get available plugins")
        
        try:
            # For now, we only support OAA SDK
            plugins = [
                {
                    'id': 'oaa_sdk',
                    'name': 'Veza OAA SDK',
                    'description': 'Veza Open Authorization API SDK for managing providers and data sources',
                    'type': 'oaa',
                    'version': '1.1.15'
                }
            ]
            
            return jsonify({
                "status": "success",
                "plugins": plugins
            })
            
        except Exception as e:
            print(f"❌ Error getting plugins: {str(e)}")
            return jsonify({
                "status": "error", 
                "message": f"Failed to get plugins: {str(e)}"
            }), 500

    @app.route('/api/plugins/<plugin_id>/functions', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_plugin_functions(plugin_id):
        """Get list of functions available in a plugin"""
        print(f"🎯 GET /api/plugins/{plugin_id}/functions - Get plugin functions")
        
        try:
            if plugin_id == 'oaa_sdk':
                functions = get_oaa_sdk_functions()
            else:
                return jsonify({
                    "status": "error",
                    "message": f"Unknown plugin: {plugin_id}"
                }), 404
            
            return jsonify({
                "status": "success",
                "functions": functions
            })
            
        except Exception as e:
            print(f"❌ Error getting plugin functions: {str(e)}")
            return jsonify({
                "status": "error", 
                "message": f"Failed to get plugin functions: {str(e)}"
            }), 500

    @app.route('/api/plugins/<plugin_id>/functions/<function_name>/parameters', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_function_parameters(plugin_id, function_name):
        """Get parameters for a specific function"""
        print(f"🎯 GET /api/plugins/{plugin_id}/functions/{function_name}/parameters - Get function parameters")
        
        try:
            if plugin_id == 'oaa_sdk':
                parameters = get_oaa_function_parameters(function_name)
            else:
                return jsonify({
                    "status": "error",
                    "message": f"Unknown plugin: {plugin_id}"
                }), 404
            
            return jsonify({
                "status": "success",
                "parameters": parameters
            })
            
        except Exception as e:
            print(f"❌ Error getting function parameters: {str(e)}")
            return jsonify({
                "status": "error", 
                "message": f"Failed to get function parameters: {str(e)}"
            }), 500

def get_oaa_sdk_functions():
    """Get available functions from the OAA SDK"""
    try:
        from oaaclient.client import OAAClient
        
        # Get all public methods from OAAClient
        functions = []
        for name, method in inspect.getmembers(OAAClient, predicate=inspect.ismethod):
            if not name.startswith('_') and name not in ['update_user_agent']:  # Skip private methods and utility methods
                try:
                    sig = inspect.signature(method)
                    doc = inspect.getdoc(method) or f"{name} method"
                    
                    functions.append({
                        'name': name,
                        'description': doc.split('\n')[0] if doc else f"{name} method",
                        'category': get_function_category(name),
                        'parameters': []  # Will be populated when function is selected
                    })
                except Exception as e:
                    print(f"Warning: Could not introspect method {name}: {str(e)}")
                    continue
        
        # Add some static high-level functions that are commonly used
        common_functions = [
            {
                'name': 'create_provider',
                'description': 'Create a new Provider',
                'category': 'provider_management',
                'parameters': []
            },
            {
                'name': 'get_provider',
                'description': 'Get Provider by name',
                'category': 'provider_management', 
                'parameters': []
            },
            {
                'name': 'create_data_source',
                'description': 'Create a new Data Source for a Provider',
                'category': 'data_source_management',
                'parameters': []
            },
            {
                'name': 'push_metadata',
                'description': 'Push an OAA payload dictionary to Veza',
                'category': 'data_operations',
                'parameters': []
            },
            {
                'name': 'push_application',
                'description': 'Push an OAA Application Object',
                'category': 'data_operations',
                'parameters': []
            }
        ]
        
        return common_functions
        
    except ImportError as e:
        print(f"Warning: Could not import OAA client: {str(e)}")
        # Return static function list if import fails
        return [
            {
                'name': 'create_provider',
                'description': 'Create a new Provider',
                'category': 'provider_management',
                'parameters': []
            },
            {
                'name': 'get_provider',
                'description': 'Get Provider by name',
                'category': 'provider_management',
                'parameters': []
            }
        ]

def get_function_category(function_name):
    """Categorize OAA SDK functions"""
    if any(keyword in function_name for keyword in ['provider', 'create_provider', 'get_provider', 'delete_provider']):
        return 'provider_management'
    elif any(keyword in function_name for keyword in ['data_source', 'datasource']):
        return 'data_source_management'
    elif any(keyword in function_name for keyword in ['push', 'metadata', 'application']):
        return 'data_operations'
    elif any(keyword in function_name for keyword in ['query', 'report']):
        return 'reporting'
    else:
        return 'utility'

def get_oaa_function_parameters(function_name):
    """Get parameters for a specific OAA SDK function"""
    try:
        from oaaclient.client import OAAClient
        
        # Get the method from OAAClient
        if hasattr(OAAClient, function_name):
            method = getattr(OAAClient, function_name)
            sig = inspect.signature(method)
            
            parameters = []
            for param_name, param in sig.parameters.items():
                if param_name == 'self':  # Skip self parameter
                    continue
                    
                param_info = {
                    'name': param_name,
                    'type': get_parameter_type(param),
                    'required': param.default == inspect.Parameter.empty,
                    'default': None if param.default == inspect.Parameter.empty else param.default,
                    'description': f"Parameter for {function_name}"
                }
                
                parameters.append(param_info)
            
            return parameters
        else:
            # Return static parameter definitions for common functions
            return get_static_function_parameters(function_name)
            
    except Exception as e:
        print(f"Warning: Could not get parameters for {function_name}: {str(e)}")
        return get_static_function_parameters(function_name)

def get_parameter_type(param):
    """Get the type of a parameter from its annotation"""
    if param.annotation != inspect.Parameter.empty:
        if hasattr(param.annotation, '__name__'):
            return param.annotation.__name__
        else:
            return str(param.annotation)
    return 'string'

def get_static_function_parameters(function_name):
    """Get static parameter definitions for common OAA functions"""
    static_params = {
        'create_provider': [
            {'name': 'name', 'type': 'string', 'required': True, 'description': 'Provider name'},
            {'name': 'custom_template', 'type': 'string', 'required': True, 'description': 'Template type (application or identity_provider)'},
            {'name': 'base64_icon', 'type': 'string', 'required': False, 'description': 'Base64 encoded icon'},
            {'name': 'options', 'type': 'object', 'required': False, 'description': 'Additional options'}
        ],
        'get_provider': [
            {'name': 'name', 'type': 'string', 'required': True, 'description': 'Provider name to search for'}
        ],
        'create_data_source': [
            {'name': 'name', 'type': 'string', 'required': True, 'description': 'Data source name'},
            {'name': 'provider_id', 'type': 'string', 'required': True, 'description': 'Provider ID'},
            {'name': 'options', 'type': 'object', 'required': False, 'description': 'Additional options'}
        ],
        'push_metadata': [
            {'name': 'provider_name', 'type': 'string', 'required': True, 'description': 'Provider name'},
            {'name': 'data_source_name', 'type': 'string', 'required': True, 'description': 'Data source name'},
            {'name': 'metadata', 'type': 'object', 'required': True, 'description': 'OAA payload dictionary'},
            {'name': 'save_json', 'type': 'boolean', 'required': False, 'description': 'Save JSON to file'},
            {'name': 'options', 'type': 'object', 'required': False, 'description': 'Additional options'}
        ],
        'push_application': [
            {'name': 'provider_name', 'type': 'string', 'required': True, 'description': 'Provider name'},
            {'name': 'data_source_name', 'type': 'string', 'required': True, 'description': 'Data source name'},
            {'name': 'application_object', 'type': 'object', 'required': True, 'description': 'OAA application object'},
            {'name': 'save_json', 'type': 'boolean', 'required': False, 'description': 'Save JSON to file'},
            {'name': 'create_provider', 'type': 'boolean', 'required': False, 'description': 'Create provider if not exists'},
            {'name': 'options', 'type': 'object', 'required': False, 'description': 'Additional options'}
        ]
    }
    
    return static_params.get(function_name, [])
