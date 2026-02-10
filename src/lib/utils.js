import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * クラス名を結合するユーティリティ
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * 今日の日付文字列 (YYYY-MM-DD)
 */
export const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * キーボードを閉じる
 */
export const dismissKeyboard = () => {
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
};

/**
 * 画面トップへスクロール
 */
export const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**
 * ★重要: AI生成データの検証と補正
 * LessonScreenのデータ構造 { content: { ... } } に対応
 */
export const validateLessonData = (data) => {
  if (!data) return null;
  
  // ★重要: contentプロパティがある場合は中身を対象にする
  const target = data.content || data;

  // 必須フィールドの初期化
  if (!target.theme) target.theme = "無題のテーマ";
  if (!target.lecture) target.lecture = "講義内容が生成されませんでした。";
  if (!target.essential_terms) target.essential_terms = [];

  // --- ヘルパー: 問題オブジェクトの正規化 ---
  const normalizeQuestion = (item) => {
      if (typeof item === 'string') {
          return {
              q: item,
              options: ["A", "B", "C", "D"], 
              correct: 0,
              hint: "",
              exp: "（解説データなし）",
              intention_tag: "err_basic_fact"
          };
      }

      // 問題文の救出
      if (!item.q) {
          item.q = item.question || item.text || item.title || "（問題文なし）";
      }

      // 解説文の救出
      if (!item.exp) {
          item.exp = item.explanation || item.reason || "解説データなし";
      }

      // タグの救出（stats.jsで使用）
      if (!item.intention_tag) {
          item.intention_tag = "err_basic_fact";
      }

      return item;
  };

  // --- A. 正誤問題 (true_false) の補正 ---
  if (!Array.isArray(target.true_false)) {
      target.true_false = [];
  }
  target.true_false = target.true_false.map(normalizeQuestion);

  // 不足分のダミー追加 (最低3問)
  while (target.true_false.length < 3) {
      target.true_false.push({
          q: "（AI生成エラー: 問題数が不足しています）",
          options: ["True", "False"],
          correct: 0,
          exp: "通信状況の良い場所で再生成をお試しください。",
          intention_tag: "err_basic_fact"
      });
  }

  target.true_false.forEach(q => {
      if (typeof q.correct !== 'number') q.correct = 0;
  });

  // --- B. 整序問題 (sort) の補正 ---
  if (!Array.isArray(target.sort)) {
      target.sort = [];
  }
  target.sort = target.sort.map(item => {
      const q = normalizeQuestion(item);
      
      if (!Array.isArray(q.items) || q.items.length === 0) {
           q.items = ["A", "B", "C"];
      }

      // 正解順序がない場合は [0,1,2...] を自動生成
      if (!Array.isArray(q.correct_order)) {
           q.correct_order = q.items.map((_, i) => i);
      }
      return q;
  });

  // 不足分のダミー追加 (最低1問)
  while (target.sort.length < 1) {
      target.sort.push({
          q: "（整序問題の生成に失敗しました）",
          items: ["選択肢A", "選択肢B", "選択肢C"],
          correct_order: [0, 1, 2],
          exp: "再生成をお試しください。",
          intention_tag: "err_flow"
      });
  }
  
  // --- C. 記述問題 (essay) の補正 ---
  if (!target.essay || typeof target.essay !== 'object') {
      target.essay = { q: "記述問題なし", model: "なし" };
  }
  if (!target.essay.q) target.essay.q = "（記述問題の取得失敗）";

  return data; // 元のオブジェクト（修正済み）を返す
};