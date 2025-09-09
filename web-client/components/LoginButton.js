import React, { useState, useContext } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { AppContext } from '../contexts/AppContext';

const LoginButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { handleLogin } = useContext(AppContext); // Use handleLogin from AppContext

  const onLoginClick = async () => {
    setIsLoading(true);
    try {
      handleLogin(); // Call handleLogin directly
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={onLoginClick} 
      disabled={isLoading}
      variant="contained"
      color="primary"
      sx={{ mt: 2 }}
    >
      {isLoading ? <CircularProgress size={24} /> : 'Log in'}
    </Button>
  );
};

export default LoginButton;