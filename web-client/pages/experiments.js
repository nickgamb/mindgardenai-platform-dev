import React, { useEffect, useState, useContext } from 'react';
import { Typography, Container, Paper, Box, Button, CircularProgress } from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import AddIcon from '@mui/icons-material/Add';
import { AppContext } from '../contexts/AppContext';
import api from '../lib/api';

const Experiments = () => {
  const { isAuthenticated, isAuthorized } = useContext(AppContext);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !isAuthorized) return;
    const enabled = (typeof window !== 'undefined' && localStorage.getItem('feature_neuroTechWorkloads') !== 'false');
    if (!enabled) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api.fetchExperiments();
        setExperiments(res.experiments || []);
        setError(null);
      } catch (e) {
        setError(e.message || 'Failed to load experiments');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, isAuthorized]);

  const neuroEnabled = (typeof window !== 'undefined' && localStorage.getItem('feature_neuroTechWorkloads') !== 'false');
  if (!neuroEnabled) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Paper sx={{ p: 4, bgcolor: '#1a1a1a', border: '1px solid #333', borderRadius: 3 }}>
          <Typography variant="h5" sx={{ color: 'white', mb: 2 }}>NeuroTech Workloads Disabled</Typography>
          <Typography sx={{ color: '#888' }}>
            Enable the "NeuroTech Workloads" feature in Settings to access Experiments.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, pb: 2, borderBottom: '1px solid #333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ScienceIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 600 }}>
            Experiments
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' }, borderRadius: 2, px: 3 }}>
          New Experiment
        </Button>
      </Box>

      {error && (
        <Box sx={{ mb: 3, p: 2, bgcolor: '#2d1b1b', borderRadius: 1, border: '1px solid #d32f2f' }}>
          <Typography color="#ff6b6b">{error}</Typography>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ p: 3, bgcolor: '#111', border: '1px solid #333', borderRadius: 2 }}>
          {experiments.length === 0 ? (
            <Typography sx={{ color: '#888' }}>No experiments found.</Typography>
          ) : (
            experiments.map((e) => (
              <Box key={e.id} sx={{ p: 2, borderBottom: '1px solid #222' }}>
                <Typography sx={{ color: 'white', fontWeight: 600 }}>{e.name}</Typography>
                <Typography sx={{ color: '#888', fontSize: '0.875rem' }}>{e.description}</Typography>
              </Box>
            ))
          )}
        </Paper>
      )}
    </Container>
  );
};

export default Experiments;


