/**
 * Schema Utilities for Flow Designer
 * 
 * Handles schema detection, propagation, and validation across flow nodes.
 */

/**
 * Infer schema from sample data
 * @param {Array|Object} data - Sample data to analyze
 * @param {number} sampleSize - Number of records to analyze for arrays
 * @returns {Array} Array of field definitions
 */
export const inferSchemaFromData = (data, sampleSize = 100) => {
  if (!data) return [];
  
  // Handle array of objects (common case)
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    
    // Analyze a sample of records to build comprehensive schema
    const sample = data.slice(0, Math.min(sampleSize, data.length));
    const fieldMap = new Map();
    
    sample.forEach(record => {
      if (record && typeof record === 'object') {
        Object.entries(record).forEach(([key, value]) => {
          if (!fieldMap.has(key)) {
            fieldMap.set(key, {
              name: key,
              type: inferFieldType(value),
              nullable: false,
              examples: [],
              description: generateFieldDescription(key)
            });
          }
          
          const field = fieldMap.get(key);
          
          // Track if field can be null
          if (value === null || value === undefined) {
            field.nullable = true;
          }
          
          // Collect examples (up to 3 unique values)
          if (value !== null && value !== undefined && field.examples.length < 3) {
            const stringValue = String(value);
            if (!field.examples.includes(stringValue)) {
              field.examples.push(stringValue);
            }
          }
          
          // Handle type conflicts (e.g., sometimes string, sometimes number)
          const currentType = inferFieldType(value);
          if (currentType !== field.type && value !== null && value !== undefined) {
            // Promote to more general type
            if ((field.type === 'number' && currentType === 'string') ||
                (field.type === 'string' && currentType === 'number')) {
              field.type = 'string'; // String is more general
            } else if (field.type !== 'object' && currentType === 'object') {
              field.type = 'object';
            }
          }
        });
      }
    });
    
    return Array.from(fieldMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
  
  // Handle single object
  if (typeof data === 'object') {
    return Object.entries(data).map(([key, value]) => ({
      name: key,
      type: inferFieldType(value),
      nullable: value === null || value === undefined,
      examples: value !== null && value !== undefined ? [String(value)] : [],
      description: generateFieldDescription(key)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }
  
  return [];
};

/**
 * Infer the type of a single field value
 * @param {any} value - The value to analyze
 * @returns {string} The inferred type
 */
export const inferFieldType = (value) => {
  if (value === null || value === undefined) {
    return 'string'; // Default for null values
  }
  
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'number' : 'number';
  }
  
  if (typeof value === 'string') {
    // Try to detect special string types
    if (isDateString(value)) {
      return 'date';
    }
    if (isEmailString(value)) {
      return 'email';
    }
    if (isUrlString(value)) {
      return 'url';
    }
    return 'string';
  }
  
  if (Array.isArray(value)) {
    return 'array';
  }
  
  if (typeof value === 'object') {
    return 'object';
  }
  
  return 'string';
};

/**
 * Generate a description for a field based on its name
 * @param {string} fieldName - The field name
 * @returns {string} Generated description
 */
export const generateFieldDescription = (fieldName) => {
  // Common field name patterns
  const patterns = {
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
    'password': 'Password (sensitive)',
    'first': 'First name',
    'last': 'Last name',
    'age': 'Age in years',
    'active': 'Active status flag'
  };
  
  const lowerName = fieldName.toLowerCase();
  
  // Check for exact matches
  for (const [pattern, description] of Object.entries(patterns)) {
    if (lowerName.includes(pattern)) {
      return description;
    }
  }
  
  // Generate based on naming conventions
  if (lowerName.endsWith('_id') || lowerName.endsWith('id')) {
    return 'Identifier';
  }
  
  if (lowerName.startsWith('is_') || lowerName.startsWith('has_')) {
    return 'Boolean flag';
  }
  
  if (lowerName.endsWith('_at') || lowerName.endsWith('date')) {
    return 'Date/time value';
  }
  
  // Convert camelCase or snake_case to readable format
  const readable = fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
  
  return `${readable.charAt(0).toUpperCase()}${readable.slice(1)}`;
};

/**
 * Generate input schema from OpenAPI specification for API nodes
 * @param {Object} openapiSpec - The OpenAPI specification object
 * @param {string} selectedPath - The selected API path (e.g., '/api/v1/users')
 * @param {string} selectedMethod - The selected HTTP method (e.g., 'GET', 'POST')
 * @returns {Array} Input schema based on the endpoint parameters
 */
export const generateAPIInputSchema = (openapiSpec, selectedPath, selectedMethod) => {
  if (!openapiSpec || !selectedPath || !selectedMethod) {
    return [];
  }

  const paths = openapiSpec.paths || {};
  const pathData = paths[selectedPath];
  
  if (!pathData) {
    return [];
  }

  const methodData = pathData[selectedMethod.toLowerCase()];
  if (!methodData) {
    return [];
  }

  const inputSchema = [];

  // Extract path parameters
  const pathParams = methodData.parameters?.filter(param => param.in === 'path') || [];
  pathParams.forEach(param => {
    inputSchema.push({
      name: param.name,
      type: param.schema?.type || 'string',
      description: param.description || `Path parameter: ${param.name}`,
      required: param.required || false,
      source: 'path',
      location: 'path'
    });
  });

  // Extract query parameters
  const queryParams = methodData.parameters?.filter(param => param.in === 'query') || [];
  queryParams.forEach(param => {
    inputSchema.push({
      name: param.name,
      type: param.schema?.type || 'string',
      description: param.description || `Query parameter: ${param.name}`,
      required: param.required || false,
      source: 'query',
      location: 'query'
    });
  });

  // Extract header parameters
  const headerParams = methodData.parameters?.filter(param => param.in === 'header') || [];
  headerParams.forEach(param => {
    inputSchema.push({
      name: param.name,
      type: param.schema?.type || 'string',
      description: param.description || `Header: ${param.name}`,
      required: param.required || false,
      source: 'header',
      location: 'header'
    });
  });

  // Extract request body schema for POST/PUT/PATCH methods
  if (['post', 'put', 'patch'].includes(selectedMethod.toLowerCase()) && methodData.requestBody) {
    const requestBody = methodData.requestBody;
    const content = requestBody.content || {};
    
    // Get the first available content type (usually application/json)
    const contentType = Object.keys(content)[0];
    if (contentType && content[contentType].schema) {
      const bodySchema = content[contentType].schema;
      
      // Handle different schema types
      if (bodySchema.type === 'object' && bodySchema.properties) {
        Object.entries(bodySchema.properties).forEach(([propName, propSchema]) => {
          inputSchema.push({
            name: propName,
            type: propSchema.type || 'string',
            description: propSchema.description || `Request body field: ${propName}`,
            required: (bodySchema.required || []).includes(propName),
            source: 'body',
            location: 'body'
          });
        });
      } else if (bodySchema.type === 'array' && bodySchema.items) {
        // For array request bodies, create a generic field
        inputSchema.push({
          name: 'request_data',
          type: 'array',
          description: 'Request body data array',
          required: requestBody.required || false,
          source: 'body',
          location: 'body'
        });
      } else {
        // Generic request body
        inputSchema.push({
          name: 'request_data',
          type: bodySchema.type || 'object',
          description: 'Request body data',
          required: requestBody.required || false,
          source: 'body',
          location: 'body'
        });
      }
    }
  }

  return inputSchema;
};

/**
 * Get API endpoint information from OpenAPI specification
 * @param {Object} openapiSpec - The OpenAPI specification object
 * @param {string} selectedPath - The selected API path
 * @param {string} selectedMethod - The selected HTTP method
 * @returns {Object} Endpoint information including summary, description, etc.
 */
export const getAPIEndpointInfo = (openapiSpec, selectedPath, selectedMethod) => {
  if (!openapiSpec || !selectedPath || !selectedMethod) {
    return null;
  }

  const paths = openapiSpec.paths || {};
  const pathData = paths[selectedPath];
  
  if (!pathData) {
    return null;
  }

  const methodData = pathData[selectedMethod.toLowerCase()];
  if (!methodData) {
    return null;
  }

  return {
    path: selectedPath,
    method: selectedMethod.toUpperCase(),
    summary: methodData.summary || '',
    description: methodData.description || '',
    operationId: methodData.operationId || '',
    tags: methodData.tags || [],
    parameters: methodData.parameters || [],
    requestBody: methodData.requestBody || null,
    responses: methodData.responses || {}
  };
};

/**
 * Get default output schema for a node type
 * @param {string} nodeType - The type of node
 * @param {Array} inputSchema - Input schema to base output on
 * @returns {Array} Default output schema
 */
export const getDefaultOutputSchema = (nodeType, inputSchema = [], nodeData = {}) => {
  switch (nodeType) {
    case 'file':
      // File nodes output schema from their uploaded file
      if (nodeData.config?.file_schema) {
        return nodeData.config.file_schema;
      }
      // Default schema if no file uploaded yet
      return [
        { name: 'id', type: 'string', description: 'Unique identifier', required: true },
        { name: 'name', type: 'string', description: 'User name', required: true },
        { name: 'email', type: 'string', description: 'Email address', required: true },
        { name: 'department', type: 'string', description: 'Department', required: false },
        { name: 'status', type: 'string', description: 'Account status', required: false }
      ];
      
    case 'transform':
      // Transform nodes: if script is configured, use script output schema; otherwise use input schema
      if (nodeData.config?.transform_id && nodeData.config?.output_schema) {
        // Use the script-generated output schema
        return nodeData.config.output_schema;
      }
      // Default to input schema when no transform script is selected
      return inputSchema.map(field => ({ ...field, userModifiable: true }));
      
      case 'api':
        // API nodes always output HTTP response data, not request body parameters
        return [
          { name: 'status', type: 'number', description: 'HTTP status code', required: true },
          { name: 'statusText', type: 'string', description: 'HTTP status text', required: true },
          { name: 'headers', type: 'object', description: 'Response headers', required: false },
          { name: 'data', type: 'object', description: 'Response body data', required: false },
          { name: 'url', type: 'string', description: 'Request URL', required: true },
          { name: 'method', type: 'string', description: 'HTTP method used', required: true },
          { name: 'timestamp', type: 'date', description: 'Request timestamp', required: true }
        ];
      
    case 'analytics':
      // Analytics nodes output analysis results from script execution
      return [
        { name: 'summary', type: 'object', description: 'Analysis summary', required: true },
        { name: 'metrics', type: 'object', description: 'Calculated metrics', required: true },
        { name: 'insights', type: 'array', description: 'Generated insights', required: false },
        { name: 'visualizations', type: 'array', description: 'Chart configurations', required: false },
        { name: 'analytics_id', type: 'string', description: 'Analytics script ID', required: true },
        { name: 'analytics_name', type: 'string', description: 'Analytics script name', required: true },
        { name: 'analysis_type', type: 'string', description: 'Type of analysis performed', required: true }
      ];
      
    case 'storage':
      // Storage nodes output confirmation and metadata
      return [
        { name: 'stored', type: 'boolean', description: 'Storage success flag', required: true },
        { name: 'location', type: 'string', description: 'Storage location/path', required: true },
        { name: 'size', type: 'number', description: 'Stored data size', required: false },
        { name: 'timestamp', type: 'date', description: 'Storage timestamp', required: true }
      ];
      
    case 'ai_tools':
      // AI tools output processed results
      return [
        { name: 'result', type: 'object', description: 'AI processing result', required: true },
        { name: 'confidence', type: 'number', description: 'Confidence score', required: false },
        { name: 'metadata', type: 'object', description: 'Processing metadata', required: false }
      ];
      
    case 'flow_trigger':
      // Flow triggers output trigger context
      return [
        { name: 'trigger_type', type: 'string', description: 'Type of trigger', required: true },
        { name: 'trigger_time', type: 'date', description: 'Trigger timestamp', required: true },
        { name: 'payload', type: 'object', description: 'Trigger payload data', required: false }
      ];
      
    case 'visual_preview':
      // Visual preview nodes output visual content
      return [
        { name: 'visual_content', type: 'object', description: 'Visual content for display', required: true }
      ];
      
    case 'plugins':
      // Plugins nodes output depends on the selected function
      const functionName = nodeData?.config?.function_name;
      
      if (functionName === 'create_provider') {
        return [
          { name: 'provider_id', type: 'string', description: 'ID of the created provider' },
          { name: 'name', type: 'string', description: 'Name of the provider' },
          { name: 'template', type: 'string', description: 'Provider template' },
          { name: 'status', type: 'string', description: 'Provider status' }
        ];
      } else if (functionName === 'create_data_source') {
        return [
          { name: 'data_source_id', type: 'string', description: 'ID of the created data source' },
          { name: 'name', type: 'string', description: 'Name of the data source' },
          { name: 'provider_id', type: 'string', description: 'Associated provider ID' },
          { name: 'status', type: 'string', description: 'Data source status' }
        ];
      } else if (functionName === 'get_provider') {
        return [
          { name: 'provider_id', type: 'string', description: 'Provider ID' },
          { name: 'name', type: 'string', description: 'Provider name' },
          { name: 'template', type: 'string', description: 'Provider template' },
          { name: 'icon', type: 'string', description: 'Provider icon' },
          { name: 'created_time', type: 'string', description: 'Creation timestamp' }
        ];
      } else if (functionName === 'datasource_push' || functionName === 'push_metadata') {
        return [
          { name: 'push_id', type: 'string', description: 'ID of the push operation' },
          { name: 'status', type: 'string', description: 'Push status' },
          { name: 'records_processed', type: 'number', description: 'Number of records processed' },
          { name: 'message', type: 'string', description: 'Push result message' }
        ];
      } else {
        // Generic plugin output schema when no function is selected
        return [
          { name: 'result', type: 'object', description: 'Function execution result' },
          { name: 'status', type: 'string', description: 'Execution status' }
        ];
      }
      
    default:
      // Default passthrough
      return inputSchema;
  }
};

/**
 * Validate that mappings cover all required output fields
 * @param {Array} outputSchema - Output schema definition
 * @param {Object} mappings - Current field mappings
 * @returns {Object} Validation result with errors and warnings
 */
export const validateMappings = (outputSchema, mappings) => {
  const errors = [];
  const warnings = [];
  const unmappedRequired = [];
  const unmappedOptional = [];
  
  outputSchema.forEach(field => {
    const isMapped = mappings.hasOwnProperty(field.name);
    
    if (!isMapped) {
      if (field.required) {
        unmappedRequired.push(field.name);
        errors.push(`Required field '${field.name}' is not mapped`);
      } else {
        unmappedOptional.push(field.name);
        warnings.push(`Optional field '${field.name}' is not mapped`);
      }
    } else {
      // Validate mapping configuration
      const mapping = mappings[field.name];
      
      if (mapping.type === 'direct' && !mapping.sourceField) {
        errors.push(`Direct mapping for '${field.name}' is missing source field`);
      }
      
      if (mapping.type === 'constant' && (mapping.value === undefined || mapping.value === '')) {
        warnings.push(`Constant mapping for '${field.name}' has empty value`);
      }
      
      if (mapping.type === 'expression' && !mapping.expression) {
        errors.push(`Expression mapping for '${field.name}' is missing expression`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    unmappedRequired,
    unmappedOptional,
    summary: {
      totalFields: outputSchema.length,
      mappedFields: Object.keys(mappings).length,
      requiredMapped: outputSchema.filter(f => f.required && mappings.hasOwnProperty(f.name)).length,
      requiredTotal: outputSchema.filter(f => f.required).length
    }
  };
};

/**
 * Propagate schema through a flow based on node connections
 * @param {Array} nodes - Flow nodes
 * @param {Array} edges - Flow connections
 * @returns {Object} Schema map by node ID
 */
export const propagateSchemas = (nodes, edges) => {
  const schemaMap = new Map();
  const visited = new Set();
  
  // Find starting nodes (no incoming edges)
  const startingNodes = nodes.filter(node => 
    !edges.some(edge => edge.target === node.id)
  );
  
  // Recursively propagate schemas
  const propagateFromNode = (nodeId) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Get input schemas from connected nodes
    const inputEdges = edges.filter(edge => edge.target === nodeId);
    const inputSchemas = inputEdges.map(edge => {
      const sourceSchema = schemaMap.get(edge.source);
      return sourceSchema?.output || [];
    }).filter(schema => Array.isArray(schema) && schema.length > 0);
    
    // Merge input schemas (for nodes with multiple inputs)
    const mergedInputSchema = mergeSchemas(inputSchemas);
    
    // Calculate output schema based on node type and configuration
    let outputSchema;
    
    if (node.data?.config?.schema_output) {
      // Use explicitly configured output schema
      outputSchema = node.data.config.schema_output;
    } else if (node.data?.config?.mappings) {
      // Apply attribute mappings to transform schema
      outputSchema = applyMappingsToSchema(mergedInputSchema, node.data.config.mappings);
    } else {
      // Use default schema for node type
      outputSchema = getDefaultOutputSchema(node.type, mergedInputSchema, node.data);
    }
    
    // Ensure outputSchema is always an array
    if (!Array.isArray(outputSchema)) {
      outputSchema = [];
    }
    
    schemaMap.set(nodeId, {
      input: mergedInputSchema || [],
      output: outputSchema,
      nodeType: node.type
    });
    
    // Propagate to connected nodes
    const outputEdges = edges.filter(edge => edge.source === nodeId);
    outputEdges.forEach(edge => propagateFromNode(edge.target));
  };
  
  // Start propagation from all starting nodes
  startingNodes.forEach(node => propagateFromNode(node.id));
  
  return Object.fromEntries(schemaMap);
};

/**
 * Merge multiple schemas into one
 * @param {Array} schemas - Array of schema arrays to merge
 * @returns {Array} Merged schema
 */
export const mergeSchemas = (schemas) => {
  if (!schemas || schemas.length === 0) return [];
  if (schemas.length === 1) return schemas[0] || [];
  
  const fieldMap = new Map();
  
  schemas.forEach(schema => {
    if (Array.isArray(schema)) {
      schema.forEach(field => {
        if (field && field.name) {
          if (!fieldMap.has(field.name)) {
            fieldMap.set(field.name, { ...field });
          } else {
            // Handle conflicts by making field more general
            const existing = fieldMap.get(field.name);
            if (existing.type !== field.type) {
              existing.type = 'string'; // Default to string for conflicts
            }
            existing.nullable = existing.nullable || field.nullable;
          }
        }
      });
    }
  });
  
  return Array.from(fieldMap.values());
};

/**
 * Apply attribute mappings to transform a schema
 * @param {Array} inputSchema - Input schema
 * @param {Object} mappings - Attribute mappings
 * @returns {Array} Transformed output schema
 */
export const applyMappingsToSchema = (inputSchema, mappings) => {
  return Object.entries(mappings).map(([fieldName, mapping]) => {
    const baseField = {
      name: fieldName,
      required: false,
      userDefined: true
    };
    
    switch (mapping.type) {
      case 'direct':
        const sourceField = inputSchema.find(f => f.name === mapping.sourceField);
        return {
          ...baseField,
          type: sourceField?.type || 'string',
          description: sourceField?.description || `Mapped from ${mapping.sourceField}`
        };
        
      case 'constant':
        return {
          ...baseField,
          type: inferFieldType(mapping.value),
          description: `Constant value: ${mapping.value}`
        };
        
      case 'expression':
        return {
          ...baseField,
          type: 'string', // Expressions default to string
          description: `Expression: ${mapping.expression}`
        };
        
      case 'aggregate':
        return {
          ...baseField,
          type: 'number',
          description: `${mapping.function} of ${mapping.sourceField}`
        };
        
      default:
        return {
          ...baseField,
          type: 'string',
          description: `${mapping.type} mapping`
        };
    }
  });
};

/**
 * Extract input parameters from a transform script by parsing JavaScript function definitions
 * @param {string} script - The transform script content
 * @returns {Array} Array of parameter objects with name, type, and description
 */
export const extractTransformScriptParameters = (script) => {
  if (!script || typeof script !== 'string') {
    return [];
  }

  const parameters = [];
  
  // Look for function definitions in the script
  const functionPatterns = [
    // Match function declarations like: function transformCsvToOaa(csvData, config = {})
    /function\s+(\w+)\s*\(([^)]*)\)/g,
    // Match arrow functions like: const transform = (data, config) => {}
    /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/g,
    // Match function expressions like: const transform = function(data, config) {}
    /const\s+(\w+)\s*=\s*function\s*\(([^)]*)\)/g
  ];

  for (const pattern of functionPatterns) {
    let match;
    while ((match = pattern.exec(script)) !== null) {
      const functionName = match[1];
      const paramString = match[2];
      
      // Parse parameters
      const paramList = paramString.split(',').map(p => p.trim());
      
      paramList.forEach((param, index) => {
        if (param && param !== '') {
          // Extract parameter name (before default value or type annotation)
          const paramName = param.split('=')[0].split(':')[0].trim();
          
          // Skip if it's an empty parameter or just whitespace
          if (paramName && paramName !== '') {
            // Determine parameter type based on name patterns
            let paramType = 'object';
            let description = `Parameter for ${functionName}`;
            
            if (paramName.toLowerCase().includes('data')) {
              paramType = 'array';
              description = `Input data array for ${functionName}`;
            } else if (paramName.toLowerCase().includes('config')) {
              paramType = 'object';
              description = `Configuration object for ${functionName}`;
            } else if (paramName.toLowerCase().includes('rules')) {
              paramType = 'object';
              description = `Validation or mapping rules for ${functionName}`;
            } else if (paramName.toLowerCase().includes('transform')) {
              paramType = 'object';
              description = `Transform configuration for ${functionName}`;
            } else if (paramName.toLowerCase().includes('chain')) {
              paramType = 'array';
              description = `Transformer chain for ${functionName}`;
            }
            
            // Check if parameter already exists (avoid duplicates)
            const existingParam = parameters.find(p => p.name === paramName);
            if (!existingParam) {
              parameters.push({
                name: paramName,
                type: paramType,
                description: description,
                required: !param.includes('='), // Parameter is required if no default value
                source: `transform_script_${functionName}`,
                sourceName: `Script: ${functionName}`
              });
            }
          }
        }
      });
    }
  }

  return parameters;
};

/**
 * Extract input parameters from an analytics script by parsing JavaScript function definitions
 * @param {string} script - The analytics script content
 * @returns {Array} Array of parameter objects with name, type, and description
 */
export const extractAnalyticsScriptParameters = (script) => {
  if (!script || typeof script !== 'string') {
    return [];
  }

  const parameters = [];
  
  // Look for function definitions in the script
  const functionPatterns = [
    // Match function declarations like: function analyzeEEGData(data, channels, sampleRate, storageData)
    /function\s+(\w+)\s*\(([^)]*)\)/g,
    // Match arrow functions like: const analyze = (data, channels, sampleRate, storageData) => {}
    /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/g,
    // Match function expressions like: const analyze = function(data, channels, sampleRate, storageData) {}
    /const\s+(\w+)\s*=\s*function\s*\(([^)]*)\)/g
  ];

  for (const pattern of functionPatterns) {
    let match;
    while ((match = pattern.exec(script)) !== null) {
      const functionName = match[1];
      const paramString = match[2];
      
      // Parse parameters
      const paramList = paramString.split(',').map(p => p.trim());
      
      paramList.forEach((param, index) => {
        if (param && param !== '') {
          // Extract parameter name (before default value or type annotation)
          const paramName = param.split('=')[0].split(':')[0].trim();
          
          // Skip if it's an empty parameter or just whitespace
          if (paramName && paramName !== '') {
            // Determine parameter type based on name patterns
            let paramType = 'object';
            let description = `Parameter for ${functionName}`;
            
            if (paramName.toLowerCase().includes('data')) {
              paramType = 'array';
              description = `Input data array for ${functionName}`;
            } else if (paramName.toLowerCase().includes('channels')) {
              paramType = 'array';
              description = `Channel configuration for ${functionName}`;
            } else if (paramName.toLowerCase().includes('samplerate')) {
              paramType = 'number';
              description = `Sample rate for ${functionName}`;
            } else if (paramName.toLowerCase().includes('storage')) {
              paramType = 'object';
              description = `Storage data for ${functionName}`;
            } else if (paramName.toLowerCase().includes('config')) {
              paramType = 'object';
              description = `Configuration object for ${functionName}`;
            } else if (paramName.toLowerCase().includes('analysis')) {
              paramType = 'object';
              description = `Analysis configuration for ${functionName}`;
            }
            
            // Check if parameter already exists (avoid duplicates)
            const existingParam = parameters.find(p => p.name === paramName);
            if (!existingParam) {
              parameters.push({
                name: paramName,
                type: paramType,
                description: description,
                required: !param.includes('='), // Parameter is required if no default value
                source: `analytics_script_${functionName}`,
                sourceName: `Script: ${functionName}`
              });
            }
          }
        }
      });
    }
  }

  return parameters;
};

/**
 * Generate output schema from transform script by analyzing return statements
 * @param {string} script - The transform script content
 * @returns {Array} Array of output field definitions
 */
export const generateTransformOutputSchema = (script) => {
  if (!script || typeof script !== 'string') {
    return [];
  }

  const outputFields = [];
  let foundApplicationObject = false;

  // Helper: safe JSON-ish parse for arrays declared in scripts
  const tryParseArrayLiteral = (text) => {
    try {
      // Normalize quotes and remove trailing commas
      const normalized = text
        .replace(/\'(.*?)\'/g, '"$1"')
        .replace(/,(\s*[\]\}])/g, '$1');
      const parsed = JSON.parse(normalized);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  // Strategy 0: Explicit schema declaration via @outputSchema: [ ... ] in comments
  const commentSchemaMatch = script.match(/@outputSchema\s*:\s*(\[[\s\S]*?\])/);
  if (commentSchemaMatch) {
    const arr = tryParseArrayLiteral(commentSchemaMatch[1]);
    if (arr) {
      return arr.map(f => ({
        name: f.name,
        type: f.type || 'object',
        description: f.description || 'Transform output field',
        source: 'transform_script',
        sourceName: 'Transform Script'
      }));
    }
  }

  // Strategy 1: Explicit schema variable: outputSchema = [ ... ]
  const varSchemaMatch = script.match(/\boutputSchema\s*=\s*(\[[\s\S]*?\])/);
  if (varSchemaMatch) {
    const arr = tryParseArrayLiteral(varSchemaMatch[1]);
    if (arr) {
      return arr.map(f => ({
        name: f.name,
        type: f.type || 'object',
        description: f.description || 'Transform output field',
        source: 'transform_script',
        sourceName: 'Transform Script'
      }));
    }
  }
  
  // Look for return statements to infer output structure
  const returnPatterns = [
    // Match return statements like: return { name: "value", users: [] }
    /return\s*\{([^}]*)\}/g,
    // Match return statements with object variables
    /return\s+(\w+)/g,
    // Match return statements with data object like: return { data: transformedData, metadata: stats }
    /return\s*\{([^}]*data[^}]*)\}/g
  ];

  for (const pattern of returnPatterns) {
    let match;
    while ((match = pattern.exec(script)) !== null) {
      if (pattern.source.includes('\\{')) {
        // Direct object return
        const objectContent = match[1];
        const fieldMatches = objectContent.match(/(\w+)\s*:/g);
        if (fieldMatches) {
          fieldMatches.forEach(fieldMatch => {
            const fieldName = fieldMatch.replace(':', '').trim();
            if (fieldName && !outputFields.find(f => f.name === fieldName)) {
              // Try to infer field type based on context
              let fieldType = 'object';
              let description = `Output field from transform script`;
              
              if (fieldName === 'data' || fieldName === 'transformedData' || fieldName === 'result') {
                fieldType = 'array';
                description = `Transformed data array`;
              } else if (fieldName === 'metadata' || fieldName === 'stats') {
                fieldType = 'object';
                description = `Transformation metadata and statistics`;
              } else if (fieldName === 'application_object') {
                fieldType = 'object';
                description = `OAA application object payload`;
                foundApplicationObject = true;
              } else if (fieldName === 'errors' || fieldName === 'validationErrors') {
                fieldType = 'array';
                description = `Validation or processing errors`;
              } else if (fieldName === 'warnings') {
                fieldType = 'array';
                description = `Processing warnings`;
              }
              
              outputFields.push({
                name: fieldName,
                type: fieldType,
                description: description,
                source: 'transform_script',
                sourceName: 'Transform Script'
              });
            }
          });
        }
      } else {
        // Variable return - look for variable definitions
        const varName = match[1];
        const varPattern = new RegExp(`const\\s+${varName}\\s*=\\s*\\{([^}]*)\\}`, 'g');
        const varMatch = varPattern.exec(script);
        if (varMatch) {
          const objectContent = varMatch[1];
          const fieldMatches = objectContent.match(/(\w+)\s*:/g);
          if (fieldMatches) {
            fieldMatches.forEach(fieldMatch => {
              const fieldName = fieldMatch.replace(':', '').trim();
              if (fieldName && !outputFields.find(f => f.name === fieldName)) {
                outputFields.push({
                  name: fieldName,
                  type: fieldName === 'application_object' ? 'object' : 'object',
                  description: fieldName === 'application_object' ? 'OAA application object payload' : `Output field from transform script`,
                  source: 'transform_script',
                  sourceName: 'Transform Script'
                });
                if (fieldName === 'application_object') {
                  foundApplicationObject = true;
                }
              }
            });
          }
        }
      }
    }
  }

  // If application_object is detected, prefer it as the sole output indicator and skip heuristics
  if (!foundApplicationObject) {
    // Look for common Veza OAA output patterns in the script
    const vezaPatterns = [
    { pattern: /user_id|employee_id|email/g, name: 'user_id', type: 'string', description: 'User identifier' },
    { pattern: /email/g, name: 'email', type: 'string', description: 'User email address' },
    { pattern: /name|full_name/g, name: 'name', type: 'string', description: 'User full name' },
    { pattern: /department/g, name: 'department', type: 'string', description: 'User department' },
    { pattern: /title|job_title/g, name: 'title', type: 'string', description: 'User job title' },
    { pattern: /manager/g, name: 'manager', type: 'string', description: 'User manager' },
    { pattern: /is_active|active/g, name: 'is_active', type: 'boolean', description: 'User active status' },
    { pattern: /employee_type/g, name: 'employee_type', type: 'string', description: 'Employee type' },
    { pattern: /access_level/g, name: 'access_level', type: 'string', description: 'User access level' },
    { pattern: /hire_date/g, name: 'hire_date', type: 'string', description: 'User hire date' },
    { pattern: /location/g, name: 'location', type: 'string', description: 'User location' }
    ];

    // Add Veza-specific fields if they appear in the script
    vezaPatterns.forEach(vezaField => {
      if (vezaField.pattern.test(script) && !outputFields.find(f => f.name === vezaField.name)) {
        outputFields.push({
          name: vezaField.name,
          type: vezaField.type,
          description: vezaField.description,
          source: 'transform_script',
          sourceName: 'Transform Script'
        });
      }
    });
  }

  // If no specific fields found, provide generic output
  if (outputFields.length === 0 || foundApplicationObject) {
    // Ensure application_object is present as canonical output for OAA flows
    const exists = outputFields.find(f => f.name === 'application_object');
    if (exists) {
      // If present alongside other heuristics, collapse to only application_object
      return [{ name: 'application_object', type: 'object', description: 'OAA application object payload', source: 'transform_script', sourceName: 'Transform Script' }];
    }
    outputFields.push({
      name: 'application_object',
      type: 'object',
      description: 'OAA application object payload',
      source: 'transform_script',
      sourceName: 'Transform Script'
    });
  }

  return outputFields;
};

// Helper functions for type detection

const isDateString = (str) => {
  // Basic date pattern detection
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}/, // MM-DD-YYYY
  ];
  
  return datePatterns.some(pattern => pattern.test(str)) && !isNaN(Date.parse(str));
};

const isEmailString = (str) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(str);
};

const isUrlString = (str) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

export default {
  inferSchemaFromData,
  inferFieldType,
  generateFieldDescription,
  generateAPIInputSchema,
  getAPIEndpointInfo,
  getDefaultOutputSchema,
  validateMappings,
  propagateSchemas,
  mergeSchemas,
  applyMappingsToSchema,
  extractTransformScriptParameters,
  generateTransformOutputSchema
};