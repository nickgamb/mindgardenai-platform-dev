import React from 'react';
import {
  Box, Typography, Card, CardContent, Grid, FormControl, InputLabel, Select, MenuItem,
  TextField, Alert, Button
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import AddIcon from '@mui/icons-material/Add';

const APIParameterMapper = ({ 
  configData, 
  setConfigData, 
  inputSources, 
  endpointParameters, 
  selectedAPI,
  inputSchema = [] // unused for now; kept for compatibility
}) => {
  // Filter parameters by location
  const queryParameters = (endpointParameters || []).filter(p => p.in === 'query');

  const addManualQueryParam = () => {
    const name = prompt('Query parameter name (e.g., include[] or limit)');
    if (!name) return;
    const value = prompt('Static value (e.g., teams or 100)');
    const newParams = {
      ...(configData.config?.parameters || {}),
      [name]: { mappingType: 'static', value }
    };
    setConfigData(prev => ({
      ...prev,
      config: { ...prev.config, parameters: newParams }
    }));
  };

  return (
    <Card sx={{ mb: 2, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
      <CardContent>
        {/* Query Parameters */}
        <Card sx={{ mb: 2, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneIcon sx={{ fontSize: 20 }} />
                Query Parameters
              </Typography>
              <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={addManualQueryParam} sx={{ color: '#8b5cf6', borderColor: '#8b5cf6' }}>
                Add
              </Button>
            </Box>

            <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(139, 92, 246, 0.1)', color: '#c4b5fd' }}>
              Configure query parameters. These will be appended to the URL for GET/DELETE requests.
            </Alert>

            <Grid container spacing={2}>
              {(queryParameters.length > 0 ? queryParameters : []).map((param) => (
                <Grid item xs={12} key={param.name}>
                  <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 1, border: '1px solid #555' }}>
                    <Grid container spacing={2}>
                      <Grid item xs={3}>
                        <Typography variant="subtitle2" sx={{ color: 'white' }}>{param.name}</Typography>
                        <Typography variant="caption" sx={{ color: '#888' }}>{param.schema?.type || 'string'}</Typography>
                      </Grid>
                      <Grid item xs={9}>
                        <FormControl fullWidth size="small">
                          <InputLabel sx={{ color: '#888' }}>Mapping Type</InputLabel>
                          <Select
                            value={configData.config?.parameters?.[param.name]?.mappingType || 'static'}
                            onChange={(e) => {
                              const newParams = {
                                ...(configData.config?.parameters || {}),
                                [param.name]: {
                                  ...(configData.config?.parameters?.[param.name] || {}),
                                  mappingType: e.target.value
                                }
                              };
                              setConfigData(prev => ({ ...prev, config: { ...prev.config, parameters: newParams } }));
                            }}
                            label="Mapping Type"
                            sx={{
                              bgcolor: '#1a1a1a',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' },
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
                              '& .MuiSelect-select': { color: 'white' }
                            }}
                          >
                            <MenuItem value="static">Static</MenuItem>
                            <MenuItem value="field">Field</MenuItem>
                            <MenuItem value="expression">Expression</MenuItem>
                          </Select>
                        </FormControl>

                        {/* Static value input */}
                        {(!configData.config?.parameters?.[param.name]?.mappingType || configData.config?.parameters?.[param.name]?.mappingType === 'static') && (
                          <TextField
                            fullWidth
                            size="small"
                            sx={{ mt: 1, '& .MuiOutlinedInput-root': { bgcolor: '#1a1a1a', '& fieldset': { borderColor: '#333' } } }}
                            label="Static Value"
                            value={configData.config?.parameters?.[param.name]?.value || ''}
                            onChange={(e) => {
                              const newParams = {
                                ...(configData.config?.parameters || {}),
                                [param.name]: {
                                  ...(configData.config?.parameters?.[param.name] || {}),
                                  mappingType: 'static',
                                  value: e.target.value
                                }
                              };
                              setConfigData(prev => ({ ...prev, config: { ...prev.config, parameters: newParams } }));
                            }}
                          />
                        )}
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              ))}

              {/* Also show any manually added params not in spec */}
              {Object.entries(configData.config?.parameters || {}).filter(([k, v]) => !(queryParameters || []).some(p => p.name === k)).map(([name, cfg]) => (
                <Grid item xs={12} key={name}>
                  <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 1, border: '1px solid #555' }}>
                    <Grid container spacing={2}>
                      <Grid item xs={3}>
                        <Typography variant="subtitle2" sx={{ color: 'white' }}>{name}</Typography>
                        <Typography variant="caption" sx={{ color: '#888' }}>manual</Typography>
                      </Grid>
                      <Grid item xs={9}>
                        <FormControl fullWidth size="small">
                          <InputLabel sx={{ color: '#888' }}>Mapping Type</InputLabel>
                          <Select
                            value={cfg?.mappingType || 'static'}
                            onChange={(e) => {
                              const newParams = { ...(configData.config?.parameters || {}) };
                              newParams[name] = { ...(cfg || {}), mappingType: e.target.value };
                              setConfigData(prev => ({ ...prev, config: { ...prev.config, parameters: newParams } }));
                            }}
                            label="Mapping Type"
                            sx={{
                              bgcolor: '#1a1a1a',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' },
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
                              '& .MuiSelect-select': { color: 'white' }
                            }}
                          >
                            <MenuItem value="static">Static</MenuItem>
                            <MenuItem value="field">Field</MenuItem>
                            <MenuItem value="expression">Expression</MenuItem>
                          </Select>
                        </FormControl>
                        {(!cfg?.mappingType || cfg?.mappingType === 'static') && (
                          <TextField
                            fullWidth
                            size="small"
                            sx={{ mt: 1, '& .MuiOutlinedInput-root': { bgcolor: '#1a1a1a', '& fieldset': { borderColor: '#333' } } }}
                            label="Static Value"
                            value={cfg?.value || ''}
                            onChange={(e) => {
                              const newParams = { ...(configData.config?.parameters || {}) };
                              newParams[name] = { ...(cfg || {}), mappingType: 'static', value: e.target.value };
                              setConfigData(prev => ({ ...prev, config: { ...prev.config, parameters: newParams } }));
                            }}
                          />
                        )}
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

export default APIParameterMapper; 