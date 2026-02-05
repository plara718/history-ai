import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: [
      '"Noto Sans JP"',
      '"Helvetica"',
      '"Arial"',
      'sans-serif',
    ].join(','),
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  palette: {
    background: {
      default: '#f8fafc',
    },
    primary: {
      main: '#4f46e5', 
      light: '#e0e7ff',
      dark: '#3730a3',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#059669',
      light: '#d1fae5',
      dark: '#065f46',
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444',
      light: '#fef2f2',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    // ★ここを追加: 常にスクロールバーを表示してガタつきを防ぐ
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          overflowY: 'scroll', 
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default theme;