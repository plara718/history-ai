import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: [
      '"Noto Sans JP"',
      '"Helvetica Neue"',
      '"Arial"',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  palette: {
    background: {
      default: '#f8fafc', // slate-50
      paper: '#ffffff',
    },
    primary: {
      main: '#4f46e5', // indigo-600
      light: '#e0e7ff', // indigo-100
      dark: '#3730a3', // indigo-800
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#059669', // emerald-600 (School mode)
      light: '#d1fae5', // emerald-100
      dark: '#065f46', // emerald-800
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444', // red-500
      light: '#fef2f2', // red-50
      dark: '#b91c1c', // red-700
    },
    warning: {
      main: '#f59e0b', // amber-500
      light: '#fffbeb', // amber-50
      dark: '#b45309', // amber-700
    },
    info: {
      main: '#3b82f6', // blue-500
      light: '#eff6ff', // blue-50
      dark: '#1d4ed8', // blue-700
    },
    text: {
      primary: '#0f172a', // slate-900
      secondary: '#64748b', // slate-500
      disabled: '#94a3b8', // slate-400
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    // グローバルスタイルのリセット補強
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          overflowY: 'scroll', // スクロールバーによるレイアウトシフト防止
          scrollbarWidth: 'thin',
        },
      },
    },
    // ボタンの形状統一
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12, // 少し丸みを抑えてモダンに
          boxShadow: 'none',
          paddingTop: '10px',
          paddingBottom: '10px',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
        sizeLarge: {
          paddingTop: '12px',
          paddingBottom: '12px',
          fontSize: '1.05rem',
        },
      },
    },
    // カード・Paperの質感
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation0: {
          border: '1px solid #e2e8f0', // slate-200
        },
      },
    },
    // チップのスタイル
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
});

export default theme;