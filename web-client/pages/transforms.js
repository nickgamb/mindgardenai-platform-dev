import React, { useState, useEffect, useContext } from 'react';
import { Typography, Container, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress, Box, Chip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterListIcon from '@mui/icons-material/FilterList';
import CodeIcon from '@mui/icons-material/Code';
import { AppContext } from '../contexts/AppContext';
import api from '../lib/api';
import LoginButton from '../components/LoginButton';
import TransformWizard from '../components/TransformWizard';

const Transforms = () => {
  const { isAuthenticated, isAuthorized, isLoading } = useContext(AppContext);
  const [transforms, setTransforms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingTransform, setEditingTransform] = useState(null);

  useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      fetchTransforms();
    }
  }, [isAuthenticated, isAuthorized]);

  const fetchTransforms = async () => {
    setLoading(true);
    try {
      const response = await api.fetchTransforms();
      setTransforms(response.transforms);
    } catch (error) {
      console.error('Error fetching transforms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransform = async (transformData) => {
    try {
      await api.createTransform(transformData);
      fetchTransforms();
      setShowWizard(false);
    } catch (error) {
      console.error('Error creating transform:', error);
    }
  };

  const handleUpdateTransform = async (transformData) => {
    try {
      await api.updateTransform(editingTransform.id, transformData);
      fetchTransforms();
      setEditingTransform(null);
      setShowWizard(false);
    } catch (error) {
      console.error('Error updating transform:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTransform(id);
      fetchTransforms();
    } catch (error) {
      console.error('Error deleting transform:', error);
    }
  };

  const handleEdit = (transform) => {
    setEditingTransform(transform);
    setShowWizard(true);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setEditingTransform(null);
  };

  const getScriptPreview = (script) => {
    if (!script) return 'No script defined';
    
    // Get first few lines or until function definition
    const lines = script.split('\n');
    const previewLines = lines.slice(0, 3);
    const preview = previewLines.join('\n');
    
    return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
  };

  const getTransformTypeChip = (transformType) => {
    const colors = {
      'ETL Transform': { bg: '#4c1d95', color: '#8b5cf6' },
      'Data Validation': { bg: '#059669', color: '#10b981' },
      'Mapping': { bg: '#dc2626', color: '#ef4444' }
    };
    
    const style = colors[transformType] || { bg: '#333', color: '#888' };
    
    return (
      <Chip 
        label={transformType}
        size="small"
        sx={{ 
          bgcolor: style.bg,
          color: style.color,
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
            : "You don't have permission to access the Transforms page."}
        </Typography>
        {!isAuthenticated && (
          <LoginButton />
        )}
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        pb: 2,
        borderBottom: '1px solid #333'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FilterListIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
            Transforms
          </Typography>
        </Box>
        <Button
          startIcon={<AddIcon />}
          onClick={() => setShowWizard(true)}
          variant="contained"
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            fontWeight: 600,
            px: 3,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none'
          }}
        >
          Add New Transform
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
                ) : transforms.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 8,
          bgcolor: '#1a1a1a',
          borderRadius: 2,
          border: '1px solid #333'
        }}>
          <FilterListIcon sx={{ fontSize: 64, color: '#555', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#888', mb: 1 }}>
            No transforms yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Create your first transform to get started
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setShowWizard(true)}
            variant="contained"
            sx={{
              bgcolor: '#8b5cf6',
              '&:hover': { bgcolor: '#7c3aed' },
              fontWeight: 600,
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none'
            }}
          >
            Add New Transform
          </Button>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ 
          bgcolor: '#1a1a1a', 
          border: '1px solid #333',
          borderRadius: 2,
          overflowX: 'auto',
          '& .MuiTableCell-root': {
            borderColor: '#333'
          }
        }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#111' }}>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 180,
                  width: '25%'
                }}>
                  Name
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 200,
                  width: '30%'
                }}>
                  Description
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 120,
                  width: '15%'
                }}>
                  Type
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 150,
                  width: '20%'
                }}>
                  Script Preview
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 120,
                  width: '10%'
                }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transforms.map((transform) => (
                <TableRow key={transform.id} sx={{ '&:hover': { bgcolor: '#222' } }}>
                  <TableCell sx={{ color: 'white' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CodeIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                      {transform.name}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#ccc', maxWidth: 250 }}>
                    <Typography variant="body2" sx={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {transform.description || 'No description'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: 'white' }}>
                    {getTransformTypeChip(transform.transform_type)}
                  </TableCell>
                  <TableCell sx={{ color: '#888' }}>
                    <Box sx={{ 
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                      fontSize: '0.75rem',
                      bgcolor: '#111',
                      p: 1,
                      borderRadius: 1,
                      maxWidth: 300,
                      overflow: 'hidden'
                    }}>
                      <Typography variant="caption" sx={{ 
                        color: '#888',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}>
                        {getScriptPreview(transform.parameters)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      onClick={() => handleEdit(transform)}
                      sx={{ 
                        color: '#8b5cf6',
                        '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.1)' }
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      onClick={() => handleDelete(transform.id)}
                      sx={{ 
                        color: '#ef4444',
                        '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TransformWizard
        open={showWizard}
        onClose={handleCloseWizard}
        onSubmit={editingTransform ? handleUpdateTransform : handleCreateTransform}
        editingTransform={editingTransform}
      />
    </Container>
  );
};

export default Transforms;
