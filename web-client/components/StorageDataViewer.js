import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Button, IconButton, CircularProgress, Alert,
  Tabs, Tab, Chip
} from '@mui/material';
import {
  Visibility as ViewIcon, Close as CloseIcon, Storage as StorageIcon, DataObject as DataObjectIcon
} from '@mui/icons-material';
import api from '../lib/api';

const StorageDataViewer = ({ open, onClose, connection }) => {
  const [storageData, setStorageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (open && connection) {
      loadStorageData();
    }
  }, [open, connection]);

  const loadStorageData = async () => {
    setLoading(true);
    setError('');
    setStorageData(null);

    try {
      const response = await api.getStorageData(connection.id);
      setStorageData(response);
    } catch (error) {
      setError('Failed to load storage data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStorageData(null);
    setError('');
    setActiveTab(0);
    onClose();
  };

  const getConnectionDetails = (connection) => {
    try {
      const details = JSON.parse(connection.file_path);
      if (connection.file_type === 'blob_storage') {
        return {
          type: 'Hosted Blob',
          description: details.description || 'No description',
          dataSize: details.data ? details.data.length : 0,
          created: details.created_at || connection.created_at
        };
      } else {
        return {
          type: connection.file_type.toUpperCase(),
          host: details.host,
          port: connection.file_size,
          username: details.username,
          database: details.database
        };
      }
    } catch (e) {
      return { type: 'Unknown', description: 'Invalid connection data' };
    }
  };

  const details = connection ? getConnectionDetails(connection) : {};
  const isBlob = connection?.file_type === 'blob_storage';

  const formatData = (data) => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  };

  const renderDataView = () => {
    if (!storageData) return null;

    const formattedData = formatData(storageData.data);
    
    return (
      <Box sx={{ mt: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            '& .MuiTab-root': {
              color: '#888',
              '&.Mui-selected': { color: '#8b5cf6' }
            },
            '& .MuiTabs-indicator': {
              bgcolor: '#8b5cf6'
            }
          }}
        >
          <Tab label="Formatted View" />
          <Tab label="Raw Data" />
          <Tab label="Metadata" />
        </Tabs>

        <Box sx={{ mt: 2 }}>
          {activeTab === 0 && (
            <Box sx={{ 
              p: 2, 
              bgcolor: '#0f0f0f', 
              borderRadius: 1, 
              border: '1px solid #333',
              fontFamily: 'monospace',
              fontSize: '12px',
              maxHeight: '400px',
              overflow: 'auto'
            }}>
              {Array.isArray(formattedData) ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#8b5cf6', mb: 1 }}>
                    📊 Data Records ({formattedData.length} items)
                  </Typography>
                  {formattedData.map((item, index) => (
                    <Box key={index} sx={{ mb: 2, p: 1, bgcolor: '#1a1a1a', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 1 }}>
                        Record {index + 1}
                      </Typography>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    </Box>
                  ))}
                </Box>
              ) : (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(formattedData, null, 2)}
                </pre>
              )}
            </Box>
          )}

          {activeTab === 1 && (
            <Box sx={{ 
              p: 2, 
              bgcolor: '#0f0f0f', 
              borderRadius: 1, 
              border: '1px solid #333',
              fontFamily: 'monospace',
              fontSize: '12px',
              maxHeight: '400px',
              overflow: 'auto'
            }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {typeof storageData.data === 'string' ? storageData.data : JSON.stringify(storageData.data, null, 2)}
              </pre>
            </Box>
          )}

          {activeTab === 2 && (
            <Box sx={{ 
              p: 2, 
              bgcolor: '#0f0f0f', 
              borderRadius: 1, 
              border: '1px solid #333',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}>
              <Box sx={{ mb: 1 }}>
                <strong>Storage Type:</strong> {details.type}
              </Box>
              <Box sx={{ mb: 1 }}>
                <strong>Data Size:</strong> {storageData.metadata?.size || 'Unknown'}
              </Box>
              <Box sx={{ mb: 1 }}>
                <strong>Records:</strong> {storageData.metadata?.recordCount || 'Unknown'}
              </Box>
              <Box sx={{ mb: 1 }}>
                <strong>Last Updated:</strong> {storageData.metadata?.lastUpdated || 'Unknown'}
              </Box>
              <Box sx={{ mb: 1 }}>
                <strong>File Path:</strong> {connection?.file_path || 'Unknown'}
              </Box>
              {storageData.metadata?.schema && (
                <Box sx={{ mt: 2 }}>
                  <strong>Schema:</strong>
                  <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(storageData.metadata.schema, null, 2)}
                  </pre>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    );
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
          minHeight: '70vh'
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
          <ViewIcon sx={{ color: '#10b981' }} />
          <Typography variant="h6">
            View Storage Data: {connection?.file_name}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: '#888' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Connection Info */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 2, color: '#8b5cf6', fontWeight: 600 }}>
              📦 Storage Connection Details
            </Typography>
            <Box sx={{ 
              p: 2, 
              bgcolor: '#0f0f0f', 
              borderRadius: 1, 
              border: '1px solid #333'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                {isBlob ? (
                  <StorageIcon sx={{ color: '#8b5cf6' }} />
                ) : (
                  <DataObjectIcon sx={{ color: '#8b5cf6' }} />
                )}
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {connection?.file_name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#888' }}>
                    {details.description || details.type}
                  </Typography>
                </Box>
                <Chip 
                  label={details.type}
                  size="small"
                  sx={{ 
                    bgcolor: isBlob ? '#4c1d95' : '#059669',
                    color: 'white',
                    fontWeight: 500
                  }}
                />
              </Box>
              
              {isBlob ? (
                <Box>
                  <Typography variant="body2" sx={{ color: '#ccc', mb: 1 }}>
                    <strong>Data Size:</strong> {details.dataSize} characters
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ccc' }}>
                    <strong>Created:</strong> {details.created}
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" sx={{ color: '#ccc', mb: 1 }}>
                    <strong>Host:</strong> {details.host}:{details.port}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ccc' }}>
                    <strong>Database:</strong> {details.username}@{details.database}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Loading State */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#8b5cf6' }} />
            </Box>
          )}

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ bgcolor: '#2d1b1b', color: '#ff6b6b' }}>
              {error}
            </Alert>
          )}

          {/* Data Display */}
          {storageData && !loading && renderDataView()}
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

export default StorageDataViewer;
