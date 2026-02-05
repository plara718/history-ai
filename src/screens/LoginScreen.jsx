import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Container, Alert, CircularProgress } from '@mui/material';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Lock } from 'lucide-react';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // ログイン成功すると、App.jsxのonAuthStateChangedが反応して画面が切り替わります
    } catch (err) {
      console.error(err);
      setError("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 4, width: '100%', textAlign: 'center' }}>
        <Box display="flex" justifyContent="center" mb={2}>
          <div className="p-3 bg-violet-100 rounded-full">
            <Lock className="text-violet-600" size={32} />
          </div>
        </Box>
        <Typography variant="h5" fontWeight="bold" gutterBottom color="slate.800">
          ログイン
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={4}>
          保護者の方、または生徒のアカウントで<br/>ログインしてください。
        </Typography>

        <form onSubmit={handleLogin}>
          <TextField
            fullWidth
            label="メールアドレス"
            variant="outlined"
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="パスワード"
            variant="outlined"
            margin="normal"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{ mb: 3 }}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left', fontSize: '0.85rem' }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold', fontSize: '1rem' }}
          >
            {loading ? <CircularProgress size={24} color="inherit"/> : "ログインして開始"}
          </Button>
        </form>
      </Paper>
    </Container>
  );
};

export default LoginScreen;