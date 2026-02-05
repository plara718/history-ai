import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth'; // ★変更: Auth関連
import { doc, getDoc, setDoc, query, collection, getDocs, limit, runTransaction } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { callAI } from './lib/api';
import { APP_ID, MAX_DAILY_SESSIONS, TEXTBOOK_UNITS } from './lib/constants';
import { getTodayString, scrollToTop, dismissKeyboard, getFlattenedQuestions } from './lib/utils';
import { Brain, BookOpen, CheckCircle, AlertCircle, Loader2, Settings, GraduationCap, LogOut } from 'lucide-react'; // LogOut追加

// Hooks
import { useLessonGenerator } from './hooks/useLessonGenerator';
import { useStudySession } from './hooks/useStudySession';

// Screens & Components
import LoginScreen from './screens/LoginScreen'; // ★変更: 新しいログイン画面
import StartScreen from './screens/StartScreen';
import LectureScreen from './screens/LectureScreen';
import QuestionsScreen from './screens/QuestionsScreen';
import TermsScreen from './screens/TermsScreen';
import SummaryScreen from './screens/SummaryScreen';
import ReviewScreen from './screens/ReviewScreen';
import VocabularyLibrary from './screens/VocabularyLibrary';
import AdminDashboard from './screens/AdminDashboard';
import LogScreen from './screens/LogScreen';
import SmartLoader from './components/SmartLoader';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import NavButton from './components/NavButton';

// ★重要: ここにあなたの「管理者用アカウントのUID」を貼り付けてください
const ADMIN_UID = "ksOXMeEuYCdslZeK5axNzn7UCU23"; 

export default function App() {
  // ★認証ステート (New)
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 既存のステート
  const [userApiKey, setUserApiKey] = useState(localStorage.getItem('gemini_api_key') || "");
  const [showSettings, setShowSettings] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminApiKey, setAdminApiKey] = useState(localStorage.getItem('gemini_api_key_admin') || "");
  const [toastMessage, setToastMessage] = useState(null);
  
  const generator = useLessonGenerator();
  // userが確定してからsessionフックに渡す
  const session = useStudySession(user);

  const [errorMessage, setErrorMessage] = useState(null);

  const [currentStep, setCurrentStep] = useState('start');
  const [activeTab, setActiveTab] = useState('train');
  const [learningMode, setLearningMode] = useState('general'); 
  const [selectedUnit, setSelectedUnit] = useState(TEXTBOOK_UNITS[0]);
  const [difficulty, setDifficulty] = useState('standard');
  const [showHint, setShowHint] = useState(false);
  const [reflection, setReflection] = useState("");
  
  const [lectureMode, setLectureMode] = useState('original');
  const [simplifiedLecture, setSimplifiedLecture] = useState(null);
  const [reviewProblems, setReviewProblems] = useState([]);
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewUserAnswer, setReviewUserAnswer] = useState(null);
  const [reviewQIndex, setReviewQIndex] = useState(0); 
  
  const [regenCount, setRegenCount] = useState(0);

  const isSchool = learningMode === 'school';
  const themeColorClass = isSchool ? 'text-emerald-700' : 'text-indigo-700';
  const iconColorClass = isSchool ? 'text-emerald-600' : 'text-indigo-600';
  const HeaderIcon = isSchool ? BookOpen : GraduationCap;

  // ★1. 認証監視 (セキュリティ強化)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 日付変更チェック
  useEffect(() => {
     const i = setInterval(() => {
         const today = getTodayString();
         if (today !== getTodayString()) { 
             setToastMessage({message:"日付が変わりました", type:'info'}); 
             window.location.reload();
         }
     }, 60000); 
     return () => clearInterval(i); 
  }, []);

  // ユーザーデータ読み込み
  useEffect(() => {
    if (user) {
        session.loadHistoryMeta().then((res) => {
            if (res) session.loadSession(res.limitReached ? MAX_DAILY_SESSIONS : res.next);
        });
        const fetchRegenStats = async () => {
            const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_stats', getTodayString()));
            if (snap.exists()) setRegenCount(snap.data().regenCount || 0);
        };
        fetchRegenStats();
    }
  }, [user]);

  // 管理者判定
  const isRealAdmin = user && user.uid === ADMIN_UID;

  // ログアウト処理
  const handleLogout = async () => {
    await signOut(auth);
    // 状態リセットなどはリロードで代用するのが確実
    window.location.reload();
  };

  const handleGenerate = async () => {
      setErrorMessage(null);
      const data = await generator.generateLesson({
          user, 
          activeSession: session.activeSession,
          learningMode,
          difficulty,
          selectedUnit,
          userApiKey
      });

      if (data) {
          session.setDailyData(data);
          session.setHistoryMeta(p => ({...p, [session.activeSession]:{exists:true, completed:false, theme:data.theme}}));
          setCurrentStep('lecture');
          scrollToTop();
      }
  };

  const handleRegenerate = async () => {
      if (!user) return;
      if (session.isProcessing) return;

      if (regenCount >= 1) {
          setToastMessage({message: "作り直しは1日1回までです", type: "error"});
          return;
      }
      
      if (!window.confirm("現在の学習内容を破棄して、問題を作り直しますか？\n（作り直しは1日1回のみ可能です）")) return;

      session.setIsProcessing(true);
      const today = getTodayString();
      const sessionDocRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress', `${today}_${session.activeSession}`);
      const statsRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_stats', today);

      try {
          await runTransaction(db, async (transaction) => {
              const statsDoc = await transaction.get(statsRef);
              const currentRegen = statsDoc.exists() ? (statsDoc.data().regenCount || 0) : 0;

              if (currentRegen >= 1) {
                  throw new Error("REGEN_LIMIT_EXCEEDED");
              }

              transaction.set(statsRef, { regenCount: currentRegen + 1 }, { merge: true });
              transaction.delete(sessionDocRef);
          });

          setRegenCount(prev => prev + 1);
          session.setDailyData(null); 
          session.setHistoryMeta(p => ({
              ...p, 
              [session.activeSession]: { exists: false, completed: false }
          }));

          setToastMessage({message: "データをリセットしました。新しい問題を生成しています...", type: "info"});
          await handleGenerate();

      } catch (e) {
          console.error(e);
          if (e.message === "REGEN_LIMIT_EXCEEDED") {
             setToastMessage({message: "本日の作り直し回数上限に達しています。", type: "error"});
             setRegenCount(1);
          } else {
             setErrorMessage("リセット処理に失敗しました。通信環境を確認してください。");
          }
      } finally {
          session.setIsProcessing(false);
      }
  };

  const handleGradeWrapper = async () => {
      const success = await session.handleGrade(userApiKey);
      if (success) {
          setToastMessage({message:"採点完了！", type:'success'});
      }
  };

  const handleStartWeakness = async () => {
      if(!user) return;
      session.setIsProcessing(true);
      setErrorMessage(null);
      try {
          const q = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress'), limit(20));
          const s = await getDocs(q);
          let m = [];
          s.forEach(d => {
              const dt = d.data();
              if(dt.content && dt.userAnswers) {
                  dt.content.true_false.forEach((q,i) => { if(dt.userAnswers[i]!==q.correct) m.push({type:'true_false', ...q, theme:dt.content.theme}); });
                  dt.content.sort.forEach((q,i) => { if(JSON.stringify(dt.userAnswers[i+5])!==JSON.stringify(q.correct_order)) m.push({type:'sort', ...q, theme:dt.content.theme}); });
              }
          });
          if(m.length === 0){
              setToastMessage({message:"復習すべき間違いは見つかりませんでした。", type:'success'});
              return;
          }
          setReviewProblems(m.sort(()=>0.5-Math.random()).slice(0,10));
          setReviewQIndex(0);
          session.setIsAnswered(false);
          setReviewResult(null);
          setReviewUserAnswer(null);
          setCurrentStep('review');
          scrollToTop();
      } catch(e) { 
          console.error(e);
          setErrorMessage("復習データの取得に失敗しました");
      }
      finally { session.setIsProcessing(false); }
  };

  const handleSimplify = async () => {
      if(!session.dailyData) return;
      session.setIsProcessing(true);
      setErrorMessage(null);
      try {
          const res = await callAI(`以下を要約:\n${session.dailyData.lecture}`, "中学生向け要約。JSON:{text}", userApiKey);
          setSimplifiedLecture(res.text);
          setLectureMode('simple');
      } catch(e) { 
          console.error(e);
          setErrorMessage("要約の生成に失敗しました: " + e.message);
      }
      finally { session.setIsProcessing(false); }
  };

  const handleSwitchSession = async (n) => {
      if (n > session.activeSession && !session.historyMeta[n]?.exists) return;
      session.setViewingSession(n);
      const data = await session.loadSession(n);
      if (data && data.completed) setCurrentStep('summary');
      else setCurrentStep('start');
      scrollToTop();
      dismissKeyboard();
  };

  const handleResume = () => {
      if (!session.dailyData) return;
      if (session.qIndex > 0) setCurrentStep('questions');
      else setCurrentStep('lecture');
      scrollToTop();
  };

  const handleSaveReflection = async (e) => {
      if (!user || session.viewingSession !== session.activeSession) return;
      const val = e.target.value;
      setReflection(val);
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'daily_progress', `${getTodayString()}_${session.activeSession}`), { reflection: val }, { merge: true });
  };

  // ★ガード処理: ロード中または未ログイン
  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600"/></div>;
  if (!user) return <LoginScreen />;

  const renderContent = () => {
      if (isAdminMode) return <AdminDashboard onExit={() => setIsAdminMode(false)} apiKey={adminApiKey || userApiKey} />;
      if (activeTab === 'library') return <VocabularyLibrary userId={user?.uid} />;
      if (activeTab === 'log') return <LogScreen heatmapStats={session.heatmapStats} userId={user?.uid} />;
      if (generator.isGenerating) return <SmartLoader message={learningMode==='general' ? "2段階で生成中..." : "AIが講義を生成中..."} />;

      // Start Screen
      if (currentStep === 'start') {
          const hasUnfinished = session.dailyData && !session.historyMeta[session.viewingSession]?.completed;
          return <StartScreen
              activeSession={session.activeSession}
              viewingSession={session.viewingSession}
              isDailyLimitReached={session.activeSession > MAX_DAILY_SESSIONS}
              learningMode={learningMode} setLearningMode={setLearningMode}
              selectedUnit={selectedUnit} setSelectedUnit={setSelectedUnit}
              difficulty={difficulty} setDifficulty={setDifficulty}
              generateDailyLesson={handleGenerate}
              startWeaknessReview={handleStartWeakness}
              isProcessing={session.isProcessing}
              historyMeta={session.historyMeta}
              onSwitchSession={handleSwitchSession}
              hasUnfinishedSession={hasUnfinished}
              onResume={handleResume}
              onRegenerate={handleRegenerate}
              regenCount={regenCount}
              // ★追加: ログアウトボタンをStartScreenにも渡す
              onLogout={handleLogout}
              userId={user.uid}
              openSettings={() => setShowSettings(true)}
          />;
      }

      // Lecture Screen
      if (currentStep === 'lecture' && session.dailyData) {
          return <LectureScreen
              dailyData={session.dailyData}
              learningMode={learningMode}
              lectureMode={lectureMode} setLectureMode={setLectureMode}
              simplifiedLecture={simplifiedLecture}
              simplifyLectureText={handleSimplify}
              isProcessing={session.isProcessing}
              onNext={() => { dismissKeyboard(); scrollToTop(); setCurrentStep('questions'); }}
          />;
      }

      // Questions Screen
      if (currentStep === 'questions' && session.dailyData) {
          const flatQ = getFlattenedQuestions(session.dailyData);
          const totalQ = flatQ.length;
          
          return <QuestionsScreen
              qIndex={session.qIndex}
              dailyData={session.dailyData}
              essayGrading={session.essayGrading}
              userAnswers={session.userAnswers}
              setUserAnswers={session.setUserAnswers}
              isAnswered={session.isAnswered}
              setIsAnswered={session.setIsAnswered}
              showHint={showHint} setShowHint={setShowHint}
              learningMode={learningMode}
              isReadOnly={session.viewingSession !== session.activeSession}
              isProcessing={session.isProcessing}
              gradeEssay={handleGradeWrapper}
              giveUpEssay={session.handleGiveUp}
              scoreRef={session.scoreRef}
              saveProgress={session.saveProgress}
              nextQuestion={() => {
                  session.setIsAnswered(false);
                  setShowHint(false);
                  scrollToTop();
                  if(session.qIndex < totalQ - 1) {
                      const n = session.qIndex + 1;
                      session.setQIndex(n);
                      session.saveProgress(session.userAnswers, n);
                  } else {
                      setCurrentStep('terms');
                      session.saveProgress(session.userAnswers, session.qIndex);
                  }
              }}
          />;
      }

      // Terms Screen
      if (currentStep === 'terms' && session.dailyData) {
          return <TermsScreen dailyData={session.dailyData} learningMode={learningMode} onNext={() => { dismissKeyboard(); scrollToTop(); setCurrentStep('summary'); }} />;
      }

      // Summary Screen
      if (currentStep === 'summary' && session.dailyData) {
          return <SummaryScreen
              dailyData={session.dailyData}
              userAnswers={session.userAnswers}
              essayGrading={session.essayGrading}
              activeSession={session.activeSession}
              isReadOnly={session.viewingSession !== session.activeSession}
              reflection={reflection} setReflection={setReflection}
              saveReflection={handleSaveReflection}
              copyToClipboard={() => {
                    const t = [`# ${session.dailyData.theme}`, `## 講義`, session.dailyData.lecture].join('\n');
                    navigator.clipboard.writeText(t);
                    setToastMessage({message:"コピーしました", type:'success'});
              }}
              startNextSession={() => {
                  if (session.activeSession >= MAX_DAILY_SESSIONS) return;
                  const n = session.activeSession + 1;
                  session.setActiveSession(n);
                  session.setViewingSession(n);
                  session.setDailyData(null);
                  session.setUserAnswers({});
                  session.setQIndex(0);
                  session.setIsAnswered(false);
                  setCurrentStep('start');
                  scrollToTop();
              }}
          />;
      }

      // Review Screen
      if (currentStep === 'review') {
          return <ReviewScreen
              qIndex={reviewQIndex}
              reviewProblems={reviewProblems}
              isAnswered={session.isAnswered}
              reviewResult={reviewResult}
              reviewUserAnswer={reviewUserAnswer}
              setReviewUserAnswer={setReviewUserAnswer}
              handleReviewAnswer={(ans) => {
                  const q = reviewProblems[reviewQIndex];
                  const corr = q.type==='true_false' ? ans===q.correct : JSON.stringify(ans)===JSON.stringify(q.correct_order);
                  setReviewResult(corr);
                  setReviewUserAnswer(ans);
                  session.setIsAnswered(true);
              }}
              nextReviewQuestion={() => {
                  scrollToTop();
                  if (reviewQIndex < reviewProblems.length - 1) {
                      setReviewQIndex(reviewQIndex + 1);
                      session.setIsAnswered(false);
                      setReviewResult(null);
                      setReviewUserAnswer(null);
                  } else {
                      setCurrentStep('start');
                      setReviewProblems([]);
                  }
              }}
              feedbackRef={session.scoreRef}
          />;
      }

      return <div className="text-center p-10 text-slate-400">Loading...</div>;
  };

  return (
    <div className={`min-h-screen pb-28 font-sans text-slate-900 bg-slate-50 selection:bg-indigo-100`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap'); 
        body { 
            font-family: 'Noto Sans JP', sans-serif; 
            -webkit-font-smoothing: antialiased;
        } 
        .markdown-body p { line-height: 1.8; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; } 
        .animate-slide-in { animation: slideIn 0.3s ease-out; }
      `}</style>
      
      {showSettings && (
        <SettingsModal 
            apiKey={userApiKey} 
            setApiKey={setUserApiKey} 
            onClose={() => setShowSettings(false)} 
            hasKey={!!userApiKey} 
            uid={user?.uid} 
            
            // ★変更: 管理者モード遷移の条件を「本物の管理者UIDかどうか」に変更
            onAdmin={()=>{
                if(isRealAdmin) {
                    setShowSettings(false); 
                    setIsAdminMode(true);
                } else {
                    alert("管理者権限がありません。");
                }
            }} 
            isAdminMode={isAdminMode} 
            adminApiKey={adminApiKey} 
            setAdminApiKey={setAdminApiKey} 
        />
      )}

      {toastMessage && <Toast message={toastMessage.message} type={toastMessage.type} onClose={() => setToastMessage(null)} />}

      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <h1 onClick={() => {setIsAdminMode(false); setActiveTab('train'); session.setViewingSession(session.activeSession); setCurrentStep('start'); scrollToTop();}} className={`text-xl font-black flex items-center gap-2 tracking-tight cursor-pointer hover:opacity-70 transition-opacity ${themeColorClass}`}>
            <HeaderIcon className={`w-6 h-6 ${iconColorClass}`} strokeWidth={2.5} /> 日本史AI特訓
          </h1>
          <div className="flex items-center gap-2">
              {!isAdminMode && <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Settings className="w-5 h-5 text-slate-400" /></button>}
              {/* ヘッダーにもログアウトボタンを小さく配置 */}
              <button onClick={handleLogout} className="p-2 hover:bg-red-50 rounded-full transition-colors"><LogOut className="w-5 h-5 text-red-300" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-5 mt-2">
        {(generator.genError || session.processingError || errorMessage) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm animate-fade-in shadow-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="font-medium">{generator.genError || session.processingError || errorMessage}</p>
            </div>
        )}
        {renderContent()}
      </main>

      {!isAdminMode && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-100 px-6 py-3 pb-8 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
          <div className="max-w-md mx-auto flex justify-around">
            <NavButton active={activeTab === 'train'} icon={Brain} label="学習" onClick={() => { setActiveTab('train'); scrollToTop(); }} />
            <NavButton active={activeTab === 'library'} icon={BookOpen} label="用語帳" onClick={() => { setActiveTab('library'); scrollToTop(); }} />
            <NavButton active={activeTab === 'log'} icon={CheckCircle} label="記録" onClick={() => { setActiveTab('log'); scrollToTop(); }} />
          </div>
        </nav>
      )}
    </div>
  );
}