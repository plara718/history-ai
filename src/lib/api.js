import { GoogleGenerativeAI } from "@google/generative-ai";
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { APP_ID } from './constants';

export const callAI = async (actionName, prompt, apiKey, userId) => {
  if (!apiKey) throw new Error("APIキーが設定されていません。");

  // 1. 設定の取得（優先度: 個人設定 ＞ 全体設定 ＞ デフォルト）
  let appMode = 'production';
  try {
    if (userId) {
      const userSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'settings', 'ai_config'));
      if (userSnap.exists()) {
        appMode = userSnap.data().appMode;
      } else {
        const globalSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'settings', 'global'));
        if (globalSnap.exists()) {
          appMode = globalSnap.data().appMode || 'production';
        }
      }
    }
  } catch (e) {
    console.warn("[AI] 設定取得プロセスでエラーが発生しました。デフォルトを使用します。", e);
  }

  // 2. モードに応じたモデルの割り当て (指定されたバージョンを正とする)
  const modelName = appMode === 'production' ? "gemini-2.5-flash" : "gemma-3-27b-it";
  
  const genAI = new GoogleGenerativeAI(apiKey);
  // systemInstructionはpromptに統合するため、ここではmodel指定のみ
  const model = genAI.getGenerativeModel({ model: modelName });

  const MAX_RETRIES = 2;
  let attempt = 0;
  let lastError = null;

  console.log(`[AI Config] Mode: ${appMode.toUpperCase()}, Model: ${modelName}, User: ${userId || 'Guest'}`);

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

      if (errorMsg.includes("429") || errorMsg.includes("Quota exceeded")) {
          throw new Error("⚠️ AIの利用制限(429)にかかりました。少し時間を置いてください。");
      } else if (errorMsg.includes("not found") || errorMsg.includes("404")) {
          console.error(`Model ${modelName} not found. Check API key or region.`);
          throw new Error(`指定されたAIモデル(${modelName})が見つかりません。モデル名を確認してください。`);
      }

      attempt++;
      if (attempt <= MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  throw lastError;
};