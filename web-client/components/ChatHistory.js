import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';

const ChatHistory = ({ chats, selectedChatId, onSelect }) => {
  return (
    <Box sx={{ height: '100%', overflow: 'hidden' }} role="navigation" aria-label="Chat history">
      <List sx={{ 
        bgcolor: 'transparent', 
        p: 0,
        height: '100%',
        overflow: 'auto',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: '#333',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          backgroundColor: '#444',
        }
      }}>
        {Array.isArray(chats) && chats.length > 0 ? (
          chats.map((chat) => (
            <ListItem key={chat.id || chat} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={selectedChatId === (chat.id || chat)}
                onClick={() => onSelect(chat.id || chat)}
                aria-current={selectedChatId === (chat.id || chat) ? 'page' : undefined}
                aria-label={`Chat ${chat.title || chat.id || chat}`}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: '#333',
                    '&:hover': {
                      bgcolor: '#404040',
                    }
                  },
                  '&:hover': {
                    bgcolor: '#2a2a2a',
                  },
                  py: 1.5,
                  px: 2
                }}
              >
                <ListItemText 
                  primary={
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: selectedChatId === (chat.id || chat) ? 'white' : '#ccc',
                        fontWeight: selectedChatId === (chat.id || chat) ? 600 : 400,
                        fontSize: '0.875rem',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {chat.title || `Chat ${chat.id || chat}`}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))
        ) : (
          <ListItem sx={{ px: 2, py: 3 }}>
            <ListItemText 
              primary={
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#666',
                    textAlign: 'center',
                    fontStyle: 'italic'
                  }}
                >
                  No previous chats.
                </Typography>
              }
            />
          </ListItem>
        )}
      </List>
    </Box>
  );
};

export default ChatHistory; 