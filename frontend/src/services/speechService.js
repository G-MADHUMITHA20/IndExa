/**
 * IndExa Speech Synthesis Service
 * Provides text-to-speech capabilities using the browser Web Speech API.
 * Designed for accessibility and assistive reading for visually impaired students.
 */

class SpeechService {
  constructor() {
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.voices = [];
    this.activeUtterance = null;
    this.isSpeakingState = false;
    this.isPausedState = false;
    this.subscribers = new Set();

    if (this.synth) {
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  /**
   * Check whether the browser supports SpeechSynthesis.
   */
  isSupported() {
    return Boolean(this.synth);
  }

  /**
   * Populate available system voices.
   */
  loadVoices() {
    if (!this.synth) return [];
    this.voices = this.synth.getVoices() || [];
    return this.voices;
  }

  /**
   * Get list of currently loaded voices.
   */
  getVoices() {
    if (!this.voices || this.voices.length === 0) {
      this.loadVoices();
    }
    return this.voices;
  }

  /**
   * Register a state change subscriber (for UI speaking indicators).
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    const state = {
      isSpeaking: this.isSpeakingState,
      isPaused: this.isPausedState,
      supported: this.isSupported(),
    };
    this.subscribers.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.error('Speech state subscriber error:', err);
      }
    });
  }

  /**
   * Speak arbitrary text with configuration options.
   * Cancels any prior active speech to prevent overlapping.
   */
  speak(text, options = {}) {
    if (!this.synth) {
      if (options.onError) {
        options.onError(new Error('SpeechSynthesis is not supported in this browser.'));
      }
      return;
    }

    if (!text || !text.trim()) {
      if (options.onEnd) options.onEnd();
      return;
    }

    // Cancel any existing utterance before starting new speech
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    this.activeUtterance = utterance;

    // Apply speech configuration
    const rate = typeof options.rate === 'number' ? Math.max(0.5, Math.min(2.0, options.rate)) : 1.0;
    const volume = typeof options.volume === 'number' ? Math.max(0.0, Math.min(1.0, options.volume)) : 1.0;

    utterance.rate = rate;
    utterance.volume = volume;

    // Match preferred voice by name
    if (options.voiceName && this.voices.length > 0) {
      const match = this.voices.find((v) => v.name === options.voiceName);
      if (match) {
        utterance.voice = match;
      }
    }

    utterance.onstart = () => {
      this.isSpeakingState = true;
      this.isPausedState = false;
      this.notifySubscribers();
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      this.isSpeakingState = false;
      this.isPausedState = false;
      this.activeUtterance = null;
      this.notifySubscribers();
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = (event) => {
      // Ignore normal cancellation errors
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        console.warn('Speech synthesis utterance error:', event.error);
      }
      this.isSpeakingState = false;
      this.isPausedState = false;
      this.activeUtterance = null;
      this.notifySubscribers();
      if (options.onError) options.onError(event);
    };

    try {
      this.synth.speak(utterance);
    } catch (err) {
      this.isSpeakingState = false;
      this.isPausedState = false;
      this.notifySubscribers();
      if (options.onError) options.onError(err);
    }
  }

  /**
   * Pause ongoing speech synthesis.
   */
  pause() {
    if (this.synth && this.isSpeakingState && !this.isPausedState) {
      this.synth.pause();
      this.isPausedState = true;
      this.notifySubscribers();
    }
  }

  /**
   * Resume paused speech synthesis.
   */
  resume() {
    if (this.synth && this.isPausedState) {
      this.synth.resume();
      this.isPausedState = false;
      this.notifySubscribers();
    }
  }

  /**
   * Stop all ongoing speech immediately.
   */
  stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (err) {
        console.warn('Speech cancel error:', err);
      }
      this.isSpeakingState = false;
      this.isPausedState = false;
      this.activeUtterance = null;
      this.notifySubscribers();
    }
  }

  /**
   * Cleanup method when unmounting pages or components.
   */
  cleanUp() {
    this.stop();
  }

  /* ========================================================================
     Formatted Academic Speech Generators
     ======================================================================== */

  /**
   * Format question prompt, question type, and MCQ options for clear readback.
   */
  formatQuestionForSpeech(question, index = 0, total = 1) {
    if (!question) return 'No question selected.';

    const parts = [
      `Question ${index + 1} of ${total}.`,
      `Allocated marks: ${question.marks} mark${question.marks === 1 ? '' : 's'}.`,
      `Question: ${question.question_text}`,
    ];

    if (question.question_type === 'mcq' && Array.isArray(question.options)) {
      parts.push(`This is a multiple-choice question with ${question.options.length} options.`);
      const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      question.options.forEach((opt, optIdx) => {
        const letter = optionLetters[optIdx] || String(optIdx + 1);
        parts.push(`Option ${letter}: ${opt}.`);
      });
      parts.push('Select one option to record your response.');
    } else if (question.question_type === 'short_answer') {
      parts.push('This is a short answer question. A text entry area is provided. You may press Alt + E to begin typing your answer, and Alt + A to hear your answer read back.');
    } else if (question.question_type === 'long_answer') {
      parts.push('This is a descriptive long answer question. An extended text area is provided. You may press Alt + E to edit your answer, and Alt + A to verify your answer draft.');
    } else if (question.question_type === 'mathematical') {
      parts.push('This is a mathematical expression question. Enter your formula or text-based steps in the text area below.');
    }

    return parts.join(' ');
  }

  /**
   * Format current answer draft for verification readback.
   */
  formatAnswerForSpeech(answerText, questionType = '') {
    if (!answerText || !answerText.trim()) {
      return 'You have not entered an answer for this question yet.';
    }

    const cleaned = answerText.trim();
    const suffix = /[.!?]$/.test(cleaned) ? '' : '.';

    if (questionType === 'mcq') {
      return `Your selected option is: ${cleaned}${suffix}`;
    }

    return `Your current drafted answer is: ${cleaned}${suffix}`;
  }

  /**
   * Spoken narrative of comprehensive examination instructions and keyboard shortcuts.
   */
  formatInstructionsForSpeech(exam, questionsCount = 0) {
    if (!exam) return 'No examination details available.';

    return [
      `Welcome to the examination for ${exam.title}, subject: ${exam.subject}.`,
      `The total duration permitted for this session is ${exam.duration_minutes} minutes.`,
      `There are ${questionsCount} questions in this assessment, for a total of ${exam.total_marks} marks.`,
      'Examination guidelines:',
      'First: Your answers are automatically saved to the database in real time as you edit them, and whenever you change questions.',
      'Second: You can move between questions using the Next and Previous buttons, or by pressing Alt + Right Arrow and Alt + Left Arrow.',
      'Third: To hear the current question read aloud at any time, press Alt + R.',
      'Fourth: To hear your currently drafted answer read back to you, press Alt + A.',
      'Fifth: To focus the answer input area immediately, press Alt + E.',
      'Sixth: When you are finished, press Alt + S or click the Submit button to review and confirm your final submission.',
      'Seventh: You may pause speech, stop speech, or adjust your speech rate and volume at any time from the accessibility controls.',
      'You are now ready to begin.',
    ].join(' ');
  }
}

export const formatQuestionForSpeech = (question, index = 0, total = 1) =>
  speechService.formatQuestionForSpeech(question, index, total);
export const formatAnswerForSpeech = (answerText, questionType = '') =>
  speechService.formatAnswerForSpeech(answerText, questionType);
export const formatInstructionsForSpeech = (exam, questionsCount = 0) =>
  speechService.formatInstructionsForSpeech(exam, questionsCount);

export const speechService = new SpeechService();
export default speechService;
