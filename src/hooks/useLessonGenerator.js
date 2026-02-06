import { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callAI } from '../lib/api';
import { APP_ID, DIFFICULTY_DESCRIPTIONS } from '../lib/constants';
import { getTodayString } from '../lib/utils';

export const useLessonGenerator = (apiKey, userId) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [genError, setGenError] = useState(null);

  const generateDailyLesson = async (learningMode, difficulty, selectedUnit, sessionNum) => {
    if (!apiKey || !userId) {
      setGenError("APIキーまたはユーザーIDが不足しています");
      return null;
    }

    setIsProcessing(true);
    setGenError(null);

    try {
      // 管理者介入データの取得
      let intervention = null;
      try {
          const iSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'interventions', userId));
          if(iSnap.exists()) intervention = iSnap.data();
      } catch(e) { console.warn("介入データ取得失敗", e); }

      const diffSetting = DIFFICULTY_DESCRIPTIONS[learningMode]?.[difficulty] || DIFFICULTY_DESCRIPTIONS.general.standard;
      const targetUnit = learningMode === 'school' ? selectedUnit : "AIが選定する入試頻出テーマ";

      // --- Step 1: Plan (戦略的テーマ選定) ---
      const planPrompt = `（以前と同じプラン作成プロンプト）`;

      // ★修正: 第4引数に userId を追加
      const planRes = await callAI("授業プラン作成", planPrompt, apiKey, userId);
      if (!planRes || !planRes.theme) throw new Error("プラン生成に失敗しました");

      // --- Step 2: Draft (高精度教材執筆) ---
      const draftPrompt = `（以前と同じコンテンツ執筆プロンプト）`;

      // ★修正: 第4引数に userId を追加
      const draftRes = await callAI("コンテンツ執筆", draftPrompt, apiKey, userId);
      if (!draftRes || !draftRes.lecture) throw new Error("ドラフト生成に失敗しました");

      // --- Step 3: Review (厳格な品質検品) ---
      const reviewPrompt = `（以前と同じ品質チェックプロンプト）`;

      // ★修正: 第4引数に userId を追加
      const finalRes = await callAI("品質チェック", reviewPrompt, apiKey, userId);
      const contentRes = (finalRes && finalRes.lecture) ? finalRes : draftRes;

      // データの保存（以下、変更なし）
      const lessonData = {
        content: contentRes,
        timestamp: new Date().toISOString(),
        learningMode,
        difficulty,
        completed: false,
        userAnswers: {},
        qIndex: 0
      };

      const today = getTodayString();
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`);
      await setDoc(docRef, lessonData);

      // 用語の自動保存（以下、変更なし）
      if (contentRes.essential_terms) {
        await Promise.all(contentRes.essential_terms.map(async (term) => {
            try {
                const termRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'vocabulary', term.term);
                await setDoc(termRef, { 
                    term: term.term, 
                    def: term.def, 
                    addedAt: new Date().toISOString(),
                    count: 1 
                }, { merge: true });
            } catch(e) { console.error("用語保存エラー", e); }
        }));
      }

      return lessonData;

    } catch (e) {
      console.error(e);
      setGenError(e.message || "生成中にエラーが発生しました");
      throw e;
    } finally {
      setIsProcessing(false);
    }
  };

  return { generateDailyLesson, isProcessing, genError };
};