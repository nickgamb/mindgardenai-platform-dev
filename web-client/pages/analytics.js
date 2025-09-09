import React, { useState, useEffect, useContext } from 'react';
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
  Analytics as AnalyticsIcon,
  Code as CodeIcon,
  PlayArrow as RunIcon
} from '@mui/icons-material';
import api from '../lib/api';
import { AppContext } from '../contexts/AppContext';
import LoginButton from '../components/LoginButton';
import AnalyticsWizard from '../components/AnalyticsWizard';

const Analytics = () => {
  const { isAuthenticated, isAuthorized, isLoading } = useContext(AppContext);
  const [analytics, setAnalytics] = useState([]);
  const [showWizard, setShowWizard] = useState(false);
  const [editingAnalytics, setEditingAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      fetchAnalytics();
    }
  }, [isAuthenticated, isAuthorized]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.fetchAnalytics();
      setAnalytics(response.analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnalytics = async (analyticsData) => {
    try {
      await api.createAnalytics(analyticsData);
      fetchAnalytics();
      setShowWizard(false);
    } catch (error) {
      console.error('Error creating analytics:', error);
    }
  };

  const handleUpdateAnalytics = async (analyticsData) => {
    try {
      await api.updateAnalytics(editingAnalytics.id, analyticsData);
      fetchAnalytics();
      setShowWizard(false);
      setEditingAnalytics(null);
    } catch (error) {
      console.error('Error updating analytics:', error);
    }
  };

  const handleEdit = (analyticsItem) => {
    setEditingAnalytics(analyticsItem);
    setShowWizard(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this analytics object?')) {
      try {
        await api.deleteAnalytics(id);
        fetchAnalytics();
      } catch (error) {
        console.error('Error deleting analytics:', error);
      }
    }
  };

  const handleRun = async (analyticsItem) => {
    // TODO: Implement analytics execution
    console.log('Running analytics:', analyticsItem.name);
    alert(`Analytics execution would run here for: ${analyticsItem.name}\n\nThis feature will execute the Python script with configured data storage connections.`);
  };

  const getScriptPreview = (script) => {
    if (!script) return 'No script';
    const lines = script.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim());
    if (nonEmptyLines.length === 0) return 'Empty script';
    
    // Get first meaningful line (skip imports and comments)
    for (const line of nonEmptyLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('import') && !trimmed.startsWith('from')) {
        return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
      }
    }
    
    return nonEmptyLines[0].length > 50 ? nonEmptyLines[0].substring(0, 50) + '...' : nonEmptyLines[0];
  };

  const getAnalysisTypeChip = (analysisType) => {
    const colorMap = {
      'Data Visualization': '#2196f3',
      'Statistical Analysis': '#4caf50',
      'Performance Analysis': '#ff9800',
      'Machine Learning': '#9c27b0',
      'Error Analysis': '#f44336',
      'Resource Monitoring': '#00bcd4',
      'Custom Report': '#795548'
    };

    return (
      <Chip 
        label={analysisType || 'Unknown'} 
        size="small" 
        sx={{ 
          bgcolor: colorMap[analysisType] || '#666',
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
            : "You don't have permission to access the Analytics page."}
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
          <AnalyticsIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
            Analytics
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowWizard(true)}
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            borderRadius: 2,
            px: 3
          }}
        >
          Add New Analytics
        </Button>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : analytics.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 8,
          bgcolor: '#1a1a1a',
          borderRadius: 2,
          border: '1px solid #333'
        }}>
          <AnalyticsIcon sx={{ fontSize: 64, color: '#666', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#888', mb: 1 }}>
            No Analytics Objects Yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Create your first analytics object to start analyzing your data
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowWizard(true)}
            sx={{
              bgcolor: '#8b5cf6',
              '&:hover': { bgcolor: '#7c3aed' }
            }}
          >
            Create Analytics Object
          </Button>
        </Box>
      ) : (
        <TableContainer 
          component={Paper} 
          sx={{ 
            bgcolor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: 2
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#0f0f0f' }}>
                <TableCell sx={{ color: '#888', fontWeight: 600, borderBottom: '1px solid #333' }}>
                  Name
                </TableCell>
                <TableCell sx={{ color: '#888', fontWeight: 600, borderBottom: '1px solid #333' }}>
                  Type
                </TableCell>
                <TableCell sx={{ color: '#888', fontWeight: 600, borderBottom: '1px solid #333' }}>
                  Description
                </TableCell>
                <TableCell sx={{ color: '#888', fontWeight: 600, borderBottom: '1px solid #333' }}>
                  Script Preview
                </TableCell>
                <TableCell sx={{ color: '#888', fontWeight: 600, borderBottom: '1px solid #333' }}>
                  Created
                </TableCell>
                <TableCell sx={{ color: '#888', fontWeight: 600, borderBottom: '1px solid #333', textAlign: 'center' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {analytics.map((item) => (
                <TableRow 
                  key={item.id}
                  sx={{ 
                    '&:hover': { bgcolor: '#222' },
                    borderBottom: '1px solid #333'
                  }}
                >
                  <TableCell sx={{ color: 'white', borderBottom: '1px solid #333' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AnalyticsIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #333' }}>
                    {getAnalysisTypeChip(item.analysis_type)}
                  </TableCell>
                  <TableCell sx={{ color: '#ccc', borderBottom: '1px solid #333', maxWidth: 200 }}>
                    <Typography variant="body2" sx={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.description || 'No description'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: '#888', borderBottom: '1px solid #333', maxWidth: 300 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CodeIcon sx={{ fontSize: 16, color: '#666' }} />
                      <Typography variant="caption" sx={{ 
                        fontFamily: 'monospace',
                        bgcolor: '#0a0a0a',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        border: '1px solid #333',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 250
                      }}>
                        {getScriptPreview(item.parameters)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#888', borderBottom: '1px solid #333' }}>
                    <Typography variant="caption">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #333', textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleRun(item)}
                        sx={{ 
                          color: '#4caf50',
                          '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.1)' }
                        }}
                        title="Run Analytics"
                      >
                        <RunIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleEdit(item)}
                        sx={{ 
                          color: '#2196f3',
                          '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.1)' }
                        }}
                        title="Edit Analytics"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(item.id)}
                        sx={{ 
                          color: '#f44336',
                          '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.1)' }
                        }}
                        title="Delete Analytics"
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

      {/* Analytics Wizard */}
      <AnalyticsWizard
        open={showWizard}
        onClose={() => {
          setShowWizard(false);
          setEditingAnalytics(null);
        }}
        onSubmit={editingAnalytics ? handleUpdateAnalytics : handleCreateAnalytics}
        editingAnalytics={editingAnalytics}
      />
    </Container>
  );
};

export default Analytics;
