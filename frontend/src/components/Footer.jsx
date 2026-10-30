import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div>
          <p>© 2026 IndExa Project. Designed for universal accessibility and fair evaluation.</p>
        </div>
        <div className="flex items-center gap-6">
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
            FastAPI + MongoDB + React
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">WCAG 2.1 Compliant Architecture</span>
        </div>
      </div>
    </footer>
  );
}
