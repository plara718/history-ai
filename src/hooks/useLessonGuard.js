import { useEffect } from 'react';

/**
 * 学習中の意図しない離脱を防ぐフック
 * @param {boolean} isActive ガードを有効にするかどうか
 * @param {function} onAttemptBack 戻る操作が行われたときに実行する関数
 */
export const useLessonGuard = (isActive, onAttemptBack) => {
  
  // 1. ブラウザバック（Android戻る / iOSスワイプ）の検知
  useEffect(() => {
    if (!isActive) return;

    // 現在の履歴状態を「ガード用」として追加
    // これにより、ユーザーが「戻る」を押しても、この追加した履歴が消えるだけでページ遷移しない
    const pushGuard = () => {
      window.history.pushState(null, '', window.location.href);
    };

    pushGuard();

    const handlePopState = (e) => {
      // 戻る操作が行われたらここに来る
      // ガードを再設定（ダイアログを出している間にさらに戻られるのを防ぐため）
      pushGuard();
      
      // 親コンポーネントに通知（「中断しますか？」ダイアログを開く）
      if (onAttemptBack) {
        onAttemptBack();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isActive, onAttemptBack]);

  // 2. リロード/タブ閉じの警告（PC/一部スマホブラウザ用）
  useEffect(() => {
    if (!isActive) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome等の仕様によりメッセージは表示されませんが、警告ダイアログは出ます
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isActive]);
};