import { useState, useRef, useEffect } from 'react';
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callAI } from '../lib/api';
import { APP_ID, MAX_DAILY_SESSIONS } from '../lib/constants';
import { getTodayString, validateLessonData, getFlattenedQuestions, dismissKeyboard } from '../lib/utils';

export const useStudySession = (userId) => {
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
    if (!userId) return;
    try {
      const today = getTodayString();
      const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`));
      if (snap.exists()) {
        const d = snap.data();
        const contentData = d.content || d;
        const safeContent = validateLessonData(contentData);
        
        if (safeContent) {
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

  const switchSession = async (n) => {
      setViewingSession(n);
      setActiveSession(n);
      await loadSession(n);
  };

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
      await loadSession(limitReached ? MAX_DAILY_SESSIONS : next);
      
      return { next, limitReached };
    } catch (e) { console.error(e); }
  };

  const saveProgress = async (ans, idx) => {
    if (!userId) return;
    setUserAnswers(ans);
    setQIndex(idx);
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${getTodayString()}_${activeSession}`), 
      { userAnswers: ans, qIndex: idx }, { merge: true });
  };

  // 記述採点・総合分析（ユーザー個別設定対応）
  const handleGrade = async (userApiKey) => {
    const content = dailyData?.content || dailyData;
    if (!content) return;

    const flatQ = getFlattenedQuestions(content);
    const essayIndex = flatQ.findIndex(q => q.type === 'essay');
    const answer = userAnswers[essayIndex];
    
    // 客観テストの集計
    let objCorrect = 0;
    let objTotal = 0;
    flatQ.forEach((q, i) => {
        if (q.type === 'true_false' || q.type === 'sort') {
            objTotal++;
            const uAns = userAnswers[i];
            const isCorrect = q.type === 'true_false' 
                ? uAns === q.correct 
                : JSON.stringify(uAns) === JSON.stringify(q.correct_order);
            if (isCorrect) objCorrect++;
        }
    });

    if (!answer) return;
    setIsProcessing(true);
    setProcessingError(null);
    dismissKeyboard();

    try {
      const prompt = `
      あなたは日本史のプロ採点官です。本セッションの客観的成績と記述回答を厳格に分析し、論理的な指導を行ってください。

      【学習データ】
      - テーマ: ${content.theme}
      - 客観テスト: ${objTotal}問中 ${objCorrect}問 正解
      - 講義本文: ${content.lecture}
      - 記述設問: ${content.essay.q}
      - 模範解答: ${content.essay.model}
      - 提出回答: ${answer}

      【採点基準（10点満点）】
      1. 知識点 (0-5点): 講義内のキーワードを正しく、適切な文脈で使用しているか。
      2. 論理点 (0-5点): 設問の要求（背景・意義等）に直接回答し、因果関係が整合しているか。

      【出力形式：JSON】
      {
        "score": { "k": 0, "l": 0 },
        "feedback": "## 記述採点レポート...",
        "overall_advice": "## 総合指導案..."
      }
      `;
      
      // ★修正箇所: 第4引数に userId を追加
      const res = await callAI("総合採点", prompt, userApiKey, userId);
      
      if (!res || !res.score) throw new Error("採点データ不正");
      
      res.score.k = res.score.k ?? 0; res.score.l = res.score.l ?? 0;
      setEssayGrading(res);
      
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${getTodayString()}_${activeSession}`), 
        { essayGrading: res, userAnswers, completed: true }, { merge: true });
        
      const today = getTodayString();
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap'), 
        { data: { [today]: increment(1) } }, { merge: true });
      
      setHeatmapStats(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));
      setHistoryMeta(p => ({...p, [activeSession]: {...p[activeSession], completed: true}}));
      setIsAnswered(true);
      return true;

    } catch (e) {
      setProcessingError("採点エラー: " + e.message);
      return false;
    } finally { setIsProcessing(false); }
  };

  const handleGiveUp = async () => {
    dismissKeyboard();
    const res = { 
        score: { k: 0, l: 0 }, 
        feedback: "## 未回答\\n模範解答を確認し、因果関係を復習しましょう。", 
        overall_advice: "## 基礎から復習しましょう" 
    };
    setEssayGrading(res);
    
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${getTodayString()}_${activeSession}`), 
      { essayGrading: res, userAnswers, completed: true }, { merge: true });
      
    const today = getTodayString();
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap'), { data: { [today]: increment(1) } }, { merge: true });
    setHeatmapStats(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));
    setHistoryMeta(p => ({...p, [activeSession]: {...p[activeSession], completed: true}}));
    setIsAnswered(true);
  };

  useEffect(() => { if (userId) loadHistoryMeta(); }, [userId]);

  const markAsCompleted = async (sessionNum) => {
      if (!userId) return;
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${getTodayString()}_${sessionNum}`), { completed: true }, { merge: true });
      setHistoryMeta(prev => ({ ...prev, [sessionNum]: { ...prev[sessionNum], completed: true } }));
  };

  return {
    dailyData, currentData: dailyData, setDailyData,
    userAnswers, setUserAnswers, qIndex, setQIndex,
    isAnswered, setIsAnswered, essayGrading, setEssayGrading,
    isProcessing, setIsProcessing, activeSession, setActiveSession,
    viewingSession, setViewingSession, historyMeta, setHistoryMeta,
    heatmapStats, setHeatmapStats, processingError, scoreRef,
    loadSession, loadHistoryMeta, saveProgress, handleGrade, handleGiveUp,
    switchSession, markAsCompleted
  };
};