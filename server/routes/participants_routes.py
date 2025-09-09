from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import add_participant, get_participants, update_participant, delete_participant
import logging

def setup_participants_routes(app):
    # Participants routes
    @app.route('/api/participants', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_participants():
        """
        Get all participants for the authenticated user.
        ---
        get:
          summary: Get participants
          description: Retrieve all participants for the authenticated user.
          tags:
            - participants
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
                      participants:
                        type: array
                        items:
                          type: object
                          properties:
                            id:
                              type: integer
                            name:
                              type: string
                            email:
                              type: string
                            age:
                              type: integer
                            gender:
                              type: string
            '401':
              description: Unauthorized
        """
        user_id = session['user']['sub']
        participants = get_participants(user_id)
        return jsonify({"participants": participants})

    @app.route('/api/participants', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_add_participant():
        """
        Add a new participant for the authenticated user.
        ---
        post:
          summary: Add participant
          description: Create a new participant for the authenticated user.
          tags:
            - participants
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
                    email:
                      type: string
                    age:
                      type: integer
                    gender:
                      type: string
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
              description: Participant added successfully
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
              description: Failed to add participant
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
        add_participant(user_id, data['name'], data['email'], data['age'], data['gender'], data.get('shared_with'), data.get('studies'))
        return jsonify({"status": "success", "message": "Participant added successfully"})

    @app.route('/api/participants/<int:id>', methods=['PUT'])
    @requires_auth
    @requires_rbac
    def api_update_participant(id):
        """
        Update an existing participant for the authenticated user.
        ---
        put:
          summary: Update participant
          description: Update an existing participant for the authenticated user.
          tags:
            - participants
          security:
            - BearerAuth: []
          parameters:
            - in: path
              name: id
              required: true
              schema:
                type: integer
              description: The ID of the participant to update
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    name:
                      type: string
                    email:
                      type: string
                    age:
                      type: integer
                    gender:
                      type: string
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
              description: Participant updated successfully
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
              description: Participant not found
            '500':
              description: Failed to update participant
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
        update_participant(id, user_id, data['name'], data['email'], data['age'], data['gender'], data.get('shared_with'), data.get('studies'))
        return jsonify({"status": "success", "message": "Participant updated successfully"})

    @app.route('/api/participants/<int:id>', methods=['DELETE'])
    @requires_auth
    @requires_rbac
    def api_delete_participant(id):
        """
        Delete a participant for the authenticated user.
        ---
        delete:
          summary: Delete participant
          description: Delete an existing participant for the authenticated user.
          tags:
            - participants
          security:
            - BearerAuth: []
          parameters:
            - in: path
              name: id
              required: true
              schema:
                type: integer
              description: The ID of the participant to delete
          responses:
            '200':
              description: Participant deleted successfully
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
              description: Participant not found
            '500':
              description: Failed to delete participant
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
        delete_participant(id, user_id)
        return jsonify({"status": "success", "message": "Participant deleted successfully"})
