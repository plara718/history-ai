import React from 'react';
import { Snackbar, Alert } from '@mui/material';

const Toast = ({ message, type = 'info', onClose }) => {
  // typeのマッピング: "error"はMUIでも"error"だが、"success"等はそのまま使える
  // アプリ独自の "info" (黒背景) は MUIの "info" (青) になるが、ここでは標準に合わせる
  const severityMap = {
    info: 'info',
    success: 'success',
    error: 'error'
  };

  return (
    <Snackbar 
        open={true} 
        autoHideDuration={4000} 
        onClose={onClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }} // ヘッダーとかぶらないように少し下げる
    >
      <Alert 
        onClose={onClose} 
        severity={severityMap[type] || 'info'} 
        variant="filled" 
        sx={{ width: '100%', borderRadius: 2, fontWeight: 'bold', boxShadow: 3 }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default Toast;