import { useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '../contexts/AppContext';
import LoginButton from '../components/LoginButton';
import { 
  Typography, 
  Box, 
  Container, 
  Button, 
  Link, 
  CircularProgress, 
  Paper,
  Grid,
  Chip,
  Avatar,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import Image from 'next/image';
import { useTheme } from '@mui/material/styles';
import { 
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  Science as ScienceIcon,
  Storage as StorageIcon,
  Devices as DevicesIcon,
  Rocket as RocketIcon,
  School as SchoolIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';

const Home = () => {
  const theme = useTheme();
  const router = useRouter();
  const { isAuthenticated, isAuthorized, isLoading, user, logout } = useContext(AppContext);

  useEffect(() => {
  }, [isAuthenticated, isLoading, user]);

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 8 }}>
        <CircularProgress color="primary" />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading...</Typography>
      </Container>
    );
  }

  if (!isAuthenticated || !isAuthorized) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 4, sm: 8 } }}>
        <Paper sx={{
          p: { xs: 4, sm: 6, md: 8 },
          textAlign: 'center',
          bgcolor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 3
        }}>
          <Box sx={{ mb: 4 }}>
            <Image src="/logo.png" alt="MindGarden AI Logo" width={120} height={120} />
          </Box>
          <Typography variant="h3" gutterBottom sx={{ 
            color: 'white', 
            fontWeight: 700, 
            mb: 2,
            fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' }, // Responsive font sizes
            lineHeight: 1.2
          }}>
            Welcome to{' '}
            <Box component="span" sx={{ 
              color: '#8b5cf6',
              display: { xs: 'block', sm: 'inline' }, // Stack on mobile, inline on larger screens
              lineHeight: 1.1
            }}>
              MindGarden <Box component="span" sx={{ fontWeight: 800 }}>Platform</Box>
            </Box>
          </Typography>
          <Typography variant="h6" sx={{ 
            color: '#888', 
            mb: 4, 
            maxWidth: 500, 
            mx: 'auto',
            fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' },
            px: { xs: 2, sm: 0 } // Add padding on mobile
          }}>
            MindGarden Platform
          </Typography>
          <Typography variant="body1" sx={{ 
            color: '#ccc', 
            mb: 4,
            px: { xs: 2, sm: 0 }
          }}>
            Please log in to access your MG Platform dashboard.
          </Typography>
          <LoginButton />
          
          <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid #333' }}>
            <Typography variant="body2" sx={{ color: '#666' }}>
              Need access? Contact{' '}
              <Link href="https://mindgardenai.com/contact" sx={{ color: '#8b5cf6', textDecoration: 'none' }}>
                MindGarden AI Support
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  const quickAccessItems = [
    { name: 'MGFlows', icon: <RocketIcon />, color: '#8b5cf6', desc: 'Manage mgflow workflows', path: '/mgflows' },
    { name: 'Files', icon: <DevicesIcon />, color: '#10b981', desc: 'File upload and management', path: '/files' },
    { name: 'Analytics', icon: <AnalyticsIcon />, color: '#8b5cf6', desc: 'MGFlow analytics and reporting', path: '/analytics' },
    { name: 'Storage', icon: <StorageIcon />, color: '#3b82f6', desc: 'Data storage solutions', path: '/storage' },
    { name: 'APIs', icon: <ScienceIcon />, color: '#ef4444', desc: 'API connections and integrations', path: '/apis' },
    { name: 'Transforms', icon: <FilterListIcon />, color: '#f59e0b', desc: 'ETL data transformations', path: '/transforms' },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Section */}
      <Paper sx={{
        p: 4,
        mb: 4,
        bgcolor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 3,
        textAlign: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, mb: 3 }}>
          <Avatar
            src={user?.picture}
            sx={{
              width: 80,
              height: 80,
              border: '3px solid #8b5cf6'
            }}
          >
            {!user?.picture && <PersonIcon sx={{ fontSize: 40 }} />}
          </Avatar>
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
              Welcome back, {user?.name || 'User'}! 👋
            </Typography>
            <Typography variant="body1" sx={{ color: '#888', mb: 1 }}>
              {user?.email}
            </Typography>
            {user?.permissions && user.permissions.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {user.permissions.slice(0, 3).map((permission, index) => (
                  <Chip
                    key={index}
                    label={permission}
                    size="small"
                    sx={{
                      bgcolor: '#8b5cf6',
                      color: 'white',
                      fontWeight: 500
                    }}
                  />
                ))}
                {user.permissions.length > 3 && (
                  <Chip
                    label={`+${user.permissions.length - 3} more`}
                    size="small"
                    sx={{
                      bgcolor: '#333',
                      color: '#888'
                    }}
                  />
                )}
              </Box>
            ) : null}
          </Box>
        </Box>

        {process.env.NEXT_PUBLIC_ENABLE_RBAC === 'true' && (!user?.permissions || user.permissions.length === 0) ? (
          <Box sx={{
            mt: 3,
            p: 3,
            bgcolor: '#2d1b1b',
            borderRadius: 2,
            border: '1px solid #d32f2f'
          }}>
            <Typography variant="body1" sx={{ color: '#ff6b6b', mb: 2 }}>
              ⚠️ No permissions assigned
            </Typography>
            <Typography variant="body2" sx={{ color: '#ccc', mb: 2 }}>
              You currently have no permissions. Please contact MindGarden AI to request access.
            </Typography>
            <Button
              href="https://mindgardenai.com/contact"
              target="_blank"
              variant="outlined"
              sx={{
                color: '#ff6b6b',
                borderColor: '#ff6b6b',
                '&:hover': {
                  borderColor: '#ff4757',
                  bgcolor: 'rgba(255, 107, 107, 0.1)'
                }
              }}
            >
              Contact Support
            </Button>
          </Box>
        ) : (
          <Typography variant="body1" sx={{ color: '#888' }}>
            Ready to continue your mgflows? Choose a tool below to get started.
          </Typography>
        )}
      </Paper>

      {/* Quick Access Grid */}
      {(process.env.NEXT_PUBLIC_ENABLE_RBAC !== 'true' || (user?.permissions && user.permissions.length > 0)) && (
        <>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 3 }}>
            🚀 Quick Access
          </Typography>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {quickAccessItems.map((item, index) => (
                             <Grid item xs={12} sm={6} md={4} key={index}>
                 <Card 
                   onClick={() => router.push(item.path)}
                   sx={{
                     bgcolor: '#1a1a1a',
                     border: '1px solid #333',
                     borderRadius: 2,
                     transition: 'all 0.2s',
                     cursor: 'pointer',
                     '&:hover': {
                       borderColor: item.color,
                       transform: 'translateY(-2px)',
                       boxShadow: `0 8px 25px rgba(${item.color === '#8b5cf6' ? '139, 92, 246' : 
                         item.color === '#10b981' ? '16, 185, 129' :
                         item.color === '#3b82f6' ? '59, 130, 246' :
                         item.color === '#ef4444' ? '239, 68, 68' :
                         item.color === '#f59e0b' ? '245, 158, 11' : '139, 92, 246'}, 0.3)`
                     }
                   }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box sx={{ color: item.color }}>
                        {item.icon}
                      </Box>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                        {item.name}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                      {item.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* Bottom Actions */}
      <Paper sx={{
        p: 4,
        bgcolor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 3
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
              Account Settings
            </Typography>
            <Typography variant="body2" sx={{ color: '#888' }}>
              Manage your profile, preferences, and security settings.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
                         <Button
               startIcon={<SettingsIcon />}
               onClick={() => router.push('/settings')}
               variant="outlined"
               sx={{
                 color: '#8b5cf6',
                 borderColor: '#8b5cf6',
                 '&:hover': {
                   borderColor: '#7c3aed',
                   bgcolor: 'rgba(139, 92, 246, 0.1)'
                 }
               }}
             >
               Settings
             </Button>
            <Button
              onClick={logout}
              variant="contained"
              sx={{
                bgcolor: '#ef4444',
                '&:hover': { bgcolor: '#dc2626' },
                fontWeight: 600,
                px: 3,
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none'
              }}
            >
              Logout
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Home;
