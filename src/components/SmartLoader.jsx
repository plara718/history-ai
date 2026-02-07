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
    <Box 
      display="flex" 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center" 
      sx={{ 
        minHeight: '60vh', // 画面中央に来るように高さ確保
        py: 10 
      }}
      className="animate-fade-in"
    >
      <Box position="relative" display="inline-flex">
        <CircularProgress 
          size={80} 
          thickness={4} 
          sx={{ color: 'primary.main' }} // indigo.500 -> primary.main
        />
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
          <Brain 
            size={32} 
            color="#4f46e5" // indigo-600
            className="animate-pulse" 
          />
        </Box>
      </Box>
      
      {/* メインメッセージ (App.jsxから渡されたもの) */}
      <Typography 
        variant="h6" 
        fontWeight="800" 
        color="text.primary" 
        sx={{ mt: 4, mb: 3 }}
      >
          {message || "AIが講義を生成中..."}
      </Typography>

      {/* 豆知識エリア */}
      <Fade in={true} key={idx} timeout={500}>
        <Paper 
            elevation={0} 
            sx={{ 
                p: 3, 
                maxWidth: 320, 
                textAlign: 'center', 
                bgcolor: 'background.paper', // indigo.50 -> background.paper (より汎用的に)
                color: 'text.secondary',
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
        >
            <Typography variant="overline" display="block" color="primary.main" fontWeight="bold" mb={1} letterSpacing={1}>
                💡 歴史豆知識
            </Typography>
            <Typography variant="body2" fontWeight="500" lineHeight={1.6}>
                {currentText}
            </Typography>
        </Paper>
      </Fade>
    </Box>
  );
};

export default SmartLoader;