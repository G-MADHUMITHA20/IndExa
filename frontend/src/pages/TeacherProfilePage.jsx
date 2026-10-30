import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  ShieldCheck,
  Mail,
  Calendar,
  LogOut,
  CheckCircle2,
  Lock,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TeacherLayout from '../components/TeacherLayout';

export default function TeacherProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <TeacherLayout>
      <main id="main-content" className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <User className="w-6 h-6 text-indigo-400" aria-hidden="true" />
            Faculty Profile & Security
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review authorized faculty permissions, institutional identity, and session parameters.
          </p>
        </div>

        {/* Profile Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center text-2xl font-bold uppercase">
              {user?.name ? user.name[0] : 'T'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.name || 'Faculty Member'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 capitalize flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  {user?.role || 'teacher'} Role
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Verified Active
                </span>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <dt className="text-slate-400 flex items-center gap-1.5 mb-1">
                <Mail className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                Institutional Email
              </dt>
              <dd className="font-mono font-semibold text-white break-all">{user?.email || 'N/A'}</dd>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <dt className="text-slate-400 flex items-center gap-1.5 mb-1">
                <Calendar className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                Member Since
              </dt>
              <dd className="font-semibold text-white">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </dd>
            </div>
          </dl>

          {/* Permissions Overview */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Enforced Role Privileges
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              <li className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" />
                <span>Create, edit, and delete examination drafts</span>
              </li>
              <li className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
                <span>Author and sequence MCQ, written & math questions</span>
              </li>
              <li className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Publish verified assessments to the student roster</span>
              </li>
              <li className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <span>Close active examination windows</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign Out of Faculty Portal</span>
            </button>
          </div>
        </div>
      </main>
    </TeacherLayout>
  );
}
