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
  Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RocketIcon from '@mui/icons-material/Rocket';
import PeopleIcon from '@mui/icons-material/People';

/**
 * MGFlowWizard - Modal component for creating and editing flow metadata
 * 
 * Handles basic flow information:
 * - Name: User-friendly flow name
 * - Description: Detailed flow description
 * - Shared With: List of user IDs who can access the flow
 * 
 * For flow design and flow configuration, the flow Designer 
 * (with React Flow visual programming) is accessed separately from the main table.
 */

const MGFlowWizard = ({ open, onClose, onSubmit, editingFlow = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    shared_with: []
  });
  const [error, setError] = useState('');
  const [sharedWithInput, setSharedWithInput] = useState('');

  // Initialize form for editing
  useEffect(() => {
    if (editingFlow && editingFlow.id) {
      setFormData({
        name: editingFlow.name || '',
        description: editingFlow.description || '',
        shared_with: editingFlow.shared_with || []
      });
      setSharedWithInput(editingFlow.shared_with ? editingFlow.shared_with.join(', ') : '');
    } else {
      // Reset form for new flow
      setFormData({
        name: '',
        description: '',
        shared_with: []
      });
      setSharedWithInput('');
    }
  }, [editingFlow, open]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setError('Flow name is required');
      return;
    }

    // Process shared_with from input string
    const sharedWithArray = sharedWithInput
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    const flowData = {
      ...formData,
      shared_with: sharedWithArray
    };

    onSubmit(flowData);
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      shared_with: []
    });
    setSharedWithInput('');
    setError('');
    onClose();
  };

  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(''); // Clear error when user starts typing
  };

  const handleSharedWithChange = (event) => {
    setSharedWithInput(event.target.value);
    setError(''); // Clear error when user starts typing
  };

  const getSharedWithChips = () => {
    if (!sharedWithInput.trim()) return null;
    
    const userIds = sharedWithInput
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    if (userIds.length === 0) return null;

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        {userIds.map((userId, index) => (
          <Chip
            key={index}
            label={userId}
            size="small"
            sx={{
              bgcolor: '#8b5cf6',
              color: 'white',
              '& .MuiChip-deleteIcon': {
                color: 'white'
              }
            }}
            onDelete={() => {
              const newIds = userIds.filter((_, i) => i !== index);
              setSharedWithInput(newIds.join(', '));
            }}
          />
        ))}
      </Box>
    );
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
          minHeight: '50vh'
        }
      }}
    >
      <DialogTitle sx={{ color: 'white', borderBottom: '1px solid #333', pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <RocketIcon sx={{ color: '#8b5cf6' }} />
            <Typography variant="h6">
              {editingFlow && editingFlow.id ? 'Edit Flow' : 'Create New Flow'}
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

        {/* Flow Information */}
        <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <RocketIcon sx={{ fontSize: 20 }} />
          Flow Information
        </Typography>

        <TextField 
          label="Flow Name" 
          value={formData.name} 
          onChange={handleInputChange('name')} 
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
          placeholder="e.g., Prod Auth0 Migration, API ETL Pipeline"
        />

        <TextField 
          label="Description" 
          value={formData.description} 
          onChange={handleInputChange('description')} 
          fullWidth
          multiline
          rows={4}
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
          placeholder="Describe the flow purpose, data sources, transformations, and target systems..."
        />

        {/* Collaboration Settings */}
        <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleIcon sx={{ fontSize: 20 }} />
          Collaboration
        </Typography>

        <TextField 
          label="Shared With (User IDs)" 
          value={sharedWithInput} 
          onChange={handleSharedWithChange} 
          fullWidth
          sx={{ 
            mb: 1,
            '& .MuiOutlinedInput-root': { 
              bgcolor: '#1a1a1a', 
              '& fieldset': { borderColor: '#333' },
              '&:hover fieldset': { borderColor: '#8b5cf6' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
            },
            '& .MuiInputLabel-root': { color: '#888' },
            '& .MuiInputBase-input': { color: 'white' }
          }}
          placeholder="user1@example.com, user2@example.com"
          helperText="Enter comma-separated user IDs to share this flow with team members"
          FormHelperTextProps={{
            sx: { color: '#666' }
          }}
        />

        {getSharedWithChips()}

        <Box sx={{ mt: 3, p: 2, bgcolor: '#0f1419', borderRadius: 1, border: '1px solid #333' }}>
          <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
            🚀 <strong>Next Steps:</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            After creating your flow, use the <strong>MG Flow Designer</strong> to configure the flow 
            and data processing pipeline with our visual React Flow editor.
          </Typography>
        </Box>
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
          {editingFlow && editingFlow.id ? 'Update' : 'Create'} Flow
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MGFlowWizard;