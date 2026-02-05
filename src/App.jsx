import React, { useState, useEffect } from 'react';
import { Container, Box, CssBaseline, ThemeProvider, createTheme, Button } from '@mui/material';
import { auth } from './lib/firebase';

// フックのインポート
import { useAuthUser } from './hooks/useAuthUser';
import { useStudySession } from './hooks/useStudySession';
import { useLessonGenerator } from './hooks/useLessonGenerator';

// 画面コンポーネントのインポート
import AuthScreen from './screens/AuthScreen';
import StartScreen from './screens/StartScreen';
import LectureScreen from './screens/LectureScreen';
import QuestionsScreen from './screens/QuestionsScreen';
import SummaryScreen from './screens/SummaryScreen';
import ReviewScreen from './screens/ReviewScreen';
import AdminDashboard from './screens/AdminDashboard';

// 共通コンポーネント
import SmartLoader from './components/SmartLoader';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast'; 

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
  const { user, loading: authLoading, handleLogin, handleLogout } = useAuthUser();
  
  // --- 2. 状態管理 ---
  const [learningMode, setLearningMode] = useState('general'); 
  const [difficulty, setDifficulty] = useState('standard');
  const [selectedUnit, setSelectedUnit] = useState('原始・古代の日本');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isStudyStarted, setIsStudyStarted] = useState(false);

  // --- 3. 学習セッション管理 ---
  const { 
    activeSession, viewingSession, historyMeta, currentData, 
    switchSession, markAsCompleted 
  } = useStudySession(user?.uid);

  // --- 4. 授業生成フック ---
  const { generateDailyLesson, isProcessing } = useLessonGenerator(
    import.meta.env.VITE_GEMINI_API_KEY, 
    user?.uid
  );

  // ハッシュルーター（#/admin）管理
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    // ハッシュ（#以降）の変化を監視する
    const handleHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // --- 5. アクションハンドラー ---
  const handleGenerate = async () => {
    try {
      await generateDailyLesson(learningMode, difficulty, selectedUnit, activeSession);
      setToast({ message: "授業の準備ができました！", type: "success" });
      setIsStudyStarted(true);
    } catch (error) {
      console.error(error);
      setToast({ message: "生成に失敗しました。時間をおいて再試行してください。", type: "error" });
    }
  };

  const handleWeaknessReview = () => {
    setToast({ message: "弱点復習モードは現在開発中です", type: "info" });
  };

  // --- 6. レンダリング分岐 ---

  if (authLoading) return <SmartLoader message="認証情報を確認中..." />;

  // 管理画面への判定（ハッシュ）
  if (currentHash === '#/admin') {
    if (!user || user.uid !== ADMIN_UID) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" flexDirection="column" gap={2}>
          管理者権限がありません
          {/* NavButtonを使わず、標準Buttonで実装 */}
          <Button 
            variant="outlined" 
            onClick={() => window.location.hash = ''}
          >
            ホームに戻る
          </Button>
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
        <AuthScreen 
          onLogin={(email, pass) => handleLogin(email, pass, setToast)} 
        />
      </ThemeProvider>
    );
  }

  // メイン画面構成
  const renderContent = () => {
    if (isProcessing) return <SmartLoader message="AI講師が授業を準備しています..." />;
    
    const sessionData = currentData;
    const isCompleted = historyMeta[viewingSession]?.completed;

    if (!sessionData || !isStudyStarted) {
      return (
        <StartScreen 
          activeSession={activeSession}
          viewingSession={viewingSession}
          isDailyLimitReached={false}
          learningMode={learningMode}
          setLearningMode={setLearningMode}
          selectedUnit={selectedUnit}
          setSelectedUnit={setSelectedUnit}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          generateDailyLesson={handleGenerate}
          startWeaknessReview={handleWeaknessReview}
          isProcessing={isProcessing}
          historyMeta={historyMeta}
          onSwitchSession={switchSession}
          onResume={() => setIsStudyStarted(true)} 
          onRegenerate={() => {}} 
          regenCount={0}
          onLogout={handleLogout}
          userId={user.email || user.uid}
          openSettings={() => setIsSettingsOpen(true)}
        />
      );
    }

    if (isCompleted) {
      return (
        <SummaryScreen 
          data={sessionData.content} 
          onHome={() => {
            setIsStudyStarted(false); 
            switchSession(Math.min(activeSession + 1, 3));
          }} 
        />
      );
    }

    return (
      <SessionManager 
        data={sessionData} 
        onComplete={() => markAsCompleted(viewingSession)}
      />
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ minHeight: '100vh', py: 2 }}>
        {renderContent()}
        <SettingsModal 
          open={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          user={user}
        />
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

const SessionManager = ({ data, onComplete }) => {
  const [step, setStep] = useState('lecture');

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