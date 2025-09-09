import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem,
  Box, Typography, Button, IconButton, CircularProgress, Alert
} from '@mui/material';
import {
  PlayArrow as TestIcon, Close as CloseIcon
} from '@mui/icons-material';
import api from '../lib/api';
import { getSchemaTemplate } from '../utils/openapiParser';
import JavaScriptEditor from './JavaScriptEditor';

const APITestWindow = ({ open, onClose, connection, onUpdated }) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [requestBody, setRequestBody] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [loadingBody, setLoadingBody] = useState(false);

  const endpoints = connection?.endpoints_available || [];

  const handleEndpointChange = (endpoint) => {
    setSelectedEndpoint(endpoint);
    // Optimistically clear to force immediate UI update
    setRequestBody('');
  };

  // Update request body whenever the selected endpoint changes
  useEffect(() => {
    const updateTemplate = async () => {
      if (!selectedEndpoint) return;
      try {
        setLoadingBody(true);
        const template = await getSchemaTemplate(selectedEndpoint, connection);
        if (template) {
          setRequestBody(JSON.stringify(template, null, 2));
        } else {
          setRequestBody(`{\n  "example": "value",\n  "data": {\n    "key": "value"\n  }\n}`);
        }
      } catch (error) {
        console.error('Error generating schema template:', error);
        setRequestBody(`{\n  "example": "value",\n  "data": {\n    "key": "value"\n  }\n}`);
      } finally {
        setLoadingBody(false);
      }
    };
    updateTemplate();
  }, [selectedEndpoint, connection]);

  const handleTest = async () => {
    if (!selectedEndpoint) {
      setError('Please select an endpoint to test');
      return;
    }

    setTesting(true);
    setError('');
    setTestResult(null);

    try {
      // Find the selected endpoint details
      const endpoint = endpoints.find(ep => `${ep.method} ${ep.path}` === selectedEndpoint);
      if (!endpoint) {
        throw new Error('Selected endpoint not found');
      }

      // Prepare the test request
      const testData = {
        connection_id: connection.id,
        endpoint: endpoint.path,
        method: endpoint.method,
        body: requestBody.trim() || null
      };

      const response = await api.testAPIEndpoint(testData);
      setTestResult(response);
      // If test succeeded, flip connection status to active
      try {
        if (response && response.success && connection && connection.id) {
          await api.updateAPIConnection(connection.id, { status: 'active' });
          if (typeof onUpdated === 'function') {
            onUpdated();
          }
        }
      } catch (e) {
        // non-blocking
      }
      
      // If the test failed, also set the error message
      if (!response.success) {
        setError(response.message || 'Test failed');
      }
    } catch (error) {
      setError('Test failed: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    setSelectedEndpoint('');
    setRequestBody('');
    setTestResult(null);
    setError('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a1a',
          color: 'white',
          minHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: '#2a2a2a', 
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TestIcon sx={{ color: '#10b981' }} />
          <Typography variant="h6">
            Test API: {connection?.name}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: '#888' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Endpoint Selection */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 2, color: '#8b5cf6', fontWeight: 600 }}>
              📡 Select API Endpoint
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: '#888' }}>Endpoint</InputLabel>
              <Select
                value={selectedEndpoint}
                onChange={(e) => handleEndpointChange(e.target.value)}
                sx={{
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#333'
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#8b5cf6'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#8b5cf6'
                  }
                }}
              >
                {endpoints.map((endpoint, index) => (
                  <MenuItem key={index} value={`${endpoint.method} ${endpoint.path}`}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {endpoint.method} {endpoint.path}
                      </Typography>
                      {endpoint.summary && (
                        <Typography variant="caption" sx={{ color: '#888' }}>
                          {endpoint.summary}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Request Body */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 2, color: '#8b5cf6', fontWeight: 600 }}>
              📝 Request Body (JSON)
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <JavaScriptEditor
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                placeholder={'{\n  "example": "value",\n  "data": {\n    "key": "value"\n  }\n}'}
                height="260px"
                filename="request.json"
                language="json"
                disableValidation={true}
              />
              {loadingBody && (
                <Box sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(0,0,0,0.4)',
                  borderRadius: 1
                }}>
                  <CircularProgress size={28} />
                </Box>
              )}
            </Box>
            <Typography variant="caption" sx={{ color: '#666', mt: 1, display: 'block' }}>
              Enter JSON request body (optional for GET requests)
            </Typography>
          </Box>

          {/* Test Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              onClick={handleTest}
              disabled={!selectedEndpoint || testing}
              variant="contained"
              startIcon={testing ? <CircularProgress size={20} /> : <TestIcon />}
              sx={{
                bgcolor: '#10b981',
                '&:hover': { bgcolor: '#059669' },
                '&:disabled': { bgcolor: '#555', color: '#888' },
                px: 4,
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              {testing ? 'Testing...' : 'Test API Call'}
            </Button>
          </Box>

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ bgcolor: '#2d1b1b', color: '#ff6b6b' }}>
              <Box>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {error}
                </Typography>
                {testResult && testResult.details && (
                  <Box sx={{ mt: 1, p: 1, bgcolor: '#1a0f0f', borderRadius: 1, fontFamily: 'monospace', fontSize: '12px' }}>
                    <Typography variant="caption" sx={{ color: '#ff9999', display: 'block', mb: 1 }}>
                      Error Details:
                    </Typography>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(testResult.details, null, 2)}
                    </pre>
                  </Box>
                )}
              </Box>
            </Alert>
          )}

          {/* Test Results */}
          {testResult && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: testResult.success ? '#10b981' : '#ef4444' }}>
                {testResult.success ? '✅ Test Successful' : '❌ Test Failed'}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {/* Request Details */}
                <Box sx={{ flex: 1, minWidth: 300 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: '#8b5cf6' }}>
                    📤 Request Details
                  </Typography>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#0f0f0f', 
                    borderRadius: 1, 
                    border: '1px solid #333',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}>
                    <Box sx={{ mb: 1 }}>
                      <strong>URL:</strong> {testResult.details?.endpoint}
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <strong>Method:</strong> {testResult.details?.method}
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <strong>Status:</strong> {testResult.details?.status_code}
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <strong>Response Time:</strong> {testResult.details?.response_time}
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <strong>Headers:</strong>
                      <Box sx={{ mt: 0.5, ml: 1 }}>
                        <Box sx={{ color: '#888' }}>
                          {(connection?.openapi_info && connection.openapi_info['x-connection'] && connection.openapi_info['x-connection'].auth)
                            ? `${connection.openapi_info['x-connection'].auth.header_name || 'Authorization'}: ${(connection.openapi_info['x-connection'].auth.value_template || 'Bearer {token}').replace('{token}', '[REDACTED]')}`
                            : 'Authorization: Bearer [REDACTED]'}
                        </Box>
                        <Box sx={{ color: '#888' }}>
                          Content-Type: application/json
                        </Box>
                        <Box sx={{ color: '#888' }}>
                          Accept: application/json
                        </Box>
                      </Box>
                    </Box>
                    {requestBody && (
                      <Box>
                        <strong>Request Body:</strong>
                        <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>
                          {requestBody}
                        </pre>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Response Details */}
                <Box sx={{ flex: 1, minWidth: 300 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: '#8b5cf6' }}>
                    📥 Response Details
                  </Typography>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#0f0f0f', 
                    borderRadius: 1, 
                    border: '1px solid #333',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    maxHeight: '300px',
                    overflow: 'auto'
                  }}>
                    {testResult.details?.response ? (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(testResult.details.response, null, 2)}
                      </pre>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        No response body available
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ bgcolor: '#2a2a2a', borderTop: '1px solid #333', p: 2 }}>
        <Button onClick={handleClose} sx={{ color: '#888' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default APITestWindow;
