import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardMedia,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../lib/ai-core-api';

const ImageGenerationModal = ({ open, onClose, onGenerate, disabled = false }) => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedSize, setSelectedSize] = useState('512x512');
  const [models, setModels] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [error, setError] = useState(null);

  const sizeOptions = [
    { value: '256x256', label: '256x256' },
    { value: '512x512', label: '512x512' },
    { value: '1024x1024', label: '1024x1024' },
    { value: '1792x1024', label: '1792x1024' },
    { value: '1024x1792', label: '1024x1792' }
  ];

  useEffect(() => {
    if (open) {
      loadConfig();
      loadModels();
    }
  }, [open]);

  const loadConfig = async () => {
    try {
      const configData = await api.getImageGenerationConfig();
      setConfig(configData);
      if (configData.enabled && configData.engine) {
        setSelectedModel(configData.engine);
      }
    } catch (error) {
      console.error('Failed to load image generation config:', error);
      setError('Failed to load image generation configuration');
    }
  };

  const loadModels = async () => {
    try {
      const modelsData = await api.getImageGenerationModels();
      setModels(modelsData);
      if (modelsData.length > 0 && !selectedModel) {
        setSelectedModel(modelsData[0].id);
      }
    } catch (error) {
      console.error('Failed to load image generation models:', error);
      setError('Failed to load image generation models');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedImages([]);

    try {
      const images = await api.generateImage(prompt, {
        model: selectedModel,
        size: selectedSize,
        negative_prompt: negativePrompt,
        n: 1
      });

      setGeneratedImages(images);
      if (onGenerate) {
        onGenerate(images);
      }
    } catch (error) {
      console.error('Image generation failed:', error);
      setError(error.message || 'Failed to generate image');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (imageUrl, index) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-image-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClose = () => {
    setPrompt('');
    setNegativePrompt('');
    setGeneratedImages([]);
    setError(null);
    setLoading(false);
    onClose();
  };

  if (!config?.enabled) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Image Generation</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            Image generation is not enabled. Please contact an administrator to enable this feature.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Generate Image</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            multiline
            rows={3}
            placeholder="Describe the image you want to generate..."
            disabled={disabled || loading}
          />

          <TextField
            fullWidth
            label="Negative Prompt (optional)"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            multiline
            rows={2}
            placeholder="Describe what you don't want in the image..."
            disabled={disabled || loading}
          />

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth disabled={disabled || loading}>
                <InputLabel>Model</InputLabel>
                <Select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  label="Model"
                >
                  {Array.isArray(models) ? models.map((model) => (
                    <MenuItem key={model.id} value={model.id}>
                      {model.name}
                    </MenuItem>
                  )) : null}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth disabled={disabled || loading}>
                <InputLabel>Size</InputLabel>
                <Select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  label="Size"
                >
                  {sizeOptions.map((size) => (
                    <MenuItem key={size.value} value={size.value}>
                      {size.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              <CircularProgress size={20} />
              <Typography>Generating image...</Typography>
            </Box>
          )}

          {generatedImages.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Generated Images
              </Typography>
              <Grid container spacing={2}>
                {Array.isArray(generatedImages) ? generatedImages.map((image, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Card>
                      <CardMedia
                        component="img"
                        image={image.url}
                        alt={`Generated image ${index + 1}`}
                        sx={{ height: 200, objectFit: 'cover' }}
                      />
                      <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
                        <IconButton
                          onClick={() => handleDownload(image.url, index)}
                          size="small"
                          title="Download image"
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Box>
                    </Card>
                  </Grid>
                )) : null}
              </Grid>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          variant="contained"
          disabled={disabled || loading || !prompt.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Generating...' : 'Generate Image'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageGenerationModal; 