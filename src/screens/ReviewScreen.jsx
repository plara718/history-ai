import React from 'react';
import { Box, Button, Typography, Paper, Container, Stack, Chip, Alert, Divider } from '@mui/material';
import { CheckCircle, AlertTriangle, ChevronRight, ArrowRight, Check, X } from 'lucide-react';
import MarkdownLite from '../components/MarkdownLite';

const ReviewScreen = ({ 
  qIndex, reviewProblems, isAnswered, reviewResult, 
  reviewUserAnswer, setReviewUserAnswer, 
  handleReviewAnswer, nextReviewQuestion 
}) => {
  if (!reviewProblems || !reviewProblems[qIndex]) return null;

  const currentQ = reviewProblems[qIndex];
  const totalQ = reviewProblems.length;
  const options = currentQ.options || [];
  const items = currentQ.items || [];

  const handleSortToggle = (itemIndex) => {
    if (isAnswered) return;
    const currentOrder = reviewUserAnswer || [];
    let newOrder;
    if (currentOrder.includes(itemIndex)) {
        newOrder = currentOrder.filter(i => i !== itemIndex);
    } else {
        newOrder = [...currentOrder, itemIndex];
    }
    setReviewUserAnswer(newOrder);
  };

  const formatExplanation = (text) => {
    if (!text) return "";
    return text.replace(/(\d+)(?:\s*→\s*)(\d+)(?:(?:\s*→\s*)(\d+))*/g, (match) => {
        return match.split('→').map(numStr => {
            const num = parseInt(numStr.trim());
            if (!isNaN(num) && num >= 0 && num < 26) {
                return String.fromCharCode(65 + num);
            }
            return numStr;
        }).join(' → ');
    });
  };

  const cleanExplanation = formatExplanation(currentQ.exp || currentQ.explanation || currentQ.解説 || "解説はありません。");

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 10 }}>
       <Box mb={3} textAlign="center">
          <Typography variant="caption" fontWeight="bold" color="text.secondary">
              弱点克服モード {qIndex + 1} / {totalQ}
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" color="indigo.600">
              {currentQ.theme || "復習"}
          </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, bgcolor: 'white', border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <Chip 
              label={currentQ.type === 'sort' ? '整序問題' : '選択問題'} 
              size="small" 
              color="warning"
              sx={{ fontWeight: 'bold', mb: 2 }} 
          />
          <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.6 }}>
              <MarkdownLite text={currentQ.q} />
          </Typography>
      </Paper>

      <Box mb={4}>
          {currentQ.type === 'true_false' ? (
              <Stack spacing={2}>
                  {options.map((opt, i) => {
                      const isSelected = reviewUserAnswer === i;
                      const isCorrectOption = i === currentQ.correct;

                      let bg = 'white';
                      let border = 'slate.200';
                      
                      if (isAnswered) {
                          if (isCorrectOption) { bg = 'emerald.50'; border = 'emerald.500'; }
                          else if (isSelected) { bg = 'rose.50'; border = 'rose.500'; }
                      }

                      return (
                          <button
                              key={i}
                              onClick={() => !isAnswered && handleReviewAnswer(i)}
                              className={`w-full p-4 rounded-xl border-2 text-left transition-all font-medium ${!isAnswered && 'hover:bg-slate-50'}`}
                              style={{ 
                                  backgroundColor: isAnswered ? undefined : bg, 
                                  borderColor: isAnswered ? undefined : border.replace('.', '-') 
                              }}
                          >
                               <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                  <Box flex={1}>
                                      <span className="font-bold mr-2 text-slate-400">{String.fromCharCode(65 + i)}.</span>
                                      <MarkdownLite text={opt} />
                                  </Box>

                                  {/* 結果バッジ */}
                                  {isAnswered && (
                                      <Box flexShrink={0}>
                                          {isSelected && (
                                              <Chip 
                                                  label="あなたの回答" 
                                                  size="small" 
                                                  color={isCorrectOption ? "success" : "error"} 
                                                  variant="filled" 
                                                  icon={isCorrectOption ? <Check size={14}/> : <X size={14}/>}
                                                  sx={{ fontWeight: 'bold' }} 
                                              />
                                          )}
                                          {!isSelected && isCorrectOption && (
                                              <Chip 
                                                  label="正解" 
                                                  size="small" 
                                                  color="success" 
                                                  variant="outlined" 
                                                  sx={{ fontWeight: 'bold', bgcolor: 'white' }} 
                                              />
                                          )}
                                      </Box>
                                  )}
                               </Stack>
                          </button>
                      );
                  })}
              </Stack>
          ) : (
              <Box>
                  <Box mb={2} p={2} bgcolor="slate.100" borderRadius={2} minHeight={60} display="flex" flexWrap="wrap" gap={1} alignItems="center">
                      {(reviewUserAnswer || []).length === 0 && (
                          <Typography variant="caption" color="text.disabled">下の選択肢を順番にタップしてください</Typography>
                      )}
                      {(reviewUserAnswer || []).map((idx, i) => (
                          <React.Fragment key={i}>
                              {i > 0 && <ArrowRight size={14} className="text-slate-400" />}
                              <Chip 
                                label={`${String.fromCharCode(65 + idx)}. ${items[idx]}`}
                                onDelete={!isAnswered ? () => handleSortToggle(idx) : undefined}
                                color="primary" 
                                variant={isAnswered ? "filled" : "outlined"}
                                sx={{ bgcolor: isAnswered ? 'white' : 'white' }}
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
                          disabled={(reviewUserAnswer||[]).length !== items.length}
                          sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold' }}
                      >
                          回答決定
                      </Button>
                  )}
              </Box>
          )}
      </Box>

      {isAnswered && (
          <div className="animate-slide-in">
              <Alert 
                  severity={reviewResult ? "success" : "error"} 
                  icon={reviewResult ? <CheckCircle /> : <AlertTriangle />}
                  sx={{ mb: 2, borderRadius: 3, fontWeight: 'bold' }}
              >
                  {reviewResult ? "正解！" : "不正解..."}
              </Alert>

              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: 'slate.50', border: '1px solid', borderColor: 'slate.200', mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="slate.700">
                      正解と解説
                  </Typography>

                  {currentQ.type === 'sort' && currentQ.answer && Array.isArray(currentQ.answer) && (
                      <Box mb={3} p={2} bgcolor="white" borderRadius={2} border="1px dashed" borderColor="slate.300">
                           <Typography variant="caption" display="block" color="text.secondary" mb={1}>
                                正しい順序:
                           </Typography>
                           <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
                               {currentQ.answer.map((idx, i) => (
                                   <React.Fragment key={i}>
                                       {i > 0 && <ArrowRight size={16} className="text-emerald-500" />}
                                       <Chip 
                                           size="small"
                                           label={`${String.fromCharCode(65 + idx)}. ${items[idx]}`}
                                           sx={{ fontWeight: 'bold', bgcolor: 'emerald.50', color: 'emerald.800', border: '1px solid', borderColor: 'emerald.200' }}
                                       />
                                   </React.Fragment>
                               ))}
                           </Box>
                      </Box>
                  )}
                  
                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ typography: 'body2', color: 'slate.600', lineHeight: 1.8 }}>
                      <MarkdownLite text={cleanExplanation} />
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