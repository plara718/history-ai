import React, { useState } from 'react';
import { 
  Box, Button, Typography, Container, Paper, TextField, 
  InputAdornment, IconButton
} from '@mui/material';
import { Brain, Eye, EyeOff, LogIn } from 'lucide-react';

const AuthScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsSubmitting(true);
    try {
      // 親から渡されたログイン関数を実行
      await onLogin(email, password);
    } catch (error) {
      // エラー処理は完了（Toast表示済み）
    } finally {
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
          borderColor: 'grey.200',
          textAlign: 'center'
        }}
      >
        {/* アプリロゴ */}
        <Box mb={4} display="flex" flexDirection="column" alignItems="center">
          <Brain size={48} className="text-indigo-600 mb-2" />
          <Typography variant="h5" component="h1" fontWeight="800" gutterBottom>
            日本史AI特訓
          </Typography>
          <Typography variant="caption" color="text.secondary">
            管理者または生徒アカウントでログイン
          </Typography>
        </Box>

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
            />
            
            <TextField
              label="パスワード"
              variant="outlined"
              fullWidth
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
                borderRadius: 2, 
                fontSize: '1rem', 
                fontWeight: 'bold'
              }}
              startIcon={isSubmitting ? null : <LogIn />}
            >
              {isSubmitting ? 'ログイン中...' : 'ログイン'}
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

export default AuthScreen;