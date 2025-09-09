import React, { useState, useMemo, useRef } from 'react';
import {
  Box, Typography, Chip, List, ListItem, Divider, Card, CardContent,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Accordion, AccordionSummary, AccordionDetails, Grid,
  Paper, IconButton, Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Functions as FunctionsIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Extension as ExtensionIcon,
  Code as CodeIcon,
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import AttributeMappingLines from './AttributeMappingLines';
import AttributeMapper from './AttributeMapper';

const PluginsParameterMapper = ({ 
  configData, 
  setConfigData, 
  functionParameters = [],
  selectedPlugin,
  selectedFunction,
  inputSchema = [],
  onRefreshSchema
}) => {
  // If no plugin/function is selected, fall back to default AttributeMapper
  if (!selectedPlugin || !selectedFunction || !configData.config?.plugin_name || !configData.config?.function_name) {
    return (
      <AttributeMapper
        inputSchema={inputSchema}
        outputSchema={inputSchema} // Default to input schema for output when no function
        mappings={configData.config?.attribute_mappings || configData.config?.mappings || {}}
        onMappingsChange={(newMappings, newOutputSchema) => {
          setConfigData(prev => ({
            ...prev,
            config: {
              ...prev.config,
              attribute_mappings: newMappings,
              mappings: newMappings, // Keep both for compatibility
              output_schema: newOutputSchema || prev.config?.output_schema
            }
          }));
        }}
        onRefreshSchema={onRefreshSchema}
        allowSchemaEditing={true}
        nodeType="plugins"
        title="Plugin Parameter Mapping"
      />
    );
  }

  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [currentMapping, setCurrentMapping] = useState({});
  
  // Ref for the mapping container to enable visual connection lines
  const mappingContainerRef = useRef(null);

  // Get input schema with sources (like AttributeMapper)
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

  const supportsMultipleFields = (paramType) => {
    return paramType === 'array' || paramType === 'object';
  };

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
      } else if (mapping.type === 'concatenate' && mapping.sources) {
        converted[paramName] = {
          type: mapping.type,
          sourceField1: mapping.sources[0],
          sourceField2: mapping.sources[1]
        };
      } else if (mapping.type === 'split' && mapping.source) {
        converted[paramName] = {
          type: mapping.type,
          sourceField: mapping.source
        };
      }
    });
    return converted;
  }, [configData.config?.parameter_mappings]);

  const isParameterMapped = (paramName) => {
    const mapping = configData.config?.parameter_mappings?.[paramName];
    if (!mapping) return false;
    
    if (mapping.type === 'direct') {
      return !!(mapping.source || (mapping.sources && mapping.sources.length > 0));
    }
    if (mapping.type === 'expression') {
      return !!mapping.expression;
    }
    if (mapping.type === 'constant') {
      return mapping.value !== undefined && mapping.value !== '';
    }
    if (mapping.type === 'concatenate') {
      return !!(mapping.sources && mapping.sources.length >= 2);
    }
    if (mapping.type === 'split') {
      return !!mapping.source;
    }
    
    return false;
  };

  // Calculate mapping statistics
  const mappedParametersCount = functionParameters.filter(param => isParameterMapped(param.name)).length;
  const unmappedParametersCount = functionParameters.length - mappedParametersCount;

  // If no function is selected, show a message
  if (!selectedFunction || !functionParameters || functionParameters.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <ExtensionIcon sx={{ fontSize: 64, color: '#666', mb: 2 }} />
        <Typography variant="h6" sx={{ color: '#666', mb: 1 }}>
          No Plugin Function Selected
        </Typography>
        <Typography variant="body2" sx={{ color: '#999' }}>
          Select a plugin and function to configure parameter mappings
        </Typography>
      </Box>
    );
  }

  const handleParameterClick = (parameter) => {
    const existing = configData.config?.parameter_mappings?.[parameter.name] || {};
    setSelectedParameter(parameter);
    setCurrentMapping({
      type: existing.type || 'direct',
      source: existing.source || '',
      sources: existing.sources || [],
      expression: existing.expression || '',
      value: existing.value || '',
      separator: existing.separator || '',
      splitOn: existing.splitOn || '',
      userFieldHints: existing.userFieldHints || { idField: '', displayNameField: '', emailField: '' }
    });
    setMappingDialogOpen(true);
  };

  const handleMappingTypeChange = (newType) => {
    setCurrentMapping({
      type: newType,
      source: '',
      sources: [],
      expression: '',
      value: '',
      separator: '',
      splitOn: '',
      userFieldHints: { idField: '', displayNameField: '', emailField: '' }
    });
  };

  const handleMappingSourceChange = (field) => {
    if (supportsMultipleFields(selectedParameter?.type)) {
      const sources = currentMapping.sources || [];
      if (sources.includes(field)) {
        setCurrentMapping(prev => ({
          ...prev,
          sources: sources.filter(s => s !== field)
        }));
      } else {
        setCurrentMapping(prev => ({
          ...prev,
          sources: [...sources, field]
        }));
      }
    } else {
      setCurrentMapping(prev => ({
        ...prev,
        source: field
      }));
    }
  };

  const handleSaveMapping = () => {
    if (!selectedParameter) return;
    let mappingToSave = {};

    if (currentMapping.type === 'direct') {
      if (supportsMultipleFields(selectedParameter.type)) {
        if (currentMapping.sources && currentMapping.sources.length > 0) {
          mappingToSave = { type: 'direct', sources: currentMapping.sources };
        }
      } else if (currentMapping.source) {
        mappingToSave = { type: 'direct', source: currentMapping.source };
      }
      // If mapping application_object, include userFieldHints to guide server-side local_users synthesis
      if (selectedParameter?.name === 'application_object') {
        mappingToSave.userFieldHints = currentMapping.userFieldHints || { idField: '', displayNameField: '', emailField: '' };
      }
    } else if (currentMapping.type === 'constant' && currentMapping.value !== undefined) {
      mappingToSave = { type: 'constant', value: currentMapping.value };
    } else if (currentMapping.type === 'expression' && currentMapping.expression) {
      mappingToSave = { type: 'expression', expression: currentMapping.expression };
    } else if (currentMapping.type === 'concatenate' && currentMapping.sources && currentMapping.sources.length >= 2) {
      mappingToSave = { type: 'concatenate', sources: currentMapping.sources, separator: currentMapping.separator || '' };
    } else if (currentMapping.type === 'split' && currentMapping.source && currentMapping.splitOn) {
      mappingToSave = { type: 'split', source: currentMapping.source, splitOn: currentMapping.splitOn };
    }

    if (Object.keys(mappingToSave).length === 0) {
      setMappingDialogOpen(false);
      return;
    }

    const newMappings = {
      ...configData.config?.parameter_mappings,
      [selectedParameter.name]: mappingToSave
    };

    setConfigData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        parameter_mappings: newMappings
      }
    }));

    setMappingDialogOpen(false);
    setSelectedParameter(null);
    setCurrentMapping({});
  };

  const handleDeleteMapping = (parameterName) => {
    const newMappings = { ...configData.config?.parameter_mappings };
    delete newMappings[parameterName];
    
    setConfigData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        parameter_mappings: newMappings
      }
    }));
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <ExtensionIcon sx={{ color: '#8b5cf6' }} />
        <Typography variant="h6" sx={{ color: '#ffffff', flex: 1 }}>
          Plugin Parameter Mapping
        </Typography>
        <Chip 
          label={`${mappedParametersCount}/${functionParameters.length} mapped`}
          color={mappedParametersCount === functionParameters.length ? 'success' : 'default'}
          size="small"
        />
      </Box>

      {/* Plugin Function Info */}
      <Card sx={{ mb: 3, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <FunctionsIcon sx={{ color: '#8b5cf6' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ color: '#ffffff' }}>
                {selectedPlugin?.name} - {selectedFunction?.name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#999' }}>
                {selectedFunction?.description || 'SDK function'}
              </Typography>
            </Box>
          </Box>
          {selectedFunction?.parameters && selectedFunction.parameters.length > 0 && (
            <Typography variant="body2" sx={{ color: '#999' }}>
              {selectedFunction.parameters.length} parameter(s) available for mapping
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Mapping Container with Visual Lines */}
      <Box 
        ref={mappingContainerRef}
        sx={{ 
          position: 'relative',
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 3,
          mb: 3
        }}
      >
                 {/* Input Schema Panel */}
        <Paper sx={{ p: 2, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
          <Typography variant="subtitle2" sx={{ color: '#ffffff', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssignmentIcon sx={{ fontSize: 16 }} />
            Input Data Fields
            <IconButton 
              size="small" 
              onClick={onRefreshSchema}
              sx={{ color: '#8b5cf6', ml: 'auto' }}
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Typography>
          <List dense>
            {inputSchemaWithSources.map((field, index) => (
              <ListItem 
                 key={`${field.source}-${field.name}-${index}`}
                 data-field-name={field.name}
                 sx={{ 
                   p: 1, 
                   border: '1px solid #333',
                   borderRadius: 1,
                   mb: 1,
                   bgcolor: '#1a1a1a',
                   cursor: 'pointer',
                   position: 'relative',
                   '&:hover': {
                     bgcolor: '#333'
                   }
                 }}
               >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 4 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: getFieldTypeColor(field.type),
                      flexShrink: 0
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                      {field.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999' }}>
                      {field.type} • {field.sourceName}
                    </Typography>
                  </Box>
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
                </Box>
              </ListItem>
            ))}
            {inputSchemaWithSources.length === 0 && (
              <Typography variant="body2" sx={{ color: '#666', textAlign: 'center', py: 2 }}>
                No input data fields available
              </Typography>
            )}
          </List>
        </Paper>

                 {/* Function Parameters Panel */}
        <Paper sx={{ p: 2, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
          <Typography variant="subtitle2" sx={{ color: '#ffffff', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CodeIcon sx={{ fontSize: 16 }} />
            Function Parameters
            <Chip 
              label={`${mappedParametersCount}/${functionParameters.length}`}
              size="small"
              sx={{ 
                ml: 'auto',
                bgcolor: mappedParametersCount === functionParameters.length ? '#22c55e' : '#666',
                color: 'white',
                fontSize: '0.7rem'
              }}
            />
          </Typography>
          <List dense>
            {functionParameters.map((param, index) => (
              <ListItem 
                key={`param-${param.name}-${index}`}
                data-field-name={param.name}
                sx={{ 
                  p: 1, 
                  border: isParameterMapped(param.name) ? '1px solid #22c55e' : '1px solid #333',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: isParameterMapped(param.name) ? '#1a2e1a' : '#1a1a1a',
                  '&:hover': {
                    bgcolor: isParameterMapped(param.name) ? '#2a3e2a' : '#333'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isParameterMapped(param.name) ? (
                      <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                    ) : (
                      <ErrorIcon sx={{ fontSize: 16, color: param.required ? '#ef4444' : '#6b7280' }} />
                    )}
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: getFieldTypeColor(param.type),
                        flexShrink: 0
                      }}
                    />
                  </Box>
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
                    data-connection-handle={`output-${param.name}`}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                      {param.name}{param.required && <span style={{ color: '#ef4444' }}> *</span>}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999', display: 'block' }}>
                      {param.type} • {param.description || 'Plugin Parameter'}
                    </Typography>
                    {isParameterMapped(param.name) && (
                      <Typography variant="caption" sx={{ color: '#10b981', display: 'block', mt: 0.5 }}>
                        {/* simple summary like storage */}
                        {/* for direct sources list */}
                        {(() => {
                          const mapping = configData.config?.parameter_mappings?.[param.name];
                          if (!mapping) return null;
                          if (mapping.type === 'direct') {
                            if (mapping.sources && mapping.sources.length > 0) return `
											
← [${mapping.sources.join(', ')}]`;
                            return `← ${mapping.source}`;
                          }
                          if (mapping.type === 'constant') return `= "${mapping.value}"`;
                          if (mapping.type === 'expression') return `= ${mapping.expression}`;
                          if (mapping.type === 'concatenate') return `← ${mapping.sources?.join(' + ') || ''}`;
                          if (mapping.type === 'split') return `← ${mapping.source}`;
                          return null;
                        })()}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleParameterClick(param)}
                      sx={{ color: '#8b5cf6' }}
                    >
                      {isParameterMapped(param.name) ? <EditIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                    {isParameterMapped(param.name) && (
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteMapping(param.name)}
                        sx={{ color: '#ef4444' }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Visual Mapping Lines */}
        <AttributeMappingLines 
          mappings={convertedMappings}
          inputSchema={inputSchemaWithSources}
          outputSchema={functionParameters}
          containerRef={mappingContainerRef}
        />
      </Box>

      {/* Mapping Dialog */}
      <Dialog 
        open={mappingDialogOpen} 
        onClose={() => setMappingDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            color: '#ffffff'
          }
        }}
      >
        <DialogTitle>
          Map Parameter: {selectedParameter?.name}
        </DialogTitle>
        <DialogContent>
          {selectedParameter && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 2, color: '#999' }}>
                Parameter Type: {selectedParameter.type}
                {selectedParameter.required && ' (Required)'}
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Mapping Type</InputLabel>
                <Select
                  value={currentMapping.type || 'direct'}
                  onChange={(e) => handleMappingTypeChange(e.target.value)}
                >
                  <MenuItem value="direct">Direct Field Mapping</MenuItem>
                  <MenuItem value="constant">Constant Value</MenuItem>
                  <MenuItem value="expression">Expression</MenuItem>
                  <MenuItem value="concatenate">Concatenate</MenuItem>
                  <MenuItem value="split">Split</MenuItem>
                </Select>
              </FormControl>

              {currentMapping.type === 'direct' && (
                <FormControl fullWidth>
                  <InputLabel sx={{ color: '#888' }}>
                    {supportsMultipleFields(selectedParameter?.type) ? 'Source Fields (Multi-select)' : 'Source Field'}
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
                    label={supportsMultipleFields(selectedParameter?.type) ? 'Source Fields (Multi-select)' : 'Source Field'}
                    sx={{
                      bgcolor: '#2a2a2a',
                      '& fieldset': { borderColor: '#444' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' },
                      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                      '& .MuiSelect-select': { color: 'white' }
                    }}
                    renderValue={(selected) => {
                      if (supportsMultipleFields(selectedParameter?.type)) {
                        return (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                              <Chip key={value} label={value} size="small" sx={{ bgcolor: '#8b5cf6', color: 'white' }} />
                            ))}
                          </Box>
                        );
                      }
                      return selected;
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

              {/* User Field Hints for application_object direct mapping */}
              {currentMapping.type === 'direct' && selectedParameter?.name === 'application_object' && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: '#ccc', mb: 1 }}>
                    User field mapping (optional)
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel sx={{ color: '#888' }}>User ID Field</InputLabel>
                        <Select
                          value={currentMapping.userFieldHints?.idField || ''}
                          label="User ID Field"
                          onChange={(e) => setCurrentMapping(prev => ({ ...prev, userFieldHints: { ...(prev.userFieldHints || {}), idField: e.target.value } }))}
                          sx={{
                            bgcolor: '#2a2a2a',
                            '& fieldset': { borderColor: '#444' },
                            '&:hover fieldset': { borderColor: '#8b5cf6' },
                            '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                            '& .MuiSelect-select': { color: 'white' }
                          }}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          {inputSchemaWithSources.map((field) => (
                            <MenuItem key={`id-${field.name}`} value={field.name}>{field.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel sx={{ color: '#888' }}>Display Name Field</InputLabel>
                        <Select
                          value={currentMapping.userFieldHints?.displayNameField || ''}
                          label="Display Name Field"
                          onChange={(e) => setCurrentMapping(prev => ({ ...prev, userFieldHints: { ...(prev.userFieldHints || {}), displayNameField: e.target.value } }))}
                          sx={{
                            bgcolor: '#2a2a2a',
                            '& fieldset': { borderColor: '#444' },
                            '&:hover fieldset': { borderColor: '#8b5cf6' },
                            '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                            '& .MuiSelect-select': { color: 'white' }
                          }}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          {inputSchemaWithSources.map((field) => (
                            <MenuItem key={`dn-${field.name}`} value={field.name}>{field.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel sx={{ color: '#888' }}>Email Field</InputLabel>
                        <Select
                          value={currentMapping.userFieldHints?.emailField || ''}
                          label="Email Field"
                          onChange={(e) => setCurrentMapping(prev => ({ ...prev, userFieldHints: { ...(prev.userFieldHints || {}), emailField: e.target.value } }))}
                          sx={{
                            bgcolor: '#2a2a2a',
                            '& fieldset': { borderColor: '#444' },
                            '&:hover fieldset': { borderColor: '#8b5cf6' },
                            '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                            '& .MuiSelect-select': { color: 'white' }
                          }}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          {inputSchemaWithSources.map((field) => (
                            <MenuItem key={`em-${field.name}`} value={field.name}>{field.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {currentMapping.type === 'constant' && (
                <Box sx={{ mb: 2 }}>
                  {selectedParameter?.type === 'boolean' ? (
                    <FormControl fullWidth>
                      <InputLabel>Constant Value</InputLabel>
                      <Select
                        value={typeof currentMapping.value === 'boolean' ? (currentMapping.value ? 'true' : 'false') : (currentMapping.value || '')}
                        onChange={(e) => setCurrentMapping(prev => ({ ...prev, value: e.target.value === 'true' }))}
                        label="Constant Value"
                      >
                        <MenuItem value={'true'}>True</MenuItem>
                        <MenuItem value={'false'}>False</MenuItem>
                      </Select>
                    </FormControl>
                  ) : selectedParameter?.type === 'number' || selectedParameter?.type === 'integer' ? (
                    <TextField
                      fullWidth
                      type="number"
                      label="Constant Value"
                      value={currentMapping.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCurrentMapping(prev => ({ ...prev, value: v === '' ? '' : Number(v) }));
                      }}
                      inputProps={{ step: selectedParameter?.type === 'integer' ? 1 : 'any' }}
                    />
                  ) : (
                    <TextField
                      fullWidth
                      label="Constant Value"
                      value={currentMapping.value || ''}
                      onChange={(e) => setCurrentMapping(prev => ({ ...prev, value: e.target.value }))}
                    />
                  )}
                </Box>
              )}

              {currentMapping.type === 'expression' && (
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Expression"
                  value={currentMapping.expression || ''}
                  onChange={(e) => setCurrentMapping(prev => ({ ...prev, expression: e.target.value }))}
                  placeholder="e.g., row.field1 + ' - ' + row.field2"
                  sx={{ mb: 2 }}
                />
              )}

              {currentMapping.type === 'concatenate' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControl>
                    <InputLabel>Source Field 1</InputLabel>
                    <Select
                      value={currentMapping.sources?.[0] || ''}
                      onChange={(e) => setCurrentMapping(prev => ({ ...prev, sources: [e.target.value, prev.sources?.[1] || ''] }))}
                    >
                      {inputSchemaWithSources.map((field) => (
                        <MenuItem key={field.name} value={field.name}>{field.name} ({field.type})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <InputLabel>Source Field 2</InputLabel>
                    <Select
                      value={currentMapping.sources?.[1] || ''}
                      onChange={(e) => setCurrentMapping(prev => ({ ...prev, sources: [prev.sources?.[0] || '', e.target.value] }))}
                    >
                      {inputSchemaWithSources.map((field) => (
                        <MenuItem key={field.name} value={field.name}>{field.name} ({field.type})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Separator (Optional)"
                    value={currentMapping.separator || ''}
                    onChange={(e) => setCurrentMapping(prev => ({ ...prev, separator: e.target.value }))}
                  />
                </Box>
              )}

              {currentMapping.type === 'split' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControl>
                    <InputLabel>Source Field</InputLabel>
                    <Select
                      value={currentMapping.source || ''}
                      onChange={(e) => setCurrentMapping(prev => ({ ...prev, source: e.target.value }))}
                    >
                      {inputSchemaWithSources.filter(f => f.type === 'string').map((field) => (
                        <MenuItem key={field.name} value={field.name}>{field.name} ({field.type})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Split Character/Expression"
                    value={currentMapping.splitOn || ''}
                    onChange={(e) => setCurrentMapping(prev => ({ ...prev, splitOn: e.target.value }))}
                    placeholder="," />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveMapping} variant="contained">
            Save Mapping
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PluginsParameterMapper;
