import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export const useAuthUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // メールアドレスログイン処理
  const handleLogin = async (email, password, setToast) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (setToast) setToast({ message: "ログインしました", type: "success" });
    } catch (error) {
      console.error("Login failed", error);
      let msg = "ログインに失敗しました";
      // エラーコードによるメッセージの出し分け
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = "メールアドレスまたはパスワードが間違っています";
      } else if (error.code === 'auth/invalid-email') {
        msg = "メールアドレスの形式が正しくありません";
      } else if (error.code === 'auth/too-many-requests') {
        msg = "ログイン試行回数が多すぎます。しばらく待ってから再度お試しください";
      }
      
      if (setToast) setToast({ message: msg, type: "error" });
      throw error;
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return { 
    user, 
    loading, 
    handleLogin, 
    handleLogout
  };
};