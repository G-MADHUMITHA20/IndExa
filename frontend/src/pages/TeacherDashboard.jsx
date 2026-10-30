import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Briefcase,
  LogOut,
  PlusCircle,
  FileSpreadsheet,
  ShieldCheck,
  Info,
  CheckCircle2,
  Users,
} from 'lucide-react';

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <main id="main-content" className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-purple-950/50 to-slate-900 border border-slate-800 p-8 sm:p-10 shadow-2xl mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider">
              <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
              Faculty & Teacher Portal
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Welcome, {user?.name || 'Instructor'}!
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl">
              You are authenticated with Faculty privileges under IndExa Role-Based Access Control.
            </p>
          </div>

          <div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-rose-400 hover:text-rose-300 font-medium text-sm border border-slate-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
              aria-label="Sign out of teacher account"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Account Details Card */}
        <section aria-labelledby="teacher-security-heading" className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6">
          <h2 id="teacher-security-heading" className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" aria-hidden="true" />
            Faculty Profile
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-400">Instructor Name</dt>
              <dd className="font-semibold text-slate-200">{user?.name || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Institutional Email</dt>
              <dd className="font-mono text-slate-200 break-all">{user?.email || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Privilege Level</dt>
              <dd className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 capitalize">
                {user?.role || 'teacher'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Account Status</dt>
              <dd className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Authorized Faculty
              </dd>
            </div>
          </dl>
        </section>

        {/* Phase 2 Feature Roadmap Notice (Required by specifications) */}
        <section aria-labelledby="teacher-roadmap-heading" className="md:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Info className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="teacher-roadmap-heading" className="text-lg font-bold text-white">
                Upcoming Examination Authoring Suite
              </h2>
              <p className="text-xs text-slate-400">Phase 2: Authentication milestone complete</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 mb-6">
            <p className="text-sm text-slate-300 leading-relaxed">
              <strong className="text-white">Notice:</strong> The examination creation dashboard, question bank authoring tools, rubric configurations, and student submission grading views will be implemented in subsequent phases.
            </p>
          </div>

          <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-3">
            Scheduled Faculty Capabilities
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
            <li className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <PlusCircle className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" />
              <span>Assessment & Exam Paper Authoring</span>
            </li>
            <li className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <Users className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
              <span>Class Roster & Student Accommodation Settings</span>
            </li>
            <li className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>Rubric Builder & Automated Marking Setup</span>
            </li>
            <li className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <span>Integrity Audit Logs & Proctoring Controls</span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
