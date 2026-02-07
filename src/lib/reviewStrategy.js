/**
 * src/lib/reviewStrategy.js
 * ユーザーの学習履歴と統計データを分析し、
 * 「今、最も復習すべきテーマ（Era/Theme/Mistake）」を決定するロジック。
 * * 採用理論:
 * 1. 直近のミス優先 (Immediate Correction)
 * 2. 忘却曲線対策 (Spaced Repetition - しばらく触れていない弱点を出す)
 * 3. 慢性的な弱点 (Chronic Weakness - 単純に正答率が低いもの)
 */

import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { APP_ID } from './constants';
import { ALL_TAGS, ERA_TAGS, THEME_TAGS, MISTAKE_TAGS } from './tagConfig';

// 分析に使用する過去ログの最大数
const HISTORY_LIMIT = 10;

// 定数: スコアリングの重み
const WEIGHTS = {
  ERROR_RATE: 50,      // 誤答率 (0.0~1.0) * 50 => Max 50pt
  RECENT_MISS: 40,     // 直近で間違えた場合のボーナス => 40pt (緊急性高)
  LONG_ABSENCE: 30,    // しばらくやっていない場合のボーナス => 30pt (忘却対策)
};

/**
 * 復習すべき戦略を算出するメイン関数
 * @param {string} userId 
 */
export const getReviewStrategy = async (userId) => {
  if (!userId) return null;

  try {
    // 1. データ取得 (並列実行で高速化)
    const [statsSnap, historySnap] = await Promise.all([
      getDoc(doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'summary')),
      getDocs(query(
        collection(db, 'artifacts', APP_ID, 'users', userId, 'daily_progress'),
        orderBy('timestamp', 'desc'),
        limit(HISTORY_LIMIT)
      ))
    ]);

    const stats = statsSnap.exists() ? statsSnap.data() : null;
    const history = historySnap.docs.map(d => ({ ...d.data(), id: d.id }));

    // データ不足時はデフォルト戦略（ランダム）を返す
    if (!stats || history.length === 0) {
      return createFallbackStrategy();
    }

    // 2. タグごとのスコアリング
    // 全タグをリスト化し、優先度を計算する
    const scoredTags = calculateTagScores(stats, history);

    // 3. 最優先のタグを選定
    // Era, Theme, Mistake それぞれからトップスコアのものを抽出
    const targetEra = selectTopTag(scoredTags, 'ERA');
    const targetTheme = selectTopTag(scoredTags, 'THEME');
    const targetMistake = selectTopTag(scoredTags, 'MISTAKE');

    // 4. 戦略の組み立て (Strategy Construction)
    // もし弱点が見つからない場合はランダムで埋める
    const selectedEra = targetEra || getRandomTag(ERA_TAGS);
    const selectedTheme = targetTheme || getRandomTag(THEME_TAGS);
    
    // Mistakeタグは、もし見つからなければ「意地悪な問題全般」とするためnullでもOKだが、
    // ここではあえてランダムな「苦手候補」を入れておく
    const selectedMistake = targetMistake || getRandomTag(MISTAKE_TAGS);

    return {
      mode: 'review',
      target_era: selectedEra.id,
      target_era_label: selectedEra.label, // 追加: ラベルも渡すとUI側で楽
      target_theme: selectedTheme.id,
      target_mistake: selectedMistake.id,
      target_mistake_label: selectedMistake.label, // 追加
      reason: generateReason(targetEra, targetMistake, history)
    };

  } catch (e) {
    console.error("Review strategy error:", e);
    return createFallbackStrategy();
  }
};

/**
 * 全タグの優先度スコアを計算する
 */
const calculateTagScores = (stats, history) => {
  const scores = [];

  // 統計データにある全タグをループ
  ['eras', 'themes', 'mistakes'].forEach(category => {
    if (!stats[category]) return;

    Object.entries(stats[category]).forEach(([tagId, data]) => {
      // 除外: 試行回数が少なすぎるタグは分析対象外
      if ((data.attempts || 0) < 3) return;

      let score = 0;
      const errorRate = (data.errors || 0) / data.attempts;
      
      // A. 慢性的な弱点スコア
      score += errorRate * WEIGHTS.ERROR_RATE;

      // B. 直近の学習状況を分析 (History loop)
      let lastSeenIndex = -1;
      let hasRecentError = false;

      history.forEach((session, index) => {
        // このセッションにタグが含まれていたか？
        const content = session.content || {};
        const isMatch = 
          content.era_tag === tagId || 
          content.theme_tag === tagId || 
          (session.quizResults && session.quizResults.some(q => q.tags?.includes(tagId))) ||
          (session.gradingResult && session.gradingResult.tags?.includes(tagId));

        if (isMatch) {
          if (lastSeenIndex === -1) lastSeenIndex = index;
          
          // 直近3回以内でミスしていたか？
          if (index < 3) {
             hasRecentError = true; 
          }
        }
      });

      // C. 時間的重み付け (Hybrid Logic)
      if (hasRecentError) {
        // 直近のミス (Emergency): 最優先
        score += WEIGHTS.RECENT_MISS;
      } else if (lastSeenIndex === -1 && errorRate > 0.3) {
        // 履歴(直近10回)に出てこない & 苦手である = 忘却の彼方
        score += WEIGHTS.LONG_ABSENCE;
      }

      scores.push({
        id: tagId,
        category: ALL_TAGS[tagId]?.category || 'UNKNOWN',
        score: score,
        errorRate: errorRate,
        label: ALL_TAGS[tagId]?.label
      });
    });
  });

  return scores.sort((a, b) => b.score - a.score); // スコア高い順
};

/**
 * カテゴリごとのトップタグを取得
 */
const selectTopTag = (scoredTags, category) => {
  return scoredTags.find(t => t.category === category);
};

/**
 * ランダムにタグを1つ選ぶ（フォールバック用）
 */
const getRandomTag = (tagObj) => {
  const keys = Object.keys(tagObj);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return { id: randomKey, ...tagObj[randomKey] }; // IDを含めて返す
};

/**
 * ユーザーに提示する「復習の理由」を生成
 */
const generateReason = (era, mistake, history) => {
  if (era && mistake) {
    // 直近でミスしたか確認
    const isRecent = history.slice(0, 3).some(h => 
      JSON.stringify(h).includes(era.id) || JSON.stringify(h).includes(mistake.id)
    );

    if (isRecent) {
      return `⚠️ 直近のミス分析: 「${era.label}」での「${mistake.label}」が目立ちます。記憶が鮮明なうちに修正しましょう。`;
    } else {
      return `📉 忘却曲線アラート: 「${era.label}」の学習から時間が空いています。「${mistake.label}」の傾向を再チェックします。`;
    }
  }
  return "AI分析: あなたの学習傾向に基づき、最適な復習カリキュラムを編成しました。";
};

/**
 * データがない場合のデフォルト戦略
 */
const createFallbackStrategy = () => {
  return {
    mode: 'review',
    target_era: 'era_heian', // デフォルト
    target_era_label: '平安時代',
    target_theme: 'theme_politics',
    target_mistake: 'err_chronology',
    target_mistake_label: '時期の混同',
    reason: "🔰 まずは基本となる平安時代の政治史から、歴史の流れを確認しましょう。"
  };
};