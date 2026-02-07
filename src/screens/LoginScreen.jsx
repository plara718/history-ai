import React, { useState } from 'react';
import { 
  Box, Button, Typography, Container, Paper, TextField, 
  InputAdornment, IconButton, Alert, CircularProgress, Stack 
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Login as LoginIcon, 
  Psychology as BrainIcon 
} from '@mui/icons-material';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Firebaseでログイン実行
      await signInWithEmailAndPassword(auth, email, password);
      // 成功時はApp.jsxのAuth監視が遷移させるため、ここでは何もしない
    } catch (error) {
      console.error("Login failed", error);
      
      // エラーコードを日本語メッセージに変換
      let msg = "ログインに失敗しました。";
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          msg = "メールアドレスまたはパスワードが間違っています。";
          break;
        case 'auth/too-many-requests':
          msg = "試行回数が多すぎます。しばらく待ってから再試行してください。";
          break;
        case 'auth/invalid-email':
          msg = "メールアドレスの形式が正しくありません。";
          break;
        case 'auth/network-request-failed':
          msg = "ネットワークエラーが発生しました。通信環境を確認してください。";
          break;
        default:
          msg = `エラーが発生しました (${error.code})`;
      }
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 3, sm: 5 }, 
          width: '100%', 
          borderRadius: 4, 
          border: '1px solid', 
          borderColor: 'divider',
          textAlign: 'center',
          bgcolor: 'rgba(255, 255, 255, 0.8)', // 透過背景
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* ロゴ・ヘッダーエリア */}
        <Stack alignItems="center" spacing={1} mb={4}>
          <Box 
            sx={{ 
              p: 2, 
              borderRadius: '50%', 
              bgcolor: 'primary.50', 
              color: 'primary.main',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <BrainIcon sx={{ fontSize: 36 }} />
          </Box>
          <Typography variant="h5" component="h1" fontWeight="900" color="text.primary">
            日本史AI特訓
          </Typography>
          <Typography variant="caption" color="text.secondary" fontWeight="bold">
            学習管理システム ログイン
          </Typography>
        </Stack>

        {/* エラーメッセージ */}
        {errorMsg && (
          <Alert 
            severity="error" 
            variant="filled"
            sx={{ 
              mb: 3, 
              textAlign: 'left', 
              fontSize: '0.85rem', 
              fontWeight: 'bold', 
              borderRadius: 2
            }}
          >
            {errorMsg}
          </Alert>
        )}

        {/* ログインフォーム */}
        <form onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <TextField
              label="メールアドレス"
              variant="outlined"
              fullWidth
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="email"
              placeholder="user@example.com"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />
            
            <TextField
              label="パスワード"
              variant="outlined"
              fullWidth
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="current-password"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton 
                      onClick={() => setShowPassword(!showPassword)} 
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button 
              type="submit" 
              variant="contained" 
              size="large" 
              fullWidth
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} color="inherit"/> : <LoginIcon />}
              sx={{ 
                py: 1.5, 
                borderRadius: 3, 
                fontSize: '1rem', 
                fontWeight: 'bold',
                boxShadow: 3,
                mt: 1,
                textTransform: 'none'
              }}
            >
              {isSubmitting ? '認証中...' : 'ログイン'}
            </Button>
          </Stack>
        </form>
        
        <Typography variant="caption" display="block" color="text.disabled" mt={4}>
          © 2026 Japanese History AI Tutor
        </Typography>
      </Paper>
    </Container>
  );
};

export default LoginScreen;