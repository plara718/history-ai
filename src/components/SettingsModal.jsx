import React, { useState } from 'react';
import { Modal, Box, Typography, TextField, Button, IconButton, Divider, Stack, Chip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { X, Settings, ShieldCheck, Zap, User, Copy, Check, FlaskConical } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';

const SettingsModal = ({ apiKey, setApiKey, onClose, uid, onAdmin, isAdminMode, adminApiKey, setAdminApiKey, appMode, setAppMode }) => {
  const [localKey, setLocalKey] = useState(apiKey);
  const [localAdminKey, setLocalAdminKey] = useState(adminApiKey);
  const [isCopied, setIsCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // モード切替（Firestoreのグローバル設定を更新）
  const handleModeChange = async (event, newMode) => {
    if (!newMode || newMode === appMode) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'settings', 'global'), {
        appMode: newMode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      if (setAppMode) setAppMode(newMode);
    } catch (e) {
      console.error("モード切替失敗", e);
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
        width: '90%', maxWidth: 500, bgcolor: 'background.paper', borderRadius: 4, boxShadow: 24, p: 4, outline: 'none',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Settings size={20} className="text-slate-600" />
            <Typography variant="h6" fontWeight="bold">設定</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small"><X /></IconButton>
        </Stack>

        <Stack spacing={3}>
          {/* AIモード設定セクション */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" gutterBottom display="block">
              AI動作モード（システム全体）
            </Typography>
            <ToggleButtonGroup
              value={appMode}
              exclusive
              onChange={handleModeChange}
              disabled={loading}
              fullWidth
              size="small"
              color="primary"
            >
              <ToggleButton value="production" sx={{ fontWeight: 'bold', gap: 1 }}>
                <Zap size={14} /> 本番
              </ToggleButton>
              <ToggleButton value="test" sx={{ fontWeight: 'bold', gap: 1 }}>
                <FlaskConical size={14} /> テスト
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Divider />

          {/* APIキー設定 */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" gutterBottom display="block">
              Gemini API Key
            </Typography>
            <TextField
              fullWidth
              type="password"
              variant="outlined"
              size="small"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              placeholder="AI学習に使用するキー"
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" gutterBottom display="block">
              Admin API Key (Optional)
            </Typography>
            <TextField
              fullWidth
              type="password"
              variant="outlined"
              size="small"
              value={localAdminKey}
              onChange={(e) => setLocalAdminKey(e.target.value)}
              placeholder="管理者機能に使用するキー"
            />
          </Box>

          <Divider />

          {/* ユーザー情報 */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold" gutterBottom display="block">
              ユーザーID (UID)
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ bgcolor: 'slate.50', px: 2, py: 1, borderRadius: 2, flexGrow: 1, border: '1px solid', borderColor: 'slate.200' }}>
                <Typography variant="code" sx={{ fontSize: '0.75rem', color: 'slate.600', wordBreak: 'break-all' }}>
                  {uid || 'Loading...'}
                </Typography>
              </Box>
              <IconButton onClick={handleCopyUid} color={isCopied ? "success" : "default"}>
                {isCopied ? <Check size={18} /> : <Copy size={18} />}
              </IconButton>
            </Stack>
          </Box>

          {/* 管理者導線 */}
          {!isAdminMode && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<ShieldCheck size={18} />}
              onClick={onAdmin}
              sx={{ borderRadius: 2, fontWeight: 'bold', borderStyle: 'dashed' }}
            >
              管理者モードへ切り替え
            </Button>
          )}

          <Button
            variant="contained"
            fullWidth
            onClick={handleSave}
            sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold', bgcolor: 'indigo.600' }}
          >
            設定を保存
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

export default SettingsModal;