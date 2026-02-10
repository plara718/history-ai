import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Container, Typography, Paper, 
  List, IconButton, Grid, Card, CardContent, Dialog, 
  DialogContent, DialogActions, Button, Divider 
} from '@mui/material';
import { 
  History, CheckCircle, ChevronLeft, ChevronRight, 
  EmojiEvents, AccessTime, AutoStories 
} from '@mui/icons-material';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';

// 統計分析コンポーネント
import { StatsOverview } from '../components/StatsOverview';

const LogScreen = ({ userId }) => {
  // カレンダー用ステート
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(false);

  // 詳細ダイアログ用ステート
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  // --- カレンダーロジック ---
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // カレンダーの開始日（最初の日曜日）
    const startDate = new Date(firstDay);
    startDate.setDate(1 - firstDay.getDay());
    
    // カレンダーの終了日（最後の土曜日）
    const endDate = new Date(lastDay);
    if (lastDay.getDay() !== 6) {
      endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    }
    
    const days = [];
    const day = new Date(startDate);
    // 無限ループ防止のため、最大42日（6週間）分だけ生成
    let count = 0;
    while (day <= endDate && count < 42) {
      days.push(new Date(day));
      day.setDate(day.getDate() + 1);
      count++;
    }
    return days;
  }, [currentDate]);

  // --- データ取得ロジック ---
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
      if (!item.timestamp) return false;
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
  
  const hasDataOnDay = (date) => monthlyData.some(item => item.timestamp && isSameDay(new Date(item.timestamp), date));

  // スコア表示ヘルパー
  const getScoreInfo = (item) => {
    if (item.scores) {
        const totalEarned = (item.scores.quizCorrect || 0) + (item.scores.essayScore || 0);
        const totalMax = (item.scores.quizTotal || 0) + (item.scores.essayTotal || 10);
        // 合計点数を10点満点に換算して表示
        const scaledScore = totalMax > 0 ? Math.round((totalEarned / totalMax) * 10) : 0;
        return { val: scaledScore, max: 10 };
    }
    // 古いデータ形式または採点結果のみの場合
    if (item.gradingResult) return { val: item.gradingResult.score, max: 10 };
    return null;
  };

  return (
    <Container maxWidth="md" className="animate-fade-in" sx={{ pb: 10, pt: 4 }}>
      {/* ヘッダーエリア */}
      <Box mb={4} textAlign="center">
        <Typography variant="overline" color="text.secondary" fontWeight="bold" letterSpacing={2}>
          LEARNING LOGS
        </Typography>
        <Typography variant="h5" fontWeight="900" color="text.primary">
          学習の軌跡
        </Typography>
      </Box>


      {/* 統計分析エリア (Weakness / Strength) */}
      <Box sx={{ mb: 6 }}>
        <StatsOverview userId={userId} />
      </Box>

      <Divider sx={{ mb: 4 }}>
        <Typography variant="caption" color="text.secondary" fontWeight="bold">HISTORY CALENDAR</Typography>
      </Divider>

      {/* --- カレンダーエリア --- */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 2 }}>
        <IconButton onClick={handlePrevMonth}><ChevronLeft /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
          {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
        </Typography>
        <IconButton onClick={handleNextMonth}><ChevronRight /></IconButton>
      </Box>

      <Card elevation={0} sx={{ borderRadius: 4, mb: 6, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2 }}>
          {/* 曜日ヘッダー */}
          <Grid container spacing={0} sx={{ mb: 1 }}>
            {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
              <Grid item xs={12 / 7} key={i} sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: i === 0 ? 'error.main' : i === 6 ? 'primary.main' : 'text.secondary', fontWeight: 'bold' }}>
                  {day}
                </Typography>
              </Grid>
            ))}
          </Grid>
          
          {/* 日付セル */}
          <Grid container spacing={0}>
            {calendarDays.map((date, i) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, new Date());
              const hasData = hasDataOnDay(date);

              return (
                <Grid item xs={12 / 7} key={i} sx={{ aspectRatio: '1/1', p: 0.5 }}>
                  <Box
                    onClick={() => handleDateClick(date)}
                    sx={{
                      height: '100%',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      cursor: 'pointer',
                      bgcolor: isSelected ? 'primary.main' : 'transparent',
                      color: isSelected ? 'primary.contrastText' : isCurrentMonth ? 'text.primary' : 'text.disabled',
                      border: isToday && !isSelected ? '1px solid' : 'none',
                      borderColor: 'primary.main',
                      transition: 'all 0.2s',
                      position: 'relative',
                      '&:hover': { bgcolor: isSelected ? 'primary.dark' : 'action.hover' }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {date.getDate()}
                    </Typography>
                    
                    {/* データがある日のドットマーカー */}
                    {hasData && (
                      <Box 
                        sx={{ 
                          width: 5, height: 5, 
                          borderRadius: '50%', 
                          bgcolor: isSelected ? 'white' : 'secondary.main', 
                          mt: 0.5 
                        }} 
                      />
                    )}
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* --- セッションリストエリア --- */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, ml: 1, display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
          <AccessTime sx={{ fontSize: 16, mr: 1 }} />
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
                    p: 0, borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden',
                    cursor: 'pointer', transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                    {/* スコアバッジ */}
                    <Box 
                      sx={{ 
                        width: 56, height: 56, borderRadius: 3, 
                        bgcolor: scoreInfo && scoreInfo.val >= 8 ? 'success.50' : 'grey.50',
                        color: scoreInfo && scoreInfo.val >= 8 ? 'success.main' : 'text.secondary',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        mr: 2, border: '1px solid', borderColor: 'divider'
                      }}
                    >
                      {scoreInfo ? (
                        <>
                          <Typography variant="h6" fontWeight="900" lineHeight={1}>
                            {scoreInfo.val}
                          </Typography>
                          <Typography variant="caption" fontSize="0.6rem" fontWeight="bold">SCORE</Typography>
                        </>
                      ) : (
                        <History fontSize="small" />
                      )}
                    </Box>

                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'} • {item.learningMode === 'school' ? '定期テスト' : '入試対策'}
                      </Typography>
                      <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.3}>
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
            <Box textAlign="center" py={5} bgcolor="grey.50" borderRadius={3} border="1px dashed" borderColor="grey.300">
              <AutoStories sx={{ color: 'text.disabled', fontSize: 40, mb: 1 }} />
              <Typography color="text.secondary" variant="body2" fontWeight="bold">
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
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, m: 2 } }}
      >
        {selectedSession && (
          <>
            <DialogContent sx={{ pt: 3, pb: 2 }}>
              <Box textAlign="center" mb={2}>
                 <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: 1 }}>
                    LEARNING REPORT
                 </Typography>
                 <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.3, mt: 0.5 }}>
                    {selectedSession.content?.theme}
                 </Typography>
              </Box>

              <Divider sx={{ mb: 3 }} />
            
              {/* スコア詳細 */}
              {selectedSession.scores && (
                <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 3, mb: 3, border: '1px solid', borderColor: 'divider' }}>
                   <Grid container spacing={2} textAlign="center">
                     <Grid item xs={6}>
                       <Typography variant="caption" color="text.secondary" fontWeight="bold">QUIZ</Typography>
                       <Typography variant="h5" fontWeight="900" color="primary.main">
                         {selectedSession.scores.quizCorrect}<span style={{fontSize: '0.9rem', color: '#9ca3af'}}>/{selectedSession.scores.quizTotal}</span>
                       </Typography>
                     </Grid>
                     <Grid item xs={6}>
                       <Typography variant="caption" color="text.secondary" fontWeight="bold">ESSAY</Typography>
                       <Typography variant="h5" fontWeight="900" color="primary.main">
                         {selectedSession.scores.essayScore}<span style={{fontSize: '0.9rem', color: '#9ca3af'}}>/{selectedSession.scores.essayTotal}</span>
                       </Typography>
                     </Grid>
                   </Grid>
                </Box>
              )}

              {/* Next Action */}
              {selectedSession.scores?.nextAction && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', color: 'warning.main', fontWeight: 'bold', mb: 1 }}>
                    <EmojiEvents sx={{ fontSize: 18, mr: 0.5 }} /> Next Action
                  </Typography>
                  <Paper elevation={0} sx={{ bgcolor: 'warning.50', p: 2, borderRadius: 2, border: '1px solid', borderColor: 'warning.200' }}>
                     <Typography variant="body2" sx={{ color: 'text.primary', fontSize: '0.9rem', lineHeight: 1.6, fontWeight: 'medium' }}>
                       {selectedSession.scores.nextAction}
                     </Typography>
                  </Paper>
                </Box>
              )}
              
              {/* 完了日時 */}
              <Typography variant="caption" display="block" textAlign="right" color="text.disabled" sx={{ mt: 2 }}>
                Completed: {new Date(selectedSession.timestamp).toLocaleString()}
              </Typography>
            </DialogContent>
            
            <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
              <Button 
                onClick={() => setDetailModalOpen(false)} 
                fullWidth 
                variant="outlined" 
                size="large" 
                sx={{ borderRadius: 3, fontWeight: 'bold', border: '1px solid', borderColor: 'divider', color: 'text.secondary' }}
              >
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