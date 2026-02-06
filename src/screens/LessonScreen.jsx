import React, { useState, useEffect } from 'react';
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

  const { generateDailyLesson, isProcessing, genError } = useLessonGenerator(apiKey, userId);

  // ★ 追加: ステップが切り替わったら画面トップへ強制スクロール
  useEffect(() => {
    window.scrollTo(0, 0); 
  }, [currentStep]);

  // 初回生成処理
  useEffect(() => {
    const initLesson = async () => {
      try {
        // セッション番号は仮で1としています（実際はDB等から取得）
        const sessionNum = 1;
        const data = await generateDailyLesson(learningMode, difficulty, selectedUnit, sessionNum);
        if (data) {
            setLessonData(data);
            setCurrentStep('lecture');
        }
      } catch (e) {
        console.error("Lesson generation failed", e);
      }
    };

    initLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回のみ実行

  // ★ Quiz完了時の処理
  const handleQuizComplete = (result) => {
    setScores(prev => ({
      ...prev,
      quizCorrect: result.correct,
      quizTotal: result.total
    }));
    setCurrentStep('essay');
  };

  // ★ Essay完了時の処理
  const handleEssayComplete = (result) => {
    setScores(prev => ({
      ...prev,
      essayScore: result.score,
      nextAction: result.recommended_action // ★ 採点結果からアクションを受け取る
    }));
    setCurrentStep('result');
  };

  // ★ 総合スコア計算ロジック
  const calculateTotalScore = () => {
    const { quizCorrect, quizTotal, essayScore, essayTotal } = scores;
    
    // まだデータがない場合
    if (quizTotal === 0 && essayTotal === 0) return 0;

    const totalPossible = quizTotal + essayTotal; 
    const totalEarned = quizCorrect + essayScore;

    if (totalPossible === 0) return 0;

    // 100点満点に換算して四捨五入
    return Math.round((totalEarned / totalPossible) * 100);
  };

  // ----------------------------------------------------
  // 結果画面 (Step 4: Result)
  // ----------------------------------------------------
  if (currentStep === 'result' && lessonData) {
    const totalScore = calculateTotalScore();

    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-20 animate-fadeIn">
        {/* ヘッダー的な表示 */}
        <Box sx={{ textAlign: 'center', mt: 4, mb: 6 }}>
           <Typography variant="overline" sx={{ color: '#666', fontWeight: 'bold', letterSpacing: 2 }}>
             MISSION COMPLETE
           </Typography>
           <Typography variant="h4" sx={{ fontWeight: '900', color: '#333', mt: 1, lineHeight: 1.3 }}>
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
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
              
              {/* QUIZスコア */}
              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 'bold' }}>QUIZ</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#333' }}>
                  <span style={{ color: '#4F46E5' }}>{scores.quizCorrect}</span>
                  <span style={{ fontSize: '1rem', color: '#ccc' }}>/{scores.quizTotal}</span>
                </Typography>
              </Box>

              <Box sx={{ width: 1, height: 40, bgcolor: '#eee', mx: 2 }} />

              {/* ESSAYスコア */}
              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 'bold' }}>ESSAY</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#333' }}>
                  <span style={{ color: '#4F46E5' }}>{scores.essayScore}</span>
                  <span style={{ fontSize: '1rem', color: '#ccc' }}>/{scores.essayTotal}</span>
                </Typography>
              </Box>

              <Box sx={{ width: 1, height: 40, bgcolor: '#eee', mx: 2 }} />

              {/* TOTALスコア */}
              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 'bold' }}>TOTAL</Typography>
                <Typography variant="h4" sx={{ fontWeight: '900', color: '#333' }}>
                  {isNaN(totalScore) ? 0 : totalScore}
                  <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>pt</span>
                </Typography>
              </Box>

            </Box>
          </CardContent>
        </Card>

        {/* ★ Next Action Strategy (AI提案表示) */}
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
               top: -12,
               left: '50%',
               transform: 'translateX(-50%)',
               bgcolor: '#8B4513',
               color: 'white',
               px: 2, py: 0.5,
               borderRadius: 20,
               fontSize: '0.75rem',
               fontWeight: 'bold',
               display: 'flex',
               alignItems: 'center',
               gap: 0.5
             }}>
               <EmojiEvents fontSize="small" /> Next Strategy
             </Box>

             <CardContent sx={{ pt: 4, pb: 3, textAlign: 'center' }}>
               <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#4a4a4a', mb: 1 }}>
                 AIからの推奨アクション
               </Typography>
               <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#d97706', fontSize: '1.1rem' }}>
                 {/* AI提案を表示。もしnullならデフォルト文言 */}
                 {scores.nextAction || "今回の弱点を踏まえ、資料集の図版を確認しましょう。"}
               </Typography>
             </CardContent>
           </Card>
        </Box>

        {/* Self Reflection (振り返り入力) */}
        <Box sx={{ maxWidth: 500, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <span role="img" aria-label="pen" style={{ fontSize: '1.2rem', marginRight: '8px' }}>📝</span>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Self Reflection</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            今回の学習で得た「気づき」や、次回の「具体的な目標」を一言残しましょう。
          </Typography>
          
          <TextField
            multiline
            rows={4}
            fullWidth
            placeholder="例：荘園公領制の因果関係が曖昧だった。次は資料集の図版を確認してから挑む。"
            variant="outlined"
            sx={{ 
              bgcolor: 'white', 
              borderRadius: 3,
              '& .MuiOutlinedInput-root': { borderRadius: 3 }
            }}
          />
        </Box>
      </div>
    );
  }

  // ----------------------------------------------------
  // STEP 1〜3 のレンダリング (講義・演習・記述)
  // ----------------------------------------------------

  // ローディング中
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
        <h1 className="font-bold text-gray-700 truncate max-w-[70%]">
          {lessonData.content.theme}
        </h1>
        <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
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
                <h2 className="text-2xl font-bold text-gray-800 mt-1 mb-2">
                  {lessonData.content.theme}
                </h2>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r text-sm text-gray-700">
                  <span className="font-bold block text-yellow-600 mb-1">
                    {learningMode === 'school' ? '📌 テストに出る！' : '⚡ 入試の急所'}
                  </span>
                  講義を読んで、歴史の流れを掴みましょう。
                </div>
              </div>
              
              {/* Markdown講義表示 */}
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

        {/* STEP 2: 演習 (QuizSection) */}
        {currentStep === 'quiz' && (
          <QuizSection 
            lessonData={lessonData} 
            onComplete={handleQuizComplete} // 正しいハンドラを渡す
          />
        )}

        {/* STEP 3: 記述 (EssaySection) */}
        {currentStep === 'essay' && (
          <EssaySection 
            apiKey={apiKey}
            lessonData={lessonData} 
            learningMode={learningMode}
            onFinish={handleEssayComplete} // 正しいハンドラを渡す
          />
        )}
      </main>
    </div>
  );
};