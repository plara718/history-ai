import React, { useState, useEffect } from 'react';
import { Container, Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';

// フックのインポート
import { useAuthUser } from './hooks/useAuthUser';
import { useStudySession } from './hooks/useStudySession';
import { useLessonGenerator } from './hooks/useLessonGenerator';

// 画面コンポーネントのインポート
import AuthScreen from './screens/AuthScreen';
import LoginScreen from './screens/LoginScreen';
import StartScreen from './screens/StartScreen';
import LectureScreen from './screens/LectureScreen';
import QuestionsScreen from './screens/QuestionsScreen';
import SummaryScreen from './screens/SummaryScreen';
import ReviewScreen from './screens/ReviewScreen';
import AdminDashboard from './screens/AdminDashboard';

// 共通コンポーネント
import SmartLoader from './components/SmartLoader';
import NavButton from './components/NavButton';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast'; // 内部のToastコンポーネントを使用

// 管理者UID (Firebaseルールと一致させる)
const ADMIN_UID = "ksOXMeEuYCdslZeK5axNzn7UCU23"; 

const theme = createTheme({
  typography: {
    fontFamily: '"Noto Sans JP", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  palette: {
    primary: { main: '#4f46e5' },
    secondary: { main: '#ec4899' },
    background: { default: '#f8fafc' },
  },
  shape: { borderRadius: 12 },
});

const App = () => {
  // --- 1. 認証管理 ---
  const { user, loading: authLoading, handleLogin, handleLogout, handleGuestLogin } = useAuthUser();
  
  // --- 2. 状態管理 ---
  const [learningMode, setLearningMode] = useState('general'); // 'general' or 'school'
  const [difficulty, setDifficulty] = useState('standard');    // 'easy', 'standard', 'hard'
  const [selectedUnit, setSelectedUnit] = useState('原始・古代の日本');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }

  // --- 3. 学習セッション管理 ---
  const { 
    activeSession, viewingSession, historyMeta, currentData, 
    switchSession, saveProgress, markAsCompleted 
  } = useStudySession(user?.uid);

  // --- 4. 授業生成フック (APIキーは環境変数から) ---
  const { generateDailyLesson, isProcessing } = useLessonGenerator(
    import.meta.env.VITE_GEMINI_API_KEY, 
    user?.uid
  );

  // ルーティング（簡易）
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- 5. アクションハンドラー ---

  // 授業生成ボタンを押した時の処理
  const handleGenerate = async () => {
    try {
      // 最新の関数名 generateDailyLesson を使用
      await generateDailyLesson(learningMode, difficulty, selectedUnit, activeSession);
      
      setToast({ message: "授業の準備ができました！", type: "success" });
    } catch (error) {
      console.error(error);
      setToast({ message: "生成に失敗しました。時間をおいて再試行してください。", type: "error" });
    }
  };

  // 弱点復習モード開始
  const handleWeaknessReview = () => {
    setToast({ message: "弱点復習モードは現在開発中です", type: "info" });
  };

  // --- 6. レンダリング分岐 ---

  if (authLoading) {
    return <SmartLoader message="認証情報を確認中..." />;
  }

  // 管理者画面へのアクセス
  if (currentPath === '/admin') {
    if (!user || user.uid !== ADMIN_UID) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          管理者権限がありません
          <NavButton onClick={() => window.location.href = '/'} label="ホームに戻る" />
        </Box>
      );
    }
    return <AdminDashboard />;
  }

  // 未ログイン時
  if (!user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthScreen onAuthenticate={() => handleLogin(setToast)} />
      </ThemeProvider>
    );
  }

  // メイン画面構成
  const renderContent = () => {
    // データ読み込み中
    if (isProcessing) {
      return <SmartLoader message="AI講師が授業を準備しています..." />;
    }
    
    // 現在のセッションのデータ取得
    const sessionData = currentData;
    const isCompleted = historyMeta[viewingSession]?.completed;

    // まだデータがない場合（スタート画面）
    if (!sessionData) {
      return (
        <StartScreen 
          activeSession={activeSession}
          viewingSession={viewingSession}
          isDailyLimitReached={false} // 簡易実装
          learningMode={learningMode}
          setLearningMode={setLearningMode}
          selectedUnit={selectedUnit}
          setSelectedUnit={setSelectedUnit}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          generateDailyLesson={handleGenerate} // 関数名を統一して渡す
          startWeaknessReview={handleWeaknessReview}
          isProcessing={isProcessing}
          historyMeta={historyMeta}
          onSwitchSession={switchSession}
          onResume={() => {}} 
          onRegenerate={() => {}} // 再生成ロジックは必要に応じて実装
          regenCount={0}
          onLogout={handleLogout}
          userId={user.email || user.uid}
          openSettings={() => setIsSettingsOpen(true)}
        />
      );
    }

    // 学習完了後（まとめ画面）
    if (isCompleted) {
      return (
        <SummaryScreen 
          data={sessionData.content} 
          onHome={() => switchSession(Math.min(activeSession + 1, 3))} // 次のセッションへ
        />
      );
    }

    // 学習中（講義 -> 問題 -> 復習）
    return (
      <SessionManager 
        data={sessionData} 
        onComplete={() => markAsCompleted(viewingSession)}
        onBack={() => {}} // 戻る処理
      />
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ minHeight: '100vh', py: 2 }}>
        {renderContent()}
        
        {/* 設定モーダル */}
        <SettingsModal 
          open={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          user={user}
        />
        
        {/* トースト通知 (自作コンポーネント) */}
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </Container>
    </ThemeProvider>
  );
};

// セッション進行管理用サブコンポーネント
const SessionManager = ({ data, onComplete }) => {
  const [step, setStep] = useState('lecture'); // 'lecture', 'questions', 'review'

  if (step === 'lecture') {
    return (
      <LectureScreen 
        data={data.content} 
        onNext={() => setStep('questions')} 
      />
    );
  }

  if (step === 'questions') {
    return (
      <QuestionsScreen 
        questions={data.content.questions} 
        onFinish={(results) => {
            // 結果を保存したりする処理をここに挟める
            setStep('review');
        }} 
      />
    );
  }

  if (step === 'review') {
    return (
      <ReviewScreen 
        data={data.content} 
        onComplete={onComplete} 
      />
    );
  }

  return null;
};

export default App;