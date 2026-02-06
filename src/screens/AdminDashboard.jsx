import React, { useState, useEffect } from 'react';
import { 
  Box, Button, TextField, Typography, Container, Paper, Stack, 
  CircularProgress, Accordion, AccordionSummary, AccordionDetails, 
  Alert, ToggleButton, ToggleButtonGroup 
} from '@mui/material';
import { 
  BarChart as ChartIcon, 
  Search as SearchIcon, 
  ExpandMore as ChevronDown, 
  CheckCircle as CheckIcon, 
  Warning as AlertIcon, 
  ArrowBack as ArrowLeft, 
  Settings as SettingsIcon, 
  Bolt as ProductionIcon, 
  Science as TestIcon 
} from '@mui/icons-material';
import { collection, query, getDocs, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callAI } from '../lib/api'; 
import { APP_ID } from '../lib/constants';
import { SafeMarkdown } from '../components/SafeMarkdown'; // ★SafeMarkdownに変更

const AdminDashboard = () => {
  // 管理者画面では、通常アプリで使うキーではなく、管理者専用キー（SettingsModalで保存されたもの）を使う想定
  // または、.envのキーをフォールバックとして使用
  const apiKey = localStorage.getItem('gemini_api_key_admin') || import.meta.env.VITE_GEMINI_API_KEY;

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

  // グローバル設定の保存（全ユーザーに影響）
  const handleSaveGlobalSettings = async (event, newMode) => {
    if (!newMode || newMode === appMode) return;
    setGlobalLoading(true);
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'settings', 'global'), {
        appMode: newMode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setAppMode(newMode);
      setSuccessMsg(`システムモードを ${newMode === 'production' ? '本番 (安定版)' : 'テスト (実験版)'} に切り替えました。`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setErrorMsg("設定の更新に失敗しました。権限を確認してください。");
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
          setErrorMsg("学習データが見つかりませんでした。");
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
      // ログの要約を作成
      const logSummary = logs.map(l => {
          const score = l.gradingResult?.score || 0; // 新データ構造に対応
          return `- 日付: ${l.timestamp ? new Date(l.timestamp).toLocaleDateString() : '不詳'}\n- テーマ: ${l.content?.theme || '不詳'}\n- スコア: ${score}/10\n- モード: ${l.learningMode}`;
      }).join("\n");

      const prompt = `
      あなたは学習指導のプロです。以下の学習ログから生徒の現在の弱点と、次に伸ばすべき長所を分析してください。
      
      【学習ログ】
      ${logSummary}

      【出力形式: JSON】
      {
        "report": "分析レポート（生徒へのフィードバック調で、Markdown形式）",
        "suggested_focus": "次回のAI生成時に重点的に解説させるべきテーマ（例：鎌倉仏教の教義の違い）",
        "suggested_interest": "生徒の興味を引くための歴史雑学ネタ"
      }
      `;
      
      // 管理者として分析を実行（UIDは管理者自身のもの等は不要なのでダミー等で処理、またはcallAIがUID不要なら省略）
      // ここでは分析用の単純な呼び出しとして実行
      const res = await callAI("管理者分析", prompt, apiKey, "ADMIN_USER");
      
      if (res) {
          setAnalysisReport(res.report);
          setInterventionFocus(res.suggested_focus);
          setInterventionInterest(res.suggested_interest);
          setSuccessMsg("AI分析が完了しました。介入設定に反映されています。");
      }
    } catch (e) { 
        console.error(e);
        setErrorMsg(`分析エラー: ${e.message}`); 
    } finally { setAnalyzing(false); }
  };

  const handleSaveSettings = async () => {
      if (!targetUid) return;
      try {
          await setDoc(doc(db, 'artifacts', APP_ID, 'interventions', targetUid), {
              focus: interventionFocus, 
              interest: interventionInterest, 
              updatedAt: new Date().toISOString(),
              adminId: "ADMIN" 
          }, { merge: true });
          setSuccessMsg("次回生成時の介入設定を保存しました。");
          setTimeout(() => setSuccessMsg(null), 3000);
      } catch (e) { setErrorMsg("保存に失敗しました。"); }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4, minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={4}>
          <Button onClick={handleBackToApp} startIcon={<ArrowLeft />} color="inherit" sx={{ fontWeight: 'bold' }}>アプリに戻る</Button>
          <Typography variant="h5" fontWeight="900" color="text.primary" sx={{ flexGrow: 1 }}>
            管理者コンソール
          </Typography>
      </Stack>

      {/* グローバルシステム設定 */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 3, border: '2px solid', borderColor: 'indigo.100', bgcolor: 'white' }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary" display="flex" alignItems="center" gap={1}>
              <SettingsIcon fontSize="small"/> システム全体設定（AIモデル切替）
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" mt={2} spacing={2}>
              <Box>
                  <Typography variant="body2" fontWeight="bold">AI動作モード</Typography>
                  <Typography variant="caption" color="text.secondary">選択したモデルが全ユーザーに適用されます</Typography>
              </Box>
              <ToggleButtonGroup
                  value={appMode}
                  exclusive
                  onChange={handleSaveGlobalSettings}
                  disabled={globalLoading}
                  size="small"
                  color="primary"
                  fullWidth={false}
              >
                  <ToggleButton value="production" sx={{ px: 3, fontWeight: 'bold', gap: 1 }}>
                      {globalLoading ? <CircularProgress size={16}/> : <ProductionIcon fontSize="small" />} 本番 (Gemini 2.5)
                  </ToggleButton>
                  <ToggleButton value="test" sx={{ px: 3, fontWeight: 'bold', gap: 1 }}>
                      {globalLoading ? <CircularProgress size={16}/> : <TestIcon fontSize="small" />} テスト (Gemma 3)
                  </ToggleButton>
              </ToggleButtonGroup>
          </Stack>
      </Paper>

      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{errorMsg}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{successMsg}</Alert>}

      {/* 生徒検索 */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 3, border: '1px solid', borderColor: '#e2e8f0' }}>
          <Stack direction="row" spacing={2}>
              <TextField 
                label="生徒UIDを入力" 
                fullWidth 
                value={targetUid} 
                onChange={(e) => setTargetUid(e.target.value)} 
                variant="outlined" 
                size="small" 
                placeholder="settings画面からコピーしたUID"
              />
              <Button 
                variant="contained" 
                onClick={handleSearch} 
                disabled={loading || !targetUid} 
                startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <SearchIcon />} 
                sx={{ px: 4, fontWeight: 'bold', boxShadow: 2 }}
              >
                検索
              </Button>
          </Stack>
      </Paper>

      {logs.length > 0 && (
          <div className="animate-fade-in">
              <Typography variant="h6" fontWeight="bold" gutterBottom color="text.secondary" display="flex" alignItems="center" gap={1}>
                  <ChartIcon fontSize="small"/> 直近の学習履歴
              </Typography>
              
              <Stack spacing={2} mb={4}>
                  {logs.map((log) => {
                      const score = log.gradingResult?.score || 0;
                      return (
                          <Accordion key={log.id} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '8px !important', '&:before': {display: 'none'} }}>
                              <AccordionSummary expandIcon={<ChevronDown />}>
                                  <Stack direction="row" alignItems="center" spacing={2} width="100%">
                                      <Typography variant="caption" sx={{ minWidth: 80, color: 'text.secondary', fontFamily: 'monospace' }}>
                                          {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "-"}
                                      </Typography>
                                      <Box flexGrow={1}>
                                          <Typography variant="subtitle2" fontWeight="bold">{log.content?.theme || "No Theme"}</Typography>
                                          <Typography variant="caption" color="text.secondary">{log.learningMode === 'school' ? '定期テスト' : '入試対策'}</Typography>
                                      </Box>
                                      {log.completed && <CheckIcon fontSize="small" color="success" />}
                                      <Box 
                                        sx={{ 
                                            bgcolor: score >= 8 ? '#f0fdf4' : score >= 5 ? '#fefce8' : '#fef2f2',
                                            color: score >= 8 ? '#166534' : score >= 5 ? '#854d0e' : '#991b1b',
                                            px: 1, py: 0.5, borderRadius: 1, fontWeight: 'bold', fontSize: '0.8rem'
                                        }}
                                      >
                                          Score: {score}
                                      </Box>
                                  </Stack>
                              </AccordionSummary>
                              <AccordionDetails sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                                  <Typography variant="caption" fontWeight="bold" display="block" mb={1}>AI採点コメント:</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                      {log.gradingResult?.comment || "コメントなし"}
                                  </Typography>
                              </AccordionDetails>
                          </Accordion>
                      );
                  })}
              </Stack>

              <Box textAlign="center" mb={4}>
                  <Button 
                    variant="contained" 
                    color="secondary" 
                    onClick={handleAnalyze} 
                    disabled={analyzing} 
                    startIcon={analyzing ? <CircularProgress size={20} color="inherit"/> : <ChartIcon />} 
                    sx={{ borderRadius: 4, py: 1.5, px: 4, fontWeight: 'bold', boxShadow: 3 }}
                  >
                    AIで学習傾向を分析する
                  </Button>
              </Box>

              {analysisReport && (
                  <Paper elevation={0} sx={{ p: 3, mb: 4, bgcolor: '#eef2ff', borderRadius: 3, border: '1px solid #c7d2fe' }}>
                      <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>AI分析レポート</Typography>
                      <SafeMarkdown content={analysisReport} />
                  </Paper>
              )}

              <Paper elevation={3} sx={{ p: 4, borderRadius: 4, border: '1px solid #cbd5e1' }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom display="flex" alignItems="center" gap={1}>
                      <AlertIcon color="warning"/> 次回生成への介入設定 (Teacher Intervention)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                      ここで設定した内容は、この生徒が次回「学習をはじめる」を押した際のプロンプトに強制挿入されます。
                  </Typography>
                  
                  <Stack spacing={3}>
                      <TextField 
                        label="重点指導テーマ (Focus)" 
                        value={interventionFocus} 
                        onChange={(e) => setInterventionFocus(e.target.value)} 
                        fullWidth 
                        multiline 
                        rows={2}
                        placeholder="例: 鎌倉新仏教の開祖と宗派の違いを重点的に解説せよ"
                        helperText="AIへの具体的な指導指示になります"
                      />
                      <TextField 
                        label="興味付け・雑学 (Interest)" 
                        value={interventionInterest} 
                        onChange={(e) => setInterventionInterest(e.target.value)} 
                        fullWidth 
                        multiline 
                        rows={2}
                        placeholder="例: 当時の食生活に関する雑学を入れて興味を惹け"
                      />
                      <Button 
                        variant="contained" 
                        size="large" 
                        onClick={handleSaveSettings} 
                        sx={{ py: 1.5, fontWeight: 'bold', boxShadow: 2 }}
                      >
                        介入設定を保存
                      </Button>
                  </Stack>
              </Paper>
          </div>
      )}
    </Container>
  );
};

export default AdminDashboard;