import React from 'react';
import { Box, Button, Typography, Paper, Container, TextField, Stack, Chip, Accordion, AccordionSummary, AccordionDetails, Box as MuiBox } from '@mui/material';
import { Check, Copy, Home, MessageSquare, ChevronDown, X, Sparkles } from 'lucide-react';
import MarkdownLite from '../components/MarkdownLite';
import { getFlattenedQuestions } from '../lib/utils';

// 簡易プログレスバーコンポーネント
const LinearProgressWithLabel = ({ value }) => {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: '100%', mr: 1 }}>
                <Box sx={{ width: '100%', bgcolor: 'slate.100', borderRadius: 5, height: 10 }}>
                    <Box sx={{ width: `${value}%`, bgcolor: value >= 80 ? 'emerald.500' : 'indigo.500', borderRadius: 5, height: '100%', transition: 'width 0.5s' }} />
                </Box>
            </Box>
        </Box>
    );
};

const SummaryScreen = ({ 
    dailyData, 
    userAnswers, 
    essayGrading, 
    activeSession, 
    isReadOnly, 
    reflection, 
    setReflection, 
    saveReflection, 
    copyToClipboard, 
    startNextSession 
}) => {

  const flatQuestions = getFlattenedQuestions(dailyData);
  
  let correctCount = 0;
  const results = flatQuestions.map((q, i) => {
      let isCorrect = false;
      const userAns = userAnswers[i];

      if (q.type === 'true_false') {
          isCorrect = userAns === q.correct;
      } else if (q.type === 'sort') {
          isCorrect = JSON.stringify(userAns) === JSON.stringify(q.correct_order);
      } else if (q.type === 'essay') {
          isCorrect = true; 
      }
      
      if (isCorrect && q.type !== 'essay') correctCount++;
      return { q, isCorrect, userAns };
  });

  const objectiveCount = flatQuestions.filter(q => q.type !== 'essay').length;

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 10 }}>
      
      <Box sx={{ textAlign: 'center', mb: 4 }}>
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={32} strokeWidth={3} />
          </div>
          <Typography variant="h5" fontWeight="900" gutterBottom>
              Session {activeSession} 完了！
          </Typography>
          <Typography variant="body2" color="text.secondary">
              お疲れ様でした。学習の記録が保存されました。
          </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 4, bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight="bold" color="text.secondary">
                  正答率
              </Typography>
              <Typography variant="h4" fontWeight="900" color={correctCount === objectiveCount ? "primary.main" : "text.primary"}>
                  {correctCount} <span className="text-lg text-slate-400 font-normal">/ {objectiveCount}</span>
              </Typography>
          </Stack>
          <LinearProgressWithLabel value={objectiveCount > 0 ? (correctCount / objectiveCount) * 100 : 0} />
      </Paper>

      {dailyData.column && (
          <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 4, bgcolor: 'indigo.50', border: '1px solid', borderColor: 'indigo.100' }}>
              <Typography variant="h6" fontWeight="bold" color="indigo.900" gutterBottom flex alignItems="center" gap={1}>
                  <Sparkles size={20} /> 今日の深掘りコラム
              </Typography>
              <Box sx={{ typography: 'body2', color: 'indigo.900' }}>
                  <MarkdownLite text={dailyData.column} />
              </Box>
          </Paper>
      )}

      <Box mb={4}>
          <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom ml={1}>
              問題ごとの結果
          </Typography>
          {results.map((item, i) => {
              if (item.q.type === 'essay') return null;

              return (
                  <Accordion key={i} elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
                      <AccordionSummary expandIcon={<ChevronDown size={16} />} sx={{ px: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Stack direction="row" alignItems="center" spacing={2} width="100%">
                              <Box sx={{ 
                                  width: 28, height: 28, borderRadius: '50%', 
                                  bgcolor: item.isCorrect ? 'emerald.100' : 'rose.100', 
                                  color: item.isCorrect ? 'emerald.600' : 'rose.600',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                  {item.isCorrect ? <Check size={16} /> : <X size={16} />}
                              </Box>
                              <Typography variant="body2" fontWeight="bold" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  Q{i + 1}. {item.q.type === 'true_false' ? '選択問題' : '整序問題'}
                              </Typography>
                              <Typography variant="caption" color={item.isCorrect ? "success.main" : "error.main"} fontWeight="bold">
                                  {item.isCorrect ? "正解" : "不正解"}
                              </Typography>
                          </Stack>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 2, pb: 2, pt: 0, bgcolor: 'slate.50', borderRadius: 2, mt: 1 }}>
                          <Typography variant="caption" display="block" color="text.secondary" mt={1}>問題:</Typography>
                          <Typography variant="body2" fontWeight="medium" gutterBottom>
                              <MarkdownLite text={item.q.q} />
                          </Typography>
                          
                          <Typography variant="caption" display="block" color="text.secondary" mt={1}>正解:</Typography>
                          {item.q.type === 'true_false' ? (
                              <Typography variant="body2" fontWeight="bold" color="primary">
                                  <MarkdownLite text={item.q.options[item.q.correct]} />
                              </Typography>
                          ) : (
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                  {item.q.correct_order.map(idx => (
                                      <Chip key={idx} label={item.q.items[idx]} size="small" variant="outlined" />
                                  ))}
                              </Stack>
                          )}
                          
                          <Box mt={2} p={1.5} bgcolor="white" borderRadius={2} border="1px solid" borderColor="divider">
                             <Typography variant="caption" fontWeight="bold" color="indigo.500">💡 解説</Typography>
                             <Box sx={{ typography: 'body2', color: 'text.secondary', mt: 0.5 }}>
                                 <MarkdownLite text={item.q.exp} />
                             </Box>
                          </Box>
                      </AccordionDetails>
                  </Accordion>
              );
          })}
      </Box>

      {essayGrading && (
          <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 4, bgcolor: 'indigo.50', border: '1px solid', borderColor: 'indigo.100' }}>
              <Typography variant="h6" fontWeight="bold" color="indigo.900" gutterBottom flex alignItems="center" gap={1}>
                  <MessageSquare size={20} /> 記述フィードバック
              </Typography>
              <Stack direction="row" spacing={1} mb={2}>
                   <Chip label={`知識点: ${essayGrading.score?.k || 0}/5`} color="primary" size="small" />
                   <Chip label={`論理点: ${essayGrading.score?.l || 0}/5`} color="secondary" size="small" />
              </Stack>
              <Box sx={{ typography: 'body2', color: 'indigo.900', lineHeight: 1.7 }}>
                  <MarkdownLite text={essayGrading.feedback} />
              </Box>
          </Paper>
      )}

      <Box mb={6}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom ml={1}>
              学習の振り返り
          </Typography>
          <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="今日の気づきや、次に調べたいことをメモしておきましょう"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              onBlur={(e) => saveReflection(e.target.value)}
              disabled={isReadOnly}
              sx={{ bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
      </Box>

      <Stack spacing={2}>
          <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<Copy size={18} />} 
              onClick={copyToClipboard}
              sx={{ borderRadius: 3, py: 1.5, borderColor: 'slate.300', color: 'slate.600' }}
          >
              講義内容をコピー
          </Button>

          {!isReadOnly && (
              <Button 
                  variant="contained" 
                  fullWidth 
                  size="large" 
                  onClick={startNextSession}
                  sx={{ borderRadius: 3, py: 2, fontWeight: 'bold', boxShadow: 4 }}
              >
                  次の学習へ進む
              </Button>
          )}

          {isReadOnly && (
              <Button 
                  variant="text" 
                  fullWidth 
                  startIcon={<Home />}
                  onClick={startNextSession} 
                  sx={{ color: 'text.secondary' }}
              >
                  ホームに戻る
              </Button>
          )}
      </Stack>
    </Container>
  );
};

export default SummaryScreen;