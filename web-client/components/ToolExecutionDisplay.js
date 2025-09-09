import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Collapse,
  IconButton,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

const ToolExecutionDisplay = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);
  
  const { id, name, arguments: args, result, status = 'pending' } = toolCall;
  
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'error':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'pending':
      default:
        return <HourglassEmptyIcon color="primary" fontSize="small" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'pending':
      default:
        return 'primary';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'success':
        return 'Completed';
      case 'error':
        return 'Failed';
      case 'pending':
      default:
        return 'Executing...';
    }
  };

  const formatArguments = (args) => {
    if (!args) return 'No parameters';
    if (typeof args === 'string') {
      try {
        return JSON.stringify(JSON.parse(args), null, 2);
      } catch {
        return args;
      }
    }
    return JSON.stringify(args, null, 2);
  };

  const formatResult = (result) => {
    if (!result) return 'No result';
    if (typeof result === 'string') {
      try {
        return JSON.stringify(JSON.parse(result), null, 2);
      } catch {
        return result;
      }
    }
    return JSON.stringify(result, null, 2);
  };

  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getStatusIcon()}
          <Typography variant="subtitle1" color="primary">
            Tool: {name}
          </Typography>
          <Chip 
            label={getStatusText()} 
            color={getStatusColor()} 
            size="small" 
            variant="outlined"
          />
        </Box>
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse tool details" : "Expand tool details"}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Parameters:
          </Typography>
          <Paper 
            sx={{ 
              p: 2, 
              bgcolor: 'grey.50', 
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto'
            }}
          >
            {formatArguments(args)}
          </Paper>

          {status === 'pending' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Tool is executing...
              </Typography>
            </Box>
          )}

          {status === 'error' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2">
                {typeof result === 'string' ? result : 'Tool execution failed'}
              </Typography>
            </Alert>
          )}

          {status === 'success' && result && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Result:
              </Typography>
              <Paper 
                sx={{ 
                  p: 2, 
                  bgcolor: 'success.light', 
                  color: 'success.contrastText',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  overflowX: 'auto'
                }}
              >
                {formatResult(result)}
              </Paper>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ToolExecutionDisplay; 