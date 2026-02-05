import { useState, useRef } from 'react';
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callAI } from '../lib/api';
import { APP_ID, MAX_DAILY_SESSIONS } from '../lib/constants';
import { getTodayString, validateLessonData, getFlattenedQuestions, dismissKeyboard } from '../lib/utils';

export const useStudySession = (userId) => {
  const [currentData, setDailyData] = useState(null); // App.jsxとの整合性のため dailyData -> currentData としても使えるように
  const [userAnswers, setUserAnswers] = useState({});
  const [qIndex, setQIndex] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [essayGrading, setEssayGrading] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [activeSession, setActiveSession] = useState(1);
  const [viewingSession, setViewingSession] = useState(1);
  
  const [historyMeta, setHistoryMeta] = useState({});
  const [heatmapStats, setHeatmapStats] = useState({});
  
  const [processingError, setProcessingError] = useState(null);
  const scoreRef = useRef(null);

  // セッションデータの読み込み
  const loadSession = async (sessionNum) => {
    if (!userId) return;
    try {
      const today = getTodayString();
      const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`));
      if (snap.exists()) {
        const d = snap.data();
        // contentプロパティがあればそれを、なければdそのものを(互換性)
        const contentData = d.content || d;
        const safeContent = validateLessonData(contentData);
        
        if (safeContent) {
          // App.jsxは { content: ... } の形を期待している箇所があるため整形
          setDailyData({ ...d, content: safeContent });
          setUserAnswers(d.userAnswers || {});
          setQIndex(d.qIndex || 0);
          setEssayGrading(d.essayGrading || null);
          return d;
        }
      } else {
        setDailyData(null);
      }
    } catch (e) { console.error(e); }
  };

  // App.jsx から呼ばれる "switchSession" (実体は loadSession + state更新)
  const switchSession = async (n) => {
      setViewingSession(n);
      setActiveSession(n); // 基本的に同期させる
      await loadSession(n);
  };

  // 履歴メタデータの読み込み
  const loadHistoryMeta = async () => {
    if (!userId) return;
    try {
      const hmSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap'));
      if (hmSnap.exists()) {
          setHeatmapStats(hmSnap.data().data || {});
      }

      const today = getTodayString();
      const promises = [];
      for (let i = 1; i <= MAX_DAILY_SESSIONS; i++) {
        promises.push(getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${i}`)));
      }
      const snaps = await Promise.all(promises);
      
      const meta = {};
      let next = 1;
      let limitReached = false;
      
      snaps.forEach((s, i) => {
        const n = i + 1;
        if (s.exists()) {
          const d = s.data();
          meta[n] = { exists: true, completed: d.completed, theme: d.content?.theme };
          if (d.completed) next = n + 1;
          else next = n;
        } else {
          meta[n] = { exists: false };
        }
      });

      if (next > MAX_DAILY_SESSIONS) {
        next = MAX_DAILY_SESSIONS;
        limitReached = true;
      }
      
      setHistoryMeta(meta);
      setActiveSession(next);
      setViewingSession(limitReached ? MAX_DAILY_SESSIONS : next);
      
      // 初期ロード時に現在のセッションデータを読み込む
      await loadSession(limitReached ? MAX_DAILY_SESSIONS : next);

      return { next, limitReached };
    } catch (e) { console.error(e); }
  };

  // 進捗保存
  const saveProgress = async (ans, idx) => {
    if (!userId) return;
    setUserAnswers(ans);
    setQIndex(idx);
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${getTodayString()}_${activeSession}`), 
      { userAnswers: ans, qIndex: idx }, { merge: true });
  };

  // 完了フラグを立てる (App.jsxから呼ばれる)
  const markAsCompleted = async (sessionNum) => {
      if (!userId) return;
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${getTodayString()}_${sessionNum}`), 
        { completed: true }, { merge: true });
      
      // メタデータも更新
      setHistoryMeta(prev => ({
          ...prev,
          [sessionNum]: { ...prev[sessionNum], completed: true }
      }));
      
      // ヒートマップ更新 (1日1回などの制御はここではなくhandleGradeで行われているが、念のため完了時も更新)
      const today = getTodayString();
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap'), 
        { data: { [today]: increment(1) } }, { merge: true });
  };

  // 記述採点 (厳格プロンプト復活)
  const handleGrade = async (userApiKey) => {
    // currentData.content が実際のデータ
    const dataContent = currentData?.content || currentData;
    if (!dataContent) return;

    const flatQ = getFlattenedQuestions(dataContent);
    const essayIndex = flatQ.findIndex(q => q.type === 'essay');
    const answer = userAnswers[essayIndex];

    if (!answer) return;
    setIsProcessing(true);
    setProcessingError(null);
    dismissKeyboard();

    try {
      const prompt = `
      あなたは「難関大学入試の採点官」です。
      以下の「講義テキスト」の内容を正解の基準として、ユーザーの回答を厳格に採点してください。

      【講義テキスト（正解の根拠）】
      ${dataContent.lecture}

      【問題】
      ${dataContent.essay.q}

      【模範解答】
      ${dataContent.essay.model}

      【ユーザーの回答】
      ${answer}

      【絶対に守るべき採点ルール】
      1. **ゴミ回答の排除**: 「あいうえお」「あああ」などの無意味な文字列、または問題と全く無関係な回答は、即座に「0点」にすること。
      2. **キーワード羅列の減点**: 単語を並べただけで、論理的な文章になっていない場合は、知識点(k)を与えても論理点(l)は0点にすること。
      3. **忖度（そんたく）の禁止**: ユーザーが書いていないことを、AIが勝手に脳内補完して加点しないこと。「書いてあること」だけを評価対象にすること。
      4. **講義との整合性**: 講義テキストで触れられていない独自の主張であっても、歴史的事実として正しければ加点してよいが、講義内容と矛盾する場合は減点すること。

      出力形式(JSON): { "score": {"k": 0~5, "l": 0~5}, "feedback": "具体的な添削と指摘", "overall_advice": "今後の学習指針" }
      `;
      
      const res = await callAI("記述採点", prompt, userApiKey);
      if (!res || !res.score) throw new Error("採点データ不正");
      res.score.k = res.score.k ?? 0; res.score.l = res.score.l ?? 0;
      setEssayGrading(res);
      
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${getTodayString()}_${activeSession}`), 
        { essayGrading: res, userAnswers, completed: true }, { merge: true }); // 採点完了＝セッション完了扱い
        
      const today = getTodayString();
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap'), 
        { data: { [today]: increment(1) } }, { merge: true });
      
      setHeatmapStats(prev => ({
          ...prev,
          [today]: (prev[today] || 0) + 1
      }));
        
      setHistoryMeta(p => ({...p, [activeSession]: {...p[activeSession], completed: true}}));
      setIsAnswered(true);
      return true;

    } catch (e) {
      setProcessingError("採点エラー: " + e.message);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGiveUp = async () => {
    dismissKeyboard();
    const res = { score: { k: 0, l: 0 }, feedback: "模範解答を写経しましょう。", overall_advice: "解説を読み込みましょう。" };
    setEssayGrading(res);
    
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${getTodayString()}_${activeSession}`), 
      { essayGrading: res, userAnswers, completed: true }, { merge: true });
      
    const today = getTodayString();
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap'), 
      { data: { [today]: increment(1) } }, { merge: true });

    setHeatmapStats(prev => ({
        ...prev,
        [today]: (prev[today] || 0) + 1
    }));
      
    setHistoryMeta(p => ({...p, [activeSession]: {...p[activeSession], completed: true}}));
    setIsAnswered(true);
  };

  // 初期ロード実行 (userIdが変わったら再ロード)
  useState(() => {
      loadHistoryMeta();
  }, [userId]);

  return {
    currentData, // App.jsxでの呼び名に合わせる
    setDailyData,
    userAnswers, setUserAnswers,
    qIndex, setQIndex,
    isAnswered, setIsAnswered,
    essayGrading, setEssayGrading,
    isProcessing, setIsProcessing,
    activeSession, setActiveSession,
    viewingSession, setViewingSession,
    historyMeta, setHistoryMeta,
    heatmapStats, setHeatmapStats,
    processingError,
    scoreRef,
    
    // 公開関数
    switchSession, // App.jsx用
    loadSession,   // 直接呼ぶ場合用
    markAsCompleted, // App.jsx用
    saveProgress,
    handleGrade,
    handleGiveUp
  };
};