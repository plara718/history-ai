import React, { useState, useEffect } from 'react';
import { Container, Box, CssBaseline, ThemeProvider, createTheme, Button } from '@mui/material';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore'; 
import { db } from './lib/firebase';

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

// 定数定義
const ADMIN_UID = "ksOXMeEuYCdslZeK5axNzn7UCU23"; 
const APP_ID = 'history_app_v1';

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
  
  // 画面遷移管理フラグ
  const [isStudyStarted, setIsStudyStarted] = useState(false);
  
  // 復習モード管理用
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState([]);

  // --- 3. 学習セッション管理 ---
  const { 
    activeSession, viewingSession, historyMeta, currentData, 
    switchSession, markAsCompleted 
  } = useStudySession(user?.uid);

  // --- 4. 授業生成フック ---
  const { generateDailyLesson, isProcessing: isGenerating } = useLessonGenerator(
    import.meta.env.VITE_GEMINI_API_KEY, 
    user?.uid
  );
  
  const [isLoading, setIsLoading] = useState(false);

  // ハッシュルーター（#/admin）管理
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // --- 5. アクションハンドラー ---

  // ★修正: 生成ロジックを堅牢にする
  const handleGenerate = async () => {
    try {
      // 1. 生成を実行 (完了を待つ)
      await generateDailyLesson(learningMode, difficulty, selectedUnit, activeSession);
      
      // 2. ★重要: 古いコードのように、明示的にデータを再読み込みする
      // これをしないと、Firebaseの自動更新が間に合わず画面が変わらないことがある
      await switchSession(activeSession);

      // 3. 画面遷移
      setToast({ message: "授業の準備ができました！", type: "success" });
      setIsReviewMode(false); // 通常モード
      setIsStudyStarted(true); // 画面を切り替える

    } catch (error) {
      console.error(error);
      setToast({ message: "生成に失敗しました。もう一度お試しください。", type: "error" });
    }
  };

  // 苦手を復習モード（AI生成なし・DBから取得）
  const handleWeaknessReview = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      // 過去の学習データを取得
      const q = query(
        collection(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress'),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      let mistakes = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.content && data.userAnswers) {
          if (data.content.true_false) {
            data.content.true_false.forEach((question, index) => {
              if (data.userAnswers[index] !== question.correct) {
                mistakes.push({
                  type: 'true_false',
                  ...question,
                  theme: data.content.theme
                });
              }
            });
          }
          if (data.content.sort) {
             const offset = data.content.true_false ? data.content.true_false.length : 0;
             data.content.sort.forEach((question, index) => {
               if (JSON.stringify(data.userAnswers[index + offset]) !== JSON.stringify(question.correct_order)) {
                 mistakes.push({
                   type: 'sort',
                   ...question,
                   theme: data.content.theme
                 });
               }
             });
          }
        }
      });

      if (mistakes.length === 0) {
        setToast({ message: "復習すべき間違いは見つかりませんでした。素晴らしい！", type: "success" });
        setIsLoading(false);
        return;
      }

      const selectedProblems = mistakes.sort(() => 0.5 - Math.random()).slice(0, 10);
      
      setReviewQuestions(selectedProblems);
      setIsReviewMode(true);   
      setIsStudyStarted(true); 
      setToast({ message: `${selectedProblems.length}問の復習問題を作成しました`, type: "success" });

    } catch (e) {
      console.error(e);
      setToast({ message: "復習データの取得に失敗しました", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- 6. レンダリング分岐 ---

  if (authLoading) return <SmartLoader message="認証情報を確認中..." />;

  // 管理画面
  if (currentHash === '#/admin') {
    if (!user || user.uid !== ADMIN_UID) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" flexDirection="column" gap={2}>
          管理者権限がありません
          <Button variant="outlined" onClick={() => window.location.hash = ''}>
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
    // ローディング中
    if (isGenerating || isLoading) {
      return <SmartLoader message={isReviewMode ? "過去のミスを分析中..." : "AI講師が授業を準備しています..."} />;
    }
    
    // 復習モードの表示
    if (isStudyStarted && isReviewMode) {
      return (
        <QuestionsScreen 
          questions={reviewQuestions} 
          onFinish={(results) => {
             setToast({ message: "復習お疲れ様でした！", type: "success" });
             setIsReviewMode(false);
             setIsStudyStarted(false); 
          }} 
        />
      );
    }

    // 通常モードのデータ
    const sessionData = currentData;
    const isCompleted = historyMeta[viewingSession]?.completed;

    // スタート画面
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
          generateDailyLesson={handleGenerate} // 修正版の関数を渡す
          startWeaknessReview={handleWeaknessReview}
          isProcessing={isGenerating || isLoading}
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

    // 学習完了後
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

    // 通常学習中
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

// 通常セッション進行管理
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