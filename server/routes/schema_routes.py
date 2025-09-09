from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import get_user_files
import json
import pandas as pd
import logging
import os
from datetime import datetime

def setup_schema_routes(app):
    """Setup schema detection and analysis routes"""
    
    @app.route('/api/schemas/detect', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_detect_schema():
        """
        Detect schema from file or sample data.
        ---
        post:
          summary: Detect data schema
          description: Analyze file or sample data to detect field types and structure.
          tags:
            - schemas
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    source_type:
                      type: string
                      enum: [file, sample_data]
                      description: Source of data to analyze
                    file_id:
                      type: string
                      description: ID of uploaded file (when source_type is file)
                    sample_data:
                      type: array
                      description: Sample data array (when source_type is sample_data)
                    sample_size:
                      type: integer
                      default: 100
                      description: Number of records to analyze
                  required: [source_type]
          responses:
            '200':
              description: Schema detected successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      schema:
                        type: array
                        items:
                          type: object
                          properties:
                            name:
                              type: string
                            type:
                              type: string
                            nullable:
                              type: boolean
                            examples:
                              type: array
                              items:
                                type: string
                            description:
                              type: string
                      sample_count:
                        type: integer
                      total_count:
                        type: integer
            '400':
              description: Invalid request or file format
            '404':
              description: File not found
        """
        try:
            data = request.get_json()
            source_type = data.get('source_type')
            sample_size = data.get('sample_size', 100)
            
            if source_type == 'file':
                file_id = data.get('file_id')
                if not file_id:
                    return jsonify({'error': 'file_id is required for file source'}), 400
                
                # Ensure file_id is an integer
                try:
                    file_id = int(file_id)
                except (ValueError, TypeError):
                    return jsonify({'error': 'file_id must be a valid integer'}), 400
                
                # Get file information from database - use same user identification as file routes
                user_info = session.get('user')
                if not user_info or not user_info.get('email'):
                    return jsonify({'error': 'User information not found in session'}), 401
                
                user_email = user_info['email']
                logging.info(f"👤 Current user email: {user_email}")
                user_files = get_user_files(user_email)
                logging.info(f"🔍 Looking for file_id: {file_id} among {len(user_files)} files")
                logging.info(f"📁 Available file IDs: {[f['id'] for f in user_files]}")
                if user_files:
                    logging.info(f"📋 First file details: {user_files[0]}")
                file_info = next((f for f in user_files if f['id'] == file_id), None)
                
                if not file_info:
                    return jsonify({'error': f'File not found. file_id: {file_id}, available: {[f["id"] for f in user_files]}'}), 404
                
                # Load and analyze file
                schema_result = detect_file_schema(file_info, sample_size)
                
            elif source_type == 'sample_data':
                sample_data = data.get('sample_data')
                if not sample_data:
                    return jsonify({'error': 'sample_data is required for sample_data source'}), 400
                
                # Analyze sample data
                schema_result = detect_sample_schema(sample_data, sample_size)
                
            else:
                return jsonify({'error': 'Invalid source_type. Must be "file" or "sample_data"'}), 400
            
            return jsonify(schema_result)
            
        except Exception as e:
            logging.error(f"❌ Error detecting schema: {str(e)}")
            return jsonify({'error': f'Schema detection failed: {str(e)}'}), 500

    @app.route('/api/schemas/validate', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_validate_mappings():
        """
        Validate attribute mappings.
        ---
        post:
          summary: Validate attribute mappings
          description: Check if attribute mappings are complete and valid.
          tags:
            - schemas
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    input_schema:
                      type: array
                      description: Input data schema
                    output_schema:
                      type: array
                      description: Output data schema
                    mappings:
                      type: object
                      description: Field mappings configuration
                  required: [input_schema, output_schema, mappings]
          responses:
            '200':
              description: Validation results
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      is_valid:
                        type: boolean
                      errors:
                        type: array
                        items:
                          type: string
                      warnings:
                        type: array
                        items:
                          type: string
                      summary:
                        type: object
            '400':
              description: Invalid request data
        """
        try:
            data = request.get_json()
            input_schema = data.get('input_schema', [])
            output_schema = data.get('output_schema', [])
            mappings = data.get('mappings', {})
            
            validation_result = validate_attribute_mappings(input_schema, output_schema, mappings)
            
            return jsonify(validation_result)
            
        except Exception as e:
            logging.error(f"❌ Error validating mappings: {str(e)}")
            return jsonify({'error': f'Validation failed: {str(e)}'}), 500

def detect_file_schema(file_info, sample_size=100):
    """Detect schema from an uploaded file"""
    try:
        file_path = file_info.get('file_path')
        file_type = file_info.get('file_type', '').lower()
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Load data based on file type
        if file_type == 'csv':
            df = pd.read_csv(file_path, nrows=sample_size)
        elif file_type == 'json':
            df = pd.read_json(file_path, lines=True).head(sample_size)
        elif file_type in ['xlsx', 'xls']:
            df = pd.read_excel(file_path, nrows=sample_size)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
        
        # Convert DataFrame to schema
        schema = dataframe_to_schema(df)
        
        return {
            'schema': schema,
            'sample_count': len(df),
            'total_count': len(df),  # For sample, this is the same
            'file_info': {
                'name': file_info.get('original_filename'),
                'type': file_type,
                'size': file_info.get('file_size', 0)
            }
        }
        
    except Exception as e:
        logging.error(f"❌ Error detecting file schema: {str(e)}")
        raise

def detect_sample_schema(sample_data, sample_size=100):
    """Detect schema from sample data array"""
    try:
        if not isinstance(sample_data, list) or len(sample_data) == 0:
            return {'schema': [], 'sample_count': 0, 'total_count': 0}
        
        # Limit sample size
        analyzed_data = sample_data[:sample_size]
        
        # Convert to DataFrame for analysis
        df = pd.DataFrame(analyzed_data)
        
        # Convert DataFrame to schema
        schema = dataframe_to_schema(df)
        
        return {
            'schema': schema,
            'sample_count': len(analyzed_data),
            'total_count': len(sample_data)
        }
        
    except Exception as e:
        logging.error(f"❌ Error detecting sample schema: {str(e)}")
        raise

def dataframe_to_schema(df):
    """Convert pandas DataFrame to schema format"""
    schema = []
    
    for column in df.columns:
        field_info = analyze_column(df[column], column)
        schema.append(field_info)
    
    return sorted(schema, key=lambda x: x['name'])

def analyze_column(series, column_name):
    """Analyze a pandas Series to determine field information"""
    # Basic field info
    field_info = {
        'name': column_name,
        'nullable': bool(series.isnull().any()),  # Convert pandas bool to Python bool
        'examples': []
    }
    
    # Get non-null values for analysis
    non_null_values = series.dropna()
    
    if len(non_null_values) == 0:
        field_info['type'] = 'string'
        field_info['description'] = 'All values are null'
        return field_info
    
    # Determine primary type
    field_info['type'] = infer_pandas_type(non_null_values)
    
    # Generate description
    field_info['description'] = generate_field_description(column_name, field_info['type'])
    
    # Collect examples (up to 3 unique values)
    unique_values = non_null_values.unique()[:3]
    field_info['examples'] = [str(val) for val in unique_values]
    
    # Add type-specific metadata
    if field_info['type'] == 'number':
        field_info['range'] = {
            'min': float(non_null_values.min()),
            'max': float(non_null_values.max()),
            'mean': float(non_null_values.mean())
        }
    elif field_info['type'] == 'string':
        field_info['length'] = {
            'min': int(non_null_values.str.len().min()),
            'max': int(non_null_values.str.len().max()),
            'avg': float(non_null_values.str.len().mean())
        }
    
    return field_info

def infer_pandas_type(series):
    """Infer field type from pandas Series"""
    # Check pandas dtype first
    dtype_str = str(series.dtype)
    
    if 'int' in dtype_str or 'float' in dtype_str:
        return 'number'
    elif 'bool' in dtype_str:
        return 'boolean'
    elif 'datetime' in dtype_str:
        return 'date'
    
    # For object dtype, analyze the actual values
    if dtype_str == 'object':
        sample_values = series.head(10)
        
        # Check if all values can be converted to numbers
        try:
            pd.to_numeric(sample_values)
            return 'number'
        except (ValueError, TypeError):
            pass
        
        # Check if all values can be converted to dates
        try:
            with pd._config.config.option_context('mode.chained_assignment', None):
                pd.to_datetime(sample_values, errors='raise')
            return 'date'
        except (ValueError, TypeError):
            pass
        
        # Check if all values are boolean-like
        bool_values = sample_values.str.lower().isin(['true', 'false', 'yes', 'no', '1', '0'])
        if bool_values.all():
            return 'boolean'
        
        # Check for special string types
        email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if sample_values.str.match(email_pattern).any():
            return 'email'
        
        url_pattern = r'^https?://'
        if sample_values.str.match(url_pattern).any():
            return 'url'
    
    return 'string'

def generate_field_description(field_name, field_type):
    """Generate a description for a field based on its name and type"""
    # Common field name patterns
    patterns = {
        'id': 'Unique identifier',
        'name': 'Name or title',
        'email': 'Email address', 
        'phone': 'Phone number',
        'address': 'Address information',
        'date': 'Date value',
        'time': 'Time value',
        'created': 'Creation timestamp',
        'updated': 'Last update timestamp',
        'status': 'Status indicator',
        'type': 'Type or category',
        'count': 'Count or quantity',
        'amount': 'Monetary amount',
        'price': 'Price value',
        'url': 'URL or web address',
        'description': 'Description text',
        'username': 'Username or login',
        'first': 'First name',
        'last': 'Last name',
        'age': 'Age in years',
        'active': 'Active status flag'
    }
    
    lower_name = field_name.lower()
    
    # Check for exact matches
    for pattern, description in patterns.items():
        if pattern in lower_name:
            return description
    
    # Generate based on naming conventions
    if lower_name.endswith('_id') or lower_name.endswith('id'):
        return 'Identifier'
    
    if lower_name.startswith('is_') or lower_name.startswith('has_'):
        return 'Boolean flag'
    
    if lower_name.endswith('_at') or lower_name.endswith('date'):
        return 'Date/time value'
    
    # Convert camelCase or snake_case to readable format
    import re
    readable = field_name.replace('_', ' ')
    readable = re.sub(r'([A-Z])', r' \1', readable).strip().lower()
    return f"{readable.capitalize()} ({field_type})"

def validate_attribute_mappings(input_schema, output_schema, mappings):
    """Validate attribute mappings configuration"""
    errors = []
    warnings = []
    unmapped_required = []
    unmapped_optional = []
    
    # Create lookup for input fields
    input_fields = {field['name']: field for field in input_schema}
    
    for field in output_schema:
        field_name = field['name']
        is_mapped = field_name in mappings
        is_required = field.get('required', False)
        
        if not is_mapped:
            if is_required:
                unmapped_required.append(field_name)
                errors.append(f"Required field '{field_name}' is not mapped")
            else:
                unmapped_optional.append(field_name)
                warnings.append(f"Optional field '{field_name}' is not mapped")
        else:
            # Validate mapping configuration
            mapping = mappings[field_name]
            mapping_type = mapping.get('type')
            
            if mapping_type == 'direct':
                source_field = mapping.get('sourceField')
                if not source_field:
                    errors.append(f"Direct mapping for '{field_name}' is missing source field")
                elif source_field not in input_fields:
                    errors.append(f"Source field '{source_field}' for '{field_name}' does not exist in input")
                    
            elif mapping_type == 'constant':
                if mapping.get('value') in [None, '']:
                    warnings.append(f"Constant mapping for '{field_name}' has empty value")
                    
            elif mapping_type == 'expression':
                if not mapping.get('expression'):
                    errors.append(f"Expression mapping for '{field_name}' is missing expression")
                    
            elif mapping_type == 'aggregate':
                source_field = mapping.get('sourceField')
                function = mapping.get('function')
                if not source_field:
                    errors.append(f"Aggregate mapping for '{field_name}' is missing source field")
                elif not function:
                    errors.append(f"Aggregate mapping for '{field_name}' is missing function")
                elif source_field not in input_fields:
                    errors.append(f"Source field '{source_field}' for aggregate '{field_name}' does not exist")
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings,
        'unmapped_required': unmapped_required,
        'unmapped_optional': unmapped_optional,
        'summary': {
            'total_fields': len(output_schema),
            'mapped_fields': len(mappings),
            'required_mapped': len([f for f in output_schema if f.get('required') and f['name'] in mappings]),
            'required_total': len([f for f in output_schema if f.get('required')])
        }
    }