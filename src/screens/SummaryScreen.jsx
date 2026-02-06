import React, { useState } from 'react';
import { 
  Box, Container, Paper, Typography, Button, TextField, 
  Divider, Chip, Stack, Alert, Snackbar 
} from '@mui/material';
import { 
  ContentCopy as CopyIcon, 
  OpenInNew as ExternalLinkIcon,
  CheckCircle as CheckIcon,
  EmojiEvents as TrophyIcon,
  EditNote as NoteIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { SafeMarkdown } from '../components/SafeMarkdown';

export const SummaryScreen = ({ 
  lessonData, 
  gradingResult, 
  quizLog, // {q, userAns, correct, result, type, exp} の配列（LessonScreenから渡す）
  onFinish 
}) => {
  const [reflection, setReflection] = useState('');
  const [showToast, setShowToast] = useState(false);

  // 1. スコア計算
  const quizCorrectCount = quizLog.filter(log => log.result === true).length;
  const quizTotalCount = quizLog.length;
  const essayScore = gradingResult ? gradingResult.score : 0;
  
  // 総合スコア（100点満点換算：クイズ60点 + 記述40点）
  // ※配分は適宜調整してください
  const totalScore = Math.round(
    (quizCorrectCount / quizTotalCount) * 60 + (essayScore * 4)
  );

  // 2. NotebookLM用データ生成ロジック
  const generateNotebookLMPrompt = () => {
    const dateStr = new Date().toLocaleString('ja-JP');
    const theme = lessonData.content.theme;
    
    // クイズ結果のテキスト化
    const quizDetails = quizLog.map((log, i) => {
      return `
### Q${i+1}. ${log.q} [${log.type === 'tf' ? '正誤' : '整序'}]
- **結果**: ${log.result ? '✅ 正解' : '❌ 不正解'}
- **解説**: ${log.exp.replace(/\n/g, ' ')}
      `.trim();
    }).join('\n');

    // 生成テキスト本体
    return `
# 学習ログ: ${theme}

## 1. メタデータ
- **日付**: ${dateStr}
- **モード**: ${lessonData.learningMode} / ${lessonData.difficulty}
- **総合スコア**: ${totalScore}点 (Quiz: ${quizCorrectCount}/${quizTotalCount}, Essay: ${essayScore}/10)

## 2. 講義の要点（Strategic Essence）
${lessonData.content.strategic_essence || '（データなし）'}

## 3. 記述問題の振り返り（Essay Review）
### 問題
${lessonData.content.essay.q}

### ユーザーの回答
${gradingResult.user_answer || '（回答データなし）'}

### AIによる添削（劇的ビフォーアフター）
${gradingResult.correction}

### AIからの戦略アドバイス
${gradingResult.overall_comment}

### 弱点タグ
${gradingResult.weakness_tag || 'なし'}

## 4. 演習問題ログ（Quiz Log）
${quizDetails}

## 5. ユーザーの振り返りメモ (Self Reflection)
${reflection || '（記述なし）'}

---
## 参考：講義テキスト全文
${lessonData.content.lecture}
    `.trim();
  };

  const handleCopy = async () => {
    const text = generateNotebookLMPrompt();
    try {
      await navigator.clipboard.writeText(text);
      setShowToast(true);
    } catch (err) {
      console.error('Copy failed', err);
      alert('コピーに失敗しました');
    }
  };

  const handleOpenNotebookLM = () => {
    window.open('https://notebooklm.google.com/', '_blank');
  };

  return (
    <Container maxWidth="md" sx={{ py: 4, pb: 10 }} className="animate-fadeIn">
      
      {/* ヘッダー: スコア表示 */}
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <Typography variant="overline" color="text.secondary" fontWeight="bold">
          MISSION COMPLETE
        </Typography>
        <Typography variant="h4" fontWeight="900" sx={{ mb: 2, color: '#333' }}>
          {lessonData.content.theme}
        </Typography>
        
        <Paper 
          elevation={0} 
          sx={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 4,
            p: 3, 
            borderRadius: 4, 
            bgcolor: '#f8fafc',
            border: '1px solid #e2e8f0'
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">QUIZ</Typography>
            <Typography variant="h4" fontWeight="bold" color="primary">
              {quizCorrectCount}<span style={{fontSize: '1rem', color:'#94a3b8'}}>/{quizTotalCount}</span>
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">ESSAY</Typography>
            <Typography variant="h4" fontWeight="bold" color="secondary">
              {essayScore}<span style={{fontSize: '1rem', color:'#94a3b8'}}>/10</span>
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">TOTAL</Typography>
            <Typography variant="h4" fontWeight="900" color="#334155">
              {totalScore}<span style={{fontSize: '1rem', color:'#94a3b8'}}>pt</span>
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* AIからのアドバイス表示 */}
      <Paper elevation={3} sx={{ p: 4, borderRadius: 4, mb: 4, borderLeft: '6px solid #fbbf24' }}>
        <Stack direction="row" alignItems="center" gap={1} mb={2}>
          <TrophyIcon sx={{ color: '#d97706' }} />
          <Typography variant="h6" fontWeight="bold" color="#78350f">
            Next Action Strategy
          </Typography>
        </Stack>
        <Typography variant="body1" sx={{ lineHeight: 1.8, color: '#4b5563' }}>
          {gradingResult?.overall_comment}
        </Typography>
        {gradingResult?.weakness_tag && (
          <Box mt={2}>
             <Chip label={gradingResult.weakness_tag} color="error" size="small" variant="outlined"/>
          </Box>
        )}
      </Paper>

      {/* 自己振り返り入力エリア */}
      <Box sx={{ mb: 5 }}>
        <Stack direction="row" alignItems="center" gap={1} mb={1}>
          <NoteIcon color="primary" />
          <Typography variant="h6" fontWeight="bold" color="text.primary">
            Self Reflection
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          今回の学習で得た「気づき」や、次回の「具体的な目標」を一言残しましょう。NotebookLMに保存されます。
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder="例：荘園公領制の因果関係が曖昧だった。次は資料集の図版を確認してから挑む。"
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          sx={{ 
            bgcolor: 'white', 
            '& .MuiOutlinedInput-root': { borderRadius: 3 } 
          }}
        />
      </Box>

      {/* アクションボタン群 */}
      <Stack spacing={2}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<CopyIcon />}
          onClick={handleCopy}
          sx={{ 
            py: 1.5, borderRadius: 3, fontWeight: 'bold', fontSize: '1rem',
            background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
          }}
        >
          NotebookLM用にデータをコピー
        </Button>

        <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<ExternalLinkIcon />}
              onClick={handleOpenNotebookLM}
              sx={{ py: 1.5, borderRadius: 3, fontWeight: 'bold' }}
            >
              NotebookLMを開く
            </Button>
            
            <Button
              variant="text"
              fullWidth
              startIcon={<HomeIcon />}
              onClick={onFinish}
              sx={{ py: 1.5, borderRadius: 3, fontWeight: 'bold', color: 'text.secondary' }}
            >
              ホームに戻る
            </Button>
        </Stack>
      </Stack>

      <Snackbar
        open={showToast}
        autoHideDuration={3000}
        onClose={() => setShowToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" icon={<CheckIcon fontSize="inherit" />}>
          コピーしました！NotebookLMに貼り付けてください。
        </Alert>
      </Snackbar>
    </Container>
  );
};