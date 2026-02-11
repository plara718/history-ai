import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Container, Typography, Paper, 
  List, IconButton, Grid, Card, CardContent, Dialog, 
  DialogContent, DialogTitle, DialogActions, Button, Divider, 
  Tab, Tabs, Chip, Accordion, AccordionSummary, AccordionDetails, Stack
} from '@mui/material';
import { 
  History, CheckCircle, ChevronLeft, ChevronRight, 
  Close as CloseIcon, ExpandMore as ExpandMoreIcon,
  Cancel as CancelIcon, EmojiEvents,
  Edit as EditIcon, Quiz as QuizIcon, MenuBook as BookIcon,
  AccessTime, AutoStories
} from '@mui/icons-material';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';

import { StatsOverview } from '../components/StatsOverview';
import { SafeMarkdown } from '../components/SafeMarkdown';

const LogScreen = ({ userId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);

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
    let count = 0;
    while (day <= endDate && count < 42) {
      days.push(new Date(day));
      day.setDate(day.getDate() + 1);
      count++;
    }
    return days;
  }, [currentDate]);

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

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const handleDateClick = (date) => setSelectedDate(date);
  const handleSessionClick = (session) => {
    setSelectedSession(session);
    setTabIndex(0);
    setDetailModalOpen(true);
  };
  const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  const hasDataOnDay = (date) => monthlyData.some(item => item.timestamp && isSameDay(new Date(item.timestamp), date));

  const getScoreInfo = (item) => {
    if (item.scores) {
        const quizScore = item.scores.quizCorrect || 0;
        const essayScore = item.scores.essayScore || 0;
        const total = quizScore + essayScore;
        const max = (item.scores.quizTotal || 0) + 10;
        return { val: total, max };
    }
    if (item.gradingResult) return { val: item.gradingResult.score, max: 10 };
    return null;
  };

  return (
    <Container maxWidth="md" className="animate-fade-in" sx={{ pb: 10, pt: 4 }}>
      <Box mb={4} textAlign="center">
        <Typography variant="overline" color="text.secondary" fontWeight="bold" letterSpacing={2}>LEARNING LOGS</Typography>
        <Typography variant="h5" fontWeight="900" color="text.primary">学習の軌跡</Typography>
      </Box>

      <Box sx={{ mb: 6 }}><StatsOverview userId={userId} /></Box>
      <Divider sx={{ mb: 4 }}><Typography variant="caption" color="text.secondary" fontWeight="bold">HISTORY CALENDAR</Typography></Divider>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 2 }}>
        <IconButton onClick={handlePrevMonth}><ChevronLeft /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary' }}>{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</Typography>
        <IconButton onClick={handleNextMonth}><ChevronRight /></IconButton>
      </Box>

      <Card elevation={0} sx={{ borderRadius: 4, mb: 6, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={0} sx={{ mb: 1 }}>
            {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
              <Grid item xs={12 / 7} key={i} sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: i === 0 ? 'error.main' : i === 6 ? 'primary.main' : 'text.secondary', fontWeight: 'bold' }}>{day}</Typography>
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
                <Grid item xs={12 / 7} key={i} sx={{ aspectRatio: '1/1', p: 0.5 }}>
                  <Box onClick={() => handleDateClick(date)} sx={{
                      height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 3, cursor: 'pointer',
                      bgcolor: isSelected ? 'primary.main' : 'transparent',
                      color: isSelected ? 'primary.contrastText' : isCurrentMonth ? 'text.primary' : 'text.disabled',
                      border: isToday && !isSelected ? '1px solid' : 'none', borderColor: 'primary.main',
                      transition: 'all 0.2s', '&:hover': { bgcolor: isSelected ? 'primary.dark' : 'action.hover' }
                    }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{date.getDate()}</Typography>
                    {hasData && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: isSelected ? 'white' : 'secondary.main', mt: 0.5 }} />}
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      <Box sx={{ mb: 6 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, ml: 1, display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
          <AccessTime sx={{ fontSize: 16, mr: 1 }} />{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日の記録
        </Typography>
        <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {dailySessions.length > 0 ? (
            dailySessions.map((item) => {
              const scoreInfo = getScoreInfo(item);
              const theme = item.content?.theme || item.theme || 'テーマなし';
              return (
                <Paper key={item.id} elevation={0} onClick={() => handleSessionClick(item)} sx={{ p: 0, borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                    <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: 'grey.50', color: 'text.secondary', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', mr: 2, border: '1px solid', borderColor: 'divider' }}>
                      {scoreInfo ? (
                        <>
                          <Typography variant="h6" fontWeight="900" lineHeight={1}>{scoreInfo.val}</Typography>
                          <Typography variant="caption" fontSize="0.6rem" fontWeight="bold">TOTAL</Typography>
                        </>
                      ) : <History fontSize="small" />}
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'} • {item.learningMode === 'school' ? '定期テスト' : '入試対策'}
                      </Typography>
                      <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.3}>{theme}</Typography>
                    </Box>
                    <Box sx={{ color: 'text.disabled', pr: 1 }}><ChevronRight /></Box>
                  </Box>
                </Paper>
              );
            })
          ) : (
            <Box textAlign="center" py={5} bgcolor="grey.50" borderRadius={3} border="1px dashed" borderColor="grey.300">
              <AutoStories sx={{ color: 'text.disabled', fontSize: 40, mb: 1 }} />
              <Typography color="text.secondary" variant="body2" fontWeight="bold">この日の学習記録はありません</Typography>
            </Box>
          )}
        </List>
      </Box>

      <Dialog open={detailModalOpen} onClose={() => setDetailModalOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, minHeight: '80vh' } }}>
        {selectedSession && (() => {
          const { content, quizResults, gradingResult, essayAnswer, timestamp, scores } = selectedSession;
          const theme = content?.theme || selectedSession.theme || '無題の学習';
          const lecture = content?.lecture || "";
          const safeQuizCorrect = scores?.quizCorrect ?? (quizResults ? quizResults.filter(q => q.is_correct).length : 0);
          const safeQuizTotal = scores?.quizTotal ?? (quizResults ? quizResults.length : 0);

          return (
            <>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">{timestamp ? new Date(timestamp).toLocaleString() : ''}</Typography>
                  <Typography variant="h6" fontWeight="900" lineHeight={1.2}>{theme}</Typography>
                </Box>
                <IconButton onClick={() => setDetailModalOpen(false)}><CloseIcon /></IconButton>
              </DialogTitle>
              
              <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)} variant="fullWidth">
                  <Tab icon={<EditIcon fontSize="small"/>} label="記述添削" iconPosition="start" />
                  <Tab icon={<QuizIcon fontSize="small"/>} label="クイズ解説" iconPosition="start" />
                  <Tab icon={<BookIcon fontSize="small"/>} label="講義ノート" iconPosition="start" />
                </Tabs>
              </Box>

              <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
                {tabIndex === 0 && (
                  <Box p={3}>
                    {scores?.nextAction && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', color: 'warning.main', fontWeight: 'bold', mb: 1 }}><EmojiEvents sx={{ fontSize: 18, mr: 0.5 }} /> Next Action</Typography>
                        <Paper elevation={0} sx={{ bgcolor: 'warning.50', p: 2, borderRadius: 2, border: '1px solid', borderColor: 'warning.200' }}>
                           <Typography variant="body2" sx={{ color: 'text.primary', fontSize: '0.9rem', lineHeight: 1.6, fontWeight: 'medium' }}>{scores.nextAction}</Typography>
                        </Paper>
                      </Box>
                    )}
                    {gradingResult ? (
                      <>
                        <Paper sx={{ p: 3, mb: 3, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'white' }}>
                          <Box>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary">ESSAY SCORE</Typography>
                            <Typography variant="h3" fontWeight="900" color={gradingResult.score >= 8 ? 'success.main' : 'primary.main'}>{gradingResult.score}<span style={{fontSize: '1rem', color: '#94a3b8'}}>/10</span></Typography>
                          </Box>
                          <Chip icon={<EmojiEvents />} label={`Rank ${gradingResult.rank || '-'}`} color={gradingResult.score >= 8 ? 'success' : 'primary'} variant="outlined" sx={{ fontWeight: 'bold', fontSize: '1rem', px: 1, py: 2.5, borderRadius: 2 }} />
                        </Paper>
                        <Paper sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'white' }}>
                          <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" mb={1}>あなたの回答</Typography>
                          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary' }}>{essayAnswer || "（回答なし）"}</Typography>
                        </Paper>
                        <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'white' }}>
                           <Typography variant="subtitle2" color="primary" fontWeight="bold" mb={2} display="flex" alignItems="center" gap={1}><EditIcon fontSize="small"/> AI添削＆フィードバック</Typography>
                           <SafeMarkdown content={gradingResult.correction} />
                           <Divider sx={{ my: 2 }} />
                           <Typography variant="body2" color="text.secondary" fontWeight="bold">総評:</Typography>
                           <Typography variant="body2">{gradingResult.overall_comment}</Typography>
                        </Paper>
                      </>
                    ) : <Box textAlign="center" py={5} color="text.secondary"><Typography>記述データがありません</Typography></Box>}
                  </Box>
                )}

                {tabIndex === 1 && (
                  <Box p={3}>
                    <Paper sx={{ p: 2, mb: 3, bgcolor: 'white', borderRadius: 3, textAlign: 'center' }}>
                       <Typography variant="h6" fontWeight="bold">正答数: {safeQuizCorrect} / {safeQuizTotal} 問</Typography>
                    </Paper>
                    <Stack spacing={2}>
                      {quizResults && quizResults.map((q, i) => (
                        <Accordion key={i} sx={{ borderRadius: '12px !important', '&:before': {display:'none'}, boxShadow: 1 }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" alignItems="center" spacing={2} width="100%">
                              {q.is_correct ? <CheckCircle color="success" /> : <CancelIcon color="error" />}
                              <Box flexGrow={1} overflow="hidden">
                                <Typography variant="subtitle2" fontWeight="bold" noWrap>Q{i+1}. {q.q}</Typography>
                              </Box>
                            </Stack>
                          </AccordionSummary>
                          <AccordionDetails sx={{ bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>問題:</Typography>
                            <Typography variant="body2" mb={2}>{q.q}</Typography>

                            {/* ★ここが新しい部分: 自分の回答と正解の比較表示 */}
                            <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                {q.type === 'tf' && (
                                   <Grid container spacing={2}>
                                     <Grid item xs={6}>
                                       <Typography variant="caption" color="text.secondary">あなたの回答</Typography>
                                       <Typography fontWeight="bold" color={q.userSelection === undefined ? 'text.disabled' : (q.userSelection ? 'primary.main' : 'error.main')}>
                                         {q.userSelection === undefined ? '-' : (q.userSelection ? '⭕ 正しい' : '❌ 誤り')}
                                       </Typography>
                                     </Grid>
                                     <Grid item xs={6}>
                                       <Typography variant="caption" color="text.secondary">正解</Typography>
                                       <Typography fontWeight="bold" color={q.correctSelection ? 'primary.main' : 'error.main'}>
                                         {q.correctSelection ? '⭕ 正しい' : '❌ 誤り'}
                                       </Typography>
                                     </Grid>
                                   </Grid>
                                )}
                                {q.type === 'sort' && q.items && (
                                   <Grid container spacing={2}>
                                     <Grid item xs={12} sm={6}>
                                       <Typography variant="caption" color="text.secondary" display="block" mb={1}>あなたの回答</Typography>
                                       {q.userOrder ? q.userOrder.map((idx, i) => (
                                         <Box key={i} sx={{ display: 'flex', fontSize: '0.85rem', mb: 0.5 }}>
                                           <Typography variant="caption" fontWeight="bold" sx={{ width: 20, color: 'text.secondary' }}>{i+1}.</Typography>
                                           <Typography variant="body2" noWrap>{q.items[idx]}</Typography>
                                         </Box>
                                       )) : <Typography variant="caption">-</Typography>}
                                     </Grid>
                                     <Grid item xs={12} sm={6}>
                                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>正解</Typography>
                                        {q.correctOrder ? q.correctOrder.map((idx, i) => (
                                         <Box key={i} sx={{ display: 'flex', fontSize: '0.85rem', mb: 0.5 }}>
                                           <Typography variant="caption" fontWeight="bold" sx={{ width: 20, color: 'success.main' }}>{i+1}.</Typography>
                                           <Typography variant="body2" noWrap>{q.items[idx]}</Typography>
                                         </Box>
                                       )) : <Typography variant="caption">-</Typography>}
                                     </Grid>
                                   </Grid>
                                )}
                            </Box>

                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">解説:</Typography>
                            <Typography variant="body2" color="text.secondary">{q.exp || "解説がありません"}</Typography>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                      {(!quizResults || quizResults.length === 0) && <Typography textAlign="center" color="text.secondary">クイズ履歴がありません</Typography>}
                    </Stack>
                  </Box>
                )}

                {tabIndex === 2 && (
                  <Box p={3}>
                    <Paper sx={{ p: 4, borderRadius: 3, bgcolor: 'white', minHeight: 300 }}>
                      <SafeMarkdown content={lecture || "講義データがありません"} />
                    </Paper>
                  </Box>
                )}
              </DialogContent>
              <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
                <Button onClick={() => setDetailModalOpen(false)} fullWidth variant="outlined" size="large" sx={{ borderRadius: 3, fontWeight: 'bold', border: '1px solid', borderColor: 'divider', color: 'text.secondary' }}>閉じる</Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </Container>
  );
};

export default LogScreen;