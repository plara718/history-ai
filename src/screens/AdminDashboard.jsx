import React, { useState } from 'react';
import { Box, Button, Typography, Paper, Stack, Divider, Chip, CircularProgress, Alert, TextField, Switch, FormControlLabel } from '@mui/material';
import { query, collection, getDocs, limit, orderBy, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { callAI } from '../lib/api';
import { BarChart2, Search, Brain, Save, Settings, PenTool, Sparkles, Wand2, LogOut, FileText, Edit3, X } from 'lucide-react';
import MarkdownLite from '../components/MarkdownLite';

const AdminDashboard = ({ onExit, apiKey }) => {
  const [targetUid, setTargetUid] = useState("");
  const [logs, setLogs] = useState([]);
  
  // 分析結果
  const [analysisReport, setAnalysisReport] = useState("");
  
  // コラムデータ
  const [draftColumn, setDraftColumn] = useState("");
  const [isEditingColumn, setIsEditingColumn] = useState(false); // ★追加: 編集モードフラグ
  
  // 介入設定（次回用）
  const [interventionFocus, setInterventionFocus] = useState("");
  const [interventionInterest, setInterventionInterest] = useState("");
  const [deliverColumn, setDeliverColumn] = useState(true);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingColumn, setIsGeneratingColumn] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // 1. 生徒ID検索
  const handleSearch = async () => {
    if (!targetUid) return;
    setIsSearching(true);
    setError(null);
    setLogs([]);
    setAnalysisReport("");
    setDraftColumn("");
    setIsEditingColumn(false);

    try {
      const q = query(
          collection(db, 'artifacts', APP_ID, 'users', targetUid, 'daily_progress'), 
          orderBy('timestamp', 'desc'), 
          limit(5)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
          setError("学習ログが見つかりませんでした。");
      } else {
          setLogs(snap.docs.map(d => d.data()));
          
          try {
              const intSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'interventions', targetUid));
              if (intSnap.exists()) {
                  const d = intSnap.data();
                  setInterventionFocus(d.focus || "");
                  setInterventionInterest(d.interest || "");
                  if (d.column_override) {
                      setDraftColumn(d.column_override);
                      setDeliverColumn(true);
                  } else {
                      setDeliverColumn(false);
                  }
              }
          } catch (e) { console.log("No existing intervention"); }
      }
    } catch (e) {
      console.error(e);
      setError("データの取得に失敗しました。");
    } finally {
      setIsSearching(false);
    }
  };

  // 2. AI分析
  const handleAnalyze = async () => {
    if (!targetUid || logs.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const logSummary = logs.map(l => {
          return `
          - 日付: ${l.timestamp ? new Date(l.timestamp).toLocaleDateString() : '不明'}
          - テーマ: ${l.content?.theme || '不明'}
          - 記述スコア: 知${l.essayGrading?.score?.k || 0}/論${l.essayGrading?.score?.l || 0}
          - AI指摘: ${l.essayGrading?.feedback || 'なし'}
          `;
      }).join("\n");

      const prompt = `
      あなたは「個別指導塾のカリキュラムマネージャー」です。
      生徒の学習ログを分析し、以下の2つを出力してください。
      
      1. **管理者向け分析レポート**: 成績傾向、課題点、および**「次回どのような指導（介入）をすべきか」の具体的なアドバイス**を含めたMarkdown文章。
      2. **次回の指導ポイント案**: 次のAI生成時にシステムに入力するための短文指示。**ここを空欄にすることは許されません。必ず何らかの具体的な指示を出してください。**

      【学習ログ】
      ${logSummary}

      【必須要件】
      - "suggested_focus" は、「次は〇〇時代を扱う」「〇〇の視点を入れる」など、必ず具体的な指示を入れること。
      - "suggested_interest" も、「生徒のモチベーションを上げるためのネタ」を必ず提案すること。

      出力は以下のJSON形式のみで行ってください。
      {
        "report": "## 成績分析\n...\n## 次回の介入アドバイス\n...",
        "suggested_focus": "（必須）例：明治維新の経済への影響を重点的に解説せよ",
        "suggested_interest": "（必須）例：現代のスタートアップ企業になぞらえて"
      }
      `;

      const res = await callAI("管理者分析", prompt, apiKey);
      
      if (res && typeof res === 'object') {
          setAnalysisReport(res.report || "分析レポートの生成に失敗しました");
          setInterventionFocus(res.suggested_focus || "（AIが提案を作成できませんでした。手動で入力してください）");
          setInterventionInterest(res.suggested_interest || "（AIが提案を作成できませんでした。手動で入力してください）");
      } else {
          setAnalysisReport(res);
      }
      setSuccessMsg("分析が完了しました。下部の設定欄に推奨プランが入力されています。");

    } catch (e) {
      console.error(e);
      setError("分析エラー: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 3. コラム生成
  const handleGenerateColumn = async () => {
      if (!targetUid) return;
      setIsGeneratingColumn(true);
      setError(null);
      setIsEditingColumn(false); // 生成時はプレビューモードに戻す
      
      try {
          const recentThemes = logs.map(l => l.content?.theme).join(", ");
          
          const prompt = `
          あなたは「歴史専門誌の編集者」です。
          歴史学習中の生徒を持つ保護者（教養ある大人）に向けて、読み応えのある「歴史教養コラム」を執筆してください。
          このコラムは、生徒本人が読んでも学びになる内容にしてください。

          【前提情報】
          - 子供が最近学習したテーマ: ${recentThemes}
          - 子供の次回の重点テーマ: ${interventionFocus || "特になし"}

          【執筆要件】
          1. **ターゲット**: 大人（保護者）および意欲ある学生。
          2. **視点**: 単なる事実の羅列ではなく、「当時の経済事情」「政治家の人間ドラマ」「現代社会構造との類似点」など、知的好奇心を刺激する切り口。
          3. **構成**: タイトル + 本文（800文字程度）。Markdown形式。

          出力形式(JSON): { "text": "# タイトル\n\n本文..." }
          `;

          const res = await callAI("教養コラム生成", prompt, apiKey);
          const columnText = res.text || res.column || res.content || res; 
          setDraftColumn(columnText);
          setDeliverColumn(true);
          setSuccessMsg("コラムを生成しました。内容を確認してください。");

      } catch (e) {
          console.error(e);
          setError("コラム生成エラー: " + e.message);
      } finally {
          setIsGeneratingColumn(false);
      }
  };

  // 4. 設定保存
  const handleSaveIntervention = async () => {
      if (!targetUid) return;
      setIsSaving(true);
      try {
          const columnToSave = deliverColumn ? draftColumn : null;

          await setDoc(doc(db, 'artifacts', APP_ID, 'interventions', targetUid), {
              focus: interventionFocus,
              interest: interventionInterest,
              column_override: columnToSave,
              updatedAt: Date.now()
          });
          setSuccessMsg("次回の学習設定を保存しました。");
          setIsEditingColumn(false);
      } catch (e) {
          setError("保存エラー: " + e.message);
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-black text-violet-800 flex items-center gap-2 tracking-tight">
            <Settings className="w-6 h-6 text-violet-600" /> 学習管理コンソール
          </h1>
          <Button 
            variant="outlined" 
            color="error" 
            size="small" 
            startIcon={<LogOut size={16} />}
            onClick={onExit}
            sx={{ borderRadius: 3, fontWeight: 'bold' }}
          >
            終了
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 mt-4">
        {/* 生徒検索 */}
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, bgcolor: 'white', mb: 4, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" mb={2}>
                対象生徒ID (UID)
            </Typography>
            <Stack direction="row" spacing={2}>
                <TextField 
                    fullWidth 
                    placeholder="UIDを入力..." 
                    value={targetUid}
                    onChange={(e) => setTargetUid(e.target.value)}
                    variant="outlined"
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button 
                    variant="contained" 
                    onClick={handleSearch}
                    disabled={isSearching || !targetUid}
                    sx={{ borderRadius: 2, bgcolor: 'violet.600', fontWeight: 'bold', px: 4, '&:hover': { bgcolor: 'violet.700' } }}
                    startIcon={isSearching ? <CircularProgress size={20} color="inherit"/> : <Search />}
                >
                    検索
                </Button>
            </Stack>
        </Paper>

        {logs.length > 0 && (
            <>
                {/* 1. 分析レポートエリア */}
                <Paper elevation={0} sx={{ p: 4, borderRadius: 4, bgcolor: 'white', mb: 4, border: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                        <Typography variant="h6" fontWeight="bold" display="flex" alignItems="center" gap={2}>
                            <BarChart2 className="text-violet-600" /> 直近の学習ログ
                        </Typography>
                        <Chip label={`${logs.length}件`} size="small" sx={{ bgcolor: 'violet.50', color: 'violet.700', fontWeight: 'bold' }} />
                    </Stack>
                    
                    <Stack spacing={1} mb={4}>
                        {logs.map((log, i) => (
                            <div key={i} className="p-2 px-3 rounded-lg bg-slate-50 border border-slate-100 text-sm flex justify-between items-center">
                                <span className="font-bold text-slate-700">{log.content?.theme}</span>
                                <div className="flex gap-2">
                                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">知 {log.essayGrading?.score?.k||0}</span>
                                    <span className="text-xs px-2 py-0.5 rounded bg-pink-100 text-pink-700 font-bold">論 {log.essayGrading?.score?.l||0}</span>
                                </div>
                            </div>
                        ))}
                    </Stack>

                    <Button 
                        variant="contained" 
                        fullWidth 
                        disabled={isAnalyzing}
                        onClick={handleAnalyze}
                        sx={{ py: 2, borderRadius: 3, bgcolor: 'violet.600', fontWeight: 'bold', boxShadow: 2, '&:hover': { bgcolor: 'violet.800' } }}
                        startIcon={isAnalyzing ? <CircularProgress size={20} color="inherit"/> : <Brain />}
                    >
                        {isAnalyzing ? "AIが分析中..." : "現状分析と推奨プランを作成"}
                    </Button>

                    {analysisReport && (
                        <Box mt={4} className="animate-fade-in">
                            <Alert severity="info" icon={<Sparkles />} sx={{ mb: 2, borderRadius: 2, fontWeight: 'bold' }}>
                                AIによる分析結果
                            </Alert>
                            <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'slate.50', border: '1px solid', borderColor: 'slate.200' }}>
                                <MarkdownLite text={analysisReport} />
                            </Box>
                        </Box>
                    )}
                </Paper>

                {/* 2. コラム生成・確認エリア（修正） */}
                <Paper elevation={0} sx={{ p: 4, borderRadius: 4, bgcolor: 'white', mb: 4, border: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6" fontWeight="bold" display="flex" alignItems="center" gap={2}>
                            <FileText className="text-violet-600" /> 教養コラム (保護者・生徒共有)
                        </Typography>
                        <Button 
                            size="small" 
                            variant="outlined" 
                            color="secondary" 
                            onClick={handleGenerateColumn}
                            disabled={isGeneratingColumn}
                            startIcon={isGeneratingColumn ? <CircularProgress size={14} color="inherit"/> : <Wand2 size={14}/>}
                        >
                            {isGeneratingColumn ? "生成中..." : draftColumn ? "AIで作り直す" : "AIでコラム案を作成"}
                        </Button>
                    </Stack>
                    
                    {!draftColumn ? (
                        <Box py={4} textAlign="center" color="text.secondary" bgcolor="slate.50" borderRadius={2} border="1px dashed" borderColor="slate.300">
                            <Typography variant="body2">
                                右上のボタンを押すと、AIが保護者向けのコラムを生成します。
                            </Typography>
                        </Box>
                    ) : (
                        <Box>
                             {/* プレビュー or 編集モードの切り替え */}
                             {!isEditingColumn ? (
                                 <Box className="animate-fade-in">
                                     <Paper elevation={0} sx={{ p: 3, mb: 2, borderRadius: 3, bgcolor: 'indigo.50', border: '1px solid', borderColor: 'indigo.100' }}>
                                         {/* プレビュー表示 */}
                                         <MarkdownLite text={draftColumn} />
                                     </Paper>
                                     <Button 
                                         size="small" 
                                         startIcon={<Edit3 size={16} />} 
                                         onClick={() => setIsEditingColumn(true)}
                                         sx={{ color: 'text.secondary' }}
                                     >
                                         手動で内容を修正する
                                     </Button>
                                 </Box>
                             ) : (
                                 <Box className="animate-fade-in">
                                     <TextField 
                                         fullWidth 
                                         multiline
                                         rows={10}
                                         placeholder="コラム本文..."
                                         value={draftColumn}
                                         onChange={(e) => setDraftColumn(e.target.value)}
                                         sx={{ mb: 2, bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                     />
                                     <Button 
                                         size="small" 
                                         startIcon={<X size={16} />} 
                                         onClick={() => setIsEditingColumn(false)}
                                         variant="outlined"
                                         color="inherit"
                                     >
                                         修正を終了（プレビューに戻る）
                                     </Button>
                                 </Box>
                             )}
                        </Box>
                    )}
                </Paper>

                {/* 3. 次回レッスン介入設定エリア */}
                <Paper elevation={0} sx={{ p: 4, borderRadius: 4, bgcolor: 'violet.50', border: '1px solid', borderColor: 'violet.200' }}>
                    <Typography variant="h6" fontWeight="bold" color="violet.900" mb={3} display="flex" alignItems="center" gap={2}>
                        <PenTool className="text-violet-600" /> 次回レッスンの設定 (AI介入)
                    </Typography>
                    
                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="caption" fontWeight="bold" color="violet.800" gutterBottom>
                                重点指導ポイント (Focus)
                            </Typography>
                            <TextField 
                                fullWidth 
                                multiline
                                rows={2}
                                placeholder="AI分析結果から自動入力されます（修正可）"
                                value={interventionFocus}
                                onChange={(e) => setInterventionFocus(e.target.value)}
                                sx={{ bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="caption" fontWeight="bold" color="violet.800" gutterBottom>
                                生徒の興味・関心 (Interest)
                            </Typography>
                            <TextField 
                                fullWidth 
                                placeholder="例：サッカー、戦国武将、現代ビジネス..."
                                value={interventionInterest}
                                onChange={(e) => setInterventionInterest(e.target.value)}
                                sx={{ bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                        </Box>

                        <Divider sx={{ borderColor: 'violet.200' }} />

                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="subtitle2" fontWeight="bold" color="violet.900">
                                    コラムの配信設定
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    上記で作成したコラムを、次回の学習結果画面に表示しますか？
                                </Typography>
                            </Box>
                            <FormControlLabel
                                control={
                                    <Switch 
                                        checked={deliverColumn}
                                        onChange={(e) => setDeliverColumn(e.target.checked)}
                                        color="secondary"
                                    />
                                }
                                label={deliverColumn ? "配信する" : "配信しない"}
                                sx={{ '& .MuiTypography-root': { fontWeight: 'bold', color: deliverColumn ? 'secondary.main' : 'text.disabled' } }}
                            />
                        </Box>

                        <Button 
                            variant="contained" 
                            size="large"
                            onClick={handleSaveIntervention}
                            disabled={isSaving}
                            sx={{ py: 1.5, borderRadius: 3, bgcolor: 'violet.700', fontWeight: 'bold', boxShadow: 3, '&:hover': { bgcolor: 'violet.900' } }}
                            startIcon={isSaving ? <CircularProgress size={20} color="inherit"/> : <Save />}
                        >
                            {isSaving ? "保存中..." : "この設定で次回レッスンを確定"}
                        </Button>
                    </Stack>

                    {successMsg && <Alert severity="success" sx={{ mt: 3, borderRadius: 2 }}>{successMsg}</Alert>}
                    {error && <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>{error}</Alert>}
                </Paper>
            </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;