import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * Firebase Authentication State Hook
 * ユーザーのログイン状態を監視し、userオブジェクトとloading状態を提供する
 * @returns {{ user: object | null, loading: boolean }}
 */
const useAuthUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // authインスタンスが初期化されていない場合の安全策
    if (!auth) {
      console.warn("Firebase Auth not initialized");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // クリーンアップ関数
    return () => unsubscribe();
  }, []);

  return { user, loading };
};

export default useAuthUser;