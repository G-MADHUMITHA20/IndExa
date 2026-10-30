import React, { useEffect, useRef } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { Keyboard, X, Info } from 'lucide-react';

export default function KeyboardShortcutsHelpModal() {
  const { isHelpOpen, closeHelp } = useAccessibility();
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isHelpOpen) {
        closeHelp();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHelpOpen, closeHelp]);

  if (!isHelpOpen) return null;

  const shortcuts = [
    { key: 'Alt + R', action: 'Read current question aloud', status: 'active' },
    { key: 'Alt + A', action: 'Read current answer draft aloud (Readback)', status: 'active' },
    { key: 'Alt + E', action: 'Focus answer editing text area / control', status: 'active' },
    { key: 'Alt + Left Arrow', action: 'Navigate to previous question', status: 'active' },
    { key: 'Alt + Right Arrow', action: 'Navigate to next question', status: 'active' },
    { key: 'Alt + S', action: 'Open submission confirmation modal', status: 'active' },
    { key: 'Alt + V', action: 'Voice input activation (Reserved for Prompt 6)', status: 'reserved' },
    { key: 'Alt + Enter', action: 'Explicit answer confirmation (Reserved for Prompt 7)', status: 'reserved' },
    { key: 'Escape', action: 'Close dialogs, cancel alerts, or stop speech', status: 'active' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div
        ref={modalRef}
        className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Keyboard className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="keyboard-help-title" className="text-xl font-bold text-white">
                Keyboard Navigation & Shortcuts
              </h2>
              <p className="text-xs text-slate-400">
                Assistive hotkeys for hands-free and keyboard-driven exam taking.
              </p>
            </div>
          </div>

          <button
            onClick={closeHelp}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500"
            aria-label="Close keyboard shortcuts dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Shortcuts Table */}
        <div className="space-y-2.5">
          {shortcuts.map((sc, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                sc.status === 'reserved'
                  ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                  : 'bg-slate-950/80 border-slate-800 text-slate-200'
              }`}
            >
              <kbd className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono text-[11px] font-bold text-indigo-300 tracking-wider shadow-sm">
                {sc.key}
              </kbd>
              <span className="font-medium text-right flex items-center gap-2">
                <span>{sc.action}</span>
                {sc.status === 'reserved' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    Reserved
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" aria-hidden="true" />
          <p className="leading-relaxed">
            Shortcuts with the <strong>Alt</strong> key are active globally and will not interfere with normal typing inside text boxes. You can also use standard <strong>Tab</strong>, <strong>Shift + Tab</strong>, and <strong>Enter</strong> navigation.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={closeHelp}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
