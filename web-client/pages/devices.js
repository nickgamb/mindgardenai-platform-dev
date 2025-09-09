import React, { useEffect, useState, useContext } from 'react';
import { 
  Typography, 
  Container, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  CircularProgress,
  Box,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Devices as DevicesIcon,
  PlayArrow as PlayArrowIcon,
  Cable as CableIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import api from '../lib/api';
import { AppContext } from '../contexts/AppContext';
import LoginButton from '../components/LoginButton';
import DeviceWizard from '../components/DeviceWizard';
import DynamicEEGChart from '../components/DynamicEEGChart';
import { io } from 'socket.io-client';

const LiveAnalysisDialog = ({ open, onClose, device, isAnalyzing, setIsAnalyzing }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    if (open && !socket) {
      // Get the correct server URL for production or development
      const getServerUrl = () => {
        // Check if we're in production (Netlify)
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
          // Use the environment variable for production
          return process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL;
        } else {
          // Local development
          return process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:5000';
        }
      };

      const serverUrl = getServerUrl();
      console.log('🔌 Attempting to connect to WebSocket server:', serverUrl);
      console.log('🌍 Environment:', typeof window !== 'undefined' ? window.location.hostname : 'server-side');
      
      const newSocket = io(serverUrl, {
        transports: ['websocket', 'polling'], // Try both transports
        withCredentials: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        forceNew: true, // Force a new connection
        upgrade: true, // Allow transport upgrades
      });

      newSocket.on('connect', () => {
        console.log('✅ WebSocket connected successfully');
        console.log('🔗 Connection details:', {
          transport: newSocket.io.engine.transport.name,
          upgraded: newSocket.io.engine.upgraded,
          id: newSocket.id
        });
        setIsConnected(true);
        setConnectionError(null);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ WebSocket disconnected:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        const errorMessage = error.description || error.message || error.toString();
        setConnectionError(`Connection failed: ${errorMessage}`);
        setIsConnected(false);
      });

      newSocket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionError(`Socket error: ${error.message || error}`);
      });

      newSocket.on('connected', (data) => {
        console.log('🎯 Server confirmed connection:', data);
      });

      newSocket.on('streaming_started', (data) => {
        console.log('🎮 Streaming started:', data);
      });

      newSocket.on('streaming_stopped', (data) => {
        console.log('⏹️ Streaming stopped:', data);
      });

      newSocket.on('streaming_error', (data) => {
        console.error('❌ Streaming error:', data);
        setConnectionError(`Streaming error: ${data.error}`);
      });

      setSocket(newSocket);
    }

    // Cleanup on component unmount
    return () => {
      if (socket) {
        console.log('🧹 Component unmounting - cleaning up socket connection');
        
        // Stop streaming if active
        if (isAnalyzing) {
          console.log('⏹️ Auto-stopping analysis due to unmount');
          socket.emit('stop_streaming', { device_id: device.device_id });
        }
        
        // Disconnect device if connected
        if (isConnected) {
          console.log('🔌 Auto-disconnecting device due to unmount');
          socket.emit('disconnect_device', { device_id: device.device_id });
        }
        
        // Close socket after brief delay to ensure commands are sent
        setTimeout(() => {
          socket.disconnect();
        }, 200);
        
        setSocket(null);
        setIsConnected(false);
        setIsAnalyzing(false);
        setConnectionError(null);
      }
    };
  }, [open]);

  // Cleanup when dialog closes - stop streaming and disconnect properly
  useEffect(() => {
    if (!open && socket) {
      console.log('🧹 Dialog closed - cleaning up streaming and connection...');
      
      const cleanup = async () => {
        // Stop streaming if active
        if (isAnalyzing) {
          console.log('⏹️ Auto-stopping analysis due to dialog close');
          socket.emit('stop_streaming', { device_id: device.device_id });
          
          // Small delay to ensure stop command is sent
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Disconnect device properly
        if (isConnected) {
          console.log('🔌 Auto-disconnecting device due to dialog close');
          socket.emit('disconnect_device', { device_id: device.device_id });
          
          // Small delay to ensure disconnect command is sent
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Close socket connection
        console.log('🔌 Closing socket connection');
        socket.disconnect();
        
        // Reset all states
        setSocket(null);
        setIsConnected(false);
        setIsAnalyzing(false);
        setConnectionError(null);
        
        console.log('✅ Cleanup completed');
      };
      
      cleanup();
    }
  }, [open, socket, isAnalyzing, isConnected, device.device_id]);

  const handleConnect = async () => {
    try {
      if (socket && socket.connected) {
        setIsConnected(true);
        setConnectionError(null);
      } else {
        console.log('🔄 Attempting to reconnect...');
        socket?.connect();
      }
    } catch (error) {
      console.error('Error connecting device:', error);
      setConnectionError(`Connection error: ${error.message}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (socket) {
        socket.emit('stop_streaming', { device_id: device.device_id });
        socket.emit('disconnect_device', { device_id: device.device_id });
      }
      setIsConnected(false);
      setIsAnalyzing(false);
      setConnectionError(null);
    } catch (error) {
      console.error('Error disconnecting device:', error);
    }
  };

  const handleStartAnalysis = async () => {
    try {
      if (socket && isConnected) {
        const streamingData = {
          device_id: device.device_id,
          device_type: device.device_type,
          device_model: device.device_model,
          simulator_mode: device.device_settings?.simulator_mode || false
        };
        
        console.log('🎯 Starting streaming with data:', streamingData);
        
        socket.emit('start_streaming', streamingData);
        setIsAnalyzing(true);
        setConnectionError(null);
      } else {
        const errorMsg = 'Socket not connected. Please check your connection.';
        console.error('❌', errorMsg);
        setConnectionError(errorMsg);
      }
    } catch (error) {
      console.error('Error starting analysis:', error);
      setConnectionError(`Start analysis error: ${error.message}`);
    }
  };

  const handleStopAnalysis = async () => {
    try {
      if (socket) {
        socket.emit('stop_streaming', { device_id: device.device_id });
      }
      setIsAnalyzing(false);
      setConnectionError(null);
    } catch (error) {
      console.error('Error stopping analysis:', error);
    }
  };

  // Get server URL for display
  const getDisplayServerUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || 'Production Server';
    } else {
      return process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:5000';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        style: {
          minHeight: '80vh',
          maxHeight: '80vh',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333'
        },
      }}
    >
      <DialogTitle sx={{ color: 'white', borderBottom: '1px solid #333' }}>
        Live Analysis: {device?.device_name}
        {device?.device_settings?.simulator_mode && (
          <Chip 
            label="Simulator Mode" 
            size="small" 
            sx={{ ml: 2, bgcolor: '#ff9800', color: 'white' }}
          />
        )}
      </DialogTitle>
      <DialogContent sx={{ bgcolor: '#1a1a1a', color: 'white', height: 'calc(100% - 64px)' }}>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Connection Status and Controls */}
          <Box sx={{ mb: 2, mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Button 
                onClick={isConnected ? handleDisconnect : handleConnect}
                variant="contained"
                sx={{ mr: 2, bgcolor: isConnected ? '#f44336' : '#4caf50', '&:hover': { bgcolor: isConnected ? '#d32f2f' : '#388e3c' } }}
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </Button>
              <Button 
                onClick={isAnalyzing ? handleStopAnalysis : handleStartAnalysis} 
                disabled={!isConnected}
                variant="contained"
                sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}
              >
                {isAnalyzing ? 'Stop Analysis' : 'Start Analysis'}
              </Button>
              
              {/* Connection Status Indicator */}
              <Chip
                label={isConnected ? 'Connected' : 'Disconnected'}
                size="small"
                sx={{
                  bgcolor: isConnected ? '#4caf50' : '#f44336',
                  color: 'white',
                  fontWeight: 600
                }}
              />
            </Box>
            
            {/* Error Display */}
            {connectionError && (
              <Box sx={{ mb: 2, p: 2, bgcolor: '#2d1b1b', borderRadius: 1, border: '1px solid #d32f2f' }}>
                <Typography variant="body2" color="#ff6b6b">
                  🚨 {connectionError}
                </Typography>
                <Typography variant="caption" color="#ff9999" sx={{ mt: 1, display: 'block' }}>
                  💡 Server: {getDisplayServerUrl()}
                  <br />
                  💡 Check if the backend server is running and accessible
                </Typography>
              </Box>
            )}
            
            {/* Debug Info */}
            <Box sx={{ p: 1, bgcolor: '#0a0a0a', borderRadius: 1, border: '1px solid #333' }}>
              <Typography variant="caption" color="#888">
                🔍 Server: {getDisplayServerUrl()} | 
                Socket: {socket?.connected ? '✅' : '❌'} | 
                Device: {device?.device_id} ({device?.device_model}) |
                Environment: {typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'Production' : 'Development'}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            <DynamicEEGChart 
              isAnalyzing={isAnalyzing}
              deviceId={device.device_id}
              deviceType={device.device_type}
              deviceModel={device.device_model}
              simulatorMode={device.device_settings?.simulator_mode || false}
              socket={socket}
              isConnected={isConnected}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#1a1a1a', borderTop: '1px solid #333' }}>
        <Button onClick={onClose} sx={{ color: 'white' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const Devices = () => {
  const { isAuthenticated, isAuthorized, isLoading } = useContext(AppContext);
  const [devices, setDevices] = useState([]);
  const [showWizard, setShowWizard] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Live analysis state
  const [openLiveAnalysisDialog, setOpenLiveAnalysisDialog] = useState(false);
  const [selectedDeviceForAnalysis, setSelectedDeviceForAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      fetchDevices();
    }
  }, [isAuthenticated, isAuthorized]);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await api.fetchDevices();
      setDevices(response.devices || []);
      setError(null);
    } catch (error) {
      console.error('Error fetching devices:', error);
      setDevices([]);
      setError('Error fetching devices: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDevice = async (deviceData) => {
    try {
      setIsSaving(true);
      await api.registerDevice(deviceData);
      fetchDevices();
      setShowWizard(false);
      setError(null);
    } catch (error) {
      console.error('Error creating device:', error);
      setError('Error saving device: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDevice = async (deviceData) => {
    try {
      setIsSaving(true);
      await api.updateDevice(editingDevice.device_id, deviceData);
      fetchDevices();
      setShowWizard(false);
      setEditingDevice(null);
      setError(null);
    } catch (error) {
      console.error('Error updating device:', error);
      setError('Error updating device: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setShowWizard(true);
  };

  const handleDelete = async (deviceId) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      try {
        await api.deleteDevice(deviceId);
        fetchDevices();
      } catch (error) {
        console.error('Error deleting device:', error);
        setError('Error deleting device: ' + error.message);
      }
    }
  };

  const handleLiveAnalysis = (device) => {
    setSelectedDeviceForAnalysis(device);
    setOpenLiveAnalysisDialog(true);
    setIsAnalyzing(false);
  };

  const getDeviceModelChip = (deviceModel) => {
    const colorMap = {
      'pieeg_8': '#4caf50',
      'pieeg_16': '#2196f3', 
      'emotiv_epoc_x': '#ff9800'
    };

    const labelMap = {
      'pieeg_8': 'PiEEG 8CH',
      'pieeg_16': 'PiEEG 16CH',
      'emotiv_epoc_x': 'EPOC X'
    };

    return (
      <Chip 
        label={labelMap[deviceModel] || 'Unknown'} 
        size="small" 
        sx={{ 
          bgcolor: colorMap[deviceModel] || '#666',
          color: 'white',
          fontWeight: 500
        }}
      />
    );
  };

  const getConnectionDetails = (device) => {
    if (!device.device_settings) return 'No settings';
    
    if (device.device_settings.simulator_mode) {
      return 'Simulator Mode';
    }
    
    if (device.device_model && device.device_model.startsWith('pieeg_')) {
      return device.device_settings.agent_url || 'Not configured';
    } else if (device.device_model === 'emotiv_epoc_x') {
      return device.device_settings.device_serial ? `Serial: ${device.device_settings.device_serial}` : 'Not configured';
    } else {
      return 'Not configured';
    }
  };

  const getConnectionChip = (device) => {
    if (!device.device_settings) return <Typography variant="body2" sx={{ color: '#888' }}>No settings</Typography>;
    
    if (device.device_settings.simulator_mode) {
      return (
        <Chip 
          label="Simulator Mode" 
          size="small" 
          sx={{ 
            bgcolor: '#ff9800', 
            color: 'white', 
            fontWeight: 500 
          }}
        />
      );
    }
    
    return (
      <Typography variant="body2" sx={{ 
        color: '#888',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        {getConnectionDetails(device)}
      </Typography>
    );
  };

  const getSettingsPreview = (device) => {
    if (!device.device_settings) return 'No settings';
    
    const settings = device.device_settings;
    const preview = [];
    
    if (settings.simulator_mode) {
      preview.push('Simulator');
    }
    
    if (device.device_model && device.device_model.startsWith('pieeg_')) {
      if (settings.pi_serial) preview.push(`Pi: ${settings.pi_serial.substring(0, 8)}...`);
    } else if (device.device_model === 'emotiv_epoc_x') {
      if (settings.license_key) preview.push('Licensed');
      if (settings.device_serial) preview.push(`SN: ${settings.device_serial.substring(0, 8)}...`);
    }
    
    return preview.length > 0 ? preview.join(', ') : 'Basic settings';
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
            : "You don't have permission to access the Devices page."}
        </Typography>
        {!isAuthenticated && (
          <LoginButton />
        )}
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        pb: 2,
        borderBottom: '1px solid #333'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <DevicesIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
            EEG Devices
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowWizard(true)}
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            borderRadius: 2,
            px: 3
          }}
        >
          Add New Device
        </Button>
      </Box>

      {/* Error Display */}
      {error && (
        <Box sx={{ mb: 3, p: 2, bgcolor: '#2d1b1b', borderRadius: 1, border: '1px solid #d32f2f' }}>
          <Typography color="#ff6b6b">{error}</Typography>
        </Box>
      )}

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : devices.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 8,
          bgcolor: '#1a1a1a',
          borderRadius: 2,
          border: '1px solid #333'
        }}>
          <DevicesIcon sx={{ fontSize: 64, color: '#666', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#888', mb: 1 }}>
            No Devices Registered
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Register your first EEG device to start collecting data
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowWizard(true)}
            sx={{
              bgcolor: '#8b5cf6',
              '&:hover': { bgcolor: '#7c3aed' }
            }}
          >
            Register Device
          </Button>
        </Box>
      ) : (
        <TableContainer 
          component={Paper} 
          sx={{ 
            bgcolor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: 2,
            overflowX: 'auto',
            '& .MuiTableCell-root': {
              borderColor: '#333'
            }
          }}
        >
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#111' }}>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 180,
                  width: '20%'
                }}>
                  Device
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 120,
                  width: '15%'
                }}>
                  Model
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 130,
                  width: '15%'
                }}>
                  Connection
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 150,
                  width: '20%'
                }}>
                  Settings
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 120,
                  width: '15%'
                }}>
                  Registered
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 150,
                  width: '15%',
                  textAlign: 'center'
                }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devices.map((device) => (
                <TableRow 
                  key={device.device_id}
                  sx={{ 
                    '&:hover': { bgcolor: '#222' }
                  }}
                >
                  <TableCell sx={{ color: 'white' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CableIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {device.device_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>
                          ID: {device.device_id}
                        </Typography>
                        {device.device_settings?.simulator_mode && (
                          <Chip 
                            size="small" 
                            label="Simulator" 
                            sx={{ 
                              ml: 1, 
                              bgcolor: '#ff9800', 
                              color: 'white', 
                              fontSize: '10px',
                              height: '20px'
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'white' }}>
                    {getDeviceModelChip(device.device_model)}
                  </TableCell>
                  <TableCell sx={{ color: 'white' }}>
                    {getConnectionChip(device)}
                  </TableCell>
                  <TableCell sx={{ color: 'white' }}>
                    <Typography variant="body2" sx={{ 
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      color: '#888'
                    }}>
                      {getSettingsPreview(device)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: '#ccc' }}>
                    <Typography variant="body2">
                      {device.registered_at ? new Date(device.registered_at).toLocaleDateString() : 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleLiveAnalysis(device)}
                        sx={{ 
                          color: '#4caf50',
                          '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.1)' }
                        }}
                        title="Live Analysis"
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleEdit(device)}
                        sx={{ 
                          color: '#2196f3',
                          '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.1)' }
                        }}
                        title="Edit Device"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(device.device_id)}
                        sx={{ 
                          color: '#f44336',
                          '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.1)' }
                        }}
                        title="Delete Device"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Device Wizard */}
      <DeviceWizard
        open={showWizard}
        onClose={() => {
          setShowWizard(false);
          setEditingDevice(null);
        }}
        onSubmit={editingDevice ? handleUpdateDevice : handleCreateDevice}
        editingDevice={editingDevice}
      />

      {/* Live Analysis Dialog */}
      {selectedDeviceForAnalysis && (
        <LiveAnalysisDialog 
          open={openLiveAnalysisDialog}
          onClose={() => setOpenLiveAnalysisDialog(false)}
          device={selectedDeviceForAnalysis}
          isAnalyzing={isAnalyzing}
          setIsAnalyzing={setIsAnalyzing}
        />
      )}
    </Container>
  );
};

export default Devices;
