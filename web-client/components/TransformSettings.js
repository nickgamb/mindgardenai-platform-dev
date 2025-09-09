import React, { useState, useContext, useEffect } from 'react';
import { 
  Grid, 
  Typography, 
  Slider, 
  FormControlLabel, 
  Switch, 
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Divider
} from '@mui/material';
import api from '../lib/api';
import { AppContext } from '../contexts/AppContext';

const TransformSettings = () => {
  const { setError } = useContext(AppContext);
  
  // MGFlow transform settings
  const [executionTimeout, setExecutionTimeout] = useState(30);
  const [memoryLimit, setMemoryLimit] = useState(512);
  const [retryAttempts, setRetryAttempts] = useState(3);
  const [enableValidation, setEnableValidation] = useState(true);
  const [csvDelimiter, setCsvDelimiter] = useState(',');
  const [skipEmptyRows, setSkipEmptyRows] = useState(true);
  const [enableLogging, setEnableLogging] = useState(true);
  const [errorHandling, setErrorHandling] = useState('retry');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await api.getTransformSettings();
        setExecutionTimeout(settings.executionTimeout || 30);
        setMemoryLimit(settings.memoryLimit || 512);
        setRetryAttempts(settings.retryAttempts || 3);
        setEnableValidation(settings.enableValidation !== false);
        setCsvDelimiter(settings.csvDelimiter || ',');
        setSkipEmptyRows(settings.skipEmptyRows !== false);
        setEnableLogging(settings.enableLogging !== false);
        setErrorHandling(settings.errorHandling || 'retry');
      } catch (error) {
        setError('Failed to fetch transform settings: ' + error.message);
      }
    };
    fetchSettings();
  }, [setError]);

  const handleSettingsChange = async (newSettings) => {
    try {
      await api.updateTransformSettings(newSettings);
      setError(null);
    } catch (error) {
      setError('Failed to update transform settings: ' + error.message);
    }
  };

  const handleTimeoutChange = (event, newValue) => {
    setExecutionTimeout(newValue);
    handleSettingsChange({ 
      executionTimeout: newValue, 
      memoryLimit, 
      retryAttempts, 
      enableValidation,
      csvDelimiter,
      skipEmptyRows,
      enableLogging,
      errorHandling
    });
  };

  const handleMemoryLimitChange = (event, newValue) => {
    setMemoryLimit(newValue);
    handleSettingsChange({ 
      executionTimeout, 
      memoryLimit: newValue, 
      retryAttempts, 
      enableValidation,
      csvDelimiter,
      skipEmptyRows,
      enableLogging,
      errorHandling
    });
  };

  const handleRetryAttemptsChange = (event, newValue) => {
    setRetryAttempts(newValue);
    handleSettingsChange({ 
      executionTimeout, 
      memoryLimit, 
      retryAttempts: newValue, 
      enableValidation,
      csvDelimiter,
      skipEmptyRows,
      enableLogging,
      errorHandling
    });
  };

  const handleValidationChange = (event) => {
    setEnableValidation(event.target.checked);
    handleSettingsChange({ 
      executionTimeout, 
      memoryLimit, 
      retryAttempts, 
      enableValidation: event.target.checked,
      csvDelimiter,
      skipEmptyRows,
      enableLogging,
      errorHandling
    });
  };

  const handleCsvDelimiterChange = (event) => {
    setCsvDelimiter(event.target.value);
    handleSettingsChange({ 
      executionTimeout, 
      memoryLimit, 
      retryAttempts, 
      enableValidation,
      csvDelimiter: event.target.value,
      skipEmptyRows,
      enableLogging,
      errorHandling
    });
  };

  const handleSkipEmptyRowsChange = (event) => {
    setSkipEmptyRows(event.target.checked);
    handleSettingsChange({ 
      executionTimeout, 
      memoryLimit, 
      retryAttempts, 
      enableValidation,
      csvDelimiter,
      skipEmptyRows: event.target.checked,
      enableLogging,
      errorHandling
    });
  };

  const handleLoggingChange = (event) => {
    setEnableLogging(event.target.checked);
    handleSettingsChange({ 
      executionTimeout, 
      memoryLimit, 
      retryAttempts, 
      enableValidation,
      csvDelimiter,
      skipEmptyRows,
      enableLogging: event.target.checked,
      errorHandling
    });
  };

  const handleErrorHandlingChange = (event) => {
    setErrorHandling(event.target.value);
    handleSettingsChange({ 
      executionTimeout, 
      memoryLimit, 
      retryAttempts, 
      enableValidation,
      csvDelimiter,
      skipEmptyRows,
      enableLogging,
      errorHandling: event.target.value
    });
  };

  return (
    <Grid container spacing={3} sx={{ mt: 2 }}>
      <Grid item xs={12}>
        <Typography variant="h5" sx={{ color: '#8b5cf6', mb: 2 }}>
          Transform Settings
        </Typography>
      </Grid>

      {/* Execution Settings */}
      <Grid item xs={12}>
        <Typography variant="h6" sx={{ color: '#10b981', mb: 2 }}>
          Execution Settings
        </Typography>
        <Divider sx={{ bgcolor: '#333', mb: 3 }} />
      </Grid>

      <Grid item xs={12} md={6}>
        <Typography gutterBottom sx={{ color: 'white' }}>
          Execution Timeout ({executionTimeout} seconds)
        </Typography>
        <Slider
          value={executionTimeout}
          onChange={handleTimeoutChange}
          aria-labelledby="execution-timeout-slider"
          valueLabelDisplay="auto"
          min={5}
          max={300}
          step={5}
          sx={{ color: '#8b5cf6' }}
        />
        <Typography variant="caption" sx={{ color: '#888' }}>
          Maximum time allowed for transform execution
        </Typography>
      </Grid>

      <Grid item xs={12} md={6}>
        <Typography gutterBottom sx={{ color: 'white' }}>
          Memory Limit ({memoryLimit} MB)
        </Typography>
        <Slider
          value={memoryLimit}
          onChange={handleMemoryLimitChange}
          aria-labelledby="memory-limit-slider"
          valueLabelDisplay="auto"
          min={128}
          max={2048}
          step={128}
          sx={{ color: '#8b5cf6' }}
        />
        <Typography variant="caption" sx={{ color: '#888' }}>
          Maximum memory usage for transform execution
        </Typography>
      </Grid>

      <Grid item xs={12} md={6}>
        <Typography gutterBottom sx={{ color: 'white' }}>
          Retry Attempts ({retryAttempts})
        </Typography>
        <Slider
          value={retryAttempts}
          onChange={handleRetryAttemptsChange}
          aria-labelledby="retry-attempts-slider"
          valueLabelDisplay="auto"
          min={0}
          max={10}
          step={1}
          sx={{ color: '#8b5cf6' }}
        />
        <Typography variant="caption" sx={{ color: '#888' }}>
          Number of retry attempts on transform failure
        </Typography>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel sx={{ color: '#888' }}>Error Handling</InputLabel>
          <Select
            value={errorHandling}
            onChange={handleErrorHandlingChange}
            sx={{ 
              bgcolor: '#1a1a1a', 
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
              '& .MuiSelect-select': { color: 'white' }
            }}
          >
            <MenuItem value="retry">Retry on Failure</MenuItem>
            <MenuItem value="skip">Skip on Failure</MenuItem>
            <MenuItem value="halt">Halt on Failure</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" sx={{ color: '#888' }}>
          How to handle transform execution errors
        </Typography>
      </Grid>

      {/* Data Processing Settings */}
      <Grid item xs={12}>
        <Typography variant="h6" sx={{ color: '#10b981', mb: 2, mt: 2 }}>
          Data Processing Settings
        </Typography>
        <Divider sx={{ bgcolor: '#333', mb: 3 }} />
      </Grid>

      <Grid item xs={12} md={6}>
        <TextField
          label="CSV Delimiter"
          value={csvDelimiter}
          onChange={handleCsvDelimiterChange}
          fullWidth
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
          helperText="Character used to separate CSV columns"
          FormHelperTextProps={{ sx: { color: '#888' } }}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <Box sx={{ pt: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={skipEmptyRows}
                onChange={handleSkipEmptyRowsChange}
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
            label="Skip Empty Rows"
            sx={{ color: 'white' }}
          />
          <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
            Automatically skip empty rows in CSV files
          </Typography>
        </Box>
      </Grid>

      {/* System Settings */}
      <Grid item xs={12}>
        <Typography variant="h6" sx={{ color: '#10b981', mb: 2, mt: 2 }}>
          System Settings
        </Typography>
        <Divider sx={{ bgcolor: '#333', mb: 3 }} />
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControlLabel
          control={
            <Switch
              checked={enableValidation}
              onChange={handleValidationChange}
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
          label="Enable Data Validation"
          sx={{ color: 'white' }}
        />
        <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
          Validate data integrity before and after transforms
        </Typography>
      </Grid>

      <Grid item xs={12} md={6}>
        <FormControlLabel
          control={
            <Switch
              checked={enableLogging}
              onChange={handleLoggingChange}
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
          label="Enable Transform Logging"
          sx={{ color: 'white' }}
        />
        <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
          Log detailed information about transform execution
        </Typography>
      </Grid>
    </Grid>
  );
};

export default TransformSettings;