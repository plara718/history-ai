import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Container, Stack, TextField, InputAdornment, Chip, Button, CircularProgress, Fade } from '@mui/material';
import { collection, query, getDocs, doc, setDoc, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { Search, Book, Bookmark, Filter, RefreshCw, Library } from 'lucide-react';

const VocabularyLibrary = ({ userId }) => {
  const [terms, setTerms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // ----------------------------------------------------------------
  // 1. 履歴からの同期ロジック (メモリ上で集計して保存)
  // ----------------------------------------------------------------
  const handleSyncFromHistory = useCallback(async () => {
      if (!userId || syncing) return;
      setSyncing(true);
      
      try {
          console.log("Starting vocabulary sync...");
          // 過去の学習データを全取得
          const q = query(collection(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress'));
          const snap = await getDocs(q);
          
          // メモリ上で用語を集計 (Map: term -> {def, count, addedAt})
          const termMap = new Map();

          snap.forEach((docSnap) => {
              const data = docSnap.data();
              const content = data.content || data; // データ構造の揺れ吸収
              
              if (content.essential_terms && Array.isArray(content.essential_terms)) {
                  content.essential_terms.forEach(t => {
                      if (!t.term) return;
                      
                      if (termMap.has(t.term)) {
                          // 既に存在する場合はカウントアップ
                          const existing = termMap.get(t.term);
                          existing.count += 1;
                      } else {
                          // 新規登録
                          termMap.set(t.term, {
                              term: t.term,
                              def: t.def,
                              addedAt: data.timestamp || new Date().toISOString(),
                              count: 1
                          });
                      }
                  });
              }
          });

          if (termMap.size === 0) {
              setSyncing(false);
              return;
          }

          // Firestoreへの並列書き込み
          const promises = Array.from(termMap.values()).map(termData => {
              return setDoc(
                  doc(db, 'artifacts', APP_ID, 'users', userId, 'vocabulary', termData.term), 
                  termData, 
                  { merge: true }
              );
          });

          await Promise.all(promises);
          console.log(`Synced ${promises.length} terms.`);
          
          // 同期完了後にリストを再取得
          await fetchTerms(true); // リロードフラグ

      } catch(e) {
          console.error("同期エラー", e);
      } finally {
          setSyncing(false);
      }
  }, [userId]); // fetchTermsは依存させない（無限ループ防止）

  // ----------------------------------------------------------------
  // 2. 用語データの取得
  // ----------------------------------------------------------------
  const fetchTerms = useCallback(async (isReload = false) => {
    if (!userId) return;
    if (!isReload) setLoading(true);

    try {
      const q = query(collection(db, 'artifacts', APP_ID, 'users', userId, 'vocabulary'));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data());
      
      // 更新順あるいは五十音順に並べるのが一般的だが、ここでは一旦取得順
      // 必要なら sort((a,b) => b.addedAt.localeCompare(a.addedAt)) 等を追加
      setTerms(list);
      
      // データが0件の場合のみ、自動同期を試みる (初回のみ)
      if (list.length === 0 && !isReload) {
          handleSyncFromHistory();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId, handleSyncFromHistory]);

  // 初回マウント時
  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);


  // 検索フィルタリング (大文字小文字無視)
  const filteredTerms = terms.filter(t => {
      const q = searchQuery.toLowerCase();
      return (t.term && t.term.toLowerCase().includes(q)) || 
             (t.def && t.def.toLowerCase().includes(q));
  });

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 12, pt: 4 }}>
      
      <Box mb={4} textAlign="center">
          <Typography variant="overline" color="text.secondary" fontWeight="bold" letterSpacing={1.5}>
            VOCABULARY
          </Typography>
          <Typography variant="h5" fontWeight="900" color="text.primary" gutterBottom display="flex" alignItems="center" justifyContent="center" gap={1}>
              <Library className="text-indigo-600" size={28} /> マイ用語帳
          </Typography>
          <Typography variant="body2" color="text.secondary">
              学習履歴から自動収集された重要語句コレクション<br/>
              <span style={{ fontWeight: 'bold', color: '#4f46e5' }}>{terms.length}</span> 語を収録中
          </Typography>
      </Box>

      {/* 検索バー */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, mb: 4, borderRadius: 3, 
          bgcolor: 'white', border: '1px solid', borderColor: 'divider',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}
      >
          <TextField
              fullWidth
              placeholder="用語や意味で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="standard"
              InputProps={{
                  disableUnderline: true,
                  startAdornment: (
                      <InputAdornment position="start">
                          <Search className="text-slate-400" size={20} />
                      </InputAdornment>
                  ),
                  style: { fontWeight: 'bold', fontSize: '1rem', color: '#334155' }
              }}
          />
      </Paper>

      {/* 手動同期ボタン (リストが空、または同期中の場合) */}
      {(terms.length === 0 || syncing) && (
          <Box textAlign="center" mb={4}>
              <Button 
                  startIcon={syncing ? <CircularProgress size={16} color="inherit"/> : <RefreshCw size={16} />}
                  onClick={handleSyncFromHistory}
                  disabled={syncing}
                  variant="outlined"
                  size="small"
                  sx={{ borderRadius: 4, px: 3, borderColor: 'divider', color: 'text.secondary' }}
              >
                  {syncing ? "学習履歴から復元中..." : "学習履歴から用語を取り込む"}
              </Button>
          </Box>
      )}

      {/* リスト表示 */}
      <Stack spacing={2}>
          {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={24} color="primary" />
              </Box>
          ) : filteredTerms.length > 0 ? (
              filteredTerms.map((t, i) => (
                  <Fade in={true} timeout={300 + (i * 50)} key={i}>
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            p: 2.5, 
                            borderRadius: 3, 
                            bgcolor: 'white', 
                            border: '1px solid', 
                            borderColor: 'divider',
                            transition: 'all 0.2s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderColor: 'primary.200' }
                        }}
                    >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Box sx={{ p: 0.8, borderRadius: '50%', bgcolor: 'primary.50', color: 'primary.main' }}>
                                    <Bookmark size={16} />
                                </Box>
                                <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                                    {t.term}
                                </Typography>
                            </Stack>
                            {t.count > 1 && (
                                <Chip 
                                  label={`${t.count}回出現`} 
                                  size="small" 
                                  sx={{ bgcolor: 'slate.50', color: 'slate.500', fontWeight: 'bold', fontSize: '0.65rem', height: 20 }} 
                                />
                            )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ pl: 5, lineHeight: 1.6, fontSize: '0.9rem' }}>
                            {t.def}
                        </Typography>
                    </Paper>
                  </Fade>
              ))
          ) : (
              <Box textAlign="center" py={8} color="text.disabled">
                  <Filter size={48} className="mx-auto mb-2 opacity-20" />
                  <Typography variant="body2" fontWeight="bold">
                      {searchQuery ? "一致する用語がありません" : "用語データがありません"}
                  </Typography>
              </Box>
          )}
      </Stack>
    </Container>
  );
};

export default VocabularyLibrary;