import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStudentPreferences, updateStudentPreferences } from '../services/api';
import { speechService } from '../services/speechService';
import { useAuth } from './AuthContext';

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const { user, isAuthenticated } = useAuth();

  // Accessibility State (defaults)
  const [fontSize, setFontSize] = useState('medium'); // 'small' | 'medium' | 'large' | 'extra-large'
  const [highContrast, setHighContrast] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechVolume, setSpeechVolume] = useState(1.0);
  const [preferredVoice, setPreferredVoice] = useState('');
  const [autoReadQuestions, setAutoReadQuestions] = useState(false);
  const [preferredInputMethod, setPreferredInputMethod] = useState('keyboard');

  // Modals visibility
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);

  // Apply DOM classes whenever font size or high contrast changes
  useEffect(() => {
    const body = document.body;
    if (!body) return;

    // Font size classes
    body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large', 'font-size-extra-large');
    body.classList.add(`font-size-${fontSize}`);

    // High contrast mode class
    if (highContrast) {
      body.classList.add('high-contrast');
    } else {
      body.classList.remove('high-contrast');
    }
  }, [fontSize, highContrast]);

  // Load preferences from backend when authenticated student logs in
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'student') return;

    let isMounted = true;
    async function loadPreferences() {
      setIsLoadingPreferences(true);
      try {
        const pref = await getStudentPreferences();
        if (!isMounted) return;
        if (pref) {
          if (pref.font_size) setFontSize(pref.font_size);
          if (pref.high_contrast !== undefined) setHighContrast(Boolean(pref.high_contrast));
          if (pref.speech_enabled !== undefined) setSpeechEnabled(Boolean(pref.speech_enabled));
          if (typeof pref.speech_rate === 'number') setSpeechRate(pref.speech_rate);
          if (typeof pref.speech_volume === 'number') setSpeechVolume(pref.speech_volume);
          if (pref.preferred_voice) setPreferredVoice(pref.preferred_voice);
          if (pref.auto_read_questions !== undefined) setAutoReadQuestions(Boolean(pref.auto_read_questions));
          if (pref.preferred_input_method) setPreferredInputMethod(pref.preferred_input_method);
        }
      } catch (err) {
        console.warn('Could not load student accessibility preferences, using defaults:', err.message);
      } finally {
        if (isMounted) setIsLoadingPreferences(false);
      }
    }

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.role]);

  // Save updated preferences to MongoDB
  const savePreferences = useCallback(
    async (newPrefs) => {
      // Optimistic state updates
      if (newPrefs.font_size !== undefined) setFontSize(newPrefs.font_size);
      if (newPrefs.high_contrast !== undefined) setHighContrast(newPrefs.high_contrast);
      if (newPrefs.speech_enabled !== undefined) setSpeechEnabled(newPrefs.speech_enabled);
      if (newPrefs.speech_rate !== undefined) setSpeechRate(newPrefs.speech_rate);
      if (newPrefs.speech_volume !== undefined) setSpeechVolume(newPrefs.speech_volume);
      if (newPrefs.preferred_voice !== undefined) setPreferredVoice(newPrefs.preferred_voice);
      if (newPrefs.auto_read_questions !== undefined) setAutoReadQuestions(newPrefs.auto_read_questions);
      if (newPrefs.preferred_input_method !== undefined) setPreferredInputMethod(newPrefs.preferred_input_method);

      if (isAuthenticated && user?.role === 'student') {
        try {
          await updateStudentPreferences(newPrefs);
        } catch (err) {
          console.error('Failed to persist accessibility preferences:', err);
          throw err;
        }
      }
    },
    [isAuthenticated, user?.role]
  );

  const resetDefaults = useCallback(async () => {
    const defaults = {
      font_size: 'medium',
      high_contrast: false,
      speech_enabled: true,
      speech_rate: 1.0,
      speech_volume: 1.0,
      preferred_voice: '',
      auto_read_questions: false,
      preferred_input_method: 'keyboard',
    };
    await savePreferences(defaults);
  }, [savePreferences]);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const openHelp = useCallback(() => setIsHelpOpen(true), []);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);

  const value = {
    fontSize,
    setFontSize,
    highContrast,
    setHighContrast,
    speechEnabled,
    setSpeechEnabled,
    speechRate,
    setSpeechRate,
    speechVolume,
    setSpeechVolume,
    preferredVoice,
    setPreferredVoice,
    autoReadQuestions,
    setAutoReadQuestions,
    preferredInputMethod,
    setPreferredInputMethod,
    isSettingsOpen,
    openSettings,
    closeSettings,
    isHelpOpen,
    openHelp,
    closeHelp,
    savePreferences,
    resetDefaults,
    isLoadingPreferences,
    speechService,
  };

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
