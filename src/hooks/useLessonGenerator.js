import { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callAI } from '../lib/api';
import { APP_ID, DIFFICULTY_DESCRIPTIONS } from '../lib/constants';
import { getTodayString } from '../lib/utils';
import { generateTagPrompt } from '../lib/tagConfig'; 

export const useLessonGenerator = (apiKey, userId) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [genError, setGenError] = useState(null);

  /**
   * 今日のレッスンデータがあれば取得（再開用）
   */
  const fetchTodayLesson = async (sessionNum) => {
    if (!userId) return null;
    const today = getTodayString();
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`);
    
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        console.log("Found existing lesson data for today.");
        return snap.data(); // 保存されていたデータを返す
      }
    } catch (e) {
      console.error("Fetch error:", e);
    }
    return null;
  };

  /**
   * 進捗状況を保存（こまめに呼ぶ用）
   */
  const saveProgress = async (sessionNum, progressData) => {
    if (!userId) return;
    const today = getTodayString();
    const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`);
    
    try {
      // 既存データにマージ保存
      await setDoc(docRef, progressData, { merge: true });
    } catch (e) {
      console.error("Save progress error:", e);
    }
  };

  /**
   * 新規レッスンをAI生成
   */
  const generateDailyLesson = async (learningMode, difficulty, selectedUnit, sessionNum, reviewContext = null) => {
    if (!apiKey || !userId) {
      setGenError("APIキーまたはユーザーIDが不足しています");
      return null;
    }

    setIsProcessing(true);
    setGenError(null);

    try {
      // タグ定義プロンプトの生成
      const eraTagsPrompt = generateTagPrompt('ERA');
      const themeTagsPrompt = generateTagPrompt('THEME');
      const mistakeTagsPrompt = generateTagPrompt('MISTAKE');

      // 0. 難易度別ガイドラインの動的生成
      const getDiffGuide = (level) => {
        switch(level) {
          case 'easy':
            return {
              lecture: "中学生でも分かるように、専門用語には必ず補足説明を入れ、比喩を使ってストーリー調で解説せよ。",
              tf: "「明らかに時代が違う」「人物が全く違う」といった、基礎知識があれば即答できる誤文を作成せよ。",
              sort: "時代の離れた事象を選び、大きな歴史の流れ（世紀単位）が分かれば解けるようにせよ。",
              essay_len: "60〜80字"
            };
          case 'hard':
            return {
              lecture: "難関大・マニアックな定期テストに耐えうるよう、学術用語を正確に使い、歴史の構造的背景（社会・経済的要因）まで深く掘り下げよ。",
              tf: "「主語と述語のクロス」「因果関係の逆転」「限定語句（のみ、すべて）の誤用」など、精読が必要な高度なひっかけを作れ。",
              sort: "「同時代の出来事」や「数年単位の因果」など、精密な理解がないと解けない難問にせよ。",
              essay_len: "120〜150字"
            };
          default: // standard
            return {
              lecture: "標準的な教科書・共通テストレベルを想定し、重要語句を網羅しつつ、論理的な因果関係（AだからB）を明確に記述せよ。",
              tf: "教科書の脚注レベルの知識や、よくある勘違い（似た用語の混同）を突く標準的な問題にせよ。",
              sort: "歴史的因果関係（原因→結果）を理解していれば正解できる、標準的な難易度にせよ。",
              essay_len: "100〜120字"
            };
        }
      };

      const diffGuide = getDiffGuide(difficulty);
      const diffSetting = DIFFICULTY_DESCRIPTIONS[learningMode]?.[difficulty] || DIFFICULTY_DESCRIPTIONS.general.standard;
      
      // ターゲット単元の決定
      let targetUnit = selectedUnit;
      if (learningMode === 'school') targetUnit = selectedUnit;
      else if (learningMode === 'exam') targetUnit = "AIが選定する入試頻出テーマ";
      else if (learningMode === 'review' && reviewContext) {
        targetUnit = `${reviewContext.target_era_label}における${reviewContext.target_mistake_label}の克服`;
      }

      // --- Step 1: Plan (戦略的テーマ選定) ---
      
      const planPrompt = `
      あなたは${learningMode === 'school' ? '高校の定期テスト作成担当教員' : learningMode === 'review' ? '弱点克服専門の鬼コーチ' : '東大・早慶レベルの日本史入試を熟知した戦略的講師'}です。
      「${learningMode === 'school' ? '定期テスト' : learningMode === 'review' ? '弱点克服ドリル' : '大学入試'}」において、最も効果的なテーマを設計してください。

      【設定】
      - ターゲット: ${targetUnit}
      - 難易度: ${diffSetting.label} (${diffSetting.ai})
      - フォーカス: ${learningMode === 'review' ? '特定のミスパターンの矯正' : '因果関係とテーマ史の構築'}

      【タグ分類（分析用）】
      ${learningMode === 'review' ? 
        `※復習モードのため、以下のタグIDを強制的に使用すること:
         Era: ${reviewContext.target_era}
         Theme: ${reviewContext.target_theme}` 
        : 
        `以下のリストから、このテーマに最も適したタグIDを1つずつ選んでください。
         [Era Tags]
         ${eraTagsPrompt}
         [Theme Tags]
         ${themeTagsPrompt}`
      }

      【出力形式：JSONのみ】
      {
        "theme": "テーマタイトル",
        "key_concepts": ["概念1", "概念2", "概念3"],
        "strategic_essence": "学習のポイント",
        "exam_focus": "試験での問われ方",
        "era_tag": "${learningMode === 'review' ? reviewContext.target_era : 'era_xxx'}",
        "theme_tag": "${learningMode === 'review' ? reviewContext.target_theme : 'theme_xxx'}"
      }
      `;

      const planRes = await callAI("授業プラン作成", planPrompt, apiKey, userId);
      if (!planRes || !planRes.theme) throw new Error("プラン生成に失敗しました");

      // --- Step 2: Draft (高精度教材執筆) ---

      let draftInstruction = "";
      if (learningMode === 'review') {
          draftInstruction = `
           - **講義**: 「弱点矯正クリニック」として、${reviewContext?.target_mistake_label}を防ぐための比較・対照解説を行え。
           - **正誤**: ${reviewContext?.target_mistake_label}を誘発するような意地悪な選択肢を含めよ。
          `;
      } else {
          draftInstruction = `
           - **講義**: ${diffGuide.lecture}
           - **正誤**: ${diffGuide.tf}
           - **整序**: ${diffGuide.sort}
           - **記述**: ${diffGuide.essay_len}文字程度。
          `;
      }

      const draftPrompt = `
      あなたは日本史のプロ講師です。テーマ「${planRes.theme}」に基づき教材を作成してください。

      【弱点タグの付与】
      各問題には \`intention_tag\` を付与してください。
      [Mistake Tags]
      ${mistakeTagsPrompt}

      【執筆ガイドライン】
      ${draftInstruction}

      出力はJSON形式のみ:
      {
        "theme": "${planRes.theme}",
        "lecture": "Markdown形式の講義テキスト",
        "essential_terms": [{"term": "用語", "def": "定義"}],
        "true_false": [
          {"q": "問題文", "options": ["True", "False"], "correct": 0, "exp": "解説", "intention_tag": "err_xxx"}
        ],
        "sort": [
          {"q": "問題文", "items": ["A","B","C"], "correct_order": [0,1,2], "exp": "解説", "intention_tag": "err_xxx"}
        ],
        "essay": {"q": "問題文", "model": "模範解答", "hint": "ヒント"}
      }
      `;

      const draftRes = await callAI("コンテンツ執筆", draftPrompt, apiKey, userId);
      if (!draftRes || !draftRes.lecture) throw new Error("ドラフト生成に失敗しました");

      // コンテンツの結合
      const lessonData = {
        content: {
            ...draftRes,
            era_tag: planRes.era_tag,
            theme_tag: planRes.theme_tag,
            strategic_essence: planRes.strategic_essence
        },
        timestamp: new Date().toISOString(),
        learningMode,
        difficulty,
        completed: false,
        userAnswers: {},
        currentStep: 'lecture', 
        scores: { 
          quizCorrect: 0, quizTotal: 0, essayScore: 0, essayTotal: 10, nextAction: null 
        } 
      };

      // データの保存
      await saveProgress(sessionNum, lessonData);

      // 用語の自動保存
      if (draftRes.essential_terms) {
        draftRes.essential_terms.forEach(async (term) => {
            try {
                const termRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'vocabulary', term.term);
                await setDoc(termRef, { 
                    term: term.term, 
                    def: term.def, 
                    addedAt: new Date().toISOString(),
                    count: 1 
                }, { merge: true });
            } catch(e) { console.error("用語保存エラー", e); }
        });
      }

      return lessonData;

    } catch (e) {
      console.error(e);
      setGenError(e.message || "生成中にエラーが発生しました");
      return null; // エラー時はnullを返す
    } finally {
      setIsProcessing(false);
    }
  };

  return { generateDailyLesson, fetchTodayLesson, saveProgress, isProcessing, genError };
};