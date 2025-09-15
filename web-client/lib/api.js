import axios from 'axios';
import Cookies from 'js-cookie';
// --- Platform API instance ---
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_SERVER_URL,
  withCredentials: true,
});

// Can be an interceptor because it's sync
api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Get user email from localStorage to send with requests
  try {
    const cachedUserInfo = localStorage.getItem('userInfo');
    if (cachedUserInfo) {
      const userInfo = JSON.parse(cachedUserInfo);
      if (userInfo.email) {
        config.headers['X-User-Email'] = userInfo.email;
      }
    }
  } catch (error) {
    console.error('Error reading user email from localStorage:', error);
  }
  
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Log the error for debugging
    console.error('API Error:', error);
    
    if (error.response && error.response.status === 401) {
      console.error('Unauthorized access:', error);
      
      // Check if the error response contains re-authentication information
      const errorData = error.response.data;
      if (errorData && errorData.requires_reauth) {
        console.log('Token expired or invalid, redirecting to re-authentication');
        
        // Clear any existing tokens
        const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
        const cookieRemoveOptions = {
          path: '/',
          secure: !isLocalhost,
          sameSite: isLocalhost ? 'Lax' : 'None'
        };
        
        if (!isLocalhost) {
          cookieRemoveOptions.domain = '.mindgardenai.com';
        }
        
        Cookies.remove('access_token', cookieRemoveOptions);
        Cookies.remove('refresh_token', cookieRemoveOptions);
        
        // Clear user info from localStorage
        try {
          localStorage.removeItem('userInfo');
        } catch (e) {
          console.warn('Could not clear userInfo from localStorage:', e);
        }
        
        // Show a user-friendly message about re-authentication
        if (typeof window !== 'undefined') {
          // Store the current page to redirect back after re-auth
          const currentPath = window.location.pathname + window.location.search;
          if (currentPath !== '/') {
            sessionStorage.setItem('redirectAfterAuth', currentPath);
          }
          
          // Show a toast or alert about re-authentication
          if (window.showToast) {
            window.showToast('Session expired. Please log in again.', 'warning');
          } else {
            alert('Your session has expired. Please log in again.');
          }
          
          // Redirect to login page
          window.location.href = '/';
        }
        
        return Promise.reject({
          ...error,
          isAuthError: true,
          requiresReauth: true,
          message: errorData.message || 'Authentication required'
        });
      }
      
      const accessToken = Cookies.get('access_token');
      
      if (!accessToken) {
        // If there's no access token, redirect to the home page
        window.location.href = '/';
        return Promise.reject(error);
      } else {
        // If there is an access token, we'll let the Layout component handle the "not authorized" message
        // Don't throw the error, just return it to be handled gracefully
        return Promise.reject(error);
      }
    }
    
    // For network errors, don't crash the app
    if (error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK') {
      console.warn('Network error detected:', error);
      // Return a custom error that can be handled gracefully
      return Promise.reject({
        ...error,
        isNetworkError: true,
        message: 'Network connection error. Please check your internet connection.'
      });
    }
    
    return Promise.reject(error);
  }
);

const apiClient = {
  // =====================
  // PLATFORM BACKEND API METHODS
  // =====================
  // Authentication
  logout: async () => {
    try {
      const token = Cookies.get('access_token');
      if (token) {
        await api.post('/api/logout', {}, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Backend logout failed:', error);
    } finally {
      // Always remove cookies, even if the backend call fails. This code is redundant, but it's here to ensure that the cookies are removed even if the backend call fails.
      // Remove cookies with environment-appropriate options
      const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const cookieRemoveOptions = {
        path: '/',
        secure: !isLocalhost,
        sameSite: isLocalhost ? 'Lax' : 'None'
      };
      
      // Only set domain for production
      if (!isLocalhost) {
        cookieRemoveOptions.domain = '.mindgardenai.com';
      }
      
      Cookies.remove('access_token', cookieRemoveOptions);
      // Remove refresh token cookie. TODO: We do not support refresh tokens yet.
      Cookies.remove('refresh_token', cookieRemoveOptions);
    }
  },
  fetchUserInfo: async (token) => {
    // Use backend API endpoint which validates token and returns user info with permissions
    const response = await api.get('/api/user');
    return response.data;
  },
  refreshToken: async () => {
    const refreshToken = Cookies.get('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    const response = await axios.post(`${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/refresh-token`, 
      { refresh_token: refreshToken },
      { withCredentials: true }
    );
    if (response.data.access_token) {
      Cookies.set('access_token', response.data.access_token);
      if (response.data.refresh_token) {
        Cookies.set('refresh_token', response.data.refresh_token);
      }
    }
    return response.data;
  },

  // Transforms (formerly Filters)
  fetchTransforms: async () => {
    try {
      const response = await api.get('/api/transforms');
      return response.data;
    } catch (error) {
      console.error('Error fetching transforms:', error);
      throw error;
    }
  },
  createTransform: async (transformData) => {
    try {
      const response = await api.post('/api/transforms', transformData);
      return response.data;
    } catch (error) {
      console.error('Error creating transform:', error);
      throw error;
    }
  },
  updateTransform: async (transformId, transformData) => {
    try {
      const response = await api.put(`/api/transforms/${transformId}`, transformData);
      return response.data;
    } catch (error) {
      console.error('Error updating transform:', error);
      throw error;
    }
  },
  deleteTransform: async (transformId) => {
    try {
      const response = await api.delete(`/api/transforms/${transformId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting transform:', error);
      throw error;
    }
  },

  // Transform Settings
  getTransformSettings: async () => {
    try {
      const response = await api.get('/api/transform-settings');
      return response.data;
    } catch (error) {
      console.error('Error fetching transform settings:', error);
      throw error;
    }
  },

  updateTransformSettings: async (settings) => {
    try {
      const response = await api.put('/api/transform-settings', settings);
      return response.data;
    } catch (error) {
      console.error('Error updating transform settings:', error);
      throw error;
    }
  },


  // Settings (user-specific)
  getUserSettings: async () => {
    const response = await api.get('/api/user/settings');
    return response.data;
  },
  updateUserSettings: async (settings) => {
    const response = await api.put('/api/user/settings', settings);
    return response.data;
  },


  // Data Export
  exportData: async (format) => {
    const response = await api.get(`/export?format=${format}`);
    return response.data;
  },

  // System Status
  getStatus: async () => {
    try {
      const response = await api.get('/api/status');
      return response.data;
    } catch (error) {
      console.error('Error fetching server status:', error);
      throw error;
    }
  },

  // MGFlows
  fetchMGFlows: async () => {
    try {
      const response = await api.get('/api/mgflows');
      return response.data;
    } catch (error) {
      console.error('Error fetching mgflows:', error);
      throw error;
    }
  },

  // Devices (NeuroTech Workloads)
  fetchDevices: async () => {
    const response = await api.get('/api/devices');
    return response.data;
  },
  registerDevice: async (device) => {
    const response = await api.post('/api/devices', device);
    return response.data;
  },
  updateDevice: async (deviceId, device) => {
    const response = await api.put(`/api/devices/${deviceId}`, device);
    return response.data;
  },
  deleteDevice: async (deviceId) => {
    const response = await api.delete(`/api/devices/${deviceId}`);
    return response.data;
  },
  // Experiments (NeuroTech Workloads)
  fetchExperiments: async () => {
    const response = await api.get('/api/experiments');
    return response.data;
  },
  createExperiment: async (name, description, code) => {
    const response = await api.post('/api/experiments', { name, description, code });
    return response.data;
  },
  updateExperiment: async (id, { name, description, code }) => {
    const response = await api.put(`/api/experiments/${id}`, { name, description, code });
    return response.data;
  },
  deleteExperiment: async (id) => {
    const response = await api.delete(`/api/experiments/${id}`);
    return response.data;
  },
  createMGFlow: async (mgflowData) => {
    try {
      const response = await api.post('/api/mgflows', mgflowData);
      return response.data;
    } catch (error) {
      console.error('Error creating mgflow:', error);
      throw error;
    }
  },
  updateMGFlow: async (mgflowId, mgflowData) => {
    try {
      const response = await api.put(`/api/mgflows/${mgflowId}`, mgflowData);
      return response.data;
    } catch (error) {
      console.error('Error updating mgflow:', error);
      throw error;
    }
  },
  deleteMGFlow: async (mgflowId) => {
    try {
      const response = await api.delete(`/api/mgflows/${mgflowId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting mgflow:', error);
      throw error;
    }
  },

  // Files
  fetchFiles: async () => {
    try {
      const response = await api.get('/api/files');
      return response.data;
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  },
  uploadFile: async (formData) => {
    try {
      const response = await api.post('/api/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },
  deleteFile: async (fileId) => {
    try {
      const response = await api.delete(`/api/files/${fileId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  // API Connections  
  fetchAPIConnections: async () => {
    try {
      const response = await api.get('/api/api-connections');
      return response.data;
    } catch (error) {
      console.error('Error fetching API connections:', error);
      throw error;
    }
  },
  createAPIConnection: async (connectionData) => {
    try {
      const response = await api.post('/api/api-connections', connectionData);
      return response.data;
    } catch (error) {
      console.error('Error creating API connection:', error);
      throw error;
    }
  },
  updateAPIConnection: async (connectionId, connectionData) => {
    try {
      const response = await api.put(`/api/api-connections/${connectionId}`, connectionData);
      return response.data;
    } catch (error) {
      console.error('Error updating API connection:', error);
      throw error;
    }
  },
  deleteAPIConnection: async (connectionId) => {
    try {
      const response = await api.delete(`/api/api-connections/${connectionId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting API connection:', error);
      throw error;
    }
  },
  testAPIConnection: async (connectionId) => {
    try {
      const response = await api.post(`/api/api-connections/${connectionId}/test`);
      return response.data;
    } catch (error) {
      console.error('Error testing API connection:', error);
      throw error;
    }
  },
  testAPIConnectionDetails: async (connectionDetails) => {
    try {
      const response = await api.post('/api/api-connections/test', connectionDetails);
      return response.data;
    } catch (error) {
      console.error('Error testing API connection details:', error);
      throw error;
    }
  },
  testAPIEndpoint: async (testData) => {
    try {
      const response = await api.post('/api/api-connections/test-endpoint', testData);
      return response.data;
    } catch (error) {
      console.error('Error testing API endpoint:', error);
      throw error;
    }
  },
  uploadOpenAPISpec: async (formData) => {
    try {
      const response = await api.post('/api/api-connections/upload-openapi', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading OpenAPI spec:', error);
      throw error;
    }
  },

  // Participants
  fetchParticipants: async () => {
    const response = await api.get('/api/participants');
    return response.data;
  },
  createParticipant: async (participantData) => {
    const response = await api.post('/api/participants', participantData);
    return response.data;
  },
  updateParticipant: async (id, participantData) => {
    const response = await api.put(`/api/participants/${id}`, participantData);
    return response.data;
  },
  deleteParticipant: async (id) => {
    const response = await api.delete(`/api/participants/${id}`);
    return response.data;
  },

  // Storage
  fetchStorageItems: async () => {
    const response = await api.get('/api/storage');
    return response.data;
  },
  getStoragePresets: async (id) => {
    const response = await api.get(`/api/storage/${id}/presets`);
    return response.data;
  },
  updateStoragePresets: async (id, presets) => {
    const response = await api.put(`/api/storage/${id}/presets`, { presets });
    return response.data;
  },
  createStorageItem: async (storageItemData) => {
    const response = await api.post('/api/storage', storageItemData);
    return response.data;
  },
  updateStorageItem: async (id, storageItemData) => {
    const response = await api.put(`/api/storage/${id}`, storageItemData);
    return response.data;
  },
  deleteStorageItem: async (id) => {
    try {
      const response = await api.delete(`/api/storage/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting storage item:', error);
      throw error;
    }
  },
  getStorageData: async (storageId) => {
    try {
      const response = await api.get(`/api/storage/${storageId}/data`);
      return response.data;
    } catch (error) {
      console.error('Error getting storage data:', error);
      throw error;
    }
  },

  // Models
  fetchModels: async () => {
    const response = await api.get('/api/models');
    return response.data;
  },
  createModel: async (modelData) => {
    const response = await api.post('/api/models', modelData);
    return response.data;
  },
  updateModel: async (id, modelData) => {
    const response = await api.put(`/api/models/${id}`, modelData);
    return response.data;
  },
  deleteModel: async (id) => {
    const response = await api.delete(`/api/models/${id}`);
    return response.data;
  },

  // Analytics
  fetchAnalytics: async () => {
    const response = await api.get('/api/analytics');
    return response.data;
  },
  createAnalytics: async (analyticsData) => {
    const response = await api.post('/api/analytics', analyticsData);
    return response.data;
  },
  updateAnalytics: async (id, analyticsData) => {
    const response = await api.put(`/api/analytics/${id}`, analyticsData);
    return response.data;
  },
  deleteAnalytics: async (id) => {
    const response = await api.delete(`/api/analytics/${id}`);
    return response.data;
  },

  verifyToken: async (token) => {
    try {
      const response = await api.post('/api/verify-token', { token });
      return response.data;
    } catch (error) {
      console.error('Error verifying token:', error);
      // Don't throw the error, just return a default response
      // This prevents aggressive logout on network errors
      return { isValid: false, error: error.message };
    }
  },

  // Graph
  graphIngest: async (payload) => {
    const response = await api.post('/api/graph/ingest', payload);
    return response.data;
  },
  graphQuery: async (payload) => {
    const response = await api.post('/api/graph/query', payload);
    return response.data;
  },
  graphMGQL: async (payload) => {
    const response = await api.post('/api/graph/mgql', payload);
    return response.data;
  },

  // Flow Monitors (MGQL-based)
  createFlowMonitor: async ({ flow, trigger_node_id, monitor }) => {
    const response = await api.post('/api/flows/monitors', { flow, trigger_node_id, monitor });
    return response.data;
  },
  deleteFlowMonitor: async (monitorId) => {
    const response = await api.delete(`/api/flows/monitors/${monitorId}`);
    return response.data;
  },

  // This gets the OpenAPIfor api-docs for the platform documentation
  getOpenApiJson: async () => {
    const response = await api.get('/api/openapi.json');
    // Update the server URL in the OpenAPI spec
    if (response.data && response.data.servers) {
      response.data.servers = [{ url: process.env.NEXT_PUBLIC_API_SERVER_URL }]; 
    }
    return response.data;
  },

  // Connection OpenAPI specification
  // Returns JSON for custom connections (full spec saved), YAML string fallback for Veza
  getConnectionOpenApiSpec: async (connectionId, options = { responseType: 'json' }) => {
    // responseType can be 'json' or 'text'. Default to JSON where possible.
    const axiosOptions = {};
    if (options.responseType === 'text') {
      axiosOptions.responseType = 'text';
    }
    const response = await api.get(`/api/api-connections/${connectionId}/openapi`, axiosOptions);
    return response.data;
  },

  // Flow Execution
  executeFlow: async (flowData) => {
    try {
      console.log('📡 API: Sending flow execution request...', flowData);
      const response = await api.post('/api/flows/execute', { flow: flowData });
      console.log('📡 API: Flow execution response:', response.data);
      return response.data;
    } catch (error) {
      console.error('📡 API: Flow execution error:', error);
      throw error;
    }
  },

  // Schema Detection and Validation
  detectSchema: async (schemaRequest) => {
    try {
      const response = await api.post('/api/schemas/detect', schemaRequest);
      return response.data;
    } catch (error) {
      console.error('Schema detection error:', error);
      throw error;
    }
  },

  validateMappings: async (validationRequest) => {
    try {
      const response = await api.post('/api/schemas/validate', validationRequest);
      return response.data;
    } catch (error) {
      console.error('Mapping validation error:', error);
      throw error;
    }
  },


};

export default apiClient;