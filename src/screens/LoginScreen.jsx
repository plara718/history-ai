import React, { useState } from 'react';
import { 
  Box, Button, Typography, Container, Paper, TextField, 
  InputAdornment, IconButton, Alert, CircularProgress 
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
      // 成功するとApp.jsxのonAuthStateChangedが検知して自動的に画面遷移します
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login failed", error);
      
      // エラーコードを日本語メッセージに変換
      let msg = "ログインに失敗しました。";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = "メールアドレスまたはパスワードが間違っています。";
      } else if (error.code === 'auth/too-many-requests') {
        msg = "試行回数が多すぎます。しばらく待ってから再試行してください。";
      } else if (error.code === 'auth/invalid-email') {
        msg = "メールアドレスの形式が正しくありません。";
      } else if (error.code === 'auth/network-request-failed') {
        msg = "ネットワークエラーが発生しました。通信環境を確認してください。";
      }
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 4, 
          width: '100%', 
          borderRadius: 4, 
          border: '1px solid', 
          borderColor: 'divider',
          textAlign: 'center',
          bgcolor: 'rgba(255, 255, 255, 0.95)', // 少し透過させてモダンに
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)'
        }}
      >
        {/* ロゴ・ヘッダーエリア */}
        <Box mb={4} display="flex" flexDirection="column" alignItems="center">
          <Box 
            sx={{ 
              p: 2, 
              borderRadius: '50%', 
              bgcolor: 'primary.light', // テーマカラーに合わせる
              color: 'primary.main',
              mb: 2,
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' 
            }}
          >
            <BrainIcon sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h5" component="h1" fontWeight="900" color="text.primary" gutterBottom>
            日本史AI特訓
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
            管理者・生徒用ログイン
          </Typography>
        </Box>

        {/* エラーメッセージ表示 */}
        {errorMsg && (
          <Alert 
            severity="error" 
            variant="filled"
            sx={{ 
              mb: 3, 
              textAlign: 'left', 
              fontSize: '0.85rem', 
              fontWeight: 'bold', 
              borderRadius: 2,
              boxShadow: 2
            }}
          >
            {errorMsg}
          </Alert>
        )}

        {/* ログインフォーム */}
        <form onSubmit={handleSubmit}>
          <Box display="flex" flexDirection="column" gap={2.5}>
            <TextField
              label="メールアドレス"
              variant="outlined"
              fullWidth
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
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
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
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
              sx={{ 
                py: 1.5, 
                borderRadius: 3, 
                fontSize: '1rem', 
                fontWeight: 'bold',
                boxShadow: 3,
                mt: 1,
                textTransform: 'none'
              }}
              startIcon={isSubmitting ? <CircularProgress size={20} color="inherit"/> : <LoginIcon />}
            >
              {isSubmitting ? '認証中...' : 'ログイン'}
            </Button>
          </Box>
        </form>
        
        <Typography variant="caption" display="block" color="text.disabled" mt={4}>
          © 2026 Japanese History AI Tutor
        </Typography>
      </Paper>
    </Container>
  );
};

export default LoginScreen;