import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Clock,
  Send,
  Lock,
  Trash2,
  Edit3,
  HelpCircle,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Award,
  Layers,
} from 'lucide-react';
import { getExam, publishExam, closeExam, deleteExam } from '../services/api';
import TeacherLayout from '../components/TeacherLayout';
import StatusBadge from '../components/StatusBadge';

export default function ExamDetailPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Confirmation modal
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: null, // 'publish' | 'close' | 'delete'
    isProcessing: false,
    error: null,
  });

  const loadExam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExam(examId);
      setExam(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to retrieve exam details.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    loadExam();
  }, [loadExam]);

  const handleOpenModal = (type) => {
    setModalState({
      isOpen: true,
      type,
      isProcessing: false,
      error: null,
    });
  };

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      type: null,
      isProcessing: false,
      error: null,
    });
  };

  const handleConfirmAction = async () => {
    const { type } = modalState;
    setModalState((prev) => ({ ...prev, isProcessing: true, error: null }));
    try {
      if (type === 'publish') {
        await publishExam(examId);
        setSuccessMsg('Exam published successfully! Students can now access this assessment during the scheduled window.');
      } else if (type === 'close') {
        await closeExam(examId);
        setSuccessMsg('Exam has been closed. No further submissions will be accepted.');
      } else if (type === 'delete') {
        await deleteExam(examId);
        navigate('/teacher/exams', {
          state: { notice: `Exam "${exam.title}" was successfully deleted.` },
        });
        return;
      }
      handleCloseModal();
      await loadExam();
    } catch (err) {
      setModalState((prev) => ({
        ...prev,
        isProcessing: false,
        error: err.response?.data?.detail || err.message || `Failed to ${type} exam.`,
      }));
    }
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 text-sm">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-3" aria-hidden="true" />
          <span>Loading exam information...</span>
        </div>
      </TeacherLayout>
    );
  }

  if (error || !exam) {
    return (
      <TeacherLayout>
        <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" aria-hidden="true" />
          <h2 className="text-xl font-bold text-white">Error Loading Exam</h2>
          <p className="text-sm text-slate-400">{error || 'Exam could not be found.'}</p>
          <Link
            to="/teacher/exams"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Return to Exam List</span>
          </Link>
        </div>
      </TeacherLayout>
    );
  }

  const marksMatch = Math.abs(exam.current_marks_total - exam.total_marks) < 0.001;

  return (
    <TeacherLayout>
      <main id="main-content" className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            to="/teacher/exams"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors mb-3 focus-visible:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Exam Management</span>
          </Link>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div role="status" className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-xs text-emerald-400 hover:text-emerald-200 underline font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Exam Title & Actions Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <StatusBadge status={exam.status} />
                <span className="font-mono text-xs font-semibold text-indigo-400 uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                  {exam.subject}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {exam.title}
              </h1>
              {exam.description && (
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  {exam.description}
                </p>
              )}
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {exam.status === 'draft' && (
                <>
                  <Link
                    to={`/teacher/exams/${exam.id}/questions`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
                  >
                    <HelpCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Manage Questions ({exam.questions_count})</span>
                  </Link>

                  <Link
                    to={`/teacher/exams/${exam.id}/edit`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Edit</span>
                  </Link>

                  <button
                    onClick={() => handleOpenModal('publish')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Publish Exam</span>
                  </button>

                  <button
                    onClick={() => handleOpenModal('delete')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </>
              )}

              {exam.status === 'published' && (
                <button
                  onClick={() => handleOpenModal('close')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Close Exam</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-800/80 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block mb-1">Duration</span>
              <span className="font-semibold text-white text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                {exam.duration_minutes} Minutes
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block mb-1">Marks Consistency</span>
              <span
                className={`font-mono font-semibold text-sm flex items-center gap-1.5 ${
                  marksMatch ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                <Award className="w-4 h-4" aria-hidden="true" />
                {exam.current_marks_total} / {exam.total_marks}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block mb-1">Questions Configured</span>
              <span className="font-semibold text-white text-sm flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                {exam.questions_count} Items
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block mb-1">Start Window</span>
              <span className="font-semibold text-white text-xs">
                {new Date(exam.start_time).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Questions Preview Section */}
        <section aria-labelledby="questions-preview-heading" className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="questions-preview-heading" className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" aria-hidden="true" />
                Configured Questions ({exam.questions.length})
              </h2>
              <p className="text-xs text-slate-400">Sequential question arrangement and rubric values</p>
            </div>

            {exam.status === 'draft' && (
              <Link
                to={`/teacher/exams/${exam.id}/questions`}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
              >
                Open Question Editor &rarr;
              </Link>
            )}
          </div>

          {exam.questions.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 p-8 space-y-2">
              <p className="text-sm font-semibold text-slate-300">No questions added yet</p>
              <p className="text-xs text-slate-500">
                You must add questions totaling {exam.total_marks} marks before this exam can be published.
              </p>
              {exam.status === 'draft' && (
                <Link
                  to={`/teacher/exams/${exam.id}/questions`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold mt-2"
                >
                  <HelpCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Add First Question</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {exam.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                        Q{idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 capitalize font-medium">
                        {q.question_type.replace('_', ' ')}
                      </span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        {q.marks} mark{q.marks !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <p className="text-sm text-slate-200 font-medium whitespace-pre-line">
                      {q.question_text}
                    </p>

                    {/* MCQ Options preview */}
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${
                              opt === q.correct_answer
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                          >
                            <span className="font-bold mr-1.5">
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            <span>{opt}</span>
                            {opt === q.correct_answer && (
                              <span className="ml-1 text-[10px] text-emerald-400 font-semibold">(Correct)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Confirmation Modal */}
        {modalState.isOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
              <div>
                <h3 id="detail-modal-title" className="text-lg font-bold text-white capitalize">
                  {modalState.type} Exam
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {modalState.type === 'publish' &&
                    `Are you sure you want to publish "${exam.title}"? This verifies that all questions and marks match the total marks.`}
                  {modalState.type === 'close' &&
                    `Closing "${exam.title}" will end testing and prevent future submissions.`}
                  {modalState.type === 'delete' &&
                    `Deleting "${exam.title}" will remove the exam and all its questions permanently.`}
                </p>
              </div>

              {modalState.error && (
                <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {modalState.error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={modalState.isProcessing}
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={modalState.isProcessing}
                  onClick={handleConfirmAction}
                  className={`px-4 py-2.5 rounded-xl text-white text-xs font-semibold transition-all ${
                    modalState.type === 'delete'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : modalState.type === 'close'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {modalState.isProcessing ? 'Processing...' : `Confirm ${modalState.type}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </TeacherLayout>
  );
}
