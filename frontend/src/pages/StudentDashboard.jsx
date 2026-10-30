import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAvailableExams, startOrResumeAttempt } from '../services/api';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  GraduationCap,
  Clock,
  Award,
  Calendar,
  Search,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  RefreshCw,
  FileQuestion,
  User,
  ArrowRight,
  Sliders,
} from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { openSettings } = useAccessibility();
  const navigate = useNavigate();

  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionInProgress, setActionInProgress] = useState(null);

  const fetchExams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAvailableExams();
      setExams(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.message ||
        'Unable to load examination schedule. Please verify connectivity.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleStartOrResume = async (examId) => {
    setActionInProgress(examId);
    try {
      const attempt = await startOrResumeAttempt(examId);
      navigate(`/student/exams/${examId}/take`, { state: { attempt } });
    } catch (err) {
      alert(
        err.response?.data?.detail ||
        err.message ||
        'Failed to enter examination session.'
      );
      // Refresh exam listing to update statuses
      fetchExams();
    } finally {
      setActionInProgress(null);
    }
  };

  // Helper date formatter
  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  // Compute stat summary metrics
  const stats = useMemo(() => {
    const totalAttempted = exams.filter(
      (e) => e.attempt_status === 'submitted' || e.attempt_status === 'expired'
    ).length;
    const readyNow = exams.filter(
      (e) => e.is_available && e.attempt_status !== 'in_progress'
    ).length;
    const inProgress = exams.filter(
      (e) => e.attempt_status === 'in_progress'
    ).length;
    const upcoming = exams.filter((e) => e.is_upcoming).length;

    return { totalAttempted, readyNow, inProgress, upcoming };
  }, [exams]);

  // Client-side filtering & searching
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exam.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exam.teacher_name && exam.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'available') return exam.is_available;
      if (statusFilter === 'in_progress') return exam.attempt_status === 'in_progress';
      if (statusFilter === 'upcoming') return exam.is_upcoming;
      if (statusFilter === 'completed') {
        return (
          exam.attempt_status === 'submitted' ||
          exam.attempt_status === 'expired' ||
          exam.is_completed
        );
      }
      return true;
    });
  }, [exams, searchQuery, statusFilter]);

  return (
    <main id="main-content" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800 p-8 sm:p-10 shadow-2xl mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
              Student Examination Portal
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Welcome back, {user?.name || 'Student'}!
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
              Access your digital examinations, monitor active sessions, and review completed assessments under an accessible, distraction-free environment.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <button
              onClick={openSettings}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              aria-label="Open accessibility settings dialog"
            >
              <Sliders className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              <span>Accessibility</span>
            </button>
            <button
              onClick={fetchExams}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 hover:text-white font-medium text-sm border border-slate-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60"
              aria-label="Refresh examination list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {/* Available Right Now */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-5 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Now</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">{stats.readyNow}</div>
          <p className="text-xs text-slate-500 mt-1">Ready for you to start</p>
        </div>

        {/* Ongoing / In Progress */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-5 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">In Progress</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <PlayCircle className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">{stats.inProgress}</div>
          <p className="text-xs text-slate-500 mt-1">Active attempts to resume</p>
        </div>

        {/* Upcoming */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-5 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Upcoming</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Calendar className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">{stats.upcoming}</div>
          <p className="text-xs text-slate-500 mt-1">Scheduled for future dates</p>
        </div>

        {/* Completed Attempts */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-5 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Award className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">{stats.totalAttempted}</div>
          <p className="text-xs text-slate-500 mt-1">Total attempted exams</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <label htmlFor="exam-search" className="sr-only">
              Search examinations by title, subject, or instructor
            </label>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="exam-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, subject, or instructor..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0" role="tablist" aria-label="Filter examinations">
            {[
              { id: 'all', label: 'All Exams' },
              { id: 'available', label: 'Available' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'completed', label: 'Completed' },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-950/30 border border-rose-800/50 p-6 text-rose-300 mb-8 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="text-sm font-bold text-rose-200">Unable to load examinations</h2>
            <p className="text-xs text-rose-300 mt-1">{error}</p>
            <button
              onClick={fetchExams}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-200 underline hover:text-white"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div aria-live="polite" aria-busy="true" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 animate-pulse space-y-4">
              <div className="flex justify-between items-center">
                <div className="w-20 h-5 bg-slate-800 rounded-full" />
                <div className="w-24 h-5 bg-slate-800 rounded-full" />
              </div>
              <div className="w-3/4 h-6 bg-slate-800 rounded" />
              <div className="w-1/2 h-4 bg-slate-800 rounded" />
              <div className="space-y-2 pt-2">
                <div className="w-full h-4 bg-slate-800 rounded" />
                <div className="w-2/3 h-4 bg-slate-800 rounded" />
              </div>
              <div className="w-full h-10 bg-slate-800 rounded-xl pt-4" />
            </div>
          ))}
        </div>
      )}

      {/* Exam Cards Grid */}
      {!isLoading && !error && filteredExams.length > 0 && (
        <section aria-label="Available examinations list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map((exam) => {
            const isActing = actionInProgress === exam.id;

            return (
              <article
                key={exam.id}
                className="flex flex-col justify-between rounded-2xl bg-slate-900/90 border border-slate-800/90 p-6 hover:border-slate-700 transition-all shadow-md hover:shadow-xl relative overflow-hidden group"
              >
                {/* Card Top: Subject & Status Badge */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <BookOpen className="w-3 h-3" aria-hidden="true" />
                      {exam.subject}
                    </span>

                    {/* Status Badge */}
                    {exam.attempt_status === 'in_progress' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                        <PlayCircle className="w-3 h-3" aria-hidden="true" />
                        In Progress
                      </span>
                    ) : exam.attempt_status === 'submitted' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                        Submitted
                      </span>
                    ) : exam.attempt_status === 'expired' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertCircle className="w-3 h-3" aria-hidden="true" />
                        Expired
                      </span>
                    ) : exam.is_available ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                        Available Now
                      </span>
                    ) : exam.is_upcoming ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        Upcoming
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        Closed
                      </span>
                    )}
                  </div>

                  {/* Title & Instructor */}
                  <h2 className="text-xl font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                    {exam.title}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 mb-4">
                    <User className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>Teacher: <strong className="text-slate-300">{exam.teacher_name || 'Instructor'}</strong></span>
                  </div>

                  {/* Description if present */}
                  {exam.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                      {exam.description}
                    </p>
                  )}

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/80 text-xs mb-4">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Duration</span>
                      <span className="font-semibold text-slate-200 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                        {exam.duration_minutes}m
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Total Marks</span>
                      <span className="font-semibold text-slate-200 flex items-center gap-1 mt-0.5">
                        <Award className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                        {exam.total_marks}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Questions</span>
                      <span className="font-semibold text-slate-200 flex items-center gap-1 mt-0.5">
                        <FileQuestion className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                        {exam.questions_count}
                      </span>
                    </div>
                  </div>

                  {/* Schedule Details */}
                  <div className="space-y-1.5 text-xs text-slate-400 mb-6 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Opens:</span>
                      <span className="font-mono text-slate-300 text-[11px]">{formatDateTime(exam.start_time)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Closes:</span>
                      <span className="font-mono text-slate-300 text-[11px]">{formatDateTime(exam.end_time)}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="pt-2">
                  {exam.can_resume ? (
                    <button
                      onClick={() => handleStartOrResume(exam.id)}
                      disabled={isActing}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm shadow-lg shadow-amber-600/20 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-60"
                      aria-label={`Continue examination: ${exam.title}`}
                    >
                      <PlayCircle className="w-4 h-4" aria-hidden="true" />
                      <span>{isActing ? 'Resuming Session...' : 'Continue Exam'}</span>
                    </button>
                  ) : exam.can_start ? (
                    <button
                      onClick={() => handleStartOrResume(exam.id)}
                      disabled={isActing}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60"
                      aria-label={`Start examination: ${exam.title}`}
                    >
                      <span>{isActing ? 'Entering Session...' : 'Start Exam'}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  ) : exam.attempt_status === 'submitted' ? (
                    <div
                      className="w-full py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-400 text-center text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                      <span>Examination Completed</span>
                    </div>
                  ) : exam.attempt_status === 'expired' ? (
                    <div
                      className="w-full py-2.5 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-400 text-center text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Attempt Expired</span>
                    </div>
                  ) : exam.is_upcoming ? (
                    <div
                      className="w-full py-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-slate-400 text-center text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                      <span>Not Started Yet</span>
                    </div>
                  ) : (
                    <div
                      className="w-full py-2.5 rounded-xl bg-slate-800/30 border border-slate-800 text-slate-500 text-center text-xs font-medium"
                    >
                      Exam Closed
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredExams.length === 0 && (
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-12 text-center max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400">
            <BookOpen className="w-7 h-7" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No examinations found</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {searchQuery || statusFilter !== 'all'
              ? 'No examinations matched your active filter or search term. Try resetting your search query.'
              : 'There are currently no published examinations scheduled for your student profile.'}
          </p>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </main>
  );
}
