from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.user_settings import get_user_settings, update_user_settings, get_user_preferences, update_user_preferences
import logging

def setup_user_settings_routes(app):
    # --- USER SETTINGS ---
    @app.route('/api/user/settings', methods=['GET'])
    @requires_auth
    @requires_rbac
    def get_current_user_settings():
        """
        Get the current user's settings.
        ---
        get:
          summary: Get user settings
          description: Retrieve settings for the authenticated user.
          tags:
            - user-settings
          security:
            - BearerAuth: []
          responses:
            '200':
              description: Successful response
              content:
                application/json:
                  schema:
                    type: object
                    description: User settings object
            '401':
              description: Unauthorized
        """
        user_id = session['user']['sub']
        user_settings = get_user_settings(user_id)
        return jsonify(user_settings or {})

    @app.route('/api/user/settings', methods=['PUT'])
    @requires_auth
    @requires_rbac
    def update_current_user_settings():
        """
        Update the current user's settings.
        ---
        put:
          summary: Update user settings
          description: Update settings for the authenticated user.
          tags:
            - user-settings
          security:
            - BearerAuth: []
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  description: User settings to update
          responses:
            '200':
              description: Settings updated successfully
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
              description: Failed to update settings
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
        new_settings = request.json
        try:
            update_user_settings(user_id, new_settings)
            return jsonify({"status": "success", "message": "User settings updated successfully"})
        except Exception as e:
            logging.error(f"Error updating user settings: {e}")
            return jsonify({"status": "error", "message": "Failed to update user settings"}), 500

    # --- USER PREFERENCES ---
    @app.route('/api/user/preferences', methods=['GET'])
    @requires_auth
    @requires_rbac
    def get_current_user_preferences():
        """
        Get the current user's UI preferences.
        ---
        get:
          summary: Get user preferences
          description: Retrieve UI preferences for the authenticated user.
          tags:
            - user-settings
          security:
            - BearerAuth: []
          responses:
            '200':
              description: Successful response
              content:
                application/json:
                  schema:
                    type: object
                    description: User preferences object
            '401':
              description: Unauthorized
        """
        user_id = session['user']['sub']
        preferences = get_user_preferences(user_id)
        return jsonify(preferences)

    @app.route('/api/user/preferences', methods=['PUT'])
    @requires_auth
    @requires_rbac
    def update_current_user_preferences():
        """
        Update the current user's UI preferences.
        ---
        put:
          summary: Update user preferences
          description: Update UI preferences for the authenticated user.
          tags:
            - user-settings
          security:
            - BearerAuth: []
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  description: User preferences to update
          responses:
            '200':
              description: Preferences updated successfully
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
              description: Failed to update preferences
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
        new_preferences = request.json
        try:
            update_user_preferences(user_id, new_preferences)
            return jsonify({"status": "success", "message": "User preferences updated successfully"})
        except Exception as e:
            logging.error(f"Error updating user preferences: {e}")
            return jsonify({"status": "error", "message": "Failed to update user preferences"}), 500 