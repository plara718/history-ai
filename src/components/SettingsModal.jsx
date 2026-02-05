import React, { useState } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box,
  Divider,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Settings, Shield, Server, X, Copy, Check } from 'lucide-react';

// 管理者UID (App.jsxと同じもの)
const ADMIN_UID = "ksOXMeEuYCdslZeK5axNzn7UCU23"; 

const SettingsModal = ({ open, onClose, user }) => {
  const [copied, setCopied] = useState(false);
  
  // 管理者かどうか判定
  const isAdmin = user?.uid === ADMIN_UID;

  // UIDコピー機能
  const handleCopyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // 2秒後に戻す
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      fullWidth 
      maxWidth="xs"
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Settings size={20} />
          アプリ設定
        </Box>
        <IconButton onClick={onClose} size="small">
          <X size={20} />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        <Box display="flex" flexDirection="column" gap={2.5}>
          
          {/* 1. アカウント情報 */}
          <Box>
            <Typography variant="caption" color="textSecondary" fontWeight="bold">
              ログインアカウント
            </Typography>
            <Typography variant="body1" fontWeight="500">
              {user?.email || '未取得'}
            </Typography>
            
            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled', bgcolor: 'slate.50', px: 1, py: 0.5, borderRadius: 1 }}>
                UID: {user?.uid || '---'}
              </Typography>
              
              {/* コピーボタン（復活） */}
              <Tooltip title={copied ? "コピーしました" : "UIDをコピー"}>
                <IconButton onClick={handleCopyUid} size="small" sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Divider />

          {/* 2. 環境設定 */}
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold">
                システム環境
              </Typography>
              <Chip 
                icon={<Server size={14} />} 
                label="Production Mode" 
                color="success" 
                size="small" 
                variant="outlined" 
              />
            </Box>
            <Typography variant="caption" color="text.disabled">
              Version: 1.0.0 (Stable)
            </Typography>
          </Box>

          {/* 3. 管理者メニュー (特定のUIDのみ表示) */}
          {isAdmin && (
            <>
              <Divider />
              <Box>
                <Typography variant="caption" color="primary" fontWeight="bold" display="flex" alignItems="center" gap={0.5} mb={1}>
                  <Shield size={14} />
                  管理者メニュー
                </Typography>
                <Button 
                  variant="contained" 
                  color="inherit" 
                  fullWidth 
                  onClick={() => {
                    window.location.href = '/admin';
                  }}
                  sx={{ 
                    bgcolor: 'slate.800', 
                    color: 'black', 
                    fontWeight: 'bold',
                    '&:hover': { bgcolor: 'slate.700' }
                  }}
                >
                  管理ダッシュボードを開く
                </Button>
              </Box>
            </>
          )}

        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ fontWeight: 'bold' }}>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsModal;