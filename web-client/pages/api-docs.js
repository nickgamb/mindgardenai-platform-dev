import { useState, useEffect, useContext } from 'react';
import dynamic from 'next/dynamic';
import { Box, Typography, Container, useMediaQuery, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import apiClient from '../lib/api';
import createSwaggerTheme from '../styles/swaggerTheme';
import PermissionsDisplay from '../components/PermissionsDisplay';
import Cookies from 'js-cookie';
import { AppContext } from '../contexts/AppContext';
import LoginButton from '../components/LoginButton';
const SwaggerUI = dynamic(import('swagger-ui-react'), { ssr: false });
import "swagger-ui-react/swagger-ui.css"

export default function ApiDocs() {
  const [spec, setSpec] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated, isAuthorized, setIsAuthorized, isLoading } = useContext(AppContext);

  useEffect(() => {
    const fetchOpenApiSpec = async () => {
      try {
        const openApiJson = await apiClient.getOpenApiJson();
        setSpec(openApiJson);
        setPermissions(openApiJson['x-permissions'] || null);
        setIsAuthorized(true);
      } catch (error) {
        console.error('Error fetching OpenAPI spec:', error);
        if (error.response && error.response.status === 401) {
          setIsAuthorized(false);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOpenApiSpec();
  }, [setIsAuthorized]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = createSwaggerTheme(theme, isMobile);
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [theme, isMobile]);

  const requestInterceptor = (req) => {
    req.withCredentials = true;
    const token = Cookies.get('access_token'); 
    if (token) {
      req.headers['Authorization'] = `Bearer ${token}`;
    }
    return req;
  };

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
        <CircularProgress color="primary" />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading...</Typography>
      </Container>
    );
  }

  if (!isAuthenticated || !isAuthorized) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
        <Typography variant="h4" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1" gutterBottom>
          {!isAuthenticated
            ? "You need to be logged in to view this page."
            : "You don't have permission to access the API Docs page."}
        </Typography>
        {!isAuthenticated && (
          <LoginButton />
        )}
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{
      minHeight: '100vh', 
      py: isMobile ? 2 : 3,
      px: isMobile ? 1 : 3
    }}>
      <Typography 
        variant={isMobile ? "h5" : "h4"} 
        component="h1" 
        gutterBottom
        color="primary"
      >
        API Documentation
      </Typography>
      
      <Box sx={{ overflow: 'hidden' }}>
        {loading ? (
          <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
            <CircularProgress color="primary" />
            <Typography variant="h6" sx={{ mt: 2 }}>Loading...</Typography>
          </Container>
        ) : spec ? (
          <>
            <SwaggerUI
              spec={spec}
              docExpansion="list"
              defaultModelsExpandDepth={-1}
              requestInterceptor={requestInterceptor}
            />
            {permissions && permissions.length > 0 && (
              <Box sx={{ mt: 4, mb: 2 }}>
                <Typography variant="h6" gutterBottom color="primary">API Permissions</Typography>
                <PermissionsDisplay permissions={permissions} />
              </Box>
            )}
          </>
        ) : (
          <Typography sx={{ p: 2 }}>Failed to load API documentation. Please try again later.</Typography>
        )}
      </Box>
    </Container>
  );
}
