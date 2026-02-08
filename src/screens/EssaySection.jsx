import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Card, CardContent, Typography, TextField, Button, 
  CircularProgress, Alert, Divider, Paper, Chip, Stack,
  Fade, LinearProgress
} from '@mui/material';
import { 
  Send as SendIcon, 
  AutoFixHigh as AutoFixIcon,
  EmojiEvents as TrophyIcon,
  Flag as FlagIcon,
  Lightbulb as LightbulbIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { SafeMarkdown } from './SafeMarkdown'; // パス調整
import { useLessonGrader } from '../hooks/useLessonGrader';
import { scrollToTop } from '../lib/utils';

/**
 * 記述問題セクション
 * ユーザーが回答を入力し、AIによる即時採点とフィードバックを受ける
 */
export const EssaySection = ({ 
  apiKey, 
  userId, 
  lessonData, 
  learningMode, 
  initialDraft, 
  onDraftChange, 
  onFinish 
}) => {
  const [userAnswer, setUserAnswer] = useState(initialDraft || '');
  const [result, setResult] = useState(null);
  
  // カスタムフック (userIdを追加)
  const { gradeLesson, isGrading, gradeError } = useLessonGrader(apiKey, userId);
  
  const essayData = lessonData?.content?.essay || {}; // データ構造の深さに対応
  const wordLimit = learningMode === 'school' ? 80 : 150;
  
  // 文字数に応じたプログレスバー計算
  const progress = Math.min((userAnswer.length / wordLimit) * 100, 100);
  const isOverLimit = userAnswer.length > wordLimit + 20;

  // 自動スクロール: 結果表示時
  useEffect(() => {
    if (result) {
      scrollToTop();
    }
  }, [result]);

  // Debounce保存ロジック (useRefでタイマー管理)
  const saveTimerRef = useRef(null);

  const handleTextChange = (e) => {
    const text = e.target.value;
    setUserAnswer(text);

    // 既存のタイマーをクリア
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // 1秒後に保存を実行
    saveTimerRef.current = setTimeout(() => {
      if (onDraftChange) {
        onDraftChange(text);
      }
    }, 1000);
  };

  // 提出処理 (AI採点)
  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;
    
    // 採点実行
    // gradeLessonの実装依存だが、通常は (lessonData, userAnswer, mode) を渡す
    const gradingResult = await gradeLesson(lessonData, userAnswer, learningMode);
    
    if (gradingResult) {
      // ランク(S/A/B/C)からスコア(10点満点)への変換 (もしスコアがなければ)
      let score = gradingResult.score;
      if (score === undefined && gradingResult.rank) {
         if (gradingResult.rank === 'S') score = 10;
         else if (gradingResult.rank === 'A') score = 8;
         else if (gradingResult.rank === 'B') score = 6;
         else score = 4;
      }
      
      const finalResult = { ...gradingResult, score: score || 0 };
      setResult(finalResult);
      
      // 結果確定時にも保存
      if (onDraftChange) onDraftChange(userAnswer);
    }
  };

  // ギブアップ処理
  const handleGiveUp = () => {
    const mockResult = {
      score: 0,
      rank: 'C',
      correction: `
### 🏳️ ギブアップ (Model Answer)
今回は回答をスキップしました。まずは模範解答を読んで、構成をインプットしましょう！

**模範解答**:
> ${essayData.model || "解答例がありません"}

**ポイント**:
- 記述問題は「型（AだからB）」を覚えることが近道です。
- 模範解答を書き写し、因果の流れを確認しましょう。
      `, 
      overall_comment: "記述問題は「型」を覚えることが近道です。模範解答の因果関係（A→B）を意識して書き写してみましょう。",
      tags: ["err_basic_fact"], 
      recommended_action: "模範解答を書き写し、因果の流れを確認しましょう。"
    };
    setResult(mockResult);
  };

  // 完了ボタン (結果確認後)
  const handleFinishConfirm = () => {
    if (onFinish) {
      onFinish({ 
        score: result ? result.score : 0,
        rank: result ? result.rank : 'C', // ランクも渡す
        recommended_action: result ? result.recommended_action : null,
        // 採点結果全体も渡しておく (SummaryScreenなどで使うかも)
        gradingResult: result 
      });
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, md: 0 } }}>
      <Fade in={true} timeout={800}>
        <Card 
          elevation={0} 
          sx={{ 
            borderRadius: 4, 
            border: '1px solid', 
            borderColor: 'divider',
            overflow: 'visible' 
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            
            {/* ヘッダー */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Box 
                sx={{ 
                  width: 48, height: 48, 
                  borderRadius: '50%', 
                  bgcolor: 'secondary.50', 
                  color: 'secondary.main',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mr: 2
                }}
              >
                <EditIcon />
              </Box>
              <Box>
                <Typography variant="overline" color="secondary.main" fontWeight="bold" letterSpacing={1.2}>
                  Final Challenge
                </Typography>
                <Typography variant="h5" fontWeight="900" color="text.primary">
                  Essay Question
                </Typography>
              </Box>
            </Box>

            {/* 問題文 */}
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, lineHeight: 1.6 }}>
              Q. {essayData.q}
            </Typography>

            {essayData.hint && (
              <Alert 
                icon={<LightbulbIcon fontSize="inherit" />} 
                severity="info" 
                sx={{ mb: 4, borderRadius: 3, bgcolor: 'info.50', color: 'info.900' }}
              >
                <Typography variant="body2" fontWeight="medium">
                  Hint: {essayData.hint}
                </Typography>
              </Alert>
            )}

            {!result ? (
              /* --- 入力モード --- */
              <Box>
                <Box sx={{ position: 'relative', mb: 1 }}>
                  <TextField
                    multiline
                    minRows={6}
                    maxRows={12}
                    fullWidth
                    placeholder={`ここに入力してください... (目安: ${wordLimit}文字前後)\n\n例: 「〜という背景があり、〜の結果となった。」`}
                    value={userAnswer}
                    onChange={handleTextChange}
                    disabled={isGrading}
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        borderRadius: 3,
                        bgcolor: 'background.paper',
                        fontSize: '1.1rem',
                        lineHeight: 1.8
                      }
                    }}
                  />
                </Box>

                {/* 文字数カウンター & プログレス */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                  <Box sx={{ width: '60%', mr: 2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={progress} 
                      color={isOverLimit ? "error" : progress > 80 ? "success" : "primary"}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                  <Typography 
                    variant="caption" 
                    fontWeight="bold" 
                    color={isOverLimit ? 'error.main' : 'text.secondary'}
                  >
                    {userAnswer.length} / {wordLimit} 文字
                  </Typography>
                </Box>

                {/* アクションボタン */}
                <Stack spacing={2}>
                  <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      onClick={handleSubmit}
                      disabled={isGrading || !userAnswer.trim()}
                      startIcon={isGrading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
                      sx={{ 
                        py: 2, 
                        borderRadius: 3, 
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        // isGrading時はdisabledカラー、通常時はグラデーション
                        background: (theme) => isGrading ? undefined : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                        boxShadow: isGrading ? 'none' : '0 8px 16px -4px rgba(79, 70, 229, 0.3)',
                        transition: 'transform 0.2s',
                        '&:hover': { transform: isGrading ? 'none' : 'translateY(-2px)', boxShadow: isGrading ? 'none' : '0 12px 20px -6px rgba(79, 70, 229, 0.4)' }
                      }}
                  >
                      {isGrading ? 'AI先生が採点中...' : '回答を提出する'}
                  </Button>

                  {!isGrading && (
                    <Button
                        variant="text"
                        color="inherit"
                        onClick={handleGiveUp}
                        startIcon={<FlagIcon />}
                        sx={{ color: 'text.secondary', fontWeight: 'bold', borderRadius: 2 }}
                    >
                        降参して模範解答を見る
                    </Button>
                  )}
                </Stack>
                
                {gradeError && (
                  <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>
                    {gradeError}
                  </Alert>
                )}
              </Box>
            ) : (
              /* --- 結果表示モード --- */
              <Box className="animate-fadeIn">
                
                {/* スコア表示 (Circular Progress) */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, position: 'relative', height: 120 }}>
                    <CircularProgress 
                      variant="determinate" 
                      value={100} 
                      size={120} 
                      thickness={4} 
                      sx={{ color: 'grey.100', position: 'absolute' }} 
                    />
                    <CircularProgress 
                      variant="determinate" 
                      value={Math.min(result.score * 10, 100)} // 10点満点 -> 100%
                      size={120} 
                      thickness={4} 
                      sx={{ 
                        color: result.score >= 8 ? 'success.main' : result.score >= 5 ? 'warning.main' : 'error.main',
                        position: 'absolute',
                        left: '50%',
                        marginLeft: '-60px', // size/2
                        strokeLinecap: 'round'
                      }} 
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0, left: 0, bottom: 0, right: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column'
                      }}
                    >
                      <TrophyIcon 
                        color={result.score >= 8 ? "success" : "action"} 
                        fontSize="large" 
                        sx={{ mb: 0.5 }}
                      />
                      <Typography variant="h4" component="div" fontWeight="900" color="text.primary">
                        {result.score}<span style={{fontSize: '1rem', color:'#9ca3af'}}>/10</span>
                      </Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 4 }}>
                  <Chip 
                    icon={<AutoFixIcon />} 
                    label="AI Correction & Feedback" 
                    color="primary" 
                    variant="outlined" 
                    sx={{ fontWeight: 'bold', border: 'none', bgcolor: 'primary.50' }}
                  />
                </Divider>

                {/* 添削内容 (Markdown) */}
                <Box sx={{ mb: 4 }}>
                  <SafeMarkdown content={result.correction} />
                </Box>

                {/* 総評コメント */}
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 3, 
                    bgcolor: result.score >= 8 ? 'success.50' : 'grey.50', 
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: result.score >= 8 ? 'success.200' : 'grey.200'
                  }}
                >
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>
                    📝 AI講師からの総評
                  </Typography>
                  <Typography variant="body1" fontWeight="500" color="text.primary">
                    {result.overall_comment}
                  </Typography>
                </Paper>

                {/* 完了ボタン */}
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleFinishConfirm}
                  sx={{ 
                    mt: 4, py: 2, borderRadius: 3, fontWeight: 'bold',
                    boxShadow: 3
                  }}
                >
                  学習結果を保存して終了
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Fade>
    </Box>
  );
};