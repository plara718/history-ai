import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID, MAX_DAILY_SESSIONS } from '../lib/constants';
import { getTodayString } from '../lib/utils';

export const useStudySession = (userId) => {
  const [activeSession, setActiveSession] = useState(1);  // 次にやるべきセッション番号
  const [viewingSession, setViewingSession] = useState(1); // 画面で選択中のセッション番号
  const [historyMeta, setHistoryMeta] = useState({});     // 各セッションの完了状態 { 1: {exists: true, completed: false}, ... }
  const [heatmapStats, setHeatmapStats] = useState({});   // ヒートマップ用データ

  // 初期化：その日の学習状況（メタデータ）を取得
  const loadHistoryMeta = async () => {
    if (!userId) return;
    try {
      // 1. ヒートマップ取得
      const hmSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap'));
      if (hmSnap.exists()) {
          setHeatmapStats(hmSnap.data().data || {});
      }

      // 2. 本日の各セッションの状況を確認
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
          // 既存データがある場合、完了しているかチェック
          meta[n] = { exists: true, completed: d.completed, theme: d.content?.theme };
          
          if (d.completed) {
            // 完了していれば、次は n+1 になる可能性がある
            next = n + 1;
          } else {
            // 存在していても未完了なら、次やるのはここ (next = n)
            next = n;
          }
        } else {
          // データがない場合
          meta[n] = { exists: false, completed: false };
        }
      });

      if (next > MAX_DAILY_SESSIONS) {
        next = MAX_DAILY_SESSIONS;
        limitReached = true;
      }
      
      setHistoryMeta(meta);
      
      // 次に取り組むべきセッションをセット
      // (ただし、ユーザーが手動で過去のセッションを選択している場合は上書きしない制御もUI側で可能)
      setActiveSession(next);
      setViewingSession(limitReached ? MAX_DAILY_SESSIONS : next);
      
      return { next, limitReached };
    } catch (e) { console.error("History load error", e); }
  };

  // セッション完了時の処理 (LessonScreenから呼ばれる想定)
  const markAsCompleted = async (sessionNum) => {
      if (!userId) return;
      const today = getTodayString();
      
      // 1. 完了フラグを立てる
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`), 
        { completed: true }, { merge: true });
      
      // 2. ヒートマップ更新
      // (重複カウントを防ぐため、既に完了済みならインクリメントしない等の制御も可能だが、
      // ここでは簡易的に「完了マークを打つたびに学習した」とみなして加算する)
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap'), 
        { data: { [today]: increment(1) } }, { merge: true });
      
      // 3. ローカルstate更新
      setHistoryMeta(prev => ({ 
        ...prev, 
        [sessionNum]: { ...prev[sessionNum], completed: true } 
      }));
      setHeatmapStats(prev => ({ ...prev, [today]: (prev[today] || 0) + 1 }));
  };

  // セッション切り替え (StartScreenのタブ選択などで使用)
  const switchSession = (n) => {
      setViewingSession(n);
      // 必要であればここでそのセッションのデータをロードする処理を入れても良いが、
      // データロードは LessonScreen 側で行う設計にしたため、ここでは番号管理のみ。
  };

  // 初回マウント時にロード
  useEffect(() => { 
    if (userId) loadHistoryMeta(); 
  }, [userId]);

  return {
    activeSession,     // 次に学習すべきセッション番号 (例: 2)
    viewingSession,    // UI上で選択中のセッション番号
    historyMeta,       // 各セッションの状態一覧
    heatmapStats,      // ヒートマップデータ
    
    switchSession,     // 表示セッションを切り替える関数
    markAsCompleted,   // セッションを完了扱いにする関数
    refresh: loadHistoryMeta // 再読み込み用
  };
};