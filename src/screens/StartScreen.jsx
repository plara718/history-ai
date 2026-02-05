import React from 'react';
import { Box, Button, Typography, Container, Stack, Paper, Chip, ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Play, RotateCcw, Zap, BookOpen, GraduationCap, School, Settings, LogOut, CheckCircle } from 'lucide-react';
import { TEXTBOOK_UNITS, MAX_DAILY_SESSIONS, DIFFICULTY_DESCRIPTIONS } from '../lib/constants'; // ★定数を追加インポート

const StartScreen = ({ 
  activeSession, viewingSession, isDailyLimitReached,
  learningMode, setLearningMode,
  selectedUnit, setSelectedUnit,
  difficulty, setDifficulty,
  generateDailyLesson, startWeaknessReview,
  isProcessing, historyMeta, onSwitchSession,
  onResume, onRegenerate, regenCount,
  onLogout, userId, openSettings 
}) => {
  
  const isSchool = learningMode === 'school';
  const themeColor = isSchool ? 'emerald' : 'indigo'; 
  
  const isViewingCompleted = historyMeta && historyMeta[viewingSession]?.completed;
  const isViewingExists = historyMeta && historyMeta[viewingSession]?.exists;

  // ★現在選択されている難易度の説明を取得
  const currentDifficultyDesc = DIFFICULTY_DESCRIPTIONS[learningMode]?.[difficulty]?.desc || "設定に合わせてAIが調整します";

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 8 }}>
      
      {/* ユーザー情報ヘッダー */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
          <Box>
              <Typography variant="caption" fontWeight="bold" color="text.secondary">ログイン中</Typography>
              <Typography variant="body2" fontFamily="monospace" fontWeight="bold" color="slate.700">
                  {userId ? (userId.slice(0, 6) + "...") : ""}
              </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
              <Button 
                  size="small" variant="outlined" color="inherit" onClick={openSettings}
                  startIcon={<Settings size={14}/>} sx={{ minWidth: 0, px: 1.5 }}
              >
                  設定
              </Button>
              <Button 
                  size="small" variant="outlined" color="error" onClick={onLogout}
                  startIcon={<LogOut size={14}/>} sx={{ minWidth: 0, px: 1.5 }}
              >
                  ログアウト
              </Button>
          </Stack>
      </Box>

      {/* セッション切り替えタブ */}
      <Stack direction="row" spacing={1} mb={4} justifyContent="center">
        {[1, 2, 3].map((num) => {
           const meta = historyMeta[num] || {};
           const isActive = num === viewingSession;
           const isFuture = num > activeSession && !meta.exists;
           
           let bg = 'bg-slate-100 text-slate-400';
           if (isActive) bg = isSchool ? 'bg-emerald-600 text-white shadow-lg scale-105' : 'bg-indigo-600 text-white shadow-lg scale-105';
           else if (meta.completed) bg = 'bg-slate-800 text-white';
           else if (meta.exists) bg = 'bg-white border-2 border-indigo-600 text-indigo-600';

           return (
             <button
               key={num}
               disabled={isFuture}
               onClick={() => onSwitchSession(num)}
               className={`relative w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${bg} ${isFuture ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
             >
               <span className="text-xs font-bold">限目</span>
               <span className="text-2xl font-black">{num}</span>
               {meta.completed && <div className="absolute -top-2 -right-2 bg-yellow-400 text-slate-900 rounded-full p-0.5"><Zap size={12} fill="currentColor"/></div>}
             </button>
           );
        })}
      </Stack>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 4, mb: 3, bgcolor: 'white', border: '1px solid', borderColor: 'slate.200' }}>
        
        {/* モード設定 (データ未生成時のみ表示) */}
        {!isViewingExists && (
          <Stack spacing={3} mb={3}>
            <ToggleButtonGroup
              value={learningMode}
              exclusive
              onChange={(e, v) => v && setLearningMode(v)}
              fullWidth
              sx={{ 
                '& .MuiToggleButton-root': { borderRadius: 3, fontWeight: 'bold', border: 'none', bgcolor: 'slate.50', mx: 0.5 },
                '& .Mui-selected': { bgcolor: `${themeColor}.100 !important`, color: `${themeColor}.700 !important` }
              }}
            >
              <ToggleButton value="general" sx={{ py: 1.5 }}>
                <GraduationCap size={18} className="mr-2"/> 受験総合
              </ToggleButton>
              <ToggleButton value="school" sx={{ py: 1.5 }}>
                <School size={18} className="mr-2"/> 定期テスト
              </ToggleButton>
            </ToggleButtonGroup>

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

            <Box>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" mb={1}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary">難易度:</Typography>
                    {['easy', 'standard', 'hard'].map(d => (
                        <Chip 
                            key={d} 
                            label={d === 'easy' ? '基本' : d === 'standard' ? '標準' : '発展'} 
                            onClick={() => setDifficulty(d)}
                            color={difficulty === d ? (isSchool ? 'success' : 'primary') : 'default'}
                            variant={difficulty === d ? 'filled' : 'outlined'}
                            size="small"
                            sx={{ fontWeight: 'bold' }}
                        />
                    ))}
                </Stack>
                
                {/* ★復活: 難易度の説明文 */}
                <Typography variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ bgcolor: 'slate.50', py: 0.5, borderRadius: 1 }}>
                    {currentDifficultyDesc}
                </Typography>
            </Box>
          </Stack>
        )}

        {/* アクションボタンエリア */}
        <Stack spacing={2}>
            {isViewingExists ? (
                isViewingCompleted ? (
                    <Button 
                        fullWidth 
                        variant="outlined" 
                        color="inherit" 
                        size="large"
                        onClick={onResume}
                        startIcon={<CheckCircle size={20} className="text-emerald-500" />}
                        sx={{ 
                            borderRadius: 3, 
                            py: 2, 
                            fontWeight: 'bold', 
                            color: 'slate.700',
                            borderColor: 'slate.300',
                            bgcolor: 'slate.50'
                        }}
                    >
                        学習結果・講義を見直す
                    </Button>
                ) : (
                    <Button 
                        fullWidth 
                        variant="contained" 
                        size="large" 
                        onClick={onResume}
                        startIcon={<Play fill="currentColor" />}
                        className={`bg-${themeColor}-600 hover:bg-${themeColor}-700`}
                        sx={{ borderRadius: 3, py: 2, fontSize: '1.1rem', fontWeight: 'bold' }}
                    >
                        学習を再開する
                    </Button>
                )
            ) : (
                <Button 
                    fullWidth 
                    variant="contained" 
                    size="large" 
                    onClick={generateDailyLesson}
                    disabled={isProcessing || isDailyLimitReached}
                    startIcon={isProcessing ? <Zap className="animate-spin"/> : <BookOpen />}
                    sx={{ 
                        borderRadius: 3, 
                        py: 2, 
                        fontSize: '1.1rem', 
                        fontWeight: 'bold',
                        bgcolor: isSchool ? '#059669' : '#4f46e5',
                        '&:hover': { bgcolor: isSchool ? '#047857' : '#4338ca' }
                    }}
                >
                    {isProcessing ? "AIが授業準備中..." : "学習をはじめる"}
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
                >
                    問題を生成し直す (あと{1 - regenCount}回)
                </Button>
            )}
        </Stack>
      </Paper>

      {/* 弱点復習ボタン */}
      <Button 
          fullWidth 
          variant="outlined" 
          onClick={startWeaknessReview}
          disabled={isProcessing}
          startIcon={<RotateCcw />}
          sx={{ borderRadius: 3, py: 1.5, borderColor: 'slate.300', color: 'slate.600', fontWeight: 'bold' }}
      >
          苦手を復習モード
      </Button>

      {isDailyLimitReached && (
          <Typography variant="caption" display="block" textAlign="center" color="error" mt={2} fontWeight="bold">
              本日の学習上限に達しました。また明日頑張りましょう！
          </Typography>
      )}

    </Container>
  );
};

export default StartScreen;