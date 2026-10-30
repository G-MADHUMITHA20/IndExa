import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UnauthorizedPage() {
  const { user } = useAuth();
  const dashboardLink = user?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';

  return (
    <main
      id="main-content"
      className="flex-1 max-w-2xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 text-amber-400">
        <ShieldAlert className="w-8 h-8" aria-hidden="true" />
      </div>

      <h1 className="text-3xl font-extrabold text-white tracking-tight mb-3">
        Access Restricted
      </h1>

      <p className="text-slate-400 text-base max-w-lg mb-6">
        You do not have the required role privileges to access this area. Your current account is authenticated as{' '}
        <span className="font-semibold text-indigo-400 capitalize">{user?.role || 'user'}</span>.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          to={dashboardLink}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Go to My Dashboard
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          Home
        </Link>
      </div>
    </main>
  );
}
