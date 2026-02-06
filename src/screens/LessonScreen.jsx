import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Container, Chip } from '@mui/material';
import { CheckCircle, ArrowForward, School, EmojiEvents } from '@mui/icons-material';
import { doc, setDoc, increment } from 'firebase/firestore'; // ★追加: 保存用
import { db } from '../lib/firebase'; // ★追加: 保存用
import { APP_ID } from '../lib/constants'; // ★追加: 保存用
import { getTodayString } from '../lib/utils'; // ★追加: 保存用

// Hooks
import { useLessonGenerator } from '../hooks/useLessonGenerator';

// Components
import { SafeMarkdown } from '../components/SafeMarkdown';
import { QuizSection } from './QuizSection';
import { EssaySection } from './EssaySection';
import { SummaryScreen } from './SummaryScreen';

export const LessonScreen = ({ apiKey, userId, learningMode, difficulty, selectedUnit, sessionNum = 1, onFinish }) => {
  // --- State Management ---
  // ステップ: 'loading' -> 'lecture' -> 'quiz' -> 'essay' -> 'result'
  const [currentStep, setCurrentStep] = useState('loading');
  const [lessonData, setLessonData] = useState(null);
  
  // ログデータ (SummaryScreen & NotebookLM用)
  const [quizLog, setQuizLog] = useState([]); // クイズの回答履歴
  const [gradingResult, setGradingResult] = useState(null); // 記述の採点結果

  // AI Generator Hook
  const { generateDailyLesson, isProcessing, genError } = useLessonGenerator(apiKey, userId);

  // --- Effects ---

  // 初回マウント時にAI生成（または既存データ読み込み）を実行
  useEffect(() => {
    const initLesson = async () => {
      try {
        // generateDailyLesson内部で「既存データのチェック」を行うため、
        // 毎回呼んでも無駄な生成は発生しません（修正済みuseLessonGeneratorが前提）
        const data = await generateDailyLesson(learningMode, difficulty, selectedUnit, sessionNum);
        if (data) {
          setLessonData(data);
          
          // 既に完了しているデータだった場合、いきなり結果画面に行きたい場合はここで分岐可能
          // 今回は復習も兼ねて 'lecture' から始める仕様にします
          setCurrentStep('lecture');
        }
      } catch (e) {
        console.error("Lesson generation failed", e);
      }
    };

    if (userId && apiKey) {
      initLesson();
    }
  }, []); 

  // --- Handlers ---

  /**
   * クイズ（正誤・整序）の回答をログに記録する関数
   * QuizSectionから1問ごとに呼び出される
   */
  const handleQuizLogUpdate = (logItem) => {
    // logItem: { q, type, result, correct, userAns, exp }
    setQuizLog((prev) => [...prev, logItem]);
  };

  /**
   * 記述問題（Essay）が完了した時の処理
   * ★ここでFirebaseへの保存を実行します
   */
  const handleEssayComplete = async (result) => {
    setGradingResult(result);
    setCurrentStep('result');

    // --- データの保存処理 ---
    if (userId) {
      try {
        const today = getTodayString();
        const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`);
        const statsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap');

        // 1. レッスンデータに結果を追記（完了フラグを立てる）
        await setDoc(docRef, {
          quizLog: quizLog,          // クイズの回答履歴
          gradingResult: result,     // 記述の採点結果
          completed: true,           // 完了フラグ
          completedAt: new Date().toISOString()
        }, { merge: true });

        // 2. ヒートマップ（カレンダー）を更新
        await setDoc(statsRef, { 
          data: { [today]: increment(1) } 
        }, { merge: true });

        console.log("Lesson result saved successfully.");
      } catch (e) {
        console.error("保存エラー:", e);
      }
    }
  };

  /**
   * 全学習終了（親コンポーネントへ通知）
   */
  const handleFinishSession = () => {
    if (onFinish) {
      onFinish();
    }
  };

  // --- Render Helpers ---

  // ローディング画面
  if (currentStep === 'loading' || isProcessing) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', bgcolor: '#f8fafc', p: 3 }}>
        <CircularProgress size={60} thickness={4} sx={{ color: '#4f46e5', mb: 4 }} />
        <Typography variant="h6" fontWeight="bold" color="text.secondary" className="animate-pulse">
          {learningMode === 'school' ? '定期テスト対策' : '入試戦略'}講義を準備中...
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1 }}>
          AI講師が黒板を準備しています<br/>(難易度: {difficulty})
        </Typography>
      </Box>
    );
  }

  // エラー画面
  if (genError) {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>
          {genError}
        </Alert>
        <Button onClick={() => window.location.reload()} sx={{ mt: 2 }}>
          再試行する
        </Button>
      </Container>
    );
  }

  // データがない場合のフォールバック
  if (!lessonData) return null;

  // メイン描画
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 8 }}>
      
      {/* 1. Sticky Header (進捗バー) */}
      <Box 
        sx={{ 
          position: 'sticky', top: 0, zIndex: 100, 
          bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #e2e8f0', px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 'bold', color: '#334155', maxWidth: '60%' }}>
          {lessonData.content.theme}
        </Typography>
        
        <Chip 
          label={
            currentStep === 'lecture' ? 'STEP 1: 講義' :
            currentStep === 'quiz' ? 'STEP 2: 演習' :
            currentStep === 'essay' ? 'STEP 3: 記述' : 'Review'
          }
          color={currentStep === 'result' ? "success" : "primary"}
          size="small"
          sx={{ fontWeight: 'bold' }}
        />
      </Box>

      {/* 2. Main Content Area */}
      <Container maxWidth="md" sx={{ mt: 3 }}>
        
        {/* STEP 1: Lecture (講義) */}
        {currentStep === 'lecture' && (
          <Box className="animate-fadeIn">
            <Box sx={{ p: { xs: 2, md: 4 }, borderRadius: 4, bgcolor: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              
              {/* テーマヘッダー */}
              <Box sx={{ mb: 4, borderBottom: '2px solid #f1f5f9', pb: 3 }}>
                <Typography variant="overline" color="primary" fontWeight="bold" letterSpacing={1.2}>
                  TODAY'S THEME
                </Typography>
                <Typography variant="h4" fontWeight="900" sx={{ mt: 1, mb: 2, color: '#1e293b' }}>
                  {lessonData.content.theme}
                </Typography>
                
                {/* AI戦略エッセンス（入試の急所 etc） */}
                {lessonData.content.strategic_essence && (
                  <Alert 
                    severity="warning" 
                    icon={<School fontSize="inherit" />}
                    sx={{ 
                      borderRadius: 2, 
                      fontWeight: 'bold', 
                      color: '#78350f', 
                      bgcolor: '#fffbeb',
                      border: '1px solid #fcd34d'
                    }}
                  >
                    {lessonData.content.strategic_essence}
                  </Alert>
                )}
              </Box>

              {/* 講義本文 (Markdown) */}
              <SafeMarkdown content={lessonData.content.lecture} />
              
              {/* 重要語句リスト */}
              <Box sx={{ mt: 6 }}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" sx={{ mb: 2 }}>
                  重要語句チェック
                </Typography>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { md: '1fr 1fr' } }}>
                  {lessonData.content.essential_terms.map((term, i) => (
                    <Box key={i} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                      <Typography variant="subtitle2" fontWeight="bold" color="primary">
                        {term.term}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {term.def}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

            </Box>

            {/* Next Button */}
            <Button
              variant="contained"
              fullWidth
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => setCurrentStep('quiz')}
              sx={{ 
                mt: 4, py: 2, borderRadius: 3, fontSize: '1.1rem', fontWeight: 'bold',
                boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
              }}
            >
              演習問題に挑戦する
            </Button>
          </Box>
        )}

        {/* STEP 2: Quiz (演習) */}
        {currentStep === 'quiz' && (
          <QuizSection 
            lessonData={lessonData}
            onAnswerOne={handleQuizLogUpdate}
            onComplete={() => setCurrentStep('essay')}
          />
        )}

        {/* STEP 3: Essay (記述) */}
        {currentStep === 'essay' && (
          <EssaySection
            apiKey={apiKey}
            lessonData={lessonData}
            learningMode={learningMode}
            onFinish={handleEssayComplete} // 採点結果を受け取り、保存してResultへ
          />
        )}

        {/* STEP 4: Summary (結果 & NotebookLM連携) */}
        {currentStep === 'result' && gradingResult && (
          <SummaryScreen
            lessonData={lessonData}
            gradingResult={gradingResult}
            quizLog={quizLog}
            onFinish={handleFinishSession}
          />
        )}

      </Container>
    </Box>
  );
};