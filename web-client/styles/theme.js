import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#8b5cf6', // Modern purple (used across all pages)
      light: '#a78bfa',
      dark: '#7c3aed',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#10b981', // Modern green
      light: '#34d399',
      dark: '#059669',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0f0f0f', // Very dark background
      paper: '#1a1a1a', // Card background (consistent with all pages)
    },
    text: {
      primary: '#ffffff',
      secondary: '#888888', // Consistent secondary text color
      disabled: '#555555',
    },
    error: {
      main: '#ef4444', // Modern red
      light: '#f87171',
      dark: '#dc2626',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f59e0b', // Modern orange
      light: '#fbbf24',
      dark: '#d97706',
      contrastText: '#ffffff',
    },
    info: {
      main: '#3b82f6', // Modern blue
      light: '#60a5fa',
      dark: '#2563eb',
      contrastText: '#ffffff',
    },
    success: {
      main: '#10b981', // Modern green (consistent)
      light: '#34d399',
      dark: '#059669',
      contrastText: '#ffffff',
    },
    navBar: {
      main: '#000000', // Black
      contrastText: '#ffffff',
    },
    // Custom colors for consistent theming
    grey: {
      50: '#f9fafb',
      100: '#f3f4f6', 
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    // Borders and dividers
    divider: '#333333',
  },
  typography: {
    fontFamily: '"SF Pro Display", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.015em',
      color: '#ffffff',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
      color: '#ffffff',
    },
    h3: {
      fontWeight: 600,
      letterSpacing: '-0.005em',
      color: '#ffffff',
    },
    h4: {
      fontWeight: 600,
      letterSpacing: '0em',
      color: '#ffffff',
    },
    h5: {
      fontWeight: 500,
      letterSpacing: '0.005em',
      color: '#ffffff',
    },
    h6: {
      fontWeight: 500,
      letterSpacing: '0.01em',
      color: '#ffffff',
    },
    body1: {
      letterSpacing: '0.015em',
      color: '#ffffff',
    },
    body2: {
      letterSpacing: '0.01em',
      color: '#cccccc',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#000000',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '12px 24px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          backgroundColor: '#8b5cf6',
          '&:hover': {
            backgroundColor: '#7c3aed',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          borderRadius: 12,
          border: '1px solid #333333',
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          border: '1px solid #333333',
          borderRadius: 12,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a1a',
          border: '1px solid #333333',
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#1a1a1a',
            borderRadius: 8,
            '& fieldset': {
              borderColor: '#333333',
            },
            '&:hover fieldset': {
              borderColor: '#8b5cf6',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#8b5cf6',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#888888',
          },
          '& .MuiInputBase-input': {
            color: '#ffffff',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        outlined: {
          transform: 'translate(14px, 16px) scale(1)',
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -6px) scale(0.75)',
            color: '#8b5cf6',
            backgroundColor: 'transparent',
            padding: '0 4px',
            zIndex: 1,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#333333',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#8b5cf6',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#8b5cf6',
          },
          '& fieldset': {
            top: '-5px',
          },
        },
        input: {
          padding: '16.5px 14px',
          color: '#ffffff',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          border: '1px solid #333333',
          borderRadius: 12,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#111111',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#333333',
        },
        head: {
          color: '#8b5cf6',
          fontWeight: 600,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#222222',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardSuccess: {
          backgroundColor: '#065f46',
          color: '#10b981',
          '& .MuiAlert-icon': {
            color: '#10b981',
          },
        },
        standardError: {
          backgroundColor: '#7f1d1d',
          color: '#ef4444',
          '& .MuiAlert-icon': {
            color: '#ef4444',
          },
        },
        standardWarning: {
          backgroundColor: '#78350f',
          color: '#f59e0b',
          '& .MuiAlert-icon': {
            color: '#f59e0b',
          },
        },
        standardInfo: {
          backgroundColor: '#1e3a8a',
          color: '#3b82f6',
          '& .MuiAlert-icon': {
            color: '#3b82f6',
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: '#8b5cf6',
          },
          '&.Mui-checked + .MuiSwitch-track': {
            backgroundColor: '#8b5cf6',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          paddingTop: '16.5px',
          paddingBottom: '16.5px',
          color: '#ffffff',
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          marginTop: '8px',
          marginBottom: '4px',
        },
      },
    },
    MuiBox: {
      styleOverrides: {
        root: {
          '&.device-container': {
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: 3,
            maxWidth: '100%',
            margin: '0 auto'
          }
        }
      }
    }
  },
});

export default theme;
