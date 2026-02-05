import React, { useState, useEffect } from 'react';
import { CircularProgress, Box, Typography, Paper, Fade } from '@mui/material';
import { Brain } from 'lucide-react';
import { LOADING_TRIVIA } from '../lib/constants';

// message プロパティを受け取るように修正
const SmartLoader = ({ message }) => {
  // 安全対策: もしLOADING_TRIVIAが読み込めなくてもクラッシュさせない
  const triviaList = (LOADING_TRIVIA && LOADING_TRIVIA.length > 0) 
    ? LOADING_TRIVIA 
    : ["歴史の扉を開いています...", "準備中..."];

  const [idx, setIdx] = useState(0);

  useEffect(() => { 
      // リストがある場合のみタイマーを動かす
      if (triviaList.length > 1) {
          const i = setInterval(() => setIdx(p => (p + 1) % triviaList.length), 3000); 
          return () => clearInterval(i); 
      }
  }, [triviaList.length]);

  // 表示するテキストの決定（豆知識 または デフォルト）
  const currentText = triviaList[idx] || "読み込み中...";

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={10} className="animate-fade-in">
      <Box position="relative" display="inline-flex">
        <CircularProgress size={80} thickness={4} sx={{ color: 'indigo.500' }} />
        <Box
          top={0}
          left={0}
          bottom={0}
          right={0}
          position="absolute"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Brain className="w-8 h-8 text-indigo-500 animate-pulse" />
        </Box>
      </Box>
      
      {/* メインメッセージ (App.jsxから渡されたもの) */}
      <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ mt: 4, mb: 1 }}>
          {message || "AIが講義を生成中..."}
      </Typography>

      {/* 豆知識エリア */}
      <Fade in={true} key={idx} timeout={500}>
        <Paper 
            elevation={0} 
            sx={{ 
                p: 2, 
                px: 3,
                maxWidth: 320, 
                textAlign: 'center', 
                bgcolor: 'indigo.50', 
                color: 'indigo.900',
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'indigo.100'
            }}
        >
            <Typography variant="caption" display="block" color="indigo.400" fontWeight="bold" mb={0.5}>
                💡 歴史豆知識
            </Typography>
            <Typography variant="body2" fontWeight="medium">
                {currentText}
            </Typography>
        </Paper>
      </Fade>
    </Box>
  );
};

export default SmartLoader;