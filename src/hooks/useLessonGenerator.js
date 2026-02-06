import { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callAI } from '../lib/api';
import { APP_ID, DIFFICULTY_DESCRIPTIONS } from '../lib/constants';
import { getTodayString } from '../lib/utils';

export const useLessonGenerator = (apiKey, userId) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [genError, setGenError] = useState(null);

  const generateDailyLesson = async (learningMode, difficulty, selectedUnit, sessionNum) => {
    if (!apiKey || !userId) {
      setGenError("APIキーまたはユーザーIDが不足しています");
      return null;
    }

    setIsProcessing(true);
    setGenError(null);

    try {
      // ★ 追加: まず既存データが存在するか確認する
      // これにより、リロード時などに無駄な再生成（API課金）を防ぎ、学習の続きから再開できる
      const today = getTodayString();
      const docRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress', `${today}_${sessionNum}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        console.log("Existing lesson found. Loading from Firestore.");
        return docSnap.data(); // 生成せずに既存データを返す
      }

      // --- ここから新規生成ロジック ---

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

      // 管理者介入データの取得
      let intervention = null;
      try {
          const iSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'interventions', userId));
          if(iSnap.exists()) intervention = iSnap.data();
      } catch(e) { console.warn("介入データ取得失敗", e); }

      const diffSetting = DIFFICULTY_DESCRIPTIONS[learningMode]?.[difficulty] || DIFFICULTY_DESCRIPTIONS.general.standard;
      const targetUnit = learningMode === 'school' ? selectedUnit : "AIが選定する入試頻出テーマ";

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

      【★入試頻出テーマのエッセンス（優先的に組み込む視点）】
      - **土地・租税の変遷**: 公地公民から荘園公領制、太閤検地、地租改正に至る制度の連続性と転換点。
      - **外交・対外意識**: 冊封、朝貢、国風、海禁、開国といった「日本の立ち位置」と国際情勢の相関。
      - **権力構造の変質**: 摂関、院政、幕府、藩閥、政党政治といった「統治の正当性」がどこに移ったか。
      - **社会経済の連動**: 貨幣経済の浸透、都市の発展、農村の変貌が政治体制に与えた影響。
      `;

      const planPrompt = `
      あなたは${learningMode === 'school' ? '高校の定期テスト作成担当教員' : '東大・早慶レベルの日本史入試を熟知した戦略的講師'}です。
      「${learningMode === 'school' ? '定期テスト' : '大学入試'}」において、最も得点差がつくテーマを設計してください。

      【設定】
      - 時代範囲: ${targetUnit}
      - 難易度: ${diffSetting.label} (${diffSetting.ai})
      - フォーカス: ${learningMode === 'school' ? '基礎知識の定着（教科書準拠）' : '因果関係とテーマ史の構築'}

      【思考基準】
      ${learningMode === 'school' ? schoolCriteria : examCriteria}
      
      ${intervention ? `4. **管理者介入命令**: 「${intervention.focus}」を文脈に組み込め。` : ''}

      【出力形式：JSONのみ】
      {
        "theme": "（例：${learningMode === 'school' ? '摂関政治の仕組みと外戚関係' : '古代から中世における土地所有権の変遷'}）",
        "key_concepts": ["概念1", "概念2", "概念3"],
        "strategic_essence": "このテーマにおける${learningMode === 'school' ? 'テスト頻出の暗記ポイント' : '入試の急所（ひっかけポイント）'}",
        "exam_focus": "このテーマが実際の試験でどのように問われ、どこで差がつくかの一言解説"
      }
      `;

      // ★ userId を渡し、個別設定を反映
      const planRes = await callAI("授業プラン作成", planPrompt, apiKey, userId);
      if (!planRes || !planRes.theme) throw new Error("プラン生成に失敗しました");

      // --- Step 2: Draft (高精度教材執筆) ---

      // ★ 1. 共通フォーマット指示（スマホUI最適化）
      const commonFormat = `
      【視覚的構造化ルール（スマホ閲覧用）】
      1. **「文字の壁」禁止**: 1つの段落は最大3行まで。箇条書きを多用せよ。
      2. **矢印の活用**: 因果関係は文章で長々と書かず、「A → B」「Aにより ↓ B」のように矢印記号を使って視覚化せよ。
      3. **太字の強調**: 文中の重要語句（教科書太字レベル）は必ず **太字** で囲め。
      `;

      // ★ 2. モード別執筆ガイドライン
      let lectureInstruction, tfInstruction, sortInstruction, essayInstruction;

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
             > 出力例:
             > ### 【模範解答】
             > （正解の文章）
             > ### 【採点チェック】
             > - **○○** という語句が入っている (+5点)
             > - **××** について触れている (+5点)
          `;

      } else {
          // --- 入試モード ---
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
             > 出力例:
             > ### 【模範解答】
             > （100字程度の論述）
             > ### 【採点基準】
             > - (加点) キーワード「○○」の使用 (+2点)
             > - (加点) 「AだからB」という論理構成 (+3点)
             > - (減点) 「C」の視点が抜けている (-2点)
          `;
      }

      const draftPrompt = `
      あなたは日本史のプロ講師です。テーマ「${planRes.theme}」に基づき、${learningMode === 'school' ? '定期テスト満点' : '入試突破'}を目指す教材を作成してください。

      【執筆ガイドライン】
      1. **講義 (lecture)**: 
         ${lectureInstruction}
         - "${planRes.strategic_essence}" を講義のハイライトとして組み込め。
         - 最終的に、Markdown形式で見やすく整形すること。
      
      2. **正誤問題 (true_false)**:
         - 3問。
         ${tfInstruction}

      3. **整序問題 (sort)**:
         - 2問（各4項目）。
         ${sortInstruction}

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
        "true_false": [{"q": "...", "options": ["True", "False"], "correct": 0, "exp": "..."}],
        "sort": [{"q": "...", "items": ["...", "...", "...", "..."], "correct_order": [0,1,2,3], "exp": "..."}],
        "essay": {"q": "...", "model": "...", "hint": "..."},
        "column": "..."
      }
      `;

      const draftRes = await callAI("コンテンツ執筆", draftPrompt, apiKey, userId);
      if (!draftRes || !draftRes.lecture) throw new Error("ドラフト生成に失敗しました");

      // --- Step 3: Review (厳格な品質検品：矛盾抹殺) ---
      const reviewPrompt = `
      あなたは「日本史教材の校閲神」です。ドラフトの歴史的正確性と論理整合性を徹底的に検証し、完成品を出力してください。

      【検閲項目：完全無欠の整合性チェック】
      1. **正誤問題 (True/False) の整合性**: 
         - \`correct\`: true なのに、解説(\`exp\`)で「～は誤りである」と書いていないか？
         - \`correct\`: false なのに、解説で「～は正しい」と書いていないか？
         - **矛盾がある場合は、史実に基づき、解説(\`exp\`)の内容を優先して\`correct\`の値を修正せよ（またはその逆）。**
      
      2. **整序問題 (Sort) の整合性**:
         - \`correct_order\` の順序が、解説(\`exp\`)で説明されている歴史的順序と完全に一致しているか？
         - 解説と正解順序が食い違っている場合は、**史実に基づき正しい順序に修正せよ**。

      3. **講義 (Lecture) との整合性**:
         - 講義で説明した内容と、問題の正解が矛盾していないか？
         - 「講義ではAと言ったのに、問題の答えがNot A」という事態は絶対に防げ。

      4. **年号漏れの抹殺**: 整序問題の選択肢に「年号・数字」が含まれていたら即削除せよ。
      
      5. **解説の構造チェック**: 
         - 記述問題の模範解答(model)に、Markdownの「採点基準」リストが含まれているか？
         - 正誤問題の解説(exp)に、${learningMode === 'school' ? '正しい知識' : 'ひっかけタイプ'} が明記されているか？

      【対象データ】
      ${JSON.stringify(draftRes)}

      不備を修正した最終的なJSONオブジェクトのみを返せ。
      `;

      // ★ userId を渡し、個別設定を反映
      const finalRes = await callAI("品質チェック", reviewPrompt, apiKey, userId);
      const contentRes = (finalRes && finalRes.lecture) ? finalRes : draftRes;

      // データの保存
      const lessonData = {
        content: contentRes,
        timestamp: new Date().toISOString(),
        learningMode,
        difficulty,
        completed: false,
        userAnswers: {},
        qIndex: 0
      };

      // Firestoreに保存
      await setDoc(docRef, lessonData);

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

  return { generateDailyLesson, isProcessing, genError };
};