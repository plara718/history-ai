import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Container, Paper, Alert } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { getTodayString, scrollToTop, validateLessonData } from '../lib/utils';
import { saveLessonStats } from '../lib/stats';

// Hooks
import { useLessonGenerator } from '../hooks/useLessonGenerator';

// Components & Screens
import SmartLoader from '../components/SmartLoader';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { SummaryScreen } from './SummaryScreen';
import { QuizScreen } from './QuizScreen';    
import { EssayScreen } from './EssayScreen';  

// ★ ここが重要： export const LessonScreen となっていること
export const LessonScreen = ({ 
  apiKey, userId, learningMode, difficulty, selectedUnit, 
  sessionNum, currentProgress, reviewContext, onExit 
}) => {
  // --- State & Hooks ---
  const [step, setStep] = useState('loading'); // loading -> lecture -> quiz -> essay -> summary
  const [lessonData, setLessonData] = useState(null);
  
  // 生成フック
  const { generateDailyLesson, fetchTodayLesson, isProcessing, genError } = useLessonGenerator(apiKey, userId);

  // 状態保持用 (結果画面や統計保存のために親で持つ)
  const [quizResults, setQuizResults] = useState([]);
  const [gradingResult, setGradingResult] = useState(null);
  const [essayAnswer, setEssayAnswer] = useState("");

  // --- 初期化ロジック ---
  useEffect(() => {
    const initLesson = async () => {
      if (!userId || !sessionNum) return;
      setStep('loading');

      // 1. 既存データの確認
      let data = await fetchTodayLesson(sessionNum);

      // 2. なければ新規生成
      if (!data) {
        if (!apiKey) { alert("APIキー未設定"); onExit(); return; }
        
        data = await generateDailyLesson(learningMode, difficulty, selectedUnit, sessionNum, reviewContext);
      }

      // 3. データの検証と適用
      if (data) {
        const validatedData = validateLessonData(data);
        setLessonData(validatedData);

        // 完了済みならリザルトへ、そうでなければ講義へ
        if (validatedData.completed) {
          setQuizResults(validatedData.quizResults || []);
          setGradingResult(validatedData.gradingResult || null);
          // 既存回答があればセット
          setEssayAnswer(validatedData.essayAnswer || "");
          setStep('summary');
        } else {
          setStep('lecture');
        }
      } else {
        setStep('error');
      }
    };

    initLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionNum]);


  // --- ハンドラ ---
  
  // 講義完了 -> クイズへ
  const handleStartQuiz = () => { setStep('quiz'); scrollToTop(); };

  // クイズ完了 (QuizScreenから呼ばれる)
  const handleQuizComplete = (results) => {
    // results: { quizCorrect, quizTotal, quizResults }
    setQuizResults(results.quizResults); // 詳細ログを保存
    setStep('essay');
    scrollToTop();
  };

  // 記述完了 (EssayScreenから呼ばれる)
  const handleEssayComplete = async (resultData) => {
    // resultData: { score, rank, recommended_action, gradingResult }
    const finalGradingResult = resultData.gradingResult;
    setGradingResult(finalGradingResult);
    
    // 最終保存処理
    const today = getTodayString();
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`), {
      quizResults, 
      gradingResult: finalGradingResult, 
      essayAnswer, // stateから取得
      completed: true, 
      completedAt: new Date().toISOString()
    }, { merge: true });

    // 統計データの更新
    await saveLessonStats(userId, lessonData, quizResults, finalGradingResult);

    setStep('summary');
    scrollToTop();
  };

  // --- Render ---
  
  if (isProcessing || step === 'loading') {
    return <SmartLoader message={isProcessing ? "AIが授業を生成中..." : "データを読み込み中..."} />;
  }
  
  if (step === 'error' || genError) {
    return (
      <Container>
        <Alert severity="error" sx={{ mb: 2 }}>{genError || "データの読み込みに失敗しました。"}</Alert>
        <Button onClick={onExit} variant="outlined">ホームに戻る</Button>
      </Container>
    );
  }

  if (step === 'summary') {
    return <SummaryScreen lessonData={lessonData} gradingResult={gradingResult} quizResults={quizResults} onFinish={onExit} />;
  }

  // 1. 講義画面
  if (step === 'lecture' && lessonData) {
    const content = lessonData.content || lessonData;
    return (
      <Container maxWidth="md" className="animate-fade-in">
        <Box mb={4}>
          <Typography variant="overline" color="primary" fontWeight="bold">SESSION {sessionNum}</Typography>
          <Typography variant="h5" fontWeight="900" mt={1}>{content.theme}</Typography>
        </Box>
        <Paper sx={{ p: 4, mb: 4, borderRadius: 4, lineHeight: 1.8 }}>
          <SafeMarkdown content={content.lecture} />
        </Paper>
        <Button variant="contained" fullWidth size="large" onClick={handleStartQuiz} endIcon={<ChevronRight />} sx={{ py: 2, fontWeight: 'bold', boxShadow: 3 }}>
          演習へ進む
        </Button>
      </Container>
    );
  }

  // 2. クイズ画面 (QuizScreen)
  if (step === 'quiz') {
    return (
      <QuizScreen
        lessonData={lessonData}
        initialData={{ quizIndex: 0, quizCorrect: 0 }} 
        onComplete={handleQuizComplete}
      />
    );
  }

  // 3. 記述画面 (EssayScreen)
  if (step === 'essay' && lessonData) {
    return (
      <EssayScreen
        apiKey={apiKey}
        userId={userId}
        lessonData={lessonData}
        learningMode={learningMode}
        initialDraft={essayAnswer}
        onDraftChange={(text) => setEssayAnswer(text)} // 入力内容を親で保持
        onFinish={handleEssayComplete}
      />
    );
  }

  return null;
};