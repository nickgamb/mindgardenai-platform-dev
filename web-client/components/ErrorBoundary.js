import React from 'react';
import { Box, Typography, Button, Alert, AlertTitle } from '@mui/material';
import { Refresh, Warning } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children } = this.props;

    if (hasError) {
      // Show error content within the existing layout structure
      return <ErrorContent 
        error={error} 
        onRetry={this.handleRetry}
        retryCount={retryCount}
      />;
    }

    return children;
  }
}

const ErrorContent = ({ error, onRetry, retryCount }) => {
  const theme = useTheme();
  const maxRetries = 3;

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: '100%'
    }}>
      {/* Error Banner at the top */}
      <Box sx={{ 
        backgroundColor: theme.palette.error.dark,
        color: theme.palette.error.contrastText,
        p: 2,
        borderBottom: `1px solid ${theme.palette.error.main}`
      }}>
        <Alert 
          severity="error" 
          sx={{ 
            backgroundColor: 'transparent',
            color: 'inherit',
            '& .MuiAlert-icon': {
              color: 'inherit'
            },
            '& .MuiAlert-message': {
              color: 'inherit'
            }
          }}
          action={
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {retryCount < maxRetries && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={onRetry}
                  sx={{ 
                    color: 'inherit',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  Try Again
                </Button>
              )}
            </Box>
          }
        >
          <AlertTitle sx={{ color: 'inherit', fontWeight: 600 }}>
            Application Error
          </AlertTitle>
          <Typography variant="body2" sx={{ color: 'inherit', opacity: 0.9 }}>
            {retryCount < maxRetries 
              ? "Something went wrong. You can try again or refresh the page."
              : "Multiple errors occurred. Please refresh the page or contact support."
            }
          </Typography>
        </Alert>
      </Box>

      {/* Main content area - show a simple message */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4
      }}>
        <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
          <Warning sx={{ 
            fontSize: 64, 
            color: theme.palette.warning.main,
            mb: 2 
          }} />
          
          <Typography variant="h5" sx={{ 
            mb: 2, 
            fontWeight: 600,
            color: theme.palette.text.primary
          }}>
            Application Temporarily Unavailable
          </Typography>
          
          <Typography variant="body1" sx={{ 
            mb: 3, 
            color: theme.palette.text.secondary,
            lineHeight: 1.6
          }}>
            We're experiencing technical difficulties. The error has been logged and our team is working to resolve it.
          </Typography>

          <Button
            variant="contained"
            color="primary"
            onClick={() => window.location.reload()}
            sx={{ 
              minWidth: 140,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Refresh Page
          </Button>

          {process.env.NODE_ENV === 'development' && error && (
            <Box sx={{ mt: 4, textAlign: 'left' }}>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.text.primary }}>
                Error Details (Development Only):
              </Typography>
              <Box sx={{ 
                p: 2, 
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                maxHeight: 200,
                overflow: 'auto'
              }}>
                <Typography variant="body2" component="pre" sx={{ 
                  fontSize: '0.75rem',
                  color: theme.palette.text.secondary,
                  margin: 0
                }}>
                  {error.toString()}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ErrorBoundary; 