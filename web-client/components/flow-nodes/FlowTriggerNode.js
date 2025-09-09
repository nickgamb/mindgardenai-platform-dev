import React, { memo } from 'react';
import { FlowConnectors } from '../FlowConnectorSystem';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const FlowTriggerNode = ({ data, isConnectable }) => {
  // Display the trigger name or fallback to label
  const triggerName = data.config?.trigger_name || 'Flow Trigger';
  const triggerType = data.config?.trigger_type || 'flow_start';
  const executionStatus = data.executionStatus;
  
  // Get status icon
  const getStatusIcon = () => {
    if (!executionStatus) return null;
    
    switch (executionStatus.status) {
      case 'running':
        return <CircularProgress size={16} sx={{ color: '#16a34a' }} />;
      case 'success':
        return <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />;
      default:
        return null;
    }
  };
  
  // Get trigger type display name
  const getTriggerTypeName = () => {
    switch (triggerType) {
      case 'flow_start':
        return 'Flow Start';
      case 'schedule':
        return 'Schedule';
      case 'webhook':
        return 'Webhook';
      case 'manual':
        return 'Manual';
      default:
        return 'Flow Start';
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
        borderColor: '#16a34a',
      },
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          borderRadius: 2,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <PlayArrowIcon sx={{ fontSize: 20, color: 'white' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            fontSize: '0.875rem',
            lineHeight: 1.2,
          }}>
            {triggerName}
          </Typography>
          <Typography variant="caption" sx={{ 
            color: '#888888',
            fontSize: '0.75rem',
          }}>
            Flow Trigger
          </Typography>
        </Box>
        {getStatusIcon()}
      </Box>
      
      {/* Trigger Type Badge */}
      <Chip 
        label={getTriggerTypeName()}
        size="small"
        sx={{ 
          bgcolor: '#581c87',
          color: '#c4b5fd',
          border: '1px solid #16a34a',
          fontSize: '0.7rem',
          height: 24,
          fontWeight: 500,
        }}
      />
      
      {/* Node Connectors */}
      <FlowConnectors 
        nodeType="flow_trigger" 
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

export default memo(FlowTriggerNode); 