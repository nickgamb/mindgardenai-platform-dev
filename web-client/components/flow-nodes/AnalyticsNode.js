import React, { memo } from 'react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { FlowConnectors } from '../FlowConnectorSystem';

const AnalyticsNode = ({ data, isConnectable }) => {
  // Display the selected analytics name or fallback to label
  const analyticsName = data.config?.analytics_name || 'Analytics';
  const executionStatus = data.executionStatus;
  const analysisType = data.config?.analysis_type;
  
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
          <AnalyticsIcon sx={{ fontSize: 20, color: 'white' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            fontSize: '0.875rem',
            lineHeight: 1.2,
          }}>
            {analyticsName}
          </Typography>
          <Typography variant="caption" sx={{ 
            color: '#888888',
            fontSize: '0.75rem',
          }}>
            Data Analysis
          </Typography>
        </Box>
        {getStatusIcon()}
      </Box>
      
      {/* Analysis Type Badge */}
      {analysisType && (
        <Chip 
          label={analysisType}
          size="small"
          sx={{ 
            bgcolor: '#581c87',
            color: '#c4b5fd',
            border: '1px solid #8b5cf6',
            fontSize: '0.7rem',
            height: 24,
            fontWeight: 500,
          }}
        />
      )}
      
      {/* Node Connectors */}
      <FlowConnectors 
        nodeType="analytics" 
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
        <PlayArrowIcon sx={{ fontSize: 16, color: '#f97316' }} />
      </Box>

    </Box>
  );
};

export default memo(AnalyticsNode); 