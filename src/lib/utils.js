// クラス名を結合するユーティリティ
export function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}

// 今日の日付文字列 (YYYY-MM-DD)
export const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// キーボードを閉じる
export const dismissKeyboard = () => {
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
};

// 画面トップへスクロール
export const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ★重要: AI生成データの検証と補正
export const validateLessonData = (data) => {
  if (!data) return null;
  
  if (!data.theme) data.theme = "無題のテーマ";
  if (!data.lecture) data.lecture = "講義内容が生成されませんでした。";
  if (!data.essential_terms) data.essential_terms = [];

  // --- ヘルパー関数: 問題オブジェクトの正規化 ---
  const normalizeQuestion = (item) => {
      // 1. 問題文の救出
      if (typeof item === 'string') {
          return {
              q: item,
              options: ["A", "B", "C", "D"], 
              correct: 0,
              hint: "",
              exp: "（解説データなし）"
          };
      }

      if (!item.q) {
          item.q = item.question || 
                   item.text || 
                   item.problem || 
                   item.statement || 
                   item.content || 
                   item.description || 
                   item.title || 
                   item['問題'] ||   
                   item['問題文'] ||
                   "（問題文データの取得に失敗しました）";
      }

      // 2. 解説文の救出
      if (!item.exp) {
          item.exp = item.explanation || 
                     item.explain || 
                     item.commentary || 
                     item.reason || 
                     item.reasoning ||
                     item.detail || 
                     item.feedback ||
                     item['解説'] || 
                     item['理由'] ||
                     item['説明'] ||
                     "解説データが生成されませんでした。";
      }

      // 3. ヒントの救出
      if (!item.hint) {
          item.hint = item.guide || item['ヒント'] || "";
      }

      return item;
  };

  // --- 4択問題（旧True/False）の補正 ---
  if (!Array.isArray(data.true_false)) {
      data.true_false = [];
  }
  data.true_false = data.true_false.map(item => normalizeQuestion(item));

  while (data.true_false.length < 5) {
      data.true_false.push({
          q: "（AIの問題生成数が不足しています）",
          options: ["A", "B", "C", "D"],
          correct: 0,
          hint: "",
          exp: "システムエラー"
      });
  }

  data.true_false.forEach(q => {
      // optionsの救出（choices等の別名もチェック）
      if (!Array.isArray(q.options) || q.options.length < 2) {
          q.options = q.choices || q.items || ["(選択肢なし)", "(選択肢なし)", "(選択肢なし)", "(選択肢なし)"];
      }
      if (typeof q.correct !== 'number') q.correct = 0;
  });

  // --- 整序問題の補正 ---
  if (!Array.isArray(data.sort)) {
      data.sort = [];
  }
  data.sort = data.sort.map(item => {
      const q = normalizeQuestion(item);
      
      // ★修正: itemsがない場合、optionsやchoices、eventsなどから救出する
      if (!Array.isArray(q.items) || q.items.length === 0) {
           q.items = q.options || q.choices || q.events || q.list || q.words || [];
      }
      
      // それでも空ならデフォルト
      if (!Array.isArray(q.items) || q.items.length === 0) {
           q.items = ["選択肢A", "選択肢B", "選択肢C", "選択肢D"];
      }

      if (!Array.isArray(q.correct_order)) {
           q.correct_order = q.items.map((_, i) => i);
      }
      return q;
  });
  
  // --- 記述問題の補正 ---
  if (!data.essay || typeof data.essay !== 'object') {
      data.essay = {
          q: "（記述問題なし）",
          model: "解答例なし",
          hint: "なし",
          rubric: "なし"
      };
  } else {
      if (!data.essay.q) {
           data.essay.q = data.essay.question || data.essay.text || data.essay['問題'] || "（記述問題の取得失敗）";
      }
      if (!data.essay.model) {
           data.essay.model = data.essay.answer || data.essay.example || data.essay['模範解答'] || "解答例なし";
      }
  }

  return data; 
};

// AI生成データを「フラットな問題リスト」に変換する関数
export const getFlattenedQuestions = (data) => {
  if (!data) return [];
  const list = [];
  
  if (Array.isArray(data.true_false)) {
    data.true_false.forEach(q => list.push({ ...q, type: 'true_false' }));
  }
  
  if (Array.isArray(data.sort)) {
    data.sort.forEach(q => list.push({ ...q, type: 'sort' }));
  }
  
  if (data.essay && data.essay.q) {
    list.push({ ...data.essay, type: 'essay' });
  }
  
  return list;
};