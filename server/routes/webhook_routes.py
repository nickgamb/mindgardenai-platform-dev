from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import get_mgflow
import logging
import json
import threading
from .flow_routes import execute_flow_background


def setup_webhook_routes(app, socketio):
    """Setup webhook routes for flow triggers"""
    
    @app.route('/api/webhooks/trigger/<mgflow_id>/<trigger_node_id>', methods=['POST'])
    def webhook_trigger_flow(mgflow_id, trigger_node_id):
        """
        Webhook endpoint to trigger flow execution.
        ---
        post:
          summary: Trigger flow via webhook
          description: Execute a mgflow flow via webhook trigger
          tags:
            - webhooks
          parameters:
            - name: mgflow_id
              in: path
              required: true
              schema:
                type: string
              description: ID of the mgflow to execute
            - name: trigger_node_id
              in: path
              required: true
              schema:
                type: string
              description: ID of the trigger node that should start the flow
          requestBody:
            required: false
            content:
              application/json:
                schema:
                  type: object
                  description: Optional payload data to pass to the flow
          responses:
            '200':
              description: Flow execution started successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                      message:
                        type: string
                      execution_id:
                        type: string
            '400':
              description: Invalid request or mgflow not found
            '500':
              description: Failed to start flow execution
        """
        try:
            logging.info(f"🔗 Webhook triggered for mgflow {mgflow_id}, trigger node {trigger_node_id}")
            
            # Get webhook payload (optional)
            webhook_payload = request.get_json() or {}
            
            # Get mgflow data from database
            mgflow = get_mgflow(mgflow_id)
            if not mgflow:
                return jsonify({
                    "status": "error",
                    "message": f"MGFlow {mgflow_id} not found"
                }), 404
            
            # Parse the mgflow flow data
            try:
                flow_data = json.loads(mgflow['mgflow_flow'])
            except (json.JSONDecodeError, KeyError):
                return jsonify({
                    "status": "error",
                    "message": "Invalid mgflow flow data"
                }), 400
            
            # Find the specific trigger node and verify it's a webhook trigger
            trigger_node = None
            for node in flow_data.get('nodes', []):
                if (node.get('id') == trigger_node_id and 
                    node.get('type') == 'flow_trigger' and
                    node.get('data', {}).get('config', {}).get('trigger_type') == 'webhook'):
                    trigger_node = node
                    break
            
            if not trigger_node:
                return jsonify({
                    "status": "error",
                    "message": f"Webhook trigger node {trigger_node_id} not found or not configured for webhooks"
                }), 404
            
            # Add webhook payload to the trigger node configuration
            if 'data' not in trigger_node:
                trigger_node['data'] = {}
            if 'config' not in trigger_node['data']:
                trigger_node['data']['config'] = {}
            
            trigger_node['data']['config']['webhook_payload'] = webhook_payload
            trigger_node['data']['config']['webhook_triggered'] = True
            
            # Get user ID from mgflow
            user_id = mgflow['user_id']
            
            # Start flow execution in background thread
            execution_thread = threading.Thread(
                target=execute_flow_background,
                args=(flow_data, user_id, socketio)
            )
            execution_thread.daemon = True
            execution_thread.start()
            
            execution_id = f"webhook_{mgflow_id}_{int(__import__('time').time())}"
            
            logging.info(f"✅ Webhook flow execution started: {execution_id}")
            
            return jsonify({
                "status": "success",
                "message": "Flow execution triggered via webhook",
                "execution_id": execution_id,
                "mgflow_id": mgflow_id,
                "trigger_node_id": trigger_node_id,
                "payload_received": bool(webhook_payload)
            }), 200
            
        except Exception as e:
            logging.error(f"❌ Webhook trigger failed: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Failed to trigger flow: {str(e)}"
            }), 500

    @app.route('/api/webhooks/test/<mgflow_id>/<trigger_node_id>', methods=['GET'])
    def test_webhook_endpoint(mgflow_id, trigger_node_id):
        """
        Test webhook endpoint to verify it's working.
        ---
        get:
          summary: Test webhook endpoint
          description: Test if a webhook endpoint is accessible and configured properly
          tags:
            - webhooks
          parameters:
            - name: mgflow_id
              in: path
              required: true
              schema:
                type: string
            - name: trigger_node_id
              in: path
              required: true
              schema:
                type: string
          responses:
            '200':
              description: Webhook endpoint is working
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
                      message:
                        type: string
                      webhook_url:
                        type: string
        """
        webhook_url = f"{request.host_url}api/webhooks/trigger/{mgflow_id}/{trigger_node_id}"
        
        return jsonify({
            "status": "success",
            "message": "Webhook endpoint is active and ready to receive triggers",
            "mgflow_id": mgflow_id,
            "trigger_node_id": trigger_node_id,
            "webhook_url": webhook_url,
            "methods": ["POST"],
            "timestamp": __import__('time').time()
        }), 200