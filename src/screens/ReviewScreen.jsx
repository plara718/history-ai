import React from 'react';
import { 
  Box, Button, Typography, Paper, Container, Stack, Chip, Alert, Divider, 
  Grid, Fade
} from '@mui/material';
import { 
  CheckCircle, 
  Cancel,
  ChevronRight, 
  ArrowForward as ArrowRight
} from '@mui/icons-material';
import { SafeMarkdown } from '../components/SafeMarkdown';

const ReviewScreen = ({ 
  qIndex, 
  reviewProblems, 
  isAnswered, 
  reviewResult, 
  reviewUserAnswer, 
  setReviewUserAnswer, 
  handleReviewAnswer, 
  nextReviewQuestion 
}) => {
  // ガード: データがない場合
  if (!reviewProblems || !reviewProblems[qIndex]) return null;

  const currentQ = reviewProblems[qIndex];
  const totalQ = reviewProblems.length;
  
  // 問題タイプ判定
  const isSort = currentQ.type === 'sort' || (currentQ.items && currentQ.items.length > 0);
  const isTF = !isSort;
  
  // 整序問題用アイテム
  const items = currentQ.items || [];
  
  // 解説テキスト
  const explanation = currentQ.exp || currentQ.explanation || "解説データがありません。";

  // --- ハンドラー ---

  // 整序問題: 選択肢トグル
  const handleSortToggle = (itemIndex) => {
    if (isAnswered) return;
    
    const currentOrder = Array.isArray(reviewUserAnswer) ? [...reviewUserAnswer] : [];
    
    if (currentOrder.includes(itemIndex)) {
      // 選択解除
      const newOrder = currentOrder.filter(i => i !== itemIndex);
      setReviewUserAnswer(newOrder);
    } else {
      // 選択追加
      const newOrder = [...currentOrder, itemIndex];
      setReviewUserAnswer(newOrder);
    }
  };

  // 正誤問題: 回答送信
  const handleTFSubmit = (selectedBool) => {
    if (isAnswered) return;
    handleReviewAnswer(selectedBool);
  };

  return (
    <Container maxWidth="sm" sx={{ pb: 10, pt: 2 }} className="animate-fade-in">
       <Box mb={4} textAlign="center">
          <Typography variant="overline" fontWeight="bold" color="text.secondary" letterSpacing={1.5}>
              WEAKNESS DRILL {qIndex + 1} / {totalQ}
          </Typography>
          <Typography variant="h6" fontWeight="900" color="primary" sx={{ mt: 0.5 }}>
              {currentQ.theme || "復習チャレンジ"}
          </Typography>
      </Box>

      {/* 問題カード */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 3, sm: 4 }, 
          borderRadius: 3,
          bgcolor: 'white', 
          border: '1px solid', 
          borderColor: 'divider', 
          mb: 4 
        }}
      >
          <Chip 
              label={isSort ? '歴史整序' : '正誤判定'} 
              size="small" 
              color={isSort ? "secondary" : "warning"}
              sx={{ fontWeight: 'bold', mb: 2, borderRadius: 1.5 }} 
          />
          <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.6 }}>
              {currentQ.q}
          </Typography>
      </Paper>

      <Box mb={4}>
          {isTF ? (
              // --- 正誤問題 (True/False) ---
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                      fullWidth
                      variant={isAnswered && reviewUserAnswer === true ? "contained" : "outlined"}
                      color={isAnswered ? (reviewResult ? "success" : "error") : "primary"}
                      onClick={() => handleTFSubmit(true)}
                      disabled={isAnswered}
                      startIcon={isAnswered && reviewUserAnswer === true ? (reviewResult ? <CheckCircle/> : <Cancel/>) : null}
                      sx={{ 
                          py: 2, borderRadius: 3, 
                          fontSize: '1.1rem', fontWeight: 'bold',
                          borderWidth: 2,
                          '&:hover': { borderWidth: 2 }
                      }}
                  >
                       ⭕ 正しい
                  </Button>

                  <Button
                      fullWidth
                      variant={isAnswered && reviewUserAnswer === false ? "contained" : "outlined"}
                      color={isAnswered ? (reviewResult ? "success" : "error") : "error"}
                      onClick={() => handleTFSubmit(false)}
                      disabled={isAnswered}
                      startIcon={isAnswered && reviewUserAnswer === false ? (reviewResult ? <CheckCircle/> : <Cancel/>) : null}
                      sx={{ 
                          py: 2, borderRadius: 3, 
                          fontSize: '1.1rem', fontWeight: 'bold',
                          borderWidth: 2,
                          borderColor: !isAnswered ? 'error.main' : undefined,
                          color: !isAnswered ? 'error.main' : undefined,
                          '&:hover': { borderWidth: 2, bgcolor: 'error.50' }
                      }}
                  >
                       ❌ 誤り
                  </Button>
              </Stack>
          ) : (
              // --- 整序問題 (Sort) ---
              <Box>
                  {/* 選択エリア */}
                  <Box 
                    mb={3} p={2} 
                    bgcolor="grey.50" borderRadius={3} 
                    border="1px dashed" borderColor="grey.300"
                    minHeight={80} 
                  >
                      {(!reviewUserAnswer || reviewUserAnswer.length === 0) && (
                          <Typography variant="body2" color="text.disabled" width="100%" textAlign="center" py={2}>
                            下の選択肢を順番にタップしてください
                          </Typography>
                      )}
                      
                      <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
                        {(reviewUserAnswer || []).map((itemIndex, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <ArrowRight fontSize="small" sx={{ color: 'text.disabled' }} />}
                                <Chip 
                                  label={`${String.fromCharCode(65 + itemIndex)}. ${items[itemIndex]}`}
                                  onDelete={!isAnswered ? () => handleSortToggle(itemIndex) : undefined}
                                  color="primary" 
                                  variant="filled"
                                  sx={{ fontWeight: 'bold' }}
                                />
                            </React.Fragment>
                        ))}
                      </Box>
                  </Box>

                  {/* 候補エリア */}
                  <Grid container spacing={1} justifyContent="center" mb={4}>
                      {items.map((item, i) => {
                          const isSelected = (reviewUserAnswer || []).includes(i);
                          return (
                            <Grid item xs={12} sm={6} key={i}>
                                <Button
                                    fullWidth
                                    variant={isSelected ? "contained" : "outlined"}
                                    color={isSelected ? "inherit" : "primary"}
                                    onClick={() => handleSortToggle(i)} 
                                    disabled={isAnswered || isSelected}
                                    sx={{ 
                                      justifyContent: 'flex-start',
                                      py: 1.5, px: 2, borderRadius: 2, 
                                      fontWeight: 'bold', textTransform: 'none',
                                      bgcolor: isSelected ? 'action.disabledBackground' : 'white',
                                      borderColor: isSelected ? 'transparent' : 'divider'
                                    }}
                                >
                                    <Typography variant="caption" sx={{ mr: 1, fontWeight: 'bold', minWidth: 20, color: 'text.secondary' }}>
                                      {String.fromCharCode(65 + i)}.
                                    </Typography>
                                    <Typography variant="body2" noWrap color="text.primary">
                                      {item}
                                    </Typography>
                                </Button>
                            </Grid>
                          );
                      })}
                  </Grid>

                  {!isAnswered && (
                      <Button 
                          variant="contained" 
                          fullWidth 
                          size="large"
                          onClick={() => handleReviewAnswer(reviewUserAnswer)}
                          disabled={!reviewUserAnswer || reviewUserAnswer.length !== items.length}
                          sx={{ py: 1.5, borderRadius: 3, fontWeight: 'bold', boxShadow: 2 }}
                      >
                          回答を決定する
                      </Button>
                  )}
              </Box>
          )}
      </Box>

      {/* --- 結果表示エリア --- */}
      {isAnswered && (
          <Fade in={true}>
            <Box>
              <Alert 
                  severity={reviewResult ? "success" : "error"} 
                  icon={reviewResult ? <CheckCircle fontSize="inherit" /> : <Cancel fontSize="inherit" />}
                  sx={{ mb: 3, borderRadius: 3, fontWeight: 'bold', fontSize: '1rem', py: 1.5 }}
              >
                  {reviewResult ? "正解！素晴らしい理解力です。" : "不正解... 解説を確認しましょう。"}
              </Alert>

              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid', borderColor: '#e2e8f0', mb: 4 }}>
                  
                  {isSort && !reviewResult && currentQ.correct_order && (
                      <Box mb={3} p={2} bgcolor="white" borderRadius={2} border="1px solid" borderColor="success.light">
                           <Typography variant="caption" display="block" color="success.main" fontWeight="bold" mb={1}>
                                正しい順序:
                           </Typography>
                           <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
                               {currentQ.correct_order.map((idx, i) => (
                                   <React.Fragment key={i}>
                                       {i > 0 && <ArrowRight fontSize="small" sx={{ color: 'success.main' }} />}
                                       <Chip 
                                           size="small"
                                           label={`${String.fromCharCode(65 + idx)}. ${items[idx]}`}
                                           sx={{ fontWeight: 'bold', bgcolor: 'success.50', color: 'success.dark', border: '1px solid', borderColor: 'success.200' }}
                                       />
                                   </React.Fragment>
                               ))}
                           </Box>
                      </Box>
                  )}
                  
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      💡 解説・ポイント
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ color: '#334155', lineHeight: 1.8 }}>
                      <SafeMarkdown content={explanation} />
                  </Box>
              </Paper>

              <Button 
                  variant="contained" 
                  fullWidth 
                  size="large" 
                  onClick={nextReviewQuestion}
                  sx={{ 
                    py: 2, borderRadius: 3, fontWeight: 'bold',
                    boxShadow: 3,
                    background: 'linear-gradient(to right, #2563eb, #3b82f6)'
                  }}
                  endIcon={<ChevronRight />}
              >
                  {qIndex < totalQ - 1 ? "次の問題へ" : "結果を見る"}
              </Button>
            </Box>
          </Fade>
      )}
    </Container>
  );
};

export default ReviewScreen;