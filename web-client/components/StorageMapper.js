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
  Paper,
  Checkbox,
  FormControlLabel
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
  Refresh as RefreshIcon,
  Storage as StorageIcon
} from '@mui/icons-material';

import AttributeMappingLines from './AttributeMappingLines';

/**
 * StorageMapper Component
 * 
 * Provides a visual interface for mapping input data attributes to storage database schema.
 * Storage nodes have 2 data inputs and 1 data output. The mapper maps from either input to the database.
 * 
 * Props:
 * - inputSchema: Array of input field definitions (from both data inputs)
 * - databaseSchema: Array of database field definitions
 * - mappings: Current attribute mappings object
 * - onMappingsChange: Callback when mappings are updated
 * - onRefreshSchema: Callback to refresh input schema
 */
const StorageMapper = ({
  inputSchema = [],
  databaseSchema = [],
  mappings = {},
  onMappingsChange,
  onRefreshSchema
}) => {
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedDatabaseField, setSelectedDatabaseField] = useState(null);
  const [currentMapping, setCurrentMapping] = useState({});
  const [newFieldDialogOpen, setNewFieldDialogOpen] = useState(false);
  const [newField, setNewField] = useState({ name: '', type: 'string', description: '' });
  const [editingDatabaseSchema, setEditingDatabaseSchema] = useState(databaseSchema);
  
  // Ref for the mapping container to enable visual connection lines
  const mappingContainerRef = useRef(null);

  // Initialize editing schema - preserve user-defined fields
  useEffect(() => {
    console.log('🔍 StorageMapper: Received databaseSchema', databaseSchema);
    console.log('🔍 StorageMapper: Received mappings', mappings);
    
    // If databaseSchema is empty but we have mappings, create fields from mappings
    if (databaseSchema.length === 0 && Object.keys(mappings).length > 0) {
      const fieldsFromMappings = Object.keys(mappings).map(fieldName => ({
        name: fieldName,
        type: 'string', // Default type for mapped fields
        description: `Field mapped from input data`,
        userDefined: true
      }));
      setEditingDatabaseSchema(fieldsFromMappings);
      return;
    }
    
    // Check if the incoming databaseSchema already contain user-defined fields
    const incomingUserDefinedFields = databaseSchema.filter(field => field.userDefined);
    
    if (incomingUserDefinedFields.length > 0) {
      // If incoming data has user-defined fields, use them and merge with new schema fields
      const newSchemaFields = databaseSchema.filter(field => !field.userDefined);
      setEditingDatabaseSchema([...incomingUserDefinedFields, ...newSchemaFields]);
    } else if (editingDatabaseSchema.length > 0) {
      // If we have existing user-defined fields in local state, preserve them
      const userDefinedFields = editingDatabaseSchema.filter(field => field.userDefined);
      const newFields = databaseSchema.filter(field => !userDefinedFields.some(udf => udf.name === field.name));
      setEditingDatabaseSchema([...userDefinedFields, ...newFields]);
    } else {
      // First time initialization
      setEditingDatabaseSchema(databaseSchema);
    }
  }, [databaseSchema, mappings]);

  // Mapping types available for storage mapping
  const getMappingTypes = () => ({
    'direct': { label: 'Direct Copy', description: 'Copy input field directly' },
    'constant': { label: 'Constant Value', description: 'Set a fixed value' },
    'expression': { label: 'Expression', description: 'Custom JavaScript expression' },
    'concatenate': { label: 'Concatenate', description: 'Join two fields together' },
    'split': { label: 'Split', description: 'Split one field into multiple outputs' }
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

  // Convert mappings for AttributeMappingLines
  const convertedMappings = useMemo(() => {
    const converted = {};
    Object.keys(mappings).forEach(fieldName => {
      const mapping = mappings[fieldName];
      if (mapping.type === 'direct' && mapping.source) {
        converted[fieldName] = {
          type: mapping.type,
          sourceField: mapping.source
        };
      } else if (mapping.type === 'direct' && mapping.sources && mapping.sources.length > 0) {
        // Handle multi-select for array fields
        converted[fieldName] = {
          type: mapping.type,
          sourceFields: mapping.sources // Use all sources for multiple visual lines
        };
      } else if (mapping.type === 'expression' && mapping.expression) {
        converted[fieldName] = {
          type: mapping.type,
          expression: mapping.expression
        };
      } else if (mapping.type === 'constant' && mapping.value) {
        converted[fieldName] = {
          type: mapping.type,
          value: mapping.value
        };
      } else if (mapping.type === 'concatenate' && mapping.sources) {
        converted[fieldName] = {
          type: mapping.type,
          sourceField1: mapping.sources[0],
          sourceField2: mapping.sources[1]
        };
      } else if (mapping.type === 'split' && mapping.source) {
        converted[fieldName] = {
          type: mapping.type,
          sourceField: mapping.source
        };
      }
    });
    return converted;
  }, [mappings]);

  const isFieldMapped = (fieldName) => {
    const mapping = mappings[fieldName];
    if (!mapping) return false;
    
    switch (mapping.type) {
      case 'direct':
        return !!(mapping.source || (mapping.sources && mapping.sources.length > 0));
      case 'constant':
        return !!mapping.value;
      case 'expression':
        return !!mapping.expression;
      case 'concatenate':
        return !!(mapping.sources && mapping.sources.length >= 2);
      case 'split':
        return !!(mapping.source && mapping.splitOn);
      default:
        return false;
    }
  };

  const getMappingSummary = (fieldName) => {
    const mapping = mappings[fieldName];
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
      case 'concatenate':
        return `← ${mapping.sources?.join(' + ') || ''}`;
      case 'split':
        return `← ${mapping.source} (split on "${mapping.splitOn}")`;
      default:
        return '';
    }
  };

  const openMappingDialog = (databaseField) => {
    setSelectedDatabaseField(databaseField);
    const existingMapping = mappings[databaseField.name] || {};
    
    // Initialize current mapping with existing values
    setCurrentMapping({
      type: existingMapping.type || 'direct',
      source: existingMapping.source || '',
      sources: existingMapping.sources || [],
      value: existingMapping.value || '',
      expression: existingMapping.expression || '',
      separator: existingMapping.separator || '',
      splitOn: existingMapping.splitOn || ''
    });
    
    setMappingDialogOpen(true);
  };

  const saveMapping = () => {
    if (!selectedDatabaseField) return;

    let newMapping = {};
    
    switch (currentMapping.type) {
      case 'direct':
        if (supportsMultipleFields(selectedDatabaseField.type)) {
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
      case 'concatenate':
        if (currentMapping.sources && currentMapping.sources.length >= 2) {
          newMapping = {
            type: 'concatenate',
            sources: currentMapping.sources,
            separator: currentMapping.separator || ''
          };
        }
        break;
      case 'split':
        if (currentMapping.source && currentMapping.splitOn) {
          newMapping = {
            type: 'split',
            source: currentMapping.source,
            splitOn: currentMapping.splitOn
          };
        }
        break;
      default:
        return;
    }

    if (Object.keys(newMapping).length > 0) {
      const updatedMappings = {
        ...mappings,
        [selectedDatabaseField.name]: newMapping
      };
      onMappingsChange(updatedMappings);
    }

    setMappingDialogOpen(false);
    setSelectedDatabaseField(null);
    setCurrentMapping({});
  };

  const removeMapping = (fieldName) => {
    const updatedMappings = { ...mappings };
    delete updatedMappings[fieldName];
    onMappingsChange(updatedMappings);
  };

  const addNewField = () => {
    if (newField.name && newField.type) {
      const updatedSchema = [...editingDatabaseSchema, { ...newField, userDefined: true }];
      setEditingDatabaseSchema(updatedSchema);
      
      // Update the parent component with the new schema
      if (onRefreshSchema) {
        onRefreshSchema(updatedSchema);
      }
      
      setNewField({ name: '', type: 'string', description: '' });
      setNewFieldDialogOpen(false);
    }
  };

  // Check if a field type supports multiple input sources
  const supportsMultipleFields = (fieldType) => {
    return fieldType === 'array' || fieldType === 'object';
  };

  const removeDatabaseField = (fieldName) => {
    const updatedSchema = editingDatabaseSchema.filter(field => field.name !== fieldName);
    setEditingDatabaseSchema(updatedSchema);
    
    // Also remove any mappings for this field
    const updatedMappings = { ...mappings };
    delete updatedMappings[fieldName];
    onMappingsChange(updatedMappings);
  };

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

  // Calculate mapping statistics
  const mappedFieldsCount = editingDatabaseSchema.filter(field => isFieldMapped(field.name)).length;
  const unmappedFieldsCount = editingDatabaseSchema.length - mappedFieldsCount;

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
            borderRadius: 2,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <StorageIcon sx={{ fontSize: 24, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              Storage Database Mapping
            </Typography>
            <Typography variant="body2" sx={{ color: '#888' }}>
              Map input data to database schema
            </Typography>
          </Box>
        </Box>
        
        <Tooltip title="Refresh schema">
          <IconButton
            size="small"
            onClick={onRefreshSchema}
            sx={{ 
              color: '#06b6d4',
              '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.1)' }
            }}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Status Summary */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
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

        {/* Database Schema */}
        <Grid item xs={5}>
          <Card sx={{ bgcolor: '#2a2a2a', border: '1px solid #444', height: '400px' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DataIcon sx={{ fontSize: 18 }} />
                  Database Fields ({editingDatabaseSchema.length})
                </Typography>
                
                <IconButton
                  size="small"
                  onClick={() => setNewFieldDialogOpen(true)}
                  sx={{ color: '#10b981', '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' } }}
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              
              <Box sx={{ maxHeight: '320px', overflow: 'auto' }}>
                {editingDatabaseSchema.length === 0 ? (
                  <Alert severity="warning" sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    No database fields defined. Add fields to map your data to the storage database.
                  </Alert>
                ) : (
                  <List dense>
                    {editingDatabaseSchema.map((field) => (
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
                        
                        {/* Connection handle for database fields - positioned like AttributeMapper */}
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
                              <Typography variant="caption" sx={{ color: '#888' }}>
                                {field.type} • Database
                              </Typography>
                              {isFieldMapped(field.name) && (
                                <Typography variant="caption" sx={{ color: '#10b981', display: 'block', mt: 0.5 }}>
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
                            <Tooltip title="Remove mapping">
                              <IconButton
                                size="small"
                                onClick={() => removeMapping(field.name)}
                                sx={{ color: '#ef4444' }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {field.userDefined && (
                            <IconButton
                              size="small"
                              onClick={() => removeDatabaseField(field.name)}
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
          mappings={convertedMappings}
          inputSchema={inputSchemaWithSources}
          outputSchema={editingDatabaseSchema}
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
          {unmappedFieldsCount} database field(s) are not mapped. 
          These fields will be empty in the database.
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
          Configure Mapping: {selectedDatabaseField?.name}
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
                <MenuItem value="concatenate">Concatenate</MenuItem>
                <MenuItem value="split">Split</MenuItem>
              </Select>
            </FormControl>

            {/* Mapping Configuration Based on Type */}
            {currentMapping.type === 'direct' && (
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#888' }}>
                  {supportsMultipleFields(selectedDatabaseField?.type) ? 'Source Fields (Multi-select)' : 'Source Field'}
                </InputLabel>
                <Select
                  value={supportsMultipleFields(selectedDatabaseField?.type) ? (currentMapping.sources || []) : (currentMapping.source || '')}
                  onChange={(e) => {
                    if (supportsMultipleFields(selectedDatabaseField?.type)) {
                      // Handle multi-select for array fields - e.target.value is already the full array
                      setCurrentMapping(prev => ({ ...prev, sources: e.target.value }));
                    } else {
                      // Handle single select
                      setCurrentMapping(prev => ({ ...prev, source: e.target.value }));
                    }
                  }}
                  multiple={supportsMultipleFields(selectedDatabaseField?.type)}
                  label={supportsMultipleFields(selectedDatabaseField?.type) ? 'Source Fields (Multi-select)' : 'Source Field'}
                  sx={{
                    bgcolor: '#2a2a2a',
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#8b5cf6' },
                    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                    '& .MuiSelect-select': { color: 'white' }
                  }}
                  renderValue={(selected) => {
                    if (supportsMultipleFields(selectedDatabaseField?.type)) {
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

            {currentMapping.type === 'concatenate' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel sx={{ color: '#888' }}>Source Field 1</InputLabel>
                  <Select
                    value={currentMapping.sources?.[0] || ''}
                    onChange={(e) => setCurrentMapping(prev => ({ 
                      ...prev, 
                      sources: [e.target.value, prev.sources?.[1] || '']
                    }))}
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
                    value={currentMapping.sources?.[1] || ''}
                    onChange={(e) => setCurrentMapping(prev => ({ 
                      ...prev, 
                      sources: [prev.sources?.[0] || '', e.target.value]
                    }))}
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
                {selectedDatabaseField?.name} = {getMappingSummary({ name: selectedDatabaseField?.name, ...currentMapping }) || 'No mapping configured'}
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
              (currentMapping.type === 'concatenate' && (!currentMapping.sources?.[0] || !currentMapping.sources?.[1])) ||
              (currentMapping.type === 'split' && (!currentMapping.source || !currentMapping.splitOn))
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
          Add Database Field
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
            />
            
            <FormControl fullWidth>
              <InputLabel>Field Type</InputLabel>
              <Select
                value={newField.type}
                onChange={(e) => setNewField(prev => ({ ...prev, type: e.target.value }))}
                label="Field Type"
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
                <MenuItem value="object">Object</MenuItem>
                <MenuItem value="array">Array</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Description (Optional)"
              value={newField.description}
              onChange={(e) => setNewField(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
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
            disabled={!newField.name || !newField.type}
          >
            Add Field
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StorageMapper; 