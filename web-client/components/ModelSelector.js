import React from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, TextField, Slider, Typography, Grid } from '@mui/material';

const ModelSelector = ({
  models,
  selectedModel,
  onChange,
  temperature,
  onTemperatureChange,
  systemPrompt,
  onSystemPromptChange,
  topP,
  onTopPChange,
  maxTokens,
  onMaxTokensChange,
  frequencyPenalty,
  onFrequencyPenaltyChange,
  presencePenalty,
  onPresencePenaltyChange
}) => {
  return (
    <Box sx={{ mb: 2 }}>
      <FormControl fullWidth variant="outlined" sx={{ mb: 2 }} aria-label="Model selector">
        <InputLabel id="model-select-label">Model</InputLabel>
        <Select
          labelId="model-select-label"
          value={selectedModel}
          onChange={e => onChange(e.target.value)}
          label="Model"
          inputProps={{ 'aria-label': 'Select model' }}
        >
          {Array.isArray(models) ? models.map((model) => (
            <MenuItem key={model.id || model} value={model.id || model}>
              {model.name || model}
            </MenuItem>
          )) : null}
        </Select>
      </FormControl>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Temperature</Typography>
          <Slider
            value={typeof temperature === 'number' ? temperature : 0.7}
            min={0}
            max={2}
            step={0.01}
            onChange={(_, value) => onTemperatureChange(value)}
            valueLabelDisplay="auto"
            aria-label="Temperature"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Top P</Typography>
          <Slider
            value={typeof topP === 'number' ? topP : 1}
            min={0}
            max={1}
            step={0.01}
            onChange={(_, value) => onTopPChange(value)}
            valueLabelDisplay="auto"
            aria-label="Top P"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Max Tokens</Typography>
          <TextField
            type="number"
            value={maxTokens}
            onChange={e => onMaxTokensChange(Number(e.target.value))}
            inputProps={{ min: 1, max: 4096, 'aria-label': 'Max tokens' }}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Frequency Penalty</Typography>
          <Slider
            value={typeof frequencyPenalty === 'number' ? frequencyPenalty : 0}
            min={-2}
            max={2}
            step={0.01}
            onChange={(_, value) => onFrequencyPenaltyChange(value)}
            valueLabelDisplay="auto"
            aria-label="Frequency Penalty"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography gutterBottom>Presence Penalty</Typography>
          <Slider
            value={typeof presencePenalty === 'number' ? presencePenalty : 0}
            min={-2}
            max={2}
            step={0.01}
            onChange={(_, value) => onPresencePenaltyChange(value)}
            valueLabelDisplay="auto"
            aria-label="Presence Penalty"
          />
        </Grid>
      </Grid>
      <TextField
        label="System Prompt"
        value={systemPrompt}
        onChange={e => onSystemPromptChange(e.target.value)}
        fullWidth
        multiline
        minRows={2}
        sx={{ mb: 2, mt: 2 }}
        inputProps={{ 'aria-label': 'System prompt' }}
      />
    </Box>
  );
};

export default ModelSelector; 