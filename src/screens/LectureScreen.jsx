import React from 'react';
import { Box, Button, Typography, Paper, Container, Stack, Divider, Chip } from '@mui/material';
import { ChevronRight, BookOpen, Sparkles, Zap } from 'lucide-react';
import MarkdownLite from '../components/MarkdownLite';

const LectureScreen = ({ 
    dailyData, 
    learningMode, 
    lectureMode, setLectureMode, 
    simplifiedLecture, 
    simplifyLectureText, 
    isProcessing, 
    onNext 
}) => {
  const isSchool = learningMode === 'school';
  const themeColor = isSchool ? "text-emerald-700" : "text-indigo-700";
  const btnColor = isSchool ? "success" : "primary";

  // 表示するテキスト（通常 or 要約）
  const contentText = lectureMode === 'simple' && simplifiedLecture ? simplifiedLecture : dailyData.lecture;

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 10 }}>
      
      {/* タイトルエリア */}
      <Box mb={4} textAlign="center">
        <Chip 
            label={isSchool ? "定期テスト対策" : "入試演習"} 
            size="small" 
            sx={{ mb: 1, fontWeight: 'bold', bgcolor: isSchool ? 'emerald.50' : 'indigo.50', color: isSchool ? 'emerald.700' : 'indigo.700' }} 
        />
        <Typography variant="h5" fontWeight="900" className={themeColor} gutterBottom>
            {dailyData.theme}
        </Typography>
      </Box>

      {/* 講義カード */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, bgcolor: 'white', border: '1px solid', borderColor: 'divider', mb: 4 }}>
          {/* ツールバー */}
          <Stack direction="row" justifyContent="flex-end" mb={2}>
              {lectureMode === 'original' ? (
                  <Button 
                    size="small" 
                    variant="text" 
                    startIcon={<Zap size={16} />}
                    onClick={simplifyLectureText}
                    disabled={isProcessing}
                    sx={{ borderRadius: 2, fontWeight: 'bold' }}
                  >
                      {isProcessing ? "生成中..." : "中学生レベルに要約"}
                  </Button>
              ) : (
                  <Button 
                    size="small" 
                    variant="text" 
                    onClick={() => setLectureMode('original')}
                    sx={{ borderRadius: 2, fontWeight: 'bold' }}
                  >
                      元の講義に戻す
                  </Button>
              )}
          </Stack>

          {/* 本文 */}
          <MarkdownLite text={contentText} />
      </Paper>

      {/* アクションボタン */}
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
          演習問題へ進む
      </Button>
    </Container>
  );
};

export default LectureScreen;