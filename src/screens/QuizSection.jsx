import React, { useState, useMemo, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Button, IconButton, 
  List, ListItem, ListItemText, ListItemSecondaryAction, 
  Chip, Collapse, Grid, Paper, Fade, Stack 
} from '@mui/material';
import { 
  CheckCircle as CheckIcon, 
  Cancel as CancelIcon, 
  ArrowUpward as ArrowUpIcon, 
  ArrowDownward as ArrowDownIcon,
  NavigateNext as NextIcon,
  CompareArrows as CompareIcon,
  HelpOutline as QuestionIcon,
  SwapVert as SortIcon
} from '@mui/icons-material';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { scrollToTop } from '../lib/utils';

/**
 * 演習セクションのメインコンポーネント
 */
export const QuizSection = ({ lessonData, initialData, onProgress, onComplete }) => {
  // 問題リストの構築
  const questions = useMemo(() => {
    if (!lessonData || !lessonData.content) return [];
    
    // 正誤問題 (True/False)
    const tfList = (lessonData.content.true_false || []).map(q => ({ 
      ...q, 
      type: 'tf',
      // AI生成データの揺らぎ吸収: correctが数値でない場合のフォールバック
      correctIndex: typeof q.correct === 'number' ? q.correct : 0 
    }));
    
    // 整序問題 (Sort)
    const sortList = (lessonData.content.sort || []).map(q => ({ 
      ...q, 
      type: 'sort',
      correctOrder: q.correct_order || q.items.map((_, i) => i) 
    }));
    
    return [...tfList, ...sortList];
  }, [lessonData]);

  // ステート管理
  const [currentIndex, setCurrentIndex] = useState(initialData?.quizIndex || 0);
  const [correctCount, setCorrectCount] = useState(initialData?.quizCorrect || 0);
  
  // 回答状態
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  
  // 結果の詳細保持用 (Stats統計に使う)
  const [resultsLog, setResultsLog] = useState([]); // [{is_correct, tags...}, ...]

  // ユーザーの回答記録 (整序の比較表示用)
  const [userSortOrder, setUserSortOrder] = useState(null);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  // ページ切り替え時にトップへ
  useEffect(() => {
    scrollToTop();
  }, [currentIndex]);

  // 進捗報告
  useEffect(() => {
    if (onProgress) {
      onProgress(currentIndex, correctCount);
    }
  }, [currentIndex, correctCount, onProgress]);

  // 次の問題へ
  const handleNext = () => {
    // 現在の結果をログに追加
    const newResultLog = [
      ...resultsLog,
      {
        is_correct: isCorrect,
        tags: [currentQuestion.intention_tag], // 統計用タグ
        question_type: currentQuestion.type
      }
    ];
    setResultsLog(newResultLog);

    if (isLastQuestion) {
      // 完了通知: 結果詳細も一緒に渡す
      onComplete({ 
        correct: correctCount + (isCorrect ? 1 : 0), 
        total: questions.length,
        results: newResultLog
      });
    } else {
      // カウントアップ
      if (isCorrect) {
        setCorrectCount(prev => prev + 1);
      }
      
      // 状態リセット
      setIsAnswered(false);
      setIsCorrect(false);
      setUserSortOrder(null);
      setCurrentIndex(prev => prev + 1);
    }
  };

  // 回答受信ハンドラ
  const handleAnswerReceived = (resultBool, order = null) => {
    setIsCorrect(resultBool);
    if (order) setUserSortOrder(order);
    setIsAnswered(true);
  };

  if (!currentQuestion) return null;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: { xs: 2, md: 0 } }}>
      <Fade in={true} timeout={500}>
        <Box>
          {/* ヘッダー情報 */}
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Chip 
              label={`Q.${currentIndex + 1} / ${questions.length}`} 
              color="primary" 
              size="small" 
              sx={{ fontWeight: 'bold', borderRadius: 2 }}
            />
            <Stack direction="row" alignItems="center" spacing={1}>
               {currentQuestion.type === 'tf' ? <QuestionIcon fontSize="small" color="action"/> : <SortIcon fontSize="small" color="action"/>}
               <Typography variant="caption" color="text.secondary" fontWeight="bold">
                 {currentQuestion.type === 'tf' ? '正誤判定 (True/False)' : '歴史整序 (Timeline)'}
               </Typography>
            </Stack>
          </Box>

          <Card 
            elevation={0} 
            sx={{ 
              borderRadius: 4, 
              overflow: 'visible', // バッジ等がはみ出るのを許可
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 4, lineHeight: 1.6 }}>
                {currentQuestion.q}
              </Typography>

              {!isAnswered ? (
                /* --- 回答モード --- */
                <Box>
                  {currentQuestion.type === 'tf' ? (
                    <TrueFalseQuestion 
                      question={currentQuestion} 
                      onAnswer={handleAnswerReceived} 
                    />
                  ) : (
                    <SortQuestion 
                      question={currentQuestion} 
                      onAnswer={handleAnswerReceived} 
                    />
                  )}
                </Box>
              ) : (
                /* --- 回答済み表示 (シンプル) --- */
                <Box sx={{ textAlign: 'center', py: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">
                      Answered
                    </Typography>
                </Box>
              )}
            </CardContent>

            {/* --- 解説＆結果エリア (Collapse) --- */}
            <Collapse in={isAnswered}>
              <Box 
                sx={{ 
                  p: { xs: 3, md: 4 }, 
                  bgcolor: isCorrect ? 'success.50' : 'error.50', 
                  borderTop: '1px solid',
                  borderColor: isCorrect ? 'success.200' : 'error.200'
                }}
              >
                {/* 判定結果ヘッダー */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  {isCorrect ? (
                    <CheckIcon color="success" sx={{ fontSize: 32, mr: 1.5 }} />
                  ) : (
                    <CancelIcon color="error" sx={{ fontSize: 32, mr: 1.5 }} />
                  )}
                  <Typography variant="h5" sx={{ fontWeight: '900', color: isCorrect ? 'success.main' : 'error.main' }}>
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                  </Typography>
                </Box>

                {/* 整序比較エリア (間違った場合のみ表示、または正解でも確認用に表示) */}
                {currentQuestion.type === 'sort' && userSortOrder && (
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, mb: 3, borderRadius: 3,
                      bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider'
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                      <CompareIcon sx={{ mr: 1, fontSize: 18 }} /> 回答比較
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: isCorrect ? 'success.50' : 'error.50', height: '100%' }}>
                          <Typography variant="caption" display="block" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
                            あなたの回答
                          </Typography>
                          {userSortOrder.map((itemIndex, i) => (
                            <Box key={i} sx={{ display: 'flex', mb: 0.5, fontSize: '0.85rem' }}>
                               <Typography variant="caption" sx={{ fontWeight: 'bold', mr: 1, width: 20, color: 'text.secondary' }}>{i+1}.</Typography>
                               {currentQuestion.items[itemIndex]}
                            </Box>
                          ))}
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'info.50', height: '100%' }}>
                          <Typography variant="caption" display="block" sx={{ fontWeight: 'bold', color: 'info.main', mb: 1 }}>
                            正解の順序
                          </Typography>
                          {currentQuestion.correctOrder.map((itemIndex, i) => (
                            <Box key={i} sx={{ display: 'flex', mb: 0.5, fontSize: '0.85rem' }}>
                               <Typography variant="caption" sx={{ fontWeight: 'bold', mr: 1, width: 20, color: 'info.main' }}>{i+1}.</Typography>
                               {currentQuestion.items[itemIndex]}
                            </Box>
                          ))}
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                )}

                {/* 解説本文 */}
                <Box sx={{ bgcolor: 'white', p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                    💡 解説・ポイント
                  </Typography>
                  <SafeMarkdown content={currentQuestion.exp} />
                </Box>

                {/* 次へボタン */}
                <Button 
                  variant="contained" 
                  color="primary" 
                  fullWidth 
                  size="large"
                  endIcon={<NextIcon />}
                  onClick={handleNext}
                  sx={{ 
                    mt: 4, py: 2, borderRadius: 3, fontWeight: 'bold',
                    boxShadow: 3
                  }}
                >
                  {isLastQuestion ? '記述問題（Essay）へ挑戦' : '次の問題へ'}
                </Button>
              </Box>
            </Collapse>
          </Card>
        </Box>
      </Fade>
    </Box>
  );
};

/**
 * サブコンポーネント: 正誤問題フォーム
 */
const TrueFalseQuestion = ({ question, onAnswer }) => {
  // 選択肢インデックスで判定 (0=True, 1=False が一般的だが、options配列の順序に依存)
  // utils.jsの生成ロジックでは options: ["True", "False"] となり、correct: 0 (True) または 1 (False)
  
  const handleSelect = (selectedIndex) => {
    const isCorrect = selectedIndex === question.correctIndex;
    onAnswer(isCorrect);
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <Button
        variant="outlined"
        fullWidth
        onClick={() => handleSelect(0)}
        sx={{ 
          py: 3, borderRadius: 3, border: '2px solid', 
          borderColor: 'primary.main', color: 'primary.main',
          fontSize: '1.1rem', fontWeight: 'bold',
          transition: 'all 0.2s',
          '&:hover': { borderWidth: '2px', bgcolor: 'primary.50', transform: 'translateY(-2px)' }
        }}
      >
        ⭕ 正しい (True)
      </Button>
      <Button
        variant="outlined"
        fullWidth
        onClick={() => handleSelect(1)}
        sx={{ 
          py: 3, borderRadius: 3, border: '2px solid',
          borderColor: 'error.main', color: 'error.main',
          fontSize: '1.1rem', fontWeight: 'bold',
          transition: 'all 0.2s',
          '&:hover': { borderWidth: '2px', bgcolor: 'error.50', transform: 'translateY(-2px)' }
        }}
      >
        ❌ 誤り (False)
      </Button>
    </Stack>
  );
};

/**
 * サブコンポーネント: 整序問題フォーム
 */
const SortQuestion = ({ question, onAnswer }) => {
  // 初期状態: 0,1,2,3... (AI生成順、つまりランダム順になっている前提)
  // ただしutils.jsでitemsがシャッフルされていない場合を考慮し、
  // ここでは初期表示をシャッフルすべきだが、AIが生成時にシャッフル済みと仮定する
  const [order, setOrder] = useState(question.items.map((_, i) => i));

  const moveItem = (currentIndex, direction) => {
    const newOrder = [...order];
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    // Swap
    [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
    setOrder(newOrder);
  };

  const handleSubmit = () => {
    // 配列の比較 (JSON文字列化が簡易)
    const isCorrect = JSON.stringify(order) === JSON.stringify(question.correctOrder);
    onAnswer(isCorrect, order);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 'bold' }}>
        正しい歴史の順序に並べ替えてください (上から順)
      </Typography>
      
      <List sx={{ bgcolor: 'background.paper', borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        {order.map((itemIndex, listIndex) => (
          <ListItem 
            key={itemIndex} 
            divider={listIndex !== order.length - 1}
            sx={{ 
              bgcolor: 'white', 
              transition: 'background-color 0.2s',
              '&:hover': { bgcolor: 'grey.50' }
            }}
          >
            <ListItemText 
              primary={
                <Typography variant="body1" sx={{ fontWeight: 'medium', color: 'text.primary' }}>
                  {question.items[itemIndex]}
                </Typography>
              } 
              secondary={
                <Typography variant="caption" color="text.disabled" fontWeight="bold">
                  {String.fromCharCode(65 + itemIndex)} {/* A, B, C... */}
                </Typography>
              }
            />
            <ListItemSecondaryAction sx={{ display: 'flex', flexDirection: 'column' }}>
              <IconButton 
                size="small" 
                disabled={listIndex === 0}
                onClick={() => moveItem(listIndex, -1)}
                sx={{ color: 'primary.main' }}
              >
                <ArrowUpIcon fontSize="small" />
              </IconButton>
              <IconButton 
                size="small"
                disabled={listIndex === order.length - 1}
                onClick={() => moveItem(listIndex, 1)}
                sx={{ color: 'primary.main' }}
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
        size="large"
        sx={{ mt: 4, borderRadius: 3, fontWeight: 'bold', py: 1.5, boxShadow: 2 }}
        onClick={handleSubmit}
      >
        回答を決定する
      </Button>
    </Box>
  );
};