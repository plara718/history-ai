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

  // セッション読み込み
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

  // ★★★ 採点処理の強化（全体分析） ★★★
  const handleGrade = async (userApiKey) => {
    const content = dailyData?.content || dailyData;
    if (!content) return;

    // 1. 選択問題の成績を計算する
    const flatQ = getFlattenedQuestions(content);
    const essayIndex = flatQ.findIndex(q => q.type === 'essay');
    const answer = userAnswers[essayIndex];
    
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
      // 2. AIへのプロンプトに「選択問題の結果」を含める
      const prompt = `
      あなたは「難関大学入試の採点官」です。
      今回の学習セッション全体の成績を踏まえて、記述問題の採点と、今後の学習アドバイスを行ってください。

      【学習状況】
      - 選択問題(正誤・整序): ${objTotal}問中 ${objCorrect}問 正解
      - テーマ: ${content.theme}

      【講義テキスト（正解の根拠）】
      ${content.lecture}

      【記述問題】
      ${content.essay.q}

      【模範解答】
      ${content.essay.model}

      【ユーザーの回答】
      ${answer}

      【採点基準（記述10点満点）】
      1. **知識点 (0~5点)**: 重要キーワードや史実の正確さ。
      2. **論理点 (0~5点)**: 因果関係の説明と論理構成。

      【出力フォーマット (JSON)】
      {
        "score": { "k": [知識点], "l": [論理点] },
        "feedback": "## 記述採点詳細\n(記述問題への具体的なフィードバック)",
        "overall_advice": "## 今回の総合アドバイス\n(選択問題の出来(${objTotal}問中${objCorrect}問正解)と記述の内容を総合し、この単元においてユーザーが強化すべきポイント、復習すべき用語、あるいは褒めるべき点を具体的にアドバイスしてください。もし選択問題の正答率が低ければ基礎の復習を促し、高ければ応用力を褒めてください。)"
      }
      `;
      
      const res = await callAI("総合採点", prompt, userApiKey);
      if (!res || !res.score) throw new Error("採点データ不正");
      res.score.k = res.score.k ?? 0; res.score.l = res.score.l ?? 0;
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
    // 諦めた場合の汎用アドバイス
    const res = { 
        score: { k: 0, l: 0 }, 
        feedback: "## 未回答\n模範解答を写経し、解説をよく読んで復習しましょう。", 
        overall_advice: "## 基礎から復習しましょう\n記述問題は難易度が高いですが、まずは講義を読み直し、流れを掴むところから始めましょう。諦めずに挑戦することが大切です。" 
    };
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

  useEffect(() => {
      loadHistoryMeta();
  }, [userId]);

  const markAsCompleted = async (sessionNum) => {
      if (!userId) return;
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${getTodayString()}_${sessionNum}`), 
        { completed: true }, { merge: true });
      
      setHistoryMeta(prev => ({
          ...prev,
          [sessionNum]: { ...prev[sessionNum], completed: true }
      }));
  };

  return {
    dailyData, 
    currentData: dailyData,
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
    loadSession,
    loadHistoryMeta,
    saveProgress,
    handleGrade,
    handleGiveUp,
    switchSession,
    markAsCompleted
  };
};