import { useState } from 'react';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID, DIFFICULTY_DESCRIPTIONS } from '../lib/constants';
import { callAI } from '../lib/api';
import { validateLessonData, getTodayString } from '../lib/utils';

export const useLessonGenerator = (apiKey, uid) => {
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * 今日の講義と問題を生成するメイン関数
   */
  const generateDailyLesson = async (learningMode, difficulty, selectedUnit, sessionNumber) => {
    setIsProcessing(true);
    const today = getTodayString();
    
    try {
      // 1. 管理者からの「介入データ」を取得
      let intervention = { focus: "", interest: "", column_override: null };
      try {
        const intSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'interventions', uid));
        if (intSnap.exists()) {
          intervention = intSnap.data();
        }
      } catch (e) { console.log("Intervention fetch skipped"); }

      // 2. 学習履歴から文脈を把握
      const historySnap = await getDocs(query(
        collection(db, 'artifacts', APP_ID, 'users', uid, 'daily_progress'),
        orderBy('timestamp', 'desc'),
        limit(3)
      ));
      const recentThemes = historySnap.docs.map(d => d.data().content?.theme).filter(Boolean).join(", ");

      // 3. 難易度に応じたAIへの詳細指示を取得
      // constants.js で定義したモード別の詳細プロンプトを引用
      const diffInstruction = DIFFICULTY_DESCRIPTIONS[learningMode][difficulty].ai;

      // 4. プロンプトの構築
      const prompt = `
あなたは日本史のプロ講師です。以下の制約に従い、最高品質の学習コンテンツを1日分作成してください。

【今回の学習条件】
- モード: ${learningMode === 'school' ? `定期テスト対策 (${selectedUnit})` : '大学入試総合演習'}
- 難易度指示: ${diffInstruction}
- 直近の学習内容: ${recentThemes || 'なし'}
- 重点強化ポイント: ${intervention.focus || 'なし'}
- 生徒の興味関心: ${intervention.interest || 'なし'}

【出力構成】
1. 講義テキスト (lecture): 
   歴史の因果関係を重視し、ストーリーとして記憶に残るように解説してください。
   重要な用語は **用語** のように太字にしてください。

2. 演習問題 (questions):
   - 4択問題 (true_false): 2問
   - 並び替え問題 (sort): 1問 (4項目)
   - 記述問題 (essay): 1問 (100-120字程度)

3. 重要語句 (essential_terms):
   講義に登場したキーワード3つの用語(term)と定義(def)を抽出してください。

【必須要件】
- 回答は必ず以下のJSON形式のみで出力してください。
{
  "theme": "今回のテーマ名",
  "lecture": "講義テキスト(Markdown形式)",
  "questions": [
    { "type": "true_false", "q": "問題文", "options": ["A", "B", "C", "D"], "correct": 0, "exp": "解説" },
    { "type": "sort", "q": "問題文", "items": ["項1", "項2", "項3", "項4"], "correct_order": [0,1,2,3], "exp": "解説" },
    { "type": "essay", "q": "問題文", "model_answer": "模範解答", "hint": "ヒント", "keywords": ["キーワード1", "2"] }
  ],
  "essential_terms": [
    { "term": "用語", "def": "定義" }
  ]
}
`;

      // 5. AI呼び出し
      const rawResult = await callAI("講義生成", prompt, apiKey);
      
      // 6. バリデーションと補正
      const validatedData = validateLessonData(rawResult);

      // 7. 管理者コラムの注入（あれば）
      if (intervention.column_override) {
        validatedData.column = intervention.column_override;
      }

      // 8. Firestoreへの保存
      const docRef = doc(db, 'artifacts', APP_ID, 'users', uid, 'daily_progress', `${today}_${sessionNumber}`);
      const saveData = {
        content: validatedData,
        learningMode,
        difficulty,
        timestamp: Date.now(),
        completed: false
      };
      
      await setDoc(docRef, saveData);
      return validatedData;

    } catch (error) {
      console.error("Generation Error:", error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return { generateDailyLesson, isProcessing };
};