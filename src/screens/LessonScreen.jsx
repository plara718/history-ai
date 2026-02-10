import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Typography, Container, Paper, Stack, LinearProgress, TextField, Alert,
  List, ListItem, ListItemText, IconButton
} from '@mui/material';
import { 
  ArrowUpward, ArrowDownward, ChevronRight, Edit as EditIcon
} from '@mui/icons-material';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { getTodayString, scrollToTop, validateLessonData } from '../lib/utils';
import { saveLessonStats } from '../lib/stats';

// ★ カスタムフックのインポート
import { useLessonGenerator } from '../hooks/useLessonGenerator';
import { useLessonGrader } from '../hooks/useLessonGrader';

import SmartLoader from '../components/SmartLoader';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { SummaryScreen } from './SummaryScreen';

export const LessonScreen = ({ 
  apiKey, userId, learningMode, difficulty, selectedUnit, 
  sessionNum, currentProgress, reviewContext, onExit 
}) => {
  // --- State & Hooks ---
  const [step, setStep] = useState('loading');
  const [lessonData, setLessonData] = useState(null);
  
  // 生成フック
  const { generateDailyLesson, fetchTodayLesson, isProcessing, genError } = useLessonGenerator(apiKey, userId);
  // 採点フック
  const { gradeLesson, isGrading, gradeError } = useLessonGrader(apiKey, userId);

  // クイズ状態
  const [quizList, setQuizList] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [userQuizAnswers, setUserQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState([]);

  // 記述状態
  const [essayAnswer, setEssayAnswer] = useState("");
  const [gradingResult, setGradingResult] = useState(null);

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
        
        // 生成フック呼び出し
        data = await generateDailyLesson(learningMode, difficulty, selectedUnit, sessionNum, reviewContext);
      }

      // 3. データの検証と適用
      if (data) {
        // AIデータの揺らぎを補正 (utils.js)
        const validatedData = validateLessonData(data);
        setLessonData(validatedData);
        prepareQuizList(validatedData);

        // 完了済みならリザルトへ、そうでなければ講義へ
        if (validatedData.completed) {
          setQuizResults(validatedData.quizResults || []);
          setGradingResult(validatedData.gradingResult || null);
          setStep('summary');
        } else {
          setStep('lecture');
        }
      } else {
        // 生成失敗時
        setStep('error');
      }
    };

    initLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionNum]); // userIdやmodeが変わった時も再走させるなら依存に追加

  // --- クイズ準備ヘルパー ---
  const prepareQuizList = (data) => {
    // validateLessonDataを通しているので content プロパティ等は整形済み
    const target = data.content || data; // 念のためフォールバック
    if (!target) return;

    const tf = (target.true_false || []).map(q => ({ ...q, type: 'tf' }));
    const sort = (target.sort || []).map(q => ({ 
      ...q, 
      type: 'sort', 
      initialOrder: q.items ? q.items.map((_, i) => i) : []
    }));
    setQuizList([...tf, ...sort]);
  };

  // --- ハンドラ ---
  const handleStartQuiz = () => { setStep('quiz'); scrollToTop(); };

  // 正誤回答
  const handleTFAnswer = (val) => {
    setUserQuizAnswers(prev => ({ ...prev, [quizIndex]: val }));
  };

  // 整序回答
  const moveSortItem = (currentIndex, direction) => {
    setUserQuizAnswers(prev => {
      const currentOrder = prev[quizIndex] || [...quizList[quizIndex].initialOrder];
      const newOrder = [...currentOrder];
      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return prev;
      [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
      return { ...prev, [quizIndex]: newOrder };
    });
  };

  const handleNextQuiz = () => {
    const q = quizList[quizIndex];
    const userAns = userQuizAnswers[quizIndex];
    let isCorrect = false;

    if (q.type === 'tf') {
      isCorrect = (userAns === (q.correct === 0));
    } else if (q.type === 'sort') {
      const currentOrder = userAns || q.initialOrder;
      isCorrect = JSON.stringify(currentOrder) === JSON.stringify(q.correct_order);
    }

    setQuizResults(prev => [...prev, { 
      q: q.q, 
      is_correct: isCorrect, 
      exp: q.exp, 
      type: q.type,
      tags: [q.intention_tag] // 統計用にタグを保存
    }]);

    if (quizIndex < quizList.length - 1) {
      setQuizIndex(quizIndex + 1);
      scrollToTop();
    } else {
      setStep('essay');
    }
  };

  const handleGradeEssay = async () => {
    if (!essayAnswer.trim()) return;
    
    // 採点フック呼び出し
    const result = await gradeLesson(lessonData, essayAnswer, learningMode);

    if (result) {
      setGradingResult(result);
      
      const today = getTodayString();
      // 完了ステータス更新 (ここは画面固有の処理なのでコンポーネントに残す)
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`), {
        quizResults, 
        gradingResult: result, 
        essayAnswer, 
        completed: true, 
        completedAt: new Date().toISOString()
      }, { merge: true });

      // 統計データの更新 (stats.js)
      await saveLessonStats(userId, lessonData, quizResults, result);

      setStep('summary');
    }
  };

  // --- Render ---
  
  if (isProcessing || isGrading || step === 'loading') {
    return <SmartLoader message={isProcessing ? "AIが授業を生成中..." : isGrading ? "AIが採点中..." : "データを読み込み中..."} />;
  }
  
  if (step === 'error' || genError || gradeError) {
    return (
      <Container>
        <Alert severity="error" sx={{ mb: 2 }}>
          {genError || gradeError || "データの読み込みに失敗しました。"}
        </Alert>
        <Button onClick={onExit} variant="outlined">ホームに戻る</Button>
      </Container>
    );
  }

  if (step === 'summary') {
    return <SummaryScreen lessonData={lessonData} gradingResult={gradingResult} quizResults={quizResults} onFinish={onExit} />;
  }

  // 1. 講義画面
  if (step === 'lecture' && lessonData) {
    // データの正規化 (contentプロパティの有無を吸収)
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

  // 2. クイズ画面
  if (step === 'quiz') {
    const q = quizList[quizIndex];
    if (!q) return null; // ガード
    const progress = ((quizIndex) / quizList.length) * 100;

    return (
      <Container maxWidth="sm" className="animate-fade-in" sx={{ py: 4 }}>
        <LinearProgress variant="determinate" value={progress} sx={{ mb: 2, borderRadius: 2 }} />
        <Typography variant="caption" fontWeight="bold" color="text.secondary">
          Q{quizIndex + 1}. {q.type === 'tf' ? '正誤判定' : '並べ替え'}
        </Typography>
        
        <Paper sx={{ p: 3, my: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight="bold">{q.q}</Typography>
        </Paper>

        {q.type === 'tf' ? (
          <Stack direction="row" spacing={2}>
            {[true, false].map(val => (
              <Button 
                key={val.toString()} fullWidth variant={userQuizAnswers[quizIndex] === val ? "contained" : "outlined"}
                color={val ? "primary" : "error"} onClick={() => handleTFAnswer(val)}
                sx={{ py: 2, fontSize: '1.2rem', fontWeight: 'bold', borderRadius: 3 }}
              >
                {val ? "⭕ 正しい" : "❌ 誤り"}
              </Button>
            ))}
          </Stack>
        ) : (
          <Box>
            <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              {(userQuizAnswers[quizIndex] || q.initialOrder).map((itemIndex, i, arr) => (
                <ListItem key={itemIndex} divider={i !== arr.length - 1} secondaryAction={
                  <Box display="flex" flexDirection="column">
                    <IconButton size="small" disabled={i === 0} onClick={() => moveSortItem(i, -1)}><ArrowUpward fontSize="small"/></IconButton>
                    <IconButton size="small" disabled={i === arr.length - 1} onClick={() => moveSortItem(i, 1)}><ArrowDownward fontSize="small"/></IconButton>
                  </Box>
                }>
                  <ListItemText primary={q.items[itemIndex]} secondary={`${i + 1}番目`} />
                </ListItem>
              ))}
            </List>
            <Button variant="contained" fullWidth onClick={handleNextQuiz} sx={{ mt: 2, py: 1.5, fontWeight: 'bold' }}>決定する</Button>
          </Box>
        )}

        {q.type === 'tf' && (
          <Button 
            variant="contained" size="large" fullWidth onClick={handleNextQuiz} 
            disabled={userQuizAnswers[quizIndex] === undefined} sx={{ mt: 3, py: 1.5, fontWeight: 'bold' }}
          >
            次へ
          </Button>
        )}
      </Container>
    );
  }

  // 3. 記述画面
  if (step === 'essay' && lessonData) {
    const content = lessonData.content || lessonData;
    const essayQ = content.essay ? content.essay.q : "問題文が見つかりません";

    return (
      <Container maxWidth="md" className="animate-fade-in">
        <Typography variant="h5" fontWeight="900" gutterBottom>記述問題</Typography>
        <Paper sx={{ p: 4, mb: 4, borderRadius: 4 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>{essayQ}</Typography>
          <TextField 
            fullWidth multiline rows={6} 
            placeholder="回答を入力..." 
            value={essayAnswer} 
            onChange={(e) => setEssayAnswer(e.target.value)} 
            disabled={isGrading}
            sx={{ mt: 2 }} 
          />
        </Paper>
        <Button 
          variant="contained" fullWidth size="large" onClick={handleGradeEssay} 
          disabled={!essayAnswer.trim() || isGrading} 
          startIcon={<EditIcon />} 
          sx={{ py: 2, fontWeight: 'bold' }}
        >
          {isGrading ? "採点中..." : "採点する"}
        </Button>
      </Container>
    );
  }

  return null;
};