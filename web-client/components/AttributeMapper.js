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
  Transform as TransformIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

import AttributeMappingLines from './AttributeMappingLines';

/**
 * AttributeMapper Component
 * 
 * Provides a visual interface for mapping input data attributes to output attributes.
 * Supports complex mappings including transformations, aggregations, and custom expressions.
 * 
 * Props:
 * - inputSchema: Array of input field definitions
 * - outputSchema: Array of output field definitions (can be user-defined)
 * - mappings: Current attribute mappings object
 * - onMappingsChange: Callback when mappings are updated
 * - allowSchemaEditing: Whether users can modify output schema
 * - nodeType: Type of node for context-specific mapping options
 */
const AttributeMapper = ({
  inputSchema = [],
  outputSchema = [],
  mappings = {},
  onMappingsChange,
  onRefreshSchema,
  allowSchemaEditing = true,
  nodeType = 'transform',
  title = "Attribute Mapping",
  alwaysShowAddButton = false
}) => {
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedOutputField, setSelectedOutputField] = useState(null);
  const [currentMapping, setCurrentMapping] = useState({});
  const [newFieldDialogOpen, setNewFieldDialogOpen] = useState(false);
  const [newField, setNewField] = useState({ name: '', type: 'string', description: '' });
  const [editingOutputSchema, setEditingOutputSchema] = useState(outputSchema);
  
  // Ref for the mapping container to enable visual connection lines
  const mappingContainerRef = useRef(null);

  // Initialize editing schema
  useEffect(() => {
    console.log('🔍 AttributeMapper: Received outputSchema', outputSchema);
    setEditingOutputSchema(outputSchema);
  }, [outputSchema]);

  // Mapping types available based on node type
  const getMappingTypes = (nodeType) => {
    const baseTypes = {
      'direct': { label: 'Direct Copy', description: 'Copy input field directly' },
      'constant': { label: 'Constant Value', description: 'Set a fixed value' },
      'expression': { label: 'Expression', description: 'Custom JavaScript expression' },
      'concatenate': { label: 'Concatenate', description: 'Join two fields together' },
      'split': { label: 'Split', description: 'Split one field into multiple outputs' }
    };

    const nodeSpecificTypes = {
      'analytics': {
        ...baseTypes,
        'aggregate': { label: 'Aggregate', description: 'Sum, count, average, etc.' },
        'calculate': { label: 'Calculate', description: 'Mathematical calculation' }
      },
      'transform': {
        ...baseTypes,
        'format': { label: 'Format', description: 'Apply formatting rules' }
      },
      'api': {
        ...baseTypes,
        'lookup': { label: 'API Parameter', description: 'Use field as API request parameter' }
      }
    };

    return nodeSpecificTypes[nodeType] || baseTypes;
  };

  const mappingTypes = getMappingTypes(nodeType);

  // Get field type color
  const getFieldTypeColor = (type) => {
    const colors = {
      'string': '#3b82f6',
      'number': '#10b981',
      'boolean': '#f59e0b',
      'date': '#8b5cf6',
      'object': '#ef4444',
      'array': '#6366f1'
    };
    return colors[type] || '#6b7280';
  };

  // Check if a field is mapped
  const isFieldMapped = (fieldName) => {
    return mappings.hasOwnProperty(fieldName);
  };

  // Get mapping summary for display
  const getMappingSummary = (fieldName) => {
    const mapping = mappings[fieldName];
    if (!mapping) return null;

    switch (mapping.type) {
      case 'direct':
        return `← ${mapping.sourceField}`;
      case 'constant':
        return `= "${mapping.value}"`;
      case 'expression':
        return `expr: ${mapping.expression?.substring(0, 20)}...`;
      case 'aggregate':
        return `${mapping.function}(${mapping.sourceField})`;
      case 'concatenate':
        return `join(${mapping.sourceField1} + ${mapping.sourceField2})`;
      case 'split':
        return `split(${mapping.sourceField} on "${mapping.splitOn}")`;
      default:
        return mapping.type;
    }
  };

  // Open mapping dialog for a field
  const openMappingDialog = (outputField) => {
    setSelectedOutputField(outputField);
    setCurrentMapping(mappings[outputField.name] || {
      type: 'direct',
      sourceField: '',
      sourceField1: '',
      sourceField2: '',
      value: '',
      expression: '',
      function: 'sum',
      splitOn: '',
      separator: ''
    });
    setMappingDialogOpen(true);
  };

  // Save mapping
  const saveMapping = () => {
    const updatedMappings = {
      ...mappings,
      [selectedOutputField.name]: currentMapping
    };
    onMappingsChange(updatedMappings);
    setMappingDialogOpen(false);
    setSelectedOutputField(null);
  };

  // Remove mapping
  const removeMapping = (fieldName) => {
    const updatedMappings = { ...mappings };
    delete updatedMappings[fieldName];
    onMappingsChange(updatedMappings);
  };

  // Add new output field
  const addNewField = () => {
    if (!newField.name.trim()) return;
    
    const updatedSchema = [
      ...editingOutputSchema,
      {
        name: newField.name,
        type: newField.type,
        description: newField.description,
        required: false,
        userDefined: true
      }
    ];
    
    setEditingOutputSchema(updatedSchema);
    setNewField({ name: '', type: 'string', description: '' });
    setNewFieldDialogOpen(false);
    
    // Notify parent of schema change if callback exists
    if (onMappingsChange) {
      onMappingsChange(mappings, updatedSchema);
    }
  };

  // Remove output field (only user-defined ones)
  const removeOutputField = (fieldName) => {
    const updatedSchema = editingOutputSchema.filter(field => field.name !== fieldName);
    setEditingOutputSchema(updatedSchema);
    
    // Also remove any mappings for this field
    const updatedMappings = { ...mappings };
    delete updatedMappings[fieldName];
    
    if (onMappingsChange) {
      onMappingsChange(updatedMappings, updatedSchema);
    }
  };

  // Get unmapped fields count
  const unmappedFieldsCount = editingOutputSchema.filter(field => !isFieldMapped(field.name)).length;
  const mappedFieldsCount = editingOutputSchema.filter(field => isFieldMapped(field.name)).length;

  // Get input schema with data source information
  const getInputSchemaWithSources = () => {
    if (!inputSchema || inputSchema.length === 0) return [];
    
    // If inputSchema already has source information, use it
    if (inputSchema[0] && inputSchema[0].source) {
      return inputSchema;
    }
    
    // Otherwise, assume all fields come from a single source
    return inputSchema.map(field => ({
      ...field,
      source: 'data_input_1',
      sourceName: 'Data Source 1'
    }));
  };

  const inputSchemaWithSources = getInputSchemaWithSources();
  
  // Get unique data sources
  const dataSources = [...new Set(inputSchemaWithSources.map(field => field.source))];
  const dataSourceNames = [...new Set(inputSchemaWithSources.map(field => field.sourceName))];

  // Parse expression to find referenced fields
  const parseExpressionFields = (expression) => {
    if (!expression) return [];
    
    const fieldPattern = /(?:row|source\d+)\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const matches = [...expression.matchAll(fieldPattern)];
    return matches.map(match => match[1]);
  };

  // Validate expression fields exist in schema
  const validateExpressionFields = (expression) => {
    const referencedFields = parseExpressionFields(expression);
    const availableFields = inputSchemaWithSources.map(field => field.name);
    const missingFields = referencedFields.filter(field => !availableFields.includes(field));
    
    return {
      isValid: missingFields.length === 0,
      missingFields,
      referencedFields
    };
  };

  // Get expression validation for current mapping
  const expressionValidation = currentMapping.type === 'expression' ? 
    validateExpressionFields(currentMapping.expression) : 
    { isValid: true, missingFields: [], referencedFields: [] };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 1 }}>
            <MappingIcon sx={{ fontSize: 20 }} />
            {title}
          </Typography>
          
          {/* Refresh Schema Button */}
          <Tooltip title="Refresh input schema from connected nodes">
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip 
            label={`${mappedFieldsCount} mapped`}
            size="small"
            sx={{ bgcolor: '#10b981', color: 'white' }}
          />
          {unmappedFieldsCount > 0 && (
            <Chip 
              label={`${unmappedFieldsCount} unmapped`}
              size="small" 
              sx={{ bgcolor: '#f59e0b', color: 'white' }}
            />
          )}
        </Box>
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
                              {dataSources.length > 1 && (
                                <Typography variant="caption" sx={{ color: '#3b82f6', display: 'block' }}>
                                  Source: {field.sourceName || field.source}
                                </Typography>
                              )}
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

        {/* Output Schema */}
        <Grid item xs={5}>
          <Card sx={{ bgcolor: '#2a2a2a', border: '1px solid #444', height: '400px' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DataIcon sx={{ fontSize: 18 }} />
                  Output Fields ({editingOutputSchema.length})
                </Typography>
                
                {allowSchemaEditing && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setNewFieldDialogOpen(true)}
                    sx={{ color: '#10b981', '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' } }}
                  >
                    Add Field
                  </Button>
                )}
              </Box>
              
              <Box sx={{ maxHeight: '320px', overflow: 'auto' }}>
                {editingOutputSchema.length === 0 ? (
                  <Alert severity="warning" sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    No output fields defined. Add fields to map your data structure.
                  </Alert>
                ) : (
                  <List dense>
                    {editingOutputSchema.map((field) => (
                      <ListItem 
                        key={field.name} 
                        sx={{ 
                          px: 0, 
                          py: 0.5,
                          bgcolor: isFieldMapped(field.name) ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                          borderRadius: 1,
                          mb: 0.5,
                          border: isFieldMapped(field.name) ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent'
                        }}
                        data-output-field={field.name}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {isFieldMapped(field.name) ? (
                            <CheckIcon sx={{ fontSize: 16, color: '#10b981' }} />
                          ) : (
                            <UnmappedIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                          )}
                        </ListItemIcon>
                        
                        {/* Connection handle for output fields - positioned on the left near the checkbox */}
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
                          data-connection-handle={`output-${field.name}`}
                        />
                        
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ color: 'white', fontFamily: 'monospace' }}>
                                {field.name}
                              </Typography>
                              <Box 
                                sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  borderRadius: '50%', 
                                  bgcolor: getFieldTypeColor(field.type) 
                                }} 
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
                                {field.type} {field.description && `• ${field.description}`}
                              </Typography>
                              {isFieldMapped(field.name) && (
                                <Typography variant="caption" sx={{ color: '#10b981', fontStyle: 'italic' }}>
                                  {getMappingSummary(field.name)}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => openMappingDialog(field)}
                            sx={{ color: '#8b5cf6' }}
                          >
                            {isFieldMapped(field.name) ? <EditIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                          
                          {isFieldMapped(field.name) && (
                            <IconButton
                              size="small"
                              onClick={() => removeMapping(field.name)}
                              sx={{ color: '#ef4444' }}
                            >
                              <DeleteIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          )}
                          
                          {field.userDefined && allowSchemaEditing && (
                            <IconButton
                              size="small"
                              onClick={() => removeOutputField(field.name)}
                              sx={{ color: '#6b7280' }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
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
          mappings={mappings}
          inputSchema={inputSchemaWithSources}
          outputSchema={editingOutputSchema}
          containerRef={mappingContainerRef}
        />
      </Grid>

      {/* Validation Alerts */}
      {unmappedFieldsCount > 0 && (
        <Alert 
          severity="warning" 
          sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', mb: 2 }}
          icon={<WarningIcon />}
        >
        {unmappedFieldsCount} output field(s) are not mapped. 
                                  These fields will be empty in the output.
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
          Configure Mapping: {selectedOutputField?.name}
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            {/* Mapping Type Selection */}
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#888' }}>Mapping Type</InputLabel>
              <Select
                value={currentMapping.type}
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
                {Object.entries(mappingTypes).map(([type, config]) => (
                  <MenuItem key={type} value={type}>
                    <Box>
                      <Typography variant="body2">{config.label}</Typography>
                      <Typography variant="caption" sx={{ color: '#888' }}>
                        {config.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Mapping Configuration based on type */}
            {currentMapping.type === 'direct' && (
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#888' }}>Source Field</InputLabel>
                <Select
                  value={currentMapping.sourceField || ''}
                  onChange={(e) => setCurrentMapping(prev => ({ ...prev, sourceField: e.target.value }))}
                  label="Source Field"
                  sx={{
                    bgcolor: '#2a2a2a',
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
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
              <TextField
                label="Constant Value"
                value={currentMapping.value || ''}
                onChange={(e) => setCurrentMapping(prev => ({ ...prev, value: e.target.value }))}
                fullWidth
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
                placeholder="Enter a constant value"
              />
            )}

            {currentMapping.type === 'expression' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="JavaScript Expression"
                  value={currentMapping.expression || ''}
                  onChange={(e) => setCurrentMapping(prev => ({ ...prev, expression: e.target.value }))}
                  fullWidth
                  multiline
                  rows={3}
                  error={!expressionValidation.isValid}
                  helperText={
                    !expressionValidation.isValid 
                      ? `Missing fields: ${expressionValidation.missingFields.join(', ')}`
                      : dataSources.length > 1 
                        ? `Use 'source1.fieldName', 'source2.fieldName', etc. to reference different data sources`
                        : "Use 'row.fieldName' to reference input data"
                  }
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#2a2a2a',
                      '& fieldset': { borderColor: '#444' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' },
                      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                      fontFamily: 'monospace'
                    },
                    '& .MuiInputLabel-root': { color: '#888' },
                    '& .MuiInputBase-input': { color: 'white', fontFamily: 'monospace' }
                  }}
                  placeholder={dataSources.length > 1 ? 
                    "e.g., source1.givenName + ' ' + source2.surName" : 
                    "e.g., row.givenName + ' ' + row.surName"
                  }
                />
                
                {expressionValidation.referencedFields.length > 0 && (
                  <Box sx={{ p: 2, bgcolor: '#0a0a0a', borderRadius: 1, border: '1px solid #333' }}>
                    <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
                      Referenced Fields:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {expressionValidation.referencedFields.map(field => (
                        <Chip
                          key={field}
                          label={field}
                          size="small"
                          sx={{
                            bgcolor: inputSchemaWithSources.some(f => f.name === field) ? '#10b981' : '#ef4444',
                            color: 'white',
                            fontSize: '0.75rem'
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {currentMapping.type === 'aggregate' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel sx={{ color: '#888' }}>Function</InputLabel>
                  <Select
                    value={currentMapping.function || 'sum'}
                    onChange={(e) => setCurrentMapping(prev => ({ ...prev, function: e.target.value }))}
                    label="Function"
                    sx={{
                      bgcolor: '#2a2a2a',
                      '& fieldset': { borderColor: '#444' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' },
                      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                      '& .MuiSelect-select': { color: 'white' }
                    }}
                  >
                    <MenuItem value="sum">Sum</MenuItem>
                    <MenuItem value="count">Count</MenuItem>
                    <MenuItem value="avg">Average</MenuItem>
                    <MenuItem value="min">Minimum</MenuItem>
                    <MenuItem value="max">Maximum</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel sx={{ color: '#888' }}>Source Field</InputLabel>
                  <Select
                    value={currentMapping.sourceField || ''}
                    onChange={(e) => setCurrentMapping(prev => ({ ...prev, sourceField: e.target.value }))}
                    label="Source Field"
                    sx={{
                      bgcolor: '#2a2a2a',
                      '& fieldset': { borderColor: '#444' },
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                      '& .MuiSelect-select': { color: 'white' }
                    }}
                  >
                    {inputSchemaWithSources.filter(field => ['number', 'integer', 'float'].includes(field.type)).map((field) => (
                      <MenuItem key={field.name} value={field.name}>
                        {field.name} ({field.type})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            {currentMapping.type === 'concatenate' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel sx={{ color: '#888' }}>Source Field 1</InputLabel>
                    <Select
                      value={currentMapping.sourceField1 || ''}
                      onChange={(e) => setCurrentMapping(prev => ({ ...prev, sourceField1: e.target.value }))}
                      label="Source Field 1"
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
                  
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel sx={{ color: '#888' }}>Source Field 2</InputLabel>
                    <Select
                      value={currentMapping.sourceField2 || ''}
                      onChange={(e) => setCurrentMapping(prev => ({ ...prev, sourceField2: e.target.value }))}
                      label="Source Field 2"
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
                </Box>
                
                <TextField
                  label="Separator (Optional)"
                  value={currentMapping.separator || ''}
                  onChange={(e) => setCurrentMapping(prev => ({ ...prev, separator: e.target.value }))}
                  fullWidth
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
                  placeholder="e.g., ' ' (space) or ', ' (comma space)"
                  helperText="Character(s) to insert between concatenated values"
                />
              </Box>
            )}

            {currentMapping.type === 'split' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: '#888' }}>Source Field</InputLabel>
                  <Select
                    value={currentMapping.sourceField || ''}
                    onChange={(e) => setCurrentMapping(prev => ({ ...prev, sourceField: e.target.value }))}
                    label="Source Field"
                    sx={{
                      bgcolor: '#2a2a2a',
                      '& fieldset': { borderColor: '#444' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' },
                      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                      '& .MuiSelect-select': { color: 'white' }
                    }}
                  >
                    {inputSchemaWithSources.filter(field => field.type === 'string').map((field) => (
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
                
                <TextField
                  label="Split Character/Expression"
                  value={currentMapping.splitOn || ''}
                  onChange={(e) => setCurrentMapping(prev => ({ ...prev, splitOn: e.target.value }))}
                  fullWidth
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
                  placeholder="e.g., ' ' (space) or ',' (comma)"
                  helperText="Character or expression to split the field on"
                />
                
                <Alert severity="info" sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                  Split will create multiple output fields. You can map each part to different output fields using direct mappings.
                </Alert>
              </Box>
            )}

            {/* Preview */}
            <Box sx={{ p: 2, bgcolor: '#0a0a0a', borderRadius: 1, border: '1px solid #333' }}>
              <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
                Preview:
              </Typography>
              <Typography variant="body2" sx={{ color: '#10b981', fontFamily: 'monospace' }}>
                {selectedOutputField?.name} = {getMappingSummary({ name: selectedOutputField?.name, ...currentMapping }) || 'No mapping configured'}
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
              (currentMapping.type === 'direct' && !currentMapping.sourceField) ||
              (currentMapping.type === 'constant' && !currentMapping.value) ||
              (currentMapping.type === 'expression' && (!currentMapping.expression || !expressionValidation.isValid)) ||
              (currentMapping.type === 'aggregate' && (!currentMapping.sourceField || !currentMapping.function)) ||
              (currentMapping.type === 'concatenate' && (!currentMapping.sourceField1 || !currentMapping.sourceField2)) ||
              (currentMapping.type === 'split' && (!currentMapping.sourceField || !currentMapping.splitOn))
            }
          >
            Save Mapping
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Field Dialog */}
      <Dialog 
        open={newFieldDialogOpen} 
        onClose={() => setNewFieldDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#1a1a1a', color: 'white' }
        }}
      >
        <DialogTitle sx={{ color: '#10b981' }}>
          Add {nodeType === 'api' ? 'Request Body' : 'Output'} Field
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Field Name"
              value={newField.name}
              onChange={(e) => setNewField(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#2a2a2a',
                  '& fieldset': { borderColor: '#444' },
                  '&:hover fieldset': { borderColor: '#10b981' },
                  '&.Mui-focused fieldset': { borderColor: '#10b981' }
                },
                '& .MuiInputLabel-root': { color: '#888' },
                '& .MuiInputBase-input': { color: 'white' }
              }}
              placeholder="e.g., fullName, totalAmount"
            />
            
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#888' }}>Data Type</InputLabel>
              <Select
                value={newField.type}
                onChange={(e) => setNewField(prev => ({ ...prev, type: e.target.value }))}
                label="Data Type"
                sx={{
                  bgcolor: '#2a2a2a',
                  '& fieldset': { borderColor: '#444' },
                  '&:hover fieldset': { borderColor: '#10b981' },
                  '&.Mui-focused fieldset': { borderColor: '#10b981' },
                  '& .MuiSelect-select': { color: 'white' }
                }}
              >
                <MenuItem value="string">String</MenuItem>
                <MenuItem value="number">Number</MenuItem>
                <MenuItem value="boolean">Boolean</MenuItem>
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="object">Object</MenuItem>
                <MenuItem value="array">Array</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Description (Optional)"
              value={newField.description}
              onChange={(e) => setNewField(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#2a2a2a',
                  '& fieldset': { borderColor: '#444' },
                  '&:hover fieldset': { borderColor: '#10b981' },
                  '&.Mui-focused fieldset': { borderColor: '#10b981' }
                },
                '& .MuiInputLabel-root': { color: '#888' },
                '& .MuiInputBase-input': { color: 'white' }
              }}
              placeholder="Brief description of this field"
            />
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setNewFieldDialogOpen(false)}
            sx={{ color: '#888' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={addNewField}
            variant="contained"
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
            disabled={!newField.name.trim()}
          >
            Add {nodeType === 'api' ? 'Body' : ''} Field
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttributeMapper;