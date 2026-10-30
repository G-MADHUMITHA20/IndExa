import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  FileText,
  Search,
  Trash2,
  Lock,
  Send,
  Edit3,
  HelpCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { getExams, deleteExam, closeExam, publishExam } from '../services/api';
import TeacherLayout from '../components/TeacherLayout';
import StatusBadge from '../components/StatusBadge';

export default function ExamListPage() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Confirmation modal states
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: null, // 'delete' | 'close' | 'publish'
    exam: null,
    isProcessing: false,
    error: null,
  });

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExams();
      setExams(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to retrieve exams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const filteredExams = exams.filter((exam) => {
    const matchesStatus = statusFilter === 'all' || exam.status === statusFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleOpenActionModal = (type, exam) => {
    setActionModal({
      isOpen: true,
      type,
      exam,
      isProcessing: false,
      error: null,
    });
  };

  const handleCloseModal = () => {
    setActionModal({
      isOpen: false,
      type: null,
      exam: null,
      isProcessing: false,
      error: null,
    });
  };

  const handleExecuteAction = async () => {
    const { type, exam } = actionModal;
    if (!exam) return;

    setActionModal((prev) => ({ ...prev, isProcessing: true, error: null }));
    try {
      if (type === 'delete') {
        await deleteExam(exam.id);
        setSuccessMsg(`Exam "${exam.title}" was successfully deleted.`);
      } else if (type === 'close') {
        await closeExam(exam.id);
        setSuccessMsg(`Exam "${exam.title}" is now closed.`);
      } else if (type === 'publish') {
        await publishExam(exam.id);
        setSuccessMsg(`Exam "${exam.title}" is successfully published!`);
      }
      handleCloseModal();
      await loadExams();
    } catch (err) {
      setActionModal((prev) => ({
        ...prev,
        isProcessing: false,
        error: err.response?.data?.detail || err.message || `Failed to ${type} exam.`,
      }));
    }
  };

  return (
    <TeacherLayout>
      <main id="main-content" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Exam Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Author, schedule, review questions, and control publishing status
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadExams}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500"
              aria-label="Refresh exams list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            <Link
              to="/teacher/exams/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-all focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              <span>Create Exam</span>
            </Link>
          </div>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div
            role="status"
            className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between gap-2"
          >
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

        {/* Global Error Banner */}
        {error && (
          <div role="alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              placeholder="Filter by exam title or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Filter exams"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs overflow-x-auto">
            {['all', 'draft', 'published', 'closed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Exams Table / Empty State */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-sm">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mb-3" aria-hidden="true" />
            <span>Retrieving exam records from database...</span>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 p-8 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-white">No exams found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or status filter.'
                : 'Get started by creating your first exam assessment paper.'}
            </p>
            <Link
              to="/teacher/exams/create"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              <span>Create Exam</span>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th scope="col" className="py-3.5 px-4">Exam Info</th>
                    <th scope="col" className="py-3.5 px-4">Subject</th>
                    <th scope="col" className="py-3.5 px-4">Duration</th>
                    <th scope="col" className="py-3.5 px-4">Marks (Qs / Total)</th>
                    <th scope="col" className="py-3.5 px-4">Schedule</th>
                    <th scope="col" className="py-3.5 px-4">Status</th>
                    <th scope="col" className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredExams.map((exam) => (
                    <tr key={exam.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4 font-semibold text-white">
                        <Link
                          to={`/teacher/exams/${exam.id}`}
                          className="hover:text-indigo-400 focus-visible:underline focus-visible:outline-none"
                        >
                          {exam.title}
                        </Link>
                        {exam.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 font-normal mt-0.5 max-w-xs">
                            {exam.description}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-300 text-xs">
                        {exam.subject}
                      </td>
                      <td className="py-4 px-4 text-slate-400">
                        {exam.duration_minutes} mins
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-slate-200">
                          {exam.current_marks_total} / {exam.total_marks}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          {exam.questions_count} question{exam.questions_count !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                          <span>{new Date(exam.start_time).toLocaleDateString()}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {new Date(exam.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(exam.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge status={exam.status} />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* View Details always available */}
                          <Link
                            to={`/teacher/exams/${exam.id}`}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            aria-label={`View details for ${exam.title}`}
                            title="View Exam Details"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </Link>

                          {/* Draft specific actions */}
                          {exam.status === 'draft' && (
                            <>
                              <Link
                                to={`/teacher/exams/${exam.id}/questions`}
                                className="p-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors"
                                aria-label={`Manage questions for ${exam.title}`}
                                title="Manage Questions"
                              >
                                <HelpCircle className="w-4 h-4" aria-hidden="true" />
                              </Link>
                              <Link
                                to={`/teacher/exams/${exam.id}/edit`}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                aria-label={`Edit exam ${exam.title}`}
                                title="Edit Exam"
                              >
                                <Edit3 className="w-4 h-4" aria-hidden="true" />
                              </Link>
                              <button
                                onClick={() => handleOpenActionModal('publish', exam)}
                                className="p-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white transition-colors cursor-pointer"
                                aria-label={`Publish exam ${exam.title}`}
                                title="Publish Exam"
                              >
                                <Send className="w-4 h-4" aria-hidden="true" />
                              </button>
                              <button
                                onClick={() => handleOpenActionModal('delete', exam)}
                                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-200 transition-colors cursor-pointer"
                                aria-label={`Delete draft exam ${exam.title}`}
                                title="Delete Exam"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </>
                          )}

                          {/* Published specific actions */}
                          {exam.status === 'published' && (
                            <button
                              onClick={() => handleOpenActionModal('close', exam)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-300 text-xs font-medium transition-colors cursor-pointer"
                              aria-label={`Close exam ${exam.title}`}
                            >
                              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Close</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {actionModal.isOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-headline"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    actionModal.type === 'delete'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : actionModal.type === 'close'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {actionModal.type === 'delete' ? (
                    <Trash2 className="w-6 h-6" aria-hidden="true" />
                  ) : actionModal.type === 'close' ? (
                    <Lock className="w-6 h-6" aria-hidden="true" />
                  ) : (
                    <Send className="w-6 h-6" aria-hidden="true" />
                  )}
                </div>

                <div>
                  <h3 id="modal-headline" className="text-lg font-bold text-white capitalize">
                    {actionModal.type} Exam
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {actionModal.type === 'delete' &&
                      `Are you sure you want to delete "${actionModal.exam?.title}"? This will permanently delete the exam and all its questions.`}
                    {actionModal.type === 'close' &&
                      `Are you sure you want to close "${actionModal.exam?.title}"? Closed exams will not accept new student attempts and cannot be reopened.`}
                    {actionModal.type === 'publish' &&
                      `Publishing "${actionModal.exam?.title}" will lock question configurations and make the exam available for students during the scheduled window.`}
                  </p>
                </div>
              </div>

              {/* Modal Error */}
              {actionModal.error && (
                <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {actionModal.error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={actionModal.isProcessing}
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionModal.isProcessing}
                  onClick={handleExecuteAction}
                  className={`px-4 py-2.5 rounded-xl text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 ${
                    actionModal.type === 'delete'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                      : actionModal.type === 'close'
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                      : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                  }`}
                >
                  {actionModal.isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span className="capitalize">Confirm {actionModal.type}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </TeacherLayout>
  );
}
