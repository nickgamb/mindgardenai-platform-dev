import React from 'react';
import { Box, Switch, FormControlLabel, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

const WebSearchToggle = ({ enabled = false, onToggle = () => {}, disabled = false }) => {
  return (
    <Tooltip title="Enable web search to automatically search the internet for relevant information before generating responses">
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
              disabled={disabled}
              size="small"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <SearchIcon fontSize="small" />
              Web Search
            </Box>
          }
          sx={{ 
            margin: 0,
            '& .MuiFormControlLabel-label': {
              fontSize: '0.875rem',
              fontWeight: 500
            }
          }}
        />
      </Box>
    </Tooltip>
  );
};

export default WebSearchToggle; 