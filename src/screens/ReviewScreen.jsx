import React from 'react';
import { Box, Button, Typography, Paper, Container, Stack, Chip, Alert, Divider } from '@mui/material';
import { CheckCircle, Warning as AlertTriangle, ChevronRight, ArrowForward as ArrowRight, Check, Close as X } from '@mui/icons-material';
import { SafeMarkdown } from '../components/SafeMarkdown'; // MarkdownLiteの代わりにSafeMarkdownを使用

const ReviewScreen = ({ 
  qIndex, reviewProblems, isAnswered, reviewResult, 
  reviewUserAnswer, setReviewUserAnswer, 
  handleReviewAnswer, nextReviewQuestion 
}) => {
  if (!reviewProblems || !reviewProblems[qIndex]) return null;

  const currentQ = reviewProblems[qIndex];
  const totalQ = reviewProblems.length;
  
  // 新データ構造への対応
  const isSort = currentQ.type === 'sort';
  const isTF = currentQ.type === 'tf' || currentQ.type === 'true_false'; // 互換性のため両方チェック
  
  // 整序問題用
  const items = currentQ.items || [];
  
  // 解説テキストの取得
  const explanation = currentQ.exp || currentQ.explanation || "解説がありません。";

  // 整序問題の操作ロジック
  const handleSortToggle = (itemIndex) => {
    if (isAnswered) return;
    const currentOrder = Array.isArray(reviewUserAnswer) ? reviewUserAnswer : [];
    let newOrder;
    if (currentOrder.includes(itemIndex)) {
        newOrder = currentOrder.filter(i => i !== itemIndex);
    } else {
        newOrder = [...currentOrder, itemIndex];
    }
    setReviewUserAnswer(newOrder);
  };

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 10 }}>
       <Box mb={3} textAlign="center">
          <Typography variant="caption" fontWeight="bold" color="text.secondary">
              弱点克服モード {qIndex + 1} / {totalQ}
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" color="primary">
              {currentQ.theme || "復習"}
          </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, bgcolor: 'white', border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <Chip 
              label={isSort ? '整序問題' : '正誤判定'} 
              size="small" 
              color="warning"
              sx={{ fontWeight: 'bold', mb: 2 }} 
          />
          <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.6 }}>
              {currentQ.q}
          </Typography>
      </Paper>

      <Box mb={4}>
          {isTF ? (
              // --- 正誤問題 (True/False) ---
              <Stack direction="row" spacing={2}>
                  {[true, false].map((val, i) => {
                      // 0=True, 1=False と仮定 (QuizSection準拠)
                      // ただし reviewUserAnswer が boolean で来る場合と 0/1 で来る場合を吸収
                      const optionValue = i === 0; // true or false
                      const isSelected = reviewUserAnswer === optionValue;
                      
                      // 正解判定ロジック (currentQ.correct は 0=True, 1=False)
                      const isCorrectOption = (i === 0 && currentQ.correct === 0) || (i === 1 && currentQ.correct === 1);

                      let bg = 'white';
                      let borderColor = '#e2e8f0'; // slate-200
                      
                      if (isAnswered) {
                          if (isCorrectOption) { bg = '#ecfdf5'; borderColor = '#10b981'; } // emerald
                          else if (isSelected) { bg = '#fff1f2'; borderColor = '#f43f5e'; } // rose
                      }

                      return (
                          <Button
                              key={i}
                              fullWidth
                              variant="outlined"
                              onClick={() => !isAnswered && handleReviewAnswer(optionValue)}
                              sx={{ 
                                  py: 4, borderRadius: 3, border: '2px solid', 
                                  fontSize: '1.2rem', fontWeight: 'bold',
                                  bgcolor: isAnswered ? undefined : bg,
                                  borderColor: isAnswered ? undefined : borderColor,
                                  color: isAnswered && isCorrectOption ? '#047857' : isAnswered && isSelected ? '#be123c' : 'inherit',
                                  '&:hover': { borderWidth: '2px' }
                              }}
                          >
                               {val ? "⭕ 正しい" : "❌ 誤り"}
                          </Button>
                      );
                  })}
              </Stack>
          ) : (
              // --- 整序問題 (Sort) ---
              <Box>
                  <Box mb={2} p={2} bgcolor="#f1f5f9" borderRadius={2} minHeight={60} display="flex" flexWrap="wrap" gap={1} alignItems="center">
                      {(!reviewUserAnswer || reviewUserAnswer.length === 0) && (
                          <Typography variant="caption" color="text.disabled">下の選択肢を順番にタップしてください</Typography>
                      )}
                      {(reviewUserAnswer || []).map((idx, i) => (
                          <React.Fragment key={i}>
                              {i > 0 && <ArrowRight fontSize="small" sx={{ color: '#94a3b8' }} />}
                              <Chip 
                                label={`${String.fromCharCode(65 + idx)}. ${items[idx]}`}
                                onDelete={!isAnswered ? () => handleSortToggle(idx) : undefined}
                                color="primary" 
                                variant={isAnswered ? "filled" : "outlined"}
                                sx={{ bgcolor: 'white' }}
                              />
                          </React.Fragment>
                      ))}
                  </Box>

                  <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="center" mb={2}>
                      {items.map((item, i) => (
                          <Chip 
                              key={i} 
                              label={`${String.fromCharCode(65 + i)}. ${item}`}
                              onClick={() => handleSortToggle(i)} 
                              disabled={isAnswered || (reviewUserAnswer || []).includes(i)}
                              variant="outlined" 
                              sx={{ py: 2, fontWeight: 'bold' }}
                          />
                      ))}
                  </Stack>
                  {!isAnswered && (
                      <Button 
                          variant="contained" 
                          fullWidth 
                          onClick={() => handleReviewAnswer(reviewUserAnswer)}
                          disabled={!reviewUserAnswer || reviewUserAnswer.length !== items.length}
                          sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold' }}
                      >
                          回答決定
                      </Button>
                  )}
              </Box>
          )}
      </Box>

      {isAnswered && (
          <div className="animate-fadeIn">
              <Alert 
                  severity={reviewResult ? "success" : "error"} 
                  icon={reviewResult ? <CheckCircle fontSize="inherit" /> : <AlertTriangle fontSize="inherit" />}
                  sx={{ mb: 2, borderRadius: 3, fontWeight: 'bold' }}
              >
                  {reviewResult ? "正解！" : "不正解..."}
              </Alert>

              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#f8fafc', border: '1px solid', borderColor: '#e2e8f0', mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="text.secondary">
                      解説・ポイント
                  </Typography>

                  {/* 整序問題の正解表示 */}
                  {isSort && currentQ.correct_order && (
                      <Box mb={3} p={2} bgcolor="white" borderRadius={2} border="1px dashed" borderColor="#cbd5e1">
                           <Typography variant="caption" display="block" color="text.secondary" mb={1}>
                                正しい順序:
                           </Typography>
                           <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
                               {currentQ.correct_order.map((idx, i) => (
                                   <React.Fragment key={i}>
                                       {i > 0 && <ArrowRight fontSize="small" sx={{ color: '#10b981' }} />}
                                       <Chip 
                                           size="small"
                                           label={`${String.fromCharCode(65 + idx)}. ${items[idx]}`}
                                           sx={{ fontWeight: 'bold', bgcolor: '#ecfdf5', color: '#065f46', border: '1px solid', borderColor: '#a7f3d0' }}
                                       />
                                   </React.Fragment>
                               ))}
                           </Box>
                      </Box>
                  )}
                  
                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ color: '#475569', lineHeight: 1.8 }}>
                      <SafeMarkdown content={explanation} />
                  </Box>
              </Paper>

              <Button 
                  variant="contained" 
                  fullWidth 
                  size="large" 
                  onClick={nextReviewQuestion}
                  sx={{ py: 2, borderRadius: 3, fontWeight: 'bold' }}
                  endIcon={<ChevronRight />}
              >
                  次へ
              </Button>
          </div>
      )}
    </Container>
  );
};

export default ReviewScreen;