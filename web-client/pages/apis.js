import React, { useState, useEffect, useContext } from 'react';
import { 
  Typography, 
  Container, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  CircularProgress, 
  Box, 
  Chip, 
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Api as ApiIcon,
  PlayArrow as TestIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Security as SecurityIcon,
  Link as LinkIcon,
  CloudUpload as UploadIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import api from '../lib/api';
import { AppContext } from '../contexts/AppContext';
import LoginButton from '../components/LoginButton';
import APITestWindow from '../components/APITestWindow';

// API Connection Configuration Dialog
const APIConnectionDialog = ({ open, onClose, onSubmit, editingConnection = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    api_type: 'custom',
    base_url: '',
    api_token: '',
    additional_config: {}
  });
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('custom'); // 'veza' or 'custom'
  const [authFormat, setAuthFormat] = useState('bearer'); // bearer | pagerduty | custom
  const [customHeaderName, setCustomHeaderName] = useState('Authorization');
  const [customValueTemplate, setCustomValueTemplate] = useState('Bearer {token}');

  // Available vendors/connection types
  const vendors = [
    { 
      value: 'veza', 
      label: 'Veza API', 
      description: 'Built-in Veza integration with pre-configured endpoints'
    },
    {
      value: 'okta',
      label: 'Okta Management API',
      description: 'Built-in Okta integration using OpenAPI spec'
    },
    { 
      value: 'custom', 
      label: 'Custom API', 
      description: 'Manual configuration or upload OpenAPI specification'
    }
  ];

  useEffect(() => {
    if (editingConnection) {
      setFormData({
        name: editingConnection.name || '',
        description: editingConnection.description || '',
        api_type: editingConnection.api_type || 'custom',
        base_url: editingConnection.base_url || '',
        api_token: editingConnection.api_token || '',
        additional_config: editingConnection.additional_config || {}
      });
      // Determine vendor based on api_type
      setSelectedVendor(editingConnection.api_type === 'veza' ? 'veza' : (editingConnection.api_type === 'okta' ? 'okta' : 'custom'));
      // Prefill auth config if present
      try {
        const oi = editingConnection.openapi_info || {};
        const xconn = oi['x-connection'] || {};
        const auth = xconn.auth || {};
        const hdr = auth.header_name || 'Authorization';
        const tpl = auth.value_template || 'Bearer {token}';
        setCustomHeaderName(hdr);
        setCustomValueTemplate(tpl);
        if (hdr === 'Authorization' && tpl.startsWith('Bearer ')) setAuthFormat('bearer');
        else if (hdr === 'Authorization' && tpl.startsWith('Token token=')) setAuthFormat('pagerduty');
        else setAuthFormat('custom');
      } catch (e) {
        // ignore
      }
    } else {
      setFormData({
        name: '',
        description: '',
        api_type: 'custom',
        base_url: '',
        api_token: '',
        additional_config: {}
      });
      setSelectedVendor('custom');
      setAuthFormat('bearer');
      setCustomHeaderName('Authorization');
      setCustomValueTemplate('Bearer {token}');
    }
    setError('');
    setTestResult(null);
    setSelectedFile(null);
    setUploading(false);
  }, [editingConnection, open]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check if it's a YAML or JSON file
      const validTypes = ['application/x-yaml', 'application/yaml', 'text/yaml', 'text/x-yaml', 'application/json'];
      const validExtensions = ['.yaml', '.yml', '.json'];
      
      if (!validTypes.includes(file.type) && !validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        setError('Please select a YAML (.yaml, .yml) or JSON (.json) file');
        return;
      }
      
      setSelectedFile(file);
      // Auto-fill name from filename if empty
      if (!formData.name) {
        const nameWithoutExt = file.name.replace(/\.(yaml|yml|json)$/i, '');
        setFormData(prev => ({ ...prev, name: nameWithoutExt }));
      }
      setError('');
    }
  };

  const handleVendorChange = (newVendor) => {
    setSelectedVendor(newVendor);
    setSelectedFile(null);
    setError('');
    
    // Auto-fill data based on vendor selection
    if (newVendor === 'veza') {
      setFormData(prev => ({
        ...prev,
        name: prev.name || 'Veza API',
        api_type: 'veza',
        base_url: prev.base_url || '' // User must enter their tenant URL
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        api_type: 'custom',
        base_url: prev.base_url || ''
      }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Connection name is required');
      return;
    }

    if (selectedVendor === 'veza') {
      // Handle Veza built-in API
      if (!formData.base_url.trim()) {
        setError('Veza Instance URL is required');
        return;
      }
      
      const vezaData = {
        ...formData,
        api_type: 'veza'
      };
      // attach auth config
      vezaData.additional_config = {
        ...(vezaData.additional_config || {}),
        auth: buildAuthConfig()
      };
      
      // Test connection before saving
      try {
        const testResult = await api.testAPIConnectionDetails({
          base_url: formData.base_url,
          api_token: formData.api_token,
          api_type: 'veza'
        });
        
        // Add test result to the connection data
        vezaData.test_result = testResult;
        await onSubmit(vezaData, 'veza');
      } catch (error) {
        setError('Connection test failed: ' + error.message);
        return;
      }
    } else if (selectedVendor === 'okta') {
      // Built-in Okta vendor
      if (!formData.base_url.trim()) {
        setError('Okta Base URL is required');
        return;
      }
      if (!formData.api_token.trim()) {
        setError('Okta API token is required');
        return;
      }
      const oktaData = {
        ...formData,
        api_type: 'okta',
        additional_config: {
          ...(formData.additional_config || {}),
          auth: buildAuthConfig()
        }
      };
      try {
        const testResult = await api.testAPIConnectionDetails({
          base_url: formData.base_url,
          api_token: formData.api_token,
          api_type: 'custom'
        });
        oktaData.test_result = testResult;
        await onSubmit(oktaData, 'okta');
      } catch (error) {
        setError('Connection test failed: ' + error.message);
        return;
      }
    } else if (selectedFile) {
      // Handle custom API with OpenAPI spec upload
      setUploading(true);
      try {
        const formDataUpload = new FormData();
        formDataUpload.append('openapi_file', selectedFile);
        formDataUpload.append('connection_name', formData.name);
        formDataUpload.append('description', formData.description);
        if (formData.base_url) {
          formDataUpload.append('base_url', formData.base_url);
        }
        if (formData.api_token) {
          formDataUpload.append('api_token', formData.api_token);
        }
        // pass auth config for backend to embed into spec
        const authCfg = buildAuthConfig();
        if (authCfg.header_name) formDataUpload.append('auth_header_name', authCfg.header_name);
        if (authCfg.value_template) formDataUpload.append('auth_value_template', authCfg.value_template);

        await onSubmit(formDataUpload, 'openapi');
        handleClose();
      } catch (error) {
        setError('Error uploading OpenAPI spec: ' + error.message);
      } finally {
        setUploading(false);
      }
    } else {
      // Handle manual custom API configuration
      if (!formData.base_url.trim()) {
        setError('Base URL is required for custom APIs');
        return;
      }

      // Test connection before saving
      try {
        const testResult = await api.testAPIConnectionDetails({
          base_url: formData.base_url,
          api_token: formData.api_token,
          api_type: 'custom'
        });
        
        // Add test result to the connection data
        const customData = {
          ...formData,
          test_result: testResult
        };
        customData.additional_config = {
          ...(customData.additional_config || {}),
          auth: buildAuthConfig()
        };
        await onSubmit(customData, 'manual');
      } catch (error) {
        setError('Connection test failed: ' + error.message);
        return;
      }
    }
  };

  const buildAuthConfig = () => {
    if (authFormat === 'bearer') return { header_name: 'Authorization', value_template: 'Bearer {token}' };
    if (authFormat === 'pagerduty') return { header_name: 'Authorization', value_template: 'Token token={token}' };
    return { header_name: customHeaderName || 'Authorization', value_template: customValueTemplate || 'Bearer {token}' };
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '', 
      api_type: 'custom',
      base_url: '',
      api_token: '',
      additional_config: {}
    });
    setSelectedVendor('custom');
    setError('');
    setTestResult(null);
    setSelectedFile(null);
    setUploading(false);
    onClose();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      // Make real API call to test connection details
      const testData = {
        base_url: formData.base_url,
        api_token: formData.api_token,
        api_type: selectedVendor === 'veza' ? 'veza' : 'custom'
      };
      
      const response = await api.testAPIConnectionDetails(testData);
      setTestResult(response);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection failed: ' + error.message,
        details: {
          endpoint: formData.base_url,
          status: 'Failed',
          error: error.message
        }
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      api_type: '',
      base_url: '',
      api_token: '',
      additional_config: {}
    });
    setError('');
    setTestResult(null);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
          minHeight: '60vh'
        }
      }}
    >
      <DialogTitle sx={{ color: 'white', borderBottom: '1px solid #333', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ApiIcon sx={{ color: '#8b5cf6' }} />
          <Typography variant="h6">
            {editingConnection ? 'Edit API Connection' : 'Create API Connection'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: '#1a1a1a', color: 'white', p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, bgcolor: '#2d1b1b', color: '#ff6b6b' }}>
            {error}
          </Alert>
        )}

        {/* Connection Information */}
        <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon sx={{ fontSize: 20 }} />
          Connection Details
        </Typography>

        <TextField 
          label="Connection Name" 
          value={formData.name} 
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required 
          fullWidth
          sx={{ 
            mb: 2,
            '& .MuiOutlinedInput-root': { 
              bgcolor: '#1a1a1a', 
              '& fieldset': { borderColor: '#333' },
              '&:hover fieldset': { borderColor: '#8b5cf6' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
            },
            '& .MuiInputLabel-root': { color: '#888' },
            '& .MuiInputBase-input': { color: 'white' }
          }}
          placeholder="e.g., Prod Veza API, Staging Environment"
        />

        <TextField 
          label="Description" 
          value={formData.description} 
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          fullWidth
          multiline
          rows={2}
          sx={{ 
            mb: 3,
            '& .MuiOutlinedInput-root': { 
              bgcolor: '#1a1a1a', 
              '& fieldset': { borderColor: '#333' },
              '&:hover fieldset': { borderColor: '#8b5cf6' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
            },
            '& .MuiInputLabel-root': { color: '#888' },
            '& .MuiInputBase-input': { color: 'white' }
          }}
          placeholder="Describe the purpose and environment of this API connection"
        />

        {/* Vendor Selection (only for new connections) */}
        {!editingConnection && (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel sx={{ color: '#888' }}>API Vendor</InputLabel>
            <Select
              value={selectedVendor}
              onChange={(e) => handleVendorChange(e.target.value)}
              label="API Vendor"
              sx={{
                bgcolor: '#1a1a1a',
                '& fieldset': { borderColor: '#333' },
                '&:hover fieldset': { borderColor: '#8b5cf6' },
                '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                '& .MuiSelect-select': { color: 'white' }
              }}
            >
              {vendors.map((vendor) => (
                <MenuItem key={vendor.value} value={vendor.value}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {vendor.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      {vendor.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* OpenAPI File Upload (only for custom APIs) */}
        {selectedVendor === 'custom' && !editingConnection && (
          <Box sx={{ mb: 3, p: 2, border: '2px dashed #8b5cf6', borderRadius: 2, bgcolor: 'rgba(139, 92, 246, 0.05)' }}>
            <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <UploadIcon sx={{ fontSize: 20 }} />
              Upload OpenAPI Specification (Optional)
            </Typography>
            
            <input
              type="file"
              accept=".yaml,.yml,.json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="openapi-file-upload"
            />
            <label htmlFor="openapi-file-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadIcon />}
                sx={{
                  color: '#8b5cf6',
                  borderColor: '#8b5cf6',
                  '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139, 92, 246, 0.1)' },
                  mb: 1,
                  display: 'block'
                }}
              >
                Select OpenAPI File (.yaml, .yml, .json)
              </Button>
            </label>
            
            {selectedFile && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#2a2a2a', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckIcon sx={{ fontSize: 16 }} />
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </Typography>
              </Box>
            )}
            
            <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 1 }}>
              Upload your OpenAPI 3.x or Swagger 2.x specification file to automatically configure endpoints.
              Or leave empty to configure manually below. Supported formats: YAML (.yaml, .yml) and JSON (.json)
            </Typography>
          </Box>
        )}

        {/* API Configuration */}
        <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon sx={{ fontSize: 20 }} />
          API Configuration
        </Typography>

        {/* Base URL (required for all vendors) */}
        <TextField 
          label={selectedVendor === 'veza' ? "Veza Instance URL" : "Base URL"} 
          value={formData.base_url} 
          onChange={(e) => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
          required 
          fullWidth
          sx={{ 
            mb: 2,
            '& .MuiOutlinedInput-root': { 
              bgcolor: '#1a1a1a', 
              '& fieldset': { borderColor: '#333' },
              '&:hover fieldset': { borderColor: '#8b5cf6' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
            },
            '& .MuiInputLabel-root': { color: '#888' },
            '& .MuiInputBase-input': { color: 'white' }
          }}
          placeholder={selectedVendor === 'veza' ? "https://your-tenant.vezacloud.com" : "https://api.example.com"}
          helperText={selectedVendor === 'veza' ? "Your Veza tenant URL (e.g., https://acme.vezacloud.com)" : "The base URL for your API endpoints"}
          FormHelperTextProps={{
            sx: { color: '#666' }
          }}
        />

        {/* API Token (for all vendors) */}
        <TextField 
          label={selectedVendor === 'veza' ? "Veza API Token" : "API Token / Key"} 
          value={formData.api_token} 
          onChange={(e) => setFormData(prev => ({ ...prev, api_token: e.target.value }))}
          fullWidth
          type="password"
          sx={{ 
            mb: 3,
            '& .MuiOutlinedInput-root': { 
              bgcolor: '#1a1a1a', 
              '& fieldset': { borderColor: '#333' },
              '&:hover fieldset': { borderColor: '#8b5cf6' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
            },
            '& .MuiInputLabel-root': { color: '#888' },
            '& .MuiInputBase-input': { color: 'white' }
          }}
          placeholder={selectedVendor === 'veza' ? "Enter your Veza API token" : "Enter your API token or key (if required)"}
          helperText={selectedVendor === 'veza' ? "Required to authenticate with Veza's APIs" : "API credentials are optional for public APIs and are stored securely"}
          FormHelperTextProps={{
            sx: { color: '#666' }
          }}
        />

        {/* Authorization Header Format */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel sx={{ color: '#888' }}>Auth Format</InputLabel>
          <Select
            value={authFormat}
            label="Auth Format"
            onChange={(e) => setAuthFormat(e.target.value)}
            sx={{
              bgcolor: '#1a1a1a',
              '& fieldset': { borderColor: '#333' },
              '&:hover fieldset': { borderColor: '#8b5cf6' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
              '& .MuiSelect-select': { color: 'white' }
            }}
          >
            <MenuItem value="bearer">Authorization: Bearer {`{token}`}</MenuItem>
            <MenuItem value="pagerduty">Authorization: Token token={`{token}`}</MenuItem>
            <MenuItem value="custom">Custom...</MenuItem>
          </Select>
        </FormControl>
        {authFormat === 'custom' && (
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField 
              label="Header Name" 
              value={customHeaderName}
              onChange={(e) => setCustomHeaderName(e.target.value)}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: '#1a1a1a', '& fieldset': { borderColor: '#333' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } }, '& .MuiInputLabel-root': { color: '#888' }, '& .MuiInputBase-input': { color: 'white' } }}
              placeholder="Authorization"
            />
            <TextField 
              label="Value Template" 
              value={customValueTemplate}
              onChange={(e) => setCustomValueTemplate(e.target.value)}
              sx={{ flex: 2, '& .MuiOutlinedInput-root': { bgcolor: '#1a1a1a', '& fieldset': { borderColor: '#333' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } }, '& .MuiInputLabel-root': { color: '#888' }, '& .MuiInputBase-input': { color: 'white', fontFamily: 'monospace' } }}
              placeholder="Bearer {token}"
              helperText="Use {token} placeholder"
              FormHelperTextProps={{ sx: { color: '#666' } }}
            />
          </Box>
        )}

        {/* Test Connection Section */}
        <Box sx={{ mt: 3, p: 2, bgcolor: '#0f1419', borderRadius: 1, border: '1px solid #333' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" sx={{ color: '#8b5cf6', fontWeight: 600 }}>
              🔍 Test Connection
            </Typography>
            <Button
              onClick={handleTestConnection}
              disabled={!formData.base_url || !formData.api_token || testing}
              variant="outlined"
              size="small"
              sx={{
                borderColor: '#8b5cf6',
                color: '#8b5cf6',
                '&:hover': { borderColor: '#7c3aed', bgcolor: 'rgba(139, 92, 246, 0.1)' }
              }}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </Box>
          
          {testing && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} sx={{ color: '#8b5cf6' }} />
              <Typography variant="body2" sx={{ color: '#888' }}>
                Testing connection to {formData.base_url}...
              </Typography>
            </Box>
          )}

          {testResult && (
            <Alert 
              severity={testResult.success ? 'success' : 'error'} 
              sx={{ 
                mt: 2,
                bgcolor: testResult.success ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                color: testResult.success ? '#4caf50' : '#f44336',
                '& .MuiAlert-icon': { 
                  color: testResult.success ? '#4caf50' : '#f44336' 
                }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                {testResult.message}
              </Typography>
              <List dense>
                <ListItem sx={{ py: 0, px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 20 }}>
                    {testResult.success ? 
                      <CheckIcon sx={{ fontSize: 16, color: '#4caf50' }} /> : 
                      <ErrorIcon sx={{ fontSize: 16, color: '#f44336' }} />
                    }
                  </ListItemIcon>
                  <ListItemText 
                    primary={`Status: ${testResult.details.status}`}
                    primaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
                {testResult.details.response_time && (
                  <ListItem sx={{ py: 0, px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}></ListItemIcon>
                    <ListItemText 
                      primary={`Response Time: ${testResult.details.response_time}`}
                      primaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                )}
              </List>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ bgcolor: '#1a1a1a', borderTop: '1px solid #333', p: 3 }}>
        <Button 
          onClick={handleClose}
          sx={{ color: '#888', '&:hover': { bgcolor: '#333' } }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          disabled={uploading}
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            '&.Mui-disabled': { bgcolor: '#555', color: '#888' },
            ml: 2,
            px: 3
          }}
        >
          {uploading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} sx={{ color: 'white' }} />
              Uploading...
            </Box>
          ) : editingConnection ? 'Update Connection' : (
            selectedFile ? 'Upload & Create' : 'Create Connection'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const APIs = () => {
  const { isAuthenticated, isAuthorized, isLoading } = useContext(AppContext);
  const [apiConnections, setApiConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [testWindowOpen, setTestWindowOpen] = useState(false);
  const [selectedConnectionForTest, setSelectedConnectionForTest] = useState(null);

  useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      fetchAPIConnections();
    }
  }, [isAuthenticated, isAuthorized]);

  const fetchAPIConnections = async () => {
    setLoading(true);
    try {

          const response = await api.fetchAPIConnections();
    setApiConnections(response.api_connections || []);
    } catch (error) {
      console.error('Error fetching API connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async (connectionData, method) => {
    try {
      if (method === 'openapi') {
        // Handle OpenAPI spec upload
        await api.uploadOpenAPISpec(connectionData);
      } else {
        // Handle manual configuration (including Veza)
        await api.createAPIConnection(connectionData);
      }
      
      fetchAPIConnections();
      setShowDialog(false);
    } catch (error) {
      console.error('Error creating API connection:', error);
      throw error; // Re-throw to be handled by the dialog
    }
  };

  const handleUpdateConnection = async (connectionData) => {
    try {

      await api.updateAPIConnection(editingConnection.id, connectionData);
      fetchAPIConnections();
      setEditingConnection(null);
      setShowDialog(false);
    } catch (error) {
      console.error('Error updating API connection:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this API connection?')) {
      try {
  
        await api.deleteAPIConnection(id);
        fetchAPIConnections();
      } catch (error) {
        console.error('Error deleting API connection:', error);
      }
    }
  };

  const handleEdit = (connection) => {
    setEditingConnection(connection);
    setShowDialog(true);
  };

  const handleTest = async (connection) => {
    setSelectedConnectionForTest(connection);
    setTestWindowOpen(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingConnection(null);
    setSelectedConnectionForTest(null);
  };

  const getAPITypeChip = (apiType) => {
    const colorMap = {
      'veza': '#8b5cf6',
      'custom': '#6b7280'
    };

    const labelMap = {
      'veza': 'Veza',
      'custom': 'Custom'
    };

    return (
      <Chip 
        label={labelMap[apiType] || 'Unknown'} 
        size="small" 
        sx={{ 
          bgcolor: colorMap[apiType] || '#666',
          color: 'white',
          fontWeight: 500
        }}
      />
    );
  };

  const getConnectionStatus = (connection) => {
    // Use the actual status from the connection object
    const isActive = connection.status === 'active';
    
    return (
      <Chip 
        label={isActive ? 'Active' : 'Inactive'} 
        size="small" 
        sx={{ 
          bgcolor: isActive ? '#10b981' : '#ef4444',
          color: 'white',
          fontWeight: 500
        }}
      />
    );
  };

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
        <CircularProgress color="primary" />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading...</Typography>
      </Container>
    );
  }

  if (!isAuthenticated || !isAuthorized) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
        <Typography variant="h4" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1" gutterBottom>
          {!isAuthenticated
            ? "You need to be logged in to view this page."
            : "You don't have permission to access the APIs page."}
        </Typography>
        {!isAuthenticated && (
          <LoginButton />
        )}
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        pb: 2,
        borderBottom: '1px solid #333'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ApiIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
            API Connections
          </Typography>
        </Box>
        <Button
          startIcon={<AddIcon />}
          onClick={() => setShowDialog(true)}
          variant="contained"
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            fontWeight: 600,
            px: 3,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none'
          }}
        >
          New API Connection
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : apiConnections.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 8,
          bgcolor: '#1a1a1a',
          borderRadius: 2,
          border: '1px solid #333'
        }}>
          <ApiIcon sx={{ fontSize: 64, color: '#555', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#888', mb: 1 }}>
            No API connections yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Create your first API connection to start building mgflow flows
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setShowDialog(true)}
            variant="contained"
            sx={{
              bgcolor: '#8b5cf6',
              '&:hover': { bgcolor: '#7c3aed' },
              fontWeight: 600,
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none'
            }}
          >
            New API Connection
          </Button>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ 
          bgcolor: '#1a1a1a', 
          border: '1px solid #333',
          borderRadius: 2,
          overflowX: 'auto',
          '& .MuiTableCell-root': {
            borderColor: '#333'
          }
        }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#111' }}>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 180,
                  width: '25%'
                }}>
                  Name
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 120,
                  width: '15%'
                }}>
                  Type
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 200,
                  width: '25%'
                }}>
                  Endpoint
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 100,
                  width: '15%'
                }}>
                  Status
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 120,
                  width: '20%'
                }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apiConnections.map((connection) => (
                <TableRow key={connection.id} sx={{ '&:hover': { bgcolor: '#222' } }}>
                  <TableCell sx={{ color: 'white' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ApiIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {connection.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>
                          {connection.description || 'No description'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'white' }}>
                    {getAPITypeChip(connection.api_type || 'custom')}
                  </TableCell>
                  <TableCell sx={{ color: '#888' }}>
                    <Typography variant="body2" sx={{ 
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}>
                      {connection.base_url || 'Not configured'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: 'white' }}>
                    {getConnectionStatus(connection)}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      onClick={() => handleTest(connection)}
                      sx={{ 
                        color: '#10b981',
                        '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' }
                      }}
                      title="Test Connection"
                    >
                      <TestIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      onClick={() => handleEdit(connection)}
                      sx={{ 
                        color: '#8b5cf6',
                        '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.1)' }
                      }}
                      title="Edit Connection"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      onClick={() => handleDelete(connection.id)}
                      sx={{ 
                        color: '#ef4444',
                        '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' }
                      }}
                      title="Delete Connection"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <APIConnectionDialog
        open={showDialog}
        onClose={handleCloseDialog}
        onSubmit={editingConnection ? handleUpdateConnection : handleCreateConnection}
        editingConnection={editingConnection}
      />

      <APITestWindow
        open={testWindowOpen}
        onClose={() => setTestWindowOpen(false)}
        connection={selectedConnectionForTest}
        onUpdated={fetchAPIConnections}
      />
    </Container>
  );
};

export default APIs;