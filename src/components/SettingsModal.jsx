import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, IconButton, 
  Divider, Stack, ToggleButton, ToggleButtonGroup, 
  CircularProgress, InputAdornment, Tooltip, Zoom,
  Paper, Alert
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
  Badge as BadgeIcon,
  Launch as LaunchIcon,
  DeleteSweep as CacheIcon // 追加
} from '@mui/icons-material';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';

// App.jsxで { SettingsModal } とインポートしているので export const
export const SettingsModal = ({ 
  apiKey, setApiKey, onClose, uid, 
  onAdmin, isAdminMode, 
  adminApiKey, setAdminApiKey, 
  appMode, setAppMode 
}) => {
  const [localKey, setLocalKey] = useState(apiKey || '');
  const [localAdminKey, setLocalAdminKey] = useState(adminApiKey || '');
  const [isCopied, setIsCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // モード切替（ユーザー個別のFirestoreパスに保存）
  const handleModeChange = async (event, newMode) => {
    if (!newMode || newMode === appMode || !uid) return;
    setLoading(true);
    
    if (setAppMode) setAppMode(newMode);

    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'settings', 'ai_config'), {
        appMode: newMode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
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
      navigator.clipboard.writeText(uid)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch(err => console.error('Copy failed', err));
    }
  };

  // ★追加: キャッシュクリアと修復
  const handleClearCache = () => {
    if (window.confirm("画面の表示がおかしい場合などに実行してください。\n\nAPIキー以外のキャッシュを削除し、アプリを強制的に再読み込みしますか？")) {
        // キーを一時退避
        const savedKey = localStorage.getItem('gemini_api_key');
        const savedAdminKey = localStorage.getItem('gemini_api_key_admin');
        
        // 全クリア
        localStorage.clear();
        
        // キーを復元
        if (savedKey) localStorage.setItem('gemini_api_key', savedKey);
        if (savedAdminKey) localStorage.setItem('gemini_api_key_admin', savedAdminKey);

        // キャッシュバスター付きでリロード (強制的に最新ファイルを読み込ませる)
        window.location.href = window.location.origin + window.location.pathname + '?t=' + new Date().getTime();
    }
  };

  return (
    <Dialog 
      open={true} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        elevation: 24,
        sx: { 
          borderRadius: 4, 
          overflow: 'visible' 
        }
      }}
      TransitionComponent={Zoom}
    >
      {/* ヘッダー */}
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, pt: 3, px: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ p: 1, bgcolor: 'primary.50', borderRadius: 2, color: 'primary.main', display: 'flex' }}>
            <SettingsIcon />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight="800" color="text.primary" lineHeight={1.2}>
              アプリ設定
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">
              Configuration
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary', bgcolor: 'action.hover' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <DialogContent sx={{ py: 4, px: 3 }}>
        <Stack spacing={5}>
          
          {/* 1. AIモード設定 */}
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" color="text.primary" gutterBottom display="flex" alignItems="center" gap={1}>
              <ProductionIcon fontSize="small" color="action"/> AI動作モード
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
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
                  fontSize: '0.95rem',
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
                {loading && appMode === 'production' ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }}/> : <ProductionIcon sx={{ mr: 1, fontSize: 20 }} />}
                本番 (Stable)
              </ToggleButton>
              <ToggleButton value="test">
                {loading && appMode === 'test' ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }}/> : <TestIcon sx={{ mr: 1, fontSize: 20 }} />}
                テスト (Beta)
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>


          {/* 2. APIキー設定 */}
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" color="text.primary" gutterBottom display="flex" alignItems="center" gap={1}>
              <KeyIcon fontSize="small" color="action"/> API Key Settings
            </Typography>
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                type="password"
                variant="outlined"
                label="Gemini API Key (User)"
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder="AI学習に使用するキーを入力"
                helperText="Google AI Studioで取得したキーを入力してください"
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
                  label="Admin API Key (System)"
                  value={localAdminKey}
                  onChange={(e) => setLocalAdminKey(e.target.value)}
                  placeholder="管理者機能用キー（任意）"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AdminIcon color="error" fontSize="small" />
                      </InputAdornment>
                    ),
                    sx: { borderRadius: 3, bgcolor: 'error.50', '& input': { color: 'error.main' } }
                  }}
                />
              )}
            </Stack>
          </Box>

          {/* 3. ユーザー情報 & トラブルシューティング */}
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" color="text.primary" gutterBottom display="flex" alignItems="center" gap={1}>
                <BadgeIcon fontSize="small" color="action"/> Account & Support
            </Typography>
            
            <Stack spacing={2}>
                <Paper 
                    variant="outlined" 
                    sx={{ 
                    p: 2, borderRadius: 3, 
                    bgcolor: 'grey.50', borderColor: 'divider', 
                    display: 'flex', alignItems: 'center', gap: 2
                    }}
                >
                    <Box flexGrow={1} overflow="hidden">
                    <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block">
                        User ID
                    </Typography>
                    <Typography variant="body2" fontFamily="monospace" color="text.primary" fontWeight="bold" noWrap>
                        {uid || 'Loading...'}
                    </Typography>
                    </Box>
                    <Tooltip title={isCopied ? "コピーしました！" : "IDをコピー"} arrow>
                    <IconButton 
                        onClick={handleCopyUid}
                        color={isCopied ? "success" : "default"}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                        {isCopied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                    </IconButton>
                    </Tooltip>
                </Paper>

                {/* キャッシュクリアボタン */}
                <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    startIcon={<CacheIcon />}
                    onClick={handleClearCache}
                    sx={{ borderRadius: 3, py: 1, borderColor: 'orange' }}
                >
                    動作がおかしい時はここ（キャッシュ削除・修復）
                </Button>
            </Stack>
          </Box>

          {/* 管理者ダッシュボードへの導線 */}
          {isAdminMode && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<LaunchIcon />}
              onClick={onAdmin}
              fullWidth
              sx={{ 
                borderRadius: 3, 
                fontWeight: 'bold', 
                borderStyle: 'dashed', 
                borderWidth: 2,
                py: 1.5,
                '&:hover': { borderStyle: 'dashed', borderWidth: 2, bgcolor: 'error.50' }
              }}
            >
              管理者ダッシュボードを開く
            </Button>
          )}

        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} variant="text" color="inherit" sx={{ borderRadius: 2, fontWeight: 'bold', px: 3 }}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disableElevation
          sx={{ 
            px: 4, py: 1,
            borderRadius: 2, 
            fontWeight: 'bold',
            bgcolor: 'primary.main',
            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
            '&:hover': { bgcolor: 'primary.dark', boxShadow: '0 6px 8px -1px rgba(79, 70, 229, 0.3)' }
          }}
        >
          設定を保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};