import React from 'react';
import { Box, Typography, Container, Paper, Stack, Button, TextField, Divider, Chip } from '@mui/material';
import { CheckCircle, Zap, BookOpen, Share2, MessageSquare, ChevronRight, Trophy } from 'lucide-react';
import MarkdownLite from '../components/MarkdownLite';
import { getFlattenedQuestions } from '../lib/utils';

const SummaryScreen = ({ 
  dailyData, userAnswers, essayGrading, activeSession, isReadOnly,
  reflection, setReflection, saveReflection,
  copyToClipboard, startNextSession 
}) => {
  
  if (!dailyData) return null;

  // 成績計算
  const flatQuestions = getFlattenedQuestions(dailyData);
  const objectiveQuestions = flatQuestions.filter(q => q.type !== 'essay');
  const objectiveCount = objectiveQuestions.length;
  
  const correctCount = objectiveQuestions.filter((q, i) => {
      const uAns = userAnswers[i];
      if (q.type === 'true_false') return uAns === q.correct;
      if (q.type === 'sort') return JSON.stringify(uAns) === JSON.stringify(q.correct_order);
      return false;
  }).length;

  const essayScore = essayGrading ? (essayGrading.score.k + essayGrading.score.l) : 0;
  const totalScore = Math.round((correctCount / objectiveCount) * 60 + (essayScore * 4)); // 簡易的な100点満点換算

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 12 }}>
      
      {/* ヘッダー */}
      <Box textAlign="center" mb={4} mt={2}>
          <Typography variant="overline" color="text.secondary" fontWeight="bold" letterSpacing={1}>
              SESSION COMPLETE
          </Typography>
          <Typography variant="h5" fontWeight="900" color="slate.900" gutterBottom>
              {dailyData.theme}
          </Typography>
          <Chip label="学習完了" color="success" size="small" icon={<CheckCircle size={14}/>} sx={{ fontWeight: 'bold' }} />
      </Box>

      {/* スコアカード */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 4, bgcolor: 'white', border: '1px solid', borderColor: 'divider', position: 'relative', overflow: 'hidden' }}>
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
          
          <Stack direction="row" justifyContent="space-around" alignItems="center" py={1}>
              <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">選択問題</Typography>
                  <Typography variant="h4" fontWeight="900" color="indigo.600">
                      {correctCount}<span className="text-sm text-slate-400">/{objectiveCount}</span>
                  </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">記述スコア</Typography>
                  <Typography variant="h4" fontWeight="900" color="secondary.main">
                      {essayScore}<span className="text-sm text-slate-400">/10</span>
                  </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">総合評価</Typography>
                  <Stack direction="row" alignItems="flex-end" justifyContent="center">
                      <Typography variant="h4" fontWeight="900" color="slate.800">
                          {totalScore}
                      </Typography>
                      <Typography variant="caption" color="slate.400" mb={0.8} ml={0.5}>点</Typography>
                  </Stack>
              </Box>
          </Stack>
      </Paper>

      {/* ★変更: 総合アドバイスセクション (コラムの代わり) */}
      {essayGrading && essayGrading.overall_advice && (
          <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 4, bgcolor: '#f0f9ff', border: '1px solid', borderColor: '#bae6fd' }}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                  <Box p={0.8} bgcolor="white" borderRadius="50%" color="#0284c7" display="flex">
                      <Trophy size={20} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight="bold" color="#0369a1">
                      今回の成績と学習アドバイス
                  </Typography>
              </Stack>
              <Box sx={{ typography: 'body2', color: '#0c4a6e', lineHeight: 1.8 }}>
                  <MarkdownLite text={essayGrading.overall_advice} />
              </Box>
          </Paper>
      )}

      {/* 振り返りメモ */}
      <Box mb={4}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <MessageSquare size={18} className="text-indigo-500" />
              <Typography variant="subtitle2" fontWeight="bold" color="slate.700">
                  振り返りメモ
              </Typography>
          </Stack>
          <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="気づいたことや、次に意識することを残しておきましょう"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              onBlur={saveReflection}
              disabled={isReadOnly}
              sx={{ bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
      </Box>

      {/* アクションボタン */}
      <Stack spacing={2}>
          {!isReadOnly && (
              <Button 
                  variant="contained" 
                  size="large" 
                  fullWidth
                  onClick={startNextSession}
                  endIcon={<ChevronRight />}
                  sx={{ py: 2, borderRadius: 3, fontWeight: 'bold', fontSize: '1.05rem', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}
              >
                  {typeof activeSession === 'number' && activeSession < 3 ? "次の学習へ進む" : "ホームに戻る"}
              </Button>
          )}

          {isReadOnly && (
              <Button 
                  variant="contained" 
                  size="large" 
                  fullWidth
                  onClick={startNextSession}
                  sx={{ py: 2, borderRadius: 3, fontWeight: 'bold' }}
              >
                  ホームに戻る
              </Button>
          )}

          <Stack direction="row" spacing={2}>
              <Button 
                  fullWidth 
                  variant="outlined" 
                  onClick={copyToClipboard}
                  startIcon={<Share2 size={18} />}
                  sx={{ borderRadius: 3, fontWeight: 'bold', borderColor: 'slate.300', color: 'slate.600' }}
              >
                  内容をコピー
              </Button>
              <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<BookOpen size={18} />}
                  sx={{ borderRadius: 3, fontWeight: 'bold', borderColor: 'slate.300', color: 'slate.600' }}
                  onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(dailyData.theme)}`, '_blank')}
              >
                  もっと調べる
              </Button>
          </Stack>
      </Stack>

    </Container>
  );
};

export default SummaryScreen;