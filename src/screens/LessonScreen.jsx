import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, Typography, Card, CardContent, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import { EmojiEvents, Warning as WarningIcon } from '@mui/icons-material';

import { useLessonGenerator } from '../hooks/useLessonGenerator';
import { useLessonGuard } from '../hooks/useLessonGuard';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { QuizSection } from './QuizSection';
import { EssaySection } from './EssaySection';

export const LessonScreen = ({ apiKey, userId, learningMode, difficulty, selectedUnit, onExit }) => {
  // ステップ管理
  const [currentStep, setCurrentStep] = useState('loading');
  const [lessonData, setLessonData] = useState(null);
  
  // 成績・アクションデータ管理
  const [scores, setScores] = useState({
    quizCorrect: 0,
    quizTotal: 0,
    essayScore: 0,
    essayTotal: 10,
    nextAction: null
  });

  // 復元用のデータ
  const [resumeData, setResumeData] = useState(null);

  // 中断ダイアログの管理
  const [showExitDialog, setShowExitDialog] = useState(false);

  const { generateDailyLesson, fetchTodayLesson, saveProgress, isProcessing, genError } = useLessonGenerator(apiKey, userId);

  // ガードの有効化条件: ロード中・完了画面以外は常にON
  const isGuardActive = currentStep !== 'loading' && currentStep !== 'result';

  // ガードフック呼び出し
  useLessonGuard(isGuardActive, () => {
    setShowExitDialog(true);
  });

  // 退出処理（ホームへ戻る）
  const handleExitConfirm = () => {
    setShowExitDialog(false);
    if (onExit) onExit(); 
  };

  // ステップが切り替わったら画面トップへ強制スクロール
  useEffect(() => {
    window.scrollTo(0, 0); 
  }, [currentStep]);

  // 初期化プロセス（復元機能付き）
  useEffect(() => {
    const initLesson = async () => {
      try {
        const sessionNum = 1;
        const savedData = await fetchTodayLesson(sessionNum);
        
        if (savedData && !savedData.completed) {
          console.log("Resumed from saved data");
          setLessonData(savedData);
          if (savedData.scores) setScores(savedData.scores);
          if (savedData.progress) setResumeData(savedData.progress);
          setCurrentStep(savedData.currentStep || 'lecture');
        } else {
          const data = await generateDailyLesson(learningMode, difficulty, selectedUnit, sessionNum);
          if (data) {
            setLessonData(data);
            setCurrentStep('lecture');
            saveProgress(sessionNum, { 
              currentStep: 'lecture', 
              content: data.content 
            });
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

  // ハンドラー群
  const handleQuizProgress = (currentIndex, currentCorrect) => {
    handleProgressSave('quiz', { quizIndex: currentIndex, quizCorrect: currentCorrect });
  };

  const handleQuizComplete = (result) => {
    const newScores = { ...scores, quizCorrect: result.correct, quizTotal: result.total };
    setScores(newScores);
    setCurrentStep('essay');
    handleProgressSave('essay', {}, newScores);
  };

  const handleEssayDraft = (draftText) => {
    handleProgressSave('essay', { essayDraft: draftText });
  };

  const handleEssayComplete = (result) => {
    const newScores = { ...scores, essayScore: result.score, nextAction: result.recommended_action };
    setScores(newScores);
    setCurrentStep('result');
    saveProgress(1, { currentStep: 'result', scores: newScores, completed: true });
  };

  const calculateTotalScore = () => {
    const { quizCorrect, quizTotal, essayScore, essayTotal } = scores;
    if (quizTotal === 0 && essayTotal === 0) return 0;
    const totalPossible = quizTotal + essayTotal; 
    const totalEarned = quizCorrect + essayScore;
    if (totalPossible === 0) return 0;
    return Math.round((totalEarned / totalPossible) * 100);
  };

  // --- UI レンダリング ---

  if (currentStep === 'loading' || isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-600 font-medium animate-pulse">AI講師が授業を準備中...</p>
      </div>
    );
  }

  if (genError) return <div className="p-4 text-red-500">{genError}</div>;
  if (!lessonData) return null;

  // 結果画面 (Guard無効)
  if (currentStep === 'result') {
    const totalScore = calculateTotalScore();
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-20 animate-fadeIn">
        <Box sx={{ textAlign: 'center', mt: 3, mb: 4 }}>
           <Typography variant="overline" sx={{ color: '#666', fontWeight: 'bold', letterSpacing: 2, fontSize: '0.75rem' }}>
             MISSION COMPLETE
           </Typography>
           <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#333', mt: 1, lineHeight: 1.4, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
             {lessonData.content.theme}
           </Typography>
        </Box>

        <Card elevation={0} sx={{ borderRadius: 6, border: '1px solid #eee', maxWidth: 500, mx: 'auto', mb: 4, bgcolor: 'white' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 'bold', fontSize: '0.7rem' }}>QUIZ</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#333' }}>
                  <span style={{ color: '#4F46E5' }}>{scores.quizCorrect}</span><span style={{ fontSize: '0.875rem', color: '#ccc' }}>/{scores.quizTotal}</span>
                </Typography>
              </Box>
              <Box sx={{ width: 1, height: 32, bgcolor: '#eee', mx: 1 }} />
              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 'bold', fontSize: '0.7rem' }}>ESSAY</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#333' }}>
                  <span style={{ color: '#4F46E5' }}>{scores.essayScore}</span><span style={{ fontSize: '0.875rem', color: '#ccc' }}>/{scores.essayTotal}</span>
                </Typography>
              </Box>
              <Box sx={{ width: 1, height: 32, bgcolor: '#eee', mx: 1 }} />
              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 'bold', fontSize: '0.7rem' }}>TOTAL</Typography>
                <Typography variant="h4" sx={{ fontWeight: '900', color: '#333' }}>
                  {isNaN(totalScore) ? 0 : totalScore}<span style={{ fontSize: '0.875rem', fontWeight: 'normal' }}>pt</span>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ maxWidth: 500, mx: 'auto', mb: 6 }}>
           <Card elevation={3} sx={{ bgcolor: '#fffbf0', border: '2px solid #f3e5ab', borderRadius: 4, position: 'relative', overflow: 'visible' }}>
             <Box sx={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', bgcolor: '#8B4513', color: 'white', px: 2, py: 0.25, borderRadius: 20, fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
               <EmojiEvents sx={{ fontSize: 14 }} /> Next Strategy
             </Box>
             <CardContent sx={{ pt: 3, pb: 2, px: 3, textAlign: 'center' }}>
               <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#4a4a4a', mb: 0.5, fontSize: '0.9rem' }}>AIからの推奨アクション</Typography>
               <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#d97706', fontSize: '1rem', lineHeight: 1.4 }}>
                 {scores.nextAction || "今回の弱点を踏まえ、資料集の図版を確認しましょう。"}
               </Typography>
             </CardContent>
           </Card>
        </Box>
        
        {/* ★ 復活: Self Reflection */}
        <Box sx={{ maxWidth: 500, mx: 'auto', mb: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <span role="img" aria-label="pen" style={{ fontSize: '1rem', marginRight: '8px' }}>📝</span>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>Self Reflection</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.85rem' }}>
            今回の学習で得た「気づき」や、次回の「具体的な目標」を一言残しましょう。
          </Typography>
          
          <TextField
            multiline
            rows={3}
            fullWidth
            placeholder="例：荘園公領制の因果関係が曖昧だった..."
            variant="outlined"
            sx={{ 
              bgcolor: 'white', 
              borderRadius: 3,
              '& .MuiOutlinedInput-root': { borderRadius: 3, fontSize: '0.9rem' }
            }}
          />
        </Box>

        <Box sx={{ maxWidth: 500, mx: 'auto', textAlign: 'center' }}>
          <Button variant="outlined" onClick={onExit} sx={{ borderRadius: 4, px: 4, py: 1.5, fontWeight: 'bold' }}>
            ホームに戻る
          </Button>
        </Box>
      </div>
    );
  }

  // 学習画面 (Guard有効)
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="sticky top-0 bg-white shadow-sm z-10 px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-gray-700 truncate max-w-[60%] text-sm md:text-base">
          {lessonData.content.theme}
        </h1>
        <div className="text-[10px] md:text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100 whitespace-nowrap">
          {currentStep === 'lecture' && 'STEP 1: 講義'}
          {currentStep === 'quiz' && 'STEP 2: 演習'}
          {currentStep === 'essay' && 'STEP 3: 記述'}
          {currentStep === 'result' && 'Review'}
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-4">
        {currentStep === 'lecture' && (
          <div className="animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-8">
              <div className="mb-6 border-b border-gray-100 pb-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Theme</span>
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mt-1 mb-2 leading-tight">
                  {lessonData.content.theme}
                </h2>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r text-sm text-gray-700 mt-3">
                  <span className="font-bold block text-yellow-600 mb-1">
                    {learningMode === 'school' ? '📌 テストに出る！' : '⚡ 入試の急所'}
                  </span>
                  講義を読んで、歴史の流れを掴みましょう。
                </div>
              </div>
              <SafeMarkdown content={lessonData.content.lecture} />
            </div>
            
            {/* ★ 復活: リッチなボタンデザイン */}
            <button
              onClick={() => setCurrentStep('quiz')}
              className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center"
            >
              演習問題へ進む
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
          </div>
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
            lessonData={lessonData} 
            learningMode={learningMode}
            initialDraft={resumeData?.essayDraft} 
            onDraftChange={handleEssayDraft}
            onFinish={handleEssayComplete} 
          />
        )}
      </main>

      {/* 中断確認ダイアログ */}
      <Dialog
        open={showExitDialog}
        onClose={() => setShowExitDialog(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        PaperProps={{ style: { borderRadius: 16, padding: 8 } }}
      >
        <Box sx={{ textAlign: 'center', pt: 2 }}>
          <WarningIcon sx={{ fontSize: 40, color: '#ff9800' }} />
        </Box>
        <DialogTitle id="alert-dialog-title" sx={{ textAlign: 'center', fontWeight: 'bold' }}>
          {"学習を中断しますか？"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description" sx={{ textAlign: 'center', fontSize: '0.9rem' }}>
            現在の進捗は保存されていますが、<br/>ホーム画面に戻りますか？
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2, gap: 1 }}>
          <Button onClick={() => setShowExitDialog(false)} variant="outlined" sx={{ borderRadius: 4, px: 3, fontWeight: 'bold' }}>
            続ける
          </Button>
          <Button onClick={handleExitConfirm} variant="contained" color="error" autoFocus sx={{ borderRadius: 4, px: 3, fontWeight: 'bold' }}>
            中断する
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};