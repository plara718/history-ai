import { useState, useRef } from 'react';
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callAI } from '../lib/api';
import { APP_ID, MAX_DAILY_SESSIONS } from '../lib/constants';
import { getTodayString, validateLessonData, getFlattenedQuestions, dismissKeyboard } from '../lib/utils';

export const useStudySession = (user) => {
  const [dailyData, setDailyData] = useState(null);
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

  const loadSession = async (sessionNum) => {
    if (!user) return;
    try {
      const today = getTodayString();
      const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress', `${today}_${sessionNum}`));
      if (snap.exists()) {
        const d = snap.data();
        const safeContent = validateLessonData(d.content);
        if (safeContent) {
          setDailyData(safeContent);
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

  const loadHistoryMeta = async () => {
    if (!user) return;
    try {
      const hmSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'stats', 'heatmap'));
      if (hmSnap.exists()) {
          setHeatmapStats(hmSnap.data().data || {});
      }

      const today = getTodayString();
      const promises = [];
      for (let i = 1; i <= MAX_DAILY_SESSIONS; i++) {
        promises.push(getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress', `${today}_${i}`)));
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
      
      return { next, limitReached };
    } catch (e) { console.error(e); }
  };

  const saveProgress = async (ans, idx) => {
    if (!user) return;
    setUserAnswers(ans);
    setQIndex(idx);
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress', `${getTodayString()}_${activeSession}`), 
      { userAnswers: ans, qIndex: idx }, { merge: true });
  };

  const handleGrade = async (userApiKey) => {
    const flatQ = getFlattenedQuestions(dailyData);
    const essayIndex = flatQ.findIndex(q => q.type === 'essay');
    const answer = userAnswers[essayIndex];

    if (!answer) return;
    setIsProcessing(true);
    setProcessingError(null);
    dismissKeyboard();

    try {
      // ★修正: 講義内容を証拠として渡し、厳密な判定を行わせる
      const prompt = `
      あなたは「難関大学入試の採点官」です。
      以下の「講義テキスト」の内容を正解の基準として、ユーザーの回答を厳格に採点してください。

      【講義テキスト（正解の根拠）】
      ${dailyData.lecture}

      【問題】
      ${dailyData.essay.q}

      【模範解答】
      ${dailyData.essay.model}

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
      
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress', `${getTodayString()}_${activeSession}`), 
        { essayGrading: res, userAnswers, completed: true }, { merge: true });
        
      const today = getTodayString();
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'stats', 'heatmap'), 
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
    
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress', `${getTodayString()}_${activeSession}`), 
      { essayGrading: res, userAnswers, completed: true }, { merge: true });
      
    const today = getTodayString();
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'stats', 'heatmap'), 
      { data: { [today]: increment(1) } }, { merge: true });

    setHeatmapStats(prev => ({
        ...prev,
        [today]: (prev[today] || 0) + 1
    }));
      
    setHistoryMeta(p => ({...p, [activeSession]: {...p[activeSession], completed: true}}));
    setIsAnswered(true);
  };

  return {
    dailyData, setDailyData,
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
    loadSession,
    loadHistoryMeta,
    saveProgress,
    handleGrade,
    handleGiveUp
  };
};