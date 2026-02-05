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
      // 1. 管理者からの介入指示を取得
      let intervention = null;
      try {
          const iSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'interventions', userId));
          if(iSnap.exists()) intervention = iSnap.data();
      } catch(e) { console.warn("介入データ取得失敗", e); }

      const diffSetting = DIFFICULTY_DESCRIPTIONS[learningMode]?.[difficulty] || DIFFICULTY_DESCRIPTIONS.general.standard;
      const targetUnit = learningMode === 'school' ? selectedUnit : "AIが選定する入試頻出テーマ";

      // -------------------------------------------------------
      // ★ Step 1: 授業プランの策定
      // -------------------------------------------------------
      const planPrompt = `
      あなたは日本史のプロ講師です。以下の設定で、1回分の授業テーマ（タイトル）と構成案を決定してください。

      【設定】
      - 単元: ${targetUnit}
      - 難易度: ${diffSetting.label}
      - ターゲット: ${learningMode === 'school' ? '定期テスト対策' : '大学入試対策'}

      ${intervention ? `【★最優先指示（管理者介入）】\n指導テーマ: ${intervention.focus}\nこの指示内容をテーマ選定に必ず反映させてください。` : ''}

      出力は以下のJSON形式のみ返してください:
      {
        "theme": "授業のタイトル（例：地租改正と農民一揆）",
        "key_concepts": ["重要な概念1", "重要な概念2", "重要な概念3"]
      }
      `;

      const planRes = await callAI("授業プラン作成", planPrompt, apiKey);
      if (!planRes || !planRes.theme) throw new Error("プラン生成に失敗しました");

      // -------------------------------------------------------
      // ★ Step 2: ドラフトコンテンツの生成 (執筆)
      // -------------------------------------------------------
      const draftPrompt = `
      あなたは日本史のプロ講師です。
      テーマ「${planRes.theme}」について、授業コンテンツを執筆してください。

      【構成要素への指示】
      1. **概念**: ${planRes.key_concepts.join(', ')} を解説に含めること。
      2. **講義**: ${diffSetting.ai} (1000文字程度)
      3. **問題**: 
         - 正誤問題(true_false): 3問 ({q, options, correct, exp})
         - 整序問題(sort): 2問 ({q, items, correct_order, exp})
         - 記述問題(essay): 1問 ({q, model, hint})
      4. **用語**: 重要語句(essential_terms) 5つ。
      5. **コラム**: 興味を引く歴史の裏話(column)。

      ${intervention ? `【★最優先指示】\n興味付け・雑学ネタ: ${intervention.interest}\nこのネタをコラムまたは講義の導入に使用してください。` : ''}

      出力はJSON形式のみ:
      { "theme": "${planRes.theme}", "lecture": "...", "essential_terms": [...], "true_false": [...], "sort": [...], "essay": {...}, "column": "..." }
      `;

      const draftRes = await callAI("コンテンツ執筆", draftPrompt, apiKey);
      if (!draftRes || !draftRes.lecture) throw new Error("ドラフト生成に失敗しました");

      // -------------------------------------------------------
      // ★ Step 3: 品質チェックとリファイン (推敲・検品)
      // -------------------------------------------------------
      // 模範解答、ヒント、解説も含めた厳格な品質チェックを行う
      const reviewPrompt = `
      あなたは「最高品質の教材を作る鬼の編集者」です。
      以下はAIが生成した日本史の教材ドラフトです。
      この内容を以下の基準で厳しくチェックし、不備があれば修正した完全なJSONを出力してください。

      【品質チェック基準】
      1. **正解の整合性**: 
         - 選択問題の正解インデックスは合っているか？
         - 整序問題の並び順は史実として正しいか？
      
      2. **解説・解答の質 (最重要)**: 
         - **解説(exp)**: 正解の理由だけでなく、誤答の理由や、背景にある因果関係まで深く説明できているか？「〇〇だから」のような浅い解説は修正すること。
         - **模範解答(model)**: 記述問題の解答は、講義内容を踏まえた論理的かつ正確な文章になっているか？
         - **ヒント(hint)**: 答えをそのまま言うのではなく、学生の思考を促す適切な助言になっているか？

      3. **難易度**: 「${diffSetting.label}」という設定に対し適切か？
      4. **不適切な内容**: 教育上不適切な表現や、明らかな史実誤認はないか？

      【ドラフトデータ】
      ${JSON.stringify(draftRes)}

      問題なければドラフトをそのまま、修正が必要なら修正後のJSONを出力してください。
      JSON以外の解説文は不要です。
      `;

      const finalRes = await callAI("品質チェック", reviewPrompt, apiKey);
      
      // もしチェック工程でJSONが壊れた場合は、Step 2のドラフトをバックアップとして採用する
      const contentRes = (finalRes && finalRes.lecture) ? finalRes : draftRes;

      // -------------------------------------------------------
      // 保存処理
      // -------------------------------------------------------
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

      // 用語帳への保存
      if (contentRes.essential_terms) {
        Promise.all(contentRes.essential_terms.map(async (term) => {
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

  return {
    generateDailyLesson,
    isProcessing,
    genError
  };
};