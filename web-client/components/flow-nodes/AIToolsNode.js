import React, { memo } from 'react';
import { FlowConnectors } from '../FlowConnectorSystem';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';

const AIToolsNode = ({ data, isConnectable }) => {
  // Display the AI tool name or fallback to label
  const toolName = data.config?.tool_name || 'AI Tools';
  const toolType = data.config?.tool_type || 'completion';
  const modelChoice = data.config?.model_choice || 'gpt-4';
  const customPrompt = data.config?.custom_prompt;
  const executionStatus = data.executionStatus;
  
  // Get status icon
  const getStatusIcon = () => {
    if (!executionStatus) return null;
    
    switch (executionStatus.status) {
      case 'running':
        return <CircularProgress size={16} sx={{ color: '#06b6d4' }} />;
      case 'success':
        return <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />;
      default:
        return null;
    }
  };
  
  // Get tool type display name and description
  const getToolTypeInfo = () => {
    switch (toolType) {
      case 'completion':
        return { name: 'Custom Completion', desc: 'Custom prompt completion' };
      case 'analysis':
        return { name: 'AI Analysis', desc: 'Data analysis & insights' };
      case 'classification':
        return { name: 'Classification', desc: 'Data classification & labeling' };
      case 'summarization':
        return { name: 'Summarization', desc: 'Text & data summarization' };
      case 'translation':
        return { name: 'Translation', desc: 'Language translation' };
      case 'code_generation':
        return { name: 'Code Generation', desc: 'Generate code & scripts' };
      case 'data_extraction':
        return { name: 'Data Extraction', desc: 'Extract structured data' };
      case 'sentiment_analysis':
        return { name: 'Sentiment Analysis', desc: 'Analyze sentiment & emotions' };
      case 'pattern_recognition':
        return { name: 'Pattern Recognition', desc: 'Find patterns in data' };
      case 'recommendation':
        return { name: 'Recommendation', desc: 'Generate recommendations' };
      default:
        return { name: 'Custom Completion', desc: 'Custom prompt completion' };
    }
  };
  
  const toolInfo = getToolTypeInfo();
  
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
        borderColor: '#06b6d4',
      },
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          borderRadius: 2,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <SmartToyIcon sx={{ fontSize: 20, color: 'white' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ 
            fontWeight: 600, 
            color: '#ffffff',
            fontSize: '0.875rem',
            lineHeight: 1.2,
          }}>
            {toolName}
          </Typography>
          <Typography variant="caption" sx={{ 
            color: '#888888',
            fontSize: '0.75rem',
          }}>
            {toolInfo.desc}
          </Typography>
        </Box>
        {getStatusIcon()}
      </Box>
      
      {/* Badges Container */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
        {/* Tool Type Badge */}
        <Chip 
          label={toolInfo.name}
          size="small"
          sx={{ 
            bgcolor: '#0e7490',
            color: '#67e8f9',
            border: '1px solid #06b6d4',
            fontSize: '0.7rem',
            height: 24,
            fontWeight: 500,
          }}
        />
        
        {/* Model Choice Badge */}
        <Chip 
          label={modelChoice}
          size="small"
          sx={{ 
            bgcolor: '#164e63',
            color: '#a5f3fc',
            border: '1px solid #0891b2',
            fontSize: '0.7rem',
            height: 24,
            fontWeight: 500,
          }}
        />
        
        {/* Custom Prompt Badge (for completion tasks) */}
        {toolType === 'completion' && (
          <Chip 
            label="Custom Prompt"
            size="small"
            sx={{ 
              bgcolor: '#7c2d12',
              color: '#fbbf24',
              border: '1px solid #ea580c',
              fontSize: '0.7rem',
              height: 24,
              fontWeight: 500,
            }}
          />
        )}
      </Box>
      
      {/* Node Connectors */}
      <FlowConnectors 
        nodeType="ai_tools" 
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
        <PlayArrowIcon sx={{ fontSize: 16, color: '#06b6d4' }} />
      </Box>
    </Box>
  );
};

export default memo(AIToolsNode); 