import React from 'react';
import { Snackbar, Alert, Slide } from '@mui/material';

/**
 * アプリケーション全体で使用する通知トースト
 * MUIのSnackbar + Alert (Filled variant) を使用
 */
const Toast = ({ message, type = 'info', onClose }) => {
  // MUI Alertの severity に対応させる
  const severityMap = {
    info: 'info',
    success: 'success',
    error: 'error',
    warning: 'warning'
  };

  // スライドトランジション用コンポーネント
  const SlideTransition = (props) => {
    return <Slide {...props} direction="down" />;
  };

  return (
    <Snackbar 
        open={Boolean(message)} 
        autoHideDuration={4000} 
        onClose={onClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={SlideTransition}
        sx={{ 
          mt: { xs: 8, sm: 10 }, // ヘッダーを避けるためのマージン
          zIndex: (theme) => theme.zIndex.drawer + 1 // モーダルより上に表示
        }}
    >
      <Alert 
        onClose={onClose} 
        severity={severityMap[type] || 'info'} 
        variant="filled" 
        elevation={6}
        sx={{ 
          width: '100%', 
          minWidth: 300,
          borderRadius: 3, 
          fontWeight: 'bold', 
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default Toast;