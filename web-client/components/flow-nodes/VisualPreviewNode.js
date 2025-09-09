import React, { memo } from 'react';
import { FlowConnectors } from '../FlowConnectorSystem';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const VisualPreviewNode = ({ data, isConnectable }) => {
  // Display the preview name or fallback to label
  const previewName = data.config?.preview_name || 'Visual Preview';
  const previewType = data.config?.preview_type || 'plot';
  const executionStatus = data.executionStatus;
  
  // Get status icon
  const getStatusIcon = () => {
    if (!executionStatus) return null;
    
    switch (executionStatus.status) {
      case 'running':
        return <CircularProgress size={16} sx={{ color: '#d946ef' }} />;
      case 'success':
        return <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />;
      default:
        return null;
    }
  };
  
  // Get preview type display name
  const getPreviewTypeName = () => {
    switch (previewType) {
      case 'plot':
        return 'Plot';
      case 'chart':
        return 'Chart';
      case 'image':
        return 'Image';
      case 'dashboard':
        return 'Dashboard';
      case 'heatmap':
        return 'Heatmap';
      case 'waveform':
        return 'Waveform';
      default:
        return 'Visual';
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
        borderColor: '#d946ef',
      },
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #d946ef 0%, #c026d3 100%)',
          borderRadius: 2,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <VisibilityIcon sx={{ fontSize: 20, color: 'white' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            fontSize: '0.875rem',
            lineHeight: 1.2,
          }}>
            {previewName}
          </Typography>
          <Typography variant="caption" sx={{ 
            color: '#888888',
            fontSize: '0.75rem',
          }}>
            Visual Preview
          </Typography>
        </Box>
        {getStatusIcon()}
      </Box>
      
      {/* Preview Type Badge */}
      <Chip 
        label={getPreviewTypeName()}
        size="small"
        sx={{ 
          bgcolor: '#0e7490',
          color: '#67e8f9',
          border: '1px solid #d946ef',
          fontSize: '0.7rem',
          height: 24,
          fontWeight: 500,
        }}
      />
      
      {/* Preview Box */}
      <Box sx={{ 
        mt: 2, 
        mb: 2,
        minHeight: 80,
        border: '2px dashed #444',
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#1a1a1a',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {data.previewData ? (
          <Box sx={{ textAlign: 'center', width: '100%' }}>
            {previewType === 'image' || previewType === 'gif' ? (
              <img 
                src={data.previewData} 
                alt="Visual Preview" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '60px',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#888',
                fontSize: '0.75rem'
              }}>
                <VisibilityIcon sx={{ fontSize: 20, mr: 1 }} />
                {getPreviewTypeName()} Preview
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', color: '#888' }}>
            <VisibilityIcon sx={{ fontSize: 20, mb: 0.5 }} />
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem' }}>
              {getPreviewTypeName()} Preview
            </Typography>
            <Typography variant="caption" sx={{ color: '#666', fontSize: '0.6rem' }}>
              Visual will render here
            </Typography>
          </Box>
        )}
      </Box>
      
      {/* Node Connectors */}
      <FlowConnectors 
        nodeType="visual_preview" 
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

export default memo(VisualPreviewNode); 