import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Typography, Container, Paper, Stack, LinearProgress, TextField, Alert,
  List, ListItem, ListItemText, IconButton, Chip, Divider, Grid, Fade
} from '@mui/material';
import { 
  ArrowUpward, ArrowDownward, ChevronRight, Edit as EditIcon,
  CheckCircle, Cancel, HelpOutline, EmojiEvents
} from '@mui/icons-material';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { getTodayString, scrollToTop, validateLessonData } from '../lib/utils';
import { saveLessonStats } from '../lib/stats';

import { useLessonGenerator } from '../hooks/useLessonGenerator';
import { useLessonGrader } from '../hooks/useLessonGrader';

import SmartLoader from '../components/SmartLoader';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { SummaryScreen } from './SummaryScreen';

export const LessonScreen = ({ 
  apiKey, userId, learningMode, difficulty, selectedUnit, 
  sessionNum, currentProgress, reviewContext, onExit 
}) => {
  const [step, setStep] = useState('loading');
  const [lessonData, setLessonData] = useState(null);
  
  const { generateDailyLesson, fetchTodayLesson, isProcessing, genError } = useLessonGenerator(apiKey, userId);
  const { gradeLesson, isGrading, gradeError } = useLessonGrader(apiKey, userId);

  const [quizList, setQuizList] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [userQuizAnswers, setUserQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState([]);
  const [essayAnswer, setEssayAnswer] = useState("");
  const [gradingResult, setGradingResult] = useState(null);

  // ★追加: 回答直後の解説表示モード管理
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentFeedbackData, setCurrentFeedbackData] = useState(null);

  useEffect(() => {
    const initLesson = async () => {
      if (!userId || !sessionNum) return;
      setStep('loading');
      let data = await fetchTodayLesson(sessionNum);

      if (!data) {
        if (!apiKey) { alert("APIキー未設定"); onExit(); return; }
        data = await generateDailyLesson(learningMode, difficulty, selectedUnit, sessionNum, reviewContext);
      }

      if (data) {
        const validatedData = validateLessonData(data);
        setLessonData(validatedData);
        prepareQuizList(validatedData);

        if (validatedData.completed) {
          setQuizResults(validatedData.quizResults || []);
          setGradingResult(validatedData.gradingResult || null);
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
  }, [sessionNum]); 

  const prepareQuizList = (data) => {
    const target = data.content || data;
    if (!target) return;

    const tf = (target.true_false || []).map(q => ({ ...q, type: 'tf' }));
    const sort = (target.sort || []).map(q => ({ 
      ...q, 
      type: 'sort', 
      initialOrder: q.items ? q.items.map((_, i) => i) : []
    }));
    setQuizList([...tf, ...sort]);
  };

  const handleStartQuiz = () => { setStep('quiz'); scrollToTop(); };

  // TF回答時は即時判定へ
  const handleTFAnswer = (val) => {
    // state更新
    setUserQuizAnswers(prev => ({ ...prev, [quizIndex]: val }));
    // 即時提出処理へ (引数で値を渡す)
    handleSubmitAnswer(val);
  };

  const moveSortItem = (currentIndex, direction) => {
    if (showFeedback) return; // 解説中は操作不可
    setUserQuizAnswers(prev => {
      const currentOrder = prev[quizIndex] || [...quizList[quizIndex].initialOrder];
      const newOrder = [...currentOrder];
      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return prev;
      [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
      return { ...prev, [quizIndex]: newOrder };
    });
  };

  // 回答を確定して解説を表示する (Nextには進まない)
  const handleSubmitAnswer = (directVal = null) => {
    const q = quizList[quizIndex];
    // TFの場合は引数を使用、Sortの場合はStateを使用
    const userAns = (q.type === 'tf' && directVal !== null) ? directVal : userQuizAnswers[quizIndex];
    
    let isCorrect = false;
    let detailData = {}; 

    if (q.type === 'tf') {
      const isTrue = (q.correct === 0);
      isCorrect = (userAns === isTrue);
      detailData = {
        userSelection: userAns, 
        correctSelection: isTrue
      };
    } else if (q.type === 'sort') {
      const currentOrder = userAns || q.initialOrder;
      isCorrect = JSON.stringify(currentOrder) === JSON.stringify(q.correct_order);
      detailData = {
        userOrder: currentOrder,
        correctOrder: q.correct_order,
        items: q.items 
      };
    }

    // 結果を保存
    const newResult = { 
      q: q.q, 
      is_correct: isCorrect, 
      exp: q.exp, 
      type: q.type,
      tags: [q.intention_tag],
      ...detailData
    };

    setQuizResults(prev => [...prev, newResult]);
    
    // 解説モードON
    setCurrentFeedbackData(newResult);
    setShowFeedback(true);
    scrollToTop();
  };

  // 次の問題へ進む (解説確認後にユーザーが押す)
  const handleMoveToNextQuestion = () => {
    setShowFeedback(false);
    setCurrentFeedbackData(null);

    if (quizIndex < quizList.length - 1) {
      setQuizIndex(quizIndex + 1);
      scrollToTop();
    } else {
      setStep('essay');
      scrollToTop();
    }
  };

  const handleGradeEssay = async () => {
    if (!essayAnswer.trim()) return;
    
    const result = await gradeLesson(lessonData, essayAnswer, learningMode);

    if (result) {
      setGradingResult(result);
      const today = getTodayString();
      
      const quizCorrect = quizResults.filter(q => q.is_correct).length;
      const quizTotal = quizResults.length;
      const essayScore = result.score || 0;

      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`), {
        quizResults, 
        gradingResult: result, 
        essayAnswer, 
        scores: {
            quizCorrect,
            quizTotal,
            essayScore,
            essayTotal: 10,
            nextAction: result.recommended_action
        },
        completed: true, 
        completedAt: new Date().toISOString()
      }, { merge: true });

      await saveLessonStats(userId, lessonData, quizResults, result);
      setStep('summary');
    }
  };
  
  if (isProcessing || isGrading || step === 'loading') {
    return <SmartLoader message={isProcessing ? "AIが授業を生成中..." : isGrading ? "AIが採点中..." : "データを読み込み中..."} />;
  }
  
  if (step === 'error' || genError || gradeError) {
    return (
      <Container>
        <Alert severity="error" sx={{ mb: 2 }}>{genError || gradeError || "データの読み込みに失敗しました。"}</Alert>
        <Button onClick={onExit} variant="outlined">ホームに戻る</Button>
      </Container>
    );
  }

  if (step === 'summary') {
    return <SummaryScreen lessonData={lessonData} gradingResult={gradingResult} quizResults={quizResults} onFinish={onExit} />;
  }

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

  // --- クイズ画面 (解説表示対応) ---
  if (step === 'quiz') {
    const q = quizList[quizIndex];
    if (!q) return null; 
    const progress = ((quizIndex) / quizList.length) * 100;

    return (
      <Container maxWidth="sm" className="animate-fade-in" sx={{ py: 4 }}>
        <LinearProgress variant="determinate" value={progress} sx={{ mb: 2, borderRadius: 2 }} />
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" fontWeight="bold" color="text.secondary">
            Q{quizIndex + 1}. {q.type === 'tf' ? '正誤判定' : '並べ替え'}
          </Typography>
          <Chip label={`残り ${quizList.length - quizIndex}問`} size="small" variant="outlined" />
        </Box>
        
        <Paper sx={{ p: 3, my: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight="bold">{q.q}</Typography>
        </Paper>

        {/* --- 回答エリア (解説中は非表示 or 無効化) --- */}
        {!showFeedback ? (
          <Fade in={!showFeedback}>
            <Box>
              {q.type === 'tf' ? (
                <Stack direction="row" spacing={2}>
                  {[true, false].map(val => (
                    <Button 
                      key={val.toString()} fullWidth variant="outlined"
                      color={val ? "primary" : "error"} onClick={() => handleTFAnswer(val)}
                      sx={{ py: 3, fontSize: '1.2rem', fontWeight: 'bold', borderRadius: 3, border: '2px solid' }}
                    >
                      {val ? "⭕ 正しい" : "❌ 誤り"}
                    </Button>
                  ))}
                </Stack>
              ) : (
                <Box>
                  <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
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
                  <Button variant="contained" fullWidth size="large" onClick={() => handleSubmitAnswer()} sx={{ py: 2, fontWeight: 'bold' }}>決定して解説を見る</Button>
                </Box>
              )}
            </Box>
          </Fade>
        ) : (
          /* --- 解説フィードバックエリア --- */
          <Fade in={showFeedback}>
            <Box>
              {/* 正誤結果 */}
              <Alert 
                severity={currentFeedbackData?.is_correct ? "success" : "error"}
                icon={currentFeedbackData?.is_correct ? <CheckCircle fontSize="large"/> : <Cancel fontSize="large"/>}
                sx={{ 
                  mb: 2, borderRadius: 3, alignItems: 'center', 
                  '& .MuiAlert-message': { width: '100%' }
                }}
              >
                <Typography variant="h6" fontWeight="900">
                  {currentFeedbackData?.is_correct ? "Correct!" : "Incorrect..."}
                </Typography>
              </Alert>

              {/* 比較表示 (LogScreenと同じUI) */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: 'background.default' }}>
                 {q.type === 'tf' && (
                   <Grid container spacing={2}>
                     <Grid item xs={6}>
                       <Typography variant="caption" color="text.secondary">あなたの回答</Typography>
                       <Typography fontWeight="bold" color={currentFeedbackData?.userSelection ? 'primary.main' : 'error.main'}>
                         {currentFeedbackData?.userSelection ? '⭕ 正しい' : '❌ 誤り'}
                       </Typography>
                     </Grid>
                     <Grid item xs={6}>
                       <Typography variant="caption" color="text.secondary">正解</Typography>
                       <Typography fontWeight="bold" color={currentFeedbackData?.correctSelection ? 'primary.main' : 'error.main'}>
                         {currentFeedbackData?.correctSelection ? '⭕ 正しい' : '❌ 誤り'}
                       </Typography>
                     </Grid>
                   </Grid>
                 )}
                 {q.type === 'sort' && currentFeedbackData?.items && (
                   <Grid container spacing={2}>
                     <Grid item xs={12} sm={6}>
                       <Typography variant="caption" color="text.secondary" display="block" mb={1}>あなたの回答</Typography>
                       {currentFeedbackData.userOrder.map((idx, i) => (
                         <Box key={i} sx={{ display: 'flex', fontSize: '0.85rem', mb: 0.5 }}>
                           <Typography variant="caption" fontWeight="bold" sx={{ width: 20, color: 'text.secondary' }}>{i+1}.</Typography>
                           <Typography variant="body2" noWrap>{currentFeedbackData.items[idx]}</Typography>
                         </Box>
                       ))}
                     </Grid>
                     <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>正解</Typography>
                        {currentFeedbackData.correctOrder.map((idx, i) => (
                         <Box key={i} sx={{ display: 'flex', fontSize: '0.85rem', mb: 0.5 }}>
                           <Typography variant="caption" fontWeight="bold" sx={{ width: 20, color: 'success.main' }}>{i+1}.</Typography>
                           <Typography variant="body2" noWrap>{currentFeedbackData.items[idx]}</Typography>
                         </Box>
                       ))}
                     </Grid>
                   </Grid>
                 )}
              </Paper>

              {/* 解説本文 */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'white', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold" display="flex" alignItems="center" gutterBottom>
                  <HelpOutline sx={{ mr: 1 }} fontSize="small" /> 解説
                </Typography>
                <SafeMarkdown content={q.exp} />
              </Box>

              <Button 
                variant="contained" fullWidth size="large" 
                onClick={handleMoveToNextQuestion} 
                endIcon={<ChevronRight />}
                sx={{ py: 2, fontWeight: 'bold', boxShadow: 3 }}
              >
                次の問題へ進む
              </Button>
            </Box>
          </Fade>
        )}
      </Container>
    );
  }

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