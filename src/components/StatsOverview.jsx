import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Box, Typography, Chip, Paper, Skeleton, Stack, Fade } from '@mui/material';
import { 
  WarningAmberRounded,      // 弱点用アイコン
  CheckCircleOutlineRounded,// 強み用アイコン
  TrendingUpRounded,        // 発展途上用アイコン
  PsychologyAltRounded      // データ不足時のアイコン
} from '@mui/icons-material';

import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { 
  getTagConfig, // ★ tagConfigからインポート
  ANALYSIS_THRESHOLDS 
} from '../lib/tagConfig';

export const StatsOverview = ({ userId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Firestoreのリアルタイム監視
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    const statsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'summary');
    const unsubscribe = onSnapshot(statsRef, (docSnap) => {
      if (docSnap.exists()) {
        setStats(docSnap.data());
      } else {
        setStats(null); // データ未作成（初回の学習前）
      }
      setLoading(false);
    }, (error) => {
      console.error("Stats fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // データの加工・分類ロジック
  const analyzeData = () => {
    if (!stats) return { weaknesses: [], strengths: [], developing: [] };

    const allTags = [];
    
    // 3つのカテゴリ（eras, themes, mistakes）を統合してフラットな配列にする
    ['eras', 'themes', 'mistakes'].forEach(categoryKey => {
      const categoryData = stats[categoryKey];
      if (!categoryData) return;

      Object.entries(categoryData).forEach(([tagId, data]) => {
        const attempts = data.attempts || 0;
        const errors = data.errors || 0;
        
        if (attempts === 0) return;

        const errorRate = errors / attempts;
        const config = getTagConfig(tagId); 

        // configが取れない場合はスキップ（古いIDなどの対策）
        if (!config) return;

        allTags.push({
          ...config, // tagId, label, color, etc.
          attempts,
          errors,
          errorRate
        });
      });
    });

    // 閾値に基づいて分類
    const { minAttempts, weaknessRatio, strengthRatio } = ANALYSIS_THRESHOLDS;

    // 1. 弱点 (Weakness): 試行回数が足りていて、誤答率が高い
    const weaknesses = allTags
      .filter(t => t.attempts >= minAttempts && t.errorRate >= weaknessRatio)
      .sort((a, b) => b.errorRate - a.errorRate); // ミスが多い順

    // 2. 強み (Strength): 試行回数が足りていて、誤答率が低い
    const strengths = allTags
      .filter(t => t.attempts >= minAttempts && t.errorRate <= strengthRatio)
      .sort((a, b) => b.attempts - a.attempts);   // 経験値が高い順

    // 3. 習得中 (Developing): 上記以外
    // データ不足(minAttempts未満) または 中間の成績
    const developing = allTags
      .filter(t => !weaknesses.includes(t) && !strengths.includes(t))
      .sort((a, b) => b.attempts - a.attempts);

    return { weaknesses, strengths, developing };
  };

  const { weaknesses, strengths, developing } = analyzeData();

  // ローディング表示
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 4, mb: 2 }} />
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 4 }} />
      </Box>
    );
  }

  // データがない場合（初回）
  if (!stats) {
    return (
      <Paper elevation={0} sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 4, border: '1px dashed', borderColor: 'grey.300' }}>
        <Stack alignItems="center" spacing={1}>
          <PsychologyAltRounded sx={{ fontSize: 40, color: 'text.disabled' }} />
          <Box>
            <Typography variant="body2" color="text.primary" fontWeight="bold">
              学習データ収集中...
            </Typography>
            <Typography variant="caption" color="text.secondary">
              レッスンを完了すると、ここにあなたの得意・苦手傾向が表示されます。
            </Typography>
          </Box>
        </Stack>
      </Paper>
    );
  }

  return (
    <Fade in={true}>
      <Stack spacing={2}>
        
        {/* 1. 弱点エリア (Attention) - 最優先表示 */}
        {weaknesses.length > 0 && (
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 4, bgcolor: '#FFF1F2', border: '1px solid #FECDD3' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <WarningAmberRounded sx={{ color: '#E11D48', mr: 1, fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#9F1239' }}>
                重点復習エリア (Weakness)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {weaknesses.map((tag) => (
                <Chip
                  key={tag.tagId}
                  label={tag.label} // ex: #鎌倉
                  size="small"
                  sx={{
                    bgcolor: 'white',
                    color: tag.color?.text || '#BE123C',
                    fontWeight: 'bold',
                    border: `1px solid ${tag.color?.main || '#F43F5E'}`,
                    '& .MuiChip-label': { px: 1.5 }
                  }}
                />
              ))}
            </Box>
          </Paper>
        )}

        {/* 2. 強みエリア (Strength) - 自信を持たせる */}
        {strengths.length > 0 && (
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 4, bgcolor: '#F0FDFA', border: '1px solid #CCFBF1' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircleOutlineRounded sx={{ color: '#0D9488', mr: 1, fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#115E59' }}>
                習得済み (Mastered)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {strengths.map((tag) => (
                <Chip
                  key={tag.tagId}
                  label={tag.label}
                  size="small"
                  sx={{
                    bgcolor: 'white',
                    color: tag.color?.text || '#0F766E',
                    fontWeight: 'bold',
                    border: '1px solid transparent',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                />
              ))}
            </Box>
          </Paper>
        )}

        {/* 3. 分析中エリア (Developing) - データ不足時はここに出る */}
        {(weaknesses.length === 0 && strengths.length === 0) && (
           <Paper elevation={0} sx={{ p: 2.5, borderRadius: 4, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingUpRounded sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                分析中のデータ
              </Typography>
            </Box>
            
            {developing.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {developing.slice(0, 5).map((tag) => ( // 上位5つのみ表示
                    <Chip
                    key={tag.tagId}
                    label={tag.label}
                    size="small"
                    variant="outlined"
                    sx={{
                        borderColor: 'divider',
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        bgcolor: 'white'
                    }}
                    />
                ))}
                {developing.length > 5 && (
                    <Typography variant="caption" sx={{ alignSelf: 'center', color: 'text.disabled', ml: 0.5 }}>
                    他 {developing.length - 5} 件...
                    </Typography>
                )}
                </Box>
            ) : (
                <Typography variant="caption" color="text.secondary">
                    まだ十分な学習データがありません。レッスンを続けてください。
                </Typography>
            )}

            <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.disabled', textAlign: 'right', fontSize: '0.65rem' }}>
              ※各タグ 3回以上の出現で判定されます
            </Typography>
          </Paper>
        )}

      </Stack>
    </Fade>
  );
};