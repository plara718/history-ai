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
      const planPrompt = `
      あなたは日本史の専門家であり、効率的なカリキュラムを設計する教務主任です。
      以下の条件に基づき、学習効率が最大化される授業テーマと核心概念を決定してください。

      【設定】
      - 単元: ${targetUnit}
      - 難易度: ${diffSetting.label} (${diffSetting.ai})
      - モード: ${learningMode === 'school' ? '定期テスト（基本重視）' : '大学入試（因果関係重視）'}

      【思考基準】
      1. 歴史的因果: 単発の知識ではなく「なぜ起きたか」「何をもたらしたか」が明確なテーマを選ぶこと。
      2. 網羅性: 受験頻出度が高い、あるいは定期テストで必ず問われる論点を中心に据えること。
      ${intervention ? `3. 管理者介入命令: 「${intervention.focus}」を教えるための最適なコンテキストを構築せよ。` : ''}

      出力は以下のJSON形式のみ返してください:
      {
        "theme": "授業のタイトル",
        "key_concepts": ["核心概念1", "核心概念2", "核心概念3"]
      }
      `;

      const planRes = await callAI("授業プラン作成", planPrompt, apiKey);
      if (!planRes || !planRes.theme) throw new Error("プラン生成に失敗しました");

      // --- Step 2: Draft (高精度教材執筆) ---
      const draftPrompt = `
      あなたは日本史のプロ講師です。テーマ「${planRes.theme}」に基づき、一次情報を尊重した正確な教材を作成してください。

      【執筆ガイドライン】
      1. 講義 (lecture): 
         - 構成：[導入] → [背景] → [内容] → [影響・現代への繋がり]
         - 特徴：数字は公的統計に基づき、歴史的事実の推測は厳禁。専門用語は適切に使いつつ、論理的に解説せよ。
      2. 正誤問題 (true_false):
         - 3問。正確な知識を問うこと。インデックス0 = True, 1 = False。
      3. 整序問題 (sort):
         - 2問。4つの歴史的事象を時系列に並び替える形式。
      4. 記述問題 (essay): 
         - 100〜120字程度で論理的に説明させる良問を作成せよ。
      5. 重要語句 (essential_terms): 5つ。{term, def}形式。

      ${intervention ? `【★追加指示】雑学ネタ: ${intervention.interest} をコラム等に活用せよ。` : ''}

      出力はJSON形式のみ:
      {
        "theme": "${planRes.theme}",
        "lecture": "...",
        "essential_terms": [{"term": "...", "def": "..."}],
        "true_false": [{"q": "...", "options": ["True", "False"], "correct": 0, "exp": "..."}],
        "sort": [{"q": "...", "items": ["...", "...", "...", "..."], "correct_order": [0,1,2,3], "exp": "..."}],
        "essay": {"q": "...", "model": "...", "hint": "..."},
        "column": "歴史の多角的視点を提供するコラム"
      }
      `;

      const draftRes = await callAI("コンテンツ執筆", draftPrompt, apiKey);
      if (!draftRes || !draftRes.lecture) throw new Error("ドラフト生成に失敗しました");

      // --- Step 3: Review (厳格な品質検品) ---
      const reviewPrompt = `
      あなたは「日本史教材の校閲神」です。ドラフトの歴史的正確性と論理性を徹底的に検証し、完成品を出力してください。

      【検閲項目】
      1. 論理矛盾の抹殺: 正誤問題の「解説文(exp)」と「正解(correct)」が一致しているか？「～ではない」と解説しながらTrueにする等のミスは即座に修正せよ。
      2. 用語の平易化: 専門用語は維持しつつ、説明文の難解語を5割削減し、学習者の理解を加速させよ。
      3. 形式遵守: 各問題数(正誤3, 整序2)、JSON構造が完全に守られているか。

      【対象データ】
      ${JSON.stringify(draftRes)}

      不備を修正した最終的なJSONオブジェクトのみを返せ。
      `;

      const finalRes = await callAI("品質チェック", reviewPrompt, apiKey);
      const contentRes = (finalRes && finalRes.lecture) ? finalRes : draftRes;

      // データの保存
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

      // 用語の自動保存
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