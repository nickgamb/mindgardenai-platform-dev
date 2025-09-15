/**
 * Veza API Integration Module
 * 
 * This module provides a comprehensive interface for interacting with Veza's APIs,
 * specifically focusing on the Open Authorization API (OAA) for custom data sources.
 * 
 * Key Features:
 * - Provider and Data Source Management
 * - OAA Data Push Operations (JSON, CSV, Multipart)
 * - Template Management
 * - Authentication and Error Handling
 * 
 * Based on Veza OpenAPI Specification
 */

import axios from 'axios';

class VezaAPIClient {
  constructor(baseUrl, apiToken, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiToken = apiToken;
    this.options = {
      timeout: 30000,
      retries: 3,
      ...options
    };

    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.options.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Deployment-Assistant/1.0'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => this._handleError(error)
    );
  }

  /**
   * Handle API errors with detailed information
   */
  _handleError(error) {
    const errorInfo = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase()
    };

    console.error('Veza API Error:', errorInfo);
    
    // Create a more descriptive error
    const customError = new Error(
      `Veza API ${errorInfo.method || 'Request'} failed: ${errorInfo.message}`
    );
    customError.vezaError = errorInfo;
    
    throw customError;
  }

  /**
   * Test the API connection and authentication
   */
  async testConnection() {
    try {
      // Try to list custom providers as a basic connectivity test
      const response = await this.client.get('/api/v1/providers/custom');
      return {
        success: true,
        message: 'Connection successful',
        details: {
          status: response.status,
          providersCount: response.data?.custom_providers?.length || 0,
          responseTime: response.headers['x-response-time'] || 'N/A'
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        details: error.vezaError || {}
      };
    }
  }

  // ================================
  // PROVIDER MANAGEMENT
  // ================================

  /**
   * List all custom providers
   */
  async listCustomProviders(options = {}) {
    const params = {
      page_size: options.pageSize || 100,
      page_token: options.pageToken,
      ...options.filters
    };

    const response = await this.client.get('/api/v1/providers/custom', { params });
    return response.data;
  }

  /**
   * Get a specific custom provider by ID
   */
  async getCustomProvider(providerId) {
    const response = await this.client.get(`/api/v1/providers/custom/${providerId}`);
    return response.data;
  }

  /**
   * Create a new custom provider
   */
  async createCustomProvider(providerData) {
    const response = await this.client.post('/api/v1/providers/custom', {
      custom_provider: providerData
    });
    return response.data;
  }

  /**
   * Update an existing custom provider
   */
  async updateCustomProvider(providerId, providerData) {
    const response = await this.client.put(`/api/v1/providers/custom/${providerId}`, {
      custom_provider: providerData
    });
    return response.data;
  }

  /**
   * Delete a custom provider
   */
  async deleteCustomProvider(providerId) {
    const response = await this.client.delete(`/api/v1/providers/custom/${providerId}`);
    return response.data;
  }

  /**
   * List available custom provider templates
   */
  async listCustomProviderTemplates() {
    const response = await this.client.get('/api/v1/providers/custom/templates');
    return response.data;
  }

  // ================================
  // DATA SOURCE MANAGEMENT
  // ================================

  /**
   * List data sources for a custom provider
   */
  async listDataSources(providerId, options = {}) {
    const params = {
      page_size: options.pageSize || 100,
      page_token: options.pageToken,
      ...options.filters
    };

    const response = await this.client.get(
      `/api/v1/providers/custom/${providerId}/datasources`, 
      { params }
    );
    return response.data;
  }

  /**
   * Get a specific data source
   */
  async getDataSource(providerId, dataSourceId) {
    const response = await this.client.get(
      `/api/v1/providers/custom/${providerId}/datasources/${dataSourceId}`
    );
    return response.data;
  }

  /**
   * Create a new data source
   */
  async createDataSource(providerId, dataSourceData) {
    const response = await this.client.post(
      `/api/v1/providers/custom/${providerId}/datasources`,
      { data_source: dataSourceData }
    );
    return response.data;
  }

  /**
   * Delete a data source
   */
  async deleteDataSource(providerId, dataSourceId) {
    const response = await this.client.delete(
      `/api/v1/providers/custom/${providerId}/datasources/${dataSourceId}`
    );
    return response.data;
  }

  // ================================
  // OAA DATA PUSH OPERATIONS
  // ================================

  /**
   * Push OAA JSON data to a data source
   * This is the primary method for sending authorization data to Veza
   */
  async pushOAAData(providerId, dataSourceId, oaaPayload, options = {}) {
    const requestBody = {
      data_source_id: dataSourceId,
      data: oaaPayload,
      save_json: options.saveJson || false,
      options: options.pushOptions || {}
    };

    const response = await this.client.post(
      `/api/v1/providers/custom/${providerId}/datasources/${dataSourceId}:push`,
      requestBody
    );
    return response.data;
  }

  /**
   * Push CSV data to a data source
   * Useful for simple tabular data ingestion
   */
  async pushCSVData(providerId, dataSourceId, csvData, options = {}) {
    const requestBody = {
      data_source_id: dataSourceId,
      csv_data: csvData,
      options: options.pushOptions || {}
    };

    const response = await this.client.post(
      `/api/v1/providers/custom/${providerId}/datasources/${dataSourceId}:push_csv`,
      requestBody
    );
    return response.data;
  }

  /**
   * Push large OAA data using multipart upload
   * Recommended for datasets larger than 10MB
   */
  async pushOAADataMultipart(providerId, dataSourceId, oaaPayload, options = {}) {
    const requestBody = {
      data_source_id: dataSourceId,
      data: oaaPayload,
      save_json: options.saveJson || false,
      options: options.pushOptions || {}
    };

    const response = await this.client.post(
      `/api/v1/providers/custom/${providerId}/datasources/${dataSourceId}:multipart_push`,
      requestBody
    );
    return response.data;
  }

  // ================================
  // HELPER METHODS FOR OAA
  // ================================

  /**
   * Create a basic OAA payload structure
   * This is a helper method to create the standard OAA JSON structure
   */
  createOAAPayload(options = {}) {
    return {
      custom_property_definition: options.customProperties || {},
      applications: options.applications || [],
      identity_providers: options.identityProviders || [],
      resources: options.resources || [],
      local_users: options.localUsers || [],
      local_groups: options.localGroups || [],
      local_roles: options.localRoles || [],
      permissions: options.permissions || {},
      created_at: new Date().toISOString(),
      metadata: {
        version: "1.0",
        generated_by: "Deployment-Assistant",
        ...options.metadata
      }
    };
  }

  /**
   * Validate OAA payload structure
   * Basic validation to ensure required fields are present
   */
  validateOAAPayload(payload) {
    const errors = [];

    if (!payload || typeof payload !== 'object') {
      errors.push('Payload must be a valid object');
      return { valid: false, errors };
    }

    // Check for at least one data section
    const dataSections = [
      'applications', 'identity_providers', 'resources', 
      'local_users', 'local_groups', 'local_roles'
    ];
    
    const hasData = dataSections.some(section => 
      payload[section] && Array.isArray(payload[section]) && payload[section].length > 0
    );

    if (!hasData) {
      errors.push('Payload must contain at least one data section with data');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ================================
  // UTILITY METHODS
  // ================================

  /**
   * Get API health status
   */
  async getHealth() {
    try {
      // Use a lightweight endpoint to check API health
      const response = await this.client.get('/api/v1/providers/custom/templates');
      return {
        status: 'healthy',
        responseTime: response.headers['x-response-time'] || 'N/A',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Build request URL for debugging
   */
  buildUrl(path) {
    return `${this.baseUrl}${path}`;
  }
}

// Export the class and a factory function
export default VezaAPIClient;

/**
 * Factory function to create a VezaAPIClient instance
 */
export function createVezaClient(baseUrl, apiToken, options = {}) {
  return new VezaAPIClient(baseUrl, apiToken, options);
}

/**
 * Common OAA templates and helpers
 */
export const OAATemplates = {
  /**
   * Create a basic application template
   */
  createApplication(name, description = '') {
    return {
      name,
      description,
      application_type: 'custom',
      local_users: [],
      local_groups: [],
      local_roles: [],
      resources: [],
      permissions: {}
    };
  },

  /**
   * Create a local user template
   */
  createLocalUser(name, email = '', identities = []) {
    return {
      name,
      unique_id: name,
      email,
      identities: Array.isArray(identities) ? identities : [identities].filter(Boolean),
      is_active: true,
      created_at: new Date().toISOString()
    };
  },

  /**
   * Create a resource template
   */
  createResource(name, resourceType = 'generic', properties = {}) {
    return {
      name,
      unique_id: name,
      resource_type: resourceType,
      properties,
      created_at: new Date().toISOString()
    };
  },

  /**
   * Common permission definitions
   */
  permissions: {
    READ: 'DataRead',
    WRITE: 'DataWrite',
    DELETE: 'DataDelete',
    ADMIN: 'Admin',
    EXECUTE: 'Execute',
    CREATE: 'DataCreate'
  }
};

/**
 * Veza API Error Types
 */
export const VezaErrorTypes = {
  AUTHENTICATION: 'authentication_error',
  AUTHORIZATION: 'authorization_error', 
  VALIDATION: 'validation_error',
  NOT_FOUND: 'not_found_error',
  RATE_LIMIT: 'rate_limit_error',
  SERVER_ERROR: 'server_error',
  NETWORK_ERROR: 'network_error'
};
