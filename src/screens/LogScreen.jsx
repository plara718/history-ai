import React, { useState, useEffect } from 'react';
import { 
  Box, Container, Typography, Paper, Chip, 
  List, 
} from '@mui/material';
import { 
  History, CheckCircle
} from '@mui/icons-material';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';

// ★ 追加: 作成したコンポーネントをインポート
import LearningHeatmap from '../components/LearningHeatmap';

const LogScreen = ({ userId, heatmapStats, onSelectSession }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!userId) return;
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress'),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistory(data);
      } catch (e) {
        console.error("履歴取得エラー", e);
      }
    };
    fetchHistory();
  }, [userId]);

  const getScoreDisplay = (item) => {
    if (item.gradingResult) {
      return { val: item.gradingResult.score, max: 10, label: "AIスコア" };
    }
    if (item.essayGrading?.score) {
      return { val: (item.essayGrading.score.k || 0) + (item.essayGrading.score.l || 0), max: 10, label: "記述点" };
    }
    return null;
  };

  return (
    <Container maxWidth="md" className="animate-fadeIn">
      <Box mb={4} textAlign="center">
        <Typography variant="overline" color="text.secondary" fontWeight="bold">
          LEARNING LOGS
        </Typography>
        <Typography variant="h5" fontWeight="900" sx={{ mb: 2 }}>
          学習の軌跡
        </Typography>
        
        {/* ★ 変更: コンポーネントを使用 */}
        <Box sx={{ maxWidth: 500, mx: 'auto' }}>
            <LearningHeatmap stats={heatmapStats} />
        </Box>
      </Box>

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, ml: 1 }}>
        最近のセッション
      </Typography>

      <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {history.map((item) => {
          const scoreInfo = getScoreDisplay(item);
          const date = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : '不明な日付';
          const theme = item.content?.theme || item.theme || 'テーマなし';
          
          return (
            <Paper 
              key={item.id} 
              elevation={0}
              onClick={() => onSelectSession(item)}
              sx={{ 
                p: 0, borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden',
                cursor: 'pointer', transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                <Box 
                  sx={{ 
                    width: 60, height: 60, borderRadius: 3, 
                    bgcolor: scoreInfo && scoreInfo.val >= 8 ? '#f0fdf4' : '#f8fafc',
                    color: scoreInfo && scoreInfo.val >= 8 ? '#15803d' : '#64748b',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    mr: 2, border: '1px solid', borderColor: 'divider'
                  }}
                >
                  {scoreInfo ? (
                    <>
                      <Typography variant="h5" fontWeight="900" lineHeight={1}>
                        {scoreInfo.val}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
                        /{scoreInfo.max}
                      </Typography>
                    </>
                  ) : (
                    <History />
                  )}
                </Box>

                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {date} • {item.learningMode === 'school' ? '定期テスト' : '入試対策'}
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.3}>
                    {theme}
                  </Typography>
                  
                  {item.gradingResult?.weakness_tag && (
                    <Chip 
                      label={item.gradingResult.weakness_tag} 
                      size="small" 
                      color="error" 
                      variant="outlined" 
                      sx={{ mt: 1, height: 20, fontSize: '0.65rem' }} 
                    />
                  )}
                </Box>

                <Box sx={{ color: 'text.disabled', pr: 1 }}>
                  <CheckCircle fontSize="small" color={item.completed ? "success" : "disabled"} />
                </Box>
              </Box>
            </Paper>
          );
        })}
        
        {history.length === 0 && (
          <Box textAlign="center" py={5} bgcolor="#f8fafc" borderRadius={3}>
            <Typography color="text.secondary">まだ履歴がありません</Typography>
          </Box>
        )}
      </List>
    </Container>
  );
};

export default LogScreen;