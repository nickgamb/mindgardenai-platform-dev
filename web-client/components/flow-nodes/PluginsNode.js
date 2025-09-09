import React, { memo } from 'react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import ExtensionIcon from '@mui/icons-material/Extension';
import FunctionsIcon from '@mui/icons-material/Functions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CodeIcon from '@mui/icons-material/Code';
import { FlowConnectors } from '../FlowConnectorSystem';

const PluginsNode = ({ data, isConnectable }) => {
  // Display the selected plugin and function name or fallback to defaults
  const pluginName = data.config?.plugin_name || 'Plugin';
  const functionName = data.config?.function_name || 'Function';
  const pluginType = data.config?.plugin_type || 'SDK';
  const apiConnectionId = data.config?.api_connection_id;
  const executionStatus = data.executionStatus;
  
  // Get status icon
  const getStatusIcon = () => {
    if (!executionStatus) return null;
    
    switch (executionStatus.status) {
      case 'running':
        return <CircularProgress size={16} sx={{ color: '#8b5cf6' }} />;
      case 'success':
        return <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />;
      default:
        return null;
    }
  };

  // Get plugin type color
  const getPluginTypeColor = (type) => {
    const colors = {
      'oaa': '#8b5cf6',
      'sdk': '#6366f1',
      'api': '#3b82f6',
      'library': '#10b981',
      'custom': '#f59e0b'
    };
    return colors[type?.toLowerCase()] || '#8b5cf6';
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
        borderColor: '#8b5cf6',
      },
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          borderRadius: 2,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <ExtensionIcon sx={{ fontSize: 20, color: '#ffffff' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            fontSize: '0.875rem'
          }}>
            Plugin
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getStatusIcon()}
            <Typography variant="caption" sx={{ 
              color: executionStatus ? 
                (executionStatus.status === 'error' ? '#ef4444' : '#8b5cf6') : 
                '#888'
            }}>
              {executionStatus?.status || 'Ready'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Plugin Information */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CodeIcon sx={{ fontSize: 16, color: '#8b5cf6' }} />
          <Typography variant="body2" sx={{ 
            fontWeight: 500,
            color: '#ffffff'
          }}>
            {pluginName}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {pluginType && (
            <Chip 
              label={pluginType.toUpperCase()} 
              size="small" 
              sx={{ 
                bgcolor: getPluginTypeColor(pluginType),
                color: 'white',
                fontWeight: 500,
                fontSize: '0.7rem',
                height: '20px'
              }} 
            />
          )}
        </Box>

        {/* Function Name */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          p: 1,
          bgcolor: '#0f0f0f',
          borderRadius: 1,
          border: '1px solid #333'
        }}>
          <FunctionsIcon sx={{ fontSize: 14, color: '#888' }} />
          <Typography variant="caption" sx={{ 
            color: '#888',
            fontFamily: 'monospace',
            fontSize: '0.75rem'
          }}>
            {functionName !== 'Function' ? functionName : 'No function selected'}
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
          bgcolor: (pluginName !== 'Plugin' && functionName !== 'Function' && apiConnectionId) ? '#22c55e' : '#6b7280'
        }} />
        <Typography variant="caption" sx={{ color: '#888' }}>
          {(pluginName !== 'Plugin' && functionName !== 'Function' && apiConnectionId) 
            ? 'Plugin Ready' 
            : apiConnectionId 
              ? 'Function needed'
              : pluginName !== 'Plugin' 
                ? 'Connection needed' 
                : 'Configuration needed'}
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
        nodeType="plugins" 
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
        <PlayArrowIcon sx={{ fontSize: 16, color: '#8b5cf6' }} />
      </Box>
    </Box>
  );
};

export default memo(PluginsNode);
