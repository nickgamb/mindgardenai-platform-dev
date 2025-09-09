import React, { useState, useMemo } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Button, IconButton, Menu, MenuItem, useMediaQuery } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Link from 'next/link';
import Image from 'next/image';
import { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useTheme } from '@mui/material/styles';
import ServerStatusIndicator from './ServerStatusIndicator';
import GlobalErrorHandler from './GlobalErrorHandler';

const NavItems = ({ menuItems, navButtonStyle, logout }) => (
  <Box sx={{ display: 'flex' }}>
    {menuItems.map((text) => (
      <Link key={text} href={text === 'Home' ? '/' : `/${text.toLowerCase()}`} passHref>
        <Button sx={navButtonStyle}>
          {text}
        </Button>
      </Link>
    ))}
    <Button sx={navButtonStyle} onClick={logout}>
      Logout
    </Button>
  </Box>
);

const Layout = ({ children }) => {
  const theme = useTheme();
  const { 
    logout, 
    isAuthenticated, 
    isAuthorized, 
    user, 
    error, 
    isErrorVisible, 
    clearError 
  } = useContext(AppContext);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState(null);

  const navButtonStyle = {
    color: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: 'rgba(139, 92, 246, 0.08)',
    },
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const allMenuItems = [
    { text: 'Home', permission: 'index:get' },
    { text: 'Chat', permission: 'chat:get' },
    { text: 'MGFlows', permission: 'mgflows:get' },
    { text: 'Devices', permission: 'devices:get' },
    { text: 'Experiments', permission: 'experiments:get' },
    { text: 'Graph', permission: 'graph:get' },
    // { text: 'Participants', permission: 'participants:get' }, // Temporarily removed from nav - may be deprecated
    { text: 'Files', permission: 'files:get' },
    { text: 'Transforms', permission: 'transforms:get' },
    { text: 'Storage', permission: 'storage:get' },
    // { text: 'Models', permission: 'models:get' }, // Redundant with AI-core integration - consider removing
    { text: 'APIs', permission: 'apis:get' },
    { text: 'Analytics', permission: 'analytics:get' },
    { text: 'Settings', permission: 'settings:get' },
    { text: 'API-Docs', permission: 'api-docs:get' }
  ];

  const filteredMenuItems = useMemo(() => {
    // Check if RBAC is enabled
    const enableRbac = process.env.NEXT_PUBLIC_ENABLE_RBAC === 'true';
    
    if (!enableRbac) {
      // RBAC disabled - show all menu items for authenticated users
      // Feature flag: hide Devices if NeuroTech disabled
      const neuroEnabled = typeof window !== 'undefined' && localStorage.getItem('feature_neuroTechWorkloads') !== 'false';
      return allMenuItems
        .filter(item => neuroEnabled ? true : item.text !== 'Devices')
        .map(item => item.text);
    }
    
    // RBAC enabled - filter based on permissions
    if (!user || !user.permissions) return ['Home', 'API-Docs']; // TODO: Get this from config
    
    const isSuperAdmin = user.permissions.includes('mindgardenai-admin');
    
    if (isSuperAdmin) {
      const neuroEnabled = typeof window !== 'undefined' && localStorage.getItem('feature_neuroTechWorkloads') !== 'false';
      return allMenuItems
        .filter(item => neuroEnabled ? true : item.text !== 'Devices')
        .map(item => item.text);
    }
    
    const neuroEnabled = typeof window !== 'undefined' && localStorage.getItem('feature_neuroTechWorkloads') !== 'false';
    return allMenuItems.filter(item => 
      user.permissions.includes(item.permission) || 
      item.permission === 'index:get' || // TODO: Get this from config
      item.permission === 'api-docs:get' // TODO: Get this from config
    ).filter(item => neuroEnabled ? true : item.text !== 'Devices')
    .map(item => item.text);
  }, [user]);

  console.log('Layout render:', { isAuthenticated, isAuthorized, user });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <GlobalErrorHandler 
        error={isErrorVisible ? error : null}
        onClearError={clearError}
        onRetry={() => {
          // You can add retry logic here if needed
          clearError();
        }}
      />
      <AppBar position="static" sx={{ backgroundColor: theme.palette.navBar.main }}>
        <Toolbar sx={{ flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Image src="/logo.png" alt="Customer Logo" width={40} height={40} />
            <Typography variant="h6" sx={{ ml: 2, color: theme.palette.primary.main, fontSize: isMobile ? '1rem' : '1.25rem' }}>
              <a style={{ color: theme.palette.primary.main }}>
                MIND<Box component="span" sx={{ fontWeight: 700 }}>GARDEN</Box>
              </a>
            </Typography>
          </Box>
          {isAuthenticated && isAuthorized ? (
            isMobile ? (
              <>
                <IconButton
                  size="large"
                  edge="start"
                  color="inherit"
                  aria-label="menu"
                  onClick={handleMenu}
                >
                  <MenuIcon />
                </IconButton>
                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  PaperProps={{
                    sx: {
                      backgroundColor: theme.palette.navBar.main,
                      width: '200px',
                    },
                  }}
                >
                  {filteredMenuItems.map((text) => (
                    <MenuItem key={text} onClick={handleClose} sx={{ padding: 0 }}>
                      <Link href={text === 'Home' ? '/' : `/${text.toLowerCase()}`} passHref style={{ width: '100%' }}>
                        <Button 
                          sx={{ 
                            ...navButtonStyle, 
                            justifyContent: 'center', 
                            width: '100%', 
                            textAlign: 'center', 
                            py: 1,
                            '&:hover': {
                              backgroundColor: 'rgba(139, 92, 246, 0.08)',
                            },
                          }}
                        >
                          {text}
                        </Button>
                      </Link>
                    </MenuItem>
                  ))}
                  <MenuItem sx={{ padding: 0 }}>
                    <Button 
                      sx={{ 
                        ...navButtonStyle, 
                        justifyContent: 'center', 
                        width: '100%', 
                        textAlign: 'center', 
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'rgba(139, 92, 246, 0.08)',
                        },
                      }}                  
                      onClick={async () => { 
                        handleClose(); 
                        await logout(); 
                      }}
                    >
                      Logout
                    </Button>
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <NavItems
                menuItems={filteredMenuItems}
                navButtonStyle={navButtonStyle}
                logout={logout}
              />
            )
          ) : isAuthenticated ? (
            <Typography>Authenticated but not authorized</Typography>
          ) : (
            <Typography>Not authenticated</Typography>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 4, flexGrow: 1, px: isMobile ? 2 : 3 }}>
        {isAuthenticated ? (
          isAuthorized ? (
            children
          ) : (
            <Box sx={{ textAlign: 'center', mt: 4 }}>
              <Typography variant="h5" color="error" gutterBottom>
                You are not authorized to access this application.
              </Typography>
              <Typography variant="body1" gutterBottom>
                Please contact <Link href="https://mindgardenai.com/contact" passHref>
                  <a style={{ color: theme.palette.primary.main }}>MindGarden AI</a>
                </Link> to request access.
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={logout} 
                sx={{ mt: 2 }}
              >
                Logout
              </Button>
            </Box>
          )
        ) : (
          children
        )}
      </Container>
      <Box component="footer" sx={{ bgcolor: theme.palette.navBar.main, color: theme.palette.primary.main, py: 3, mt: 'auto' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
            <Typography variant="body2" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem', textAlign: 'center' }}>
              © 2025 MindGarden LLC - MindGarden Platform - All Rights Reserved
            </Typography>
            {isAuthenticated && <ServerStatusIndicator sx={{ mt: 1 }} />}
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;
