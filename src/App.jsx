import React, { useState, useEffect } from 'react';
import { 
  Container, CssBaseline, ThemeProvider, createTheme, 
  Paper, BottomNavigation, BottomNavigationAction, Box, Button
} from '@mui/material';
import { collection, query, getDocs, limit, orderBy, doc, getDoc, setDoc, runTransaction } from 'firebase/firestore'; 
import { signOut } from 'firebase/auth'; 
import { db, auth } from './lib/firebase';
import { callAI } from './lib/api';
import { getTodayString, scrollToTop, getFlattenedQuestions } from './lib/utils';
import { Brain, BookOpen, CheckCircle } from 'lucide-react';
import { APP_ID, MAX_DAILY_SESSIONS } from './lib/constants';

// Hooks
import useAuthUser from './hooks/useAuthUser';
import { useStudySession } from './hooks/useStudySession';
import { useLessonGenerator } from './hooks/useLessonGenerator';

// Screens
import LoginScreen from './screens/LoginScreen'; 
import StartScreen from './screens/StartScreen';
import LectureScreen from './screens/LectureScreen';
import QuestionsScreen from './screens/QuestionsScreen';
import TermsScreen from './screens/TermsScreen';
import SummaryScreen from './screens/SummaryScreen';
import ReviewScreen from './screens/ReviewScreen';
import AdminDashboard from './screens/AdminDashboard';
import VocabularyLibrary from './screens/VocabularyLibrary';
import LogScreen from './screens/LogScreen';

// Components
import SmartLoader from './components/SmartLoader';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast'; 

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
  
  // API・システム設定ステート
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || "");
  const [adminApiKey, setAdminApiKey] = useState(localStorage.getItem('gemini_api_key_admin') || "");
  const [appMode, setAppMode] = useState('production');

  const [learningMode, setLearningMode] = useState('general'); 
  const [difficulty, setDifficulty] = useState('standard');
  const [selectedUnit, setSelectedUnit] = useState('原始・古代の日本');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [step, setStep] = useState('start'); 
  const [showHint, setShowHint] = useState(false);
  const [reflection, setReflection] = useState("");
  const [lectureMode, setLectureMode] = useState('original');
  const [simplifiedLecture, setSimplifiedLecture] = useState(null);
  const [regenCount, setRegenCount] = useState(0);

  // 復習・履歴用
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [reviewQIndex, setReviewQIndex] = useState(0);
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewUserAnswer, setReviewUserAnswer] = useState(null);
  const [selectedHistoryLog, setSelectedHistoryLog] = useState(null);

  const session = useStudySession(user?.uid);
  const { generateDailyLesson, isProcessing: isGenerating } = useLessonGenerator(apiKey, user?.uid);
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  // グローバル設定（appMode）の取得
  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'settings', 'global'));
        if (snap.exists()) setAppMode(snap.data().appMode || 'production');
      } catch (e) { console.warn("設定取得失敗", e); }
    };
    fetchGlobalSettings();
  }, []);

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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (error) { console.error(error); }
  };

  const handleGenerate = async () => {
    try {
      await generateDailyLesson(learningMode, difficulty, selectedUnit, session.activeSession);
      await session.switchSession(session.activeSession);
      setToast({ message: "授業の準備ができました！", type: "success" });
      setStep('lecture');
      scrollToTop();
    } catch (error) {
      setToast({ message: "生成失敗。APIキー等を確認してください。", type: "error" });
    }
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
          await handleGenerate();
      } catch (e) {
          setToast({ message: "失敗しました", type: "error" });
      } finally { setIsLoading(false); }
  };

  const handleSimplify = async () => {
      if(!session.currentData) return;
      setIsLoading(true);
      try {
          const res = await callAI(`要約依頼:\n${session.currentData.content.lecture}`, "JSON:{text}", apiKey);
          setSimplifiedLecture(res.text);
          setLectureMode('simple');
      } catch(e) { console.error(e); } 
      finally { setIsLoading(false); }
  };

  const handleSaveReflection = async (e) => {
      const text = e.target ? e.target.value : e;
      setReflection(text);
      if (!user || session.viewingSession !== session.activeSession) return;
      try {
          const today = getTodayString();
          await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress', `${today}_${session.activeSession}`), { reflection: text }, { merge: true });
      } catch(e) { console.error(e); }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setToast({ message: "NotebookLM用のログをコピーしました！", type: "success" });
  };

  const renderTrainingTab = () => {
    if (isGenerating || isLoading) return <SmartLoader message="AI講師が準備しています..." />;

    if (step === 'review') {
        return <ReviewScreen 
            qIndex={reviewQIndex}
            reviewProblems={reviewQuestions}
            isAnswered={session.isAnswered}
            reviewResult={reviewResult}
            reviewUserAnswer={reviewUserAnswer}
            setReviewUserAnswer={setReviewUserAnswer}
            handleReviewAnswer={(ans) => {
                const q = reviewQuestions[reviewQIndex];
                const corr = q.type==='true_false' ? ans===q.correct : JSON.stringify(ans)===JSON.stringify(q.correct_order);
                setReviewResult(corr);
                setReviewUserAnswer(ans);
                session.setIsAnswered(true);
            }}
            nextReviewQuestion={() => {
                if (reviewQIndex < reviewQuestions.length - 1) {
                    setReviewQIndex(prev => prev + 1);
                    session.setIsAnswered(false);
                    setReviewResult(null);
                    setReviewUserAnswer(null);
                    scrollToTop();
                } else {
                    setStep('start');
                    setToast({ message: "復習完了！", type: "success" });
                }
            }}
        />;
    }

    const sessionData = session.currentData;

    if (!sessionData || step === 'start') {
        return <StartScreen 
            activeSession={session.activeSession}
            viewingSession={session.viewingSession}
            isDailyLimitReached={session.activeSession > MAX_DAILY_SESSIONS}
            learningMode={learningMode} setLearningMode={setLearningMode}
            selectedUnit={selectedUnit} setSelectedUnit={setSelectedUnit}
            difficulty={difficulty} setDifficulty={setDifficulty}
            generateDailyLesson={handleGenerate}
            startWeaknessReview={async () => {
                setIsLoading(true);
                // 復習ロジック（簡易化）
                setStep('review'); // 実際はデータ取得後に
                setIsLoading(false);
            }}
            isProcessing={isGenerating || isLoading}
            historyMeta={session.historyMeta}
            onSwitchSession={(n) => { session.switchSession(n); setStep('start'); scrollToTop(); }}
            onResume={() => { 
                if (sessionData) {
                    if (session.historyMeta[session.viewingSession]?.completed) setStep('summary');
                    else if (session.userAnswers && Object.keys(session.userAnswers).length > 0) setStep('questions');
                    else setStep('lecture');
                    scrollToTop(); 
                }
            }}
            onRegenerate={handleRegenerate}
            regenCount={regenCount}
            onLogout={handleLogout}
            userId={user.email || user.uid}
            openSettings={() => setIsSettingsOpen(true)}
        />;
    }

    if (step === 'lecture') {
        return <LectureScreen 
            dailyData={sessionData.content} 
            learningMode={learningMode}
            lectureMode={lectureMode} setLectureMode={setLectureMode}
            simplifiedLecture={simplifiedLecture}
            simplifyLectureText={handleSimplify}
            isProcessing={isLoading}
            onNext={() => { setStep('questions'); scrollToTop(); }}
        />;
    }

    if (step === 'questions') {
        return <QuestionsScreen 
            qIndex={session.qIndex}
            dailyData={sessionData.content}
            essayGrading={session.essayGrading}
            userAnswers={session.userAnswers}
            setUserAnswers={session.setUserAnswers}
            isAnswered={session.isAnswered}
            setIsAnswered={session.setIsAnswered}
            showHint={showHint} setShowHint={setShowHint}
            learningMode={learningMode}
            isReadOnly={session.viewingSession !== session.activeSession}
            isProcessing={session.isProcessing}
            gradeEssay={() => session.handleGrade(apiKey)}
            giveUpEssay={session.handleGiveUp}
            scoreRef={null}
            saveProgress={session.saveProgress}
            nextQuestion={() => {
                const totalQ = getFlattenedQuestions(sessionData.content).length;
                session.setIsAnswered(false);
                setShowHint(false);
                scrollToTop();
                if(session.qIndex < totalQ - 1) {
                    const n = session.qIndex + 1;
                    session.setQIndex(n);
                    session.saveProgress(session.userAnswers, n);
                } else {
                    session.saveProgress(session.userAnswers, session.qIndex);
                    setStep('terms');
                }
            }}
        />;
    }

    if (step === 'terms') {
        return <TermsScreen 
            dailyData={sessionData.content}
            learningMode={learningMode}
            onNext={() => { session.markAsCompleted(session.viewingSession); setStep('summary'); scrollToTop(); }}
        />;
  }

    if (step === 'summary') {
        return <SummaryScreen 
            dailyData={sessionData} // 構造化Markdown用にセッション全体を渡す
            userAnswers={session.userAnswers}
            essayGrading={session.essayGrading}
            activeSession={session.activeSession}
            isReadOnly={session.viewingSession !== session.activeSession}
            reflection={reflection}
            setReflection={setReflection}
            saveReflection={handleSaveReflection}
            copyToClipboard={handleCopyToClipboard}
            startNextSession={() => {
                if(session.activeSession < MAX_DAILY_SESSIONS) {
                    session.switchSession(session.activeSession + 1);
                    setStep('start');
                } else { setStep('start'); }
                scrollToTop();
            }}
        />;
    }
    return null;
  };

  if (authLoading) return <SmartLoader message="認証中..." />;
  
  if (currentHash === '#/admin') {
      if (!user || user.uid !== ADMIN_UID) return <Box p={4}>管理者権限がありません<Button onClick={()=>window.location.hash=''}>戻る</Button></Box>;
      return <AdminDashboard />;
  }
  
  if (!user) return <ThemeProvider theme={theme}><CssBaseline /><LoginScreen /></ThemeProvider>;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ minHeight: '100vh', py: 2, pb: 10 }}>
        
        {activeTab === 'train' && renderTrainingTab()}
        {activeTab === 'library' && <VocabularyLibrary userId={user.uid} />}
        {activeTab === 'log' && (
            selectedHistoryLog ? (
                <SummaryScreen
                    dailyData={selectedHistoryLog}
                    userAnswers={selectedHistoryLog.userAnswers || {}}
                    essayGrading={selectedHistoryLog.essayGrading}
                    activeSession={selectedHistoryLog.id}
                    isReadOnly={true}
                    reflection={selectedHistoryLog.reflection || ""}
                    setReflection={() => {}}
                    saveReflection={() => {}}
                    copyToClipboard={handleCopyToClipboard}
                    startNextSession={() => { setSelectedHistoryLog(null); scrollToTop(); }}
                />
            ) : (
                <LogScreen userId={user.uid} heatmapStats={session.heatmapStats} onSelectSession={(log) => { setSelectedHistoryLog(log); scrollToTop(); }} />
            )
        )}

        {isSettingsOpen && (
            <SettingsModal 
                apiKey={apiKey} setApiKey={setApiKey}
                onClose={() => setIsSettingsOpen(false)} 
                uid={user.uid}
                onAdmin={() => window.location.hash = '#/admin'}
                isAdminMode={user.uid === ADMIN_UID}
                adminApiKey={adminApiKey} setAdminApiKey={setAdminApiKey}
                appMode={appMode} setAppMode={setAppMode}
            />
        )}
        
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {(step === 'start' && !selectedHistoryLog) && (
          <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }} elevation={3}>
            <BottomNavigation showLabels value={activeTab} onChange={(e, n) => {setActiveTab(n); scrollToTop();}}>
              <BottomNavigationAction label="学習" value="train" icon={<Brain />} />
              <BottomNavigationAction label="用語帳" value="library" icon={<BookOpen />} />
              <BottomNavigationAction label="記録" value="log" icon={<CheckCircle />} />
            </BottomNavigation>
          </Paper>
        )}
      </Container>
    </ThemeProvider>
  );
};

export default App;