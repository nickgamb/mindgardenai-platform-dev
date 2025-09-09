from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import add_model, get_models, update_model, delete_model
import logging

def setup_model_routes(app):
  # Models routes
  @app.route('/api/models', methods=['GET'])
  @requires_auth
  @requires_rbac
  def api_get_models():
      """
      Get all models for the authenticated user.
      ---
      get:
        summary: Get models
        description: Retrieve all models for the authenticated user.
        tags:
          - models
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
                    models:
                      type: array
                      items:
                        type: object
                        properties:
                          id:
                            type: integer
                          name:
                            type: string
                          description:
                            type: string
                          model_type:
                            type: string
                          parameters:
                            type: object
          '401':
            description: Unauthorized
      """
      user_id = session['user']['sub']
      models = get_models(user_id)
      return jsonify({"models": models})

  @app.route('/api/models', methods=['POST'])
  @requires_auth
  @requires_rbac
  def api_add_model():
      """
      Add a new model for the authenticated user.
      ---
      post:
        summary: Add model
        description: Create a new model for the authenticated user.
        tags:
          - models
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
                  description:
                    type: string
                  model_type:
                    type: string
                  parameters:
                    type: object
                  shared_with:
                    type: array
                    items:
                      type: string
                  studies:
                    type: array
                    items:
                      type: integer
        responses:
          '200':
            description: Model added successfully
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
            description: Failed to add model
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
      user_id = session['user']['sub']
      data = request.json
      add_model(user_id, data['name'], data['description'], data['model_type'], data['parameters'], data.get('shared_with'), data.get('studies'))
      return jsonify({"status": "success", "message": "Model added successfully"})

  @app.route('/api/models/<int:id>', methods=['PUT'])
  @requires_auth
  @requires_rbac
  def api_update_model(id):
      """
      Update an existing model for the authenticated user.
      ---
      put:
        summary: Update model
        description: Update an existing model for the authenticated user.
        tags:
          - models
        security:
          - BearerAuth: []
        parameters:
          - in: path
            name: id
            required: true
            schema:
              type: integer
            description: The ID of the model to update
        requestBody:
          required: true
          content:
            application/json:
              schema:
                type: object
                properties:
                  name:
                    type: string
                  description:
                    type: string
                  model_type:
                    type: string
                  parameters:
                    type: object
                  shared_with:
                    type: array
                    items:
                      type: string
                  studies:
                    type: array
                    items:
                      type: integer
        responses:
          '200':
            description: Model updated successfully
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
          '404':
            description: Model not found
          '500':
            description: Failed to update model
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
      user_id = session['user']['sub']
      data = request.json
      update_model(id, user_id, data['name'], data['description'], data['model_type'], data['parameters'], data.get('shared_with'), data.get('studies'))
      return jsonify({"status": "success", "message": "Model updated successfully"})

  @app.route('/api/models/<int:id>', methods=['DELETE'])
  @requires_auth
  @requires_rbac
  def api_delete_model(id):
      """
      Delete a model for the authenticated user.
      ---
      delete:
        summary: Delete model
        description: Delete an existing model for the authenticated user.
        tags:
          - models
        security:
          - BearerAuth: []
        parameters:
          - in: path
            name: id
            required: true
            schema:
              type: integer
            description: The ID of the model to delete
        responses:
          '200':
            description: Model deleted successfully
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
          '404':
            description: Model not found
          '500':
            description: Failed to delete model
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
      user_id = session['user']['sub']
      delete_model(id, user_id)
      return jsonify({"status": "success", "message": "Model deleted successfully"})
