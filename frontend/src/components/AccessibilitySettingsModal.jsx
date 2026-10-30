import React, { useState, useEffect, useRef } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  Volume2,
  Sliders,
  Type,
  Sun,
  Keyboard,
  Mic,
  Check,
  X,
  RotateCcw,
  Play,
  Square,
  AlertCircle,
} from 'lucide-react';

export default function AccessibilitySettingsModal() {
  const {
    fontSize,
    highContrast,
    speechEnabled,
    speechRate,
    speechVolume,
    preferredVoice,
    autoReadQuestions,
    preferredInputMethod,
    isSettingsOpen,
    closeSettings,
    savePreferences,
    resetDefaults,
    speechService,
  } = useAccessibility();

  // Local editing state
  const [localFontSize, setLocalFontSize] = useState(fontSize);
  const [localHighContrast, setLocalHighContrast] = useState(highContrast);
  const [localSpeechEnabled, setLocalSpeechEnabled] = useState(speechEnabled);
  const [localSpeechRate, setLocalSpeechRate] = useState(speechRate);
  const [localSpeechVolume, setLocalSpeechVolume] = useState(speechVolume);
  const [localPreferredVoice, setLocalPreferredVoice] = useState(preferredVoice);
  const [localAutoReadQuestions, setLocalAutoReadQuestions] = useState(autoReadQuestions);
  const [localInputMethod, setLocalInputMethod] = useState(preferredInputMethod);

  const [availableVoices, setAvailableVoices] = useState([]);
  const [activeTab, setActiveTab] = useState('display'); // 'display' | 'speech' | 'input'
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isTestingSpeech, setIsTestingSpeech] = useState(false);

  const modalRef = useRef(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      setLocalFontSize(fontSize);
      setLocalHighContrast(highContrast);
      setLocalSpeechEnabled(speechEnabled);
      setLocalSpeechRate(speechRate);
      setLocalSpeechVolume(speechVolume);
      setLocalPreferredVoice(preferredVoice);
      setLocalAutoReadQuestions(autoReadQuestions);
      setLocalInputMethod(preferredInputMethod);
      setStatusMessage('');

      const voices = speechService.getVoices();
      setAvailableVoices(voices);

      // Focus first tab on modal open
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector('button, [href], input, select, textarea');
        if (firstFocusable) firstFocusable.focus();
      }, 50);
    }
  }, [
    isSettingsOpen,
    fontSize,
    highContrast,
    speechEnabled,
    speechRate,
    speechVolume,
    preferredVoice,
    autoReadQuestions,
    preferredInputMethod,
    speechService,
  ]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        speechService.stop();
        closeSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, closeSettings, speechService]);

  if (!isSettingsOpen) return null;

  const handleTestSpeech = () => {
    if (!speechService.isSupported()) {
      setStatusMessage('Speech Synthesis is not supported in this browser.');
      return;
    }

    if (isTestingSpeech) {
      speechService.stop();
      setIsTestingSpeech(false);
      return;
    }

    setIsTestingSpeech(true);
    speechService.speak(
      'This is a speech preview with your current voice, rate, and volume settings.',
      {
        rate: localSpeechRate,
        volume: localSpeechVolume,
        voiceName: localPreferredVoice,
        onEnd: () => setIsTestingSpeech(false),
        onError: () => setIsTestingSpeech(false),
      }
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      await savePreferences({
        font_size: localFontSize,
        high_contrast: localHighContrast,
        speech_enabled: localSpeechEnabled,
        speech_rate: localSpeechRate,
        speech_volume: localSpeechVolume,
        preferred_voice: localPreferredVoice,
        auto_read_questions: localAutoReadQuestions,
        preferred_input_method: localInputMethod,
      });

      setStatusMessage('Accessibility preferences successfully saved.');

      if (localSpeechEnabled && speechService.isSupported()) {
        speechService.speak('Accessibility preferences saved successfully.', {
          rate: localSpeechRate,
          volume: localSpeechVolume,
          voiceName: localPreferredVoice,
        });
      }

      setTimeout(() => {
        closeSettings();
      }, 800);
    } catch {
      setStatusMessage('Failed to persist preferences. Changes are applied locally for this session.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    await resetDefaults();
    setLocalFontSize('medium');
    setLocalHighContrast(false);
    setLocalSpeechEnabled(true);
    setLocalSpeechRate(1.0);
    setLocalSpeechVolume(1.0);
    setLocalPreferredVoice('');
    setLocalAutoReadQuestions(false);
    setLocalInputMethod('keyboard');
    setStatusMessage('Preferences restored to system defaults.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div
        ref={modalRef}
        className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sliders className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="accessibility-settings-title" className="text-xl font-bold text-white">
                Accessibility & Assistive Settings
              </h2>
              <p className="text-xs text-slate-400">
                Customize your display, text-to-speech, and navigation preferences.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              speechService.stop();
              closeSettings();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500"
            aria-label="Close accessibility settings"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'display'}
            onClick={() => setActiveTab('display')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'display'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Type className="w-4 h-4" aria-hidden="true" />
            <span>Display & Contrast</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'speech'}
            onClick={() => setActiveTab('speech')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'speech'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Volume2 className="w-4 h-4" aria-hidden="true" />
            <span>Text-to-Speech</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'input'}
            onClick={() => setActiveTab('input')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'input'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Keyboard className="w-4 h-4" aria-hidden="true" />
            <span>Input Methods</span>
          </button>
        </div>

        {/* TAB 1: Display & Contrast */}
        {activeTab === 'display' && (
          <div className="space-y-6" role="tabpanel">
            {/* Font Size Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                Interface Font Size
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'small', label: 'Small', sample: '14px' },
                  { id: 'medium', label: 'Medium (Default)', sample: '16px' },
                  { id: 'large', label: 'Large', sample: '18px' },
                  { id: 'extra-large', label: 'Extra Large', sample: '22px' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLocalFontSize(opt.id)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      localFontSize === opt.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="block font-bold text-xs">{opt.label}</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">Scale: {opt.sample}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* High Contrast Mode */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  <span className="text-sm font-bold text-white">High-Contrast Display Mode</span>
                </div>
                <p className="text-xs text-slate-400">
                  Activates maximum contrast (pure black background, pure white text, yellow indicators) for enhanced legibility.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localHighContrast}
                  onChange={(e) => setLocalHighContrast(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                <span className="sr-only">Toggle high-contrast mode</span>
              </label>
            </div>
          </div>
        )}

        {/* TAB 2: Text-to-Speech Settings */}
        {activeTab === 'speech' && (
          <div className="space-y-6" role="tabpanel">
            {!speechService.isSupported() && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" aria-hidden="true" />
                <span>Notice: Web Speech Synthesis is not supported in this browser. Keyboard and visual controls remain fully functional.</span>
              </div>
            )}

            {/* Speech Enabled Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="space-y-1">
                <span className="text-sm font-bold text-white">Enable Text-to-Speech</span>
                <p className="text-xs text-slate-400">
                  Permits reading questions, examination instructions, and answer drafts aloud.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSpeechEnabled}
                  onChange={(e) => setLocalSpeechEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                <span className="sr-only">Enable text-to-speech</span>
              </label>
            </div>

            {/* Speech Speed / Rate Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="speech-rate-slider" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Reading Speed: {localSpeechRate.toFixed(2)}x
                </label>
                <span className="text-xs text-slate-500">0.5x (Slow) to 2.0x (Fast)</span>
              </div>
              <input
                id="speech-rate-slider"
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={localSpeechRate}
                onChange={(e) => setLocalSpeechRate(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Speech Volume Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="speech-volume-slider" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Speech Volume: {Math.round(localSpeechVolume * 100)}%
                </label>
                <span className="text-xs text-slate-500">0% to 100%</span>
              </div>
              <input
                id="speech-volume-slider"
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={localSpeechVolume}
                onChange={(e) => setLocalSpeechVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Available Voice Dropdown */}
            {availableVoices.length > 0 && (
              <div>
                <label htmlFor="speech-voice-select" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Preferred Speech Voice
                </label>
                <select
                  id="speech-voice-select"
                  value={localPreferredVoice}
                  onChange={(e) => setLocalPreferredVoice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Default System Voice</option>
                  {availableVoices.map((voice, idx) => (
                    <option key={idx} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Auto-read questions toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="space-y-1">
                <span className="text-sm font-bold text-white">Automatic Question Reading</span>
                <p className="text-xs text-slate-400">
                  Automatically speaks the question prompt aloud when navigating to a new question.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localAutoReadQuestions}
                  onChange={(e) => setLocalAutoReadQuestions(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                <span className="sr-only">Toggle automatic question reading</span>
              </label>
            </div>

            {/* Speech Test Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestSpeech}
                disabled={!localSpeechEnabled}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors disabled:opacity-50"
              >
                {isTestingSpeech ? (
                  <>
                    <Square className="w-4 h-4 text-rose-400" aria-hidden="true" />
                    <span>Stop Voice Test</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                    <span>Test Voice Preview</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Input Methods */}
        {activeTab === 'input' && (
          <div className="space-y-6" role="tabpanel">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                Preferred Input Modality
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Keyboard Option (Active) */}
                <button
                  type="button"
                  onClick={() => setLocalInputMethod('keyboard')}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    localInputMethod === 'keyboard'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <Keyboard className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="font-bold text-sm block">Standard Keyboard & Hotkeys</span>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Navigate and type responses with full keyboard accessibility and shortcuts.
                    </span>
                  </div>
                </button>

                {/* Voice Input Option (Reserved for Prompt 6) */}
                <div
                  className="p-4 rounded-2xl border border-slate-800/60 bg-slate-950/40 opacity-75 text-left flex items-start gap-3"
                  aria-disabled="true"
                >
                  <Mic className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-300">Voice Recognition Input</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-bold">
                        Phase 6
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Spoken answer input and assistive voice transcription will be implemented in the next milestone.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status announcement live region */}
        {statusMessage && (
          <div aria-live="polite" className="text-xs font-medium text-indigo-400 bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">
            {statusMessage}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                speechService.stop();
                closeSettings();
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
