import { GoogleGenerativeAI } from "@google/generative-ai";

export const callAI = async (actionName, prompt, apiKey) => {
  if (!apiKey) throw new Error("APIキーが設定されていません。設定画面でキーを入力してください。");

  // モード判定
  const isTestMode = localStorage.getItem('gemini_test_mode') === 'true';

  // ★大修正: 
  // 本番モード(false) → "gemma-3-27b-it" (1日14,400回使える・賢い・安定)
  // テストモード(true) → "gemini-1.5-flash" (1日1,500回使える・バックアップ用)
  // ※これで、スイッチがどっちに入っていても「制限エラー」で止まることはほぼ無くなります。
  const modelName = isTestMode ? "gemini-1.5-flash" : "gemma-3-27b-it";
  
  // どちらも制限に余裕があるため、リトライは「2回」有効にして安定性を高めます
  const MAX_RETRIES = 2; 

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  let attempt = 0;
  let lastError = null;

  console.log(`[AI Config] Mode: ${isTestMode ? 'TEST(1.5-Flash)' : 'PROD(Gemma-3)'}, Model: ${modelName}`);

  while (attempt <= MAX_RETRIES) {
    try {
      console.log(`[AI] ${actionName} (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Requesting...`);
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      if (!text) throw new Error("AIからの応答が空でした。");

      // JSONクリーニング
      text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        try {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                data = JSON.parse(match[0]);
            } else {
                throw new Error("有効なJSONが見つかりませんでした。");
            }
        } catch (e2) {
            console.error(`[AI] JSON Parse Error in ${actionName}:`, text);
            throw new Error("AIの出力がJSON形式ではありませんでした。");
        }
      }

      if (!data || typeof data !== 'object') {
          throw new Error("生成データが無効（nullまたは非オブジェクト）です。");
      }

      // 必須データのチェック
      if (actionName.includes("作問") || actionName.includes("テスト")) {
          if (!data.true_false && !data.sort && !data.essay) throw new Error("問題データが含まれていません。");
      }

      console.log(`[AI] ${actionName}: Success`);
      return data;

    } catch (e) {
      console.warn(`[AI] ${actionName} (Attempt ${attempt + 1}) Failed: ${e.message}`);
      lastError = e;
      const errorMsg = e.message || "";

      // 404エラー（モデル名違い）のハンドリング
      if (errorMsg.includes("404") && errorMsg.includes("not found")) {
          console.error(`[AI] Model Not Found: ${modelName}`);
          // GemmaのIDが環境によって違う場合への案内
          if (!isTestMode) { // 本番(Gemma)でエラーが出た場合
             throw new Error(`モデル(${modelName})が見つかりません。APIキーが正しいか確認してください。(ヒント: "gemma-3-27b" を試す必要があるかもしれません)`);
          }
          throw new Error(`設定されたAIモデル(${modelName})が見つかりません。`);
      }

      // 制限検知 (429)
      if (errorMsg.includes("429") || errorMsg.includes("Quota exceeded") || errorMsg.includes("Resource has been exhausted")) {
          console.error(`[AI] Rate Limit Exceeded.`);
          throw new Error("⚠️ AIの利用制限（アクセス集中）にかかりました。少し時間を置いてください。");
      }

      attempt++;
      if (attempt <= MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  throw lastError;
};