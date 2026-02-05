import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Container, Stack, TextField, InputAdornment, Chip } from '@mui/material';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants'; // constantsのパスを確認
import { Search, Book, Bookmark, Filter } from 'lucide-react';

const VocabularyLibrary = ({ userId }) => {
  const [terms, setTerms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTerms = async () => {
      if (!userId) return;
      try {
        const q = query(collection(db, 'artifacts', APP_ID, 'users', userId, 'vocabulary'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => d.data());
        setTerms(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTerms();
  }, [userId]);

  const filteredTerms = terms.filter(t => 
      t.term.includes(searchQuery) || t.def.includes(searchQuery)
  );

  return (
    <Container maxWidth="sm" className="animate-fade-in" sx={{ pb: 12 }}>
      
      <Box mb={4} textAlign="center">
          <Typography variant="h5" fontWeight="900" color="slate.900" gutterBottom display="flex" alignItems="center" justifyContent="center" gap={1}>
              <Book className="text-indigo-600" /> マイ用語帳
          </Typography>
          <Typography variant="body2" color="text.secondary">
              学習中に出会った重要語句のコレクションです。<br/>現在 {terms.length} 語を収録済み。
          </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 2, mb: 4, borderRadius: 3, bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}>
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

      <Stack spacing={2}>
          {loading ? (
              <Typography textAlign="center" color="text.secondary" py={4}>読み込み中...</Typography>
          ) : filteredTerms.length > 0 ? (
              filteredTerms.map((t, i) => (
                  <Paper 
                      key={i} 
                      elevation={0} 
                      sx={{ 
                          p: 3, 
                          borderRadius: 4, 
                          bgcolor: 'white', 
                          border: '1px solid', 
                          borderColor: 'slate.100',
                          transition: 'all 0.2s',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderColor: 'indigo.200' }
                      }}
                  >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Box sx={{ p: 0.8, borderRadius: '50%', bgcolor: 'indigo.50', color: 'indigo.600' }}>
                                  <Bookmark size={18} />
                              </Box>
                              <Typography variant="h6" fontWeight="bold" color="slate.800">
                                  {t.term}
                              </Typography>
                          </Stack>
                          {t.count > 1 && (
                              <Chip label={`${t.count}回`} size="small" sx={{ bgcolor: 'slate.100', color: 'slate.500', fontWeight: 'bold', fontSize: '0.7rem' }} />
                          )}
                      </Stack>
                      <Typography variant="body2" color="slate.600" sx={{ pl: 5, lineHeight: 1.7 }}>
                          {t.def}
                      </Typography>
                  </Paper>
              ))
          ) : (
              <Box textAlign="center" py={8} color="text.secondary">
                  <Filter size={48} className="mx-auto mb-2 opacity-20" />
                  <Typography variant="body2" fontWeight="bold">
                      見つかりませんでした
                  </Typography>
              </Box>
          )}
      </Stack>
    </Container>
  );
};

export default VocabularyLibrary;