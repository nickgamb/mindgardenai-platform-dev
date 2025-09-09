import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Alert,
  Divider,
  Tooltip,
  Grid,
  Paper
} from '@mui/material';
import {
  AccountTree as MappingIcon,
  DataObject as DataIcon,
  ArrowForward as ArrowIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  LinkOff as UnmappedIcon,
  Analytics as AnalyticsIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

import AttributeMappingLines from './AttributeMappingLines';

/**
 * AnalyticsMapper Component
 * 
 * Provides a visual interface for mapping input data attributes to analytics script parameters.
 * Analytics nodes require a script to be selected and map input data to script parameters.
 * The output connector is the result of the analytics script execution.
 * 
 * Props:
 * - inputSchema: Array of input field definitions
 * - selectedAnalytics: The selected analytics script object
 * - configData: Current node configuration data
 * - onMappingsChange: Callback when mappings are updated
 * - onRefreshSchema: Callback to refresh input schema
 */
const AnalyticsMapper = ({
  inputSchema = [],
  selectedAnalytics = null,
  configData = {},
  onMappingsChange,
  onRefreshSchema
}) => {
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [currentMapping, setCurrentMapping] = useState({});
  
  // Ref for the mapping container to enable visual connection lines
  const mappingContainerRef = useRef(null);

  // Extract script parameters from the selected analytics
  const scriptParameters = useMemo(() => {
    if (!selectedAnalytics || !selectedAnalytics.parameters) {
      return [];
    }
    
    // Import the function dynamically to avoid circular dependencies
    const { extractAnalyticsScriptParameters } = require('../utils/schemaUtils');
    return extractAnalyticsScriptParameters(selectedAnalytics.parameters);
  }, [selectedAnalytics]);

  // Mapping types available for analytics parameter mapping
  const getMappingTypes = () => ({
    'direct': { label: 'Direct Copy', description: 'Copy input field directly' },
    'constant': { label: 'Constant Value', description: 'Set a fixed value' },
    'expression': { label: 'Expression', description: 'Custom JavaScript expression' },
    'aggregate': { label: 'Aggregate', description: 'Sum, count, average, etc.' },
    'calculate': { label: 'Calculate', description: 'Mathematical calculation' }
  });

  const mappingTypes = getMappingTypes();

  // Get field type color
  const getFieldTypeColor = (type) => {
    const colors = {
      'string': '#3b82f6',
      'number': '#10b981',
      'boolean': '#f59e0b',
      'object': '#8b5cf6',
      'array': '#ef4444',
      'date': '#06b6d4'
    };
    return colors[type] || '#6b7280';
  };

  // Check if a parameter type supports multiple input sources
  const supportsMultipleFields = (paramType) => {
    return paramType === 'array' || paramType === 'object';
  };

  const isParameterMapped = (paramName) => {
    const mapping = configData.config?.parameter_mappings?.[paramName];
    if (!mapping) return false;
    
    switch (mapping.type) {
      case 'direct':
        return !!(mapping.source || (mapping.sources && mapping.sources.length > 0));
      case 'constant':
        return !!mapping.value;
      case 'expression':
        return !!mapping.expression;
      case 'aggregate':
        return !!(mapping.source && mapping.operation);
      case 'calculate':
        return !!(mapping.expression);
      default:
        return false;
    }
  };

  const getMappingSummary = (paramName) => {
    const mapping = configData.config?.parameter_mappings?.[paramName];
    if (!mapping) return '';
    
    switch (mapping.type) {
      case 'direct':
        if (mapping.sources && mapping.sources.length > 0) {
          return `← [${mapping.sources.join(', ')}]`;
        }
        return `← ${mapping.source}`;
      case 'constant':
        return `= "${mapping.value}"`;
      case 'expression':
        return `= ${mapping.expression}`;
      case 'aggregate':
        return `← ${mapping.source} (${mapping.operation})`;
      case 'calculate':
        return `= ${mapping.expression}`;
      default:
        return '';
    }
  };

  const openMappingDialog = (parameter) => {
    setSelectedParameter(parameter);
    const existingMapping = configData.config?.parameter_mappings?.[parameter.name] || {};
    
    // Initialize current mapping with existing values
    setCurrentMapping({
      type: existingMapping.type || 'direct',
      source: existingMapping.source || '',
      sources: existingMapping.sources || [],
      value: existingMapping.value || '',
      expression: existingMapping.expression || '',
      operation: existingMapping.operation || ''
    });
    
    setMappingDialogOpen(true);
  };

  const saveMapping = () => {
    if (!selectedParameter) return;

    let newMapping = {};
    
    switch (currentMapping.type) {
      case 'direct':
        if (supportsMultipleFields(selectedParameter.type)) {
          // Handle multi-select for array fields
          if (currentMapping.sources && currentMapping.sources.length > 0) {
            newMapping = {
              type: 'direct',
              sources: currentMapping.sources
            };
          }
        } else {
          // Handle single select
          if (currentMapping.source) {
            newMapping = {
              type: 'direct',
              source: currentMapping.source
            };
          }
        }
        break;
      case 'constant':
        if (currentMapping.value) {
          newMapping = {
            type: 'constant',
            value: currentMapping.value
          };
        }
        break;
      case 'expression':
        if (currentMapping.expression) {
          newMapping = {
            type: 'expression',
            expression: currentMapping.expression
          };
        }
        break;
      case 'aggregate':
        if (currentMapping.source && currentMapping.operation) {
          newMapping = {
            type: 'aggregate',
            source: currentMapping.source,
            operation: currentMapping.operation
          };
        }
        break;
      case 'calculate':
        if (currentMapping.expression) {
          newMapping = {
            type: 'calculate',
            expression: currentMapping.expression
          };
        }
        break;
      default:
        return;
    }

    if (Object.keys(newMapping).length > 0) {
      const updatedMappings = {
        ...configData.config?.parameter_mappings,
        [selectedParameter.name]: newMapping
      };
      
      onMappingsChange(updatedMappings);
    }

    setMappingDialogOpen(false);
    setSelectedParameter(null);
    setCurrentMapping({});
  };

  const removeMapping = (paramName) => {
    const updatedMappings = { ...configData.config?.parameter_mappings };
    delete updatedMappings[paramName];
    onMappingsChange(updatedMappings);
  };

  const getInputSchemaWithSources = () => {
    if (!inputSchema || inputSchema.length === 0) return [];
    
    return inputSchema.map(field => ({
      name: field.name,
      type: field.type || 'string',
      description: field.description || `Input field: ${field.name}`,
      source: field.source || 'input',
      sourceName: field.sourceName || 'Input Data'
    }));
  };

  const inputSchemaWithSources = getInputSchemaWithSources();

  // Convert mappings for AttributeMappingLines
  const convertedMappings = useMemo(() => {
    const converted = {};
    const mappings = configData.config?.parameter_mappings || {};
    
    Object.keys(mappings).forEach(paramName => {
      const mapping = mappings[paramName];
      if (mapping.type === 'direct' && mapping.source) {
        converted[paramName] = {
          type: mapping.type,
          sourceField: mapping.source
        };
      } else if (mapping.type === 'direct' && mapping.sources && mapping.sources.length > 0) {
        // Handle multi-select for array fields
        converted[paramName] = {
          type: mapping.type,
          sourceFields: mapping.sources // Use all sources for multiple visual lines
        };
      } else if (mapping.type === 'expression' && mapping.expression) {
        converted[paramName] = {
          type: mapping.type,
          expression: mapping.expression
        };
      } else if (mapping.type === 'constant' && mapping.value) {
        converted[paramName] = {
          type: mapping.type,
          value: mapping.value
        };
      } else if (mapping.type === 'aggregate' && mapping.source) {
        converted[paramName] = {
          type: mapping.type,
          sourceField: mapping.source
        };
      } else if (mapping.type === 'calculate' && mapping.expression) {
        converted[paramName] = {
          type: mapping.type,
          expression: mapping.expression
        };
      }
    });
    return converted;
  }, [configData.config?.parameter_mappings]);

  // Calculate mapping statistics
  const mappedParametersCount = scriptParameters.filter(param => isParameterMapped(param.name)).length;
  const unmappedParametersCount = scriptParameters.length - mappedParametersCount;

  // If no analytics script is selected, show a message
  if (!selectedAnalytics) {
    return (
      <Alert severity="info" sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
        Please select an analytics script to configure parameter mappings.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            borderRadius: 2,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AnalyticsIcon sx={{ fontSize: 24, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              Analytics Parameter Mapping
            </Typography>
            <Typography variant="body2" sx={{ color: '#888' }}>
              Map input data to analytics script parameters
            </Typography>
          </Box>
        </Box>
        
        <Tooltip title="Refresh schema">
          <IconButton
            size="small"
            onClick={onRefreshSchema}
            sx={{ 
              color: '#8b5cf6',
              '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.1)' }
            }}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Status Summary */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Chip 
          label={`${mappedParametersCount} mapped`}
          size="small"
          sx={{ bgcolor: '#10b981', color: 'white' }}
        />
        {unmappedParametersCount > 0 && (
          <Chip 
            label={`${unmappedParametersCount} unmapped`}
            size="small" 
            sx={{ bgcolor: '#f59e0b', color: 'white' }}
          />
        )}
      </Box>

      {/* Mapping Overview */}
      <Grid container spacing={2} sx={{ mb: 3, position: 'relative' }} ref={mappingContainerRef}>
        {/* Input Schema */}
        <Grid item xs={5}>
          <Card sx={{ bgcolor: '#2a2a2a', border: '1px solid #444', height: '400px' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ color: '#3b82f6', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <DataIcon sx={{ fontSize: 18 }} />
                Input Fields ({inputSchemaWithSources.length})
              </Typography>
              
              <Box sx={{ maxHeight: '320px', overflow: 'auto' }}>
                {inputSchemaWithSources.length === 0 ? (
                  <Alert severity="info" sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                    No input schema available. Connect a data source to see available fields.
                  </Alert>
                ) : (
                  <List dense>
                    {inputSchemaWithSources.map((field) => (
                      <ListItem 
                        key={field.name} 
                        sx={{ px: 0, py: 0.5 }}
                        data-input-field={field.name}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Box 
                            sx={{ 
                              width: 12, 
                              height: 12, 
                              borderRadius: '50%', 
                              bgcolor: getFieldTypeColor(field.type) 
                            }} 
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ color: 'white', fontFamily: 'monospace' }}>
                              {field.name}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" sx={{ color: '#888' }}>
                                {field.type} {field.description && `• ${field.description}`}
                              </Typography>
                            </Box>
                          }
                        />
                        {/* Connection handle for input fields */}
                        <Box 
                          sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            bgcolor: '#3b82f6',
                            border: '2px solid #1a1a1a',
                            ml: 'auto',
                            mr: 1,
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: '#60a5fa',
                              transform: 'scale(1.2)'
                            },
                            transition: 'all 0.2s ease'
                          }}
                          data-connection-handle={`input-${field.name}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Mapping Arrow */}
        <Grid item xs={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowIcon sx={{ fontSize: 32, color: '#8b5cf6' }} />
        </Grid>

        {/* Script Parameters */}
        <Grid item xs={5}>
          <Card sx={{ bgcolor: '#2a2a2a', border: '1px solid #444', height: '400px' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DataIcon sx={{ fontSize: 18 }} />
                  Script Parameters ({scriptParameters.length})
                </Typography>
              </Box>
              
              <Box sx={{ maxHeight: '320px', overflow: 'auto' }}>
                {scriptParameters.length === 0 ? (
                  <Alert severity="warning" sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    No parameters found in the selected analytics script.
                  </Alert>
                ) : (
                  <List dense>
                    {scriptParameters.map((parameter) => (
                      <ListItem 
                        key={parameter.name} 
                        sx={{ 
                          px: 0, 
                          py: 0.5,
                          bgcolor: isParameterMapped(parameter.name) ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                          borderRadius: 1,
                          mb: 0.5,
                          border: isParameterMapped(parameter.name) ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent'
                        }}
                        data-output-field={parameter.name}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {isParameterMapped(parameter.name) ? (
                            <CheckIcon sx={{ fontSize: 16, color: '#10b981' }} />
                          ) : (
                            <UnmappedIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                          )}
                        </ListItemIcon>
                        
                        {/* Connection handle for script parameters - positioned like AttributeMapper */}
                        <Box 
                          sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            bgcolor: '#10b981',
                            border: '2px solid #1a1a1a',
                            mr: 1,
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: '#34d399',
                              transform: 'scale(1.2)'
                            },
                            transition: 'all 0.2s ease'
                          }}
                          data-connection-handle={`output-${parameter.name}`}
                        />
                        
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ color: 'white', fontFamily: 'monospace' }}>
                                {parameter.name}
                              </Typography>
                              <Box 
                                sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  borderRadius: '50%', 
                                  bgcolor: getFieldTypeColor(parameter.type) 
                                }} 
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" sx={{ color: '#888' }}>
                                {parameter.type} • {parameter.description}
                              </Typography>
                              {isParameterMapped(parameter.name) && (
                                <Typography variant="caption" sx={{ color: '#10b981', display: 'block', mt: 0.5 }}>
                                  {getMappingSummary(parameter.name)}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => openMappingDialog(parameter)}
                            sx={{ color: '#8b5cf6' }}
                          >
                            {isParameterMapped(parameter.name) ? <EditIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                          
                          {isParameterMapped(parameter.name) && (
                            <Tooltip title="Remove mapping">
                              <IconButton
                                size="small"
                                onClick={() => removeMapping(parameter.name)}
                                sx={{ color: '#ef4444' }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Attribute Mapping Lines */}
        <AttributeMappingLines 
          mappings={convertedMappings}
          inputSchema={inputSchemaWithSources}
          outputSchema={scriptParameters}
          containerRef={mappingContainerRef}
        />
      </Grid>

      {/* Validation Alerts */}
      {unmappedParametersCount > 0 && (
        <Alert 
          severity="warning" 
          sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', mb: 2 }}
          icon={<WarningIcon />}
        >
          {unmappedParametersCount} parameter(s) are not mapped. 
          These parameters will use default values in the analytics script.
        </Alert>
      )}

      {/* Mapping Configuration Dialog */}
      <Dialog 
        open={mappingDialogOpen} 
        onClose={() => setMappingDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#1a1a1a', color: 'white' }
        }}
      >
        <DialogTitle sx={{ color: '#8b5cf6' }}>
          Configure Mapping: {selectedParameter?.name}
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            {/* Mapping Type Selection */}
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#888' }}>Mapping Type</InputLabel>
              <Select
                value={currentMapping.type || ''}
                onChange={(e) => setCurrentMapping(prev => ({ ...prev, type: e.target.value }))}
                label="Mapping Type"
                sx={{
                  bgcolor: '#2a2a2a',
                  '& fieldset': { borderColor: '#444' },
                  '&:hover fieldset': { borderColor: '#8b5cf6' },
                  '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                  '& .MuiSelect-select': { color: 'white' }
                }}
              >
                <MenuItem value="direct">Direct Copy</MenuItem>
                <MenuItem value="constant">Constant Value</MenuItem>
                <MenuItem value="expression">Expression</MenuItem>
                <MenuItem value="aggregate">Aggregate</MenuItem>
                <MenuItem value="calculate">Calculate</MenuItem>
              </Select>
            </FormControl>

            {/* Mapping Configuration Based on Type */}
            {currentMapping.type === 'direct' && (
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#888' }}>
                  {supportsMultipleFields(selectedParameter?.type) ? 'Source Fields' : 'Source Field'}
                </InputLabel>
                <Select
                  value={supportsMultipleFields(selectedParameter?.type) ? (currentMapping.sources || []) : (currentMapping.source || '')}
                  onChange={(e) => {
                    if (supportsMultipleFields(selectedParameter?.type)) {
                      setCurrentMapping(prev => ({ ...prev, sources: e.target.value }));
                    } else {
                      setCurrentMapping(prev => ({ ...prev, source: e.target.value }));
                    }
                  }}
                  multiple={supportsMultipleFields(selectedParameter?.type)}
                  label={supportsMultipleFields(selectedParameter?.type) ? 'Source Fields' : 'Source Field'}
                  renderValue={(selected) => {
                    if (supportsMultipleFields(selectedParameter?.type)) {
                      return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => (
                            <Chip 
                              key={value} 
                              label={value} 
                              size="small" 
                              sx={{ bgcolor: '#8b5cf6', color: 'white' }}
                            />
                          ))}
                        </Box>
                      );
                    }
                    return selected;
                  }}
                  sx={{
                    bgcolor: '#2a2a2a',
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#8b5cf6' },
                    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                    '& .MuiSelect-select': { color: 'white' }
                  }}
                >
                  {inputSchemaWithSources.map((field) => (
                    <MenuItem key={field.name} value={field.name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box 
                          sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            bgcolor: getFieldTypeColor(field.type) 
                          }} 
                        />
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {field.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#888' }}>
                          ({field.type})
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentMapping.type === 'constant' && (
              <Box>
                {selectedParameter?.type === 'boolean' ? (
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: '#888' }}>Constant Value</InputLabel>
                    <Select
                      value={typeof currentMapping.value === 'boolean' ? (currentMapping.value ? 'true' : 'false') : (currentMapping.value || '')}
                      onChange={(e) => setCurrentMapping(prev => ({ ...prev, value: e.target.value === 'true' }))}
                      label="Constant Value"
                      sx={{
                        bgcolor: '#2a2a2a',
                        '& fieldset': { borderColor: '#444' },
                        '&:hover fieldset': { borderColor: '#8b5cf6' },
                        '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                        '& .MuiSelect-select': { color: 'white' }
                      }}
                    >
                      <MenuItem value={'true'}>True</MenuItem>
                      <MenuItem value={'false'}>False</MenuItem>
                    </Select>
                  </FormControl>
                ) : (selectedParameter?.type === 'number' || selectedParameter?.type === 'integer') ? (
                  <TextField
                    fullWidth
                    type="number"
                    label="Constant Value"
                    value={currentMapping.value ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCurrentMapping(prev => ({ ...prev, value: v === '' ? '' : Number(v) }));
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#2a2a2a',
                        '& fieldset': { borderColor: '#444' },
                        '&:hover fieldset': { borderColor: '#8b5cf6' },
                        '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
                      },
                      '& .MuiInputLabel-root': { color: '#888' },
                      '& .MuiInputBase-input': { color: 'white' }
                    }}
                  />
                ) : (
                  <TextField
                    fullWidth
                    label="Constant Value"
                    value={currentMapping.value || ''}
                    onChange={(e) => setCurrentMapping(prev => ({ ...prev, value: e.target.value }))}
                    variant="outlined"
                    multiline
                    rows={3}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#2a2a2a',
                        '& fieldset': { borderColor: '#444' },
                        '&:hover fieldset': { borderColor: '#8b5cf6' },
                        '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
                      },
                      '& .MuiInputLabel-root': { color: '#888' },
                      '& .MuiInputBase-input': { color: 'white' }
                    }}
                  />
                )}
              </Box>
            )}

            {currentMapping.type === 'expression' && (
              <TextField
                fullWidth
                label="JavaScript Expression"
                value={currentMapping.expression || ''}
                onChange={(e) => setCurrentMapping(prev => ({ ...prev, expression: e.target.value }))}
                variant="outlined"
                multiline
                rows={3}
                placeholder="e.g., data.field1 + data.field2"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#2a2a2a',
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#8b5cf6' },
                    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
                  },
                  '& .MuiInputLabel-root': { color: '#888' },
                  '& .MuiInputBase-input': { color: 'white' }
                }}
              />
            )}

            {currentMapping.type === 'aggregate' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: '#888' }}>Source Field</InputLabel>
                  <Select
                    value={currentMapping.source || ''}
                    onChange={(e) => setCurrentMapping(prev => ({ ...prev, source: e.target.value }))}
                    label="Source Field"
                    sx={{
                      bgcolor: '#2a2a2a',
                      '& fieldset': { borderColor: '#444' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' },
                      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                      '& .MuiSelect-select': { color: 'white' }
                    }}
                  >
                    {inputSchemaWithSources.filter(field => field.type === 'number').map((field) => (
                      <MenuItem key={field.name} value={field.name}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box 
                            sx={{ 
                              width: 8, 
                              height: 8, 
                              borderRadius: '50%', 
                              bgcolor: getFieldTypeColor(field.type) 
                            }} 
                          />
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {field.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#888' }}>
                            ({field.type})
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl fullWidth>
                  <InputLabel sx={{ color: '#888' }}>Aggregation Operation</InputLabel>
                  <Select
                    value={currentMapping.operation || ''}
                    onChange={(e) => setCurrentMapping(prev => ({ ...prev, operation: e.target.value }))}
                    label="Aggregation Operation"
                    sx={{
                      bgcolor: '#2a2a2a',
                      '& fieldset': { borderColor: '#444' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' },
                      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                      '& .MuiSelect-select': { color: 'white' }
                    }}
                  >
                    <MenuItem value="sum">Sum</MenuItem>
                    <MenuItem value="average">Average</MenuItem>
                    <MenuItem value="count">Count</MenuItem>
                    <MenuItem value="min">Minimum</MenuItem>
                    <MenuItem value="max">Maximum</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}

            {currentMapping.type === 'calculate' && (
              <TextField
                fullWidth
                label="Mathematical Expression"
                value={currentMapping.expression || ''}
                onChange={(e) => setCurrentMapping(prev => ({ ...prev, expression: e.target.value }))}
                variant="outlined"
                multiline
                rows={3}
                placeholder="e.g., field1 * field2 / 100"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#2a2a2a',
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#8b5cf6' },
                    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
                  },
                  '& .MuiInputLabel-root': { color: '#888' },
                  '& .MuiInputBase-input': { color: 'white' }
                }}
              />
            )}

            {/* Preview */}
            <Box sx={{ p: 2, bgcolor: '#0a0a0a', borderRadius: 1, border: '1px solid #333' }}>
              <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
                Preview:
              </Typography>
              <Typography variant="body2" sx={{ color: '#10b981', fontFamily: 'monospace' }}>
                {selectedParameter?.name} = {getMappingSummary({ name: selectedParameter?.name, ...currentMapping }) || 'No mapping configured'}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setMappingDialogOpen(false)}
            sx={{ color: '#888' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={saveMapping}
            variant="contained"
            sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}
            disabled={
              (currentMapping.type === 'direct' && !currentMapping.source && (!currentMapping.sources || currentMapping.sources.length === 0)) ||
              (currentMapping.type === 'constant' && !currentMapping.value) ||
              (currentMapping.type === 'expression' && !currentMapping.expression) ||
              (currentMapping.type === 'aggregate' && (!currentMapping.source || !currentMapping.operation)) ||
              (currentMapping.type === 'calculate' && !currentMapping.expression)
            }
          >
            Save Mapping
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnalyticsMapper; 