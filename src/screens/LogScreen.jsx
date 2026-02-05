import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Container, Stack, Avatar } from '@mui/material';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Calendar, Trophy, TrendingUp, Clock, CheckCircle, ChevronRight } from 'lucide-react';

const LogScreen = ({ heatmapStats, userId, onSelectSession }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if(!userId) return;
      try {
        const q = query(collection(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress'), orderBy('timestamp', 'desc'), limit(10));
        const snap = await getDocs(q);
        // IDも含めてデータを取得
        setHistory(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch(e) { console.error(e); }
    };
    fetchHistory();
  }, [userId]);

  // ヒートマップ用の日付生成 (過去14日分)
  const getLast14Days = () => {
      const days = [];
      for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          days.push({ date: dateStr, active: heatmapStats[dateStr] });
      }
      return days;
  };

  const days = getLast14Days();

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 12 }}>
      
      {/* ヘッダー */}
      <Box mb={4} textAlign="center">
          <Typography variant="h5" fontWeight="900" color="slate.900" gutterBottom display="flex" alignItems="center" justifyContent="center" gap={1}>
              <Trophy className="text-amber-500" /> 学習ダッシュボード
          </Typography>
          <Typography variant="body2" color="text.secondary">
              毎日の積み重ねが、確かな合格力になります。
          </Typography>
      </Box>

      {/* ヒートマップカード */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, bgcolor: 'white', border: '1px solid', borderColor: 'divider', mb: 4 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={3}>
              <TrendingUp className="text-indigo-600" size={20} />
              <Typography variant="subtitle1" fontWeight="bold" color="slate.800">
                  学習の足跡 (直近2週間)
              </Typography>
          </Stack>
          
          <div className="flex justify-between items-end gap-1">
              {days.map((day, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div 
                          className={`w-full aspect-[3/4] rounded-md transition-all ${day.active ? 'bg-indigo-500 shadow-sm scale-105' : 'bg-slate-100'}`}
                          title={day.date}
                      />
                      <span className="text-[10px] text-slate-400 font-bold">
                          {new Date(day.date).getDate()}
                      </span>
                  </div>
              ))}
          </div>
      </Paper>

      {/* 履歴リスト */}
      <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom ml={1} mb={2}>
          最近の学習セッション
      </Typography>
      
      <Stack spacing={2}>
          {history.length > 0 ? (
              history.map((log, i) => (
                  <Paper 
                      key={i} 
                      elevation={0} 
                      onClick={() => onSelectSession && onSelectSession(log)} // クリックで詳細へ
                      sx={{ 
                          p: 2, 
                          borderRadius: 3, 
                          bgcolor: 'white', 
                          border: '1px solid', 
                          borderColor: 'slate.100',
                          display: 'flex', 
                          alignItems: 'flex-start', // 上揃えに変更してレイアウト崩れを防止
                          gap: 2,
                          cursor: 'pointer', // クリック可能であることを示すカーソル
                          transition: 'all 0.2s',
                          '&:hover': { boxShadow: 4, transform: 'translateY(-2px)', borderColor: 'indigo.200' }
                      }}
                  >
                      <Avatar sx={{ bgcolor: log.learningMode === 'school' ? 'emerald.100' : 'indigo.100', color: log.learningMode === 'school' ? 'emerald.600' : 'indigo.600', width: 40, height: 40, mt: 0.5 }}>
                          {log.learningMode === 'school' ? <CheckCircle size={20} /> : <Trophy size={20} />}
                      </Avatar>
                      
                      <Box flex={1}>
                          <Typography 
                            variant="body2" 
                            fontWeight="bold" 
                            color="slate.800" 
                            sx={{ 
                                lineHeight: 1.5, 
                                mb: 0.5,
                                // 改行を許可するスタイル
                                whiteSpace: 'normal',
                                wordBreak: 'break-word'
                            }}
                          >
                              {log.content?.theme || "学習セッション"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                              <Calendar size={12} /> {new Date(log.timestamp).toLocaleDateString()} 
                              <span className="mx-1">•</span>
                              <Clock size={12} /> {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </Typography>
                      </Box>

                      <Box display="flex" flexDirection="column" alignItems="flex-end" justifyContent="space-between" height="100%">
                          {log.essayGrading && (
                              <div className="text-right mb-2">
                                  <span className="block text-xs font-bold text-slate-400">スコア</span>
                                  <span className="text-lg font-black text-indigo-600">
                                      {(log.essayGrading.score?.k || 0) + (log.essayGrading.score?.l || 0)}
                                  </span>
                              </div>
                          )}
                          <ChevronRight size={16} className="text-slate-300" />
                      </Box>
                  </Paper>
              ))
          ) : (
              <Box textAlign="center" py={4} color="text.secondary">
                  まだ履歴がありません
              </Box>
          )}
      </Stack>

    </Container>
  );
};

export default LogScreen;