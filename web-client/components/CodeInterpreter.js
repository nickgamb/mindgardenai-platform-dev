import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  Collapse,
  Divider
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import api from '../lib/api';

const CodeInterpreter = ({ code, language = 'python', output = null, onExecute = null, disabled = false }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState(output);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const handleExecute = async () => {
    if (!code || isExecuting) return;

    setIsExecuting(true);
    setError(null);
    setExecutionOutput(null);

    try {
      const result = await api.executeCode(code);
      setExecutionOutput(result);
      if (onExecute) {
        onExecute(result);
      }
    } catch (err) {
      setError(err.message || 'Code execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
  };

  const renderOutput = (output) => {
    if (!output) return null;

    const { stdout, stderr, result } = output;

    return (
      <Box sx={{ mt: 2 }}>
        {stdout && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Output:
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'background.paper', fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
              {stdout}
            </Paper>
          </Box>
        )}

        {stderr && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="error" gutterBottom>
              Error:
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText', fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
              {stderr}
            </Paper>
          </Box>
        )}

        {result && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="secondary" gutterBottom>
              Result:
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'background.paper', fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
              {result}
            </Paper>
          </Box>
        )}
      </Box>
    );
  };

  const renderImageOutput = (output) => {
    if (!output) return null;

    const { stdout, result } = output;
    const text = stdout || result || '';
    
    // Look for image URLs in the output
    const imageMatches = text.match(/!\[.*?\]\((.*?)\)/g);
    if (!imageMatches) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Generated Images:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {imageMatches.map((match, index) => {
            const urlMatch = match.match(/!\[.*?\]\((.*?)\)/);
            const imageUrl = urlMatch ? urlMatch[1] : '';
            
            if (!imageUrl) return null;

            return (
              <Paper key={index} sx={{ p: 1, maxWidth: 300 }}>
                <img 
                  src={imageUrl} 
                  alt={`Generated image ${index + 1}`}
                  style={{ 
                    width: '100%', 
                    height: 'auto',
                    borderRadius: 4
                  }}
                />
              </Paper>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" color="primary">
            Code Interpreter ({language})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton 
              size="small" 
              onClick={handleCopyCode}
              title="Copy code"
            >
              <ContentCopyIcon />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={() => setExpanded(!expanded)}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={expanded || !executionOutput}>
          <Paper 
            sx={{ 
              p: 2, 
              bgcolor: 'grey.900', 
              color: 'grey.100',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              mb: 2
            }}
          >
            {code}
          </Paper>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={isExecuting ? <CircularProgress size={16} /> : <PlayArrowIcon />}
            onClick={handleExecute}
            disabled={disabled || isExecuting || !code}
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {executionOutput && (
          <>
            {renderOutput(executionOutput)}
            {renderImageOutput(executionOutput)}
          </>
        )}
      </Paper>
    </Box>
  );
};

export default CodeInterpreter; 