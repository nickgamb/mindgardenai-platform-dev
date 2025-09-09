from flask import jsonify, request, session
from services.auth import requires_auth, login, logout, callback, get_user_info, requires_rbac
import logging

def setup_auth_routes(app):
    app.add_url_rule('/api/login', 'login', login, methods=['POST'])
    app.add_url_rule('/api/logout', 'logout', logout, methods=['POST'])
    app.add_url_rule('/api/callback', 'callback', callback)

    @app.route('/api/user', methods=['GET'])
    @requires_auth
    @requires_rbac
    def get_user():
        """
        Get the current user's information.
        ---
        get:
          summary: Get user information
          description: Retrieve information about the currently authenticated user.
          tags:
            - auth
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
                      sub:
                        type: string
                      name:
                        type: string
                      email:
                        type: string
            '401':
              description: Unauthorized
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      error:
                        type: string
        """
        # User info is now available from @requires_auth decorator (ai-core style)
        # The decorator validates the token and stores user info in request.current_user
        user_info = getattr(request, 'current_user', None)
        if user_info:
            return jsonify(user_info)
        
        return jsonify({"error": "Unable to retrieve user information"}), 401

    @app.route('/api/refresh-token', methods=['POST'])
    def refresh_token_route():
        """
        Refresh the access token using a refresh token.
        ---
        post:
          summary: Refresh access token
          description: Use a refresh token to obtain a new access token.
          tags:
            - auth
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    refresh_token:
                      type: string
                  required:
                    - refresh_token
          responses:
            '200':
              description: Successful token refresh
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      access_token:
                        type: string
                      refresh_token:
                        type: string
            '400':
              description: Bad request
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      error:
                        type: string
            '401':
              description: Unauthorized
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      error:
                        type: string
        """
        refresh_token = request.json.get('refresh_token')
        if not refresh_token:
            return jsonify({"error": "No refresh token provided"}), 400
        try:
            new_tokens = refresh_token(refresh_token)
            return jsonify(new_tokens), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 401

    @app.route('/api/verify-token', methods=['POST'])
    def verify_token():
        """
        Verify the validity of a token.
        ---
        post:
          summary: Verify token
          description: Check if the provided token is valid.
          tags:
            - auth
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    token:
                      type: string
          responses:
            '200':
              description: Token verification result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      isValid:
                        type: boolean
            '400':
              description: No token provided
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      error:
                        type: string
        """
        token = request.json.get('token')
        if not token:
            return jsonify({"error": "No token provided"}), 400

        try:
            payload = validate_token(token)
            if payload:
                return jsonify({"isValid": True}), 200
            else:
                return jsonify({"isValid": False}), 200
        except Exception as e:
            logging.error(f"Error verifying token: {str(e)}")
            return jsonify({"isValid": False}), 200

    @app.route('/api/universal-logout', methods=['POST'])
    def universal_logout():
        """
        Handle universal logout requests.
        ---
        post:
          summary: Universal logout
          description: Process universal logout requests for users.
          tags:
            - auth
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    subject:
                      type: object
                      properties:
                        format:
                          type: string
                          enum: [email, iss_sub]
                        email:
                          type: string
                        iss:
                          type: string
                        sub:
                          type: string
          responses:
            '204':
              description: Successful logout
            '400':
              description: Bad request
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      error:
                        type: string
            '401':
              description: Unauthorized
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      error:
                        type: string
            '404':
              description: User not found
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      error:
                        type: string
            '422':
              description: Unable to process logout request
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      error:
                        type: string
        """
        jwt_payload = validate_universal_logout_jwt(request.headers.get('Authorization'))
        if not jwt_payload:
            return jsonify({"error": "Invalid JWT"}), 401

        data = request.json
        subject = data.get('subject')
        if not subject:
            return jsonify({"error": "Missing subject in request body"}), 400

        try:
            if subject['format'] == 'email':
                success = logout_user_by_email(subject['email'])
            elif subject['format'] == 'iss_sub':
                success = logout_user_by_id(subject['iss'], subject['sub'])
            else:
                return jsonify({"error": "Unsupported subject format"}), 400

            if success:
                return '', 204  # Successful logout
            else:
                return jsonify({"error": "User not found"}), 404
        except Exception as e:
            logging.error(f"Error during universal logout: {str(e)}")
            return jsonify({"error": "Unable to process logout request"}), 422
