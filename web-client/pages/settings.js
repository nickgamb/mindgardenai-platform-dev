import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { 
  Typography, 
  Box, 
  Avatar, 
  Container, 
  CircularProgress, 
  Switch, 
  TextField, 
  Button, 
  FormControlLabel, 
  Alert,
  Paper,
  Grid
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import ChatIcon from '@mui/icons-material/Chat';
import MemoryIcon from '@mui/icons-material/Memory';
import SaveIcon from '@mui/icons-material/Save';
import LoginButton from '../components/LoginButton';
import api from '../lib/api';

const Settings = () => {
  const { user, isAuthenticated, isAuthorized, isLoading } = useContext(AppContext);

  // Chat Settings state
  const [useLocalChat, setUseLocalChat] = useState(false);
  const [localChatServers, setLocalChatServers] = useState('');
  const [chatSettingsLoading, setChatSettingsLoading] = useState(true);
  const [chatSettingsError, setChatSettingsError] = useState(null);
  const [chatSettingsSaved, setChatSettingsSaved] = useState(false);

  // Feature Flags state
  const [neuroTechWorkloads, setNeuroTechWorkloads] = useState(true);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      setChatSettingsLoading(true);
      setChatSettingsError(null);
      setChatSettingsSaved(false);
      try {
        const settings = await api.getUserSettings();
        setUseLocalChat(!!settings.useLocalChat);
        setLocalChatServers(settings.localChatServers || '');
        setNeuroTechWorkloads(
          settings?.featureFlags && typeof settings.featureFlags.neuroTechWorkloads === 'boolean'
            ? settings.featureFlags.neuroTechWorkloads
            : true
        );
        // Sync to localStorage for immediate effect in ai-core-api.js
        localStorage.setItem('useLocalChat', settings.useLocalChat ? 'true' : 'false');
        localStorage.setItem('localChatServers', settings.localChatServers || '');
        localStorage.setItem('feature_neuroTechWorkloads', (settings?.featureFlags?.neuroTechWorkloads ?? true) ? 'true' : 'false');
      } catch (e) {
        setChatSettingsError('Failed to load chat settings.');
      } finally {
        setChatSettingsLoading(false);
      }
    }
    if (isAuthenticated && isAuthorized) {
      loadSettings();
    }
  }, [isAuthenticated, isAuthorized]);

  // Save handler
  const handleSaveChatSettings = async () => {
    setChatSettingsError(null);
    setChatSettingsSaved(false);
    setChatSettingsLoading(true);
    try {
      await api.updateUserSettings({ 
        useLocalChat, 
        localChatServers,
        featureFlags: { neuroTechWorkloads }
      });
      // Sync to localStorage for immediate effect in ai-core-api.js
      localStorage.setItem('useLocalChat', useLocalChat ? 'true' : 'false');
      localStorage.setItem('localChatServers', localChatServers || '');
      localStorage.setItem('feature_neuroTechWorkloads', neuroTechWorkloads ? 'true' : 'false');
      setChatSettingsSaved(true);
    } catch (e) {
      setChatSettingsError('Failed to save chat settings.');
    } finally {
      setChatSettingsLoading(false);
    }
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
            : "You don't have permission to access the Settings page."}
        </Typography>
        {!isAuthenticated && (
          <LoginButton />
        )}
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
        <CircularProgress color="primary" />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading user information...</Typography>
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
          <SettingsIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
            Settings
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* User Profile Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ 
            p: 4, 
            bgcolor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: 3,
            height: 'fit-content'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <PersonIcon sx={{ color: '#8b5cf6', fontSize: 24 }} />
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                User Profile
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
              <Avatar 
                src={user.picture} 
                alt="User Avatar" 
                sx={{ 
                  width: 80, 
                  height: 80,
                  border: '3px solid #8b5cf6'
                }} 
              />
              <Box>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 0.5 }}>
                  {user.name}
                </Typography>
                <Typography sx={{ color: '#888', mb: 1 }}>
                  {user.email}
                </Typography>
                {user.permissions && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {user.permissions.slice(0, 3).map((permission, index) => (
                      <Box
                        key={index}
                        sx={{
                          bgcolor: '#8b5cf6',
                          color: 'white',
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}
                      >
                        {permission}
                      </Box>
                    ))}
                    {user.permissions.length > 3 && (
                      <Box
                        sx={{
                          bgcolor: '#333',
                          color: '#888',
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          fontSize: '0.75rem'
                        }}
                      >
                        +{user.permissions.length - 3} more
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Box>

            <Box sx={{ 
              bgcolor: '#0f1419', 
              p: 2, 
              borderRadius: 1, 
              border: '1px solid #333' 
            }}>
              <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
                ℹ️ <strong>Account Information</strong>
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                Your profile information is managed through your authentication provider.
                Changes to your name, email, or avatar should be made in your account settings.
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Chat Settings Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ 
            p: 4, 
            bgcolor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: 3,
            height: 'fit-content'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <ChatIcon sx={{ color: '#8b5cf6', fontSize: 24 }} />
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                Chat Settings
              </Typography>
            </Box>

            {chatSettingsLoading && !chatSettingsSaved ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={useLocalChat}
                      onChange={e => setUseLocalChat(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#8b5cf6',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#8b5cf6',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ color: 'white', fontWeight: 500 }}>
                      Use Local Chat Server
                    </Typography>
                  }
                  sx={{ mb: 3 }}
                />

                <TextField
                  label="Local Chat Servers"
                  value={localChatServers}
                  onChange={e => setLocalChatServers(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  disabled={!useLocalChat}
                  helperText="Comma or semicolon separated list of URLs (e.g. http://localhost:8080,http://192.168.1.232:8080)"
                  sx={{ 
                    mb: 3,
                    '& .MuiOutlinedInput-root': { 
                      bgcolor: '#1a1a1a', 
                      '& fieldset': { borderColor: '#333' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' },
                      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                      '&.Mui-disabled fieldset': { borderColor: '#222' }
                    },
                    '& .MuiInputLabel-root': { color: '#888' },
                    '& .MuiInputLabel-root.Mui-disabled': { color: '#555' },
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiInputBase-input.Mui-disabled': { color: '#555' },
                    '& .MuiFormHelperText-root': { color: '#666' }
                  }}
                />

                <Button
                  startIcon={<SaveIcon />}
                  variant="contained"
                  onClick={handleSaveChatSettings}
                  disabled={chatSettingsLoading}
                  sx={{
                    bgcolor: '#8b5cf6',
                    '&:hover': { bgcolor: '#7c3aed' },
                    '&:disabled': { bgcolor: '#333', color: '#666' },
                    fontWeight: 600,
                    px: 3,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    mb: 2
                  }}
                >
                  {chatSettingsLoading ? 'Saving...' : 'Save Chat Settings'}
                </Button>

                {chatSettingsSaved && (
                  <Alert 
                    severity="success" 
                    sx={{ 
                      bgcolor: '#065f46', 
                      color: '#10b981',
                      '& .MuiAlert-icon': { color: '#10b981' },
                      mb: 2
                    }}
                  >
                    Chat settings saved successfully!
                  </Alert>
                )}

                {chatSettingsError && (
                  <Alert 
                    severity="error" 
                    sx={{ 
                      bgcolor: '#7f1d1d', 
                      color: '#ef4444',
                      '& .MuiAlert-icon': { color: '#ef4444' },
                      mb: 2
                    }}
                  >
                    {chatSettingsError}
                  </Alert>
                )}

                <Box sx={{ 
                  bgcolor: '#0f1419', 
                  p: 2, 
                  borderRadius: 1, 
                  border: '1px solid #333' 
                }}>
                  <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
                    💡 <strong>Local Chat Server</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    Enable this option to use your own local chat server instead of the default service.
                    Make sure your local server is running and accessible from this application.
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Feature Flags Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ 
            p: 4, 
            bgcolor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: 3,
            height: 'fit-content'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <MemoryIcon sx={{ color: '#8b5cf6', fontSize: 24 }} />
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                Feature Flags
              </Typography>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={neuroTechWorkloads}
                  onChange={e => setNeuroTechWorkloads(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#8b5cf6',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#8b5cf6',
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ color: 'white', fontWeight: 500 }}>
                    NeuroTech Workloads
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#888' }}>
                    Enables Devices, Experiments, and related NeuroTech features.
                  </Typography>
                </Box>
              }
              sx={{ mb: 3, alignItems: 'flex-start' }}
            />

            <Button
              startIcon={<SaveIcon />}
              variant="contained"
              onClick={handleSaveChatSettings}
              disabled={chatSettingsLoading}
              sx={{
                bgcolor: '#8b5cf6',
                '&:hover': { bgcolor: '#7c3aed' },
                '&:disabled': { bgcolor: '#333', color: '#666' },
                fontWeight: 600,
                px: 3,
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                mb: 2
              }}
            >
              {chatSettingsLoading ? 'Saving...' : 'Save Feature Flags'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Settings;
