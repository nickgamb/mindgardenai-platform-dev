import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  IconButton,
  Step,
  Stepper,
  StepLabel,
  Paper,
  Card,
  CardContent,
  CardActionArea,
  Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StorageIcon from '@mui/icons-material/Storage';
import CloudIcon from '@mui/icons-material/Cloud';
import DataObjectIcon from '@mui/icons-material/DataObject';
import JavaScriptEditor from './JavaScriptEditor';

/**
 * StorageConnectionWizard - Modal component for creating and editing storage connections
 * 
 * Supports two types of storage:
 * 1. Hosted Blob Storage - Data stored on server, identified by file_type: 'blob_storage'
 *    - Used for React Flow nodes that need read/write access to structured data
 *    - file_path contains JSON: { description, data, created_at }
 *    - Data can be any JSON structure suitable for flow operations
 * 
 * 2. External Database Connections - Connection details for external databases
 *    - file_type: database type (mysql, postgresql, etc.)
 *    - file_path contains JSON: { host, username, password, database }
 *    - file_size stores the port number
 * 
 * For React Flow integration:
 * - Blob storage items can be referenced by their ID in flow nodes
 * - The data field should contain structured JSON that flow operations can consume
 * - Consider implementing streaming/partial updates for large datasets
 */

const StorageConnectionWizard = ({ open, onClose, onSubmit, editingConnection = null }) => {
  const [step, setStep] = useState(0);
  const [connectionType, setConnectionType] = useState('graph');
  const [formData, setFormData] = useState({
    name: '',
    // For blob storage
    description: '',
    data: '',
    // For external connections
    dbType: '',
    host: '',
    port: '',
    username: '',
    password: '',
    database: ''
  });
  const [error, setError] = useState('');

  const steps = ['Choose Type', 'Configure Connection'];

  // Initialize form for editing
  React.useEffect(() => {
    if (editingConnection) {
      console.log('📝 Editing connection:', editingConnection);
      setFormData(prev => ({ ...prev, name: editingConnection.file_name }));
      
      if (editingConnection.file_type === 'blob_storage') {
        console.log('🗄️ Detected blob storage for editing');
        setConnectionType('blob');
        try {
          const blobData = JSON.parse(editingConnection.file_path);
          console.log('📄 Parsed blob data:', blobData);
          setFormData(prev => ({
            ...prev,
            description: blobData.description || '',
            data: blobData.data || ''
          }));
        } catch (e) {
          console.error('Error parsing blob data:', e);
        }
      } else if (editingConnection.file_type === 'graph') {
        setConnectionType('graph');
        try {
          const details = JSON.parse(editingConnection.file_path);
          setFormData(prev => ({
            ...prev,
            dbType: 'neo4j',
            host: details.host || 'neo4j',
            port: String(editingConnection.file_size || details.port || '7687'),
            username: details.username || 'neo4j',
            password: details.password || '',
            database: details.database || 'neo4j'
          }));
        } catch (e) {
          console.error('Error parsing graph connection data:', e);
        }
      } else {
        console.log('🔗 Detected external connection for editing, file_type:', editingConnection.file_type);
        setConnectionType('external');
        try {
          const connectionDetails = JSON.parse(editingConnection.file_path);
          console.log('🔧 Parsed connection details:', connectionDetails);
          setFormData(prev => ({
            ...prev,
            dbType: editingConnection.file_type,
            host: connectionDetails.host || '',
            port: String(editingConnection.file_size || ''),
            username: connectionDetails.username || '',
            password: connectionDetails.password || '',
            database: connectionDetails.database || ''
          }));
        } catch (e) {
          console.error('Error parsing connection data:', e);
        }
      }
      setStep(1); // Skip type selection when editing
    }
  }, [editingConnection]);

  const handleNext = () => {
    if (step === 0 && !connectionType) {
      setError('Please select a connection type');
      return;
    }
    setError('');
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setError('Connection name is required');
      return;
    }

    if (connectionType === 'blob') {
      const blobData = {
        type: 'blob_storage',
        file_name: formData.name,
        file_type: 'blob_storage',
        file_size: formData.data ? formData.data.length : 0,
        file_path: JSON.stringify({
          description: formData.description,
          data: formData.data,
          created_at: new Date().toISOString()
        })
      };
      console.log('🗄️ Creating blob storage:', blobData);
      onSubmit(blobData);
    } else if (connectionType === 'graph') {
      if (!formData.host || !formData.port || !formData.username) {
        setError('Graph host, port, and username are required');
        return;
      }
      const graphData = {
        type: 'graph_connection',
        file_name: formData.name,
        file_type: 'graph',
        file_size: parseInt(formData.port) || 7687,
        file_path: JSON.stringify({
          host: formData.host,
          username: formData.username,
          password: formData.password,
          database: formData.database || 'neo4j'
        })
      };
      console.log('🕸️ Creating graph connection:', graphData);
      onSubmit(graphData);
    } else {
      if (!formData.dbType || !formData.host || !formData.port || !formData.database) {
        setError('All connection fields are required');
        return;
      }
      
      const connectionData = {
        type: 'external_connection',
        file_name: formData.name,
        file_type: formData.dbType,
        file_size: parseInt(formData.port),
        file_path: JSON.stringify({
          host: formData.host,
          username: formData.username,
          password: formData.password,
          database: formData.database
        })
      };
      console.log('🔗 Creating external connection:', connectionData);
      onSubmit(connectionData);
    }
  };

  const handleClose = () => {
    setStep(0);
    setConnectionType('');
    setFormData({
      name: '',
      description: '',
      data: '',
      dbType: '',
      host: '',
      port: '',
      username: '',
      password: '',
      database: ''
    });
    setError('');
    onClose();
  };

  const renderTypeSelection = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 3, textAlign: 'center', color: 'white' }}>
        Choose Storage Type
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Card 
          sx={{ 
            minWidth: 200, 
            bgcolor: connectionType === 'graph' ? '#8b5cf6' : '#1a1a1a',
            border: `1px solid ${connectionType === 'graph' ? '#8b5cf6' : '#333'}`,
            transition: 'all 0.3s ease'
          }}
        >
          <CardActionArea 
            onClick={() => setConnectionType('graph')}
            sx={{ p: 3, textAlign: 'center' }}
          >
            <DataObjectIcon sx={{ fontSize: 48, color: connectionType === 'graph' ? 'white' : '#8b5cf6', mb: 2 }} />
            <Typography variant="h6" sx={{ color: connectionType === 'graph' ? 'white' : '#8b5cf6', fontWeight: 600 }}>
              Graph (Neo4j)
            </Typography>
            <Typography variant="body2" sx={{ color: connectionType === 'graph' ? 'rgba(255,255,255,0.8)' : '#888', mt: 1 }}>
              Store relational data in MG Graph
            </Typography>
          </CardActionArea>
        </Card>
        <Card 
          sx={{ 
            minWidth: 200, 
            bgcolor: connectionType === 'blob' ? '#8b5cf6' : '#1a1a1a',
            border: `1px solid ${connectionType === 'blob' ? '#8b5cf6' : '#333'}`,
            transition: 'all 0.3s ease'
          }}
        >
          <CardActionArea 
            onClick={() => setConnectionType('blob')}
            sx={{ p: 3, textAlign: 'center' }}
          >
            <StorageIcon sx={{ fontSize: 48, color: connectionType === 'blob' ? 'white' : '#8b5cf6', mb: 2 }} />
            <Typography variant="h6" sx={{ color: connectionType === 'blob' ? 'white' : '#8b5cf6', fontWeight: 600 }}>
              Hosted Blob
            </Typography>
            <Typography variant="body2" sx={{ color: connectionType === 'blob' ? 'rgba(255,255,255,0.8)' : '#888', mt: 1 }}>
              Store data directly on our servers
            </Typography>
          </CardActionArea>
        </Card>

        <Card 
          sx={{ 
            minWidth: 200, 
            bgcolor: connectionType === 'external' ? '#8b5cf6' : '#1a1a1a',
            border: `1px solid ${connectionType === 'external' ? '#8b5cf6' : '#333'}`,
            transition: 'all 0.3s ease'
          }}
        >
          <CardActionArea 
            onClick={() => setConnectionType('external')}
            sx={{ p: 3, textAlign: 'center' }}
          >
                              <DataObjectIcon sx={{ fontSize: 48, color: connectionType === 'external' ? 'white' : '#8b5cf6', mb: 2 }} />
            <Typography variant="h6" sx={{ color: connectionType === 'external' ? 'white' : '#8b5cf6', fontWeight: 600 }}>
              External Database
            </Typography>
            <Typography variant="body2" sx={{ color: connectionType === 'external' ? 'rgba(255,255,255,0.8)' : '#888', mt: 1 }}>
              Connect to your own database
            </Typography>
          </CardActionArea>
        </Card>
      </Box>
    </Box>
  );

  const renderBlobConfiguration = () => (
    <Box sx={{ mt: 2 }}>
      <TextField 
        label="Storage Name" 
        value={formData.name} 
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <TextField 
        label="Description" 
        value={formData.description} 
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} 
        fullWidth 
        margin="normal"
        multiline
        rows={2}
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
      />
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
          Initial Data (JSON)
        </Typography>
        <JavaScriptEditor
          value={formData.data}
          onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
          placeholder='{"example": "data"}'
          height="220px"
          filename="initial_data.json"
        />
      </Box>
      <Typography variant="caption" sx={{ color: '#888', mt: 1, display: 'block' }}>
        This blob storage can be used as a node in your React Flow workflows
      </Typography>
    </Box>
  );

  const renderExternalConfiguration = () => (
    <Box sx={{ mt: 2 }}>
      <TextField 
        label="Connection Name" 
        value={formData.name} 
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <FormControl fullWidth margin="normal">
        <InputLabel sx={{ color: '#888' }}>Database Type</InputLabel>
        <Select 
          value={formData.dbType} 
          onChange={(e) => setFormData(prev => ({ ...prev, dbType: e.target.value }))} 
          required
          sx={{ 
            bgcolor: '#1a1a1a', 
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
            '& .MuiSelect-select': { color: 'white' }
          }}
        >
          <MenuItem value="mysql">MySQL</MenuItem>
          <MenuItem value="postgresql">PostgreSQL</MenuItem>
          <MenuItem value="mongodb">MongoDB</MenuItem>
          <MenuItem value="sqlite">SQLite</MenuItem>
        </Select>
      </FormControl>
      <TextField 
        label="Host" 
        value={formData.host} 
        onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <TextField 
        label="Port" 
        type="number" 
        value={formData.port} 
        onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <TextField 
        label="Username" 
        value={formData.username} 
        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <TextField 
        label="Password" 
        type="password" 
        value={formData.password} 
        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <TextField 
        label="Database Name" 
        value={formData.database} 
        onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
    </Box>
  );

  const renderGraphConfiguration = () => (
    <Box sx={{ mt: 2 }}>
      <TextField 
        label="Connection Name" 
        value={formData.name} 
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <TextField 
        label="Host" 
        value={formData.host || 'neo4j'} 
        onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <TextField 
        label="Bolt Port" 
        type="number" 
        value={formData.port || '7687'} 
        onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <TextField 
        label="Username" 
        value={formData.username || 'neo4j'} 
        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <TextField 
        label="Password" 
        type="password" 
        value={formData.password || ''} 
        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} 
        required 
        fullWidth 
        margin="normal"
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
      />
      <TextField 
        label="Database (optional)" 
        value={formData.database || 'neo4j'} 
        onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))} 
        fullWidth 
        margin="normal"
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
      />
    </Box>
  );

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
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)'
        }
      }}
    >
      <DialogTitle sx={{ color: 'white', borderBottom: '1px solid #333' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {editingConnection ? 'Edit Storage Connection' : 'New Storage Connection'}
          </Typography>
          <IconButton onClick={handleClose} size="small" sx={{ color: '#888' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: '#1a1a1a', color: 'white' }}>
        {!editingConnection && (
          <Stepper activeStep={step} sx={{ mt: 2, mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel 
                  sx={{
                    '& .MuiStepLabel-label': { color: '#888' },
                    '& .MuiStepLabel-label.Mui-active': { color: '#8b5cf6' },
                    '& .MuiStepLabel-label.Mui-completed': { color: '#8b5cf6' }
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2, bgcolor: '#2d1b1b', color: '#ff6b6b' }}>
            {error}
          </Alert>
        )}

        {step === 0 && !editingConnection && renderTypeSelection()}
        {(step === 1 || editingConnection) && connectionType === 'graph' && renderGraphConfiguration()}
        {(step === 1 || editingConnection) && connectionType === 'blob' && renderBlobConfiguration()}
        {(step === 1 || editingConnection) && connectionType === 'external' && renderExternalConfiguration()}
      </DialogContent>

      <DialogActions sx={{ bgcolor: '#1a1a1a', borderTop: '1px solid #333', p: 3 }}>
        {step > 0 && !editingConnection && (
          <Button 
            onClick={handleBack}
            sx={{ color: '#888', '&:hover': { bgcolor: '#333' } }}
          >
            Back
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button 
          onClick={handleClose}
          sx={{ color: '#888', '&:hover': { bgcolor: '#333' } }}
        >
          Cancel
        </Button>
        {step === 0 && !editingConnection ? (
          <Button 
            onClick={handleNext}
            variant="contained"
            disabled={!connectionType}
            sx={{
              bgcolor: '#8b5cf6',
              '&:hover': { bgcolor: '#7c3aed' },
              '&:disabled': { bgcolor: '#333', color: '#666' }
            }}
          >
            Next
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit}
            variant="contained"
            sx={{
              bgcolor: '#8b5cf6',
              '&:hover': { bgcolor: '#7c3aed' }
            }}
          >
            {editingConnection ? 'Update' : 'Create'} Connection
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default StorageConnectionWizard; 