import React, { useMemo } from 'react';
import { Box, Paper, Typography, Tooltip } from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';
import { getTodayString } from '../lib/utils';

const LearningHeatmap = ({ stats }) => {
  const today = getTodayString();

  // 過去28日分の日付リストを生成
  const days = useMemo(() => { 
    const l = []; 
    for(let i = 27; i >= 0; i--) { 
      const d = new Date(); 
      d.setDate(d.getDate() - i); 
      // YYYY-MM-DD形式
      l.push(`${d.getFullYear()}-${('0'+(d.getMonth()+1)).slice(-2)}-${('0'+d.getDate()).slice(-2)}`); 
    } 
    return l; 
  }, []);

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 3, 
        borderRadius: 4, 
        border: '1px solid #e2e8f0', // LogScreen等の枠線色に合わせる
        mb: 3
      }}
    >
      <Typography 
        variant="caption" 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          fontWeight: 'bold', 
          color: 'text.secondary', 
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          mb: 2
        }}
      >
        <CalendarMonth sx={{ fontSize: 16 }} /> Learning Streak
      </Typography>

      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: 1 
        }}
      >
        {days.map(d => { 
          const count = stats[d] || 0;
          
          // 色の決定ロジック (MUIのカラーパレットに近い色を使用)
          let bgcolor = '#f1f5f9'; // bg-slate-100
          if (count === 1) bgcolor = '#c7d2fe'; // bg-indigo-200
          if (count === 2) bgcolor = '#818cf8'; // bg-indigo-400
          if (count >= 3) bgcolor = '#4f46e5'; // bg-indigo-600

          const isToday = d === today;

          return (
            <Tooltip key={d} title={`${d}: ${count} lessons`} arrow>
              <Box 
                sx={{ 
                  width: '100%', 
                  aspectRatio: '1/1', 
                  borderRadius: 2, 
                  bgcolor: bgcolor,
                  border: isToday ? '2px solid #6366f1' : 'none', // 今日は枠線強調
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'scale(1.1)' }
                }} 
              />
            </Tooltip>
          ); 
        })}
      </Box>
    </Paper>
  );
};

export default LearningHeatmap;