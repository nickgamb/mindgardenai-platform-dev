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
  Visibility as VisibilityIcon,
  Image as ImageIcon,
  ShowChart as ChartIcon,
  Animation as AnimationIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

import AttributeMappingLines from './AttributeMappingLines';

const VisualPreviewMapper = ({ 
  inputSchema = [], 
  outputSchema = [], 
  mappings = {}, 
  onMappingsChange,
  onRefreshSchema,
  nodeType = "visual_preview"
}) => {
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedOutputField, setSelectedOutputField] = useState(null);
  const [mappingType, setMappingType] = useState('direct');
  const [selectedSourceField, setSelectedSourceField] = useState('');
  const [constantValue, setConstantValue] = useState('');
  const [expressionValue, setExpressionValue] = useState('');
  const [previewType, setPreviewType] = useState('plot');
  const [previewName, setPreviewName] = useState('Visual Preview');
  const [previewData, setPreviewData] = useState(null);
  
  // Ref for the mapping container to enable visual connection lines
  const mappingContainerRef = useRef(null);

  // Visual preview types
  const visualTypes = [
    { value: 'plot', label: 'Plot/Chart', icon: <ChartIcon /> },
    { value: 'image', label: 'Image', icon: <ImageIcon /> },
    { value: 'gif', label: 'GIF Animation', icon: <AnimationIcon /> },
    { value: 'svg', label: 'SVG', icon: <VisibilityIcon /> },
    { value: 'dashboard', label: 'Dashboard', icon: <VisibilityIcon /> },
    { value: 'heatmap', label: 'Heatmap', icon: <ChartIcon /> },
    { value: 'waveform', label: 'Waveform', icon: <ChartIcon /> }
  ];

  // Get visual type display info
  const getVisualTypeInfo = (type) => {
    return visualTypes.find(t => t.value === type) || visualTypes[0];
  };

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

  // Check if field supports multiple input sources
  const supportsMultipleFields = (fieldType) => {
    return fieldType === 'array' || fieldType === 'object';
  };

  // Handle mapping creation/update
  const handleMappingSave = () => {
    if (!selectedOutputField) return;

    let newMapping = {};
    
    switch (mappingType) {
      case 'direct':
        if (selectedSourceField) {
          // Handle multi-select for array/object fields
          if (Array.isArray(selectedSourceField)) {
            newMapping = {
              type: 'direct',
              sources: selectedSourceField
            };
          } else {
            newMapping = {
              type: 'direct',
              source: selectedSourceField
            };
          }
        }
        break;
      case 'constant':
        if (constantValue) {
          newMapping = {
            type: 'constant',
            value: constantValue
          };
        }
        break;
      case 'expression':
        if (expressionValue) {
          newMapping = {
            type: 'expression',
            expression: expressionValue
          };
        }
        break;
      default:
        return;
    }

    if (Object.keys(newMapping).length > 0) {
      const updatedMappings = {
        ...mappings,
        [selectedOutputField.name]: newMapping
      };
      onMappingsChange(updatedMappings);
    }

    setMappingDialogOpen(false);
    resetMappingDialog();
  };

  const resetMappingDialog = () => {
    setSelectedOutputField(null);
    setMappingType('direct');
    setSelectedSourceField('');
    setConstantValue('');
    setExpressionValue('');
  };

  const handleMappingDelete = (fieldName) => {
    const updatedMappings = { ...mappings };
    delete updatedMappings[fieldName];
    onMappingsChange(updatedMappings);
  };

  const handlePreviewTypeChange = (newType) => {
    setPreviewType(newType);
    // Update output schema based on visual type
    const newOutputSchema = [{
      name: 'visual_content',
      type: newType === 'image' || newType === 'gif' ? 'string' : 'object',
      description: `Content for ${getVisualTypeInfo(newType).label}`,
      required: true
    }];
    
    // Update the output schema through the parent component
    if (onRefreshSchema) {
      onRefreshSchema(newOutputSchema);
    }
  };

  const handlePreviewNameChange = (newName) => {
    setPreviewName(newName);
  };

  const getMappingStatus = (fieldName) => {
    const mapping = mappings[fieldName];
    if (!mapping) return 'unmapped';
    
    switch (mapping.type) {
      case 'direct':
        return mapping.source ? 'mapped' : 'unmapped';
      case 'constant':
        return mapping.value ? 'mapped' : 'unmapped';
      case 'expression':
        return mapping.expression ? 'mapped' : 'unmapped';
      default:
        return 'unmapped';
    }
  };

  const getMappingDisplayText = (fieldName) => {
    const mapping = mappings[fieldName];
    if (!mapping) return 'No mapping';
    
    switch (mapping.type) {
      case 'direct':
        return `← ${mapping.source}`;
      case 'constant':
        return `= "${mapping.value}"`;
      case 'expression':
        return `= ${mapping.expression}`;
      default:
        return 'Invalid mapping';
    }
  };

  const openMappingDialog = (field) => {
    setSelectedOutputField(field);
    const existingMapping = mappings[field.name];
    if (existingMapping) {
      setMappingType(existingMapping.type);
      if (existingMapping.type === 'direct') {
        // Handle multi-select for existing mappings
        if (existingMapping.sources) {
          setSelectedSourceField(existingMapping.sources);
        } else {
          setSelectedSourceField(existingMapping.source);
        }
      } else if (existingMapping.type === 'constant') {
        setConstantValue(existingMapping.value);
      } else if (existingMapping.type === 'expression') {
        setExpressionValue(existingMapping.expression);
      }
    }
    setMappingDialogOpen(true);
  };

  // Convert mappings for AttributeMappingLines
  const convertedMappings = useMemo(() => {
    const converted = {};
    Object.keys(mappings).forEach(fieldName => {
      const mapping = mappings[fieldName];
      if (mapping.type === 'direct' && (mapping.source || mapping.sources)) {
        if (mapping.sources && Array.isArray(mapping.sources)) {
          // Multi-select mapping
          converted[fieldName] = {
            type: mapping.type,
            sourceFields: mapping.sources // Use all sources for multiple visual lines
          };
        } else {
          // Single source mapping
          converted[fieldName] = {
            type: mapping.type,
            sourceField: mapping.source
          };
        }
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
      }
    });
    return converted;
  }, [mappings]);

  // Calculate mapping statistics
  const mappedFieldsCount = outputSchema.filter(field => getMappingStatus(field.name) === 'mapped').length;
  const unmappedFieldsCount = outputSchema.length - mappedFieldsCount;

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            background: 'linear-gradient(135deg, #d946ef 0%, #c026d3 100%)',
            borderRadius: 2,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <VisibilityIcon sx={{ fontSize: 24, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              Visual Preview Configuration
            </Typography>
            <Typography variant="body2" sx={{ color: '#888' }}>
              Map input data to visual content for display
            </Typography>
          </Box>
        </Box>
        
        <Tooltip title="Refresh schema">
          <IconButton
            size="small"
            onClick={onRefreshSchema}
            sx={{ 
              color: '#d946ef',
              '&:hover': { bgcolor: 'rgba(217, 70, 239, 0.1)' }
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

      {/* Visual Type Configuration */}
      <Card sx={{ mb: 3, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ color: 'white', mb: 2, fontWeight: 600 }}>
            Visual Configuration
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="outlined" sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#1a1a1a',
                  '& fieldset': { borderColor: '#444' },
                  '&:hover fieldset': { borderColor: '#d946ef' },
                  '&.Mui-focused fieldset': { borderColor: '#d946ef' },
                },
                '& .MuiInputLabel-root': { color: '#888' },
                '& .MuiInputBase-input': { color: 'white' },
              }}>
                <InputLabel>Visual Type</InputLabel>
                <Select
                  value={previewType}
                  onChange={(e) => handlePreviewTypeChange(e.target.value)}
                  label="Visual Type"
                >
                  {visualTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {type.icon}
                        {type.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Preview Name"
                value={previewName}
                onChange={(e) => handlePreviewNameChange(e.target.value)}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#1a1a1a',
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#d946ef' },
                    '&.Mui-focused fieldset': { borderColor: '#d946ef' },
                  },
                  '& .MuiInputLabel-root': { color: '#888' },
                  '& .MuiInputBase-input': { color: 'white' },
                }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Preview Box */}
      <Card sx={{ mb: 3, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ color: 'white', mb: 2, fontWeight: 600 }}>
            Preview
          </Typography>
          
          <Box sx={{
            minHeight: 200,
            border: '2px dashed #444',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#1a1a1a',
            position: 'relative'
          }}>
            {previewData ? (
              <Box sx={{ textAlign: 'center' }}>
                <img 
                  src={previewData} 
                  alt="Visual Preview" 
                  style={{ maxWidth: '100%', maxHeight: '180px' }}
                />
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', color: '#888' }}>
                <VisibilityIcon sx={{ fontSize: 48, mb: 1 }} />
                <Typography variant="body2">
                  {getVisualTypeInfo(previewType).label} Preview
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Visual will render here when flow runs
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Mapping Overview */}
      <Grid container spacing={2} sx={{ mb: 3, position: 'relative' }} ref={mappingContainerRef}>
        {/* Input Schema */}
        <Grid item xs={5}>
          <Card sx={{ bgcolor: '#2a2a2a', border: '1px solid #444', height: '400px' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ color: '#3b82f6', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <DataIcon sx={{ fontSize: 18 }} />
                Input Fields ({inputSchema.length})
              </Typography>
              
              <Box sx={{ maxHeight: '320px', overflow: 'auto' }}>
                {inputSchema.length === 0 ? (
                  <Alert severity="info" sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                    No input schema available. Connect a data source to see available fields.
                  </Alert>
                ) : (
                  <List dense>
                    {inputSchema.map((field) => (
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

        {/* Output Schema */}
        <Grid item xs={5}>
          <Card sx={{ bgcolor: '#2a2a2a', border: '1px solid #444', height: '400px' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DataIcon sx={{ fontSize: 18 }} />
                  Visual Content ({outputSchema.length})
                </Typography>
              </Box>
              
              <Box sx={{ maxHeight: '320px', overflow: 'auto' }}>
                {outputSchema.length === 0 ? (
                  <Alert severity="warning" sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    No visual content fields defined.
                  </Alert>
                ) : (
                  <List dense>
                    {outputSchema.map((field) => {
                      const mappingStatus = getMappingStatus(field.name);
                      const mappingText = getMappingDisplayText(field.name);
                      
                      return (
                        <ListItem 
                          key={field.name} 
                          sx={{ 
                            px: 0, 
                            py: 0.5,
                            bgcolor: mappingStatus === 'mapped' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            borderRadius: 1,
                            mb: 0.5,
                            border: mappingStatus === 'mapped' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent'
                          }}
                          data-output-field={field.name}
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {mappingStatus === 'mapped' ? (
                              <CheckIcon sx={{ fontSize: 16, color: '#10b981' }} />
                            ) : (
                              <UnmappedIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                            )}
                          </ListItemIcon>
                          
                          {/* Connection handle for output fields - positioned like AttributeMapper */}
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
                                  {field.type} • {field.description}
                                </Typography>
                                {mappingStatus === 'mapped' && (
                                  <Typography variant="caption" sx={{ color: '#10b981', display: 'block', mt: 0.5 }}>
                                    {mappingText}
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
                              {mappingStatus === 'mapped' ? <EditIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                            
                            {mappingStatus === 'mapped' && (
                              <Tooltip title="Remove mapping">
                                <IconButton
                                  size="small"
                                  onClick={() => handleMappingDelete(field.name)}
                                  sx={{ color: '#ef4444' }}
                                >
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Attribute Mapping Lines */}
        <AttributeMappingLines 
          mappings={convertedMappings}
          inputSchema={inputSchema}
          outputSchema={outputSchema}
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
          {unmappedFieldsCount} visual content field(s) are not mapped. 
          These fields will be empty in the visual preview.
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
                value={mappingType}
                onChange={(e) => setMappingType(e.target.value)}
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
              </Select>
            </FormControl>

            {/* Mapping Configuration Based on Type */}
            {mappingType === 'direct' && (
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#888' }}>
                  {supportsMultipleFields(selectedOutputField?.type) ? 'Source Fields' : 'Source Field'}
                </InputLabel>
                <Select
                  value={selectedSourceField}
                  onChange={(e) => setSelectedSourceField(e.target.value)}
                  label={supportsMultipleFields(selectedOutputField?.type) ? 'Source Fields' : 'Source Field'}
                  multiple={supportsMultipleFields(selectedOutputField?.type)}
                  renderValue={(selected) => {
                    if (Array.isArray(selected)) {
                      return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => {
                            const field = inputSchema.find(f => f.name === value);
                            return (
                              <Chip
                                key={value}
                                label={value}
                                size="small"
                                sx={{
                                  bgcolor: '#8b5cf6',
                                  color: 'white',
                                  '& .MuiChip-deleteIcon': { color: 'white' }
                                }}
                                onDelete={() => {
                                  const newSelected = selected.filter(item => item !== value);
                                  setSelectedSourceField(newSelected);
                                }}
                              />
                            );
                          })}
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
                  {inputSchema.map((field) => (
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

            {mappingType === 'constant' && (
              <TextField
                fullWidth
                label="Constant Value"
                value={constantValue}
                onChange={(e) => setConstantValue(e.target.value)}
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

            {mappingType === 'expression' && (
              <TextField
                fullWidth
                label="JavaScript Expression"
                value={expressionValue}
                onChange={(e) => setExpressionValue(e.target.value)}
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

            {/* Preview */}
            <Box sx={{ p: 2, bgcolor: '#0a0a0a', borderRadius: 1, border: '1px solid #333' }}>
              <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
                Preview:
              </Typography>
              <Typography variant="body2" sx={{ color: '#10b981', fontFamily: 'monospace' }}>
                {selectedOutputField?.name} = {
                  mappingType === 'direct' && selectedSourceField ? `← ${selectedSourceField}` :
                  mappingType === 'constant' && constantValue ? `= "${constantValue}"` :
                  mappingType === 'expression' && expressionValue ? `= ${expressionValue}` :
                  'No mapping configured'
                }
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
            onClick={handleMappingSave}
            variant="contained"
            sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}
            disabled={
              (mappingType === 'direct' && !selectedSourceField) ||
              (mappingType === 'direct' && Array.isArray(selectedSourceField) && selectedSourceField.length === 0) ||
              (mappingType === 'constant' && !constantValue) ||
              (mappingType === 'expression' && !expressionValue)
            }
          >
            Save Mapping
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VisualPreviewMapper; 