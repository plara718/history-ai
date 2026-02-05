import React, { useState, useEffect } from 'react';
import { 
  Box, Button, TextField, Typography, Container, Paper, Stack, 
  Divider, CircularProgress, Accordion, AccordionSummary, AccordionDetails, 
  Alert, ToggleButton, ToggleButtonGroup 
} from '@mui/material';
import { BarChart, Search, ChevronDown, CheckCircle, AlertTriangle, ArrowLeft, Settings, Zap, FlaskConical } from 'lucide-react';
import { collection, query, getDocs, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callAI } from '../lib/api'; 
import { APP_ID } from '../lib/constants';
import MarkdownLite from '../components/MarkdownLite';

const AdminDashboard = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const [targetUid, setTargetUid] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // システム設定ステート
  const [appMode, setAppMode] = useState("production"); // "production" or "test"
  const [globalLoading, setGlobalLoading] = useState(false);

  // 分析・介入ステート
  const [analysisReport, setAnalysisReport] = useState(null);
  const [interventionFocus, setInterventionFocus] = useState("");
  const [interventionInterest, setInterventionInterest] = useState("");
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // 初回読み込み時にグローバル設定を取得
  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'settings', 'global'));
        if (snap.exists()) {
          setAppMode(snap.data().appMode || "production");
        }
      } catch (e) { console.error("設定取得失敗", e); }
    };
    fetchGlobalSettings();
  }, []);

  const handleBackToApp = () => { window.location.hash = ''; };

  // グローバル設定の保存
  const handleSaveGlobalSettings = async (event, newMode) => {
    if (!newMode || newMode === appMode) return;
    setGlobalLoading(true);
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'settings', 'global'), {
        appMode: newMode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setAppMode(newMode);
      setSuccessMsg(`システムモードを ${newMode === 'production' ? '本番' : 'テスト'} に切り替えました。`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setErrorMsg("設定の更新に失敗しました。");
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!targetUid) return;
    setLoading(true);
    setErrorMsg(null);
    setLogs([]);
    setAnalysisReport(null);
    try {
      const q = query(
        collection(db, 'artifacts', APP_ID, 'users', targetUid, 'daily_progress'),
        orderBy('timestamp', 'desc'), limit(10)
      );
      const snapshot = await getDocs(q);
      const fetchedLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (fetchedLogs.length === 0) {
          setErrorMsg("データが見つかりませんでした。");
      } else {
          setLogs(fetchedLogs);
          const settingsSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'interventions', targetUid));
          if (settingsSnap.exists()) {
              const s = settingsSnap.data();
              setInterventionFocus(s.focus || "");
              setInterventionInterest(s.interest || "");
          }
      }
    } catch (e) { setErrorMsg("データの取得に失敗しました。"); } finally { setLoading(false); }
  };

  const handleAnalyze = async () => {
    if (!targetUid || logs.length === 0) return;
    setAnalyzing(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const logSummary = logs.map(l => {
          const score = l.essayGrading?.score || {};
          return `- 日付: ${l.timestamp ? new Date(l.timestamp).toLocaleDateString() : '不詳'}\n- 単元: ${l.content?.theme || '不詳'}\n- 評価: K${score.k}/L${score.l}\n- 振り返り: ${l.reflection || '無'}`;
      }).join("\n");

      const prompt = `分析依頼：以下の学習ログから生徒の弱点と褒めポイントを特定せよ。\n${logSummary}\nJSON形式 { "report": "Markdown", "suggested_focus": "コマンド", "suggested_interest": "雑学" }`;
      const res = await callAI("管理者分析", prompt, apiKey);
      if (res) {
          setAnalysisReport(res.report);
          setInterventionFocus(res.suggested_focus);
          setInterventionInterest(res.suggested_interest);
          setSuccessMsg("AI分析が完了しました。");
      }
    } catch (e) { setErrorMsg("分析エラーが発生しました。"); } finally { setAnalyzing(false); }
  };

  const handleSaveSettings = async () => {
      if (!targetUid) return;
      try {
          await setDoc(doc(db, 'artifacts', APP_ID, 'interventions', targetUid), {
              focus: interventionFocus, interest: interventionInterest, updatedAt: new Date().toISOString()
          }, { merge: true });
          setSuccessMsg("介入設定を保存しました。");
          setTimeout(() => setSuccessMsg(null), 3000);
      } catch (e) { setErrorMsg("保存に失敗しました。"); }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4, minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={4}>
          <Button onClick={handleBackToApp} startIcon={<ArrowLeft />} color="inherit">戻る</Button>
          <Typography variant="h5" fontWeight="900" color="slate.800" sx={{ flexGrow: 1 }}>管理者ダッシュボード</Typography>
      </Stack>

      {/* グローバルシステム設定 */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 3, border: '2px solid', borderColor: 'indigo.100', bgcolor: 'white' }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="indigo.700" display="flex" alignItems="center" gap={1}>
              <Settings size={18}/> システム全体設定（AIモデル切替）
          </Typography>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mt={2}>
              <Box>
                  <Typography variant="body2" fontWeight="bold">AI動作モード</Typography>
                  <Typography variant="caption" color="text.secondary">選択したモデルがアプリ全体に即座に適用されます</Typography>
              </Box>
              <ToggleButtonGroup
                  value={appMode}
                  exclusive
                  onChange={handleSaveGlobalSettings}
                  disabled={globalLoading}
                  size="small"
                  color="primary"
              >
                  <ToggleButton value="production" sx={{ px: 3, fontWeight: 'bold', gap: 1 }}>
                      <Zap size={14} /> 本番 (Gemini 3.0 Flash)
                  </ToggleButton>
                  <ToggleButton value="test" sx={{ px: 3, fontWeight: 'bold', gap: 1 }}>
                      <FlaskConical size={14} /> テスト (Gemma 3)
                  </ToggleButton>
              </ToggleButtonGroup>
          </Stack>
      </Paper>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}

      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 3, border: '1px solid', borderColor: 'slate.200' }}>
          <Stack direction="row" spacing={2}>
              <TextField label="生徒のUID" fullWidth value={targetUid} onChange={(e) => setTargetUid(e.target.value)} variant="outlined" size="small" />
              <Button variant="contained" onClick={handleSearch} disabled={loading || !targetUid} startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <Search />} sx={{ px: 4, fontWeight: 'bold' }}>取得</Button>
          </Stack>
      </Paper>

      {logs.length > 0 && (
          <div className="animate-fade-in">
              <Typography variant="h6" fontWeight="bold" gutterBottom color="slate.700" display="flex" alignItems="center" gap={1}>
                  <BarChart size={20}/> 学習履歴
              </Typography>
              <Stack spacing={2} mb={4}>
                  {logs.map((log) => (
                      <Accordion key={log.id} elevation={0} sx={{ border: '1px solid', borderColor: 'slate.200', borderRadius: '12px !important' }}>
                          <AccordionSummary expandIcon={<ChevronDown />}>
                              <Stack direction="row" alignItems="center" spacing={2} width="100%">
                                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>{log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "-"}</Typography>
                                  <Typography variant="subtitle2" fontWeight="bold" sx={{ flexGrow: 1 }}>{log.content?.theme}</Typography>
                                  {log.content?.completed && <CheckCircle size={16} className="text-emerald-500" />}
                              </Stack>
                          </AccordionSummary>
                          <AccordionDetails sx={{ bgcolor: 'slate.50' }}>
                              <Typography variant="caption" fontWeight="bold">記述スコア: K{log.essayGrading?.score?.k}/L{log.essayGrading?.score?.l}</Typography>
                          </AccordionDetails>
                      </Accordion>
                  ))}
              </Stack>
              <Box textAlign="center" mb={4}>
                  <Button variant="contained" color="secondary" onClick={handleAnalyze} disabled={analyzing} startIcon={analyzing ? <CircularProgress size={20} color="inherit"/> : <BarChart />} sx={{ borderRadius: 4, py: 1.5, px: 4, fontWeight: 'bold' }}>AI分析を実行</Button>
              </Box>
              {analysisReport && <Paper elevation={0} sx={{ p: 3, mb: 4, bgcolor: 'indigo.50', borderRadius: 3 }}><MarkdownLite text={analysisReport} /></Paper>}
              <Paper elevation={3} sx={{ p: 4, borderRadius: 4 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom><AlertTriangle className="text-amber-500"/> 次回の介入設定</Typography>
                  <Stack spacing={3} mt={2}>
                      <TextField label="重点指導テーマ (Focus)" value={interventionFocus} onChange={(e) => setInterventionFocus(e.target.value)} fullWidth multiline />
                      <TextField label="興味付け・雑学 (Interest)" value={interventionInterest} onChange={(e) => setInterventionInterest(e.target.value)} fullWidth multiline />
                      <Button variant="contained" size="large" onClick={handleSaveSettings} sx={{ py: 1.5, fontWeight: 'bold' }}>設定を保存</Button>
                  </Stack>
              </Paper>
          </div>
      )}
    </Container>
  );
};

export default AdminDashboard;