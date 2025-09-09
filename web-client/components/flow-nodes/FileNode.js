import React, { memo } from 'react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { FlowConnectors } from '../FlowConnectorSystem';

const FileNode = ({ data, isConnectable }) => {
  // Display the selected file name or fallback to label
  const fileName = data.config?.file_name || 'File';
  const fileType = data.config?.file_type || 'CSV';
  const executionStatus = data.executionStatus;
  
  // Get status icon
  const getStatusIcon = () => {
    if (!executionStatus) return null;
    
    switch (executionStatus.status) {
      case 'running':
        return <CircularProgress size={16} sx={{ color: '#10b981' }} />;
      case 'success':
        return <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />;
      default:
        return null;
    }
  };

  // Get file type color
  const getFileTypeColor = (type) => {
    const colors = {
      'csv': '#4caf50',
      'json': '#ff9800',
      'txt': '#2196f3',
      'xlsx': '#10b981'
    };
    return colors[type?.toLowerCase()] || '#666';
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
        borderColor: '#10b981',
      },
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderRadius: 2,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <FolderIcon sx={{ fontSize: 20, color: '#ffffff' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            fontSize: '0.875rem'
          }}>
            File Source
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getStatusIcon()}
            <Typography variant="caption" sx={{ 
              color: executionStatus ? 
                (executionStatus.status === 'error' ? '#ef4444' : '#10b981') : 
                '#888'
            }}>
              {executionStatus?.status || 'Ready'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* File Information */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <InsertDriveFileIcon sx={{ fontSize: 16, color: '#10b981' }} />
          <Typography variant="body2" sx={{ 
            fontWeight: 500,
            color: '#ffffff'
          }}>
            {fileName}
          </Typography>
        </Box>
        
        {fileType && (
          <Chip 
            label={fileType.toUpperCase()} 
            size="small" 
            sx={{ 
              bgcolor: getFileTypeColor(fileType),
              color: 'white',
              fontWeight: 500,
              fontSize: '0.7rem',
              height: '20px'
            }} 
          />
        )}
      </Box>

      {/* Connection Status */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        p: 1,
        bgcolor: '#0f0f0f',
        borderRadius: 1,
        border: '1px solid #333'
      }}>
        <Box sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: fileName !== 'File' ? '#22c55e' : '#6b7280'
        }} />
        <Typography variant="caption" sx={{ color: '#888' }}>
          {fileName !== 'File' ? 'File Ready' : 'No file selected'}
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
        nodeType="file" 
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
        <PlayArrowIcon sx={{ fontSize: 16, color: '#10b981' }} />
      </Box>
    </Box>
  );
};

export default memo(FileNode);