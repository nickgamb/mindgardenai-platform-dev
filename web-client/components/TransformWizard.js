import React, { useState } from 'react';
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
  Menu,
  ListItemIcon,
  ListItemText,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TransformIcon from '@mui/icons-material/Transform';
import CodeIcon from '@mui/icons-material/Code';
import TemplateIcon from '@mui/icons-material/Description';
import JavaScriptEditor from './JavaScriptEditor';
import { transformExamples } from './TransformExamples';

/**
 * TransformWizard - Modal component for creating and editing data transforms
 * 
 * Supports Python script-based transforms for mgflow data processing:
 * - Name: User-friendly transform name
 * - Description: What the transform does
 * - Transform Type: Supports "ETL Transform", "Data Validation", "Mapping" 
 * - Parameters: Full Python script stored as text (not JSON)
 * 
 * For mgflow data processing:
 * - Python scripts should define transformation functions
 * - Scripts can import standard libraries (pandas, numpy, json, etc.)
 * - Functions receive mgflow data and return processed data
 * 
 * Templates:
 * - Provides example transform scripts users can customize
 * - Templates include common ETL operations (CSV to OAA, validation, mapping)
 * - Users can modify existing templates or create custom scripts
 * 
 * @param {boolean} open - Whether the wizard dialog is open
 * @param {function} onClose - Callback when dialog closes
 * @param {function} onSubmit - Callback when form is submitted
 * @param {object} editingTransform - Transform being edited (null for new transform)
 */

// MINIMAL TRANSFORM TEMPLATE (defaults to CSV→OAA application_object example)
const MINIMAL_TRANSFORM_TEMPLATE = transformExamples.csvToOaa;

const TransformWizard = ({ open, onClose, onSubmit, editingTransform = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    transform_type: 'ETL Transform',
    parameters: ''
  });
  const [error, setError] = useState('');
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState(null);

  // Initialize form for editing
  React.useEffect(() => {
    if (editingTransform) {
      setFormData({
        name: editingTransform.name || '',
        description: editingTransform.description || '',
        transform_type: editingTransform.transform_type || 'ETL Transform',
        parameters: editingTransform.parameters || ''
      });
    } else {
      // Reset form for new transform with minimal template
      setFormData({
        name: '',
        description: '',
        transform_type: 'ETL Transform',
        parameters: MINIMAL_TRANSFORM_TEMPLATE
      });
    }
  }, [editingTransform, open]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setError('Transform name is required');
      return;
    }

    if (!formData.transform_type) {
      setError('Transform type is required');
      return;
    }

    if (!formData.parameters.trim()) {
      setError('Transform script is required');
      return;
    }

    // Submit the transform data
    const transformData = {
      name: formData.name,
      description: formData.description,
      transform_type: formData.transform_type,
      parameters: formData.parameters // Store as raw text, not JSON
    };

    onSubmit(transformData);
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      transform_type: 'ETL Transform',
      parameters: MINIMAL_TRANSFORM_TEMPLATE
    });
    setError('');
    onClose();
  };

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setError(''); // Clear error when user starts typing
  };

  const handleTemplateSelect = (templateKey) => {
    const template = transformExamples[templateKey];
    if (template) {
      setFormData(prev => ({
        ...prev,
        parameters: template
      }));
    }
    setTemplateMenuAnchor(null);
  };

  const templateOptions = [
    { key: 'csvToOaa', label: 'CSV to OAA Transform', description: 'Convert CSV user data to Veza OAA format' },
    { key: 'pagerDutyUsersToOaa', label: 'PagerDuty Users → OAA', description: 'Convert PagerDuty /users JSON to Veza OAA application_object' },
    { key: 'dataValidation', label: 'Data Validation', description: 'Validate and clean mgflow data' },
    { key: 'attributeMapping', label: 'Attribute Mapping', description: 'Map source fields to target schema' },
    { key: 'vezaTransformers', label: 'Veza Transformers', description: 'Apply Veza built-in transformer functions' }
  ];

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { 
          bgcolor: '#1a1a1a', 
          color: 'white',
          border: '1px solid #333',
          minHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ color: 'white', borderBottom: '1px solid #333', pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TransformIcon sx={{ color: '#8b5cf6' }} />
            <Typography variant="h6">
              {editingTransform ? 'Edit Transform' : 'Create Transform'}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ color: '#888' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: '#1a1a1a', p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2, bgcolor: '#2d1b15', color: '#ef4444' }}>{error}</Alert>}
        
        {/* Name and Type */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            value={formData.name}
            onChange={handleInputChange('name')}
            label="Transform Name"
            required
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
            placeholder="e.g., CSV to OAA Transform"
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel sx={{ color: '#888' }}>Transform Type</InputLabel>
            <Select
              value={formData.transform_type}
              onChange={handleInputChange('transform_type')} 
              required
              sx={{ 
                bgcolor: '#1a1a1a', 
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
                '& .MuiSelect-select': { color: 'white' }
              }}
            >
              <MenuItem value="ETL Transform">ETL Transform</MenuItem>
              <MenuItem value="Data Validation">Data Validation</MenuItem>
              <MenuItem value="Mapping">Mapping</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Description */}
        <TextField
          value={formData.description}
          onChange={handleInputChange('description')}
          label="Description"
          multiline
          rows={2}
          fullWidth
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              bgcolor: '#1a1a1a',
              '& fieldset': { borderColor: '#333' },
              '&:hover fieldset': { borderColor: '#8b5cf6' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
            },
            '& .MuiInputLabel-root': { color: '#888' },
            '& .MuiInputBase-input': { color: 'white' }
          }}
          placeholder="Describe what this transform does and when to use it"
        />

        {/* Script Editor with Templates */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#8b5cf6', fontWeight: 600 }}>
              Transform Script
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                startIcon={<TemplateIcon />}
                onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: '#8b5cf6',
                  color: '#8b5cf6',
                  '&:hover': { 
                    borderColor: '#7c3aed',
                    color: '#7c3aed'
                  }
                }}
              >
                Use Template
              </Button>
            </Box>
          </Box>
          
          <Menu
            anchorEl={templateMenuAnchor}
            open={Boolean(templateMenuAnchor)}
            onClose={() => setTemplateMenuAnchor(null)}
            PaperProps={{
              sx: {
                bgcolor: '#1a1a1a',
                border: '1px solid #333',
                color: 'white',
                maxWidth: 300
              }
            }}
          >
            {templateOptions.map((option) => (
              <MenuItem 
                key={option.key}
                onClick={() => handleTemplateSelect(option.key)}
                sx={{ 
                  color: 'white',
                  '&:hover': { bgcolor: '#333' },
                  py: 1
                }}
              >
                <ListItemIcon>
                  <CodeIcon sx={{ color: '#8b5cf6' }} />
                </ListItemIcon>
                <ListItemText 
                  primary={option.label}
                  secondary={option.description}
                  secondaryTypographyProps={{ sx: { color: '#888', fontSize: '0.8rem' } }}
                />
              </MenuItem>
            ))}
          </Menu>

          <JavaScriptEditor
            value={formData.parameters}
            onChange={(value) => setFormData(prev => ({ ...prev, parameters: value }))}
            height="400px"
            filename="transform_script.js"
          />
        </Box>

        {/* Usage Tips */}
        <Box sx={{ p: 2, bgcolor: '#2a2a2a', borderRadius: 2, border: '1px solid #333' }}>
          <Typography variant="body2" sx={{ color: '#8b5cf6', fontWeight: 600, mb: 1 }}>
            <strong style={{ color: '#8b5cf6' }}>Tips for Transform Scripts:</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.6 }}>
            • Your script should define transform functions for your data processing<br/>
            • Use standard libraries like pandas, numpy, json for data manipulation<br/>
            • Return processed data in the expected format for your mgflow flow<br/>
            • Test your transform with sample data before using in production<br/>
            • Use Veza transformer functions for specific Veza operations
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ bgcolor: '#1a1a1a', borderTop: '1px solid #333', p: 3 }}>
        <Button onClick={handleClose} sx={{ color: '#888' }}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            fontWeight: 600
          }}
        >
          {editingTransform ? 'Update' : 'Create'} Transform
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransformWizard;