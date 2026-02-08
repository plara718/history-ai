import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Typography, Container, Stack, Paper, Chip, 
  ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, Skeleton, Fade
} from '@mui/material';
import { 
  Play, RotateCcw, Zap, BookOpen, GraduationCap, School, Settings, LogOut, CheckCircle,
  Activity 
} from 'lucide-react';
import { TEXTBOOK_UNITS, DIFFICULTY_DESCRIPTIONS } from '../lib/constants';
import { getReviewStrategy } from '../lib/reviewStrategy';

const StartScreen = ({ 
  activeSession, viewingSession, isDailyLimitReached,
  learningMode, setLearningMode,
  selectedUnit, setSelectedUnit,
  difficulty, setDifficulty,
  
  // App.jsx から渡されるハンドラ
  onStartLesson,       
  onResumeLesson,      
  onStartReview,       
  
  isProcessing, historyMeta, onSwitchSession,
  onRegenerate, regenCount,
  onLogout, userId, openSettings 
}) => {
  
  const isSchool = learningMode === 'school';
  const themeColor = isSchool ? 'success' : 'primary';
  
  const currentSessionMeta = historyMeta[viewingSession] || {};
  const isViewingCompleted = !!currentSessionMeta.completed;
  const isViewingExists = !!currentSessionMeta.exists;

  const currentDifficultyDesc = DIFFICULTY_DESCRIPTIONS[learningMode]?.[difficulty]?.desc || "設定に合わせてAIが調整します";

  const [reviewStrategy, setReviewStrategy] = useState(null);
  const [loadingStrategy, setLoadingStrategy] = useState(true);

  useEffect(() => {
    const fetchStrategy = async () => {
      if (!userId) return;
      setLoadingStrategy(true);
      try {
        const strategy = await getReviewStrategy(userId);
        setReviewStrategy(strategy);
      } catch (e) {
        console.error("Strategy fetch failed", e);
      } finally {
        setLoadingStrategy(false);
      }
    };
    fetchStrategy();
  }, [userId]);

  const handleReviewStart = () => {
    if (reviewStrategy && onStartReview) {
      onStartReview(reviewStrategy);
    }
  };

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 8, pt: 2 }}>
      
      {/* ユーザー情報ヘッダー */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
          <Box>
              <Typography variant="caption" fontWeight="bold" color="text.secondary">ログイン中</Typography>
              <Typography variant="body2" fontFamily="monospace" fontWeight="bold" color="text.primary">
                  {userId ? (userId.slice(0, 6) + "...") : ""}
              </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
              <Button 
                  size="small" variant="outlined" color="inherit" onClick={openSettings}
                  startIcon={<Settings size={14}/>} sx={{ minWidth: 0, px: 1.5, borderRadius: 2 }}
              >
                  設定
              </Button>
              <Button 
                  size="small" variant="outlined" color="error" onClick={onLogout}
                  startIcon={<LogOut size={14}/>} sx={{ minWidth: 0, px: 1.5, borderRadius: 2 }}
              >
                  ログアウト
              </Button>
          </Stack>
      </Box>

      {/* 復習レコメンドカード */}
      {!isViewingExists && !isDailyLimitReached && (
        <Box sx={{ mb: 4 }}>
          {loadingStrategy ? (
            <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 4 }} />
          ) : reviewStrategy && (
            <Fade in={true}>
              <Card 
                elevation={0}
                sx={{ 
                  borderRadius: 2, // ★修正済み: 4だと丸すぎるので2に変更
                  background: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)', 
                  border: '1px solid #FECDD3',
                  position: 'relative', overflow: 'visible'
                }}
              >
                {/* Badge */}
                <Box sx={{
                  position: 'absolute', top: -10, left: 16,
                  bgcolor: '#E11D48', color: 'white',
                  px: 1.5, py: 0.25, borderRadius: 20,
                  fontSize: '0.7rem', fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  boxShadow: '0 2px 6px rgba(225, 29, 72, 0.3)'
                }}>
                  <Activity size={14} /> WEAKNESS DETECTED
                </Box>

                <CardContent sx={{ pt: 2.5, pb: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#881337', mb: 0.5, lineHeight: 1.2 }}>
                    弱点克服トレーニング
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ color: '#9F1239', mb: 1.5, fontWeight: 500, lineHeight: 1.4 }}>
                    {reviewStrategy.reason}
                  </Typography>
                  
                  <Stack direction="row" spacing={1} alignItems="center">
                     <Chip 
                       label={reviewStrategy.target_era_label || reviewStrategy.target_era} 
                       size="small" 
                       sx={{ bgcolor: 'white', color: '#E11D48', fontWeight: 'bold', height: 24, border: '1px solid #FDA4AF' }} 
                     />
                     <Chip 
                       label={reviewStrategy.target_mistake_label || reviewStrategy.target_mistake} 
                       size="small" 
                       sx={{ bgcolor: 'white', color: '#E11D48', fontWeight: 'bold', height: 24, border: '1px solid #FDA4AF' }} 
                     />
                     
                     <Box flexGrow={1} />
                     
                     <Button 
                       variant="contained" 
                       size="small"
                       onClick={handleReviewStart}
                       disabled={isProcessing}
                       sx={{ 
                         bgcolor: '#E11D48', color: 'white', fontWeight: 'bold', borderRadius: 2,
                         boxShadow: '0 2px 8px rgba(225, 29, 72, 0.25)',
                         '&:hover': { bgcolor: '#BE123C' }
                       }}
                     >
                       今すぐ治療する
                     </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Fade>
          )}
        </Box>
      )}

      {/* セッション切り替えタブ */}
      <Stack direction="row" spacing={1} mb={4} justifyContent="center">
        {[1, 2, 3].map((num) => {
           const meta = historyMeta[num] || {};
           const isActive = num === viewingSession;
           const isFuture = num > activeSession && !meta.exists;
           
           let btnClass = "relative w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ";
           if (isActive) {
             btnClass += isSchool 
               ? "bg-emerald-600 text-white shadow-lg scale-105 ring-2 ring-emerald-300" 
               : "bg-indigo-600 text-white shadow-lg scale-105 ring-2 ring-indigo-300";
           } else if (meta.completed) {
             btnClass += "bg-slate-800 text-white";
           } else if (meta.exists) {
             btnClass += "bg-white border-2 border-indigo-600 text-indigo-600";
           } else {
             btnClass += "bg-slate-100 text-slate-400";
           }
           
           if (isFuture) btnClass += " opacity-50 cursor-not-allowed";
           else btnClass += " hover:scale-105 cursor-pointer";

           return (
             <button
               key={num}
               disabled={isFuture}
               onClick={() => onSwitchSession(num)}
               className={btnClass}
             >
               <span className="text-[10px] font-bold opacity-80">SESSION</span>
               <span className="text-2xl font-black leading-none">{num}</span>
               {meta.completed && (
                 <div className="absolute -top-1 -right-1 bg-yellow-400 text-slate-900 rounded-full p-0.5 shadow-sm">
                   <Zap size={10} fill="currentColor"/>
                 </div>
               )}
             </button>
           );
        })}
      </Stack>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 4, mb: 3, bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}>
        
        {/* データ未生成時のみ設定を表示 */}
        {!isViewingExists && (
          <Stack spacing={3} mb={4}>
            {/* モード切替 */}
            <ToggleButtonGroup
              value={learningMode}
              exclusive
              onChange={(e, v) => v && setLearningMode(v)}
              fullWidth
              sx={{ 
                '& .MuiToggleButton-root': { 
                  borderRadius: 3, 
                  fontWeight: 'bold', 
                  border: 'none', 
                  bgcolor: 'action.hover', 
                  mx: 0.5,
                  textTransform: 'none',
                  fontSize: '0.95rem'
                },
                '& .Mui-selected': { 
                  bgcolor: isSchool ? 'success.50 !important' : 'primary.50 !important', 
                  color: isSchool ? 'success.main !important' : 'primary.main !important',
                  border: '1px solid !important',
                  borderColor: isSchool ? 'success.200 !important' : 'primary.200 !important'
                }
              }}
            >
              <ToggleButton value="general" sx={{ py: 1.5 }}>
                <GraduationCap size={18} style={{ marginRight: 8 }}/> 受験総合
              </ToggleButton>
              <ToggleButton value="school" sx={{ py: 1.5 }}>
                <School size={18} style={{ marginRight: 8 }}/> 定期テスト
              </ToggleButton>
            </ToggleButtonGroup>

            {/* 教科書単元選択 (Schoolモードのみ) */}
            {isSchool && (
               <FormControl fullWidth size="small">
                 <InputLabel>教科書の単元</InputLabel>
                 <Select
                   value={selectedUnit}
                   label="教科書の単元"
                   onChange={(e) => setSelectedUnit(e.target.value)}
                   sx={{ borderRadius: 2 }}
                 >
                   {TEXTBOOK_UNITS.map((u) => (
                     <MenuItem key={u} value={u}>{u}</MenuItem>
                   ))}
                 </Select>
               </FormControl>
            )}

            {/* 難易度選択 */}
            <Box>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" mb={1.5}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary">DIFFICULTY:</Typography>
                    {['easy', 'standard', 'hard'].map(d => (
                        <Chip 
                            key={d} 
                            label={d === 'easy' ? '基本' : d === 'standard' ? '標準' : '発展'} 
                            onClick={() => setDifficulty(d)}
                            color={difficulty === d ? themeColor : 'default'}
                            variant={difficulty === d ? 'filled' : 'outlined'}
                            size="small"
                            sx={{ fontWeight: 'bold', minWidth: 60 }}
                        />
                    ))}
                </Stack>
                <Typography variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ bgcolor: 'action.hover', py: 0.5, borderRadius: 1 }}>
                    {currentDifficultyDesc}
                </Typography>
            </Box>
          </Stack>
        )}

        {/* アクションボタンエリア */}
        <Stack spacing={2}>
            {isViewingExists ? (
                // 既存データがある場合
                isViewingCompleted ? (
                    // 完了済み -> 再確認
                    <Button 
                        fullWidth 
                        variant="outlined" 
                        color="inherit" 
                        size="large"
                        onClick={onResumeLesson}
                        startIcon={<CheckCircle size={20} className="text-emerald-500" />}
                        sx={{ 
                            borderRadius: 3, 
                            py: 2, 
                            fontWeight: 'bold', 
                            color: 'text.secondary',
                            borderColor: 'divider',
                            bgcolor: 'action.hover'
                        }}
                    >
                        学習結果を見直す
                    </Button>
                ) : (
                    // 未完了 -> 再開ボタン
                    <Button 
                        fullWidth 
                        variant="contained" 
                        size="large" 
                        onClick={onResumeLesson}
                        startIcon={<Play fill="currentColor" />}
                        color={themeColor}
                        sx={{ 
                            borderRadius: 3, 
                            py: 2, 
                            fontSize: '1.1rem', 
                            fontWeight: 'bold',
                            boxShadow: 3
                        }}
                    >
                        学習を再開する
                    </Button>
                )
            ) : (
                // データなし -> 生成ボタン
                <Button 
                    fullWidth 
                    variant="contained" 
                    size="large" 
                    onClick={onStartLesson}
                    disabled={isProcessing || isDailyLimitReached}
                    startIcon={isProcessing ? <Zap className="animate-spin"/> : <BookOpen />}
                    color={themeColor}
                    sx={{ 
                        borderRadius: 3, 
                        py: 2, 
                        fontSize: '1.1rem', 
                        fontWeight: 'bold',
                        boxShadow: 4,
                        background: isSchool 
                          ? 'linear-gradient(to right, #059669, #10b981)' 
                          : 'linear-gradient(to right, #4f46e5, #6366f1)'
                    }}
                >
                    {isProcessing ? "AIが準備中..." : "学習をはじめる"}
                </Button>
            )}

            {isViewingExists && !isViewingCompleted && (
                <Button 
                    fullWidth 
                    size="small" 
                    color="error" 
                    variant="text"
                    onClick={onRegenerate}
                    disabled={isProcessing || regenCount >= 1}
                    startIcon={<RotateCcw size={14} />}
                    sx={{ opacity: 0.8 }}
                >
                    問題を生成し直す (あと{1 - regenCount}回)
                </Button>
            )}
        </Stack>
      </Paper>

      {isDailyLimitReached && (
          <Typography variant="caption" display="block" textAlign="center" color="error" mt={2} fontWeight="bold">
              本日の学習上限に達しました。また明日頑張りましょう！
          </Typography>
      )}

    </Container>
  );
};

export default StartScreen;