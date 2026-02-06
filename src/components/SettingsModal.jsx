import React, { useState } from 'react';
import { 
  Modal, Box, Typography, TextField, Button, IconButton, 
  Divider, Stack, ToggleButton, ToggleButtonGroup, CircularProgress 
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Settings as SettingsIcon, 
  AdminPanelSettings as AdminIcon, 
  Bolt as ProductionIcon, 
  Science as TestIcon, 
  ContentCopy as CopyIcon, 
  Check as CheckIcon 
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
      // settings/ai_config サブコレクションに保存
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
    setApiKey(localKey);
    setAdminApiKey(localAdminKey);
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
    <Modal open={true} onClose={onClose}>
      <Box sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '90%', maxWidth: 450, bgcolor: 'background.paper', borderRadius: 4, boxShadow: 24, p: 4, outline: 'none',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Stack direction="row" spacing={1} alignItems="center">
            <SettingsIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">アプリ設定</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Stack>

        <Stack spacing={3}>
          {/* AIモード設定セクション */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" gutterBottom display="block">
              AI動作モード（あなた専用）
            </Typography>
            <ToggleButtonGroup
              value={appMode}
              exclusive
              onChange={handleModeChange}
              disabled={loading}
              fullWidth
              size="small"
              color="primary"
              sx={{ '& .MuiToggleButton-root': { borderRadius: 2, fontWeight: 'bold' } }}
            >
              <ToggleButton value="production" sx={{ gap: 1 }}>
                {loading ? <CircularProgress size={16} /> : <ProductionIcon fontSize="small" />}
                本番モード
              </ToggleButton>
              <ToggleButton value="test" sx={{ gap: 1 }}>
                {loading ? <CircularProgress size={16} /> : <TestIcon fontSize="small" />}
                テストモード
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block', fontSize: '0.7rem' }}>
              ※ テストモードではプロンプトの調整や実験的な機能が有効になります。
            </Typography>
          </Box>

          <Divider />

          {/* APIキー設定 */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" gutterBottom display="block">
              Gemini API Key
            </Typography>
            <TextField
              fullWidth type="password" variant="outlined" size="small"
              value={localKey} onChange={(e) => setLocalKey(e.target.value)}
              placeholder="AI学習に使用するキーを入力"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" gutterBottom display="block">
              Admin API Key (任意)
            </Typography>
            <TextField
              fullWidth type="password" variant="outlined" size="small"
              value={localAdminKey} onChange={(e) => setLocalAdminKey(e.target.value)}
              placeholder="管理者機能用キー"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>

          <Divider />

          {/* ユーザー情報 */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" gutterBottom display="block">
              User ID (サポート用)
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ 
                bgcolor: '#f1f5f9', px: 2, py: 1.5, borderRadius: 2, 
                flexGrow: 1, border: '1px solid #e2e8f0', overflow: 'hidden' 
              }}>
                <Typography variant="caption" sx={{ color: '#475569', wordBreak: 'break-all', display: 'block', fontFamily: 'monospace' }}>
                  {uid || 'Loading...'}
                </Typography>
              </Box>
              <IconButton 
                onClick={handleCopyUid} 
                sx={{ 
                  bgcolor: isCopied ? '#ecfdf5' : '#f8fafc', 
                  color: isCopied ? '#10b981' : '#64748b',
                  border: '1px solid',
                  borderColor: isCopied ? '#a7f3d0' : '#e2e8f0',
                  borderRadius: 2
                }}
              >
                {isCopied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
              </IconButton>
            </Stack>
          </Box>

          {/* 管理者ダッシュボードへの導線 */}
          {isAdminMode && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<AdminIcon />}
              onClick={onAdmin}
              sx={{ borderRadius: 2, fontWeight: 'bold', borderStyle: 'dashed', py: 1 }}
            >
              管理者ダッシュボード
            </Button>
          )}

          <Button
            variant="contained"
            fullWidth
            onClick={handleSave}
            size="large"
            sx={{ py: 1.5, borderRadius: 3, fontWeight: 'bold', boxShadow: 2 }}
          >
            設定を保存して閉じる
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

export default SettingsModal;