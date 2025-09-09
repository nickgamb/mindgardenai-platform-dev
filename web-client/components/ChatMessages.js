import React from 'react';
import { Box, Typography } from '@mui/material';
import ChatMarkdown from './ChatMarkdown';

const ChatMessages = ({ messages }) => {
  // Ensure messages is always an array
  const safeMessages = Array.isArray(messages) ? messages : [];
  
  return (
    <Box sx={{ 
      minHeight: 300, 
      height: '100%',
      overflowY: 'auto', 
      p: 3, 
      bgcolor: '#111111',
      color: 'white'
    }} role="log" aria-live="polite" aria-label="Chat messages">
      {safeMessages.length > 0 ? (
        safeMessages.map((msg, idx) => (
          <Box key={idx} sx={{ 
            mb: 4, 
            maxWidth: '100%',
            '&:last-child': { mb: 2 }
          }} role="article" aria-label={msg.role === 'user' ? 'User message' : 'AI message'}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              mb: 1.5,
              gap: 1
            }}>
              <Box sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: msg.role === 'user' ? '#8b5cf6' : '#1a1a1a',
                border: msg.role === 'user' ? 'none' : '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 600,
                color: msg.role === 'user' ? '#111111' : '#8b5cf6'
              }}>
                {msg.role === 'user' ? 'U' : 'AI'}
              </Box>
              <Typography variant="subtitle2" sx={{ 
                color: msg.role === 'user' ? '#8b5cf6' : '#8b5cf6',
                fontWeight: 600,
                fontSize: '0.875rem'
              }}>
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </Typography>
            </Box>
            <Box sx={{ 
              ml: 5,
              '& .MuiTypography-root': { 
                color: '#e5e5e5',
                lineHeight: 1.6
              },
              '& pre': {
                bgcolor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 1,
                color: '#e5e5e5'
              },
              '& code': {
                bgcolor: '#1a1a1a',
                border: '1px solid #333',
                color: '#8b5cf6'
              }
            }}>
              <ChatMarkdown content={msg.content} />
            </Box>
          </Box>
        ))
      ) : (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          py: 8
        }}>
          <Typography variant="h5" sx={{ color: '#666', mb: 2, fontWeight: 500 }}>
            Welcome to MindGarden Chat
          </Typography>
          <Typography variant="body1" sx={{ color: '#888', maxWidth: 400 }}>
            Start a conversation by typing a message below. You can ask questions, get help with tasks, or just chat!
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ChatMessages; 