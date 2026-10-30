import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  Database, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Cpu, 
  Accessibility, 
  ShieldCheck,
  LogIn,
  UserPlus
} from 'lucide-react';
import { getHealthStatus } from '../services/api';

export default function WelcomePage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await getHealthStatus();
      if (result.success) {
        setHealthData(result.data);
      } else {
        setErrorMsg(result.error);
        setHealthData(null);
      }
    } catch {
      setErrorMsg('Unexpected error contacting API server');
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const isDbConnected = healthData?.database?.status === 'connected';

  return (
    <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Hero Section */}
      <section aria-labelledby="hero-heading" className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/70 border border-indigo-700/50 text-indigo-300 text-xs font-semibold mb-6 shadow-sm">
          <Accessibility className="w-4 h-4 text-indigo-400" aria-hidden="true" />
          <span>Inclusive Assessment Technology</span>
        </div>

        <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
          IndExa Platform
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-300">
            Accessible Digital Examinations
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8">
          A modern digital examination environment engineered from the ground up for universal accessibility, 
          transparent integrity, and seamless assistive technologies.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>Sign In</span>
          </Link>

          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all hover:text-white"
          >
            <UserPlus className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            <span>Register as Student</span>
          </Link>

          <button
            onClick={fetchHealth}
            disabled={loading}
            aria-label="Refresh system health diagnostics"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-medium text-sm border border-slate-700/80 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{loading ? 'Testing...' : 'Test Backend & DB'}</span>
          </button>
        </div>

      </section>

      {/* Live System Diagnostics Box */}
      <section 
        aria-labelledby="diagnostics-heading" 
        className="mb-16 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 id="diagnostics-heading" className="text-xl font-bold text-white flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-indigo-400" aria-hidden="true" />
              Platform Diagnostics & Health Check
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Live status check verifying FastAPI service endpoint and MongoDB connectivity.
            </p>
          </div>
          <div aria-live="polite" className="flex items-center gap-2">
            {loading ? (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Checking Status...
              </span>
            ) : healthData ? (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                isDbConnected 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {isDbConnected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <span>System Healthy</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                    <span>API Online (DB Degraded)</span>
                  </>
                )}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
                <span>Backend Offline</span>
              </span>
            )}
          </div>
        </div>

        {/* Diagnostics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* FastAPI Card */}
          <article className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                Backend API
              </span>
              <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                healthData ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {healthData ? 'Online' : 'Unreachable'}
              </span>
            </div>
            <p className="text-lg font-semibold text-white">
              {healthData ? healthData.service : 'FastAPI Server'}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Port: 8000 | Endpoint: /health
            </p>
          </article>

          {/* MongoDB Card */}
          <article className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                MongoDB Storage
              </span>
              <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                isDbConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {isDbConnected ? 'Connected' : 'Offline / Degraded'}
              </span>
            </div>
            <p className="text-lg font-semibold text-white">
              {healthData?.database?.database || 'indexa_db'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {healthData?.database?.message || (errorMsg ? 'API offline' : 'Pending check...')}
            </p>
          </article>

          {/* Frontend Environment Card */}
          <article className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-violet-400" aria-hidden="true" />
                Frontend Runtime
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-indigo-500/20 text-indigo-300">
                Active
              </span>
            </div>
            <p className="text-lg font-semibold text-white">React + Vite</p>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Tailwind CSS + React Router + Axios
            </p>
          </article>
        </div>

        {errorMsg && (
          <div role="alert" className="mt-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-200 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Backend communication error</p>
              <p className="text-xs text-rose-300 mt-0.5">{errorMsg}</p>
              <p className="text-xs text-slate-400 mt-2 font-mono">
                Hint: Start the backend server via <code className="text-indigo-300">uvicorn app.main:app --reload</code>
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Architecture Pillars */}
      <section aria-labelledby="pillars-heading" className="mb-16">
        <h2 id="pillars-heading" className="text-2xl font-bold text-white mb-8 text-center">
          Prototype Architectural Foundations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-5">
              <Accessibility className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Universal Accessibility</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Designed according to WCAG 2.1 guidelines. Features visible focus rings, semantic landmark structures, high-contrast typography, and full keyboard navigation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-5">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Modular Asynchronous Backend</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              FastAPI backend built with asynchronous I/O and PyMongo/Motor driver integration, ensuring resilient non-blocking evaluation pipelines and secure credential management.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-5">
              <Database className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Flexible Document Schema</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              MongoDB architecture prepared for scalable storage of assessment configurations, candidate submissions, timing telemetry, and accessibility preferences.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
