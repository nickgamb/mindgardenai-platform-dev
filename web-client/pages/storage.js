import React, { useState, useEffect, useContext } from 'react';
import { Typography, Container, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress, Box, Chip, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StorageIcon from '@mui/icons-material/Storage';
import DataObjectIcon from '@mui/icons-material/DataObject';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import api from '../lib/api';
import { AppContext } from '../contexts/AppContext';
import LoginButton from '../components/LoginButton';
import StorageConnectionWizard from '../components/StorageConnectionWizard';
import StorageDataViewer from '../components/StorageDataViewer';

const Storage = () => {
  const { isAuthenticated, isAuthorized, isLoading } = useContext(AppContext);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [dataViewerOpen, setDataViewerOpen] = useState(false);
  const [selectedConnectionForData, setSelectedConnectionForData] = useState(null);

  useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      fetchConnections();
    }
  }, [isAuthenticated, isAuthorized]);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const response = await api.fetchStorageItems();
      setConnections(response.storage_items);
    } catch (error) {
      console.error('Error fetching storage connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async (connectionData) => {
    try {
      await api.createStorageItem(connectionData);
      fetchConnections();
      setShowWizard(false);
    } catch (error) {
      console.error('Error creating storage connection:', error);
    }
  };

  const handleUpdateConnection = async (connectionData) => {
    try {
      await api.updateStorageItem(editingConnection.id, connectionData);
      fetchConnections();
      setEditingConnection(null);
      setShowWizard(false);
    } catch (error) {
      console.error('Error updating storage connection:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteStorageItem(id);
      fetchConnections();
    } catch (error) {
      console.error('Error deleting storage connection:', error);
    }
  };

  const handleEdit = (connection) => {
    setEditingConnection(connection);
    setShowWizard(true);
  };

  const handleViewData = (connection) => {
    setSelectedConnectionForData(connection);
    setDataViewerOpen(true);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setEditingConnection(null);
  };

  const handleCloseDataViewer = () => {
    setDataViewerOpen(false);
    setSelectedConnectionForData(null);
  };

  const getConnectionType = (connection) => {
    return connection.file_type === 'blob_storage' ? 'blob' : 'external';
  };

  const getConnectionDetails = (connection) => {
    try {
      const details = JSON.parse(connection.file_path);
      if (connection.file_type === 'blob_storage') {
        return {
          type: 'Hosted Blob',
          description: details.description || 'No description',
          dataSize: details.data ? details.data.length : 0,
          created: details.created_at || connection.created_at
        };
      } else {
        return {
          type: connection.file_type.toUpperCase(),
          host: details.host,
          port: connection.file_size,
          username: details.username,
          database: details.database
        };
      }
    } catch (error) {
      console.error('Error parsing connection details:', error);
      return { type: 'Unknown', error: 'Invalid connection data' };
    }
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
            : "You don't have permission to access the Storage page."}
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
          <StorageIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
            Storage
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
                      Add New Storage
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : connections.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 8,
          bgcolor: '#1a1a1a',
          borderRadius: 2,
          border: '1px solid #333'
        }}>
          <StorageIcon sx={{ fontSize: 64, color: '#555', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#888', mb: 1 }}>
            No storage yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Create your first storage connection to get started
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
            Add New Storage
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
                  minWidth: 100,
                  width: '15%'
                }}>
                  Type
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 200,
                  width: '35%'
                }}>
                  Details
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 100,
                  width: '10%'
                }}>
                  Status
                </TableCell>
                <TableCell sx={{ 
                  color: '#8b5cf6', 
                  fontWeight: 600,
                  minWidth: 120,
                  width: '15%'
                }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {connections.map((connection) => {
                const details = getConnectionDetails(connection);
                const isBlob = getConnectionType(connection) === 'blob';
                
                return (
                  <TableRow key={connection.id} sx={{ '&:hover': { bgcolor: '#222' } }}>
                    <TableCell sx={{ color: 'white' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isBlob ? (
                          <StorageIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                        ) : (
                          <DataObjectIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                        )}
                        {connection.file_name}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'white' }}>
                      <Chip 
                        label={details.type}
                        size="small"
                        sx={{ 
                          bgcolor: isBlob ? '#4c1d95' : '#059669',
                          color: 'white',
                          fontWeight: 500
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#888' }}>
                      {isBlob ? (
                        <Box>
                          <Typography variant="body2" sx={{ color: '#ccc' }}>
                            {details.description}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#666' }}>
                            {details.dataSize} characters
                          </Typography>
                        </Box>
                      ) : (
                        <Box>
                          <Typography variant="body2" sx={{ color: '#ccc' }}>
                            {details.host}:{details.port}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#666' }}>
                            {details.username}@{details.database}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: 'white' }}>
                      <Chip 
                        label="Active"
                        size="small"
                        sx={{ 
                          bgcolor: '#065f46',
                          color: '#10b981'
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton 
                        onClick={() => handleEdit(connection)}
                        sx={{ 
                          color: '#8b5cf6',
                          '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.1)' }
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        onClick={() => handleViewData(connection)}
                        sx={{ 
                          color: '#4f46e5',
                          '&:hover': { bgcolor: 'rgba(79, 70, 229, 0.1)' }
                        }}
                      >
                        <PlayArrowIcon />
                      </IconButton>
                      <IconButton 
                        onClick={() => handleDelete(connection.id)}
                        sx={{ 
                          color: '#ef4444',
                          '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <StorageConnectionWizard
        open={showWizard}
        onClose={handleCloseWizard}
        onSubmit={editingConnection ? handleUpdateConnection : handleCreateConnection}
        editingConnection={editingConnection}
      />

      <StorageDataViewer
        open={dataViewerOpen}
        connection={selectedConnectionForData}
        onClose={handleCloseDataViewer}
      />
    </Container>
  );
};

export default Storage;
