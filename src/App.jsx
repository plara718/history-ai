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
import theme from './theme'; // ★ 修正: 外部ファイルからインポート

const ADMIN_UID = "ksOXMeEuYCdslZeK5axNzn7UCU23"; 

const App = () => {
  const { user, loading: authLoading } = useAuthUser(); 
  
  // タブ管理: 'train' | 'library' | 'log'
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

  // 復習コンテキスト (LessonScreenへ渡す戦略データ)
  const [reviewContext, setReviewContext] = useState(null);

  // UI状態
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [step, setStep] = useState('start'); // 'start' | 'lesson'
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  // 学習セッション管理フック
  const session = useStudySession(user?.uid);

  // --- Effects ---
  
  // 管理者設定(AIモード)の同期
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'ai_config'), (snap) => {
      if (snap.exists()) setAppMode(snap.data().appMode || 'production');
    }, (err) => console.warn("設定同期失敗", err));
    return () => unsub();
  }, [user]);

  // ハッシュ変更監視 (管理者画面遷移用)
  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // --- Handlers ---

  const handleLogout = async () => {
    try { await signOut(auth); window.location.reload(); } catch (error) { console.error(error); }
  };

  // 学習開始ハンドラ (通常・復習共通)
  const startLesson = (mode, diff, unit, context = null) => {
    setLearningMode(mode);
    setDifficulty(diff);
    if (unit) setSelectedUnit(unit);
    setReviewContext(context);
    
    setStep('lesson');
    scrollToTop();
  };

  // 通常学習開始
  const handleStartGeneral = () => {
    startLesson(learningMode, difficulty, selectedUnit, null);
  };

  // 復習開始 (戦略データを受け取る)
  const handleStartReview = (strategy) => {
    startLesson('review', 'standard', null, strategy);
  };

  // 再開
  const handleResume = () => {
    setStep('lesson');
    scrollToTop();
  };

  // 学習完了・終了時の処理 (LessonScreenから呼ばれる)
  const handleLessonExit = () => {
    setStep('start');
    setReviewContext(null); // コンテキストクリア
    
    // セッション情報の再取得 (完了マーク反映のため)
    session.refresh();
    
    scrollToTop();
  };

  const handleRegenerate = async () => {
      // 簡易実装
      if (regenCount >= 1) {
          alert("作り直しは1日1回までです");
          return;
      }
      if (!window.confirm("現在の内容を破棄して再生成しますか？")) return;
      
      setRegenCount(prev => prev + 1);
      setStep('start');
      setTimeout(() => setStep('lesson'), 100);
  };

  // --- Render Logic ---

  if (authLoading) return <SmartLoader message="認証中..." />;
  
  // 管理者画面
  if (currentHash === '#/admin') {
      if (!user || user.uid !== ADMIN_UID) {
        return (
          <Box p={4} textAlign="center">
            <p>管理者権限がありません</p>
            <button onClick={()=>window.location.hash=''}>戻る</button>
          </Box>
        );
      }
      return <AdminDashboard />;
  }
  
  // 未ログイン
  if (!user) return <ThemeProvider theme={theme}><CssBaseline /><LoginScreen /></ThemeProvider>;

  // メイン画面
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ minHeight: '100vh', py: 0, pb: 12 }}>
        
        {/* コンテンツエリア (タブ切り替え) */}
        <Box sx={{ minHeight: '80vh' }}>
          {activeTab === 'train' && (
            step === 'lesson' ? (
              <LessonScreen
                  apiKey={apiKey}
                  userId={user.uid}
                  learningMode={learningMode}
                  difficulty={difficulty}
                  selectedUnit={selectedUnit}
                  // 復習モード時は戦略データを渡す
                  reviewContext={reviewContext}
                  onExit={handleLessonExit}
              />
            ) : (
              <StartScreen 
                  // セッション状態
                  activeSession={session.activeSession}
                  viewingSession={session.viewingSession}
                  isDailyLimitReached={session.activeSession > MAX_DAILY_SESSIONS}
                  
                  // 設定状態
                  learningMode={learningMode} setLearningMode={setLearningMode}
                  selectedUnit={selectedUnit} setSelectedUnit={setSelectedUnit}
                  difficulty={difficulty} setDifficulty={setDifficulty}
                  
                  // アクションハンドラ
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
        
        {/* ボトムナビゲーション (学習中以外のみ表示) */}
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
    </ThemeProvider>
  );
};

export default App;