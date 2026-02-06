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

  // 1. スコア計算ロジックの修正（インデックス不整合を解決）
  const flatQuestions = getFlattenedQuestions(dailyData);
  const objectiveQuestions = flatQuestions.filter(q => q.type !== 'essay');
  const objectiveCount = objectiveQuestions.length;
  
  // flatQuestions全体の中でのインデックスを保持したまま正誤判定
  const correctCount = flatQuestions.reduce((acc, q, idx) => {
    if (q.type === 'essay') return acc;
    const uAns = userAnswers[idx];
    if (uAns === undefined) return acc;
    
    const isCorrect = q.type === 'true_false' 
      ? uAns === q.correct 
      : JSON.stringify(uAns) === JSON.stringify(q.correct_order);
      
    return isCorrect ? acc + 1 : acc;
  }, 0);

  const essayScore = essayGrading ? (essayGrading.score.k + essayGrading.score.l) : 0;
  const totalScore = Math.round((correctCount / objectiveCount) * 60 + (essayScore * 4));

  // 2. NotebookLM最適化Markdownの生成
  const handleExport = () => {
    const essayIndex = flatQuestions.findIndex(q => q.type === 'essay');
    const essayQ = flatQuestions[essayIndex];
    const theme = dailyData.theme || dailyData.content?.theme;

    const markdown = `
# 学習記録：${theme} [${new Date().toLocaleString('ja-JP')}]

## 1. メタ情報
- **学習日時**: ${new Date().toLocaleString('ja-JP')}
- **単元名**: ${theme}
- **学習モード**: ${dailyData.learningMode === 'school' ? '定期テスト対策' : '大学入試対策'}
- **難易度**: ${dailyData.difficulty}

## 2. 学習結果サマリー
- **選択問題正答数**: ${correctCount} / ${objectiveCount}
- **記述スコア（知識点）**: ${essayGrading?.score.k || 0} / 5
- **記述スコア（論理点）**: ${essayGrading?.score.l || 0} / 5
- **総合得点**: ${totalScore} 点

## 3. アウトプット（記述問題の詳細）
### 【設問】
${essayQ?.q || '不明'}

### 【提出した回答】
${userAnswers[essayIndex] || '（未回答）'}

### 【模範解答】
${essayQ?.model || '不明'}

### 【AI講師による詳細添削】
${essayGrading?.feedback || 'フィードバックなし'}

## 4. 分析データ：AI講師からの総合アドバイス
${essayGrading?.overall_advice || 'アドバイスなし'}

## 5. 振り返りメモ（自己分析）
${reflection || '（メモなし）'}

## 6. リソース：講義テキスト全文
---
${dailyData.content?.lecture || '講義データなし'}
---
    `.trim();

    // 親コンポーネントのコピー関数に構造化文字列を渡す
    copyToClipboard(markdown);
  };

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 12 }}>
      
      <Box textAlign="center" mb={4} mt={2}>
          <Typography variant="overline" color="text.secondary" fontWeight="bold">SESSION COMPLETE</Typography>
          <Typography variant="h5" fontWeight="900" color="slate.900" gutterBottom>
              {dailyData.theme || dailyData.content?.theme}
          </Typography>
          <Chip label="学習完了" color="success" size="small" icon={<CheckCircle size={14}/>} sx={{ fontWeight: 'bold' }} />
      </Box>

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
                      <Typography variant="h4" fontWeight="900" color="slate.800">{totalScore}</Typography>
                      <Typography variant="caption" color="slate.400" mb={0.8} ml={0.5}>点</Typography>
                  </Stack>
              </Box>
          </Stack>
      </Paper>

      {essayGrading?.overall_advice && (
          <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 4, bgcolor: '#f0f9ff', border: '1px solid', borderColor: '#bae6fd' }}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                  <Box p={0.8} bgcolor="white" borderRadius="50%" color="#0284c7" display="flex"><Trophy size={20} /></Box>
                  <Typography variant="subtitle1" fontWeight="bold" color="#0369a1">今回の成績と学習アドバイス</Typography>
              </Stack>
              <Box sx={{ typography: 'body2', color: '#0c4a6e', lineHeight: 1.8 }}><MarkdownLite text={essayGrading.overall_advice} /></Box>
          </Paper>
      )}

      <Box mb={4}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <MessageSquare size={18} className="text-indigo-500" />
              <Typography variant="subtitle2" fontWeight="bold" color="slate.700">振り返りメモ</Typography>
          </Stack>
          <TextField
              fullWidth multiline rows={3} placeholder="気づいたことや、次に意識することを残しておきましょう"
              value={reflection} onChange={(e) => setReflection(e.target.value)} onBlur={saveReflection} disabled={isReadOnly}
              sx={{ bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
      </Box>

      <Stack spacing={2}>
          <Button 
              variant="contained" size="large" fullWidth onClick={startNextSession} endIcon={<ChevronRight />}
              sx={{ py: 2, borderRadius: 3, fontWeight: 'bold', fontSize: '1.05rem', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}
          >
              {activeSession < 3 ? "次の学習へ進む" : "ホームに戻る"}
          </Button>

          <Stack direction="row" spacing={2}>
              <Button 
                  fullWidth variant="outlined" onClick={handleExport} startIcon={<Share2 size={18} />}
                  sx={{ borderRadius: 3, fontWeight: 'bold', borderColor: 'slate.300', color: 'slate.600' }}
              >
                  内容をコピー
              </Button>
              <Button 
                  fullWidth variant="outlined" startIcon={<BookOpen size={18} />}
                  sx={{ borderRadius: 3, fontWeight: 'bold', borderColor: 'slate.300', color: 'slate.600' }}
                  onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(dailyData.theme || dailyData.content?.theme)}`, '_blank')}
              >
                  もっと調べる
              </Button>
          </Stack>
      </Stack>
    </Container>
  );
};

export default SummaryScreen;