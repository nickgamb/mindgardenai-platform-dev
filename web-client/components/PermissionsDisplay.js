import React, { useState } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Collapse, IconButton, useMediaQuery, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const PermissionsDisplay = ({ permissions }) => {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const getMethodColor = (method) => {
    switch (method.toUpperCase()) {
      case 'GET': return '#61affe';
      case 'POST': return '#49cc90';
      case 'PUT': return '#fca130';
      case 'DELETE': return '#f93e3e';
      case 'PATCH': return '#50e3c2';
      default: return '#61affe';
    }
  };

  const splitPermissionName = (name) => {
    const parts = name.split(':');
    return {
      namespace: parts[0],
      method: parts[1]
    };
  };

  return (
    <Box sx={{
      backgroundColor: 'background.paper',
      borderRadius: 2,
      boxShadow: 1,
      mb: 3,
      overflow: 'hidden',
    }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: isMobile ? 1.5 : 2,
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
      }} onClick={toggleExpand}>
        <Typography variant={isMobile ? "subtitle1" : "h6"} component="h2">
          Available Permissions
        </Typography>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <List dense sx={{ maxHeight: isMobile ? '200px' : '300px', overflowY: 'auto' }}>
          {permissions.map((permission, index) => {
            const { namespace, method } = splitPermissionName(permission.name);
            return (
              <ListItem key={index} sx={{ py: isMobile ? 0.25 : 0.5 }}>
                <ListItemText 
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Typography 
                        component="span" 
                        sx={{ 
                          color: theme.palette.primary.main,
                          fontWeight: 'bold',
                          fontSize: isMobile ? '0.875rem' : '1rem'
                        }}
                      >
                        {namespace}:
                      </Typography>
                      <Chip
                        label={method.toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor: getMethodColor(method),
                          color: '#fff',
                          fontWeight: 'bold',
                          fontSize: isMobile ? '0.75rem' : '0.875rem'
                        }}
                      />
                    </Box>
                  }
                  secondary={permission.description}
                  secondaryTypographyProps={{ 
                    variant: 'caption', 
                    color: 'text.secondary',
                    fontSize: isMobile ? '0.75rem' : '0.875rem'
                  }}
                />
              </ListItem>
            );
          })}
        </List>
      </Collapse>
    </Box>
  );
};

export default PermissionsDisplay;
