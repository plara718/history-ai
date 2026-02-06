import React, { useState, useEffect } from 'react';
import { 
  Container, CssBaseline, ThemeProvider, createTheme, 
  Paper, Box, Button
} from '@mui/material';
import { doc, getDoc, runTransaction, onSnapshot } from 'firebase/firestore'; 
import { signOut } from 'firebase/auth'; 
import { db, auth } from './lib/firebase';
import { getTodayString, scrollToTop } from './lib/utils';
import { Brain, BookOpen, CheckCircle } from 'lucide-react';
import { APP_ID, MAX_DAILY_SESSIONS } from './lib/constants';

// Hooks
import useAuthUser from './hooks/useAuthUser';
import { useStudySession } from './hooks/useStudySession';

// Screens
import LoginScreen from './screens/LoginScreen'; 
import StartScreen from './screens/StartScreen';
import { LessonScreen } from './screens/LessonScreen'; 
import { SummaryScreen } from './screens/SummaryScreen';
import AdminDashboard from './screens/AdminDashboard';
import VocabularyLibrary from './screens/VocabularyLibrary';
import LogScreen from './screens/LogScreen';
import ReviewScreen from './screens/ReviewScreen'; // 復習用に追加

// Components
import SmartLoader from './components/SmartLoader';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast'; 
import NavButton from './components/NavButton'; // カスタムナビゲーション

const ADMIN_UID = "ksOXMeEuYCdslZeK5axNzn7UCU23"; 

const theme = createTheme({
  typography: {
    fontFamily: '"Noto Sans JP", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
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
  const { user, loading: authLoading } = useAuthUser(); 
  const [activeTab, setActiveTab] = useState('train');
  
  // 設定ステート
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || "");
  const [adminApiKey, setAdminApiKey] = useState(localStorage.getItem('gemini_api_key_admin') || "");
  const [appMode, setAppMode] = useState('production');

  // 学習設定ステート
  const [learningMode, setLearningMode] = useState('general'); 
  const [difficulty, setDifficulty] = useState('standard');
  const [selectedUnit, setSelectedUnit] = useState('原始・古代の日本');
  const [regenCount, setRegenCount] = useState(0);

  // UI状態
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [step, setStep] = useState('start'); // start | lesson | review
  const [isLoading, setIsLoading] = useState(false);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  // 履歴閲覧用
  const [selectedHistoryLog, setSelectedHistoryLog] = useState(null);

  // 学習セッション管理フック
  const session = useStudySession(user?.uid);

  // --- Effects ---
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'ai_config'), (snap) => {
      if (snap.exists()) setAppMode(snap.data().appMode || 'production');
    }, (err) => console.warn("設定同期失敗", err));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (user) {
        const fetchRegenStats = async () => {
            try {
                const today = getTodayString();
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_stats', today));
                if (snap.exists()) setRegenCount(snap.data().regenCount || 0);
            } catch (e) { console.error(e); }
        };
        fetchRegenStats();
    }
  }, [user]);

  // --- Handlers ---
  const handleLogout = async () => {
    try { await signOut(auth); window.location.reload(); } catch (error) { console.error(error); }
  };

  const handleStartLesson = () => {
    setStep('lesson');
    scrollToTop();
  };

  const handleFinishLesson = () => {
    session.markAsCompleted(session.activeSession);
    setStep('start');
    if (session.activeSession < MAX_DAILY_SESSIONS) {
        session.switchSession(session.activeSession + 1);
    }
    setToast({ message: "学習お疲れ様でした！", type: "success" });
    scrollToTop();
  };

  const handleRegenerate = async () => {
      if (regenCount >= 1) {
          setToast({ message: "作り直しは1日1回までです", type: "error" });
          return;
      }
      if (!window.confirm("現在の内容を破棄して再生成しますか？")) return;

      setIsLoading(true);
      try {
          const today = getTodayString();
          const sessionDocRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress', `${today}_${session.activeSession}`);
          const statsRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_stats', today);

          await runTransaction(db, async (transaction) => {
              const statsDoc = await transaction.get(statsRef);
              const currentRegen = statsDoc.exists() ? (statsDoc.data().regenCount || 0) : 0;
              transaction.set(statsRef, { regenCount: currentRegen + 1 }, { merge: true });
              transaction.delete(sessionDocRef);
          });
          setRegenCount(prev => prev + 1);
          
          setStep('start');
          setTimeout(() => setStep('lesson'), 100);
          
      } catch (e) {
          setToast({ message: "失敗しました", type: "error" });
      } finally { setIsLoading(false); }
  };

  // --- Render Logic ---
  const renderTrainingTab = () => {
    if (isLoading) return <SmartLoader message="処理中..." />;

    // 復習モード
    if (step === 'review') {
        return (
          <Box p={4} textAlign="center">
            <Button onClick={()=>setStep('start')} variant="outlined">戻る</Button>
            {/* ReviewScreenの実装が完了していればここに配置 */}
            {/* <ReviewScreen ... /> */}
            <Box mt={2}>復習モード機能は現在調整中です</Box>
          </Box>
        );
    }

    // 学習モード (LessonScreen)
    if (step === 'lesson') {
        return (
            <LessonScreen
                apiKey={apiKey}
                userId={user.uid}
                learningMode={learningMode}
                difficulty={difficulty}
                selectedUnit={selectedUnit}
                sessionNum={session.activeSession}
                onFinish={handleFinishLesson}
            />
        );
    }

    // ホーム画面 (StartScreen)
    return (
        <StartScreen 
            activeSession={session.activeSession}
            viewingSession={session.viewingSession}
            isDailyLimitReached={session.activeSession > MAX_DAILY_SESSIONS}
            learningMode={learningMode} setLearningMode={setLearningMode}
            selectedUnit={selectedUnit} setSelectedUnit={setSelectedUnit}
            difficulty={difficulty} setDifficulty={setDifficulty}
            
            generateDailyLesson={handleStartLesson}
            onResume={() => { setStep('lesson'); scrollToTop(); }}
            
            startWeaknessReview={() => setStep('review')}
            isProcessing={isLoading}
            historyMeta={session.historyMeta}
            
            onSwitchSession={(n) => { session.switchSession(n); }}
            
            onRegenerate={handleRegenerate}
            regenCount={regenCount}
            onLogout={handleLogout}
            userId={user.email || user.uid}
            openSettings={() => setIsSettingsOpen(true)}
        />
    );
  };

  if (authLoading) return <SmartLoader message="認証中..." />;
  
  // 管理者画面
  if (currentHash === '#/admin') {
      if (!user || user.uid !== ADMIN_UID) return <Box p={4}>管理者権限がありません<Button onClick={()=>window.location.hash=''}>戻る</Button></Box>;
      return <AdminDashboard />;
  }
  
  if (!user) return <ThemeProvider theme={theme}><CssBaseline /><LoginScreen /></ThemeProvider>;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ minHeight: '100vh', py: 2, pb: 12 }}>
        
        {/* メインタブ切り替え */}
        {activeTab === 'train' && renderTrainingTab()}
        {activeTab === 'library' && <VocabularyLibrary userId={user.uid} />}
        
        {/* ログ・履歴閲覧 */}
        {activeTab === 'log' && (
            selectedHistoryLog ? (
                <SummaryScreen
                    lessonData={selectedHistoryLog}
                    gradingResult={selectedHistoryLog.gradingResult || {score: 0}}
                    quizLog={selectedHistoryLog.quizLog || []}
                    onFinish={() => { setSelectedHistoryLog(null); scrollToTop(); }}
                />
            ) : (
                <LogScreen 
                    userId={user.uid} 
                    heatmapStats={session.heatmapStats} 
                    onSelectSession={(log) => { 
                        setSelectedHistoryLog(log.content ? log : { content: log, ...log }); 
                        scrollToTop(); 
                    }} 
                />
            )
        )}

        {/* 設定モーダル */}
        {isSettingsOpen && (
            <SettingsModal 
                apiKey={apiKey} setApiKey={setApiKey}
                onClose={() => setIsSettingsOpen(false)} 
                uid={user.uid}
                onAdmin={() => { setIsSettingsOpen(false); window.location.hash = '#/admin'; }}
                isAdminMode={user.uid === ADMIN_UID}
                adminApiKey={adminApiKey} setAdminApiKey={setAdminApiKey}
                appMode={appMode} setAppMode={setAppMode}
            />
        )}
        
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* カスタムナビゲーションバー（学習中以外に表示） */}
        {(step === 'start' && !selectedHistoryLog) && (
          <Paper 
            sx={{ 
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
              borderRadius: '24px 24px 0 0',
              pb: 3, pt: 1.5, 
              bgcolor: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
              borderTop: '1px solid rgba(255,255,255,0.5)'
            }} 
            elevation={0}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', maxWidth: 'md', mx: 'auto' }}>
              <NavButton 
                active={activeTab === 'train'} 
                onClick={() => {setActiveTab('train'); scrollToTop();}} 
                icon={Brain} 
                label="学習" 
              />
              <NavButton 
                active={activeTab === 'library'} 
                onClick={() => {setActiveTab('library'); scrollToTop();}} 
                icon={BookOpen} 
                label="用語帳" 
              />
              <NavButton 
                active={activeTab === 'log'} 
                onClick={() => {setActiveTab('log'); scrollToTop();}} 
                icon={CheckCircle} 
                label="記録" 
              />
            </Box>
          </Paper>
        )}
      </Container>
    </ThemeProvider>
  );
};

export default App;