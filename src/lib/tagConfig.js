/**
 * tagConfig.js
 * 日本史学習アプリにおける「弱点タグ」の定義、配色、計算ロジックを一元管理するファイル。
 * AIのプロンプト生成と、UIの表示の両方でこの定数を参照する。
 */

// ==========================================
// 1. カラーパレット定義 (Material Design Colors)
// ==========================================
const COLORS = {
    rose:   { main: '#F43F5E', bg: '#FFF1F2', text: '#BE123C' }, // 弱点・ミス (Rose)
    indigo: { main: '#6366F1', bg: '#EEF2FF', text: '#4338CA' }, // 時代・場所 (Indigo)
    teal:   { main: '#14B8A6', bg: '#F0FDFA', text: '#0F766E' }, // テーマ・性質 (Teal)
    slate:  { main: '#64748B', bg: '#F8FAFC', text: '#475569' }, // 未習得・その他 (Slate)
  };
  
  // ==========================================
  // 2. タグ定義 (ID, Label, Category, PromptDesc)
  // ==========================================
  
  // A. ミス種類タグ (12種) - カテゴリ: MISTAKE
  export const MISTAKE_TAGS = {
    // --- 時系列 (Chronology) ---
    err_chronology: { id: 'err_chronology', label: '#いつの出来事？', category: 'MISTAKE', color: COLORS.rose, desc: '出来事の順序、世紀、時代の前後関係を混同している' },
    err_period_gap: { id: 'err_period_gap', label: '#世紀・年号のズレ', category: 'MISTAKE', color: COLORS.rose, desc: '具体的な世紀や年号の感覚が掴めていない' },
    err_flow:       { id: 'err_flow',       label: '#流れの逆転',     category: 'MISTAKE', color: COLORS.rose, desc: '「原因→結果」の時系列を逆に覚えている' },
  
    // ---論理 (Logic/Causality) ---
    err_cause:      { id: 'err_cause',      label: '#なぜ起きた？',   category: 'MISTAKE', color: COLORS.rose, desc: 'その出来事が起きた背景や理由を理解していない' },
    err_effect:     { id: 'err_effect',     label: '#その後どうなった？', category: 'MISTAKE', color: COLORS.rose, desc: 'その出来事が後世に与えた影響や結果を誤認している' },
    err_purpose:    { id: 'err_purpose',    label: '#目的の勘違い',   category: 'MISTAKE', color: COLORS.rose, desc: '政策や行動の本来の狙い（目的）を取り違えている' },
  
    // --- 構造 (Structure) ---
    err_actor:      { id: 'err_actor',      label: '#誰がやった？',   category: 'MISTAKE', color: COLORS.rose, desc: '天皇、将軍、執権など、主導人物を取り違えている' },
    err_relation:   { id: 'err_relation',   label: '#誰と争った？',   category: 'MISTAKE', color: COLORS.rose, desc: '対立関係や外交相手（国名）を混同している' },
    err_mechanism:  { id: 'err_mechanism',  label: '#仕組みの理解不足', category: 'MISTAKE', color: COLORS.rose, desc: '制度（税制・法制）の具体的な中身や仕組みが分かっていない' },
  
    // --- 知識 (Fact) ---
    err_term_confuse: { id: 'err_term_confuse', label: '#似た言葉の混同', category: 'MISTAKE', color: COLORS.rose, desc: '名称が似ている用語（和同開珎/万年通宝など）を区別できていない' },
    err_basic_fact:   { id: 'err_basic_fact',   label: '#知識の抜け',     category: 'MISTAKE', color: COLORS.rose, desc: '基本的な用語そのものを記憶していない' },
    err_reading:      { id: 'err_reading',      label: '#史料の読み取り', category: 'MISTAKE', color: COLORS.rose, desc: '提示された史料や文章からの情報抽出を間違えている' },
  };
  
  // B. 時代・転換点タグ - カテゴリ: ERA
  export const ERA_TAGS = {
    // 標準時代
    era_ancient:   { id: 'era_ancient',   label: '#古代（飛鳥・奈良）', category: 'ERA', color: COLORS.indigo, desc: '飛鳥・奈良時代' },
    era_heian:     { id: 'era_heian',     label: '#平安',             category: 'ERA', color: COLORS.indigo, desc: '平安時代' },
    era_kamakura:  { id: 'era_kamakura',  label: '#鎌倉',             category: 'ERA', color: COLORS.indigo, desc: '鎌倉時代' },
    era_muromachi: { id: 'era_muromachi', label: '#室町',             category: 'ERA', color: COLORS.indigo, desc: '室町時代' },
    era_edo:       { id: 'era_edo',       label: '#江戸',             category: 'ERA', color: COLORS.indigo, desc: '江戸時代' },
    era_modern:    { id: 'era_modern',    label: '#近代（明治〜）',     category: 'ERA', color: COLORS.indigo, desc: '明治時代以降' },
  
    // ★転換点（Transition Points）
    trans_ritsuryo: { id: 'trans_ritsuryo', label: '#律令の動揺',   category: 'ERA', color: COLORS.indigo, desc: '古代から中世への転換点（摂関〜院政〜平氏）' },
    trans_buke:     { id: 'trans_buke',     label: '#武家政権誕生', category: 'ERA', color: COLORS.indigo, desc: '平安末期から鎌倉への転換点（源平〜執権政治）' },
    trans_sengoku:  { id: 'trans_sengoku',  label: '#戦国下剋上',   category: 'ERA', color: COLORS.indigo, desc: '室町から戦国への転換点（応仁の乱〜戦国大名）' },
    trans_bakuhan:  { id: 'trans_bakuhan',  label: '#幕藩体制確立', category: 'ERA', color: COLORS.indigo, desc: '安土桃山から江戸への転換点（織豊〜幕藩）' },
    trans_ishin:    { id: 'trans_ishin',    label: '#開国と維新',   category: 'ERA', color: COLORS.indigo, desc: '幕末から明治への転換点（開国〜明治維新）' },
  };
  
  // C. テーマタグ - カテゴリ: THEME
  export const THEME_TAGS = {
    theme_politics: { id: 'theme_politics', label: '#政治・外交', category: 'THEME', color: COLORS.teal, desc: '政治史、外交史、戦争' },
    theme_social:   { id: 'theme_social',   label: '#暮らしと経済', category: 'THEME', color: COLORS.teal, desc: '社会経済史、土地制度、商業' },
    theme_culture:  { id: 'theme_culture',  label: '#文化・芸術',   category: 'THEME', color: COLORS.teal, desc: '文化史、宗教、思想、芸術' },
    theme_law:      { id: 'theme_law',      label: '#法と制度',     category: 'THEME', color: COLORS.teal, desc: '法制度史、統治機構' },
  };
  
  // 全タグ統合オブジェクト（ID引き用）
  export const ALL_TAGS = { ...MISTAKE_TAGS, ...ERA_TAGS, ...THEME_TAGS };
  
  // ==========================================
  // 3. 計算・判定ロジック定数
  // ==========================================
  
  // 難易度係数
  export const DIFFICULTY_WEIGHTS = {
    basic: 2.0,    // 基礎: ミスしたらエラーカウント+2 (基礎抜けは重罪)
    standard: 1.0, // 標準: ミスしたらエラーカウント+1
    advanced: 0.5, // 応用: ミスしてもダメージ半分 (挑戦扱い)
  };
  
  // アクション係数
  export const ACTION_WEIGHTS = {
    mistake: 1.0,   // 通常ミス
    giveup: 1.5,    // ギブアップ（知識皆無）は重く
    partial: 0.5,   // 記述の部分点
  };
  
  // 得意・苦手判定の閾値
  export const ANALYSIS_THRESHOLDS = {
    minAttempts: 3,      // 分析に必要な最低試行回数
    weaknessRatio: 0.4,  // これ以上の誤答率なら「苦手」
    strengthRatio: 0.1,  // これ以下の誤答率なら「得意」
  };
  
  // ==========================================
  // 4. ヘルパー関数
  // ==========================================
  
  /**
   * タグIDから表示用の設定（ラベル、色）を取得する
   */
  export const getTagConfig = (tagId) => {
    return ALL_TAGS[tagId] || { 
      id: tagId, 
      label: `#${tagId}`, 
      category: 'UNKNOWN', 
      color: COLORS.slate 
    };
  };
  
  /**
   * 難易度と結果に基づいて、加算すべきエラー値を計算する
   */
  export const calculateErrorWeight = (difficulty, resultType) => {
    // 存在しないキーが来た場合のフォールバック
    const diffWeight = DIFFICULTY_WEIGHTS[difficulty] !== undefined ? DIFFICULTY_WEIGHTS[difficulty] : 1.0;
    const actWeight = ACTION_WEIGHTS[resultType] !== undefined ? ACTION_WEIGHTS[resultType] : 1.0;
    return Number((diffWeight * actWeight).toFixed(1)); 
  };
  
  /**
   * AIプロンプト用にタグリストを生成する
   * @param {string|string[]} categories - 'MISTAKE' | 'ERA' | 'THEME'
   */
  export const generateTagPrompt = (categories) => {
    const cats = Array.isArray(categories) ? categories : [categories];
    let promptText = "";
  
    const appendTags = (title, tagObj) => {
      promptText += `### ${title}:\n`;
      promptText += Object.values(tagObj)
        .map(t => `- ${t.id}: ${t.desc}`)
        .join('\n') + "\n\n";
    };
  
    if (cats.includes('MISTAKE')) appendTags('Mistake Types (Select 1-2 if applicable)', MISTAKE_TAGS);
    if (cats.includes('ERA')) appendTags('Era Tags (Select 1)', ERA_TAGS);
    if (cats.includes('THEME')) appendTags('Theme Tags (Select 1)', THEME_TAGS);
    
    return promptText.trim();
  };
  
  /**
   * データベース保存前のバリデーション
   */
  export const validateTags = (tagList) => {
    if (!Array.isArray(tagList)) return [];
    return tagList.filter(tagId => ALL_TAGS[tagId] !== undefined);
  };
  
  // ==========================================
  // 5. 安全性確保 (Freeze)
  // ==========================================
  Object.freeze(COLORS);
  Object.freeze(MISTAKE_TAGS);
  Object.freeze(ERA_TAGS);
  Object.freeze(THEME_TAGS);
  Object.freeze(ALL_TAGS);
  Object.freeze(DIFFICULTY_WEIGHTS);
  Object.freeze(ACTION_WEIGHTS);
  Object.freeze(ANALYSIS_THRESHOLDS);