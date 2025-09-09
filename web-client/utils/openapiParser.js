import yaml from 'js-yaml';
import api from '../lib/api';

// Cache for parsed OpenAPI specs
const openapiCache = new Map();

/**
 * Parse OpenAPI YAML and extract schema information
 * @param {string} yamlContent - The OpenAPI YAML content
 * @returns {Object} Parsed OpenAPI specification
 */
export const parseOpenAPISpec = (yamlContent) => {
  try {
    const spec = yaml.load(yamlContent);
    return spec;
  } catch (error) {
    console.error('Error parsing OpenAPI YAML:', error);
    return null;
  }
};

/**
 * Generate schema template for a specific endpoint
 * @param {Object} spec - Parsed OpenAPI specification
 * @param {string} path - API path (e.g., '/api/v1/providers/custom')
 * @param {string} method - HTTP method (e.g., 'POST')
 * @returns {Object|null} Schema template or null if not found
 */
export const generateSchemaTemplate = (spec, path, method) => {
  if (!spec || !spec.paths || !spec.paths[path]) {
    return null;
  }

  const pathItem = spec.paths[path];
  const operation = pathItem[method.toLowerCase()];
  
  if (!operation || !operation.requestBody) {
    return null;
  }

  const requestBody = operation.requestBody;
  const content = requestBody.content;
  
  // Look for JSON schema
  const jsonSchema = content['application/json']?.schema;
  if (!jsonSchema) {
    return null;
  }

  return generateTemplateFromSchema(spec, jsonSchema);
};

/**
 * Generate template object from OpenAPI schema
 * @param {Object} spec - Parsed OpenAPI specification
 * @param {Object} schema - OpenAPI schema object
 * @returns {Object} Template object
 */
const generateTemplateFromSchema = (spec, schema) => {
  if (schema.type === 'object' && schema.properties) {
    const template = {};
    
    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
      template[propertyName] = generateValueFromSchema(spec, propertySchema);
    }
    
    return template;
  }
  
  return generateValueFromSchema(spec, schema);
};

/**
 * Generate a value based on OpenAPI schema
 * @param {Object} spec - Parsed OpenAPI specification
 * @param {Object} schema - OpenAPI schema object
 * @returns {any} Generated value
 */
const generateValueFromSchema = (spec, schema) => {
  // Handle $ref references
  if (schema.$ref) {
    const refSchema = resolveRef(spec, schema.$ref);
    if (refSchema) {
      return generateValueFromSchema(spec, refSchema);
    }
  }

  // Handle different types
  switch (schema.type) {
    case 'string':
      if (schema.enum) {
        return schema.enum[0] || 'string';
      }
      if (schema.format === 'uuid') {
        return 'uuid-string';
      }
      if (schema.format === 'date-time') {
        return '2024-01-01T00:00:00Z';
      }
      return 'string';
    
    case 'integer':
    case 'number':
      if (schema.enum) {
        return schema.enum[0] || 0;
      }
      return 0;
    
    case 'boolean':
      return false;
    
    case 'array':
      if (schema.items) {
        const itemValue = generateValueFromSchema(spec, schema.items);
        return [itemValue];
      }
      return [];
    
    case 'object':
      if (schema.properties) {
        const obj = {};
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          obj[propName] = generateValueFromSchema(spec, propSchema);
        }
        return obj;
      }
      return {};
    
    default:
      return 'unknown';
  }
};

/**
 * Resolve $ref references in OpenAPI spec
 * @param {Object} spec - Parsed OpenAPI specification
 * @param {string} ref - Reference string (e.g., '#/components/schemas/MySchema')
 * @returns {Object|null} Referenced schema or null
 */
const resolveRef = (spec, ref) => {
  if (!ref.startsWith('#/')) {
    return null;
  }

  const path = ref.substring(2).split('/');
  let current = spec;
  
  for (const segment of path) {
    if (current && typeof current === 'object' && current[segment]) {
      current = current[segment];
    } else {
      return null;
    }
  }
  
  return current;
};

/**
 * Load and cache OpenAPI specification
 * @param {string} specUrl - URL or path to OpenAPI spec
 * @returns {Promise<Object>} Parsed OpenAPI specification
 */
export const loadOpenAPISpec = async (specUrl) => {
  // Check cache first
  if (openapiCache.has(specUrl)) {
    return openapiCache.get(specUrl);
  }

  try {
    const response = await fetch(specUrl);
    const yamlContent = await response.text();
    const spec = parseOpenAPISpec(yamlContent);
    
    if (spec) {
      openapiCache.set(specUrl, spec);
    }
    
    return spec;
  } catch (error) {
    console.error('Error loading OpenAPI spec:', error);
    return null;
  }
};

/**
 * Get schema template for an endpoint
 * @param {string} endpoint - Full endpoint (e.g., 'POST /api/v1/providers/custom')
 * @param {Object} connection - API connection object with openapi_info
 * @returns {Promise<Object|null>} Schema template or null
 */
export const getSchemaTemplate = async (endpoint, connection) => {
  if (!connection?.openapi_info) {
    return null;
  }

  try {
    // Parse the stored OpenAPI info if it's JSON string; otherwise pass-through
    let openapiInfo = connection.openapi_info;
    if (typeof openapiInfo === 'string') {
      try {
        openapiInfo = JSON.parse(openapiInfo);
      } catch (_) {
        // If not JSON, it might already be YAML content or minimal metadata; leave as-is
      }
    }
    
    let spec = null;
    
    // Check if this is a Veza connection (has only metadata, not full spec)
    if (connection.api_type === 'veza' && openapiInfo && openapiInfo.title && !openapiInfo.paths) {
      // For Veza connections, load the full OpenAPI spec from the backend via shared API client
      try {
        const yamlContent = await api.getConnectionOpenApiSpec(connection.id, { responseType: 'text' });
        if (typeof yamlContent === 'string') {
          spec = parseOpenAPISpec(yamlContent);
        } else {
          console.error('Unexpected Veza OpenAPI spec response');
          return null;
        }
      } catch (error) {
        console.error('Error loading Veza OpenAPI spec:', error);
        return null;
      }
    } else {
      // For custom APIs, try to use the stored full spec; if minimal, fetch from backend
      if (openapiInfo && (openapiInfo.openapi || openapiInfo.swagger || openapiInfo.paths)) {
        spec = openapiInfo; // Already a parsed JSON spec
      } else {
        // Fetch the stored spec from backend (supports JSON)
        try {
          const jsonSpec = await api.getConnectionOpenApiSpec(connection.id, { responseType: 'json' });
          spec = jsonSpec;
        } catch (error) {
          console.error('Error loading connection OpenAPI spec:', error);
          return null;
        }
      }
    }
    
    if (!spec) {
      return null;
    }

    // Extract path and method from endpoint
    const [method, path] = endpoint.split(' ');
    if (!method || !path) {
      return null;
    }

    return generateSchemaTemplate(spec, path, method);
  } catch (error) {
    console.error('Error generating schema template:', error);
    return null;
  }
};
