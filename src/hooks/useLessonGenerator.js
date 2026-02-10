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
   * @param {number} sessionNum 
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
   * @param {number} sessionNum 
   * @param {object} progressData 更新したいデータ
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
   * @param {string} learningMode - 'school' | 'exam' | 'review'
   * @param {string} difficulty - 'easy' | 'normal' | 'hard'
   * @param {string} selectedUnit - 単元名（Reviewモード時は無視される場合あり）
   * @param {number} sessionNum - セッション番号
   * @param {object} reviewContext - 復習モード用の戦略データ { target_era, target_mistake, reason }
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

      // 管理者介入データの取得（もしあれば）
      let intervention = null;
      try {
          const iSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'interventions', userId));
          if(iSnap.exists()) intervention = iSnap.data();
      } catch(e) { console.warn("介入データ取得失敗", e); }

      const diffSetting = DIFFICULTY_DESCRIPTIONS[learningMode]?.[difficulty] || DIFFICULTY_DESCRIPTIONS.general.standard;
      
      // ターゲット単元の決定
      let targetUnit = selectedUnit;
      if (learningMode === 'school') targetUnit = selectedUnit;
      else if (learningMode === 'exam') targetUnit = "AIが選定する入試頻出テーマ";
      else if (learningMode === 'review' && reviewContext) {
        // Reviewモードなら、戦略からターゲットを生成
        targetUnit = `${reviewContext.target_era_label}における${reviewContext.target_mistake_label}の克服`;
      }

      // --- Step 1: Plan (戦略的テーマ選定) ---
      
      const schoolCriteria = `
      1. **教科書準拠**: 『山川出版社 詳説日本史』などの教科書目次に忠実に、指定単元（${targetUnit}）内の重要項目を網羅すること。
      2. **太字用語の優先**: 授業で板書されるレベルの重要語句（太字）を必ずタイトルや核心概念に含めること。
      3. **マイクロ時系列**: 広い時代の流れではなく、「特定の内乱の経過」や「一連の法整備の順序」など、狭い範囲の詳細な流れをテーマにすること。
      `;

      const examCriteria = `
      1. **縦のつながり（テーマ史）**: 土地制度、対外関係、通貨、宗教政策など、歴史を貫く「一本の軸」をテーマに据えること。
      2. **多角的分析**: 政治的事件を、経済的背景（税制・貿易）や社会的影響（民衆・宗教）と結びつけて解説すること。
      3. **識別ポイントの強調**: 鎌倉と室町の守護の権限差、徳川綱吉と吉宗の政策差など、類似事象を比較・対照させること。
      `;

      // ★ 追加: 復習モードの基準
      const reviewCriteria = `
      1. **弱点一点突破**: ユーザーは「${reviewContext?.target_era_label}」において「${reviewContext?.target_mistake_label}」をする傾向があります。この特定の弱点を克服することだけに集中してください。
      2. **紛らわしさの強化**: 単なる事実の羅列ではなく、「なぜ間違えやすいのか」「どこが混同しやすいポイントか」を徹底的に比較・解説すること。
      3. **トラップ重視**: クイズでは、ユーザーの弱点（例：時期のズレ）を誘発するような、巧妙な誤答選択肢を用意すること。
      `;

      // モードに応じた基準を選択
      let criteria = examCriteria;
      if (learningMode === 'school') criteria = schoolCriteria;
      if (learningMode === 'review') criteria = reviewCriteria;

      const planPrompt = `
      あなたは${learningMode === 'school' ? '高校の定期テスト作成担当教員' : learningMode === 'review' ? '弱点克服専門の鬼コーチ' : '東大・早慶レベルの日本史入試を熟知した戦略的講師'}です。
      「${learningMode === 'school' ? '定期テスト' : learningMode === 'review' ? '弱点克服ドリル' : '大学入試'}」において、最も効果的なテーマを設計してください。

      【設定】
      - ターゲット: ${targetUnit}
      - 難易度: ${diffSetting.label} (${diffSetting.ai})
      - フォーカス: ${learningMode === 'review' ? '特定のミスパターンの矯正' : '因果関係とテーマ史の構築'}

      【思考基準】
      ${criteria}
      
      ${intervention ? `4. **管理者介入命令**: 「${intervention.focus}」を文脈に組み込め。` : ''}

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
        "theme": "（例：${learningMode === 'review' ? '鎌倉仏教における各宗派の開祖と教えの識別' : '古代から中世における土地所有権の変遷'}）",
        "key_concepts": ["概念1", "概念2", "概念3"],
        "strategic_essence": "このテーマにおける${learningMode === 'school' ? 'テスト頻出の暗記ポイント' : '入試の急所（ひっかけポイント）'}",
        "exam_focus": "このテーマが実際の試験でどのように問われ、どこで差がつくかの一言解説",
        "era_tag": "${learningMode === 'review' ? reviewContext.target_era : 'era_xxx'}",
        "theme_tag": "${learningMode === 'review' ? reviewContext.target_theme : 'theme_xxx'}"
      }
      `;

      const planRes = await callAI("授業プラン作成", planPrompt, apiKey, userId);
      if (!planRes || !planRes.theme) throw new Error("プラン生成に失敗しました");

      // --- Step 2: Draft (高精度教材執筆) ---

      const commonFormat = `
      【視覚的構造化ルール（スマホ閲覧用）】
      1. **「文字の壁」禁止**: 1つの段落は最大3行まで。箇条書きを多用せよ。
      2. **矢印の活用**: 因果関係は文章で長々と書かず、「A → B」「Aにより ↓ B」のように矢印記号を使って視覚化せよ。
      3. **太字の強調**: 文中の重要語句（教科書太字レベル）は必ず **太字** で囲め。
      `;

      let lectureInstruction, tfInstruction, sortInstruction, essayInstruction;

      // モード別インストラクション定義
      if (learningMode === 'school') {
          // --- 学校モード ---
          lectureInstruction = `
           ${commonFormat}
           - **講義スタイル**: 「歴史ドラマのナレーター」のように語れ。
           - **ストーリーテリング**: 「なぜその決断に至ったのか」という**歴史上の人物の動機（焦り・野心・恐怖）**を交えて解説せよ。
           - **構成テンプレート**:
             ### 1. 【背景】ドラマの幕開け
             （当時の状況と感情的動機）
             ### 2. 【経過】時系列フロー
             （"年：出来事" のリスト形式）
             ### 3. 【結果】テストに出るポイント
             （結末と影響を箇条書き）
           - 解説内容: 教科書の記述に忠実に、太字レベルの重要語句を網羅せよ。${diffGuide.lecture}
          `;
          tfInstruction = `
           - 難易度設定に従い、${diffGuide.tf}
           - **解説 (exp)**: 「人物名」「事件名」「場所」のどこが間違っていたかを指摘し、**「正しくは○○である」**という正確な知識を提示せよ。
          `;
          sortInstruction = `
           - **マイクロ整序**: 「同一事件内の経過」や「一人の天皇の治世中の出来事」を並べ替えさせよ。
           - **解説 (exp)**: 年号暗記ではなく、「Aが起きてからB」という前後関係を、**矢印（→）を用いて図式化**して解説せよ。
          `;
          essayInstruction = `
           - **定期テスト型**: 「〜の内容を説明せよ」といった用語の定義・内容説明を求めよ。
           - **模範解答 (model)**: 単なる正解だけでなく、**「部分点ガイド」**を含めてMarkdown形式で出力せよ。
          `;

      } else if (learningMode === 'review') {
          // --- ★ 復習モード (New!) ---
          lectureInstruction = `
           ${commonFormat}
           - **講義スタイル**: 「弱点矯正クリニックの専門医」のように語れ。
           - **比較・対照**: ターゲットである「${reviewContext?.target_mistake_label}」を防ぐため、**紛らわしい用語の比較表**や、**間違いやすいポイントの対比**（Aだと思われがちだが実はB、など）を主軸にせよ。
           - **構成テンプレート**:
             ### 1. よくある誤解（Before）
             （多くの受験生が陥るミス事例）
             ### 2. 正しい理解（After）
             （図解や比較リストを用いた矯正解説）
             ### 3. 【決定版】見分け方のコツ
             （試験で迷わないための判断基準）
           - 解説内容: 単なる通史ではなく、**差分と識別**に特化せよ。
          `;
          tfInstruction = `
           - **意地悪な出題**: ユーザーの弱点「${reviewContext?.target_mistake_label}」を誘うような選択肢を作れ。
           - 例: 時期が弱点なら、世紀を一つだけずらした選択肢を入れるなど。
           - **解説 (exp)**: 「なぜその間違い選択肢を選んでしまいがちか」という心理的な罠まで解説せよ。
          `;
          sortInstruction = `
           - **紛らわしい整序**: 因果関係が密接で、どっちが先か迷いやすい事象（同時期の法令や反乱など）を並べ替えさせよ。
           - **解説 (exp)**: 年号暗記に頼らず、論理的な前後関係の必然性を説け。
          `;
          essayInstruction = `
           - **弱点克服型**: 「AとBの違いを説明せよ」や「なぜAではなくBという政策が採られたか」など、曖昧な理解では書けない問題を課せ。
           - **模範解答 (model)**: ミスしやすいポイントへの警告を含めよ。
          `;

      } else {
          // --- 入試モード (Default) ---
          lectureInstruction = `
           ${commonFormat}
           - **講義スタイル**: 「大手予備校のカリスマ講師」のように語れ。
           - **思考プロセス実況**: 「受験生はどこで間違えやすいか（出題の罠）」というメタ視点を暴露せよ。
           - **構成テンプレート**:
             ### 1. 歴史の因果（メカニズム）
             （"原因 → 結果" のフローチャート）
             ### 2. 【実況】入試の急所・誤答パターン
             （"A vs B" の対比構造やひっかけポイント）
             ### 3. 戦略的ハイライト
             （"${planRes.strategic_essence}" の深掘り）
           - 解説内容: ${diffGuide.lecture}
          `;
          tfInstruction = `
           - 難易度設定に従い、${diffGuide.tf}
           - **解説 (exp)**: 単に正誤を述べるだけでなく、**「なぜその誤文が作られたか（出題意図）」**を解説せよ。
           - 文頭に **【ひっかけタイプ：時期のズレ / 因果の逆転 / 主語のすり替え】** を太字で明記し、騙されないための着眼点を教えよ。
          `;
          sortInstruction = `
           - **共通テスト形式**: ${diffGuide.sort}
           - 【絶対禁止】: 選択肢の中に具体的な年号（数字）を含めるな。
           - **解説 (exp)**: 年号を使わず、**「〜の結果、必然的に〜が起きた」**という論理の鎖（コネクタ）を用いて順序を証明せよ。
          `;
          essayInstruction = `
           - **難関国公立大学（東大・一橋レベル）シミュレーション**: ${diffGuide.essay}
           - 指定語句型、意義説明型、比較変遷型のいずれかで出題せよ。
           - **模範解答 (model)**: 単なる正解だけでなく、**「自己採点用ガイド」**を含めてMarkdown形式で出力せよ。
          `;
      }

      const draftPrompt = `
      あなたは日本史のプロ講師です。テーマ「${planRes.theme}」に基づき、${learningMode === 'school' ? '定期テスト満点' : '入試突破'}を目指す教材を作成してください。

      【弱点タグの付与 (重要)】
      作成する各問題（正誤・整序）には、その問題が「何の理解不足」をチェックしているかを示す \`intention_tag\` を必ず付与してください。
      [Mistake Tags]
      ${mistakeTagsPrompt}
      ${learningMode === 'review' ? `※特に「${reviewContext?.target_mistake}」を重点的にテストする問題を含めてください。` : ''}

      【執筆ガイドライン】
      1. **講義 (lecture)**: 
         ${lectureInstruction}
         - "${planRes.strategic_essence}" を講義のハイライトとして組み込め。
         - 最終的に、Markdown形式で見やすく整形すること。
      
         
      2. **正誤問題 (true_false)**:
         - 3問。
         ${tfInstruction}
         - 各問題に適切な \`intention_tag\` を選定せよ（例: 時期を問うなら err_chronology）。

      3. **整序問題 (sort)**:
         - 2問（各4項目）。
         ${sortInstruction}
         - 各問題に適切な \`intention_tag\` を選定せよ（例: 流れを問うなら err_flow）。

      4. **記述問題 (essay)**: 
         ${essayInstruction}
         - **文字数**: ${diffGuide.essay_len}。

      5. **重要語句 (essential_terms)**: 5つ。{term, def}形式。
      ${intervention ? `6. **コラム**: 雑学ネタ「${intervention.interest}」を活用せよ。` : ''}

      出力はJSON形式のみ:
      {
        "theme": "${planRes.theme}",
        "lecture": "...",
        "essential_terms": [{"term": "...", "def": "..."}],
        "true_false": [
          {"q": "...", "options": ["True", "False"], "correct": 0, "exp": "...", "intention_tag": "err_xxx"}
        ],
        "sort": [
          {"q": "...", "items": ["..."], "correct_order": [0,1,2,3], "exp": "...", "intention_tag": "err_xxx"}
        ],
        "essay": {"q": "...", "model": "...", "hint": "..."},
        "column": "..."
      }
      `;

      const draftRes = await callAI("コンテンツ執筆", draftPrompt, apiKey, userId);
      if (!draftRes || !draftRes.lecture) throw new Error("ドラフト生成に失敗しました");

      // --- Step 3: Review (厳格な品質検品) ---
      const reviewPrompt = `
      あなたは「日本史教材の校閲神」です。ドラフトの歴史的正確性と論理整合性を徹底的に検証し、完成品を出力してください。

      【検閲項目】
      1. **整合性**: 正誤問題の正解と解説が矛盾していないか？
      2. **タグ**: \`era_tag\`, \`theme_tag\`, \`intention_tag\` が含まれているか？
      3. **年号**: 整序問題の選択肢に年号が含まれていたら削除せよ。
      4. **解説構造**: 記述問題の模範解答にMarkdownの採点基準が含まれているか？

      【対象データ】
      Plan Data: ${JSON.stringify({ era_tag: planRes.era_tag, theme_tag: planRes.theme_tag })}
      Draft Data: ${JSON.stringify(draftRes)}

      不備を修正した最終的なJSONオブジェクトのみを返せ。
      出力には Plan Data の \`era_tag\` と \`theme_tag\` もトップレベルに含めること。
      `;

      const finalRes = await callAI("品質チェック", reviewPrompt, apiKey, userId);
      const contentRes = (finalRes && finalRes.lecture) ? finalRes : draftRes;

      // データの保存
      const lessonData = {
        ...contentRes, 
        era_tag: contentRes.era_tag || planRes.era_tag,
        theme_tag: contentRes.theme_tag || planRes.theme_tag,
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

      await saveProgress(sessionNum, lessonData);

      // 用語の自動保存
      if (contentRes.essential_terms) {
        await Promise.all(contentRes.essential_terms.map(async (term) => {
            try {
                const termRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'vocabulary', term.term);
                await setDoc(termRef, { 
                    term: term.term, 
                    def: term.def, 
                    addedAt: new Date().toISOString(),
                    count: 1 
                }, { merge: true });
            } catch(e) { console.error("用語保存エラー", e); }
        }));
      }

      return lessonData;

    } catch (e) {
      console.error(e);
      setGenError(e.message || "生成中にエラーが発生しました");
      throw e;
    } finally {
      setIsProcessing(false);
    }
  };

  return { generateDailyLesson, fetchTodayLesson, saveProgress, isProcessing, genError };
};