import React, { useState, useRef } from 'react';
import { Box, IconButton, InputBase, Paper, Button, Modal } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import VoiceRecording from './VoiceRecording';

const ChatInput = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const [showVoice, setShowVoice] = useState(false);
  const inputRef = useRef();

  const handleSend = () => {
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  const handleVoiceConfirm = ({ transcription }) => {
    setInput((prev) => prev + (transcription ? (prev ? ' ' : '') + transcription : ''));
    setShowVoice(false);
    inputRef.current?.focus();
  };

  const handleVoiceCancel = () => {
    setShowVoice(false);
    inputRef.current?.focus();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', p: 0, gap: 1 }}>
      <Paper
        component="form"
        onSubmit={e => { e.preventDefault(); handleSend(); }}
        sx={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          px: 3, 
          py: 1.5, 
          borderRadius: 3,
          bgcolor: '#111111',
          border: '1px solid #333',
          '&:hover': {
            borderColor: '#444'
          },
          '&:focus-within': {
            borderColor: '#8b5cf6'
          }
        }}
        elevation={0}
      >
        <InputBase
          inputRef={inputRef}
          sx={{ 
            flex: 1, 
            fontSize: '1rem',
            color: 'white',
            '& .MuiInputBase-input': {
              '&::placeholder': {
                color: '#666',
                opacity: 1
              }
            }
          }}
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={disabled}
          multiline
          minRows={1}
          maxRows={4}
        />
        <IconButton 
          color="primary" 
          onClick={() => setShowVoice(true)} 
          disabled={disabled} 
          sx={{ 
            ml: 1,
            color: '#888',
            '&:hover': { 
              bgcolor: '#333',
              color: 'white'
            }
          }}
        >
          <MicIcon />
        </IconButton>
        <IconButton 
          color="primary" 
          type="submit" 
          disabled={disabled || !input.trim()} 
          sx={{ 
            ml: 0.5,
            color: input.trim() ? '#8b5cf6' : '#444',
            '&:hover': { 
              bgcolor: input.trim() ? 'rgba(139, 92, 246, 0.1)' : '#333',
              color: input.trim() ? '#8b5cf6' : '#666'
            },
            '&:disabled': {
              color: '#444'
            }
          }}
        >
          <SendIcon />
        </IconButton>
      </Paper>
      <Modal open={showVoice} onClose={handleVoiceCancel}>
        <Box sx={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          bgcolor: '#1a1a1a', 
          boxShadow: 24, 
          p: 4, 
          borderRadius: 2,
          border: '1px solid #333'
        }}>
          <VoiceRecording onCancel={handleVoiceCancel} onConfirm={handleVoiceConfirm} />
        </Box>
      </Modal>
    </Box>
  );
};

export default ChatInput; 