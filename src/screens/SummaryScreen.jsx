import React, { useState } from 'react';
import { 
  Box, Container, Paper, Typography, Button, TextField, 
  Divider, Chip, Stack, Alert, Snackbar, Card, CardContent 
} from '@mui/material';
import { 
  ContentCopy as CopyIcon, 
  OpenInNew as ExternalLinkIcon,
  CheckCircle as CheckIcon,
  EmojiEvents as TrophyIcon,
  EditNote as NoteIcon,
  Home as HomeIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';

export const SummaryScreen = ({ 
  lessonData, 
  gradingResult, 
  quizResults, // [{is_correct, tags...}, ...] (正誤結果のみ)
  onFinish 
}) => {
  const [reflection, setReflection] = useState('');
  const [showToast, setShowToast] = useState(false);

  // 1. データの結合と整理
  // lessonDataの問題文と、quizResultsの結果をマージしてログを作成
  const quizLog = React.useMemo(() => {
    if (!lessonData || !lessonData.content) return [];
    
    const tfQuestions = lessonData.content.true_false || [];
    const sortQuestions = lessonData.content.sort || [];
    const allQuestions = [...tfQuestions, ...sortQuestions];
    
    return allQuestions.map((q, i) => {
      const res = quizResults[i] || {};
      return {
        q: q.q,
        type: i < tfQuestions.length ? '正誤判定' : '歴史整序',
        isCorrect: !!res.is_correct,
        exp: q.exp || "解説なし"
      };
    });
  }, [lessonData, quizResults]);

  // 2. スコア計算
  const quizCorrectCount = quizResults.filter(r => r.is_correct).length;
  const quizTotalCount = quizResults.length;
  const essayScore = gradingResult ? (gradingResult.score || 0) : 0;
  
  // 総合スコア（100点満点換算：クイズ60点 + 記述40点）
  const totalScore = Math.round(
    ((quizCorrectCount / (quizTotalCount || 1)) * 60) + (essayScore * 4)
  );

  // 3. NotebookLM用プロンプト生成
  const generateNotebookLMPrompt = () => {
    const dateStr = new Date().toLocaleString('ja-JP');
    const theme = lessonData.content.theme;
    
    // クイズ結果のテキスト化
    const quizDetailsText = quizLog.map((log, i) => {
      return `
Q${i+1}. ${log.q} [${log.type}]
- 結果: ${log.isCorrect ? '✅ 正解' : '❌ 不正解'}
- 解説: ${log.exp.replace(/\n/g, ' ')}
      `.trim();
    }).join('\n');

    // 記述添削のテキスト化
    const essayCorrection = gradingResult ? gradingResult.correction : "（記述回答なし）";
    const essayAdvice = gradingResult ? gradingResult.overall_comment : "（アドバイスなし）";

    return `
# 学習ログ: ${theme}

## 1. メタデータ
- 日付: ${dateStr}
- モード: ${lessonData.learningMode || 'Standard'} / ${lessonData.difficulty || 'Normal'}
- 総合スコア: ${totalScore}点 (Quiz: ${quizCorrectCount}/${quizTotalCount}, Essay: ${essayScore}/10)

## 2. 講義の要点（Strategic Essence）
${lessonData.content.strategic_essence || '（データなし）'}

## 3. 記述問題の振り返り（Essay Review）
### 問題
${lessonData.content.essay ? lessonData.content.essay.q : '（問題なし）'}

### AIによる添削（劇的ビフォーアフター）
${essayCorrection}

### AIからの戦略アドバイス
${essayAdvice}

## 4. 演習問題ログ（Quiz Log）
${quizDetailsText}

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
      // フォールバック（alert）
      alert('コピーに失敗しました。');
    }
  };

  const handleOpenNotebookLM = () => {
    window.open('https://notebooklm.google.com/', '_blank');
  };

  return (
    <Container maxWidth="md" sx={{ py: 4, pb: 12 }} className="animate-fade-in">
      
      {/* ヘッダー: スコア表示 */}
      <Box sx={{ textAlign: 'center', mb: 5, mt: 2 }}>
        <Typography variant="overline" color="text.secondary" fontWeight="bold" letterSpacing={2}>
          MISSION COMPLETE
        </Typography>
        <Typography variant="h4" fontWeight="900" sx={{ mb: 4, color: '#1e293b' }}>
          {lessonData.content.theme}
        </Typography>
        
        <Paper 
          elevation={0} 
          sx={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: { xs: 2, sm: 4 },
            p: 3, 
            borderRadius: 4, 
            bgcolor: '#f8fafc',
            border: '1px solid #e2e8f0',
            width: '100%',
            maxWidth: 500
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">QUIZ</Typography>
            <Typography variant="h4" fontWeight="bold" color="primary.main">
              {quizCorrectCount}<span style={{fontSize: '1rem', color:'#94a3b8'}}>/{quizTotalCount}</span>
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">ESSAY</Typography>
            <Typography variant="h4" fontWeight="bold" color="secondary.main">
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
      <Card elevation={0} sx={{ borderRadius: 4, mb: 4, border: '1px solid', borderColor: 'warning.main', bgcolor: '#fffbeb' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={2}>
            <TrophyIcon sx={{ color: '#d97706' }} />
            <Typography variant="h6" fontWeight="bold" color="#92400e">
              Next Action Strategy
            </Typography>
          </Stack>
          
          <Typography variant="body1" sx={{ lineHeight: 1.8, color: '#78350f', fontWeight: 'medium' }}>
            {gradingResult?.overall_comment || "素晴らしい取り組みです。解説をよく読んで復習しましょう。"}
          </Typography>

          {gradingResult?.nextAction && (
             <Box mt={2} display="flex" alignItems="center" gap={1} bgcolor="white" p={1.5} borderRadius={2} border="1px dashed #f59e0b">
                <ArrowIcon color="warning" fontSize="small"/>
                <Typography variant="body2" fontWeight="bold" color="#b45309">
                  {gradingResult.nextAction}
                </Typography>
             </Box>
          )}
        </CardContent>
      </Card>

      {/* 自己振り返り入力エリア */}
      <Box sx={{ mb: 5 }}>
        <Stack direction="row" alignItems="center" gap={1} mb={1}>
          <NoteIcon color="primary" />
          <Typography variant="h6" fontWeight="bold" color="text.primary">
            Self Reflection
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          今回の学習で得た「気づき」や、次回の「具体的な目標」を一言残しましょう。<br/>
          この内容はNotebookLMに保存され、AIの指導精度向上に使われます。
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
      <Stack spacing={2} sx={{ maxWidth: 500, mx: 'auto' }}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<CopyIcon />}
          onClick={handleCopy}
          sx={{ 
            py: 1.5, borderRadius: 3, fontWeight: 'bold', fontSize: '1rem',
            background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
            transition: 'transform 0.2s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(99, 102, 241, 0.5)' }
          }}
        >
          NotebookLM用に全データをコピー
        </Button>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<ExternalLinkIcon />}
              onClick={handleOpenNotebookLM}
              sx={{ py: 1.5, borderRadius: 3, fontWeight: 'bold', border: '2px solid' }}
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
        sx={{ bottom: { xs: 20, sm: 30 } }}
      >
        <Alert severity="success" variant="filled" icon={<CheckIcon fontSize="inherit" />} sx={{ width: '100%', borderRadius: 2, fontWeight: 'bold' }}>
          コピーしました！NotebookLMに貼り付けてください。
        </Alert>
      </Snackbar>
    </Container>
  );
};