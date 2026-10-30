import React from 'react';
import { Clock, CheckCircle2, Lock } from 'lucide-react';

export default function StatusBadge({ status }) {
  const normalized = (status || 'draft').toLowerCase();

  switch (normalized) {
    case 'published':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          Published
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          Closed
        </span>
      );
    case 'draft':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          Draft
        </span>
      );
  }
}
