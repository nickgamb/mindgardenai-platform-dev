import React, { memo } from 'react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { FlowConnectors } from '../FlowConnectorSystem';

const StorageNode = ({ data, isConnectable }) => {
  // Display the selected storage name or fallback to label
  const storageName = data.config?.storage_name || 'Storage';
  const storageType = data.config?.storage_type;
  const executionStatus = data.executionStatus;
  
  // Get status icon
  const getStatusIcon = () => {
    if (!executionStatus) return null;
    
    switch (executionStatus.status) {
      case 'running':
        return <CircularProgress size={16} sx={{ color: '#3b82f6' }} />;
      case 'success':
        return <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />;
      default:
        return null;
    }
  };
  
  return (
    <Box sx={{
      background: '#1a1a1a',
      border: '1px solid #333333',
      borderRadius: 3,
      p: 2.5,
      minWidth: 220,
      color: '#ffffff',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
      position: 'relative',
      '&:hover': {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        borderColor: '#3b82f6',
      },
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: 2,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <StorageIcon sx={{ fontSize: 20, color: 'white' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            fontSize: '0.875rem',
            lineHeight: 1.2,
          }}>
            {storageName}
          </Typography>
          <Typography variant="caption" sx={{ 
            color: '#888888',
            fontSize: '0.75rem',
          }}>
            Data Storage
          </Typography>
        </Box>
        {getStatusIcon()}
      </Box>
      
      {/* Storage Type Badge */}
      {storageType && (
        <Chip 
          label={storageType === 'blob_storage' ? 'Blob Storage' : 
                storageType === 'postgresql' ? 'PostgreSQL' :
                storageType === 'mysql' ? 'MySQL' :
                storageType === 'mongodb' ? 'MongoDB' :
                'External DB'}
          size="small"
          sx={{ 
            bgcolor: '#1e3a8a',
            color: '#93c5fd',
            border: '1px solid #3b82f6',
            fontSize: '0.7rem',
            height: 24,
            fontWeight: 500,
          }}
        />
      )}
      
      {/* Node Connectors */}
      <FlowConnectors 
        nodeType="storage" 
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
        <PlayArrowIcon sx={{ fontSize: 16, color: '#3b82f6' }} />
      </Box>

    </Box>
  );
};

export default memo(StorageNode); 