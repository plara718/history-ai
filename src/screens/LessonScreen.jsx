import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Typography, Container, Paper, Stack, LinearProgress, TextField, Alert
} from '@mui/material';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { getTodayString, scrollToTop } from '../lib/utils';
import { generateDailyLesson, gradeEssay } from '../lib/gemini'; 

// Components
import SmartLoader from '../components/SmartLoader';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { SummaryScreen } from './SummaryScreen';
import { ChevronRight, Edit3 } from 'lucide-react';

export const LessonScreen = ({ 
  apiKey, userId, learningMode, difficulty, selectedUnit, 
  sessionNum,      // 表示しようとしているセッション番号
  currentProgress, // 現在の進行状況 (これより小さい番号は過去)
  reviewContext, 
  onExit 
}) => {
  // ステータス: 'loading' | 'error' | 'lecture' | 'quiz' | 'essay' | 'grading' | 'summary'
  const [step, setStep] = useState('loading');
  const [lessonData, setLessonData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null); 
  
  // クイズ状態
  const [quizIndex, setQuizIndex] = useState(0);
  const [userQuizAnswers, setUserQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState([]);

  // 記述状態
  const [essayAnswer, setEssayAnswer] = useState("");
  const [gradingResult, setGradingResult] = useState(null);

  // --- 初期化 & データ取得/生成 ---
  useEffect(() => {
    const initLesson = async () => {
      if (!userId || !sessionNum) return;
      
      try {
        setStep('loading');
        setErrorMsg(null);

        const today = getTodayString();
        const docId = `${today}_${sessionNum}`;
        const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', docId);
        
        // 1. 既存データの確認
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // --- パターンA: データがある (正常) ---
          console.log("Loading existing lesson data...");
          const data = docSnap.data();
          setLessonData(data);
          
          if (data.completed) {
            setQuizResults(data.quizResults || []);
            setGradingResult(data.gradingResult || null);
            setStep('summary');
          } else {
            setStep('lecture');
          }

        } else {
          // --- パターンB: データがない ---
          
          // ★ ガード処理: 過去のセッションなら生成しない
          if (currentProgress && sessionNum < currentProgress) {
             console.warn("過去データの読み込みに失敗しました。生成は行いません。");
             setErrorMsg("このセッションの学習データが見つかりませんでした。");
             setStep('error');
             return;
          }

          // ★ ここに来るのは「現在のセッション(新規)」の場合のみ
          console.log("Generating new lesson...");
          
          if (!apiKey) {
            alert("APIキーが設定されていません。設定画面から入力してください。");
            onExit();
            return;
          }

          const newLesson = await generateDailyLesson(
            apiKey, 
            learningMode, 
            difficulty, 
            reviewContext ? `復習モード: ${reviewContext.target_mistake}` : selectedUnit, 
            reviewContext
          );

          if (!newLesson) throw new Error("生成に失敗しました");

          // DBに保存
          const initData = {
            ...newLesson,
            userId,
            sessionNum,
            createdAt: new Date().toISOString(),
            completed: false
          };
          await setDoc(docRef, initData);
          setLessonData(initData);
          setStep('lecture');
        }
      } catch (e) {
        console.error(e);
        setErrorMsg("エラーが発生しました: " + e.message);
        setStep('error');
      }
    };

    initLesson();
  }, [userId, sessionNum]); 

  // --- ハンドラ ---

  const handleStartQuiz = () => {
    setStep('quiz');
    scrollToTop();
  };

  const handleQuizAnswer = (val) => {
    setUserQuizAnswers(prev => ({ ...prev, [quizIndex]: val }));
  };

  const handleNextQuiz = () => {
    const currentQ = lessonData.content.true_false[quizIndex];
    const userAns = userQuizAnswers[quizIndex];
    const isCorrect = (userAns === (currentQ.correct === 0)); 
    
    const result = {
      q: currentQ.q,
      userAns,
      is_correct: isCorrect,
      exp: currentQ.exp
    };
    
    const newResults = [...quizResults, result];
    setQuizResults(newResults);

    if (quizIndex < (lessonData.content.true_false.length - 1)) {
      setQuizIndex(quizIndex + 1);
    } else {
      setStep('essay');
    }
    scrollToTop();
  };

  const handleGradeEssay = async () => {
    if (!essayAnswer.trim()) return;
    setStep('grading');
    
    try {
      const result = await gradeEssay(apiKey, lessonData.content.essay.q, essayAnswer, difficulty);
      setGradingResult(result);
      
      const today = getTodayString();
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`);
      
      await setDoc(docRef, {
        quizResults: quizResults, 
        gradingResult: result,
        essayAnswer: essayAnswer,
        completed: true,
        completedAt: new Date().toISOString()
      }, { merge: true });

      setStep('summary');
    } catch (e) {
      console.error(e);
      alert("添削に失敗しました。");
      setStep('essay');
    }
    scrollToTop();
  };

  // --- レンダリング ---

  if (step === 'loading') {
    return <SmartLoader message="AIが授業を準備中..." />;
  }

  // ★ エラー表示画面
  if (step === 'error') {
    return (
      <Container maxWidth="sm" className="animate-fade-in" sx={{ py: 10, textAlign: 'center' }}>
        <Alert severity="warning" sx={{ mb: 3, justifyContent: 'center', py: 2, fontWeight: 'bold' }}>
          {errorMsg || "データの読み込みに失敗しました"}
        </Alert>
        <Button variant="outlined" onClick={onExit}>ホームに戻る</Button>
      </Container>
    );
  }

  if (step === 'summary') {
    return (
      <SummaryScreen 
        lessonData={lessonData}
        gradingResult={gradingResult}
        quizResults={quizResults}
        onFinish={onExit}
      />
    );
  }

  if (step === 'lecture') {
    return (
      <Container maxWidth="md" className="animate-fade-in">
        <Box mb={4}>
          <Typography variant="overline" color="primary" fontWeight="bold">
            SESSION {sessionNum}
          </Typography>
          <Typography variant="h5" fontWeight="900" gutterBottom>
            {lessonData.content.theme}
          </Typography>
        </Box>

        {/* デザイン修正: borderRadiusを4から3に変更 */}
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3, bgcolor: 'white', border: '1px solid', borderColor: 'divider', mb: 4 }}>
          <SafeMarkdown content={lessonData.content.lecture} />
        </Paper>

        <Button 
          variant="contained" 
          fullWidth 
          size="large"
          onClick={handleStartQuiz}
          endIcon={<ChevronRight />}
          sx={{ py: 2, borderRadius: 3, fontWeight: 'bold', boxShadow: 3 }}
        >
          理解度チェックに進む
        </Button>
      </Container>
    );
  }

  if (step === 'quiz') {
    const questions = lessonData.content.true_false || [];
    const currentQ = questions[quizIndex];
    const progress = ((quizIndex) / questions.length) * 100;

    return (
      <Container maxWidth="sm" className="animate-fade-in" sx={{ py: 4 }}>
        <Stack spacing={3}>
           <Box>
             {/* デザイン修正: borderRadiusを4から2に変更 */}
             <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 2, mb: 1 }} />
             <Typography variant="caption" color="text.secondary" fontWeight="bold">
               QUESTION {quizIndex + 1} / {questions.length}
             </Typography>
           </Box>

           {/* デザイン修正: borderRadiusを4から3に変更 */}
           <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
             <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.6 }}>
               {currentQ.q}
             </Typography>
           </Paper>

           <Stack direction="row" spacing={2}>
             {[true, false].map((val) => (
               <Button
                 key={val.toString()}
                 variant={userQuizAnswers[quizIndex] === val ? "contained" : "outlined"}
                 color={val ? "primary" : "error"}
                 fullWidth
                 onClick={() => handleQuizAnswer(val)}
                 sx={{ py: 3, borderRadius: 3, fontSize: '1.2rem', fontWeight: 'bold' }}
               >
                 {val ? "⭕ 正しい" : "❌ 誤り"}
               </Button>
             ))}
           </Stack>

           <Button 
             variant="contained" 
             size="large"
             disabled={userQuizAnswers[quizIndex] === undefined}
             onClick={handleNextQuiz}
             sx={{ py: 2, borderRadius: 3, fontWeight: 'bold', mt: 2 }}
           >
             次へ進む
           </Button>
        </Stack>
      </Container>
    );
  }

  if (step === 'grading') {
    return <SmartLoader message="AIが答案を採点中..." />;
  }

  if (step === 'essay') {
    return (
      <Container maxWidth="md" className="animate-fade-in">
        <Box mb={4}>
          <Typography variant="overline" color="secondary" fontWeight="bold">
            FINAL CHALLENGE
          </Typography>
          <Typography variant="h5" fontWeight="900">
            記述問題
          </Typography>
        </Box>

        {/* デザイン修正: borderRadiusを4から3に変更 */}
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, mb: 4, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            {lessonData.content.essay.q}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            200文字以内で回答してください。要点を簡潔にまとめる力が試されます。
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={6}
            placeholder="ここに回答を入力..."
            value={essayAnswer}
            onChange={(e) => setEssayAnswer(e.target.value)}
            sx={{ bgcolor: '#f8fafc' }}
          />
        </Paper>

        <Button 
          variant="contained" 
          fullWidth 
          size="large"
          color="secondary"
          onClick={handleGradeEssay}
          disabled={!essayAnswer.trim()}
          startIcon={<Edit3 />}
          sx={{ py: 2, borderRadius: 3, fontWeight: 'bold', boxShadow: 3 }}
        >
          採点する
        </Button>
      </Container>
    );
  }

  return null;
};