import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, // 環境変数を使用
  authDomain: "aijh-1bb04.firebaseapp.com",
  projectId: "aijh-1bb04",
  storageBucket: "aijh-1bb04.firebasestorage.app",
  messagingSenderId: "554834776442",
  appId: "1:554834776442:web:eb36144c5a0885145606c3"
};

// 安全策: APIキーが設定されていない場合に開発者へ通知する
if (!firebaseConfig.apiKey) {
  console.error("🚨 Firebase API Key is missing! Please check your .env file or environment variables.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);