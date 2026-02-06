import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, Card, CardContent, Typography, TextField, Button, 
  CircularProgress, Alert, Divider, Paper, AlertTitle, Chip 
} from '@mui/material';
import { 
  Send as SendIcon, 
  AutoFixHigh as AutoFixIcon,
  EmojiEvents as TrophyIcon,
  Flag as FlagIcon
} from '@mui/icons-material';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { useLessonGrader } from '../hooks/useLessonGrader';

/**
 * 簡易Debounceフック (lodash依存なしで実装)
 * 指定した時間(ms)だけ処理を遅延させる
 */
const useDebouncedCallback = (callback, delay) => {
  const timer = useRef(null);

  const debouncedFunction = useCallback((...args) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);

  return debouncedFunction;
};

export const EssaySection = ({ 
  apiKey, 
  lessonData, 
  learningMode, 
  initialDraft, // ★ 復元された下書きデータ
  onDraftChange, // ★ 下書き変更通知用
  onFinish 
}) => {
  // 初期値を復元データから設定
  const [userAnswer, setUserAnswer] = useState(initialDraft || '');
  const [result, setResult] = useState(null);
  
  const { gradeLesson, isGrading, gradeError } = useLessonGrader(apiKey);
  const essayData = lessonData.content.essay;
  const wordLimit = learningMode === 'school' ? 80 : 150;

  // ★ 自動スクロール: 結果画面（Before/After）が表示されたらトップへ
  useEffect(() => {
    if (result) {
      window.scrollTo(0, 0);
    }
  }, [result]);

  // ★ 自動保存: 入力が止まってから1秒後に親へ通知 (Debounce)
  const debouncedSave = useDebouncedCallback((text) => {
    if (onDraftChange) {
      onDraftChange(text);
    }
  }, 1000);

  // テキスト変更時の処理
  const handleChange = (e) => {
    const text = e.target.value;
    setUserAnswer(text);
    debouncedSave(text); // 非同期で保存
  };

  // 通常の提出処理（AI採点）
  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;
    
    const gradingResult = await gradeLesson(lessonData, userAnswer, learningMode);
    if (gradingResult) {
      setResult(gradingResult);
    }
  };

  // ギブアップ処理（ローカルデータで即時表示）
  const handleGiveUp = () => {
    const mockResult = {
      score: 0,
      correction: `
### 🏳️ ギブアップ
今回は回答をスキップしました。まずは模範解答を読んで、構成をインプットしましょう！

---

${essayData.model}
      `, 
      overall_comment: "記述問題は「型」を覚えることが近道です。模範解答の因果関係（A→B）を意識して書き写してみましょう。",
      weakness_tag: "#模範解答の分析",
      recommended_action: "模範解答を書き写し、因果の流れを確認しましょう。" // ギブアップ時の推奨アクション
    };
    setResult(mockResult);
  };

  // 完了時に親コンポーネントへデータを渡す
  const handleFinish = () => {
    if (result) {
      onFinish({ 
        score: result.score,
        recommended_action: result.recommended_action 
      });
    } else {
      // 万が一resultがない場合（安全策）
      onFinish({ score: 0, recommended_action: null });
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', p: 2 }}>
      {/* 問題表示エリア */}
      <Card elevation={3} sx={{ borderRadius: 4, mb: 3, border: '1px solid #e0e0e0' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 'bold' }}>
            Last Challenge: Essay
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1, mb: 3 }}>
            Q. {essayData.q}
          </Typography>

          {essayData.hint && (
             <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
               ヒント: {essayData.hint}
             </Alert>
          )}

          {!result ? (
            // --- 回答入力モード ---
            <Box>
              <TextField
                multiline
                rows={6}
                fullWidth
                variant="outlined"
                placeholder={`ここに入力してください... (目安: ${wordLimit}文字前後)`}
                value={userAnswer}
                onChange={handleChange} // ★ 修正: Debounce付きハンドラ
                disabled={isGrading}
                sx={{ 
                  bgcolor: '#f9fafb', 
                  borderRadius: 2,
                  '& .MuiOutlinedInput-root': { borderRadius: 2 }
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Typography variant="caption" color={userAnswer.length > wordLimit + 20 ? 'error' : 'text.secondary'}>
                  {userAnswer.length}文字
                </Typography>
              </Box>

              {/* ボタンエリア */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
                {/* 提出ボタン */}
                <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={handleSubmit}
                    disabled={isGrading || !userAnswer.trim()}
                    startIcon={isGrading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                    sx={{ 
                    py: 1.5, borderRadius: 3, fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                    boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)'
                    }}
                >
                    {isGrading ? 'AI採点官が添削中...' : '回答を提出して添削を受ける'}
                </Button>

                {/* ギブアップボタン */}
                {!isGrading && (
                    <Button
                        variant="text"
                        color="inherit"
                        size="medium"
                        onClick={handleGiveUp}
                        startIcon={<FlagIcon />}
                        sx={{ color: 'text.secondary', fontWeight: 'bold' }}
                    >
                        分からないので答えを見る（ギブアップ）
                    </Button>
                )}
              </Box>
              
              {gradeError && (
                <Alert severity="error" sx={{ mt: 2 }}>{gradeError}</Alert>
              )}
            </Box>
          ) : (
            // --- 結果表示モード (Before/After) ---
            <Box className="animate-fadeIn">
              
              {/* スコア表示 */}
              <Box sx={{ textAlign: 'center', mb: 4, position: 'relative' }}>
                <TrophyIcon sx={{ fontSize: 60, color: result.score > 0 ? '#ffb300' : '#bdbdbd', mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: '900', color: '#333' }}>
                  {result.score}<span style={{fontSize: '1.5rem', fontWeight: 'normal'}}>/10</span>
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                   {result.score === 0 ? 'Review Mode' : 'AI Score'}
                </Typography>
              </Box>

              <Divider sx={{ my: 3 }} >
                <Chip icon={<AutoFixIcon />} label={result.score === 0 ? "Model Answer" : "AI Correction"} color="secondary" variant="outlined" />
              </Divider>

              {/* 解説・添削内容 */}
              <Paper elevation={0} sx={{ bgcolor: '#fff', p: 0 }}>
                <SafeMarkdown content={result.correction} />
              </Paper>

              {/* 総評 */}
              <Alert severity={result.score >= 8 ? "success" : "info"} sx={{ mt: 4, borderRadius: 2 }}>
                <AlertTitle sx={{fontWeight:'bold'}}>総評・アドバイス</AlertTitle>
                {result.overall_comment}
              </Alert>

              {/* 完了ボタン（ここを押すとLessonScreenの結果画面へ遷移） */}
              <Button
                variant="outlined"
                fullWidth
                size="large"
                onClick={handleFinish}
                sx={{ mt: 4, py: 1.5, borderRadius: 3, fontWeight: 'bold' }}
              >
                学習を終了する
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};