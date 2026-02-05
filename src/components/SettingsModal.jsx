import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Typography, 
  Box,
  Divider
} from '@mui/material';

const SettingsModal = ({ open, onClose, user }) => {
  const [displayName, setDisplayName] = useState('');

  // ユーザー情報が読み込まれたら名前欄に反映
  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  // 保存処理（今回は簡易的に閉じるだけにする）
  const handleSave = () => {
    // 将来的にここに名前更新処理を追加
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} // グレーの背景を押しても閉じるようにする
      fullWidth 
      maxWidth="xs"
    >
      <DialogTitle sx={{ fontWeight: 'bold' }}>アプリ設定</DialogTitle>
      
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          {/* ユーザーIDの表示 */}
          <Box>
            <Typography variant="caption" color="textSecondary">
              ログイン中のID (Email)
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {user?.email || '未取得'}
            </Typography>
          </Box>

          <Divider />

          <Box>
            <Typography variant="caption" color="textSecondary">
              ユーザーUID (システム用)
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {user?.uid || '読み込み中...'}
            </Typography>
          </Box>

          {/* 名前入力欄 */}
          <TextField
            label="ニックネーム"
            variant="outlined"
            size="small"
            fullWidth
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="表示名を設定"
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        {/* キャンセルボタン（確実に閉じる） */}
        <Button onClick={onClose} color="inherit">
          閉じる
        </Button>
        
        {/* 保存ボタン */}
        <Button onClick={handleSave} variant="contained" color="primary">
          保存して閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettingsModal;