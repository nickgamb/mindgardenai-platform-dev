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
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Rocket as MGFlowIcon,
  AccountTree as DesignIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import api from '../lib/api';
import { AppContext } from '../contexts/AppContext';
import LoginButton from '../components/LoginButton';
import MGFlowWizard from '../components/MGFlowWizard';
import FlowDesigner from '../components/FlowDesigner';

const MGFlows = () => {
  const { isAuthenticated, isAuthorized, isLoading } = useContext(AppContext);
  const [mgflows, setMGFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showFlowDesigner, setShowFlowDesigner] = useState(false);
  const [editingMGFlow, setEditingMGFlow] = useState(null);
  const [designingMGFlow, setDesigningMGFlow] = useState(null);

  useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      fetchMGFlows();
    }
  }, [isAuthenticated, isAuthorized]);

  const fetchMGFlows = async () => {
    setLoading(true);
    try {
      const response = await api.fetchMGFlows();
      setMGFlows(response.mgflows);
    } catch (error) {
      console.error('Error fetching mgflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMGFlow = async (mgflowData) => {
    try {
      await api.createMGFlow({
        ...mgflowData,
        mgflow_flow: '{}'  // Initialize with empty flow
      });
      fetchMGFlows();
      setShowWizard(false);
    } catch (error) {
      console.error('Error creating mgflow:', error);
    }
  };

  const handleUpdateMGFlow = async (mgflowData) => {
    try {
      await api.updateMGFlow(editingMGFlow.id, mgflowData);
      fetchMGFlows();
      setEditingMGFlow(null);
      setShowWizard(false);
    } catch (error) {
      console.error('Error updating mgflow:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this mgflow?')) {
      try {
        await api.deleteMGFlow(id);
        fetchMGFlows();
      } catch (error) {
        console.error('Error deleting mgflow:', error);
      }
    }
  };

  const handleEdit = (mgflow) => {
    setEditingMGFlow(mgflow);
    setShowWizard(true);
  };

  const handleDesignMGFlow = (mgflow) => {
    setDesigningMGFlow(mgflow);
    setShowFlowDesigner(true);
  };

  const handleSaveFlow = async (flowData) => {
    try {
      await api.updateMGFlow(designingMGFlow.id, {
        name: designingMGFlow.name,
        description: designingMGFlow.description,
        mgflow_flow: flowData,
        shared_with: designingMGFlow.shared_with
      });
      fetchMGFlows();
      setShowFlowDesigner(false);
      setDesigningMGFlow(null);
    } catch (error) {
      console.error('Error saving mgflow flow:', error);
    }
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setEditingMGFlow(null);
  };

  const handleCloseFlowDesigner = () => {
    setShowFlowDesigner(false);
    setDesigningMGFlow(null);
  };

  const getSharedWithChips = (sharedWith) => {
    if (!sharedWith || sharedWith.length === 0) {
      return <Chip label="Private" size="small" sx={{ bgcolor: '#333', color: 'white' }} />;
    }
    return sharedWith.map((email, index) => (
      <Chip 
        key={index} 
        label={email} 
        size="small" 
        sx={{ bgcolor: '#3b82f6', color: 'white', mr: 0.5 }} 
      />
    ));
  };

  const getMGFlowStatusChip = (mgflow) => {
    const hasFlow = mgflow.mgflow_flow && mgflow.mgflow_flow !== '{}';
    return (
      <Chip 
        label={hasFlow ? 'Configured' : 'Draft'}
        size="small"
        sx={{ 
          bgcolor: hasFlow ? '#10b981' : '#f59e0b',
          color: 'white'
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
            : "You don't have permission to access the MGFlows page."}
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
          <MGFlowIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
            MGFlows
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
          New MGFlow
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : mgflows.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 8,
          bgcolor: '#1a1a1a',
          borderRadius: 2,
          border: '1px solid #333'
        }}>
          <MGFlowIcon sx={{ fontSize: 64, color: '#555', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#888', mb: 1 }}>
            No mgflows yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Create your first mgflow to get started
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
            New MGFlow
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
                  minWidth: 160,
                  width: '20%'
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
                  Shared With
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 80,
                  width: '10%'
                }}>
                  Status
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 160,
                  width: '25%'
                }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mgflows.map((mgflow) => (
                <TableRow key={mgflow.id} sx={{ '&:hover': { bgcolor: '#222' } }}>
                  <TableCell sx={{ 
                    color: 'white',
                    wordBreak: 'break-word',
                    maxWidth: 0,
                    width: '20%'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MGFlowIcon sx={{ color: '#8b5cf6', fontSize: 20, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ color: 'white' }}>
                        {mgflow.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ 
                    color: '#888',
                    wordBreak: 'break-word',
                    maxWidth: 0,
                    width: '30%'
                  }}>
                    <Typography variant="body2" sx={{ 
                      color: '#888',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {mgflow.description}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ 
                    color: 'white',
                    width: '15%'
                  }}>
                    {getSharedWithChips(mgflow.shared_with)}
                  </TableCell>
                  <TableCell sx={{ 
                    color: 'white',
                    width: '10%'
                  }}>
                    {getMGFlowStatusChip(mgflow)}
                  </TableCell>
                  <TableCell align="right" sx={{ width: '25%' }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <Button
                        startIcon={<DesignIcon />}
                        onClick={() => handleDesignMGFlow(mgflow)}
                        variant="contained"
                        size="small"
                        sx={{
                          bgcolor: '#10b981',
                          '&:hover': { bgcolor: '#059669' },
                          textTransform: 'none',
                          minWidth: 'auto',
                          fontSize: '0.75rem'
                        }}
                      >
                        Designer
                      </Button>
                      <IconButton 
                        onClick={() => handleEdit(mgflow)}
                        size="small"
                        sx={{ 
                          color: '#8b5cf6',
                          '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.1)' }
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        onClick={() => handleDelete(mgflow.id)}
                        size="small"
                        sx={{ 
                          color: '#ef4444',
                          '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' }
                        }}
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

      <MGFlowWizard
        open={showWizard}
        onClose={handleCloseWizard}
        onSubmit={editingMGFlow ? handleUpdateMGFlow : handleCreateMGFlow}
        editingMGFlow={editingMGFlow}
      />

      <FlowDesigner
        open={showFlowDesigner}
        onClose={handleCloseFlowDesigner}
        onSave={handleSaveFlow}
        mgflowData={designingMGFlow}
      />
    </Container>
  );
};

export default MGFlows;