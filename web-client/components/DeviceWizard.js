import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DevicesIcon from '@mui/icons-material/Devices';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CustomTooltip from './CustomTooltip';

/**
 * DeviceWizard - Modal component for creating and editing EEG devices
 * 
 * Supports specific device types:
 * - PiEEG 8: 8-channel PiEEG device
 * - PiEEG 16: 16-channel PiEEG device  
 * - Emotiv EPOC X: 14-channel Emotiv device
 * 
 * Features:
 * - Device registration and configuration
 * - Connection settings (URLs, ports, serial, etc.)
 * - File-based simulator mode for all device types
 */

const DeviceWizard = ({ open, onClose, onSubmit, editingDevice = null }) => {
  const [formData, setFormData] = useState({
    device_id: '',
    device_name: '',
    device_type: '',
    device_model: '',
    device_settings: {}
  });
  const [error, setError] = useState('');
  const [isSimulatorMode, setIsSimulatorMode] = useState(false);

  // Initialize form for editing
  useEffect(() => {
    if (editingDevice && editingDevice.device_id) {
      setFormData({
        device_id: editingDevice.device_id || '',
        device_name: editingDevice.device_name || '',
        device_type: editingDevice.device_type || '',
        device_model: editingDevice.device_model || '',
        device_settings: editingDevice.device_settings || {}
      });
      setIsSimulatorMode(editingDevice.device_settings?.simulator_mode || false);
    } else {
      // Reset form for new device
      setFormData({
        device_id: '',
        device_name: '',
        device_type: '',
        device_model: '',
        device_settings: {}
      });
      setIsSimulatorMode(false);
    }
  }, [editingDevice, open]);

  const handleSubmit = () => {
    if (!formData.device_name.trim()) {
      setError('Device name is required');
      return;
    }

    if (!formData.device_model.trim()) {
      setError('Device model is required');
      return;
    }

    // Automatically set device_type based on device_model
    let device_type = '';
    if (formData.device_model.startsWith('pieeg_')) {
      device_type = 'pieeg';
    } else if (formData.device_model === 'emotiv_epoc_x') {
      device_type = 'emotiv';
    } else if (formData.device_model === 'idun_guardian') {
      device_type = 'idun';
    } else {
      device_type = 'other';
    }

    // Submit the device data
    const deviceData = {
      ...formData,
      device_type: device_type,
      device_settings: {
        ...formData.device_settings,
        simulator_mode: isSimulatorMode,
        ...(isSimulatorMode && {
          data_file: getSimulatorDataFile(),
          loop_data: true
        })
      }
    };

    onSubmit(deviceData);
  };

  const handleClose = () => {
    setFormData({
      device_id: '',
      device_name: '',
      device_type: '',
      device_model: '',
      device_settings: {}
    });
    setError('');
    setIsSimulatorMode(false);
    onClose();
  };

  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    
    if (field.startsWith('device_settings.')) {
      const [, settingField] = field.split('.');
      setFormData(prev => ({
        ...prev,
        device_settings: {
          ...prev.device_settings,
          [settingField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
      
      // Auto-set device_type when device_model changes
      if (field === 'device_model') {
        let device_type = '';
        if (value.startsWith('pieeg_')) {
          device_type = 'pieeg';
        } else if (value === 'emotiv_epoc_x') {
          device_type = 'emotiv';
        } else if (value === 'idun_guardian') {
          device_type = 'idun';
        } else {
          device_type = 'other';
        }
        
        setFormData(prev => ({
          ...prev,
          device_type: device_type
        }));
      }
    }
    setError(''); // Clear error when user starts typing
  };

  const handleSimulatorModeChange = (event) => {
    const isChecked = event.target.checked;
    setIsSimulatorMode(isChecked);
  };

  const getSimulatorDataFile = () => {
    const dataFileMap = {
      'pieeg_8': 'server/data/pieeg_8_sample.csv',
      'pieeg_16': 'server/data/pieeg_16_sample.csv',
      'emotiv_epoc_x': 'server/data/emotiv_epoc_x_sample.csv',
      'idun_guardian': 'server/data/idun_guardian_sample.csv'
    };
    
    return dataFileMap[formData.device_model] || dataFileMap['pieeg_8'];
  };

  const renderDeviceModelSelector = () => {
    return (
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Device Model</InputLabel>
        <Select
          value={formData.device_model}
          onChange={handleInputChange('device_model')}
          label="Device Model"
          sx={{
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
            '& .MuiSelect-select': { color: 'white' }
          }}
        >
          <MenuItem value="pieeg_8">PiEEG 8 Channel</MenuItem>
          <MenuItem value="pieeg_16">PiEEG 16 Channel</MenuItem>
          <MenuItem value="emotiv_epoc_x">Emotiv EPOC X</MenuItem>
          <MenuItem value="idun_guardian">IDUN Guardian</MenuItem>
        </Select>
      </FormControl>
    );
  };

  const renderDeviceSettings = () => {
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon sx={{ fontSize: 20 }} />
          Device Settings
        </Typography>
        
        <FormControlLabel
          control={
            <Checkbox
              checked={isSimulatorMode}
              onChange={handleSimulatorModeChange}
              sx={{
                color: '#666',
                '&.Mui-checked': {
                  color: '#8b5cf6',
                },
              }}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ color: 'white' }}>Simulator Mode</Typography>
              <CustomTooltip title="Use sample data files instead of connecting to real device">
                <HelpOutlineIcon sx={{ color: '#666', cursor: 'pointer', fontSize: 16 }} />
              </CustomTooltip>
            </Box>
          }
          sx={{ mb: 2 }}
        />

        {isSimulatorMode && (
          <Box sx={{ mb: 2, p: 2, bgcolor: '#0f1419', borderRadius: 1, border: '1px solid #333' }}>
            <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
              📁 <strong>Simulator Data:</strong>
            </Typography>
            <Typography variant="body2" sx={{ color: '#666' }}>
              Data file: <code style={{ color: '#8b5cf6' }}>{getSimulatorDataFile()}</code>
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', mt: 1 }}>
              The simulator will loop this data file continuously for testing purposes.
            </Typography>
          </Box>
        )}

        {!isSimulatorMode && renderRealDeviceSettings()}
      </Box>
    );
  };

  const renderRealDeviceSettings = () => {
    if (formData.device_model.startsWith('pieeg_')) {
      return (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              label="Agent URL"
              value={formData.device_settings?.agent_url || ''}
              onChange={handleInputChange('device_settings.agent_url')}
              required
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': { 
                  bgcolor: '#1a1a1a', 
                  '& fieldset': { borderColor: '#333' },
                  '&:hover fieldset': { borderColor: '#8b5cf6' },
                  '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
                },
                '& .MuiInputLabel-root': { color: '#888' },
                '& .MuiInputBase-input': { color: 'white' }
              }}
              placeholder="http://192.168.1.100:8080"
            />
            <CustomTooltip title="The URL of the PiEEG agent">
              <HelpOutlineIcon sx={{ color: '#666', cursor: 'pointer' }} />
            </CustomTooltip>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              label="Pi Serial"
              value={formData.device_settings?.pi_serial || ''}
              onChange={handleInputChange('device_settings.pi_serial')}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': { 
                  bgcolor: '#1a1a1a', 
                  '& fieldset': { borderColor: '#333' },
                  '&:hover fieldset': { borderColor: '#8b5cf6' },
                  '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
                },
                '& .MuiInputLabel-root': { color: '#888' },
                '& .MuiInputBase-input': { color: 'white' }
              }}
              placeholder="10000000a1b2c3d4"
            />
            <CustomTooltip title="The serial number of the Raspberry Pi">
              <HelpOutlineIcon sx={{ color: '#666', cursor: 'pointer' }} />
            </CustomTooltip>
          </Box>
        </Box>
      );
    } else if (formData.device_model === 'emotiv_epoc_x') {
      return (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              label="License Key"
              value={formData.device_settings?.license_key || ''}
              onChange={handleInputChange('device_settings.license_key')}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': { 
                  bgcolor: '#1a1a1a', 
                  '& fieldset': { borderColor: '#333' },
                  '&:hover fieldset': { borderColor: '#8b5cf6' },
                  '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
                },
                '& .MuiInputLabel-root': { color: '#888' },
                '& .MuiInputBase-input': { color: 'white' }
              }}
              placeholder="Your Emotiv license key"
            />
            <CustomTooltip title="Emotiv license key for device access">
              <HelpOutlineIcon sx={{ color: '#666', cursor: 'pointer' }} />
            </CustomTooltip>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              label="Device Serial"
              value={formData.device_settings?.device_serial || ''}
              onChange={handleInputChange('device_settings.device_serial')}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': { 
                  bgcolor: '#1a1a1a', 
                  '& fieldset': { borderColor: '#333' },
                  '&:hover fieldset': { borderColor: '#8b5cf6' },
                  '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
                },
                '& .MuiInputLabel-root': { color: '#888' },
                '& .MuiInputBase-input': { color: 'white' }
              }}
              placeholder="SN202012345678"
            />
            <CustomTooltip title="The serial number of your Emotiv device">
              <HelpOutlineIcon sx={{ color: '#666', cursor: 'pointer' }} />
            </CustomTooltip>
          </Box>
        </Box>
      );
    }
    
    return null;
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
          minHeight: '70vh'
        }
      }}
    >
      <DialogTitle sx={{ color: 'white', borderBottom: '1px solid #333', pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <DevicesIcon sx={{ color: '#8b5cf6' }} />
            <Typography variant="h6">
              {editingDevice && editingDevice.device_id ? 'Edit Device' : 'Register New Device'}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ color: '#888' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: '#1a1a1a', color: 'white', p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, bgcolor: '#2d1b1b', color: '#ff6b6b' }}>
            {error}
          </Alert>
        )}

        {/* Basic Device Information */}
        <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DevicesIcon sx={{ fontSize: 20 }} />
          Device Information
        </Typography>

        <TextField 
          label="Device Name" 
          value={formData.device_name} 
          onChange={handleInputChange('device_name')} 
          required 
          fullWidth
          sx={{ 
            mb: 2,
            '& .MuiOutlinedInput-root': { 
              bgcolor: '#1a1a1a', 
              '& fieldset': { borderColor: '#333' },
              '&:hover fieldset': { borderColor: '#8b5cf6' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
            },
            '& .MuiInputLabel-root': { color: '#888' },
            '& .MuiInputBase-input': { color: 'white' }
          }}
          placeholder="e.g., My EEG Device"
        />

        {renderDeviceModelSelector()}
        {renderDeviceSettings()}
      </DialogContent>

      <DialogActions sx={{ bgcolor: '#1a1a1a', borderTop: '1px solid #333', p: 3 }}>
        <Button 
          onClick={handleClose}
          sx={{ color: '#888', '&:hover': { bgcolor: '#333' } }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            ml: 2,
            px: 3
          }}
        >
          {editingDevice && editingDevice.device_id ? 'Update' : 'Register'} Device
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeviceWizard; 