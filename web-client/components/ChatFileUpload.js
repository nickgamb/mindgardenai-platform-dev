import React, { useRef } from 'react';
import { Box, Button } from '@mui/material';

const ChatFileUpload = ({ onUpload, disabled }) => {
  const fileInputRef = useRef();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <Box sx={{ mt: 2 }} role="region" aria-label="File upload">
      <input
        type="file"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled}
        aria-label="Upload file"
      />
      <Button
        variant="outlined"
        color="primary"
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        disabled={disabled}
        aria-label="Upload file"
      >
        Upload File
      </Button>
    </Box>
  );
};

export default ChatFileUpload; 