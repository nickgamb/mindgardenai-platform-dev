from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import add_transform, get_transforms, update_transform, delete_transform
import logging

def setup_transform_routes(app):
# Transform routes
    @app.route('/api/transforms', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_transforms():
        """
        Get all transforms for the authenticated user.
        ---
        get:
          summary: Get transforms
          description: Retrieve all transforms for the authenticated user.
          tags:
            - transforms
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
                      transforms:
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
                            transform_type:
                              type: string
                            parameters:
                              type: object
            '401':
              description: Unauthorized
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            transforms = get_transforms(user_id)
            return jsonify({"transforms": transforms})
        except Exception as e:
            print(f"❌ Error fetching transforms: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/transforms', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_add_transform():
        """
        Add a new transform for the authenticated user.
        ---
        post:
          summary: Add transform
          description: Create a new transform for the authenticated user.
          tags:
            - transforms
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
                    transform_type:
                      type: string
                    parameters:
                      type: string
                      description: Python script for mgflow data transformation
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
              description: Transform added successfully
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
              description: Failed to add transform
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
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            data = request.json
            add_transform(user_id, data['name'], data['description'], data['transform_type'], data['parameters'], data.get('shared_with'), data.get('studies'))
            return jsonify({"status": "success", "message": "Transform added successfully"})
        except Exception as e:
            print(f"❌ Error adding transform: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/transforms/<int:id>', methods=['PUT'])
    @requires_auth
    @requires_rbac
    def api_update_transform(id):
        """
        Update an existing transform for the authenticated user.
        ---
        put:
          summary: Update transform
          description: Update an existing transform for the authenticated user.
          tags:
            - transforms
          security:
            - BearerAuth: []
          parameters:
            - in: path
              name: id
              required: true
              schema:
                type: integer
              description: The ID of the transform to update
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
                    transform_type:
                      type: string
                    parameters:
                      type: string
                      description: Python script for mgflow data transformation
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
              description: Transform updated successfully
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
              description: Transform not found
            '500':
              description: Failed to update transform
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
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            data = request.json
            update_transform(id, user_id, data['name'], data['description'], data['transform_type'], data['parameters'], data.get('shared_with'), data.get('studies'))
            return jsonify({"status": "success", "message": "Transform updated successfully"})
        except Exception as e:
            print(f"❌ Error updating transform: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/transforms/<int:id>', methods=['DELETE'])
    @requires_auth
    @requires_rbac
    def api_delete_transform(id):
        """
        Delete a transform for the authenticated user.
        ---
        delete:
          summary: Delete transform
          description: Delete a transform for the authenticated user.
          tags:
            - transforms
          security:
            - BearerAuth: []
          parameters:
            - in: path
              name: id
              required: true
              schema:
                type: integer
              description: The ID of the transform to delete
          responses:
            '200':
              description: Transform deleted successfully
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
              description: Transform not found
            '500':
              description: Failed to delete transform
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
        print(f"🗑️ DELETE /api/transforms/{id} - User ID: {session.get('user', {}).get('sub', 'Unknown')}")
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            delete_transform(id, user_id)
            print(f"✅ Successfully deleted transform {id}")
            return jsonify({"status": "success", "message": "Transform deleted successfully"})
        except Exception as e:
            print(f"❌ Error deleting transform {id}: {str(e)}")
            return jsonify({"status": "error", "message": f"Failed to delete transform: {str(e)}"}), 500

    # Transform Settings Routes
    @app.route('/api/transform-settings', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_transform_settings():
        """
        Get transform settings for the authenticated user.
        ---
        get:
          summary: Get transform settings
          description: Retrieve transform execution and processing settings for the authenticated user.
          tags:
            - transforms
          security:
            - BearerAuth: []
          responses:
            '200':
              description: Transform settings retrieved successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      executionTimeout:
                        type: integer
                        description: Maximum execution time in seconds
                      memoryLimit:
                        type: integer
                        description: Memory limit in MB
                      retryAttempts:
                        type: integer
                        description: Number of retry attempts on failure
                      enableValidation:
                        type: boolean
                        description: Enable data validation
                      csvDelimiter:
                        type: string
                        description: CSV delimiter character
                      skipEmptyRows:
                        type: boolean
                        description: Skip empty rows in CSV files
                      enableLogging:
                        type: boolean
                        description: Enable transform execution logging
                      errorHandling:
                        type: string
                        description: Error handling strategy
            '401':
              description: Unauthorized
            '500':
              description: Failed to get transform settings
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            
            # For now, return default settings - later can be user-specific from database
            settings = {
                'executionTimeout': 30,
                'memoryLimit': 512,
                'retryAttempts': 3,
                'enableValidation': True,
                'csvDelimiter': ',',
                'skipEmptyRows': True,
                'enableLogging': True,
                'errorHandling': 'retry'
            }
            return jsonify(settings)
        except Exception as e:
            print(f"❌ Error getting transform settings: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/transform-settings', methods=['PUT'])
    @requires_auth
    @requires_rbac
    def api_update_transform_settings():
        """
        Update transform settings for the authenticated user.
        ---
        put:
          summary: Update transform settings
          description: Update transform execution and processing settings for the authenticated user.
          tags:
            - transforms
          security:
            - BearerAuth: []
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    executionTimeout:
                      type: integer
                      description: Maximum execution time in seconds
                    memoryLimit:
                      type: integer
                      description: Memory limit in MB
                    retryAttempts:
                      type: integer
                      description: Number of retry attempts on failure
                    enableValidation:
                      type: boolean
                      description: Enable data validation
                    csvDelimiter:
                      type: string
                      description: CSV delimiter character
                    skipEmptyRows:
                      type: boolean
                      description: Skip empty rows in CSV files
                    enableLogging:
                      type: boolean
                      description: Enable transform execution logging
                    errorHandling:
                      type: string
                      description: Error handling strategy
          responses:
            '200':
              description: Transform settings updated successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            '401':
              description: Unauthorized
            '500':
              description: Failed to update transform settings
        """
        try:
            user_id = session.get('user', {}).get('sub')
            if not user_id:
                print("❌ No user_id found in session")
                return jsonify({"error": "User not authenticated"}), 401
            data = request.get_json()
            
            # For now, just acknowledge the settings - later can store in database
            print(f"✅ Transform settings updated for user {user_id}: {data}")
            return jsonify({"message": "Transform settings updated successfully"})
        except Exception as e:
            print(f"❌ Error updating transform settings: {str(e)}")
            return jsonify({"error": str(e)}), 500
