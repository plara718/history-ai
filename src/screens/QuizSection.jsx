import React, { useState, useMemo, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Button, IconButton, 
  List, ListItem, ListItemText, ListItemSecondaryAction, 
  Chip, Collapse, Grid, Paper, Divider
} from '@mui/material';
import { 
  CheckCircle as CheckIcon, 
  Cancel as CancelIcon, 
  ArrowUpward as ArrowUpIcon, 
  ArrowDownward as ArrowDownIcon,
  NavigateNext as NextIcon,
  CompareArrows as CompareIcon
} from '@mui/icons-material';
import { SafeMarkdown } from '../components/SafeMarkdown';

/**
 * 演習セクションのメインコンポーネント
 * - 整序問題の答え合わせで「自分の順序 vs 正解」を表示
 */
export const QuizSection = ({ lessonData, initialData, onProgress, onComplete }) => {
  const questions = useMemo(() => {
    if (!lessonData || !lessonData.content) return [];
    const q1 = (lessonData.content.true_false || []).map(q => ({ ...q, type: 'tf' }));
    const q2 = (lessonData.content.sort || []).map(q => ({ ...q, type: 'sort' }));
    return [...q1, ...q2];
  }, [lessonData]);

  const [currentIndex, setCurrentIndex] = useState(initialData?.quizIndex || 0);
  const [correctCount, setCorrectCount] = useState(initialData?.quizCorrect || 0);
  
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  
  // ★ 追加: ユーザーの整序回答を保存するステート
  const [userSortOrder, setUserSortOrder] = useState(null);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentIndex]);

  useEffect(() => {
    if (onProgress) {
      onProgress(currentIndex, correctCount);
    }
  }, [currentIndex, correctCount, onProgress]);

  const handleNext = () => {
    const newCorrectCount = correctCount + (isCorrect ? 1 : 0);

    if (isLastQuestion) {
      onComplete({ 
        correct: newCorrectCount, 
        total: questions.length 
      });
    } else {
      if (isCorrect) {
        setCorrectCount(prev => prev + 1);
      }
      setIsAnswered(false);
      setIsCorrect(false);
      setUserSortOrder(null); // リセット
      setCurrentIndex(prev => prev + 1);
    }
  };

  // ★ 修正: 整序問題の場合は、並び順(order)も受け取る
  const handleResult = (result, order = null) => {
    setIsCorrect(result);
    if (order) setUserSortOrder(order); // 整序の並びを保存
    setIsAnswered(true);
  };

  if (!currentQuestion) return null;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip 
          label={`Question ${currentIndex + 1} / ${questions.length}`} 
          color="primary" 
          variant="outlined" 
          size="small" 
          sx={{ fontWeight: 'bold' }}
        />
        <Typography variant="caption" color="text.secondary">
          {currentQuestion.type === 'tf' ? '正誤判定' : '整序問題'}
        </Typography>
      </Box>

      <Card 
        elevation={3} 
        sx={{ 
          borderRadius: 4, 
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'grey.100'
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, lineHeight: 1.6 }}>
            Q. {currentQuestion.q}
          </Typography>

          {!isAnswered ? (
            currentQuestion.type === 'tf' ? (
              <TrueFalseQuestion 
                question={currentQuestion} 
                onAnswer={handleResult} 
              />
            ) : (
              <SortQuestion 
                question={currentQuestion} 
                onAnswer={handleResult} 
              />
            )
          ) : (
            <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="body2" color="text.secondary">回答完了</Typography>
            </Box>
          )}
        </CardContent>

        {/* 解説＆結果エリア */}
        <Collapse in={isAnswered}>
          <Box sx={{ p: 3, bgcolor: isCorrect ? '#f0fdf4' : '#fef2f2', borderTop: '1px solid #eee' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {isCorrect ? (
                <CheckIcon color="success" sx={{ fontSize: 32, mr: 1 }} />
              ) : (
                <CancelIcon color="error" sx={{ fontSize: 32, mr: 1 }} />
              )}
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: isCorrect ? 'success.main' : 'error.main' }}>
                {isCorrect ? 'Correct!' : 'Incorrect...'}
              </Typography>
            </Box>

            {/* ★ 追加: 整序問題の場合の比較表示エリア */}
            {currentQuestion.type === 'sort' && userSortOrder && (
              <Box sx={{ mt: 2, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
                  <CompareIcon sx={{ mr: 1, fontSize: 18 }} /> 回答比較
                </Typography>
                
                <Grid container spacing={2}>
                  {/* 自分の回答 */}
                  <Grid item xs={12} sm={6}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: isCorrect ? '#e6fffa' : '#fff5f5', border: '1px dashed #ccc' }}>
                      <Typography variant="caption" display="block" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
                        あなたの回答
                      </Typography>
                      {userSortOrder.map((idx, i) => (
                        <Box key={i} sx={{ display: 'flex', mb: 0.5, fontSize: '0.9rem' }}>
                           <span style={{ fontWeight: 'bold', marginRight: '8px', color: '#666' }}>{i+1}.</span>
                           {currentQuestion.items[idx]}
                        </Box>
                      ))}
                    </Paper>
                  </Grid>

                  {/* 正解 */}
                  <Grid item xs={12} sm={6}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: '#f0f9ff', border: '1px solid #bae6fd' }}>
                      <Typography variant="caption" display="block" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                        正解の順序
                      </Typography>
                      {currentQuestion.correct_order.map((idx, i) => (
                        <Box key={i} sx={{ display: 'flex', mb: 0.5, fontSize: '0.9rem' }}>
                           <span style={{ fontWeight: 'bold', marginRight: '8px', color: '#0284c7' }}>{i+1}.</span>
                           {currentQuestion.items[idx]}
                        </Box>
                      ))}
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}

            <Box sx={{ mt: 2, bgcolor: 'white', p: 2, borderRadius: 2, border: '1px solid #eee' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 'bold' }}>
                💡 解説・ポイント
              </Typography>
              <SafeMarkdown content={currentQuestion.exp} />
            </Box>

            <Button 
              variant="contained" 
              color="primary" 
              fullWidth 
              size="large"
              endIcon={<NextIcon />}
              onClick={handleNext}
              sx={{ mt: 3, borderRadius: 2, fontWeight: 'bold', py: 1.5 }}
            >
              {isLastQuestion ? '記述問題（Essay）へ挑戦' : '次の問題へ'}
            </Button>
          </Box>
        </Collapse>
      </Card>
    </Box>
  );
};

const TrueFalseQuestion = ({ question, onAnswer }) => {
  const handleSelect = (userSelectBool) => {
    const isTrue = userSelectBool === true;
    const correctIsFirstOption = question.correct === 0; 
    const result = (isTrue && correctIsFirstOption) || (!isTrue && !correctIsFirstOption);
    onAnswer(result);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Button
        variant="outlined"
        color="primary"
        fullWidth
        sx={{ 
          py: 4, borderRadius: 3, border: '2px solid', fontSize: '1.2rem', fontWeight: 'bold',
          '&:hover': { borderWidth: '2px', bgcolor: 'primary.50' }
        }}
        onClick={() => handleSelect(true)}
      >
        ⭕ 正しい
      </Button>
      <Button
        variant="outlined"
        color="error"
        fullWidth
        sx={{ 
          py: 4, borderRadius: 3, border: '2px solid', fontSize: '1.2rem', fontWeight: 'bold',
          '&:hover': { borderWidth: '2px', bgcolor: 'error.50' }
        }}
        onClick={() => handleSelect(false)}
      >
        ❌ 誤り
      </Button>
    </Box>
  );
};

const SortQuestion = ({ question, onAnswer }) => {
  const [order, setOrder] = useState(question.items.map((_, i) => i));

  const moveItem = (index, direction) => {
    const newOrder = [...order];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setOrder(newOrder);
  };

  const handleSubmit = () => {
    const isCorrect = JSON.stringify(order) === JSON.stringify(question.correct_order);
    // ★ 修正: 合否だけでなく、ユーザーの並び順(order)も渡す
    onAnswer(isCorrect, order);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        正しい歴史の順序に並べ替えてください
      </Typography>
      
      <List sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid #eee' }}>
        {order.map((originalIndex, displayIndex) => (
          <ListItem 
            key={originalIndex} 
            divider={displayIndex !== order.length - 1}
            sx={{ bgcolor: 'white' }}
          >
            <ListItemText 
              primary={
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {question.items[originalIndex]}
                </Typography>
              } 
              secondary={`選択肢 ${String.fromCharCode(65 + originalIndex)}`}
            />
            <ListItemSecondaryAction sx={{ display: 'flex', flexDirection: 'column' }}>
              <IconButton 
                size="small" 
                disabled={displayIndex === 0}
                onClick={() => moveItem(displayIndex, -1)}
              >
                <ArrowUpIcon fontSize="small" />
              </IconButton>
              <IconButton 
                size="small"
                disabled={displayIndex === order.length - 1}
                onClick={() => moveItem(displayIndex, 1)}
              >
                <ArrowDownIcon fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Button 
        variant="contained" 
        color="secondary" 
        fullWidth 
        sx={{ mt: 3, borderRadius: 2, fontWeight: 'bold', py: 1.5 }}
        onClick={handleSubmit}
      >
        回答を決定する
      </Button>
    </Box>
  );
};