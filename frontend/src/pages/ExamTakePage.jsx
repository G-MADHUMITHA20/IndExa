import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  getStudentAttempt,
  startOrResumeAttempt,
  getAttemptQuestions,
  saveDraftAnswer,
  submitAttempt,
} from '../services/api';
import { useAccessibility } from '../context/AccessibilityContext';
import speechService, {
  formatQuestionForSpeech,
  formatAnswerForSpeech,
  formatInstructionsForSpeech,
} from '../services/speechService';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Check,
  Home,
  Award,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  FileText,
  Sliders,
  Keyboard,
  Info,
} from 'lucide-react';

export default function ExamTakePage() {
  const { examId } = useParams();
  const location = useLocation();

  // Accessibility Context Hooks
  const {
    speechEnabled,
    speechRate,
    speechVolume,
    preferredVoice,
    autoReadQuestions,
    openSettings,
    openHelp,
  } = useAccessibility();

  // Core Attempt & Questions State
  const [attempt, setAttempt] = useState(location.state?.attempt || null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [question_id]: string }
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState(null);

  // Autosave State
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const [saveErrorMessage, setSaveErrorMessage] = useState('');
  const debounceTimerRef = useRef(null);
  const answersRef = useRef(answers);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Timer State (Server Authoritative)
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [deadlineIso, setDeadlineIso] = useState(null);

  // Submission State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  // Speech State & Announcements
  const [speechStatus, setSpeechStatus] = useState({
    isSpeaking: false,
    isPaused: false,
    supported: speechService.isSupported(),
  });
  const [speechAnnouncement, setSpeechAnnouncement] = useState('');
  const [reservedNotice, setReservedNotice] = useState('');

  // Subscribe to speech synthesis state updates
  useEffect(() => {
    const unsubscribe = speechService.subscribe((state) => {
      setSpeechStatus(state);
    });

    return () => {
      unsubscribe();
      // Ensure speech is stopped immediately when leaving or unmounting the exam page
      speechService.stop();
    };
  }, []);

  // Handle automatic submission when timer hits 0
  const handleTimeExpiredAutoSubmit = useCallback(async () => {
    if (!attempt || isSubmitting || submissionResult) return;
    setIsSubmitting(true);
    speechService.stop();
    try {
      const result = await submitAttempt(attempt.id);
      setSubmissionResult(result);
    } catch {
      try {
        const latest = await getStudentAttempt(attempt.id);
        setAttempt(latest);
      } catch {
        // ignore
      }
      setInitError('Examination time has expired. Your attempt has concluded.');
    } finally {
      setIsSubmitting(false);
    }
  }, [attempt, isSubmitting, submissionResult]);

  // Initialize Exam Session: load or resume attempt and questions
  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      setIsLoading(true);
      setInitError(null);

      try {
        // Ensure attempt exists (start or resume)
        let activeAttempt = attempt;
        if (!activeAttempt) {
          activeAttempt = await startOrResumeAttempt(examId);
        } else {
          // Verify freshest attempt details from server
          activeAttempt = await getStudentAttempt(activeAttempt.id);
        }

        if (!isMounted) return;
        setAttempt(activeAttempt);

        // Check if attempt is already completed or expired
        if (activeAttempt.status === 'submitted') {
          setSubmissionResult({
            attempt_id: activeAttempt.id,
            status: 'submitted',
            submitted_at: activeAttempt.submitted_at || new Date().toISOString(),
            message: 'You have already submitted this examination.',
            total_questions: activeAttempt.total_questions || 0,
            answered_questions: activeAttempt.answered_count || 0,
          });
          setIsLoading(false);
          return;
        }

        if (activeAttempt.status === 'expired') {
          setInitError('This examination attempt has expired and cannot be continued.');
          setIsLoading(false);
          return;
        }

        // Set authoritative deadline from server
        setDeadlineIso(activeAttempt.deadline);
        const deadlineDate = new Date(activeAttempt.deadline);
        const now = new Date();
        const initialRemaining = Math.max(0, Math.floor((deadlineDate - now) / 1000));
        setRemainingSeconds(initialRemaining);

        // Fetch questions for this attempt
        const qList = await getAttemptQuestions(activeAttempt.id);
        if (!isMounted) return;
        setQuestions(qList);

        // Populate already saved draft answers from attempt
        const existingAnswers = {};
        if (activeAttempt.answers) {
          Object.entries(activeAttempt.answers).forEach(([qid, ansObj]) => {
            if (ansObj && typeof ansObj.draft_response === 'string') {
              existingAnswers[qid] = ansObj.draft_response;
            }
          });
        }
        setAnswers(existingAnswers);
      } catch (err) {
        if (!isMounted) return;
        setInitError(
          err.response?.data?.detail ||
          err.message ||
          'Failed to load examination session.'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeSession();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // Live Timer Countdown Hook
  useEffect(() => {
    if (!deadlineIso || submissionResult || initError) return;

    const deadlineDate = new Date(deadlineIso);

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((deadlineDate - now) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        clearInterval(interval);
        handleTimeExpiredAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadlineIso, submissionResult, initError, handleTimeExpiredAutoSubmit]);

  // Immediate Save API call
  const persistAnswer = useCallback(
    async (questionId, draftValue) => {
      if (!attempt || !questionId) return;

      setSaveStatus('saving');
      setSaveErrorMessage('');

      try {
        await saveDraftAnswer(attempt.id, questionId, draftValue);
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
        setSaveErrorMessage(
          err.response?.data?.detail || 'Failed to save answer. Click retry.'
        );
      }
    },
    [attempt]
  );

  // Debounced answer change handler
  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setSaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      persistAnswer(questionId, value);
    }, 700);
  };

  // Immediate flush before changing question
  const navigateToQuestion = useCallback(
    (targetIndex) => {
      if (targetIndex < 0 || targetIndex >= questions.length) return;

      // Stop any ongoing speech before switching questions
      speechService.stop();

      const currentQuestion = questions[currentIndex];
      if (currentQuestion) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        const currentValue = answersRef.current[currentQuestion.id] || '';
        persistAnswer(currentQuestion.id, currentValue);
      }

      setCurrentIndex(targetIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentIndex, questions, persistAnswer]
  );

  // Active question reference
  const currentQuestion = questions[currentIndex];

  // -------------------------------------------------------------
  // Text-to-Speech Action Handlers
  // -------------------------------------------------------------

  // Read current question (Alt + R)
  const handleReadQuestion = useCallback(() => {
    if (!currentQuestion) return;

    if (!speechService.isSupported()) {
      setSpeechAnnouncement('Speech synthesis is not supported in this browser.');
      return;
    }

    if (!speechEnabled) {
      setSpeechAnnouncement('Speech synthesis is disabled in accessibility settings. Enable it in settings.');
      return;
    }

    const text = formatQuestionForSpeech(currentQuestion, currentIndex, questions.length);
    setSpeechAnnouncement(`Reading question ${currentIndex + 1} of ${questions.length}.`);

    speechService.speak(text, {
      rate: speechRate,
      volume: speechVolume,
      voiceName: preferredVoice,
    });
  }, [currentQuestion, currentIndex, questions.length, speechEnabled, speechRate, speechVolume, preferredVoice]);

  // Read current answer draft (Alt + A)
  const handleReadAnswer = useCallback(() => {
    if (!currentQuestion) return;

    if (!speechService.isSupported()) {
      setSpeechAnnouncement('Speech synthesis is not supported in this browser.');
      return;
    }

    if (!speechEnabled) {
      setSpeechAnnouncement('Speech synthesis is disabled in accessibility settings.');
      return;
    }

    const currentDraft = answersRef.current[currentQuestion.id] || '';
    const text = formatAnswerForSpeech(currentDraft, currentQuestion.question_type);
    setSpeechAnnouncement('Reading your current answer draft.');

    speechService.speak(text, {
      rate: speechRate,
      volume: speechVolume,
      voiceName: preferredVoice,
    });
  }, [currentQuestion, speechEnabled, speechRate, speechVolume, preferredVoice]);

  // Read examination instructions aloud
  const handleReadInstructions = useCallback(() => {
    if (!speechService.isSupported()) {
      setSpeechAnnouncement('Speech synthesis is not supported in this browser.');
      return;
    }

    if (!speechEnabled) {
      setSpeechAnnouncement('Speech synthesis is disabled in accessibility settings.');
      return;
    }

    const examInfo = attempt
      ? {
          title: attempt.exam_title || 'Digital Examination',
          subject: attempt.exam_subject || 'General Assessment',
          duration_minutes: attempt.duration_minutes || 60,
          total_marks:
            attempt.total_marks ||
            questions.reduce((sum, q) => sum + (q.marks || 0), 0),
        }
      : null;

    const text = formatInstructionsForSpeech(examInfo, questions.length);
    setSpeechAnnouncement('Reading examination instructions.');

    speechService.speak(text, {
      rate: speechRate,
      volume: speechVolume,
      voiceName: preferredVoice,
    });
  }, [attempt, questions, speechEnabled, speechRate, speechVolume, preferredVoice]);

  // Pause or resume speech
  const handlePauseResumeSpeech = useCallback(() => {
    if (speechStatus.isPaused) {
      speechService.resume();
      setSpeechAnnouncement('Speech resumed.');
    } else if (speechStatus.isSpeaking) {
      speechService.pause();
      setSpeechAnnouncement('Speech paused.');
    }
  }, [speechStatus.isPaused, speechStatus.isSpeaking]);

  // Stop speech immediately
  const handleStopSpeech = useCallback(() => {
    speechService.stop();
    setSpeechAnnouncement('Speech stopped.');
  }, []);

  // Automatic question reading when autoReadQuestions is enabled
  useEffect(() => {
    if (!isLoading && currentQuestion && autoReadQuestions && speechEnabled) {
      const timer = setTimeout(() => {
        handleReadQuestion();
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, isLoading, autoReadQuestions, speechEnabled, handleReadQuestion, currentQuestion]);

  // Auto-dismiss reserved notice banner
  useEffect(() => {
    if (!reservedNotice) return;
    const timer = setTimeout(() => {
      setReservedNotice('');
    }, 5000);
    return () => clearTimeout(timer);
  }, [reservedNotice]);

  // -------------------------------------------------------------
  // Keyboard Shortcuts Navigation Hook
  // -------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Must use Alt key modifier for examination navigation shortcuts
      if (!e.altKey) return;

      const key = e.key;
      const isInputFocused =
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.isContentEditable);

      // Alt + R: Read current question aloud
      if (key === 'r' || key === 'R') {
        e.preventDefault();
        handleReadQuestion();
        return;
      }

      // Alt + A: Read current answer aloud
      if (key === 'a' || key === 'A') {
        e.preventDefault();
        handleReadAnswer();
        return;
      }

      // Alt + E: Focus or activate answer editing
      if (key === 'e' || key === 'E') {
        e.preventDefault();
        if (currentQuestion) {
          if (currentQuestion.question_type === 'mcq') {
            const firstRadio = document.querySelector(
              `input[name="question-${currentQuestion.id}"]`
            );
            if (firstRadio) {
              firstRadio.focus();
              setSpeechAnnouncement('Focused multiple choice options. Use arrow keys to select.');
            }
          } else {
            const textarea = document.getElementById(`answer-${currentQuestion.id}`);
            if (textarea) {
              textarea.focus();
              setSpeechAnnouncement('Focused answer editing text area.');
            }
          }
        }
        return;
      }

      // Alt + S: Open submission confirmation modal
      if (key === 's' || key === 'S') {
        e.preventDefault();
        speechService.stop();
        setShowSubmitModal(true);
        setSpeechAnnouncement('Opened examination submission dialog.');
        return;
      }

      // Alt + V: Reserved for future voice input (Prompt 6)
      if (key === 'v' || key === 'V') {
        e.preventDefault();
        const msg = 'Voice input is reserved and will be enabled in Prompt 6.';
        setReservedNotice(msg);
        setSpeechAnnouncement(msg);
        if (speechEnabled) {
          speechService.speak(msg, {
            rate: speechRate,
            volume: speechVolume,
            voiceName: preferredVoice,
          });
        }
        return;
      }

      // Alt + Enter: Reserved for future answer confirmation (Prompt 7)
      if (key === 'Enter') {
        e.preventDefault();
        const msg = 'Explicit answer confirmation is reserved and will be enabled in Prompt 7.';
        setReservedNotice(msg);
        setSpeechAnnouncement(msg);
        if (speechEnabled) {
          speechService.speak(msg, {
            rate: speechRate,
            volume: speechVolume,
            voiceName: preferredVoice,
          });
        }
        return;
      }

      // Alt + Left Arrow: Previous question (Only if NOT actively typing in a text control)
      if (key === 'ArrowLeft') {
        if (!isInputFocused) {
          e.preventDefault();
          if (currentIndex > 0) {
            navigateToQuestion(currentIndex - 1);
            setSpeechAnnouncement(`Navigated to question ${currentIndex}.`);
          }
        }
        return;
      }

      // Alt + Right Arrow: Next question (Only if NOT actively typing in a text control)
      if (key === 'ArrowRight') {
        if (!isInputFocused) {
          e.preventDefault();
          if (currentIndex < questions.length - 1) {
            navigateToQuestion(currentIndex + 1);
            setSpeechAnnouncement(`Navigated to question ${currentIndex + 2}.`);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentQuestion,
    currentIndex,
    questions.length,
    handleReadQuestion,
    handleReadAnswer,
    navigateToQuestion,
    speechEnabled,
    speechRate,
    speechVolume,
    preferredVoice,
  ]);

  // Handle final submission confirmation
  const handleConfirmSubmit = async () => {
    if (!attempt) return;
    setIsSubmitting(true);
    speechService.stop();

    try {
      // Save current question first if unsaved
      const q = questions[currentIndex];
      if (q) {
        const currentValue = answersRef.current[q.id] || '';
        await saveDraftAnswer(attempt.id, q.id, currentValue);
      }

      const result = await submitAttempt(attempt.id);
      setSubmissionResult(result);
      setShowSubmitModal(false);
    } catch (err) {
      alert(
        err.response?.data?.detail ||
        err.message ||
        'Submission failed. Please verify your connection.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper formatting for countdown timer (HH:MM:SS or MM:SS)
  const formatTime = (totalSec) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  // Compute question status counts
  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(
      (val) => typeof val === 'string' && val.trim().length > 0
    ).length;
  }, [answers]);

  const unansweredCount = Math.max(0, questions.length - answeredCount);

  // -------------------------------------------------------------
  // Render: Loading Screen
  // -------------------------------------------------------------
  if (isLoading) {
    return (
      <main id="main-content" className="flex-1 flex items-center justify-center min-h-[70vh] px-4">
        <div aria-live="polite" className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <h1 className="text-lg font-bold text-white">Initializing Accessible Examination Workspace</h1>
          <p className="text-sm text-slate-400">Loading attempt state, speech engine, and questions...</p>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------
  // Render: Initialization Error Screen
  // -------------------------------------------------------------
  if (initError && !submissionResult) {
    return (
      <main id="main-content" className="flex-1 max-w-2xl mx-auto w-full px-4 py-16">
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-8 text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Examination Access Notice</h1>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed">{initError}</p>
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------
  // Render: Post-Submission Confirmation Screen
  // -------------------------------------------------------------
  if (submissionResult) {
    return (
      <main id="main-content" className="flex-1 max-w-2xl mx-auto w-full px-4 py-16">
        <div className="rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-10 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            Examination Submitted Successfully
          </h1>
          <p className="text-sm text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
            Your responses have been securely locked and recorded in the database.
          </p>

          <div className="rounded-2xl bg-slate-950/60 border border-slate-800/80 p-5 text-left text-xs space-y-3 mb-8">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Attempt Status</span>
              <span className="font-semibold text-emerald-400 uppercase tracking-wider">Locked & Submitted</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Submission Timestamp</span>
              <span className="font-mono text-slate-200">
                {new Date(submissionResult.submitted_at).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Total Questions</span>
              <span className="font-bold text-slate-200">
                {submissionResult.total_questions || questions.length}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Answered Questions</span>
              <span className="font-bold text-indigo-400">
                {submissionResult.answered_questions || answeredCount}
              </span>
            </div>
          </div>

          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Return to Student Dashboard</span>
          </Link>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------
  // Render: Active Distraction-Free Examination Workspace
  // -------------------------------------------------------------
  const isTimeCritical = remainingSeconds <= 300; // 5 minutes or less

  return (
    <div className="flex-1 flex flex-col bg-slate-950 min-h-screen">
      {/* Screen Reader Live Announcements Region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {speechAnnouncement}
      </div>

      {/* Top Distraction-Free Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
          {/* Exam Title & Subject */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold truncate">
                {attempt?.exam_subject || 'Examination'}
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline">•</span>
              <h1 className="text-sm sm:text-base font-bold text-white truncate">
                {attempt?.exam_title || 'Assessment'}
              </h1>
            </div>
          </div>

          {/* Accessibility Quick Triggers */}
          <div className="flex items-center gap-2">
            {/* Spoken Instructions Button */}
            <button
              type="button"
              onClick={handleReadInstructions}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              aria-label="Hear spoken examination instructions"
              title="Hear spoken examination instructions"
            >
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
              <span className="hidden md:inline">Instructions</span>
            </button>

            {/* Keyboard Shortcuts Dialog Trigger */}
            <button
              type="button"
              onClick={openHelp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              aria-label="View keyboard shortcuts help"
              title="View keyboard shortcuts help"
            >
              <Keyboard className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span className="hidden md:inline">Shortcuts</span>
            </button>

            {/* Accessibility Settings Trigger */}
            <button
              type="button"
              onClick={openSettings}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              aria-label="Open accessibility settings dialog"
              title="Open accessibility settings dialog"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
              <span className="hidden md:inline">Settings</span>
            </button>
          </div>

          {/* Autosave Status Indicator */}
          <div aria-live="polite" className="hidden lg:flex items-center gap-1.5 text-xs">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Saving draft...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Draft saved</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <button
                type="button"
                onClick={() =>
                  currentQuestion &&
                  persistAnswer(currentQuestion.id, answers[currentQuestion.id] || '')
                }
                className="flex items-center gap-1 text-rose-400 hover:text-rose-300 underline"
                title={saveErrorMessage}
              >
                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Save Failed (Retry)</span>
              </button>
            )}
          </div>

          {/* Authoritative Live Countdown Timer */}
          <div
            aria-live="polite"
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl border text-sm font-mono font-bold tracking-wider ${
              isTimeCritical
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/40 animate-pulse'
                : 'bg-slate-800/80 text-slate-200 border-slate-700/80'
            }`}
          >
            <Clock
              className={`w-4 h-4 ${isTimeCritical ? 'text-rose-400' : 'text-indigo-400'}`}
              aria-hidden="true"
            />
            <span aria-label={`Time remaining: ${formatTime(remainingSeconds)}`}>
              {formatTime(remainingSeconds)}
            </span>
          </div>

          {/* Header Submit Exam Trigger Button */}
          <div>
            <button
              type="button"
              onClick={() => {
                speechService.stop();
                setShowSubmitModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              aria-label="Submit examination (Alt + S)"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Submit Exam</span>
            </button>
          </div>
        </div>

        {/* 5-Minute Warning Banner */}
        {isTimeCritical && (
          <div
            role="alert"
            className="mt-2 py-1 px-3 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium text-center flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Warning: Less than 5 minutes remaining! Please review your responses and prepare to submit.</span>
          </div>
        )}
      </header>

      {/* Main Workspace Layout */}
      <main
        id="main-content"
        className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6"
      >
        {/* Left Column: Active Question Workspace (3 cols) */}
        <section
          aria-label="Question answering workspace"
          className="lg:col-span-3 flex flex-col justify-between space-y-6"
        >
          {currentQuestion ? (
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-xl flex-1 flex flex-col justify-between">
              <div>
                {/* Reserved Feature Notice Banner (Alt+V or Alt+Enter notifications) */}
                {reservedNotice && (
                  <div
                    role="status"
                    className="mb-4 p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs flex items-center justify-between gap-3 animate-fade-in"
                  >
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" />
                      <span>{reservedNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReservedNotice('')}
                      className="text-slate-400 hover:text-white text-xs underline font-medium"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Question Metadata Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold text-xs uppercase tracking-wider border border-indigo-500/20">
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                      ({currentQuestion.question_type.replace('_', ' ')})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    <Award className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{currentQuestion.marks} Marks</span>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* Assistive Reading & Speech Toolbar */}
                {/* ------------------------------------------------------------- */}
                <div
                  role="region"
                  aria-label="Speech and audio controls"
                  className="mb-6 p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3"
                >
                  {/* Status Indicator */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/80 border border-slate-700/60">
                      {speechStatus.isSpeaking ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Speaking aloud</span>
                        </span>
                      ) : speechStatus.isPaused ? (
                        <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span>Speech paused</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          {speechEnabled ? (
                            <Volume2 className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                          ) : (
                            <VolumeX className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          )}
                          <span>{speechEnabled ? 'Speech Ready' : 'Speech Disabled'}</span>
                        </span>
                      )}
                    </div>

                    {!speechStatus.supported && (
                      <span className="text-xs text-rose-400 font-medium">
                        Browser speech unsupported
                      </span>
                    )}
                  </div>

                  {/* Speech Actions Group */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Read / Repeat Question (Alt + R) */}
                    <button
                      type="button"
                      onClick={handleReadQuestion}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                      aria-label="Read question aloud (Alt + R)"
                      title="Read question aloud (Alt + R)"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                      <span>{speechStatus.isSpeaking ? 'Repeat Question' : 'Read Question'}</span>
                      <kbd className="hidden sm:inline-block px-1 py-0.2 bg-slate-900/60 border border-slate-700 text-[10px] rounded text-slate-400 font-mono">
                        Alt+R
                      </kbd>
                    </button>

                    {/* Read My Current Answer (Alt + A) */}
                    <button
                      type="button"
                      onClick={handleReadAnswer}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                      aria-label="Read my current answer (Alt + A)"
                      title="Read my current answer (Alt + A)"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                      <span>Read My Answer</span>
                      <kbd className="hidden sm:inline-block px-1 py-0.2 bg-slate-900/60 border border-slate-700 text-[10px] rounded text-slate-400 font-mono">
                        Alt+A
                      </kbd>
                    </button>

                    {/* Pause / Resume Speech */}
                    {(speechStatus.isSpeaking || speechStatus.isPaused) && (
                      <button
                        type="button"
                        onClick={handlePauseResumeSpeech}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                        aria-label={speechStatus.isPaused ? 'Resume speech' : 'Pause speech'}
                        title={speechStatus.isPaused ? 'Resume speech' : 'Pause speech'}
                      >
                        {speechStatus.isPaused ? (
                          <>
                            <Play className="w-3 h-3 text-amber-400" aria-hidden="true" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3 text-amber-400" aria-hidden="true" />
                            <span>Pause</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Stop Speech Immediately */}
                    {(speechStatus.isSpeaking || speechStatus.isPaused) && (
                      <button
                        type="button"
                        onClick={handleStopSpeech}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                        aria-label="Stop speech immediately"
                        title="Stop speech immediately"
                      >
                        <Square className="w-3 h-3 text-rose-400" aria-hidden="true" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Prompt */}
                <div className="mb-8">
                  <h2 className="text-lg sm:text-xl font-medium text-slate-100 leading-relaxed whitespace-pre-line">
                    {currentQuestion.question_text}
                  </h2>
                </div>

                {/* Answer Input Controls Based on Question Type */}
                <div className="mb-6">
                  {/* TYPE 1: Multiple Choice Question */}
                  {currentQuestion.question_type === 'mcq' && (
                    <fieldset className="space-y-3">
                      <legend className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Select one option:
                      </legend>
                      {currentQuestion.options && currentQuestion.options.length > 0 ? (
                        currentQuestion.options.map((option, optIdx) => {
                          const isSelected = (answers[currentQuestion.id] || '') === option;
                          const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                          const optionLetter = optionLetters[optIdx] || String(optIdx + 1);

                          return (
                            <label
                              key={optIdx}
                              className={`flex items-center gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500'
                                  : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800 text-slate-200'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`question-${currentQuestion.id}`}
                                value={option}
                                checked={isSelected}
                                onChange={() => handleAnswerChange(currentQuestion.id, option)}
                                className="w-4 h-4 text-indigo-600 border-slate-700 bg-slate-900 focus:ring-indigo-500"
                                aria-label={`Option ${optionLetter}: ${option}`}
                              />
                              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60">
                                {optionLetter}
                              </span>
                              <span className="text-sm font-medium leading-relaxed">{option}</span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="text-xs text-rose-400">No options configured for this MCQ.</p>
                      )}
                    </fieldset>
                  )}

                  {/* TYPE 2: Short Answer Question */}
                  {currentQuestion.question_type === 'short_answer' && (
                    <div>
                      <label
                        htmlFor={`answer-${currentQuestion.id}`}
                        className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"
                      >
                        Your Concise Response:
                      </label>
                      <textarea
                        id={`answer-${currentQuestion.id}`}
                        rows={4}
                        value={answers[currentQuestion.id] || ''}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        placeholder="Type your short answer response here..."
                        className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-200 text-sm placeholder-slate-500 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1.5 px-1">
                        <span>Press Alt + E to focus, Alt + A to hear answer.</span>
                        <span>{(answers[currentQuestion.id] || '').length} characters</span>
                      </div>
                    </div>
                  )}

                  {/* TYPE 3: Long Answer Question */}
                  {currentQuestion.question_type === 'long_answer' && (
                    <div>
                      <label
                        htmlFor={`answer-${currentQuestion.id}`}
                        className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"
                      >
                        Your Detailed Response:
                      </label>
                      <textarea
                        id={`answer-${currentQuestion.id}`}
                        rows={10}
                        value={answers[currentQuestion.id] || ''}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        placeholder="Write your comprehensive answer here..."
                        className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-200 text-sm placeholder-slate-500 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1.5 px-1">
                        <span>Autosaving in real-time. Alt + E to edit, Alt + A to read back.</span>
                        <span>
                          {((answers[currentQuestion.id] || '').trim().split(/\s+/).filter(Boolean)).length}{' '}
                          words • {(answers[currentQuestion.id] || '').length} chars
                        </span>
                      </div>
                    </div>
                  )}

                  {/* TYPE 4: Mathematical Expression Question */}
                  {currentQuestion.question_type === 'mathematical' && (
                    <div>
                      <label
                        htmlFor={`answer-${currentQuestion.id}`}
                        className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"
                      >
                        Mathematical Answer / Formula (Text Representation):
                      </label>
                      <textarea
                        id={`answer-${currentQuestion.id}`}
                        rows={4}
                        value={answers[currentQuestion.id] || ''}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        placeholder="Enter mathematical expressions, steps, or standard notation (e.g., x^2 + 2x + 1 = 0)..."
                        className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-200 font-mono text-sm placeholder-slate-500 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1.5 px-1">
                        <span>Text-based mathematical representation. Advanced formula tools will be added later.</span>
                        <span>{(answers[currentQuestion.id] || '').length} chars</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation Controls Between Questions */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => navigateToQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Go to previous question (Alt + Left Arrow)"
                  title="Go to previous question (Alt + Left Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  <span>Previous (Alt+Left)</span>
                </button>

                <div className="text-xs text-slate-400 font-medium">
                  {currentIndex + 1} / {questions.length}
                </div>

                <button
                  type="button"
                  onClick={() => navigateToQuestion(currentIndex + 1)}
                  disabled={currentIndex === questions.length - 1}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Go to next question (Alt + Right Arrow)"
                  title="Go to next question (Alt + Right Arrow)"
                >
                  <span>Next (Alt+Right)</span>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-slate-900 p-8 text-center text-slate-400">
              No questions found for this examination.
            </div>
          )}
        </section>

        {/* Right Column: Question Navigation Panel (1 col) */}
        <aside aria-label="Question overview panel" className="space-y-6">
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl sticky top-24">
            <h2 className="text-sm font-bold text-white mb-3">Question Navigator</h2>

            {/* Progress indicators */}
            <div className="space-y-2 mb-4 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Answered:</span>
                <span className="font-bold text-emerald-400">
                  {answeredCount} of {questions.length}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{
                    width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-emerald-500" aria-hidden="true" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-slate-800 border border-slate-700" aria-hidden="true" />
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md ring-2 ring-indigo-500 bg-slate-900" aria-hidden="true" />
                <span>Current</span>
              </div>
            </div>

            {/* Questions Number Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-1 mb-6">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered =
                  typeof answers[q.id] === 'string' && answers[q.id].trim().length > 0;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => navigateToQuestion(idx)}
                    className={`h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                      isCurrent
                        ? 'ring-2 ring-indigo-500 bg-indigo-600 text-white shadow-md'
                        : isAnswered
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:bg-slate-700/80 hover:text-slate-200'
                    }`}
                    aria-label={`Jump to question ${idx + 1}${isAnswered ? ', answered' : ', not answered'}`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Complete Submission Button in Panel */}
            <button
              type="button"
              onClick={() => {
                speechService.stop();
                setShowSubmitModal(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Submit Entire Exam</span>
            </button>
          </div>
        </aside>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* Explicit Pre-Submission Confirmation Modal */}
      {/* ------------------------------------------------------------- */}
      {showSubmitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        >
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 id="submit-modal-title" className="text-xl font-bold text-white">
                Submit Examination?
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Please review your answer summary before confirming final submission.
              </p>
            </div>

            {/* Summary statistics */}
            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Total Questions:</span>
                <span className="font-bold text-slate-200">{questions.length}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Answered Questions:</span>
                <span className="font-bold text-emerald-400">{answeredCount}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Unanswered Questions:</span>
                <span
                  className={`font-bold ${unansweredCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}
                >
                  {unansweredCount}
                </span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p className="text-xs text-amber-300/90 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                Notice: You still have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}. Unanswered questions will receive zero marks.
              </p>
            )}

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs leading-relaxed">
              <strong>Caution:</strong> Once submitted, your answers will be locked and cannot be edited.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Return to Exam
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Confirm & Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
