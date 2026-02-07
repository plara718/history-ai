import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, IconButton, 
  Divider, Stack, ToggleButton, ToggleButtonGroup, 
  CircularProgress, InputAdornment, Tooltip, Zoom,
  Paper
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Settings as SettingsIcon, 
  AdminPanelSettings as AdminIcon, 
  Bolt as ProductionIcon, 
  Science as TestIcon, 
  ContentCopy as CopyIcon, 
  CheckCircle as CheckIcon,
  Key as KeyIcon,
  Badge as BadgeIcon
} from '@mui/icons-material';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';

const SettingsModal = ({ 
  apiKey, setApiKey, onClose, uid, 
  onAdmin, isAdminMode, 
  adminApiKey, setAdminApiKey, 
  appMode, setAppMode 
}) => {
  const [localKey, setLocalKey] = useState(apiKey);
  const [localAdminKey, setLocalAdminKey] = useState(adminApiKey);
  const [isCopied, setIsCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // モード切替（ユーザー個別のFirestoreパスに保存）
  const handleModeChange = async (event, newMode) => {
    if (!newMode || newMode === appMode || !uid) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'settings', 'ai_config'), {
        appMode: newMode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      if (setAppMode) setAppMode(newMode);
    } catch (e) {
      console.error("個人設定の保存失敗", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    localStorage.setItem('gemini_api_key', localKey);
    localStorage.setItem('gemini_api_key_admin', localAdminKey);
    if (setApiKey) setApiKey(localKey);
    if (setAdminApiKey) setAdminApiKey(localAdminKey);
    onClose();
  };

  const handleCopyUid = () => {
    if (uid) {
      navigator.clipboard.writeText(uid);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <Dialog 
      open={true} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        elevation: 0,
        sx: { 
          borderRadius: 4, 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
        }
      }}
      TransitionComponent={Zoom}
    >
      {/* ヘッダー */}
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ p: 1, bgcolor: 'primary.50', borderRadius: 2, color: 'primary.main', display: 'flex' }}>
            <SettingsIcon />
          </Box>
          <Typography variant="h6" fontWeight="800" color="text.primary">
            アプリ設定
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ py: 3 }}>
        <Stack spacing={4}>
          
          {/* 1. AIモード設定 */}
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" color="text.primary" gutterBottom>
              AI動作モード
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
              学習コンテンツの生成アルゴリズムを選択します。
            </Typography>
            
            <ToggleButtonGroup
              value={appMode}
              exclusive
              onChange={handleModeChange}
              disabled={loading}
              fullWidth
              size="medium"
              sx={{ 
                gap: 2,
                '& .MuiToggleButtonGroup-grouped': {
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '12px !important',
                  mx: 0,
                  textTransform: 'none',
                  fontWeight: 'bold',
                  py: 1.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    borderColor: 'primary.main',
                    '&:hover': { bgcolor: 'primary.100' }
                  }
                }
              }}
            >
              <ToggleButton value="production">
                {loading ? <CircularProgress size={20} color="inherit" /> : <ProductionIcon sx={{ mr: 1 }} />}
                本番モード
              </ToggleButton>
              <ToggleButton value="test">
                {loading ? <CircularProgress size={20} color="inherit" /> : <TestIcon sx={{ mr: 1 }} />}
                テストモード
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* 2. APIキー設定 */}
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" color="text.primary" gutterBottom>
              API Key Configuration
            </Typography>
            <Stack spacing={2}>
              <TextField
                fullWidth
                type="password"
                variant="outlined"
                label="Gemini API Key"
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder="AI学習に使用するキーを入力"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 3 }
                }}
              />
              
              {isAdminMode && (
                <TextField
                  fullWidth
                  type="password"
                  variant="outlined"
                  label="Admin API Key (Optional)"
                  value={localAdminKey}
                  onChange={(e) => setLocalAdminKey(e.target.value)}
                  placeholder="管理者機能用キー"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AdminIcon color="action" fontSize="small" />
                      </InputAdornment>
                    ),
                    sx: { borderRadius: 3 }
                  }}
                />
              )}
            </Stack>
          </Box>

          {/* 3. ユーザー情報 */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'grey.50', borderColor: 'grey.200' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <BadgeIcon color="disabled" />
              <Box flexGrow={1} overflow="hidden">
                <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block">
                  User ID (Support)
                </Typography>
                <Typography variant="body2" fontFamily="monospace" color="text.primary" noWrap>
                  {uid || 'Loading...'}
                </Typography>
              </Box>
              <Tooltip title={isCopied ? "コピーしました！" : "IDをコピー"}>
                <IconButton 
                  onClick={handleCopyUid}
                  sx={{ 
                    bgcolor: isCopied ? 'success.light' : 'white', 
                    color: isCopied ? 'success.contrastText' : 'text.secondary',
                    border: '1px solid',
                    borderColor: isCopied ? 'success.main' : 'grey.300',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: isCopied ? 'success.main' : 'grey.100' }
                  }}
                >
                  {isCopied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Paper>

          {/* 管理者ダッシュボードへの導線 */}
          {isAdminMode && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<AdminIcon />}
              onClick={onAdmin}
              sx={{ 
                borderRadius: 3, 
                fontWeight: 'bold', 
                borderStyle: 'dashed', 
                borderWidth: 2,
                py: 1.5,
                '&:hover': { borderStyle: 'dashed', borderWidth: 2, bgcolor: 'secondary.50' }
              }}
            >
              管理者ダッシュボードを開く
            </Button>
          )}

        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose} variant="text" color="inherit" sx={{ borderRadius: 2, fontWeight: 'bold', mr: 1 }}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="large"
          disableElevation
          sx={{ 
            px: 4, 
            borderRadius: 3, 
            fontWeight: 'bold',
            bgcolor: 'primary.main',
            '&:hover': { bgcolor: 'primary.dark' }
          }}
        >
          保存する
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsModal;