import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, Typography, Card, CardContent, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Snackbar, Alert, LinearProgress, Fab, Zoom, Chip, Divider, Paper
} from '@mui/material';
import { 
  EmojiEvents as TrophyIcon, 
  Warning as WarningIcon, 
  ContentCopy as ContentCopyIcon,
  Home as HomeIcon,
  School as LectureIcon,
  Quiz as QuizIcon,
  Edit as EssayIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowRightIcon
} from '@mui/icons-material';

import { useLessonGenerator } from '../hooks/useLessonGenerator';
import { useLessonGuard } from '../hooks/useLessonGuard';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { QuizSection } from './QuizSection';
import { EssaySection } from './EssaySection';
import { saveLessonStats } from '../lib/stats'; 
import { scrollToTop } from '../lib/utils';
import SmartLoader from '../components/SmartLoader'; // ローダーも統合

export const LessonScreen = ({ apiKey, userId, learningMode, difficulty, selectedUnit, onExit }) => {
  // ステップ管理: 'loading' | 'lecture' | 'quiz' | 'essay' | 'result'
  const [currentStep, setCurrentStep] = useState('loading');
  const [lessonData, setLessonData] = useState(null);
  
  // 成績データ
  const [scores, setScores] = useState({
    quizCorrect: 0, quizTotal: 0,
    essayScore: 0, essayTotal: 10,
    nextAction: null
  });

  // 詳細結果保持用
  const [quizResults, setQuizResults] = useState([]); 
  const [essayGradingResult, setEssayGradingResult] = useState(null);

  // 復元用データ
  const [resumeData, setResumeData] = useState(null);

  // UI状態
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showCopySnack, setShowCopySnack] = useState(false);

  const { generateDailyLesson, fetchTodayLesson, saveProgress, isProcessing, genError } = useLessonGenerator(apiKey, userId);

  // ガード設定 (ローディングと結果画面以外で有効)
  const isGuardActive = currentStep !== 'loading' && currentStep !== 'result';
  useLessonGuard(isGuardActive, () => setShowExitDialog(true));

  // ステップ変更時にトップへスクロール
  useEffect(() => {
    scrollToTop();
  }, [currentStep]);

  // 初期化 & 復元ロジック
  useEffect(() => {
    const initLesson = async () => {
      try {
        const sessionNum = 1; // 現状は1セッション固定
        const savedData = await fetchTodayLesson(sessionNum);
        
        if (savedData && !savedData.completed) {
          console.log("Resuming lesson...");
          setLessonData(savedData);
          if (savedData.scores) setScores(savedData.scores);
          if (savedData.progress) setResumeData(savedData.progress);
          if (savedData.quizResults) setQuizResults(savedData.quizResults);
          
          setCurrentStep(savedData.currentStep || 'lecture');
        } else {
          console.log("Generating new lesson...");
          const data = await generateDailyLesson(learningMode, difficulty, selectedUnit, sessionNum);
          if (data) {
            setLessonData(data);
            setCurrentStep('lecture');
            saveProgress(sessionNum, { currentStep: 'lecture', content: data.content });
          }
        }
      } catch (e) {
        console.error("Lesson init failed", e);
      }
    };
    initLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 進捗保存ヘルパー
  const handleProgressSave = useCallback((step, progressData = {}, newScores = null) => {
    const sessionNum = 1;
    const dataToSave = {
      currentStep: step,
      progress: progressData, 
      timestamp: new Date().toISOString()
    };
    if (newScores) dataToSave.scores = newScores;
    saveProgress(sessionNum, dataToSave);
  }, [saveProgress]);

  // --- ステップ遷移ハンドラー ---

  // クイズ回答中の進捗保存
  const handleQuizProgress = (currentIndex, currentCorrect) => {
    handleProgressSave('quiz', { quizIndex: currentIndex, quizCorrect: currentCorrect });
  };

  // クイズ完了
  const handleQuizComplete = (result) => {
    // result = { correct, total, results: [...] }
    const newScores = { ...scores, quizCorrect: result.correct, quizTotal: result.total };
    setScores(newScores);
    setQuizResults(result.results || []);

    // 次のステップへ
    setCurrentStep('essay');
    handleProgressSave('essay', { quizResults: result.results }, newScores);
  };

  // 記述の下書き保存
  const handleEssayDraft = (draftText) => {
    handleProgressSave('essay', { essayDraft: draftText });
  };

  // 記述完了 & 最終結果保存
  const handleEssayComplete = async (result) => {
    const newScores = { ...scores, essayScore: result.score, nextAction: result.recommended_action };
    setScores(newScores);
    setEssayGradingResult(result);
    
    // 1. 完了状態をFirestoreに保存
    await saveProgress(1, { 
      currentStep: 'result', 
      scores: newScores, 
      completed: true,
      gradingResult: result,
      quizResults: quizResults // 最終結果にも含める
    });

    // 2. 統計データの更新 (Stats)
    if (lessonData && result) {
       const combinedStatsData = {
         quiz_results: quizResults,
         essay_grading: {
           score: result.score,
           tags: result.tags
         }
       };
       await saveLessonStats(userId, lessonData, combinedStatsData);
    }

    setCurrentStep('result');
  };

  // 振り返りメモ保存
  const handleReflectionSave = (text) => {
    saveProgress(1, { reflection: text });
  };

  // クリップボードコピー
  const handleCopyToClipboard = () => {
    if (!lessonData?.content) return;
    const c = lessonData.content;
    const r = essayGradingResult || {};
    
    const textToCopy = `
# 日本史学習レポート: ${c.theme}
- **日時**: ${new Date().toLocaleString()}
- **モード**: ${learningMode === 'school' ? '定期テスト' : '入試対策'} (${difficulty})

## 1. 成績概要
- **QUIZ**: ${scores.quizCorrect}/${scores.quizTotal}
- **ESSAY**: ${scores.essayScore}/${scores.essayTotal}

## 2. AI講師の分析
- **総合評価**: ${r.overall_comment || 'なし'}
- **弱点タグ**: ${r.tags ? r.tags.join(', ') : 'なし'}
- **次なる一手**: ${scores.nextAction || 'なし'}

## 3. 記述回答の振り返り
${r.correction || '(添削データなし)'}

## 4. 学習資料（講義内容）
${c.lecture}

---
Generated by History AI App
    `.trim();

    navigator.clipboard.writeText(textToCopy).then(() => {
      setShowCopySnack(true);
    });
  };

  const handleExitConfirm = () => {
    setShowExitDialog(false);
    if (onExit) onExit(); 
  };

  const calculateTotalScore = () => {
    const { quizCorrect, quizTotal, essayScore, essayTotal } = scores;
    const totalPossible = quizTotal + essayTotal; 
    if (totalPossible === 0) return 0;
    return Math.round(((quizCorrect + essayScore) / totalPossible) * 100);
  };

  // --- レンダリング ---

  if (currentStep === 'loading' || isProcessing) {
    return <SmartLoader message="AI講師があなただけの授業を準備しています..." />;
  }

  if (genError) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>
          {genError}
          <Button color="inherit" size="small" onClick={onExit} sx={{ ml: 2, fontWeight: 'bold' }}>
            戻る
          </Button>
        </Alert>
      </Box>
    );
  }

  if (!lessonData) return null;

  // ----------------------------------------------------------------
  // 結果画面 (Result View)
  // ----------------------------------------------------------------
  if (currentStep === 'result') {
    const totalScore = calculateTotalScore();
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 12 }} className="animate-fade-in">
        {/* ヘッダー */}
        <Box sx={{ textAlign: 'center', pt: 6, pb: 4, px: 2, bgcolor: 'white', borderBottom: '1px solid #e2e8f0' }}>
           <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold', letterSpacing: 2 }}>
             MISSION COMPLETE
           </Typography>
           <Typography variant="h5" sx={{ fontWeight: '900', color: 'text.primary', mt: 1 }}>
             {lessonData.content.theme}
           </Typography>
        </Box>

        <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
          {/* スコアカード */}
          <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', mb: 4, overflow: 'visible' }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', textAlign: 'center' }}>
                <Box>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary">QUIZ</Typography>
                  <Typography variant="h4" fontWeight="bold" color="text.primary">
                    {scores.quizCorrect}<span style={{ fontSize: '1rem', color: '#9ca3af' }}>/{scores.quizTotal}</span>
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ height: 40, alignSelf: 'center' }} />
                <Box>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary">ESSAY</Typography>
                  <Typography variant="h4" fontWeight="bold" color="text.primary">
                    {scores.essayScore}<span style={{ fontSize: '1rem', color: '#9ca3af' }}>/{scores.essayTotal}</span>
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ height: 40, alignSelf: 'center' }} />
                <Box>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary">TOTAL</Typography>
                  <Typography variant="h3" fontWeight="900" color="primary.main">
                    {isNaN(totalScore) ? 0 : totalScore}<span style={{ fontSize: '1rem' }}>%</span>
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Next Action Card */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, mb: 4, borderRadius: 4, 
              bgcolor: '#fffbf0', border: '2px solid #fde68a', 
              position: 'relative' 
            }}
          >
             <Box 
               sx={{ 
                 position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', 
                 bgcolor: '#b45309', color: 'white', px: 2, py: 0.5, 
                 borderRadius: 20, fontSize: '0.75rem', fontWeight: 'bold', 
                 display: 'flex', alignItems: 'center', gap: 0.5 
               }}
             >
               <TrophyIcon fontSize="small" /> Next Strategy
             </Box>
             <Typography variant="body1" align="center" fontWeight="bold" color="#92400e" sx={{ mt: 1 }}>
               {scores.nextAction || "今回の弱点を踏まえ、資料集の図版を確認しましょう。"}
             </Typography>
          </Paper>
          
          {/* ノート機能 */}
          <Box sx={{ mb: 6 }}>
            <Button 
              fullWidth
              variant="outlined" 
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyToClipboard}
              sx={{ 
                borderRadius: 3, py: 1.5, mb: 3,
                borderStyle: 'dashed', borderWidth: 2, fontWeight: 'bold', 
                bgcolor: 'white',
                '&:hover': { borderStyle: 'dashed', borderWidth: 2, bgcolor: 'primary.50' }
              }}
            >
              学習ログをコピーする
            </Button>
            
            <TextField
              label="Self Reflection (振り返りメモ)"
              multiline
              rows={3}
              fullWidth
              placeholder="例：荘園公領制の因果関係が曖昧だった..."
              variant="outlined"
              onBlur={(e) => handleReflectionSave(e.target.value)}
              sx={{ bgcolor: 'white', borderRadius: 3 }}
            />
          </Box>
        </Box>

        {/* 固定フッター (ホームへ戻る) */}
        <Paper 
          elevation={4}
          sx={{ 
            position: 'fixed', bottom: 0, left: 0, right: 0, 
            p: 2, bgcolor: 'rgba(255,255,255,0.9)', 
            backdropFilter: 'blur(8px)', borderTop: '1px solid divider',
            display: 'flex', justifyContent: 'center', zIndex: 10
          }}
        >
          <Button 
            variant="contained" size="large"
            startIcon={<HomeIcon />}
            onClick={onExit} 
            sx={{ 
              borderRadius: 4, px: 6, py: 1.5, fontWeight: 'bold', 
              maxWidth: 400, width: '100%',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
            }}
          >
            ホームに戻る
          </Button>
        </Paper>

        <Snackbar
          open={showCopySnack}
          autoHideDuration={2000}
          onClose={() => setShowCopySnack(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ bottom: { xs: 90, sm: 100 } }} 
        >
          <Alert severity="success" variant="filled" sx={{ width: '100%', fontWeight: 'bold', borderRadius: 2 }}>
            クリップボードにコピーしました！
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  // ----------------------------------------------------------------
  // 学習画面 (Lesson View)
  // ----------------------------------------------------------------
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 10 }}>
      {/* ステップバー (Sticky) */}
      <Paper 
        elevation={1} 
        sx={{ 
          position: 'sticky', top: 0, zIndex: 10, 
          px: 2, py: 1.5, borderRadius: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <Typography variant="subtitle2" noWrap sx={{ maxWidth: '60%', fontWeight: 'bold', color: 'text.primary' }}>
          {lessonData.content.theme}
        </Typography>
        <Chip 
          size="small"
          color="primary" 
          label={
            currentStep === 'lecture' ? 'STEP 1: 講義' :
            currentStep === 'quiz' ? 'STEP 2: 演習' :
            currentStep === 'essay' ? 'STEP 3: 記述' : 'Review'
          }
          icon={
            currentStep === 'lecture' ? <LectureIcon /> :
            currentStep === 'quiz' ? <QuizIcon /> :
            currentStep === 'essay' ? <EssayIcon /> : <CheckIcon />
          }
          sx={{ fontWeight: 'bold' }}
        />
      </Paper>

      <Box sx={{ maxWidth: '800px', mx: 'auto', p: { xs: 2, md: 4 } }}>
        {currentStep === 'lecture' && (
          <Box className="animate-fade-in">
            <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', p: { xs: 2, md: 4 }, mb: 4 }}>
              <Box sx={{ mb: 4, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="overline" color="text.secondary" fontWeight="bold">
                  Target Theme
                </Typography>
                <Typography variant="h5" fontWeight="900" gutterBottom>
                  {lessonData.content.theme}
                </Typography>
                
                <Alert severity="info" icon={false} sx={{ mt: 2, borderRadius: 2, bgcolor: 'warning.50', color: 'warning.900', border: '1px solid', borderColor: 'warning.200' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="warning.800" gutterBottom>
                    {learningMode === 'school' ? '📌 定期テスト対策ポイント' : '⚡ 入試の急所'}
                  </Typography>
                  <Typography variant="body2">
                    {learningMode === 'school' ? '太字の用語を中心に、因果関係（なぜ→どうなった）を意識して読みましょう。' : '出来事の単なる暗記ではなく、背景にある「構造」や「比較」に注目してください。'}
                  </Typography>
                </Alert>
              </Box>
              
              <SafeMarkdown content={lessonData.content.lecture} />
            </Card>
            
            <Button
              variant="contained"
              fullWidth
              size="large"
              endIcon={<ArrowRightIcon />}
              onClick={() => setCurrentStep('quiz')}
              sx={{ 
                py: 2, borderRadius: 3, fontWeight: 'bold', fontSize: '1.1rem',
                boxShadow: '0 8px 16px -4px rgba(79, 70, 229, 0.4)',
                background: 'linear-gradient(to right, #4f46e5, #6366f1)'
              }}
            >
              演習問題にチャレンジ
            </Button>
          </Box>
        )}

        {currentStep === 'quiz' && (
          <QuizSection 
            lessonData={lessonData} 
            initialData={resumeData} 
            onProgress={handleQuizProgress} 
            onComplete={handleQuizComplete} 
          />
        )}

        {currentStep === 'essay' && (
          <EssaySection 
            apiKey={apiKey}
            userId={userId} // userIdを渡す
            lessonData={lessonData} 
            learningMode={learningMode}
            initialDraft={resumeData?.essayDraft} 
            onDraftChange={handleEssayDraft}
            onFinish={handleEssayComplete} 
          />
        )}
      </Box>

      {/* 中断確認ダイアログ */}
      <Dialog
        open={showExitDialog}
        onClose={() => setShowExitDialog(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <Box sx={{ textAlign: 'center', pt: 2 }}>
          <WarningIcon color="warning" sx={{ fontSize: 48 }} />
        </Box>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold' }}>
          学習を中断しますか？
        </DialogTitle>
        <DialogContent>
          <DialogContentText align="center">
            現在の進捗は一時保存されていますが、<br/>
            ホーム画面に戻ると最初からになる場合があります。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2, gap: 1 }}>
          <Button onClick={() => setShowExitDialog(false)} variant="outlined" sx={{ borderRadius: 3, px: 3, fontWeight: 'bold' }}>
            続ける
          </Button>
          <Button onClick={handleExitConfirm} variant="contained" color="error" autoFocus sx={{ borderRadius: 3, px: 3, fontWeight: 'bold' }}>
            中断する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};