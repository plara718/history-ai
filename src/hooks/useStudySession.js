import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID, MAX_DAILY_SESSIONS } from '../lib/constants';
import { getTodayString } from '../lib/utils';

/**
 * 学習セッションの状態管理フック
 * 日次プログレスの取得、完了更新、セッション切り替えを担当
 */
export const useStudySession = (userId) => {
  const [activeSession, setActiveSession] = useState(1);  // 次に取り組むべきセッション (1-3)
  const [viewingSession, setViewingSession] = useState(1); // UIで表示中のセッション (1-3)
  const [historyMeta, setHistoryMeta] = useState({});     // { 1: {exists, completed}, ... }
  const [heatmapStats, setHeatmapStats] = useState({});   // ヒートマップ用データ

  // 初期化：その日の学習状況（メタデータ）を取得
  const loadHistoryMeta = useCallback(async () => {
    if (!userId) return;
    try {
      // 1. ヒートマップ取得 (統計データのロード)
      const hmRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap');
      const hmSnap = await getDoc(hmRef);
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
      let nextSession = 1;

      snaps.forEach((s, index) => {
        const sessionNum = index + 1;
        
        if (s.exists()) {
          const d = s.data();
          const isCompleted = !!d.completed;
          
          meta[sessionNum] = { 
            exists: true, 
            completed: isCompleted, 
            theme: d.theme || d.content?.theme 
          };
        } else {
          // データなし
          meta[sessionNum] = { exists: false, completed: false };
        }
      });

      // 次にやるべきセッションの決定ロジック
      // 1から順に見て、最初に「完了していない」セッションを探す
      let foundNext = false;
      for (let i = 1; i <= MAX_DAILY_SESSIONS; i++) {
        if (!meta[i]?.completed) {
          nextSession = i;
          foundNext = true;
          break;
        }
      }
      // 全て完了している場合は、最後のセッションを指しておく
      if (!foundNext) {
        nextSession = MAX_DAILY_SESSIONS;
      }

      setHistoryMeta(meta);
      setActiveSession(nextSession);
      
      // 表示セッションの初期値: 
      // 基本は nextSession だが、ロード完了時はそこを表示する
      setViewingSession(nextSession);
      
      return { nextSession };

    } catch (e) { 
      console.error("History load error", e); 
      return { nextSession: 1 };
    }
  }, [userId]);

  // セッション完了時の処理 (LessonScreenから呼ばれる)
  const markAsCompleted = async (sessionNum) => {
      if (!userId) return;
      const today = getTodayString();
      
      try {
        // 1. セッションデータの完了フラグを更新
        const sessionRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`);
        await setDoc(sessionRef, { completed: true }, { merge: true });
        
        // 2. ヒートマップ（学習日数/回数）の更新
        // data.YYYY-MM-DD というキーで更新
        const statsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'heatmap');
        await setDoc(statsRef, {
            [`data.${today}`]: increment(1)
        }, { merge: true });
        
        // 3. ローカルstate更新 (再取得せず即時反映)
        setHistoryMeta(prev => ({ 
          ...prev, 
          [sessionNum]: { ...prev[sessionNum], completed: true } 
        }));
        
        // ヒートマップ表示用も更新
        setHeatmapStats(prev => ({ 
          ...prev, 
          [today]: (prev[today] || 0) + 1 
        }));

        // 次のセッションへ進めるなら進める
        if (sessionNum < MAX_DAILY_SESSIONS) {
          setActiveSession(sessionNum + 1);
          // 完了した瞬間、自動的に次のセッションへビューを切り替えるかはお好みですが、
          // ここではユーザーが「戻る」を押したあとの挙動として active を更新するだけに留めます
        }

      } catch (e) {
        console.error("Completion update error:", e);
      }
  };

  // セッション切り替え (StartScreenのタブ選択などで使用)
  const switchSession = (n) => {
      setViewingSession(n);
  };

  // 初回マウント時にロード
  useEffect(() => { 
    if (userId) loadHistoryMeta(); 
  }, [userId, loadHistoryMeta]);

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