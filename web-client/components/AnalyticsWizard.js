import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CodeIcon from '@mui/icons-material/Code';
import TemplateIcon from '@mui/icons-material/Description';
import JavaScriptEditor from './JavaScriptEditor';
import { analyticsExamples } from './AnalyticsExamples';

/**
 * AnalyticsWizard - Modal component for creating and editing analytics reports
 * 
 * Supports JavaScript-based analytics for data processing and visualization:
 * - Name: User-friendly analytics report name
 * - Description: Description of what the analytics does
 * - Analysis Type: Category of analysis (Data Analysis, Statistical Analysis, etc.)
 * - Code: Full JavaScript script for data processing and analysis
 * 
 * For analytics execution:
 * - JavaScript scripts can access configured data storage objects
 * - Scripts should generate analysis results (statistics, metrics, reports)
 * - Results can be saved and displayed in the UI
 */

const MINIMAL_ANALYTICS_TEMPLATE = `// MGFlow Performance Analysis
// Analyze mgflow metrics and success rates

function analyzeMGFlowData(mgflowLogs, configuration, storageData) {
  /**
   * Analyze mgflow performance and trends
   * 
   * Args:
   *   mgflowLogs: Current mgflow data or array of historical logs
   *   configuration: MGFlow configuration parameters
   *   storageData: Historical data from storage (if available)
   * 
   * Returns:
   *   Analysis results object
   */
  
  // Use storage data if available, otherwise current data
  const analysisData = storageData && storageData.length > 0 ? storageData : mgflowLogs;
  
  if (!Array.isArray(analysisData)) {
    return { error: 'Invalid data format' };
  }
  
  const results = {
    analysis_type: 'mgflow_performance',
    timestamp: new Date().toISOString(),
    configuration: configuration || {},
    total_mgflows: analysisData.length,
    results: {}
  };
  
  // Calculate basic performance metrics
  let successCount = 0;
  let totalExecutionTime = 0;
  const errorTypes = {};
  
  analysisData.forEach((mgflow, index) => {
    const mgflowName = mgflow.name || \`MGFlow_\${index + 1}\`;
    
    // Track success rate
    if (mgflow.status === 'success') {
      successCount++;
    }
    
    // Track execution time
    if (mgflow.execution_time) {
      totalExecutionTime += mgflow.execution_time;
    }
    
    // Categorize errors
    if (mgflow.status === 'error' && mgflow.error_type) {
      errorTypes[mgflow.error_type] = (errorTypes[mgflow.error_type] || 0) + 1;
    }
    
    results.results[mgflowName] = {
      status: mgflow.status || 'unknown',
      execution_time: mgflow.execution_time || 0,
      error_type: mgflow.error_type || null,
      resources_used: mgflow.resources_used || 'unknown'
    };
  });
  
  // Summary statistics
  const successRate = ((successCount / analysisData.length) * 100);
  const avgExecutionTime = totalExecutionTime / analysisData.length;
  
  results.summary = {
    total_mgflows: analysisData.length,
    success_rate: successRate.toFixed(2),
    avg_execution_time: avgExecutionTime.toFixed(2),
    error_types: errorTypes,
    most_common_error: Object.keys(errorTypes).reduce((a, b) => 
      errorTypes[a] > errorTypes[b] ? a : b, null)
  };
  
  return results;
}`;

const AnalyticsWizard = ({ open, onClose, onSubmit, editingAnalytics = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    analysis_type: '',
    code: ''
  });
  const [error, setError] = useState('');
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState(null);

  // Initialize form for editing
  React.useEffect(() => {
    if (editingAnalytics) {
      setFormData({
        name: editingAnalytics.name || '',
        description: editingAnalytics.description || '',
        analysis_type: editingAnalytics.analysis_type || '',
        code: editingAnalytics.parameters || '' // parameters field stores the JavaScript code
      });
    } else {
      // Reset form for new analytics with minimal template
      setFormData({
        name: '',
        description: '',
        analysis_type: 'Data Analysis',
        code: MINIMAL_ANALYTICS_TEMPLATE
      });
    }
  }, [editingAnalytics, open]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setError('Analytics name is required');
      return;
    }

    if (!formData.analysis_type.trim()) {
      setError('Analysis type is required');
      return;
    }

    if (!formData.code.trim()) {
      setError('JavaScript script is required');
      return;
    }

    // Submit the analytics data
    const analyticsData = {
      name: formData.name,
      description: formData.description,
      analysis_type: formData.analysis_type,
      parameters: formData.code, // Store JavaScript code in parameters field
      results: {} // Empty results initially
    };

    onSubmit(analyticsData);
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      analysis_type: '',
      code: ''
    });
    setError('');
    onClose();
  };

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setError(''); // Clear error when user starts typing
  };

  // Template menu handlers
  const handleTemplateMenuOpen = (event) => {
    setTemplateMenuAnchor(event.currentTarget);
  };

  const handleTemplateMenuClose = () => {
    setTemplateMenuAnchor(null);
  };

  const handleTemplateSelect = (templateKey) => {
    const selectedTemplate = analyticsExamples[templateKey];
    if (selectedTemplate) {
      setFormData(prev => ({
        ...prev,
        code: selectedTemplate
      }));
    }
    handleTemplateMenuClose();
  };

  const templateOptions = [
    { key: 'powerSpectrum', label: 'Power Spectrum Analysis', description: 'Calculate frequency domain power distribution' },
    { key: 'bandPowerAnalysis', label: 'Band Power Analysis', description: 'Analyze power in specific frequency bands' },
    { key: 'artifactDetection', label: 'Artifact Detection', description: 'Identify and flag signal artifacts' },
    { key: 'coherenceAnalysis', label: 'Coherence Analysis', description: 'Measure synchronization between channels' }
  ];

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="xl" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
          height: '90vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ color: 'white', borderBottom: '1px solid #333', pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AnalyticsIcon sx={{ color: '#8b5cf6' }} />
            <Typography variant="h6">
              {editingAnalytics ? 'Edit Analytics Report' : 'New Analytics Report'}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ color: '#888' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: '#1a1a1a', color: 'white', p: 3, display: 'flex', flexDirection: 'column', height: 'calc(90vh - 120px)' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, bgcolor: '#2d1b1b', color: '#ff6b6b' }}>
            {error}
          </Alert>
        )}

        {/* Analytics Name and Description */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField 
            label="Analytics Name" 
            value={formData.name} 
            onChange={handleInputChange('name')} 
            required 
            fullWidth
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
            placeholder="e.g., EEG Power Spectrum Analysis"
          />
          
          <FormControl 
            sx={{ 
              minWidth: 200,
              '& .MuiOutlinedInput-root': { 
                bgcolor: '#1a1a1a', 
                '& fieldset': { borderColor: '#333' },
                '&:hover fieldset': { borderColor: '#8b5cf6' },
                '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
              },
              '& .MuiInputLabel-root': { color: '#888' },
              '& .MuiSelect-select': { color: 'white' }
            }}
          >
            <InputLabel>Analysis Type</InputLabel>
            <Select
              value={formData.analysis_type}
              onChange={handleInputChange('analysis_type')}
              label="Analysis Type"
            >
              <MenuItem value="Data Visualization">Data Visualization</MenuItem>
              <MenuItem value="Performance Analysis">Performance Analysis</MenuItem>
              <MenuItem value="Error Analysis">Error Analysis</MenuItem>
              <MenuItem value="Resource Monitoring">Resource Monitoring</MenuItem>
              <MenuItem value="Statistical Analysis">Statistical Analysis</MenuItem>
              <MenuItem value="Machine Learning">Machine Learning</MenuItem>
              <MenuItem value="Custom Report">Custom Report</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <TextField 
          label="Description" 
          value={formData.description} 
          onChange={handleInputChange('description')} 
          fullWidth
          multiline
          rows={2}
          sx={{ 
            mb: 3,
            '& .MuiOutlinedInput-root': { 
              bgcolor: '#1a1a1a', 
              '& fieldset': { borderColor: '#333' },
              '&:hover fieldset': { borderColor: '#8b5cf6' },
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' }
            },
            '& .MuiInputLabel-root': { color: '#888' },
            '& .MuiInputBase-input': { color: 'white' }
          }}
          placeholder="Describe what this analytics report does and what insights it provides"
        />

        {/* JavaScript Script Editor */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CodeIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
          <Typography variant="h6" sx={{ color: '#8b5cf6', fontWeight: 600 }}>
            Analytics Script
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', ml: 1 }}>
            (Drag bottom-right corner to resize)
          </Typography>
          <Box sx={{ ml: 'auto' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TemplateIcon />}
              onClick={handleTemplateMenuOpen}
              sx={{
                color: '#8b5cf6',
                borderColor: '#8b5cf6',
                '&:hover': {
                  borderColor: '#a855f7',
                  bgcolor: 'rgba(139, 92, 246, 0.1)'
                }
              }}
            >
              Templates
            </Button>
          </Box>
        </Box>

        {/* Script Editor Container */}
        <JavaScriptEditor
          value={formData.code}
          onChange={handleInputChange('code')}
          height="400px"
          filename="analytics_script.js"
        />

        {/* Help Text */}
        <Box sx={{ mt: 2, p: 2, bgcolor: '#111', borderRadius: 1, border: '1px solid #333' }}>
          <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
            <strong style={{ color: '#8b5cf6' }}>Tips for Analytics Scripts:</strong>
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', display: 'block', lineHeight: 1.5 }}>
            • Define a <code style={{ color: '#8b5cf6' }}>analyzeEEGData(data, channels, sampleRate, storageData)</code> function as your main entry point<br/>
            • Access storage connections via the <code style={{ color: '#8b5cf6' }}>storageData</code> parameter<br/>
            • Use console.log for debugging<br/>
            • Return results as an object with computed metrics and metadata<br/>
            • Consider data types: EEG signals, behavioral data, external databases<br/>
            • Include error handling for missing or malformed data
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ bgcolor: '#1a1a1a', borderTop: '1px solid #333', p: 3 }}>
        <Button 
          onClick={handleClose}
          sx={{ color: '#888', '&:hover': { bgcolor: '#333' } }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          sx={{
            bgcolor: '#8b5cf6',
            '&:hover': { bgcolor: '#7c3aed' },
            ml: 2,
            px: 3
          }}
        >
          {editingAnalytics ? 'Update' : 'Create'} Analytics
        </Button>
      </DialogActions>

      {/* Templates Menu */}
      <Menu
        anchorEl={templateMenuAnchor}
        open={Boolean(templateMenuAnchor)}
        onClose={handleTemplateMenuClose}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 2,
            mt: 1
          }
        }}
      >
        {templateOptions.map((template) => (
          <MenuItem
            key={template.key}
            onClick={() => handleTemplateSelect(template.key)}
            sx={{
              color: 'white',
              '&:hover': {
                bgcolor: '#333'
              },
              py: 1.5
            }}
          >
            <ListItemIcon>
              <AnalyticsIcon sx={{ color: '#8b5cf6' }} />
            </ListItemIcon>
            <ListItemText
              primary={template.label}
              secondary={template.description}
              primaryTypographyProps={{
                sx: { color: 'white', fontWeight: 500 }
              }}
              secondaryTypographyProps={{
                sx: { color: '#888', fontSize: '0.75rem' }
              }}
            />
          </MenuItem>
        ))}
      </Menu>
    </Dialog>
  );
};

export default AnalyticsWizard; 