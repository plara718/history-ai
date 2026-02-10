import React, { useState, useEffect } from 'react';
import { 
  Container, CssBaseline, ThemeProvider, Paper, Box
} from '@mui/material';
import { doc, onSnapshot } from 'firebase/firestore'; 
import { signOut } from 'firebase/auth'; 
import { db, auth } from './lib/firebase';
import { scrollToTop } from './lib/utils';
import { Brain, BookOpen, CheckCircle } from 'lucide-react';
import { APP_ID, MAX_DAILY_SESSIONS } from './lib/constants';

// Hooks
import useAuthUser from './hooks/useAuthUser';
import { useStudySession } from './hooks/useStudySession';

// Screens
import LoginScreen from './screens/LoginScreen'; 
import StartScreen from './screens/StartScreen'; 
import { LessonScreen } from './screens/LessonScreen'; 
import AdminDashboard from './screens/AdminDashboard';
import VocabularyLibrary from './screens/VocabularyLibrary';
import LogScreen from './screens/LogScreen';

// Components
import SmartLoader from './components/SmartLoader';
import { SettingsModal } from './components/SettingsModal'; 
import { NavButton } from './components/NavButton';       

// Theme
import theme from './theme'; 

const ADMIN_UID = "ksOXMeEuYCdslZeK5axNzn7UCU23"; 

const App = () => {
  const { user, loading: authLoading } = useAuthUser(); 
  
  // タブ管理
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
  const [reviewContext, setReviewContext] = useState(null);

  // UI状態
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [step, setStep] = useState('start'); 
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  // セッション管理
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

  // --- Handlers ---
  const handleLogout = async () => {
    try { await signOut(auth); window.location.reload(); } catch (error) { console.error(error); }
  };

  const startLesson = (mode, diff, unit, context = null) => {
    setLearningMode(mode);
    setDifficulty(diff);
    if (unit) setSelectedUnit(unit);
    setReviewContext(context);
    setStep('lesson');
    scrollToTop();
  };

  const handleStartGeneral = () => startLesson(learningMode, difficulty, selectedUnit, null);
  const handleStartReview = (strategy) => startLesson('review', 'standard', null, strategy);
  
  const handleResume = () => {
    setStep('lesson');
    scrollToTop();
  };

  const handleLessonExit = () => {
    setStep('start');
    setReviewContext(null); 
    session.refresh();
    scrollToTop();
  };

  const handleRegenerate = async () => {
      if (regenCount >= 1) {
          alert("作り直しは1日1回までです");
          return;
      }
      if (!window.confirm("現在の内容を破棄して再生成しますか？")) return;
      setRegenCount(prev => prev + 1);
      setStep('start');
      setTimeout(() => setStep('lesson'), 100);
  };

  // --- 画面描画の決定 ---
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      {/* 1. 認証ローディング中 */}
      {authLoading ? (
        <SmartLoader message="認証中..." />
      ) : !user ? (
        /* 2. 未ログイン */
        <LoginScreen />
      ) : currentHash === '#/admin' && user.uid === ADMIN_UID ? (
        /* 3. 管理者画面 */
        <AdminDashboard />
      ) : (
        /* 4. メインアプリ */
        <Container maxWidth="md" sx={{ minHeight: '100vh', py: 0, pb: 12 }}>
          <Box sx={{ minHeight: '80vh' }}>
            {activeTab === 'train' && (
              step === 'lesson' ? (
                <LessonScreen
                    apiKey={apiKey}
                    userId={user.uid}
                    learningMode={learningMode}
                    difficulty={difficulty}
                    selectedUnit={selectedUnit}
                    sessionNum={session.viewingSession}
                    currentProgress={session.activeSession}
                    reviewContext={reviewContext}
                    onExit={handleLessonExit}
                />
              ) : (
                <StartScreen 
                    activeSession={session.activeSession}
                    viewingSession={session.viewingSession}
                    isDailyLimitReached={session.activeSession > MAX_DAILY_SESSIONS}
                    learningMode={learningMode} setLearningMode={setLearningMode}
                    selectedUnit={selectedUnit} setSelectedUnit={setSelectedUnit}
                    difficulty={difficulty} setDifficulty={setDifficulty}
                    onStartLesson={handleStartGeneral}
                    onResumeLesson={handleResume}
                    onStartReview={handleStartReview}
                    isProcessing={false} 
                    historyMeta={session.historyMeta}
                    onSwitchSession={session.switchSession}
                    onRegenerate={handleRegenerate}
                    regenCount={regenCount}
                    onLogout={handleLogout}
                    userId={user.email || user.uid}
                    openSettings={() => setIsSettingsOpen(true)}
                />
              )
            )}

            {activeTab === 'library' && <VocabularyLibrary userId={user.uid} />}
            {activeTab === 'log' && <LogScreen userId={user.uid} />}
          </Box>

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
          
          {/* ボトムナビゲーション (スタート画面のみ表示) */}
          {(step === 'start') && (
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
      )}
    </ThemeProvider>
  );
};



export default App;