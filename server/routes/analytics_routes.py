from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import add_analytics, get_analytics, update_analytics, delete_analytics
import logging

def setup_analytics_routes(app):
    # Analytics routes
    @app.route('/api/analytics', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_analytics():
        """
        Get all analytics for the authenticated user.
        ---
        get:
          summary: Get analytics
          description: Retrieve all analytics for the authenticated user.
          tags:
            - analytics
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
                      analytics:
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
                            analysis_type:
                              type: string
                            parameters:
                              type: string
                              description: Python script for analytics processing
                            results:
                              type: object
            '401':
              description: Unauthorized
        """
        user_id = session['user']['sub']
        analytics = get_analytics(user_id)
        return jsonify({"analytics": analytics})

    @app.route('/api/analytics', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_add_analytics():
        """
        Add a new analytics item for the authenticated user.
        ---
        post:
          summary: Add analytics
          description: Create a new analytics item for the authenticated user.
          tags:
            - analytics
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
                    analysis_type:
                      type: string
                    parameters:
                      type: string
                      description: Python script for analytics processing
                    results:
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
              description: Analytics added successfully
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
              description: Failed to add analytics
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
        add_analytics(user_id, data['name'], data['description'], data['analysis_type'], data['parameters'], data['results'], data.get('shared_with'), data.get('studies'))
        return jsonify({"status": "success", "message": "Analytics added successfully"})

    @app.route('/api/analytics/<int:id>', methods=['PUT'])
    @requires_auth
    @requires_rbac
    def api_update_analytics(id):
        """
        Update an existing analytics item for the authenticated user.
        ---
        put:
          summary: Update analytics
          description: Update an existing analytics item for the authenticated user.
          tags:
            - analytics
          security:
            - BearerAuth: []
          parameters:
            - in: path
              name: id
              required: true
              schema:
                type: integer
              description: The ID of the analytics item to update
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
                    analysis_type:
                      type: string
                    parameters:
                      type: string
                      description: Python script for analytics processing
                    results:
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
              description: Analytics updated successfully
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
              description: Analytics not found
            '500':
              description: Failed to update analytics
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
        update_analytics(id, user_id, data['name'], data['description'], data['analysis_type'], data['parameters'], data['results'], data.get('shared_with'), data.get('studies'))
        return jsonify({"status": "success", "message": "Analytics updated successfully"})

    @app.route('/api/analytics/<int:id>', methods=['DELETE'])
    @requires_auth
    @requires_rbac
    def api_delete_analytics(id):
        """
        Delete an analytics item for the authenticated user.
        ---
        delete:
          summary: Delete analytics
          description: Delete an existing analytics item for the authenticated user.
          tags:
            - analytics
          security:
            - BearerAuth: []
          parameters:
            - in: path
              name: id
              required: true
              schema:
                type: integer
              description: The ID of the analytics item to delete
          responses:
            '200':
              description: Analytics deleted successfully
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
              description: Analytics not found
            '500':
              description: Failed to delete analytics
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
        delete_analytics(id, user_id)
        return jsonify({"status": "success", "message": "Analytics deleted successfully"})
