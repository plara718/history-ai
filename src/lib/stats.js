/**
 * src/lib/stats.js
 * 学習結果（LessonData + GradingResult）を集計し、
 * Firestoreの統計ドキュメント（stats/summary）を安全に更新するモジュール。
 */

import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { APP_ID } from './constants';
// ※ tagConfigの実装に依存しますが、計算ロジック自体はこのファイルで完結させます
import { ALL_TAGS } from './tagConfig'; 

/**
 * レッスン完了時に統計データを更新する関数
 * @param {string} userId - ユーザーID
 * @param {object} lessonData - 生成されたレッスンデータ
 * @param {object} gradingResult - 採点結果
 */
export const saveLessonStats = async (userId, lessonData, gradingResult) => {
  if (!userId || !lessonData || !gradingResult) {
    console.error('Stats Error: Missing required data for saving stats.');
    return;
  }

  try {
    const statsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'summary');

    // ---------------------------------------------------------
    // 0. メモリ上での一時集計 (重複キー対策)
    // ---------------------------------------------------------
    // Firestoreの update({ "key": increment(1) }) は便利ですが、
    // 同じキーに対して複数回 increment を発行することは1回の通信ではできません。
    // そのため、まずは数値として合算します。
    const tempCounts = {};

    const addCount = (key, value = 1) => {
      if (!tempCounts[key]) tempCounts[key] = 0;
      tempCounts[key] += value;
    };

    // 基本情報の集計
    addCount('totalSessions', 1);
    addCount('totalQuizzes', lessonData.quizzes ? lessonData.quizzes.length : 0);

    // ---------------------------------------------------------
    // 1. 時代(Era)・テーマ(Theme)の集計
    // ---------------------------------------------------------
    const quizCount = lessonData.quizzes ? lessonData.quizzes.length : 0;
    
    // Eraタグ
    if (lessonData.era_tag) {
      const eraKey = `eras.${lessonData.era_tag}`;
      addCount(`${eraKey}.attempts`, quizCount);
      
      // 誤答数
      const wrongCount = gradingResult.quiz_results.filter(q => !q.is_correct).length;
      if (wrongCount > 0) {
        addCount(`${eraKey}.errors`, wrongCount);
      }
    }

    // Themeタグ
    if (lessonData.theme_tag) {
      const themeKey = `themes.${lessonData.theme_tag}`;
      addCount(`${themeKey}.attempts`, quizCount);

      const wrongCount = gradingResult.quiz_results.filter(q => !q.is_correct).length;
      if (wrongCount > 0) {
        addCount(`${themeKey}.errors`, wrongCount);
      }
    }

    // ---------------------------------------------------------
    // 2. ミス種類(Mistake)タグの集計
    // ---------------------------------------------------------
    
    // A. Attempts (出題されたタグの母数)
    if (lessonData.quizzes) {
      lessonData.quizzes.forEach(quiz => {
        const tagId = quiz.intention_tag;
        if (tagId) {
          addCount(`mistakes.${tagId}.attempts`, 1);
        }
      });
    }

    // B. Errors (間違えたタグ)
    if (gradingResult.quiz_results) {
      gradingResult.quiz_results.forEach((result, index) => {
        if (result.is_correct) return; // 正解ならスキップ

        // クイズ情報の取得（インデックス依存）
        const quizConfig = lessonData.quizzes ? lessonData.quizzes[index] : null;
        
        // AIが出力したタグ一覧 (バリデーション済みと仮定)
        const tags = result.tags || [];

        tags.forEach(tagId => {
          // もし出題意図(intention_tag)に含まれていないタグがエラーとして検出された場合、
          // 母数(attempts)も増やしておかないと "0回中1回ミス" という矛盾データになる
          const intendedTag = quizConfig ? quizConfig.intention_tag : null;
          if (tagId !== intendedTag) {
             addCount(`mistakes.${tagId}.attempts`, 1);
          }

          // エラー加算 (基本1pt)
          addCount(`mistakes.${tagId}.errors`, 1);
        });
      });
    }

    // C. 記述問題 (Essay)
    if (gradingResult.essay_grading) {
      const score = gradingResult.essay_grading.score || 0;
      
      // 8点未満なら「部分点ミス」
      if (score < 8) {
         const essayTags = gradingResult.essay_grading.tags || [];
         essayTags.forEach(tagId => {
           addCount(`mistakes.${tagId}.attempts`, 1);
           addCount(`mistakes.${tagId}.errors`, 1);
         });
      }
    }

    // ---------------------------------------------------------
    // 3. Firestore更新用オブジェクトへの変換
    // ---------------------------------------------------------
    const updates = {
      lastUpdated: serverTimestamp()
    };

    // 集計した数値を increment() に変換
    Object.entries(tempCounts).forEach(([key, value]) => {
      updates[key] = increment(value);
    });

    // 書き込み実行
    await setDoc(statsRef, updates, { merge: true });

    console.log('Stats saved successfully:', updates);

  } catch (error) {
    console.error('Failed to save lesson stats:', error);
    // ユーザーへの学習中断を防ぐためエラーは握りつぶす
  }
};