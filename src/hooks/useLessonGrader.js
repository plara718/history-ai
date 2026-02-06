import { useState } from 'react';
import { callAI } from '../lib/api';

export const useLessonGrader = (apiKey) => {
  const [isGrading, setIsGrading] = useState(false);
  const [gradeError, setGradeError] = useState(null);

  const gradeLesson = async (lessonData, userEssayAnswer, learningMode) => {
    if (!apiKey) {
      setGradeError("APIキーが不足しています");
      return null;
    }

    setIsGrading(true);
    setGradeError(null);

    try {
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
      以下のデータに基づき、ユーザーの記述回答を採点し、劇的な改善案（添削）を作成してください。

      【前提データ】
      - 学習テーマ: ${lessonData.content.theme}
      - 問題文: ${lessonData.content.essay.q}
      - 採点基準(Model): ${JSON.stringify(lessonData.content.essay.model)}
      - ユーザーの回答: "${userEssayAnswer}"
      - モード: ${learningMode}

      【採点ガイドライン】
      ${graderPersona}

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
         - 🔴 **[減点]** 「〜」の視点が不足しています。
         - 🔵 **[加点]** 「〜」という語句を使えているのはGoodです。
         - 💡 **[改善]** ここをこう繋げると論理的になります。
         \`\`\`
      
      3. **overall_comment**: 
         学習者への総評。100〜150文字。
         ${learningMode === 'school' ? '基礎知識の定着度を中心に励ませ。' : '合格に向けた戦略的なアドバイスを送れ。'}
      
      4. **weakness_tag**: 
         今回露呈した弱点を表すハッシュタグ（例: "#摂関政治の仕組み", "#因果関係の記述"）。

      JSON出力:
      `;

      // 3. AI呼び出し (userIdは学習履歴の参照などで必要なら渡すが、採点は単発でも可。今回は精度向上のためAPI関数に任せる)
      // ※ callAIの第4引数(userId)は、過去の傾向を加味したい場合は渡すが、公平な採点のためあえてnullにする選択肢もあり。
      //   ここでは「個人の癖」を考慮してアドバイスするためにuserIdを渡す設計を推奨。
      const result = await callAI("記述採点", prompt, apiKey, null); // userIdが必要なら引数に追加して渡す

      return result;

    } catch (e) {
      console.error(e);
      setGradeError(e.message || "採点中にエラーが発生しました");
      throw e;
    } finally {
      setIsGrading(false);
    }
  };

  return { gradeLesson, isGrading, gradeError };
};