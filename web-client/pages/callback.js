import { useState, useEffect, useContext, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { CircularProgress, Typography, Box } from '@mui/material';
import Cookies from 'js-cookie';
import { AppContext } from '../contexts/AppContext';

const Callback = () => {
  const router = useRouter();
  const { checkAuthStatus, setIsAuthenticated } = useContext(AppContext);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState(null);
  const processingRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent duplicate processing
      if (processingRef.current) {
        console.log('Callback already being processed, skipping');
        return;
      }

      const { code } = router.query;
      const isLoggedOut = sessionStorage.getItem('isLoggedOut') || localStorage.getItem('isLoggedOut');

      console.log('Callback handling:', { code: !!code, isLoggedOut, processing: processingRef.current });

      if (code && !isLoggedOut) {
        try {
          processingRef.current = true;
          setIsProcessing(true);
          
          console.log('Making callback request to backend...');
          const response = await axios.get(`${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/callback`, {
            params: { code }
          });

          if (response.data.access_token) {
            console.log('Received access token, storing in cookies');
            
            // Configure cookie options based on environment
            const isLocalhost = window.location.hostname === 'localhost';
            const cookieOptions = {
              expires: 7,
              secure: !isLocalhost, // Only secure in production
              sameSite: isLocalhost ? 'Lax' : 'None'
            };
            
            // Only set domain for production
            if (!isLocalhost && process.env.NEXT_PUBLIC_COOKIE_DOMAIN) {
              cookieOptions.domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
            }
            
            Cookies.set('access_token', response.data.access_token, cookieOptions);
            
            // Clear isLoggedOut flag from both sessionStorage and localStorage
            sessionStorage.removeItem('isLoggedOut');
            localStorage.removeItem('isLoggedOut');
            
            // Set authenticated state immediately
            setIsAuthenticated(true);
            
            // Clear the authorization code from URL to prevent reuse
            const newUrl = window.location.pathname;
            window.history.replaceState(null, null, newUrl);
            
            console.log('Authentication successful, redirecting to home');
            // Redirect to home page without calling checkAuthStatus to avoid additional requests
            router.push('/');
          } else {
            throw new Error('No access token received');
          }
        } catch (error) {
          console.error('Error during callback:', error);
          setError('Authentication failed. Please try again.');
          processingRef.current = false; // Reset on error so user can retry
        } finally {
          setIsProcessing(false);
        }
      } else if (isLoggedOut) {
        console.log('User is logged out, redirecting to home');
        router.push('/');
      } else {
        console.log('No code found or already logged in, redirecting to home');
        router.push('/');
      }
    };

    // Only process if we have a code and haven't started processing yet
    if (router.query.code && !processingRef.current) {
      handleCallback();
    } else if (Cookies.get('access_token') && !processingRef.current) {
      console.log('Access token found, redirecting to home');
      router.push('/');
    }
  }, [router.query.code, setIsAuthenticated]);

  if (isProcessing) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return null;
};

export default Callback;
