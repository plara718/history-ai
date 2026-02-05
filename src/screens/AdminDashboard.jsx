import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Container, 
  Paper, 
  Stack, 
  Divider, 
  CircularProgress, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails, 
  Alert 
} from '@mui/material';
import { BarChart, Search, ChevronDown, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { collection, query, getDocs, orderBy, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
// ※ lib/api.js と components/MarkdownLite.jsx が存在することを確認してください
import { callAI } from '../lib/api'; 
import { APP_ID } from '../lib/constants';
import MarkdownLite from '../components/MarkdownLite';

const AdminDashboard = () => {
  // 環境変数からAPIキーを取得
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const [targetUid, setTargetUid] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // 分析結果ステート
  const [analysisReport, setAnalysisReport] = useState(null);
  const [interventionFocus, setInterventionFocus] = useState("");
  const [interventionInterest, setInterventionInterest] = useState("");
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // ★修正：トップ画面に戻る処理（ハッシュルーティング対応）
  const handleBackToApp = () => {
    window.location.hash = ''; 
  };

  // 1. 学習ログの取得 (daily_progressコレクションを対象)
  const handleSearch = async () => {
    if (!targetUid) return;
    setLoading(true);
    setErrorMsg(null);
    setLogs([]);
    setAnalysisReport(null);

    try {
      // ユーザーの進捗コレクションを取得
      const q = query(
        collection(db, 'artifacts', APP_ID, 'users', targetUid, 'daily_progress'),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      const fetchedLogs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      if (fetchedLogs.length === 0) {
          setErrorMsg("データが見つかりませんでした。UIDが正しいか、または学習履歴があるか確認してください。");
      } else {
          setLogs(fetchedLogs);
          // 既存の介入設定があれば取得
          const settingsSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'interventions', targetUid));
          if (settingsSnap.exists()) {
              const s = settingsSnap.data();
              setInterventionFocus(s.focus || "");
              setInterventionInterest(s.interest || "");
          }
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("データの取得に失敗しました。権限エラーの可能性があります。");
    } finally {
      setLoading(false);
    }
  };

  // 2. AI詳細分析
  const handleAnalyze = async () => {
    if (!targetUid || logs.length === 0) return;
    setAnalyzing(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // ログの要約を作成
      const logSummary = logs.map(l => {
          // true_false形式の正答率などを計算
          const score = l.essayGrading?.score || {};
          return `
          - 日付: ${l.timestamp ? new Date(l.timestamp).toLocaleDateString() : '不明'}
          - 単元: ${l.content?.theme || '不明'}
          - 記述評価: 知識${score.k || 0}/論理${score.l || 0}
          - AIフィードバック: ${l.essayGrading?.feedback || 'なし'}
          - 理解度振り返り: ${l.reflection || 'なし'}
          `;
      }).join("\n");

      const prompt = `
      あなたは「個別指導塾のベテランカリキュラムマネージャー」です。
      生徒の直近の学習ログを分析し、以下の情報をJSON形式で出力してください。

      【学習ログ】
      ${logSummary}

      【出力要件】
      1. report: 親が見るためのMarkdown形式の分析レポート（強み、弱点、褒めるポイント）。
      2. suggested_focus: 次回の学習でAIに指示する「短い介入命令」。40文字以内。
          - 良い例: 「地租改正の反対一揆について記述させよ」
          - 悪い例: 「基礎知識を定着させるために、もっと問題を解いて...」
      3. suggested_interest: 生徒の興味を引くための「歴史雑学」や「現代との対比」ネタ。

      JSON形式:
      {
        "report": "## 分析結果...",
        "suggested_focus": "...",
        "suggested_interest": "..."
      }
      `;

      const res = await callAI("管理者分析", prompt, apiKey);
      
      if (res && typeof res === 'object') {
          setAnalysisReport(res.report);
          setInterventionFocus(res.suggested_focus);
          setInterventionInterest(res.suggested_interest);
          setSuccessMsg("分析完了。推奨設定を下欄に入力しました。");
      } else {
          throw new Error("AIの応答形式が不正でした");
      }

    } catch (e) {
      console.error(e);
      setErrorMsg("分析エラー: " + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // 3. 設定の保存
  const handleSaveSettings = async () => {
      if (!targetUid) return;
      try {
          await setDoc(doc(db, 'artifacts', APP_ID, 'interventions', targetUid), {
              focus: interventionFocus,
              interest: interventionInterest,
              updatedAt: new Date().toISOString()
          }, { merge: true });
          setSuccessMsg("次回の学習設定を保存しました！");
          setTimeout(() => setSuccessMsg(null), 3000);
      } catch (e) {
          console.error(e);
          setErrorMsg("保存に失敗しました: " + e.message);
      }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4, minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* ヘッダー */}
      <Stack direction="row" alignItems="center" spacing={2} mb={4}>
          <Button onClick={handleBackToApp} startIcon={<ArrowLeft />} color="inherit">戻る</Button>
          <Typography variant="h5" fontWeight="900" color="slate.800" sx={{ flexGrow: 1 }}>
              管理者ダッシュボード
          </Typography>
      </Stack>

      {/* 検索エリア */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 3, border: '1px solid', borderColor: 'slate.200' }}>
          <Stack direction="row" spacing={2}>
              <TextField 
                  label="生徒のUID" 
                  fullWidth 
                  value={targetUid} 
                  onChange={(e) => setTargetUid(e.target.value)}
                  placeholder="App.jsxで確認したUIDを入力"
                  variant="outlined"
                  size="small"
              />
              <Button 
                  variant="contained" 
                  onClick={handleSearch} 
                  disabled={loading || !targetUid}
                  startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <Search />}
                  sx={{ px: 4, fontWeight: 'bold' }}
              >
                  取得
              </Button>
          </Stack>
      </Paper>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}

      {/* メインコンテンツ */}
      {logs.length > 0 && (
          <div className="animate-fade-in">
              {/* ログ一覧 */}
              <Typography variant="h6" fontWeight="bold" gutterBottom color="slate.700" display="flex" alignItems="center" gap={1}>
                  <BarChart size={20}/> 学習履歴 (直近{logs.length}件)
              </Typography>
              
              <Stack spacing={2} mb={4}>
                  {logs.map((log) => (
                      <Accordion key={log.id} elevation={0} sx={{ border: '1px solid', borderColor: 'slate.200', borderRadius: '12px !important', '&:before': {display:'none'} }}>
                          <AccordionSummary expandIcon={<ChevronDown />}>
                              <Stack direction="row" alignItems="center" spacing={2} width="100%">
                                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
                                      {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "日付不明"}
                                  </Typography>
                                  <Typography variant="subtitle2" fontWeight="bold" sx={{ flexGrow: 1 }}>
                                      {log.content?.theme || "タイトルなし"}
                                  </Typography>
                                  {log.content?.completed && <CheckCircle size={16} className="text-emerald-500" />}
                              </Stack>
                          </AccordionSummary>
                          <AccordionDetails sx={{ bgcolor: 'slate.50', borderRadius: '0 0 12px 12px' }}>
                              <Typography variant="caption" fontWeight="bold" color="text.secondary">AIからの講義要約:</Typography>
                              <Box maxHeight={100} overflow="auto" bgcolor="white" p={1} borderRadius={1} mb={2} border="1px solid #e2e8f0">
                                  <Typography variant="body2" fontSize="0.75rem">{log.content?.lecture?.slice(0, 200)}...</Typography>
                              </Box>
                              
                              <Stack direction="row" spacing={2}>
                                  <Box flex={1}>
                                      <Typography variant="caption" fontWeight="bold" color="text.secondary">記述スコア:</Typography>
                                      <Typography variant="body2">
                                          知識: {log.essayGrading?.score?.k || '-'}/5, 
                                          論理: {log.essayGrading?.score?.l || '-'}/5
                                      </Typography>
                                  </Box>
                                  <Box flex={1}>
                                      <Typography variant="caption" fontWeight="bold" color="text.secondary">生徒の振り返り:</Typography>
                                      <Typography variant="body2">{log.reflection || "未入力"}</Typography>
                                  </Box>
                              </Stack>
                          </AccordionDetails>
                      </Accordion>
                  ))}
              </Stack>

              <Divider sx={{ my: 4 }} />

              {/* AI分析アクション */}
              <Box textAlign="center" mb={4}>
                  <Button 
                      variant="contained" 
                      color="secondary" 
                      size="large" 
                      onClick={handleAnalyze} 
                      disabled={analyzing}
                      startIcon={analyzing ? <CircularProgress size={20} color="inherit"/> : <BarChart />}
                      sx={{ borderRadius: 4, py: 1.5, px: 4, fontWeight: 'bold', boxShadow: '0 4px 14px 0 rgba(236, 72, 153, 0.4)' }}
                  >
                      {analyzing ? "AIが分析中..." : "学習傾向をAI分析する"}
                  </Button>
              </Box>

              {/* 分析レポート表示 */}
              {analysisReport && (
                  <Paper elevation={0} sx={{ p: 3, mb: 4, bgcolor: 'indigo.50', borderRadius: 3, border: '1px solid', borderColor: 'indigo.100' }}>
                      <Typography variant="h6" fontWeight="bold" color="indigo.800" gutterBottom>
                          AI分析レポート
                      </Typography>
                      <MarkdownLite text={analysisReport} />
                  </Paper>
              )}

              {/* 介入設定フォーム */}
              <Paper elevation={3} sx={{ p: 4, borderRadius: 4 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom display="flex" alignItems="center" gap={1}>
                      <AlertTriangle className="text-amber-500"/> 次回の指導設定 (介入)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                      ここに入力した内容は、次回のAI授業生成時に「最優先指示」として反映されます。
                  </Typography>

                  <Stack spacing={3}>
                      <TextField
                          label="重点指導テーマ (Focus)"
                          value={interventionFocus}
                          onChange={(e) => setInterventionFocus(e.target.value)}
                          helperText="例: 「地租改正の反対一揆について記述させよ」（AIが提案した内容を修正して使用）"
                          fullWidth
                          multiline
                      />
                      <TextField
                          label="興味付け・雑学 (Interest)"
                          value={interventionInterest}
                          onChange={(e) => setInterventionInterest(e.target.value)}
                          helperText="例: 「当時の農民の負担を現代の金額で例えると？」"
                          fullWidth
                          multiline
                      />
                      <Button 
                          variant="contained" 
                          size="large" 
                          onClick={handleSaveSettings}
                          sx={{ py: 1.5, fontWeight: 'bold' }}
                      >
                          設定を保存して適用
                      </Button>
                  </Stack>
              </Paper>
          </div>
      )}
    </Container>
  );
};

export default AdminDashboard;