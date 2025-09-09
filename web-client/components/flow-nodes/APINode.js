import React, { memo } from 'react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import ApiIcon from '@mui/icons-material/Api';
import HttpIcon from '@mui/icons-material/Http';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SecurityIcon from '@mui/icons-material/Security';
import { FlowConnectors } from '../FlowConnectorSystem';

const APINode = ({ data, isConnectable }) => {
  // Display the selected API connection name or fallback to label
  const apiName = data.config?.api_name || 'API';
  const apiType = data.config?.api_type || 'REST';
  const method = data.config?.method || 'GET';
  const endpoint = data.config?.endpoint || '/api/endpoint';
  const executionStatus = data.executionStatus;
  
  // Get status icon
  const getStatusIcon = () => {
    if (!executionStatus) return null;
    
    switch (executionStatus.status) {
      case 'running':
        return <CircularProgress size={16} sx={{ color: '#ef4444' }} />;
      case 'success':
        return <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />;
      default:
        return null;
    }
  };

  // Get method color
  const getMethodColor = (method) => {
    const colors = {
      'GET': '#4caf50',
      'POST': '#2196f3',
      'PUT': '#ff9800',
      'DELETE': '#f44336',
      'PATCH': '#9c27b0'
    };
    return colors[method?.toUpperCase()] || '#666';
  };

  // Get API type color
  const getAPITypeColor = (type) => {
    const colors = {
      'veza': '#8b5cf6',
      'rest': '#6b7280',
      'graphql': '#e91e63',
      'custom': '#795548'
    };
    return colors[type?.toLowerCase()] || '#666';
  };
  
  return (
    <Box sx={{
      background: '#1a1a1a',
      border: '1px solid #333333',
      borderRadius: 3,
      p: 2.5,
      minWidth: 250,
      color: '#ffffff',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
      position: 'relative',
      '&:hover': {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        borderColor: '#ef4444',
      },
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          borderRadius: 2,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <ApiIcon sx={{ fontSize: 20, color: '#ffffff' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            fontSize: '0.875rem'
          }}>
            API Call
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getStatusIcon()}
            <Typography variant="caption" sx={{ 
              color: executionStatus ? 
                (executionStatus.status === 'error' ? '#ef4444' : '#ef4444') : 
                '#888'
            }}>
              {executionStatus?.status || 'Ready'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* API Information */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <SecurityIcon sx={{ fontSize: 16, color: '#ef4444' }} />
          <Typography variant="body2" sx={{ 
            fontWeight: 500,
            color: '#ffffff'
          }}>
            {apiName}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {apiType && (
            <Chip 
              label={apiType.toUpperCase()} 
              size="small" 
              sx={{ 
                bgcolor: getAPITypeColor(apiType),
                color: 'white',
                fontWeight: 500,
                fontSize: '0.7rem',
                height: '20px'
              }} 
            />
          )}
          {method && (
            <Chip 
              label={method.toUpperCase()} 
              size="small" 
              sx={{ 
                bgcolor: getMethodColor(method),
                color: 'white',
                fontWeight: 500,
                fontSize: '0.7rem',
                height: '20px'
              }} 
            />
          )}
        </Box>

        {/* Endpoint */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          p: 1,
          bgcolor: '#0f0f0f',
          borderRadius: 1,
          border: '1px solid #333'
        }}>
          <HttpIcon sx={{ fontSize: 14, color: '#888' }} />
          <Typography variant="caption" sx={{ 
            color: '#888',
            fontFamily: 'monospace',
            fontSize: '0.75rem'
          }}>
            {endpoint}
          </Typography>
        </Box>
      </Box>

      {/* Connection Status */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        p: 1,
        bgcolor: '#0f0f0f',
        borderRadius: 1,
        border: '1px solid #333',
        mb: 1
      }}>
        <Box sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: apiName !== 'API' ? '#22c55e' : '#6b7280'
        }} />
        <Typography variant="caption" sx={{ color: '#888' }}>
          {apiName !== 'API' ? 'Connection Ready' : 'No API selected'}
        </Typography>
      </Box>

      {/* Execution Status Message */}
      {executionStatus?.message && (
        <Box sx={{ 
          mt: 1,
          p: 1,
          bgcolor: executionStatus.status === 'error' ? '#2d1b1b' : '#1b2d1b',
          borderRadius: 1,
          border: `1px solid ${executionStatus.status === 'error' ? '#ef4444' : '#10b981'}`
        }}>
          <Typography variant="caption" sx={{ 
            color: executionStatus.status === 'error' ? '#ff6b6b' : '#4ade80'
          }}>
            {executionStatus.message}
          </Typography>
        </Box>
      )}

      {/* Node Connectors */}
      <FlowConnectors 
        nodeType="api" 
        isConnectable={isConnectable}
        showTooltips={true}
        showLabels={true}
      />

      {/* Hover indicator */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          opacity: 0,
          transition: 'opacity 0.2s',
          '.react-flow__node:hover &': {
            opacity: 1,
          },
        }}
      >
        <PlayArrowIcon sx={{ fontSize: 16, color: '#ef4444' }} />
      </Box>
    </Box>
  );
};

export default memo(APINode);