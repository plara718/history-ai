import { useState } from 'react';
import { callAI } from '../lib/api';
import { generateTagPrompt } from '../lib/tagConfig';

export const useLessonGrader = (apiKey, userId) => {
  const [isGrading, setIsGrading] = useState(false);
  const [gradeError, setGradeError] = useState(null);

  /**
   * 記述問題の採点を実行
   * @param {object} lessonData - レッスンデータ全体
   * @param {string} userEssayAnswer - ユーザーの回答
   * @param {string} learningMode - 学習モード
   */
  const gradeLesson = async (lessonData, userEssayAnswer, learningMode) => {
    if (!apiKey) {
      setGradeError("APIキーが不足しています");
      return null;
    }

    setIsGrading(true);
    setGradeError(null);

    try {
      // データの階層構造を吸収 (contentプロパティの有無に対応)
      const content = lessonData.content || lessonData;
      const theme = content.theme || "テーマ不明";
      const question = content.essay?.q || "問題文不明";
      const modelAnswer = content.essay?.model || "特になし";

      // ミスタグの定義リストを生成
      const mistakeTagsDef = generateTagPrompt('MISTAKE');

      // 1. モード別の採点人格と評価基準
      const graderPersona = learningMode === 'school'
        ? `
          【モード：定期テスト（School Mode）】
          あなたは「厳格な高校教師」です。
          - **評価基準**: 減点法。
          - **重視点**: 「教科書の重要語句（太字）」が正確に使われているか。漢字ミスや定義の曖昧さは厳しく減点せよ。
          - **アドバイス**: 教科書の記述に忠実な修正案を示せ。
        `
        : `
          【モード：入試対策（Exam Mode）】
          あなたは「大手予備校の戦略的コーチ」です。
          - **評価基準**: 加点法。
          - **重視点**: 論理構成（A→Bという因果）。必須キーワードが入っていても、文脈が繋がっていなければ減点せよ。逆に、独自の鋭い視点があれば加点せよ。
          - **アドバイス**: 「採点官に評価される書き方（テクニック）」を伝授せよ。
        `;

      // 2. 採点プロンプトの構築
      const prompt = `
      あなたは日本史のプロフェッショナルな採点官です。
      以下のデータに基づき、ユーザーの記述回答を採点し、劇的な改善案（添削）と、**次の具体的な学習指針**を作成してください。

      【前提データ】
      - 学習テーマ: ${theme}
      - 問題文: ${question}
      - 採点基準(Model): ${modelAnswer}
      - ユーザーの回答: "${userEssayAnswer}"
      - モード: ${learningMode}

      【採点ガイドライン】
      ${graderPersona}

      【弱点タグの判定ルール (重要)】
      ユーザーの回答が不十分な場合、その原因を以下の定義リストから分析し、タグIDを選定してください。
      [Defined Mistake Tags]
      ${mistakeTagsDef}

      - **Score < 8 (部分点/不正解)**: 不足している要素に対応するタグIDを配列に含めてください。（例: 背景が抜けているなら 'err_cause'）
      - **Score >= 8 (合格)**: タグは空配列 [] にしてください。
      - **白紙/ギブアップ**: 回答が "わからない" や空白に近い場合は、問題の意図に関連するタグをすべて含めてください。

      【出力形式：JSONのみ】
      以下のキーを持つJSONオブジェクトを出力せよ。
      
      1. **score**: 0〜10の整数。
      2. **correction**: 以下のMarkdownフォーマットで記述された添削内容。
         \`\`\`markdown
         ### 📝 添削結果
         **あなたの回答**:
         > （ユーザーの回答を引用）
         
         **✨ 理想の解答（リライト）**:
         > （ユーザーの意図を汲みつつ、満点になるように修正した文章）
         
         **🔍 採点ポイント**:
         - 🔴 **[減点]** ...
         - 🔵 **[加点]** ...
         - 💡 **[改善]** ...
         \`\`\`
      
         
      3. **overall_comment**: 
         学習者への総評。100〜150文字。
      
      4. **tags**: 
         分析した弱点タグIDの配列（例: ["err_cause", "err_basic_fact"]）。合格なら空配列。
      
      5. **recommended_action**: 
         ユーザーの得点と弱点に基づき、次に取るべき「具体的な行動」を40文字以内で提案せよ。
         例: "「荘園」の単元をEasyモードで復習しましょう" や "次は「鎌倉文化」に進んでOKです" など。
      `;

      // callAIの呼び出し (記述採点アクション)
      const result = await callAI("記述採点", prompt, apiKey, userId);

      return result;

    } catch (e) {
      console.error(e);
      setGradeError(e.message || "採点中にエラーが発生しました");
      // UI側でハンドリングできるようエラーを再スローしても良いが、
      // ここではnullを返しつつエラー状態を持たせる設計とする
      return null;
    } finally {
      setIsGrading(false);
    }
  };

  return { gradeLesson, isGrading, gradeError };
};