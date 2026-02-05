import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

/**
 * ユーザー認証状態を監視・操作するフック
 * 名前付きエクスポート (export const) に統一
 */
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

  // ログイン処理
  const handleLogin = async (setToast) => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      if (setToast) setToast({ message: "ログインしました", type: "success" });
    } catch (error) {
      console.error("Login failed", error);
      if (setToast) setToast({ message: "ログインに失敗しました", type: "error" });
    }
  };

  // ゲストログイン（匿名認証などが必要な場合用、現在はプレースホルダー）
  const handleGuestLogin = async () => {
    // 必要に応じて実装
    console.log("Guest login not implemented yet");
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
    handleLogout,
    handleGuestLogin 
  };
};