import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Container, Typography, Paper, Chip, 
  List, IconButton, Grid, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider
} from '@mui/material';
import { 
  History, CheckCircle, ChevronLeft, ChevronRight, EmojiEvents, AccessTime, AutoStories 
} from '@mui/icons-material';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';

// 既存のコンポーネントを維持
import LearningHeatmap from '../components/LearningHeatmap';

const LogScreen = ({ userId, heatmapStats }) => {
  // カレンダー用ステート
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(false);

  // 詳細ダイアログ用ステート
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  // --- カレンダーロジック (HistoryScreenから移植) ---
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(1 - firstDay.getDay());
    const endDate = new Date(lastDay);
    if (lastDay.getDay() !== 6) {
      endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    }
    const days = [];
    const day = new Date(startDate);
    while (day <= endDate) {
      days.push(new Date(day));
      day.setDate(day.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  // --- データ取得ロジック (月ごとに取得) ---
  useEffect(() => {
    const fetchMonthlyHistory = async () => {
      if (!userId) return;
      setLoading(true);
      
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      try {
        const ref = collection(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress');
        const q = query(
          ref,
          where('timestamp', '>=', startOfMonth.toISOString()),
          where('timestamp', '<=', endOfMonth.toISOString()),
          orderBy('timestamp', 'desc')
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMonthlyData(docs);
      } catch (e) {
        console.error("履歴取得エラー", e);
      } finally {
        setLoading(false);
      }
    };
    fetchMonthlyHistory();
  }, [userId, currentDate]);

  // 選択された日のデータフィルタリング
  const dailySessions = useMemo(() => {
    return monthlyData.filter(item => {
      const d = new Date(item.timestamp);
      return (
        d.getFullYear() === selectedDate.getFullYear() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getDate() === selectedDate.getDate()
      );
    });
  }, [monthlyData, selectedDate]);

  // --- ハンドラー ---
  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const handleDateClick = (date) => setSelectedDate(date);
  
  const handleSessionClick = (session) => {
    setSelectedSession(session);
    setDetailModalOpen(true);
  };

  const isSameDay = (d1, d2) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  
  const hasDataOnDay = (date) => monthlyData.some(item => isSameDay(new Date(item.timestamp), date));

  // スコア表示ヘルパー
  const getScoreInfo = (item) => {
    if (item.scores) {
        // 新仕様のデータ
        const totalEarned = (item.scores.quizCorrect || 0) + (item.scores.essayScore || 0);
        const totalMax = (item.scores.quizTotal || 0) + (item.scores.essayTotal || 10);
        // 10点満点換算して返す
        const scaledScore = totalMax > 0 ? Math.round((totalEarned / totalMax) * 10) : 0;
        return { val: scaledScore, max: 10 };
    }
    // 旧仕様データのフォールバック
    if (item.gradingResult) return { val: item.gradingResult.score, max: 10 };
    return null;
  };

  return (
    <Container maxWidth="md" className="animate-fadeIn" sx={{ pb: 10 }}>
      {/* ヘッダーエリア */}
      <Box mb={2} textAlign="center">
        <Typography variant="overline" color="text.secondary" fontWeight="bold">
          LEARNING LOGS
        </Typography>
        <Typography variant="h5" fontWeight="900" sx={{ mb: 2 }}>
          学習の軌跡
        </Typography>
        
        {/* ヒートマップ (既存機能維持) */}
        <Box sx={{ maxWidth: 500, mx: 'auto', mb: 4 }}>
            <LearningHeatmap stats={heatmapStats} />
        </Box>
      </Box>

      {/* --- カレンダーエリア --- */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 2 }}>
        <IconButton onClick={handlePrevMonth}><ChevronLeft /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
          {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
        </Typography>
        <IconButton onClick={handleNextMonth}><ChevronRight /></IconButton>
      </Box>

      <Card elevation={0} sx={{ borderRadius: 4, mb: 4, border: '1px solid #e2e8f0' }}>
        <CardContent sx={{ p: 1 }}>
          <Grid container spacing={0} sx={{ mb: 1 }}>
            {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
              <Grid item xs={1.7} key={i} sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: i === 0 ? 'error.main' : i === 6 ? 'primary.main' : 'text.secondary', fontWeight: 'bold' }}>
                  {day}
                </Typography>
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={0}>
            {calendarDays.map((date, i) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, new Date());
              const hasData = hasDataOnDay(date);

              return (
                <Grid item xs={1.7} key={i} sx={{ aspectRatio: '1/1', p: 0.5 }}>
                  <Box
                    onClick={() => handleDateClick(date)}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      cursor: 'pointer',
                      bgcolor: isSelected ? 'primary.main' : 'transparent',
                      color: isSelected ? 'white' : isCurrentMonth ? 'text.primary' : 'text.disabled',
                      border: isToday && !isSelected ? '1px solid #1976d2' : 'none',
                      position: 'relative',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {date.getDate()}
                    </Typography>
                    {hasData && (
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: isSelected ? 'white' : 'secondary.main', mt: 0.5 }} />
                    )}
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* --- セッションリストエリア --- */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, ml: 1, display: 'flex', alignItems: 'center' }}>
          <AccessTime sx={{ fontSize: 16, mr: 0.5 }} />
          {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日の記録
        </Typography>

        <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {dailySessions.length > 0 ? (
            dailySessions.map((item) => {
              const scoreInfo = getScoreInfo(item);
              const theme = item.content?.theme || 'テーマなし';
              
              return (
                <Paper 
                  key={item.id} 
                  elevation={0}
                  onClick={() => handleSessionClick(item)}
                  sx={{ 
                    p: 0, borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden',
                    cursor: 'pointer', transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                    {/* スコアバッジ */}
                    <Box 
                      sx={{ 
                        width: 50, height: 50, borderRadius: 2.5, 
                        bgcolor: scoreInfo && scoreInfo.val >= 8 ? '#f0fdf4' : '#f8fafc',
                        color: scoreInfo && scoreInfo.val >= 8 ? '#15803d' : '#64748b',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        mr: 2, border: '1px solid', borderColor: 'divider'
                      }}
                    >
                      {scoreInfo ? (
                        <>
                          <Typography variant="h6" fontWeight="900" lineHeight={1}>
                            {scoreInfo.val}
                          </Typography>
                        </>
                      ) : (
                        <History fontSize="small" />
                      )}
                    </Box>

                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {item.learningMode === 'school' ? '定期テスト' : '入試対策'}
                      </Typography>
                      <Typography variant="subtitle2" fontWeight="bold" lineHeight={1.3}>
                        {theme}
                      </Typography>
                    </Box>

                    <Box sx={{ color: 'text.disabled', pr: 1 }}>
                      <CheckCircle fontSize="small" color={item.completed ? "success" : "disabled"} />
                    </Box>
                  </Box>
                </Paper>
              );
            })
          ) : (
            <Box textAlign="center" py={5} bgcolor="#f8fafc" borderRadius={3} border="1px dashed #e2e8f0">
              <AutoStories sx={{ color: '#cbd5e1', fontSize: 40, mb: 1 }} />
              <Typography color="text.secondary" variant="body2">
                この日の学習記録はありません
              </Typography>
            </Box>
          )}
        </List>
      </Box>

      {/* --- 詳細ダイアログ --- */}
      <Dialog 
        open={detailModalOpen} 
        onClose={() => setDetailModalOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, width: '100%', maxWidth: 400, m: 2 } }}
      >
        {selectedSession && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.1rem', pb: 1 }}>
              学習レポート
            </DialogTitle>
            <Divider />
            <DialogContent>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                THEME
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, lineHeight: 1.4 }}>
                {selectedSession.content?.theme}
              </Typography>

              {/* スコア詳細 */}
              {selectedSession.scores && (
                <Box sx={{ bgcolor: '#f9fafb', p: 2, borderRadius: 2, mb: 3, border: '1px solid #f1f5f9' }}>
                   <Grid container spacing={2} textAlign="center">
                     <Grid item xs={6}>
                       <Typography variant="caption" color="text.secondary">QUIZ</Typography>
                       <Typography variant="h6" fontWeight="bold">
                         {selectedSession.scores.quizCorrect}/{selectedSession.scores.quizTotal}
                       </Typography>
                     </Grid>
                     <Grid item xs={6}>
                       <Typography variant="caption" color="text.secondary">ESSAY</Typography>
                       <Typography variant="h6" fontWeight="bold">
                         {selectedSession.scores.essayScore}/{selectedSession.scores.essayTotal}
                       </Typography>
                     </Grid>
                   </Grid>
                </Box>
              )}

              {/* Next Action */}
              {selectedSession.scores?.nextAction && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', color: '#d97706', fontWeight: 'bold', mb: 1 }}>
                    <EmojiEvents sx={{ fontSize: 18, mr: 0.5 }} /> Next Action
                  </Typography>
                  <Typography variant="body2" sx={{ bgcolor: '#fffbf0', p: 1.5, borderRadius: 2, border: '1px solid #fde68a', fontSize: '0.9rem' }}>
                    {selectedSession.scores.nextAction}
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button onClick={() => setDetailModalOpen(false)} fullWidth variant="outlined" sx={{ borderRadius: 3, fontWeight: 'bold' }}>
                閉じる
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default LogScreen;