import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, Typography, Card, CardContent, Button, TextField 
} from '@mui/material';
import { EmojiEvents } from '@mui/icons-material';

import { useLessonGenerator } from '../hooks/useLessonGenerator';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { QuizSection } from './QuizSection';
import { EssaySection } from './EssaySection';

export const LessonScreen = ({ apiKey, userId, learningMode, difficulty, selectedUnit }) => {
  // ステップ管理: 'loading' | 'lecture' | 'quiz' | 'essay' | 'result'
  const [currentStep, setCurrentStep] = useState('loading');
  const [lessonData, setLessonData] = useState(null);
  
  // 成績・アクションデータ管理
  const [scores, setScores] = useState({
    quizCorrect: 0,
    quizTotal: 0,
    essayScore: 0,
    essayTotal: 10,
    nextAction: null // AIからの提案アクション
  });

  // 復元用のデータ（クイズの途中経過やエッセイの下書き）
  const [resumeData, setResumeData] = useState(null);

  const { generateDailyLesson, fetchTodayLesson, saveProgress, isProcessing, genError } = useLessonGenerator(apiKey, userId);

  // ★ ステップが切り替わったら画面トップへ強制スクロール
  useEffect(() => {
    window.scrollTo(0, 0); 
  }, [currentStep]);

  // ★ 初期化プロセス（復元機能付き）
  useEffect(() => {
    const initLesson = async () => {
      try {
        const sessionNum = 1; // 本来はセッション管理ロジックに基づく
        
        // 1. まず保存されたデータがあるか確認（アプリが落ちた等のリカバリー）
        const savedData = await fetchTodayLesson(sessionNum);
        
        if (savedData && !savedData.completed) {
          // A. 途中データがあれば復元
          console.log("Resumed from saved data");
          setLessonData(savedData);
          if (savedData.scores) setScores(savedData.scores);
          if (savedData.progress) setResumeData(savedData.progress);
          setCurrentStep(savedData.currentStep || 'lecture');
        } else {
          // B. なければ新規生成
          const data = await generateDailyLesson(learningMode, difficulty, selectedUnit, sessionNum);
          if (data) {
            setLessonData(data);
            setCurrentStep('lecture');
            // 初期状態を保存
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

  // ★ 進捗保存ヘルパー
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

  // --- ハンドラー群 ---

  // クイズ途中経過の保存
  const handleQuizProgress = (currentIndex, currentCorrect) => {
    handleProgressSave('quiz', { 
        quizIndex: currentIndex, 
        quizCorrect: currentCorrect 
    });
  };

  // クイズ完了
  const handleQuizComplete = (result) => {
    const newScores = { ...scores, quizCorrect: result.correct, quizTotal: result.total };
    setScores(newScores);
    setCurrentStep('essay');
    handleProgressSave('essay', {}, newScores);
  };

  // エッセイの下書き保存
  const handleEssayDraft = (draftText) => {
    handleProgressSave('essay', { essayDraft: draftText });
  };

  // エッセイ完了
  const handleEssayComplete = (result) => {
    const newScores = { ...scores, essayScore: result.score, nextAction: result.recommended_action };
    setScores(newScores);
    setCurrentStep('result');
    
    // 完了フラグを立てて保存
    saveProgress(1, { 
        currentStep: 'result', 
        scores: newScores,
        completed: true 
    });
  };

  // 総合スコア計算
  const calculateTotalScore = () => {
    const { quizCorrect, quizTotal, essayScore, essayTotal } = scores;
    if (quizTotal === 0 && essayTotal === 0) return 0;

    const totalPossible = quizTotal + essayTotal; 
    const totalEarned = quizCorrect + essayScore;

    if (totalPossible === 0) return 0;

    return Math.round((totalEarned / totalPossible) * 100);
  };

  // ----------------------------------------------------
  // STEP 4: 結果画面 (Result)
  // ----------------------------------------------------
  if (currentStep === 'result' && lessonData) {
    const totalScore = calculateTotalScore();

    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-20 animate-fadeIn">
        {/* ヘッダー的な表示 */}
        <Box sx={{ textAlign: 'center', mt: 3, mb: 4 }}>
           <Typography variant="overline" sx={{ color: '#666', fontWeight: 'bold', letterSpacing: 2, fontSize: '0.75rem' }}>
             MISSION COMPLETE
           </Typography>
           
           {/* スマホで見やすいサイズ感に調整 */}
           <Typography 
             variant="h5" 
             sx={{ 
               fontWeight: 'bold', 
               color: '#333', 
               mt: 1, 
               lineHeight: 1.4,
               fontSize: { xs: '1.25rem', md: '1.5rem' } 
             }}
           >
             {lessonData.content.theme}
           </Typography>
        </Box>

        {/* スコアカード */}
        <Card 
          elevation={0} 
          sx={{ 
            borderRadius: 6, 
            border: '1px solid #eee', 
            maxWidth: 500, 
            mx: 'auto', 
            mb: 4,
            bgcolor: 'white'
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
              
              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 'bold', fontSize: '0.7rem' }}>QUIZ</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#333' }}>
                  <span style={{ color: '#4F46E5' }}>{scores.quizCorrect}</span>
                  <span style={{ fontSize: '0.875rem', color: '#ccc' }}>/{scores.quizTotal}</span>
                </Typography>
              </Box>

              <Box sx={{ width: 1, height: 32, bgcolor: '#eee', mx: 1 }} />

              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 'bold', fontSize: '0.7rem' }}>ESSAY</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#333' }}>
                  <span style={{ color: '#4F46E5' }}>{scores.essayScore}</span>
                  <span style={{ fontSize: '0.875rem', color: '#ccc' }}>/{scores.essayTotal}</span>
                </Typography>
              </Box>

              <Box sx={{ width: 1, height: 32, bgcolor: '#eee', mx: 1 }} />

              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 'bold', fontSize: '0.7rem' }}>TOTAL</Typography>
                <Typography variant="h4" sx={{ fontWeight: '900', color: '#333' }}>
                  {isNaN(totalScore) ? 0 : totalScore}
                  <span style={{ fontSize: '0.875rem', fontWeight: 'normal' }}>pt</span>
                </Typography>
              </Box>

            </Box>
          </CardContent>
        </Card>

        {/* Next Action Strategy */}
        <Box sx={{ maxWidth: 500, mx: 'auto', mb: 6 }}>
           <Card 
             elevation={3}
             sx={{ 
               bgcolor: '#fffbf0',
               border: '2px solid #f3e5ab',
               borderRadius: 4,
               position: 'relative',
               overflow: 'visible'
             }}
           >
             <Box sx={{
               position: 'absolute',
               top: -10,
               left: '50%',
               transform: 'translateX(-50%)',
               bgcolor: '#8B4513',
               color: 'white',
               px: 2, py: 0.25,
               borderRadius: 20,
               fontSize: '0.7rem',
               fontWeight: 'bold',
               display: 'flex',
               alignItems: 'center',
               gap: 0.5,
               whiteSpace: 'nowrap'
             }}>
               <EmojiEvents sx={{ fontSize: 14 }} /> Next Strategy
             </Box>

             <CardContent sx={{ pt: 3, pb: 2, px: 3, textAlign: 'center' }}>
               <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#4a4a4a', mb: 0.5, fontSize: '0.9rem' }}>
                 AIからの推奨アクション
               </Typography>
               <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#d97706', fontSize: '1rem', lineHeight: 1.4 }}>
                 {scores.nextAction || "今回の弱点を踏まえ、資料集の図版を確認しましょう。"}
               </Typography>
             </CardContent>
           </Card>
        </Box>

        {/* Self Reflection */}
        <Box sx={{ maxWidth: 500, mx: 'auto' }}>
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
      </div>
    );
  }

  // ----------------------------------------------------
  // STEP 1〜3: 講義・演習・記述
  // ----------------------------------------------------

  if (currentStep === 'loading' || isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-600 font-medium animate-pulse">
          AI講師が授業を準備中...
        </p>
      </div>
    );
  }

  if (genError) return <div className="p-4 text-red-500">{genError}</div>;
  if (!lessonData) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* 画面上部の進捗ヘッダー */}
      <div className="sticky top-0 bg-white shadow-sm z-10 px-4 py-3 flex items-center justify-between">
        {/* スマホでも見切れないように調整 */}
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
        {/* STEP 1: 講義 */}
        {currentStep === 'lecture' && (
          <div className="animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-8">
              <div className="mb-6 border-b border-gray-100 pb-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Theme</span>
                
                {/* 講義画面のタイトルも少し控えめに */}
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

            <button
              onClick={() => setCurrentStep('quiz')}
              className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center"
            >
              演習問題へ進む
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
          </div>
        )}

        {/* STEP 2: 演習 */}
        {currentStep === 'quiz' && (
          <QuizSection 
            lessonData={lessonData} 
            initialData={resumeData} // 復元データを渡す
            onProgress={handleQuizProgress} 
            onComplete={handleQuizComplete} 
          />
        )}

        {/* STEP 3: 記述 */}
        {currentStep === 'essay' && (
          <EssaySection 
            apiKey={apiKey}
            lessonData={lessonData} 
            learningMode={learningMode}
            initialDraft={resumeData?.essayDraft} // 下書きを渡す
            onDraftChange={handleEssayDraft}
            onFinish={handleEssayComplete} 
          />
        )}
      </main>
    </div>
  );
};