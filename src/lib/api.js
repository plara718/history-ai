import { GoogleGenerativeAI } from "@google/generative-ai";
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { APP_ID } from './constants';

export const callAI = async (actionName, prompt, apiKey) => {
  if (!apiKey) throw new Error("APIキーが設定されていません。");

  // 1. Firestoreからグローバル設定（動作モード）を直接取得
  let appMode = 'production';
  try {
    const settingsSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'settings', 'global'));
    if (settingsSnap.exists()) {
      appMode = settingsSnap.data().appMode || 'production';
    }
  } catch (e) {
    console.warn("[AI] 設定取得失敗、デフォルト(production)を使用します", e);
  }

  // 2. モードに応じた最新モデルの割り当て
  // 本番: Gemini 2.0 Flash / テスト: Gemma 3
  const modelName = appMode === 'production' ? "gemini-2.5-flash" : "gemma-3-27b-it";
  
  const MAX_RETRIES = 2; 
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  let attempt = 0;
  let lastError = null;

  console.log(`[AI Config] Mode: ${appMode.toUpperCase()}, Model: ${modelName}`);

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
          throw new Error("生成データが無効です。");
      }

      console.log(`[AI] ${actionName}: Success`);
      return data;

    } catch (e) {
      console.warn(`[AI] ${actionName} (Attempt ${attempt + 1}) Failed: ${e.message}`);
      lastError = e;
      const errorMsg = e.message || "";

      // 404エラー（モデル名間違い）
      if (errorMsg.includes("404") && errorMsg.includes("not found")) {
          throw new Error(`モデル(${modelName})が見つかりません。APIキーまたはモデルIDを確認してください。`);
      }

      // 制限検知 (429)
      if (errorMsg.includes("429") || errorMsg.includes("Quota exceeded")) {
          throw new Error("⚠️ AIの利用制限にかかりました。少し時間を置いてください。");
      }

      attempt++;
      if (attempt <= MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  throw lastError;
};