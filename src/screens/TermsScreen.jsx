import React from 'react';
import { Box, Button, Typography, Paper, Container, Stack } from '@mui/material';
import { ChevronRight, Bookmark } from 'lucide-react';

const TermsScreen = ({ dailyData, learningMode, onNext }) => {
  const isSchool = learningMode === 'school';
  const themeColor = isSchool ? "text-emerald-700" : "text-indigo-700";
  const btnColor = isSchool ? "success" : "primary";

  // データ防御: essential_termsがない場合のフォールバック
  const termsList = dailyData.essential_terms || [];

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 10 }}>
      
      <Box mb={4} textAlign="center">
          <Typography variant="h5" fontWeight="900" className={themeColor} gutterBottom>
              重要語句の確認
          </Typography>
          <Typography variant="body2" color="text.secondary">
              今回の講義で登場した重要キーワードです。<br/>「用語帳」に自動保存されます。
          </Typography>
      </Box>

      <Stack spacing={2} mb={4}>
          {termsList.map((term, i) => (
              <Paper 
                  key={i} 
                  elevation={0} 
                  sx={{ 
                      p: 3, 
                      borderRadius: 4, 
                      bgcolor: 'white', 
                      border: '1px solid', 
                      borderColor: 'divider',
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
                  }}
              >
                  <Stack direction="row" alignItems="center" spacing={2} mb={1}>
                      <Box sx={{ p: 1, borderRadius: '50%', bgcolor: isSchool ? 'emerald.50' : 'indigo.50', color: isSchool ? 'emerald.600' : 'indigo.600' }}>
                          <Bookmark size={20} />
                      </Box>
                      <Typography variant="h6" fontWeight="bold" color="text.primary">
                          {term.term}
                      </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, pl: 6 }}>
                      {term.def}
                  </Typography>
              </Paper>
          ))}
      </Stack>

      <Button 
          variant="contained" 
          color={btnColor}
          fullWidth 
          size="large" 
          onClick={onNext}
          endIcon={<ChevronRight />}
          sx={{ 
              py: 2, 
              borderRadius: 3, 
              fontWeight: 'bold', 
              fontSize: '1.1rem',
              boxShadow: 3
          }}
      >
          結果を確認する
      </Button>
    </Container>
  );
};

export default TermsScreen;