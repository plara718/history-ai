import React from 'react';
import { Box, Button, Typography, Container, Paper, Stack, Divider } from '@mui/material';
import { Brain, Sparkles, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

const AuthScreen = ({ onAuthenticate }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Container maxWidth="xs" className="animate-fade-in">
        
        {/* メインカード */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 5, 
            borderRadius: 5, 
            bgcolor: 'white', 
            border: '1px solid', 
            borderColor: 'slate.200',
            textAlign: 'center',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)'
          }}
        >
          {/* アプリアイコン・ロゴ */}
          <Box 
            sx={{ 
              width: 80, 
              height: 80, 
              bgcolor: 'indigo.50', 
              color: 'indigo.600', 
              borderRadius: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              mx: 'auto', 
              mb: 3 
            }}
          >
            <Brain size={40} strokeWidth={2.5} />
          </Box>

          <Typography variant="h4" fontWeight="900" color="slate.900" gutterBottom letterSpacing="-0.02em">
            日本史AI特訓
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, lineHeight: 1.8 }}>
            最先端のAIが、あなたの学習ログを分析。<br/>
            入試から定期テストまで、<br/>
            <span className="font-bold text-indigo-600">最短ルート</span>で合格力を養成します。
          </Typography>

          {/* 特徴リスト (簡易) */}
          <Stack spacing={2} mb={5} sx={{ textAlign: 'left', px: 1 }}>
            <FeatureItem icon={<Zap size={18} />} text="AIによる個別カリキュラム生成" />
            <FeatureItem icon={<Sparkles size={18} />} text="記述問題の即時自動採点" />
            <FeatureItem icon={<ShieldCheck size={18} />} text="苦手分野をピンポイント復習" />
          </Stack>

          <Divider sx={{ mb: 4 }} />

          {/* 開始ボタン */}
          <Button 
            variant="contained" 
            size="large" 
            fullWidth 
            onClick={onAuthenticate}
            endIcon={<ArrowRight />}
            sx={{ 
              py: 2, 
              borderRadius: 3, 
              fontWeight: 'bold', 
              fontSize: '1.1rem',
              bgcolor: 'indigo.600',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
              '&:hover': { bgcolor: 'indigo.700', transform: 'translateY(-1px)' },
              transition: 'all 0.2s'
            }}
          >
            学習を始める
          </Button>

          <Typography variant="caption" display="block" color="text.disabled" mt={3}>
            あなた専用の個別カリキュラムを準備します
          </Typography>
        </Paper>

        {/* フッター */}
        <Typography variant="caption" align="center" display="block" color="text.disabled" mt={4}>
          © 2026 Japanese History AI Tutor
        </Typography>

      </Container>
    </div>
  );
};

// 特徴リスト用パーツ
const FeatureItem = ({ icon, text }) => (
  <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'slate.50' }}>
    <Box sx={{ color: 'indigo.500', display: 'flex' }}>{icon}</Box>
    <Typography variant="body2" fontWeight="bold" color="slate.700">
      {text}
    </Typography>
  </Stack>
);

export default AuthScreen;