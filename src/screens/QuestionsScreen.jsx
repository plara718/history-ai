import React, { useState } from 'react';
import { Box, Button, Typography, Paper, Container, LinearProgress, Chip, Stack, Alert, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { CheckCircle, HelpCircle, ChevronRight, AlertTriangle, Check, X } from 'lucide-react';
import { getFlattenedQuestions } from '../lib/utils';
import MarkdownLite from '../components/MarkdownLite';

const QuestionsScreen = ({ 
  qIndex, dailyData, essayGrading, 
  userAnswers, setUserAnswers, 
  isAnswered, setIsAnswered, 
  showHint, setShowHint, 
  learningMode, isReadOnly, isProcessing,
  gradeEssay, giveUpEssay, scoreRef, saveProgress, nextQuestion 
}) => {

  const flatQuestions = getFlattenedQuestions(dailyData);
  const currentQ = flatQuestions[qIndex];
  const totalQ = flatQuestions.length;
  const progress = ((qIndex) / totalQ) * 100;
  
  const handleOptionSelect = (idx) => {
    if (isAnswered || isReadOnly) return;
    const newAns = { ...userAnswers, [qIndex]: idx };
    setUserAnswers(newAns);
    setIsAnswered(true);
    saveProgress(newAns, qIndex);
  };

  // 整序問題の操作
  const handleSortToggle = (itemIndex) => {
    if (isAnswered || isReadOnly) return;
    const currentOrder = userAnswers[qIndex] || [];
    let newOrder;
    if (currentOrder.includes(itemIndex)) {
        newOrder = currentOrder.filter(i => i !== itemIndex);
    } else {
        newOrder = [...currentOrder, itemIndex];
    }
    setUserAnswers({ ...userAnswers, [qIndex]: newOrder });
  };
  const handleSubmitSort = () => {
    setIsAnswered(true);
    saveProgress(userAnswers, qIndex);
  };

  const handleEssayChange = (e) => {
    if (isAnswered || isReadOnly) return;
    setUserAnswers({ ...userAnswers, [qIndex]: e.target.value });
  };

  const isCorrect = (() => {
      if (!isAnswered) return null;
      if (currentQ.type === 'true_false') return userAnswers[qIndex] === currentQ.correct;
      if (currentQ.type === 'sort') return JSON.stringify(userAnswers[qIndex]) === JSON.stringify(currentQ.correct_order);
      return null;
  })();

  const EssayFeedback = () => {
      if (!essayGrading) return null;
      return (
          <Box mt={2} p={2} bgcolor="indigo.50" borderRadius={2} border="1px solid" borderColor="indigo.100">
              <Typography variant="subtitle2" fontWeight="bold" color="indigo.800">AIからの採点結果</Typography>
              <Box mt={1}>
                  <MarkdownLite text={essayGrading.feedback} />
              </Box>
          </Box>
      );
  };

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 10 }}>
      {/* プログレスバー */}
      <Box mb={3} display="flex" alignItems="center" gap={2}>
          <LinearProgress variant="determinate" value={progress} sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: 'slate.100', '& .MuiLinearProgress-bar': { bgcolor: 'indigo.500' } }} />
          <Typography variant="caption" fontWeight="bold" color="text.secondary">
              {qIndex + 1} / {totalQ}
          </Typography>
      </Box>

      {/* 問題カード */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, bgcolor: 'white', border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <Chip 
                label={currentQ.type === 'essay' ? '記述問題' : currentQ.type === 'sort' ? '整序問題' : '選択問題'} 
                color="primary" 
                size="small" 
                sx={{ fontWeight: 'bold' }} 
              />
              {currentQ.type === 'essay' && <Chip label="120字程度" size="small" variant="outlined" />}
          </Stack>

          <Box sx={{ minHeight: 80 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.6, color: 'slate.800' }}>
                  <MarkdownLite text={currentQ.q} />
              </Typography>
          </Box>
      </Paper>

      {/* 回答エリア */}
      <Box mb={4}>
          {/* 選択問題 */}
          {currentQ.type === 'true_false' && (
              <Stack spacing={2}>
                  {currentQ.options.map((opt, i) => {
                      const isSelected = userAnswers[qIndex] === i;
                      const isCorrectOption = i === currentQ.correct;
                      
                      let btnColor = 'white';
                      let borderColor = 'slate.200';
                      let textColor = 'slate.700';

                      if (isAnswered) {
                          if (isCorrectOption) {
                              // 正解の選択肢
                              btnColor = 'emerald.50'; borderColor = 'emerald.500'; textColor = 'emerald.700';
                          } else if (isSelected) {
                              // 間違って選んだ選択肢
                              btnColor = 'rose.50'; borderColor = 'rose.500'; textColor = 'rose.700';
                          } else {
                              // その他
                              borderColor = 'transparent'; textColor = 'slate.400';
                          }
                      } else if (isSelected) {
                          borderColor = 'indigo.500';
                      }

                      return (
                          <button
                              key={i}
                              onClick={() => handleOptionSelect(i)}
                              className={`
                                  w-full p-4 rounded-xl border-2 text-left transition-all font-medium text-base relative
                                  ${isAnswered ? 'cursor-default' : 'hover:bg-slate-50 active:scale-[0.99]'}
                              `}
                              style={{ 
                                  backgroundColor: isAnswered && !isCorrectOption && !isSelected ? '#f8fafc' : undefined, 
                                  borderColor: borderColor.replace('.', '-'), 
                                  color: textColor.replace('.', '-') 
                              }} 
                          >
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                  <Box flex={1}>
                                      <MarkdownLite text={opt} />
                                  </Box>
                                  
                                  {/* 結果表示バッジ */}
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
          )}

          {/* 整序問題 */}
          {currentQ.type === 'sort' && (
              <Box>
                  <Box mb={2} p={2} bgcolor="slate.100" borderRadius={2} minHeight={60} display="flex" flexWrap="wrap" gap={1} alignItems="center">
                      {(userAnswers[qIndex] || []).map((idx, i) => (
                          <Chip key={i} label={currentQ.items[idx]} onDelete={!isAnswered ? () => handleSortToggle(idx) : undefined} color="primary" sx={{ fontWeight: 'bold' }} />
                      ))}
                      {(userAnswers[qIndex] || []).length === 0 && <Typography variant="caption" color="text.secondary">選択肢をタップして順番に並べてください</Typography>}
                  </Box>
                  <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="center" mb={3}>
                      {currentQ.items.map((item, i) => (
                          <Chip 
                              key={i} 
                              label={item} 
                              onClick={() => handleSortToggle(i)} 
                              disabled={isAnswered || (userAnswers[qIndex] || []).includes(i)}
                              variant="outlined"
                              sx={{ fontSize: '0.9rem', py: 2 }}
                          />
                      ))}
                  </Stack>
                  {!isAnswered && (
                      <Button variant="contained" fullWidth onClick={handleSubmitSort} disabled={(userAnswers[qIndex]||[]).length !== currentQ.items.length}>
                          回答する
                      </Button>
                  )}
              </Box>
          )}

          {/* 記述問題 */}
          {currentQ.type === 'essay' && (
              <Box>
                  <TextField
                      fullWidth
                      multiline
                      rows={6}
                      placeholder="ここに回答を入力してください..."
                      value={userAnswers[qIndex] || ""}
                      onChange={handleEssayChange}
                      disabled={isAnswered || isProcessing}
                      sx={{ bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                  <Stack direction="row" spacing={2} mt={2}>
                      {!isAnswered && (
                          <>
                            <Button 
                                variant="outlined" 
                                color="warning" 
                                onClick={giveUpEssay}
                                disabled={isProcessing}
                                sx={{ flex: 1, borderRadius: 2 }}
                            >
                                諦める
                            </Button>
                            <Button 
                                variant="contained" 
                                onClick={gradeEssay}
                                disabled={isProcessing || !userAnswers[qIndex]}
                                sx={{ flex: 2, borderRadius: 2, fontWeight: 'bold' }}
                            >
                                {isProcessing ? "AI採点中..." : "採点する"}
                            </Button>
                          </>
                      )}
                  </Stack>
                  {isAnswered && <EssayFeedback />}
              </Box>
          )}
      </Box>

      {/* 解説・次へエリア */}
      {isAnswered && currentQ.type !== 'essay' && (
          <div className="animate-slide-in">
              <Alert 
                  severity={isCorrect ? "success" : "error"} 
                  icon={isCorrect ? <CheckCircle /> : <AlertTriangle />}
                  sx={{ mb: 2, borderRadius: 3, fontWeight: 'bold' }}
              >
                  {isCorrect ? "正解！" : "残念！不正解です。"}
              </Alert>

              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: 'slate.50', border: '1px solid', borderColor: 'slate.200', mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="slate.700">
                      解説
                  </Typography>
                  <Box sx={{ typography: 'body2', color: 'slate.600', lineHeight: 1.7 }}>
                      <MarkdownLite text={currentQ.exp} />
                  </Box>
              </Paper>

              <Button 
                  variant="contained" 
                  fullWidth 
                  size="large" 
                  onClick={nextQuestion}
                  sx={{ py: 2, borderRadius: 3, fontWeight: 'bold', boxShadow: 3 }}
                  endIcon={<ChevronRight />}
              >
                  {qIndex < totalQ - 1 ? "次の問題へ" : "結果を見る"}
              </Button>
          </div>
      )}

      {isAnswered && currentQ.type === 'essay' && !isProcessing && (
           <Button 
              variant="contained" 
              fullWidth 
              size="large" 
              onClick={nextQuestion}
              sx={{ py: 2, borderRadius: 3, fontWeight: 'bold', boxShadow: 3, mt: 2 }}
              endIcon={<ChevronRight />}
          >
              {qIndex < totalQ - 1 ? "次の問題へ" : "結果を見る"}
          </Button>
      )}

      {currentQ.type === 'essay' && !isAnswered && (
          <Box mt={2} textAlign="center">
              <Button 
                  size="small" 
                  startIcon={<HelpCircle size={16} />} 
                  onClick={() => setShowHint(true)}
                  sx={{ color: 'text.secondary' }}
              >
                  ヒントを見る
              </Button>
          </Box>
      )}

      <Dialog open={showHint} onClose={() => setShowHint(false)}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>ヒント</DialogTitle>
          <DialogContent>
              <Typography variant="body2" lineHeight={1.8}>
                 <MarkdownLite text={currentQ.hint || "ヒントはありません。講義内容を思い出してみましょう。"} />
              </Typography>
          </DialogContent>
          <DialogActions>
              <Button onClick={() => setShowHint(false)}>閉じる</Button>
          </DialogActions>
      </Dialog>

    </Container>
  );
};

export default QuestionsScreen;