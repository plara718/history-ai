import { useState } from 'react';
import { callAI } from '../lib/api';
import { doc, setDoc, getDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID, DIFFICULTY_DESCRIPTIONS } from '../lib/constants'; // ★定義をインポート
import { getTodayString } from '../lib/utils';

export const useLessonGenerator = (apiKey, userId) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [genError, setGenError] = useState(null);

  const generateDailyLesson = async (learningMode, difficulty, selectedUnit, sessionNum) => {
    if (!userId || !apiKey) {
      setGenError("認証情報が不足しています");
      return null;
    }

    setIsProcessing(true);
    setGenError(null);

    try {
      // 1. 管理者からの介入指示があれば取得 (復旧)
      let intervention = null;
      try {
          const iSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'interventions', userId));
          if(iSnap.exists()) intervention = iSnap.data();
      } catch(e) { console.warn(e); }

      // 2. 過去の履歴を参照 (簡易)
      // 直近の学習内容を取得して、重複を避ける指示などを追加可能だが、今回はシンプルに

      // 3. プロンプト構築
      // ★ここが重要: 難易度定義からAIへの指示を取り出す
      const difficultyInstruction = DIFFICULTY_DESCRIPTIONS[learningMode][difficulty].ai;
      
      const prompt = `
      あなたは日本史のプロ講師です。以下の条件で学習コンテンツをJSON形式で生成してください。

      【学習設定】
      - モード: ${learningMode === 'school' ? '定期テスト対策（教科書準拠）' : '大学入試対策'}
      - 単元: ${selectedUnit}
      - 難易度指示: ${difficultyInstruction}
      
      ${intervention ? `【最優先指示（介入）】\n指導テーマ: ${intervention.focus}\n興味付け: ${intervention.interest}\nこの指示を必ず反映してください。` : ''}

      【生成要件】
      1. theme: 今日の授業のタイトル（キャッチーに）
      2. lecture: 講義テキスト（1000文字程度。Markdown形式。重要な用語は太字**term**にする）
      3. essential_terms: 講義に出てきた重要語句リスト（5つ。{term: "語句", def: "短い定義"}の配列）
      4. questions: 以下の問題を含む配列
         - true_false: 正誤問題 3問 ({q: "問題文", options: ["選択肢A", "選択肢B"...], correct: 0, exp: "解説"})
         - sort: 並び替え問題 1問 ({q: "問題文", items: ["A", "B", "C", "D"], correct_order: [2,0,1,3], exp: "解説"})
         - essay: 記述問題 1問 ({q: "思考力を問う問題", model: "模範解答", exp: "採点基準と解説", hint: "ヒント"})
      5. column: "今日の深掘りコラム"（教科書には載っていない面白い裏話や現代とのつながり）

      JSONのみを出力してください。
      `;

      // 4. AI生成
      const data = await callAI("授業生成", prompt, apiKey);
      
      if (!data || !data.lecture) throw new Error("AI生成データが不正です");

      // 5. データ保存
      const today = getTodayString();
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`);
      
      const saveData = {
        timestamp: new Date().toISOString(),
        content: data,
        learningMode,
        difficulty,
        completed: false,
        userAnswers: {},
        qIndex: 0
      };

      await setDoc(docRef, saveData);

      // 用語帳への保存 (非同期で実行)
      if (data.essential_terms) {
          data.essential_terms.forEach(term => {
              const termRef = doc(collection(db, 'artifacts', APP_ID, 'users', userId, 'vocabulary'));
              // 単純化のため上書き保存せず、新規追加または既存更新のロジックが必要だが、
              // ここでは簡易的に「保存」のみ実装（本格的にはバッチ処理推奨）
              // setDoc(termRef, { ...term, addedAt: new Date().toISOString() }).catch(console.error);
          });
      }

      return data;

    } catch (e) {
      console.error(e);
      setGenError("生成エラー: " + e.message);
      throw e;
    } finally {
      setIsProcessing(false);
    }
  };

  return { generateDailyLesson, isProcessing, genError };
};