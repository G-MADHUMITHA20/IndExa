import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  Search,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getExams } from '../services/api';
import TeacherLayout from '../components/TeacherLayout';
import StatusBadge from '../components/StatusBadge';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchDashboardExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExams();
      setExams(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load exams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardExams();
  }, [fetchDashboardExams]);

  // Statistics calculation
  const totalExams = exams.length;
  const publishedExams = exams.filter((e) => e.status === 'published').length;
  const draftExams = exams.filter((e) => e.status === 'draft').length;
  const closedExams = exams.filter((e) => e.status === 'closed').length;

  // Filter exams for the table
  const filteredExams = exams.filter((exam) => {
    const matchesStatus = statusFilter === 'all' || exam.status === statusFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <TeacherLayout>
      <main id="main-content" className="space-y-8">
        {/* Welcome Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Faculty Administration
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Welcome back, {user?.name || 'Instructor'}!
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl">
                Manage your academic examinations, configure question formats, and monitor assessment lifecycle states.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/teacher/exams/create"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <PlusCircle className="w-4 h-4" aria-hidden="true" />
                <span>Create New Exam</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards Grid */}
        <section aria-labelledby="stats-heading" className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <h2 id="stats-heading" className="sr-only">Examination Statistics</h2>

          {/* Total Exams */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Exams</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{totalExams}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <FileText className="w-6 h-6" aria-hidden="true" />
            </div>
          </div>

          {/* Published Exams */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Published</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1">{publishedExams}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
          </div>

          {/* Draft Exams */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Drafts</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1">{draftExams}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-6 h-6" aria-hidden="true" />
            </div>
          </div>

          {/* Closed Exams */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Closed</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-400 mt-1">{closedExams}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* Recent Exams Section with Search & Filter */}
        <section aria-labelledby="recent-exams-heading" className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 id="recent-exams-heading" className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" aria-hidden="true" />
                Exam Management Overview
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Filter, inspect, and transition active assessment states</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchDashboardExams}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500"
                aria-label="Refresh exam list"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
              <Link
                to="/teacher/exams"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                <span>View Full List</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search by title or subject code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Search exams"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs overflow-x-auto">
              {['all', 'draft', 'published', 'closed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div role="alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Table / List */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mb-2" aria-hidden="true" />
              <span>Loading examination records...</span>
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 p-8 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-slate-300">No exams found matching your filter</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Get started by creating your first digital assessment paper.
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th scope="col" className="pb-3 pr-4">Exam Title</th>
                    <th scope="col" className="pb-3 px-4">Subject</th>
                    <th scope="col" className="pb-3 px-4">Duration</th>
                    <th scope="col" className="pb-3 px-4">Marks</th>
                    <th scope="col" className="pb-3 px-4">Questions</th>
                    <th scope="col" className="pb-3 px-4">Status</th>
                    <th scope="col" className="pb-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredExams.slice(0, 8).map((exam) => (
                    <tr key={exam.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 pr-4 font-semibold text-white">
                        <Link
                          to={`/teacher/exams/${exam.id}`}
                          className="hover:text-indigo-400 focus-visible:underline focus-visible:outline-none"
                        >
                          {exam.title}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">{exam.subject}</td>
                      <td className="py-3.5 px-4 text-slate-400">{exam.duration_minutes} mins</td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {exam.current_marks_total} / {exam.total_marks}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{exam.questions_count} Qs</td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={exam.status} />
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/teacher/exams/${exam.id}`}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          >
                            Details
                          </Link>
                          {exam.status === 'draft' && (
                            <Link
                              to={`/teacher/exams/${exam.id}/questions`}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors"
                            >
                              Questions
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </TeacherLayout>
  );
}
