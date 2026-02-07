import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Fade, Paper } from '@mui/material';
import { Brain } from 'lucide-react';
import { LOADING_TRIVIA } from '../lib/constants';

const SmartLoader = ({ message = "読み込み中..." }) => {
  const [idx, setIdx] = useState(0);

  // 定数が空だった場合のフォールバック
  const triviaList = (LOADING_TRIVIA && LOADING_TRIVIA.length > 0) 
    ? LOADING_TRIVIA 
    : [
        "歴史は繰り返すと言いますが、全く同じことが起こるわけではありません。",
        "準備中です... 歴史の扉を開いています。",
        "暗記よりも「なぜ？」という流れを大切にしましょう。"
      ];

  useEffect(() => {
    // 4秒ごとに豆知識を切り替え
    const intervalId = setInterval(() => {
      setIdx((prev) => (prev + 1) % triviaList.length);
    }, 4000);
    return () => clearInterval(intervalId);
  }, [triviaList.length]);

  return (
    <Box 
      sx={{ 
        height: '100vh', 
        width: '100%',
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: '#f8fafc', // slate-50
        position: 'fixed', // 全画面を覆う
        top: 0,
        left: 0,
        zIndex: 9999
      }}
    >
      <Box position="relative" display="inline-flex" mb={4}>
        <CircularProgress 
          size={80} 
          thickness={4} 
          sx={{ color: 'primary.main' }} 
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Brain 
            size={32} 
            className="text-indigo-600 animate-pulse" 
            style={{ stroke: '#4f46e5' }}
          />
        </Box>
      </Box>
      
      <Typography 
        variant="h6" 
        fontWeight="800" 
        color="text.primary" 
        sx={{ mb: 5, letterSpacing: 1 }}
        className="animate-pulse"
      >
          {message}
      </Typography>

      <Fade in={true} key={idx} timeout={800}>
        <Paper 
            elevation={0} 
            sx={{ 
                p: 3, 
                maxWidth: 360, 
                width: '90%',
                textAlign: 'center', 
                bgcolor: 'white', 
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)'
            }}
        >
            <Typography variant="overline" display="block" color="primary.main" fontWeight="900" mb={1} letterSpacing={1.5}>
                💡 歴史豆知識
            </Typography>
            <Typography variant="body2" fontWeight="500" lineHeight={1.8} color="text.secondary">
                {triviaList[idx]}
            </Typography>
        </Paper>
      </Fade>
    </Box>
  );
};

export default SmartLoader;