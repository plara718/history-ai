import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { APP_ID } from './constants';

/**
 * レッスン完了時に統計データを更新する関数
 * @param {string} userId
 * @param {object} lessonData - 授業データ
 * @param {array} quizResults - クイズ結果配列
 * @param {object} essayResult - 記述採点結果
 */
export const saveLessonStats = async (userId, lessonData, quizResults, essayResult) => {
  if (!userId) return;

  try {
    const statsRef = doc(db, 'artifacts', APP_ID, 'users', userId, 'stats', 'summary');
    const updates = { lastUpdated: serverTimestamp() };
    const tempCounts = {};

    const addCount = (key, value = 1) => {
      updates[key] = increment(value);
    };

    // 1. 基本集計
    addCount('totalSessions', 1);
    
    // クイズの正誤集計
    if (quizResults && quizResults.length > 0) {
      addCount('totalQuizzes', quizResults.length);
      const correctCount = quizResults.filter(q => q.is_correct).length;
      const errorCount = quizResults.length - correctCount;
      if (errorCount > 0) {
        addCount('totalErrors', errorCount);
      }
    }

    // 2. タグ別集計 (Era/Theme)
    // ※ 現在のAIプロンプトにはタグ出力が含まれていないため、
    //    lessonDataにタグが含まれている場合のみ集計する安全設計にします。
    const eraTag = lessonData?.content?.era_tag || lessonData?.era_tag;
    const themeTag = lessonData?.content?.theme_tag || lessonData?.theme_tag;

    if (eraTag) {
      addCount(`eras.${eraTag}.attempts`, 1);
      // そのセッションでのミス数を加算
      const errors = quizResults ? quizResults.filter(q => !q.is_correct).length : 0;
      if (errors > 0) addCount(`eras.${eraTag}.errors`, errors);
    }

    if (themeTag) {
      addCount(`themes.${themeTag}.attempts`, 1);
      const errors = quizResults ? quizResults.filter(q => !q.is_correct).length : 0;
      if (errors > 0) addCount(`themes.${themeTag}.errors`, errors);
    }

    // 3. ミス傾向 (Mistakes)
    // 記述の採点結果にタグが含まれていれば集計
    if (essayResult && essayResult.tags && Array.isArray(essayResult.tags)) {
      essayResult.tags.forEach(tagId => {
        addCount(`mistakes.${tagId}.attempts`, 1);
        addCount(`mistakes.${tagId}.errors`, 1);
      });
    }

    // クイズ個別のタグ集計 (将来的な拡張用)
    if (quizResults) {
      quizResults.forEach(res => {
        if (!res.is_correct && res.tags) {
           res.tags.forEach(tagId => {
             addCount(`mistakes.${tagId}.errors`, 1);
           });
        }
      });
    }

    // 書き込み実行
    await setDoc(statsRef, updates, { merge: true });
    console.log('Stats updated successfully');

  } catch (error) {
    console.error('Failed to save lesson stats:', error);
  }
};