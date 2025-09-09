import React, { useState, useEffect, useContext } from 'react';
import { Typography, Container, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress } from '@mui/material';
import api from '../lib/api';
import { AppContext } from '../contexts/AppContext';
import LoginButton from '../components/LoginButton';

const Participants = () => {
  const { isAuthenticated, isAuthorized, isLoading } = useContext(AppContext);
  const [participants, setParticipants] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  useEffect(() => {
    if (isAuthenticated && isAuthorized) {
      fetchParticipants();
    }
  }, [isAuthenticated, isAuthorized]);

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
            : "You don't have permission to access the Participants page."}
        </Typography>
        {!isAuthenticated && (
          <LoginButton />
        )}
      </Container>
    );
  }

  const fetchParticipants = async () => {
    try {
      const response = await api.fetchParticipants();
      setParticipants(response.participants);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createParticipant({ name, email, age: parseInt(age), gender });
      fetchParticipants();
      setName('');
      setEmail('');
      setAge('');
      setGender('');
    } catch (error) {
      console.error('Error creating participant:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteParticipant(id);
      fetchParticipants();
    } catch (error) {
      console.error('Error deleting participant:', error);
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Participants
      </Typography>
      <form onSubmit={handleSubmit}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} required />
        <TextField label="Gender" value={gender} onChange={(e) => setGender(e.target.value)} required />
        <Button type="submit" variant="contained" color="primary">Add Participant</Button>
      </form>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Age</TableCell>
              <TableCell>Gender</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {participants.map((participant) => (
              <TableRow key={participant.id}>
                <TableCell>{participant.name}</TableCell>
                <TableCell>{participant.email}</TableCell>
                <TableCell>{participant.age}</TableCell>
                <TableCell>{participant.gender}</TableCell>
                <TableCell>
                  <Button onClick={() => handleDelete(participant.id)} variant="contained" color="secondary">Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default Participants;
