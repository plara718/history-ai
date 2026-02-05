import React, { useState } from 'react';
import { Modal, Box, Typography, TextField, Button, IconButton, Divider, Switch, FormControlLabel, Stack, Chip, Tooltip } from '@mui/material';
import { X, Settings, ShieldCheck, Zap, User, Copy, Check } from 'lucide-react';

const SettingsModal = ({ apiKey, setApiKey, onClose, hasKey, uid, onAdmin, isAdminMode, adminApiKey, setAdminApiKey }) => {
  const [localKey, setLocalKey] = useState(apiKey);
  const [localAdminKey, setLocalAdminKey] = useState(adminApiKey);
  
  // テストモードの状態管理 (true=1.5Flash, false=Gemma3)
  const [isTestMode, setIsTestMode] = useState(localStorage.getItem('gemini_test_mode') === 'true');

  // コピー完了状態の管理
  const [isCopied, setIsCopied] = useState(false);

  const handleSave = () => {
    localStorage.setItem('gemini_api_key', localKey);
    localStorage.setItem('gemini_api_key_admin', localAdminKey);
    localStorage.setItem('gemini_test_mode', isTestMode);
    
    setApiKey(localKey);
    setAdminApiKey(localAdminKey);
    onClose();
    
    if (localStorage.getItem('gemini_test_mode') !== String(isTestMode)) {
        window.location.reload();
    }
  };

  // IDコピー機能
  const handleCopyUid = () => {
      if (uid) {
          navigator.clipboard.writeText(uid);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000); // 2秒後に戻す
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
          <Typography variant="h6" fontWeight="bold" display="flex" alignItems="center" gap={1}>
            <Settings size={20} className="text-slate-600" /> アプリ設定
          </Typography>
          <IconButton onClick={onClose}><X /></IconButton>
        </Stack>

        <Stack spacing={3}>
          {/* 1. ユーザーID表示エリア (コピーボタン付き) */}
          <Box sx={{ p: 2, bgcolor: 'slate.50', borderRadius: 2, border: '1px dashed', borderColor: 'slate.300' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="caption" fontWeight="bold" color="text.secondary" display="flex" alignItems="center" gap={1}>
                    <User size={14} /> ユーザーID (UID)
                </Typography>
                
                {uid && (
                    <Button
                        size="small"
                        onClick={handleCopyUid}
                        startIcon={isCopied ? <Check size={14} /> : <Copy size={14} />}
                        sx={{ 
                            minWidth: 0, 
                            py: 0.5, 
                            px: 1,
                            fontSize: '0.75rem', 
                            color: isCopied ? 'emerald.600' : 'text.secondary',
                            bgcolor: isCopied ? 'emerald.50' : 'transparent',
                            '&:hover': { bgcolor: isCopied ? 'emerald.100' : 'slate.200', color: 'indigo.600' }
                        }}
                    >
                        {isCopied ? "コピー完了" : "IDをコピー"}
                    </Button>
                )}
            </Stack>
            <Typography variant="body1" fontFamily="monospace" fontWeight="bold" color="slate.700" sx={{ wordBreak: 'break-all' }}>
                {uid || "未設定"}
            </Typography>
          </Box>

          <Divider />

          {/* 2. AIモデル切り替え */}
          <Box sx={{ 
              p: 2, 
              bgcolor: !isTestMode ? 'emerald.50' : 'amber.50', 
              borderRadius: 2, 
              border: '1px solid', 
              borderColor: !isTestMode ? 'emerald.200' : 'amber.200' 
          }}>
            <Typography variant="subtitle2" fontWeight="bold" color={!isTestMode ? 'emerald.800' : 'amber.900'} mb={1} display="flex" alignItems="center" gap={1}>
                {!isTestMode ? <Zap size={18}/> : <ShieldCheck size={18}/>}
                {!isTestMode ? "本番モード (推奨)" : "予備モード (バックアップ)"}
            </Typography>
            
            <FormControlLabel
                control={
                    <Switch 
                        checked={!isTestMode} 
                        onChange={(e) => setIsTestMode(!e.target.checked)}
                        color="success"
                    />
                }
                label={
                    <Typography variant="body2" fontWeight="bold">
                        Gemma 3 27B-it を使用する
                    </Typography>
                }
            />
            
            <Typography variant="caption" display="block" color="text.secondary" mt={1} sx={{ lineHeight: 1.5 }}>
                {!isTestMode 
                    ? "現在は「Gemma 3 27B-it」を使用しています。1日14,400回使用可能で、性能も非常に高い推奨モデルです。" 
                    : "現在は「Gemini 1.5 Flash」を使用しています。Gemma 3 に障害がある場合などの予備として使用してください。"}
            </Typography>
          </Box>

          {/* 3. APIキー設定 */}
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
               Google AI Studio APIキー
            </Typography>
            <TextField
              fullWidth
              type="password"
              placeholder="AIzaSy..."
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              variant="outlined"
              size="small"
              helperText="Gemma 3 / Gemini 共通のキーを入力"
            />
          </Box>
          
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
               管理者用 APIキー (任意)
            </Typography>
            <TextField
              fullWidth
              type="password"
              placeholder="AIzaSy... (空欄なら共通キーを使用)"
              value={localAdminKey}
              onChange={(e) => setLocalAdminKey(e.target.value)}
              variant="outlined"
              size="small"
              helperText="管理者モードの制限を分けたい場合のみ設定"
            />
          </Box>
          
          {uid && (
              <Box textAlign="right" pt={1}>
                 <Button 
                    size="small" 
                    onClick={() => { onClose(); onAdmin(); }} 
                    color="secondary"
                    variant="text"
                 >
                     管理者ダッシュボードを開く
                 </Button>
              </Box>
          )}

          <Button 
            variant="contained" 
            fullWidth 
            onClick={handleSave} 
            sx={{ borderRadius: 3, fontWeight: 'bold', py: 1.5, boxShadow: 2 }}
          >
            設定を保存
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

export default SettingsModal;