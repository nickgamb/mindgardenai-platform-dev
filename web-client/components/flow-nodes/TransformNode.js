import React, { memo } from 'react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import TransformIcon from '@mui/icons-material/Transform';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CodeIcon from '@mui/icons-material/Code';
import { FlowConnectors } from '../FlowConnectorSystem';

const TransformNode = ({ data, isConnectable }) => {
  // Display the selected transform name or fallback to label
  const transformName = data.config?.transform_name || 'Transform';
  const transformType = data.config?.transform_type || 'ETL';
  const executionStatus = data.executionStatus;
  
  // Get status icon
  const getStatusIcon = () => {
    if (!executionStatus) return null;
    
    switch (executionStatus.status) {
      case 'running':
        return <CircularProgress size={16} sx={{ color: '#f59e0b' }} />;
      case 'success':
        return <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />;
      default:
        return null;
    }
  };

  // Get transform type color
  const getTransformTypeColor = (type) => {
    const colors = {
      'etl': '#f59e0b',
      'filter': '#8b5cf6',
      'map': '#10b981',
      'aggregate': '#ef4444',
      'validate': '#3b82f6',
      'clean': '#06b6d4'
    };
    return colors[type?.toLowerCase()] || '#f59e0b';
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
        borderColor: '#f59e0b',
      },
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: 2,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <TransformIcon sx={{ fontSize: 20, color: '#ffffff' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            fontSize: '0.875rem'
          }}>
            Data Transform
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getStatusIcon()}
            <Typography variant="caption" sx={{ 
              color: executionStatus ? 
                (executionStatus.status === 'error' ? '#ef4444' : '#f59e0b') : 
                '#888'
            }}>
              {executionStatus?.status || 'Ready'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Transform Information */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CodeIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
          <Typography variant="body2" sx={{ 
            fontWeight: 500,
            color: '#ffffff'
          }}>
            {transformName}
          </Typography>
        </Box>
        
        {transformType && (
          <Chip 
            label={transformType.toUpperCase()} 
            size="small" 
            sx={{ 
              bgcolor: getTransformTypeColor(transformType),
              color: 'white',
              fontWeight: 500,
              fontSize: '0.7rem',
              height: '20px'
            }} 
          />
        )}
      </Box>

      {/* Transform Details */}
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
        <FilterListIcon sx={{ fontSize: 14, color: '#888' }} />
        <Typography variant="caption" sx={{ color: '#888' }}>
          {transformName !== 'Transform' ? 'Transform Ready' : 'No transform selected'}
        </Typography>
      </Box>

      {/* Processing Status */}
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
          bgcolor: transformName !== 'Transform' ? '#22c55e' : '#6b7280'
        }} />
        <Typography variant="caption" sx={{ color: '#888' }}>
          {transformName !== 'Transform' ? 'Ready to Process' : 'Awaiting Configuration'}
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
        nodeType="transform" 
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
        <PlayArrowIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
      </Box>
    </Box>
  );
};

export default memo(TransformNode);