import { useEffect, useRef } from 'react';

/**
 * 学習中の意図しない離脱を防ぐフック
 * ブラウザバックやリロードを検知して警告を出します
 * @param {boolean} isActive ガードを有効にするかどうか
 * @param {function} onAttemptBack 戻る操作が行われたときに実行する関数
 */
export const useLessonGuard = (isActive, onAttemptBack) => {
  // コールバック関数をRefに保持し、useEffectの依存配列から除外する
  // (これにより、親コンポーネントの再レンダリング時に履歴が無限に追加されるのを防ぐ)
  const backHandlerRef = useRef(onAttemptBack);
  
  useEffect(() => {
    backHandlerRef.current = onAttemptBack;
  }, [onAttemptBack]);
  
  // 1. ブラウザバック（Android戻る / iOSスワイプ）の検知
  useEffect(() => {
    if (!isActive) return;

    // 現在の履歴状態を「ガード用」として追加
    // これにより、ユーザーが「戻る」を押しても、この追加した履歴が消えるだけでページ遷移しない
    const pushGuard = () => {
      // 重複追加を防ぐため、stateを確認しても良いが、
      // 簡易的に常に新しい履歴を積んで「戻る」を相殺する
      window.history.pushState({ guard: true }, '', window.location.href);
    };

    pushGuard();

    const handlePopState = (e) => {
      // 戻る操作が行われたらここに来る
      
      // ガードを再設定（ダイアログを出している間にさらに戻られるのを防ぐため）
      // 再度pushすることで「今のページ」に留まらせる
      pushGuard();
      
      // 親コンポーネントに通知（「中断しますか？」ダイアログを開く）
      if (backHandlerRef.current) {
        backHandlerRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isActive]); // onAttemptBack を依存から外す

  // 2. リロード/タブ閉じの警告（PC/一部スマホブラウザ用）
  useEffect(() => {
    if (!isActive) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      // Chrome等の仕様によりカスタムメッセージは表示されませんが、警告ダイアログのトリガーになります
      e.returnValue = ''; 
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isActive]);
};