import React from 'react';
import { Snackbar, Alert, AlertTitle, Box, Typography, Button } from '@mui/material';
import { Close, Refresh } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const GlobalErrorHandler = ({ error, onClearError, onRetry }) => {
  const theme = useTheme();

  if (!error) return null;

  const handleClose = () => {
    onClearError();
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    onClearError();
  };

  // Determine error severity
  const getErrorSeverity = (error) => {
    if (error.includes('Network Error') || error.includes('timeout')) {
      return 'warning';
    }
    if (error.includes('401') || error.includes('403')) {
      return 'error';
    }
    return 'info';
  };

  const severity = getErrorSeverity(error);

  return (
    <Snackbar
      open={!!error}
      autoHideDuration={severity === 'error' ? null : 6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ zIndex: 9999 }}
    >
      <Alert
        severity={severity}
        onClose={handleClose}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {onRetry && (
              <Button
                size="small"
                startIcon={<Refresh />}
                onClick={handleRetry}
                sx={{ color: 'inherit', textTransform: 'none' }}
              >
                Retry
              </Button>
            )}
            <Button
              size="small"
              startIcon={<Close />}
              onClick={handleClose}
              sx={{ color: 'inherit', textTransform: 'none' }}
            >
              Dismiss
            </Button>
          </Box>
        }
        sx={{
          width: '100%',
          maxWidth: 600,
          '& .MuiAlert-message': {
            width: '100%'
          }
        }}
      >
        <AlertTitle>
          {severity === 'error' && 'Error'}
          {severity === 'warning' && 'Connection Issue'}
          {severity === 'info' && 'Information'}
        </AlertTitle>
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          {error}
        </Typography>
      </Alert>
    </Snackbar>
  );
};

export default GlobalErrorHandler; 