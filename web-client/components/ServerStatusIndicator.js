import React, { useState, useEffect } from 'react';
import { Box, Tooltip } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import api from '../lib/api';

const ServerStatusIndicator = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await api.getStatus();
        setIsOnline(response.status === 'success');
      } catch (error) {
        console.error('Error fetching server status:', error);
        setIsOnline(false);
      }
    };

    checkServerStatus();
    const intervalId = setInterval(checkServerStatus, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, []);

  return (
    <Tooltip title={`Server ${isOnline ? 'Online' : 'Offline'}`}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <FiberManualRecordIcon
          sx={{
            color: isOnline ? 'green' : 'red',
            fontSize: '0.8rem',
            mr: 1,
          }}
        />
        Server Status
      </Box>
    </Tooltip>
  );
};

export default ServerStatusIndicator;


