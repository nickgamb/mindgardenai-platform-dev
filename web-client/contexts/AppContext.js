import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import Cookies from 'js-cookie';
import { useRouter } from 'next/router';
import jwtDecode from 'jwt-decode';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [isErrorVisible, setIsErrorVisible] = useState(false);
  const router = useRouter();

  const clearError = useCallback(() => {
    setError(null);
    setIsErrorVisible(false);
  }, []);

  const showError = useCallback((errorMessage) => {
    setError(errorMessage);
    setIsErrorVisible(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      // Set loading state to true immediately
      setIsLoading(true);

      // Remove cookies with environment-appropriate options
      const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const cookieRemoveOptions = {
        path: '/',
        secure: !isLocalhost,
        sameSite: isLocalhost ? 'Lax' : 'None'
      };
      
      // Only set domain for production
      if (!isLocalhost && process.env.NEXT_PUBLIC_COOKIE_DOMAIN) {
        cookieRemoveOptions.domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
      }
      
      Cookies.remove('access_token', cookieRemoveOptions);
      // Remove refresh token cookie. TODO: We do not support refresh tokens yet.
      Cookies.remove('refresh_token', cookieRemoveOptions);
      sessionStorage.setItem('isLoggedOut', 'true');
      localStorage.setItem('isLoggedOut', 'true');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('userInfoCacheTime');

      // Try to logout from the backend
      try {
        await api.logout();
      } catch (backendError) {
        console.error('Backend logout failed:', backendError);
      }

    } catch (error) {
      console.error('Logout process error:', error);
      showError('Logout process error: ' + error.message);
    } finally {
      // Prepare the Auth0 logout URL
      const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
      const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
      const returnTo = encodeURIComponent(`${window.location.protocol}//${window.location.host}`);
      const logoutUrl = `https://${auth0Domain}/v2/logout?client_id=${clientId}&returnTo=${returnTo}`; //INFO: We don't use the '&federated' parameter because it causes the user to be logged out of Google/SM.

      // Update state and redirect in one go
      setIsAuthenticated(false);
      setUser(null);
      setIsAuthorized(false);
      setIsLoading(false);
      window.location.href = logoutUrl;
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const token = Cookies.get('access_token');
      const isLoggedOut = sessionStorage.getItem('isLoggedOut') || localStorage.getItem('isLoggedOut');

      console.log('Checking auth status:', { token: !!token, isLoggedOut });

      if (token && isLoggedOut !== 'true') {
        let decodedToken;
        try {
          // Try to decode token (might be encrypted JWE format)
          decodedToken = jwtDecode(token);
          const currentTime = Date.now() / 1000;
          if (decodedToken.exp < currentTime) {
            console.log('Token has expired');
            await logout();
            return;
          }
          console.log('Successfully decoded JWT token on frontend');
        } catch (error) {
          // For encrypted tokens (JWE), we can't decode client-side but they're still valid
          // The backend will validate and extract user info including permissions
          console.log('Token is encrypted (JWE format), will validate on backend');
          decodedToken = null;
        }

        setIsAuthenticated(true);

        // Check if we have cached user info and it's not too old
        const cachedUserInfo = JSON.parse(localStorage.getItem('userInfo'));
        const cacheTime = localStorage.getItem('userInfoCacheTime');
        const isCacheValid = cacheTime && (Date.now() - parseInt(cacheTime)) < 3600000; // 1 hour

        let userInfo;
        if (cachedUserInfo && isCacheValid) {
          userInfo = cachedUserInfo;
        } else {
          try {
            // Fetch user info from Auth0 only if necessary
            userInfo = await api.fetchUserInfo(token);
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
            localStorage.setItem('userInfoCacheTime', Date.now().toString());
                  } catch (error) {
          console.error('Error fetching user info:', error);
          // Use cached info if available, even if expired
          if (cachedUserInfo) {
            userInfo = cachedUserInfo;
            console.log('Using cached user info due to fetch error');
          } else {
            // If no cached info and fetch fails, use basic info from token (if available)
            if (decodedToken) {
              userInfo = {
                name: decodedToken.name || decodedToken.nickname || 'User',
                email: decodedToken.email || '',
                picture: decodedToken.picture || ''
              };
              console.log('Using basic token info due to fetch error');
            } else {
              // For encrypted tokens, use minimal fallback
              userInfo = {
                name: 'User',
                email: '',
                picture: ''
              };
              console.log('Using minimal fallback for encrypted token');
            }
          }
          // Don't show error for user info fetch failures as we have fallback
        }
        }

        // Get permissions from userInfo (fetched from backend) or fallback to token
        let userPermissions = [];
        if (userInfo && userInfo.permissions) {
          userPermissions = userInfo.permissions;
          console.log('Using permissions from backend API:', userPermissions);
        } else if (decodedToken && decodedToken.permissions) {
          userPermissions = decodedToken.permissions;
          console.log('Using permissions from decoded token:', userPermissions);
        } else {
          console.log('No permissions found, using empty array');
        }

        // Debug logging for permissions
        console.log('User permissions from token:', userPermissions);

        // Extract page from the current URL (strip query parameters)
        const path = router.asPath;
        let page;

        if (path === '/' || path === '') {
          page = 'index';
        } else {
          const url_parts = path.split('/');
          if (url_parts[1]) {
            // Strip query parameters from the page name
            page = url_parts[1].split('?')[0];
          } else {
            throw new Error('Unable to determine current page from URL');
          }
        }

        // Debug logging for page detection
        console.log('Current page detected:', page, 'from path:', path);

        //TODO: Get this from config
        const unrestricted_pages = ['index', 'callback'];

        // Determine if the current page requires permission check
        const requires_permission = !unrestricted_pages.includes(page) && page !== 'api-docs'; // API docs are public for registered users

        let isAuthorized = false; // Default to false because "least privilege"

        // Since we successfully validated the token above (JWT decode + expiration check),
        // we know the user is authenticated at this point
        
        // Check if RBAC is enabled
        const enableRbac = process.env.NEXT_PUBLIC_ENABLE_RBAC === 'true';
        console.log('RBAC enabled:', enableRbac);
        
        if (requires_permission && enableRbac) {
          // Determine the required permission for reading the page
          const required_permission = `${page}:get`;

          // Get the super admin roles from the environment variable
          const super_admin_roles = process.env.NEXT_PUBLIC_SUPER_ADMIN_ROLES?.split(',') || ['mindgardenai-admin'];
          
          // Debug logging for environment variables
          console.log('Environment variables:', {
            NEXT_PUBLIC_SUPER_ADMIN_ROLES: process.env.NEXT_PUBLIC_SUPER_ADMIN_ROLES,
            super_admin_roles
          });

          // Check if the user has the required permission or is a super admin
          const hasRequiredPermission = userPermissions.includes(required_permission);
          const isSuperAdmin = super_admin_roles.some(role => userPermissions.includes(role));

          // Debug logging for authorization
          console.log('Authorization check:', {
            page,
            required_permission,
            hasRequiredPermission,
            isSuperAdmin,
            super_admin_roles,
            userPermissions
          });

          // Set isAuthorized based on permissions
          isAuthorized = hasRequiredPermission || isSuperAdmin;
        } else if (requires_permission && !enableRbac) {
          // RBAC disabled - grant access to all authenticated users
          console.log('RBAC disabled - granting access to authenticated user for page:', page);
          isAuthorized = true;
        } else {
          isAuthorized = true; // For unrestricted pages, authorized if authenticated
          console.log('Page does not require permission, setting authorized to true');
        }

        console.log('Final authorization result:', isAuthorized);
        setIsAuthorized(isAuthorized);

        setUser({
          name: userInfo.name || userInfo.nickname || 'User',
          email: userInfo.email,
          picture: userInfo.picture,
          permissions: userPermissions,
        });
        
        // Debug logging for final user state
        console.log('User authentication completed:', {
          isAuthenticated: true,
          isAuthorized,
          user: {
            name: userInfo.name || userInfo.nickname || 'User',
            email: userInfo.email,
            permissions: userPermissions
          }
        });
      } else {
        console.log('Setting unauthenticated state');
        setIsAuthenticated(false);
        setIsAuthorized(false);
        setUser(null);

        // Clear any lingering tokens or flags
        Cookies.remove('access_token');
        sessionStorage.removeItem('isLoggedOut');
        localStorage.removeItem('isLoggedOut');
      }
    } catch (error) {
      console.error('Error checking authentication status:', error);
      // Only set as unauthenticated if we have no token or if it's a clear auth failure
      const token = Cookies.get('access_token');
      if (!token) {
        setIsAuthenticated(false);
        setIsAuthorized(false);
        setUser(null);
      } else {
        // If we have a token but there's an error, keep the user logged in
        // and just log the error without changing authentication state
        console.warn('Authentication check error, but keeping user logged in:', error);
        
        // Only show error for critical auth failures, not network issues
        if (error.message && !error.message.includes('Network Error') && !error.message.includes('timeout')) {
          showError('Authentication check error: ' + error.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [router.asPath, logout]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleLogin = () => {
    sessionStorage.removeItem('isLoggedOut');  // Clear the logged out flag
    const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_AUTH0_CALLBACK_URL);
    const responseType = 'code';
    const scope = encodeURIComponent('openid profile email');
    // Remove audience for basic user authentication
    // const audience = encodeURIComponent(process.env.NEXT_PUBLIC_AUTH0_API_IDENTIFIER);

    const authorizationUrl = `https://${auth0Domain}/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `response_type=${responseType}&` +
        `scope=${scope}`;

    window.location.href = authorizationUrl;
  };

  const verifyTokenValidity = useCallback(async () => {
    try {
      const token = Cookies.get('access_token');
      if (token) {
        const response = await api.verifyToken(token);
        if (!response.isValid) {
          // Only logout if the token is explicitly invalid, not on network errors
          if (response.error && !response.error.includes('Network Error') && !response.error.includes('404')) {
            console.log('Token is invalid, logging out');
            await logout();
          } else {
            console.log('Token verification failed due to network/server error, keeping user logged in');
          }
        }
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      // Don't logout on network errors, only on actual auth failures
      if (error.response && error.response.status === 401) {
        await logout();
      }
    }
  }, [logout]);

  // Disable periodic token verification since it's causing issues
  // The token validation is already handled in checkAuthStatus
  /*
  useEffect(() => {
    // Check token validity every 5 minutes
    const intervalId = setInterval(verifyTokenValidity, 5 * 60 * 1000);

    // Clear the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [verifyTokenValidity]);
  */

  return (
    <AppContext.Provider value={{
      isAuthenticated,
      isAuthorized,
      isLoading,
      user,
      error,
      isErrorVisible,
      clearError,
      showError,
      setIsAuthenticated,
      setUser,
      setIsAuthorized,
      handleLogin,
      logout,
      checkAuthStatus,
      verifyTokenValidity
    }}>
      {children}
    </AppContext.Provider>
  );
};
