import React, { useState, useEffect, useContext } from 'react';
import { Typography, Container, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress } from '@mui/material';
import { AppContext } from '../contexts/AppContext';
import api from '../lib/api';
import LoginButton from '../components/LoginButton';

const Models = () => {
  const { isAuthenticated, isAuthorized, isLoading, user } = useContext(AppContext);
  const [models, setModels] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modelType, setModelType] = useState('');
  const [parameters, setParameters] = useState('');

  useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      fetchModels();
    }
  }, [isAuthenticated, isAuthorized]);

  const fetchModels = async () => {
    try {
      const response = await api.fetchModels();
      setModels(response.models);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createModel({ name, description, model_type: modelType, parameters: JSON.parse(parameters) });
      fetchModels();
      setName('');
      setDescription('');
      setModelType('');
      setParameters('');
    } catch (error) {
      console.error('Error creating model:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteModel(id);
      fetchModels();
    } catch (error) {
      console.error('Error deleting model:', error);
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
            : "You don't have permission to access the Models page."}
        </Typography>
        {!isAuthenticated && (
          <LoginButton />
        )}
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Models
      </Typography>
      <form onSubmit={handleSubmit}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <TextField label="Model Type" value={modelType} onChange={(e) => setModelType(e.target.value)} required />
        <TextField label="Parameters (JSON)" value={parameters} onChange={(e) => setParameters(e.target.value)} required />
        <Button type="submit" variant="contained" color="primary">Add Model</Button>
      </form>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Model Type</TableCell>
              <TableCell>Parameters</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell>{model.name}</TableCell>
                <TableCell>{model.description}</TableCell>
                <TableCell>{model.model_type}</TableCell>
                <TableCell>{JSON.stringify(model.parameters)}</TableCell>
                <TableCell>
                  <Button onClick={() => handleDelete(model.id)} variant="contained" color="secondary">Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default Models;
