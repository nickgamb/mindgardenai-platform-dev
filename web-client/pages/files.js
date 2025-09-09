import React, { useEffect, useState, useContext } from 'react';
import { 
  Typography, 
  Container, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  CircularProgress,
  Box,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  GetApp as DownloadIcon
} from '@mui/icons-material';
import api from '../lib/api';
import { AppContext } from '../contexts/AppContext';
import LoginButton from '../components/LoginButton';

// File Upload Dialog Component
const FileUploadDialog = ({ open, onClose, onSubmit }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check if it's a CSV file
      if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      
      setSelectedFile(file);
      setFileName(file.name);
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('file_name', fileName);

      await onSubmit(formData);
      handleClose();
    } catch (error) {
      setError('Error uploading file: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFileName('');
    setError('');
    setUploading(false);
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
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
      <DialogTitle sx={{ color: 'white', borderBottom: '1px solid #333', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <UploadIcon sx={{ color: '#8b5cf6' }} />
          <Typography variant="h6">Upload CSV File</Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: '#1a1a1a', color: 'white', p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, bgcolor: '#2d1b1b', color: '#ff6b6b' }}>
            {error}
          </Alert>
        )}

        <Box sx={{ 
          border: '2px dashed #8b5cf6', 
          borderRadius: 2, 
          p: 3, 
          textAlign: 'center',
          mb: 3,
          mt: 2,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.05)' }
        }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="file-upload-input"
          />
          <label htmlFor="file-upload-input" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
            <UploadIcon sx={{ fontSize: 48, color: '#8b5cf6', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 1 }}>
              Click to select CSV file
            </Typography>
            <Typography variant="body2" sx={{ color: '#888' }}>
              Supported formats: .csv files only
            </Typography>
          </label>
        </Box>

        {selectedFile && (
          <Box sx={{ 
            p: 2, 
            bgcolor: '#0f1419', 
            borderRadius: 1, 
            border: '1px solid #333',
            mb: 2
          }}>
            <Typography variant="body2" sx={{ color: '#8b5cf6', mb: 1 }}>
              📄 Selected File:
            </Typography>
            <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
              {selectedFile.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#888' }}>
              Size: {formatFileSize(selectedFile.size)} | Type: {selectedFile.type || 'text/csv'}
            </Typography>
          </Box>
        )}

        <Box sx={{ mt: 3, p: 2, bgcolor: '#0f1419', borderRadius: 1, border: '1px solid #333' }}>
          <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
            📋 <strong>File Requirements:</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            • CSV format only (.csv extension)<br/>
            • Maximum file size: 50MB<br/>
            • Files will be available for use in mgflow flows<br/>
            • Ensure your CSV has proper headers for best results
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ bgcolor: '#1a1a1a', borderTop: '1px solid #333', p: 3 }}>
        <Button 
          onClick={handleClose}
          sx={{ color: '#888', '&:hover': { bgcolor: '#333' } }}
          disabled={uploading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedFile || uploading}
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            '&:disabled': { bgcolor: '#666' },
            ml: 2,
            px: 3
          }}
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Files = () => {
  const { isAuthenticated, isAuthorized, isLoading } = useContext(AppContext);
  const [files, setFiles] = useState([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      fetchFiles();
    }
  }, [isAuthenticated, isAuthorized]);

  const fetchFiles = async () => {
    try {
      setLoading(true);

      const response = await api.fetchFiles();
      setFiles(response.files || []);
      setError(null);
    } catch (error) {
      console.error('Error fetching files:', error);
      setFiles([]);
      setError('Error fetching files: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFile = async (formData) => {
    try {

              await api.uploadFile(formData);
      fetchFiles();
      setShowUploadDialog(false);
      setError(null);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Error uploading file: ' + error.message);
      throw error;
    }
  };

  const handleDelete = async (fileId) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
  
        await api.deleteFile(fileId);
        fetchFiles();
      } catch (error) {
        console.error('Error deleting file:', error);
        setError('Error deleting file: ' + error.message);
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeChip = (fileName) => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    const colorMap = {
      'csv': '#4caf50',
      'txt': '#2196f3',
      'json': '#ff9800'
    };

    return (
      <Chip 
        label={extension?.toUpperCase() || 'FILE'} 
        size="small" 
        sx={{ 
          bgcolor: colorMap[extension] || '#666',
          color: 'white',
          fontWeight: 500
        }}
      />
    );
  };

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
        <CircularProgress color="primary" />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading...</Typography>
      </Container>
    );
  }

  if (!isAuthenticated || !isAuthorized) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
        <Typography variant="h4" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1" gutterBottom>
          {!isAuthenticated
            ? "You need to be logged in to view this page."
            : "You don't have permission to access the Files page."}
        </Typography>
        {!isAuthenticated && (
          <LoginButton />
        )}
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        pb: 2,
        borderBottom: '1px solid #333'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FolderIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
            Files
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowUploadDialog(true)}
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            borderRadius: 2,
            px: 3
          }}
        >
          Upload File
        </Button>
      </Box>

      {/* Error Display */}
      {error && (
        <Box sx={{ mb: 3, p: 2, bgcolor: '#2d1b1b', borderRadius: 1, border: '1px solid #d32f2f' }}>
          <Typography color="#ff6b6b">{error}</Typography>
        </Box>
      )}

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : files.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 8,
          bgcolor: '#1a1a1a',
          borderRadius: 2,
          border: '1px solid #333'
        }}>
          <FolderIcon sx={{ fontSize: 64, color: '#666', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#888', mb: 1 }}>
            No Files Uploaded
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Upload your first CSV file to start building mgflow flows
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowUploadDialog(true)}
            sx={{
              bgcolor: '#8b5cf6',
              '&:hover': { bgcolor: '#7c3aed' }
            }}
          >
            Upload File
          </Button>
        </Box>
      ) : (
        <TableContainer 
          component={Paper} 
          sx={{ 
            bgcolor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: 2,
            overflowX: 'auto',
            '& .MuiTableCell-root': {
              borderColor: '#333'
            }
          }}
        >
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#111' }}>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 200,
                  width: '30%'
                }}>
                  File Name
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 100,
                  width: '15%'
                }}>
                  Type
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 100,
                  width: '15%'
                }}>
                  Size
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 120,
                  width: '20%'
                }}>
                  Uploaded
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 120,
                  width: '20%',
                  textAlign: 'center'
                }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((file) => (
                <TableRow 
                                      key={file.id}
                  sx={{ 
                    '&:hover': { bgcolor: '#222' }
                  }}
                >
                  <TableCell sx={{ color: 'white' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FileIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {file.file_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>
                          ID: {file.id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'white' }}>
                    {getFileTypeChip(file.file_name)}
                  </TableCell>
                  <TableCell sx={{ color: '#ccc' }}>
                    <Typography variant="body2">
                                              {formatFileSize(file.file_size || 0)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: '#ccc' }}>
                    <Typography variant="body2">
                      {file.uploaded_at ? 
                        new Date(file.uploaded_at).toLocaleDateString() : 
                        'Unknown'
                      }
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <IconButton 
                        size="small" 
                        onClick={() => {
            
                          console.log('Download file:', file);
                        }}
                        sx={{ 
                          color: '#4caf50',
                          '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.1)' }
                        }}
                        title="Download File"
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(file.id || file.device_id)}
                        sx={{ 
                          color: '#f44336',
                          '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.1)' }
                        }}
                        title="Delete File"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* File Upload Dialog */}
      <FileUploadDialog
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onSubmit={handleUploadFile}
      />
    </Container>
  );
};

export default Files;