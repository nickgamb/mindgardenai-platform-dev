import logging
import os
import csv
from flask import jsonify, request, session, send_file
from werkzeug.utils import secure_filename
from services.auth import requires_auth, requires_rbac
from services.database import add_file, get_user_files, delete_file
import datetime

# Supported file types and their configurations
SUPPORTED_FILE_TYPES = {
    'csv': {
        'name': 'CSV File',
        'extensions': ['.csv'],
        'max_size': 50 * 1024 * 1024,  # 50MB
        'content_type': 'text/csv'
    },
    'json': {
        'name': 'JSON File',
        'extensions': ['.json'],
        'max_size': 10 * 1024 * 1024,  # 10MB
        'content_type': 'application/json'
    },
    'txt': {
        'name': 'Text File',
        'extensions': ['.txt'],
        'max_size': 5 * 1024 * 1024,  # 5MB
        'content_type': 'text/plain'
    }
}

UPLOAD_FOLDER = 'data/uploads'

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    """Check if the file type is allowed"""
    if '.' not in filename:
        return False
    
    ext = '.' + filename.rsplit('.', 1)[1].lower()
    for file_type, config in SUPPORTED_FILE_TYPES.items():
        if ext in config['extensions']:
            return True, file_type
    return False, None

def validate_csv_file(file_path):
    """Validate CSV file structure and return metadata"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            # Try to read the first few lines to validate format
            sample = file.read(1024)
            file.seek(0)
            
            # Use csv.Sniffer to detect dialect
            sniffer = csv.Sniffer()
            delimiter = sniffer.sniff(sample).delimiter
            
            # Read CSV and get basic info
            reader = csv.reader(file, delimiter=delimiter)
            headers = next(reader, None)
            
            if not headers:
                return False, "CSV file appears to be empty"
            
            # Count rows (sample first 1000 for performance)
            row_count = 0
            for i, row in enumerate(reader):
                row_count += 1
                if i >= 999:  # Limit sample for large files
                    break
            
            return True, {
                'headers': headers,
                'column_count': len(headers),
                'sample_row_count': row_count,
                'delimiter': delimiter
            }
            
    except Exception as e:
        return False, f"CSV validation error: {str(e)}"

def setup_file_routes(app):
    
    @app.route('/api/files', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_files():
        """
        Get all files for the authenticated user.
        ---
        get:
          summary: Get files
          description: Retrieve all files for the authenticated user.
          tags:
            - files
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
                      files:
                        type: array
                        items:
                          type: object
                          properties:
                            id:
                              type: integer
                            file_name:
                              type: string
                            file_type:
                              type: string
                            file_size:
                              type: integer
                            file_path:
                              type: string
                            metadata:
                              type: object
                            uploaded_at:
                              type: string
            '401':
              description: Unauthorized
            '500':
              description: Failed to fetch files
        """
        try:
            # Get user info from session (consistent with other routes)
            user_info = session.get('user')
            if not user_info or not user_info.get('email'):
                return jsonify({'error': 'User information not found in session'}), 401
                
            user_email = user_info['email']

            files = get_user_files(user_email)
            return jsonify({'files': files})

        except Exception as e:
            logging.error(f"Error getting files: {str(e)}")
            return jsonify({'error': 'Failed to fetch files'}), 500

    @app.route('/api/files/upload', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_upload_file():
        """
        Upload a new file.
        ---
        post:
          summary: Upload file
          description: Upload a new file for the authenticated user.
          tags:
            - files
          security:
            - BearerAuth: []
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  required:
                    - file
                  properties:
                    file:
                      type: string
                      format: binary
                      description: File to upload
                    file_name:
                      type: string
                      description: Custom name for the file
          responses:
            '200':
              description: File uploaded successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
                      file_id:
                        type: integer
                      file_info:
                        type: object
            '400':
              description: Bad request - invalid file
            '401':
              description: Unauthorized
            '413':
              description: File too large
            '500':
              description: Upload failed
        """
        try:
            # Get user info from session (consistent with other routes)
            user_info = session.get('user')
            if not user_info or not user_info.get('email'):
                return jsonify({'error': 'User information not found in session'}), 401
                
            user_email = user_info['email']

            if 'file' not in request.files:
                return jsonify({'error': 'No file provided'}), 400

            file = request.files['file']
            custom_name = request.form.get('file_name', '')

            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400

            # Validate file type
            is_allowed, file_type = allowed_file(file.filename)
            if not is_allowed:
                return jsonify({'error': 'File type not supported'}), 400

            # Check file size
            file_config = SUPPORTED_FILE_TYPES[file_type]
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)

            if file_size > file_config['max_size']:
                return jsonify({
                    'error': f'File too large. Maximum size for {file_type.upper()} files is {file_config["max_size"] // (1024*1024)}MB'
                }), 413

            # Generate secure filename
            original_filename = secure_filename(file.filename)
            if custom_name:
                # Use custom name but keep the original extension
                ext = '.' + original_filename.rsplit('.', 1)[1].lower()
                secure_custom_name = secure_filename(custom_name)
                
                # Check if custom name already has the correct extension
                if secure_custom_name.lower().endswith(ext.lower()):
                    filename = secure_custom_name
                else:
                    filename = secure_custom_name + ext
            else:
                filename = original_filename

            # Add timestamp to avoid conflicts
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{timestamp}_{filename}"

            # Save file
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(file_path)

            # Validate and extract metadata for CSV files
            metadata = {}
            if file_type == 'csv':
                is_valid, csv_info = validate_csv_file(file_path)
                if not is_valid:
                    # Remove the uploaded file if invalid
                    os.remove(file_path)
                    return jsonify({'error': csv_info}), 400
                metadata = csv_info

            # Store file info in database
            file_id = add_file(
                user_email,  # user_id parameter (database uses email as user_id)
                custom_name or original_filename,  # file_name
                file_type,
                file_size,
                file_path,
                metadata
            )

            return jsonify({
                'message': 'File uploaded successfully',
                'file_id': file_id,
                'file_info': {
                    'name': custom_name or original_filename,
                    'type': file_type,
                    'size': file_size,
                    'metadata': metadata
                }
            })

        except Exception as e:
            logging.error(f"Error uploading file: {str(e)}")
            return jsonify({'error': 'Failed to upload file'}), 500

    @app.route('/api/files/<int:file_id>', methods=['DELETE'])
    @requires_auth
    @requires_rbac
    def api_delete_file(file_id):
        """
        Delete a file.
        ---
        delete:
          summary: Delete file
          description: Delete a file for the authenticated user.
          tags:
            - files
          security:
            - BearerAuth: []
          parameters:
            - name: file_id
              in: path
              required: true
              schema:
                type: integer
          responses:
            '200':
              description: File deleted successfully
            '401':
              description: Unauthorized
            '404':
              description: File not found
            '500':
              description: Failed to delete file
        """
        try:
            # Get user info from session (consistent with other routes)
            user_info = session.get('user')
            if not user_info or not user_info.get('email'):
                return jsonify({'error': 'User information not found in session'}), 401
                
            user_email = user_info['email']

            # Get file info before deletion to remove from filesystem
            files = get_user_files(user_email)
            file_to_delete = next((f for f in files if f['id'] == file_id), None)

            success = delete_file(file_id, user_email)
            
            if success:
                # Remove file from filesystem if it exists
                if file_to_delete and file_to_delete.get('file_path'):
                    try:
                        if os.path.exists(file_to_delete['file_path']):
                            os.remove(file_to_delete['file_path'])
                    except Exception as e:
                        logging.warning(f"Could not remove file from filesystem: {e}")
                
                return jsonify({'message': 'File deleted successfully'})
            else:
                return jsonify({'error': 'File not found or not authorized'}), 404

        except Exception as e:
            logging.error(f"Error deleting file: {str(e)}")
            return jsonify({'error': 'Failed to delete file'}), 500

    @app.route('/api/files/<int:file_id>/download', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_download_file(file_id):
        """
        Download a file.
        ---
        get:
          summary: Download file
          description: Download a file for the authenticated user.
          tags:
            - files
          security:
            - BearerAuth: []
          parameters:
            - name: file_id
              in: path
              required: true
              schema:
                type: integer
          responses:
            '200':
              description: File download
            '401':
              description: Unauthorized
            '404':
              description: File not found
            '500':
              description: Download failed
        """
        try:
            # Get user info from session (consistent with other routes)
            user_info = session.get('user')
            if not user_info or not user_info.get('email'):
                return jsonify({'error': 'User information not found in session'}), 401
                
            user_email = user_info['email']

            # Get file info
            files = get_user_files(user_email)
            file_info = next((f for f in files if f['id'] == file_id), None)

            if not file_info:
                return jsonify({'error': 'File not found or not authorized'}), 404

            file_path = file_info.get('file_path')
            if not file_path or not os.path.exists(file_path):
                return jsonify({'error': 'File not found on server'}), 404

            return send_file(
                file_path,
                as_attachment=True,
                download_name=file_info['file_name'],
                mimetype=SUPPORTED_FILE_TYPES.get(file_info['file_type'], {}).get('content_type', 'application/octet-stream')
            )

        except Exception as e:
            logging.error(f"Error downloading file: {str(e)}")
            return jsonify({'error': 'Failed to download file'}), 500

    # Legacy device routes support - TODO: Remove when frontend is fully updated
    @app.route('/api/devices', methods=['GET'])
    @requires_auth
    @requires_rbac
    def api_get_devices_legacy():
        """Legacy support for devices endpoint - returns files as devices"""
        try:
            # Get user info from session (consistent with other routes)
            user_info = session.get('user')
            if not user_info or not user_info.get('email'):
                return jsonify({'error': 'User information not found in session'}), 401
                
            user_email = user_info['email']

            files = get_user_files(user_email)
            
            # Convert files to device-like format for compatibility
            devices = []
            for file in files:
                devices.append({
                    'device_id': file['id'],
                    'device_name': file['file_name'],
                    'device_model': file['file_type'],
                    'device_type': file['file_type'],
                    'registered_at': file.get('uploaded_at'),
                    'device_settings': {
                        'file_type': file['file_type'],
                        'file_size': file['file_size'],
                        'metadata': file.get('metadata', {})
                    }
                })
            
            return jsonify({'devices': devices})

        except Exception as e:
            logging.error(f"Error getting files (legacy): {str(e)}")
            return jsonify({'error': 'Failed to fetch files'}), 500