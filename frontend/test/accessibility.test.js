import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock Web Speech API environment
class MockSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1.0;
    this.volume = 1.0;
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
  }
}

class MockSpeechSynthesis {
  constructor() {
    this.speaking = false;
    this.paused = false;
    this.utterances = [];
    this.voices = [
      { name: 'Google US English', lang: 'en-US' },
      { name: 'Microsoft David', lang: 'en-US' },
    ];
  }

  getVoices() {
    return this.voices;
  }

  speak(utterance) {
    this.speaking = true;
    this.paused = false;
    this.utterances.push(utterance);
    if (utterance.onstart) utterance.onstart();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  cancel() {
    this.speaking = false;
    this.paused = false;
    this.utterances = [];
  }
}

// Set up globals before importing speechService
globalThis.window = {
  speechSynthesis: new MockSpeechSynthesis(),
};
globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// Dynamic import of speechService
const {
  speechService,
  formatQuestionForSpeech,
  formatAnswerForSpeech,
  formatInstructionsForSpeech,
} = await import('../src/services/speechService.js');

describe('Accessibility & Text-to-Speech Engine (Mocked Browser Environment)', () => {
  beforeEach(() => {
    speechService.stop();
  });

  it('1. Detects browser speech support accurately', () => {
    assert.strictEqual(speechService.isSupported(), true);
    const voices = speechService.getVoices();
    assert.strictEqual(voices.length, 2);
    assert.strictEqual(voices[0].name, 'Google US English');
  });

  it('2. Handles missing browser speech support gracefully without crashing', async () => {
    // Simulate unsupported environment
    const originalSynth = speechService.synth;
    speechService.synth = null;

    assert.strictEqual(speechService.isSupported(), false);
    let errorCalled = false;
    speechService.speak('Test prompt', {
      onError: (err) => {
        errorCalled = true;
        assert.match(err.message, /not supported/);
      },
    });
    assert.strictEqual(errorCalled, true);

    // Restore synth
    speechService.synth = originalSynth;
  });

  it('3. Formats MCQ questions with numbered index, marks, and Option letters (A, B, C)', () => {
    const mcqQuestion = {
      id: 'q1',
      question_type: 'mcq',
      marks: 2,
      question_text: 'What is the capital of France?',
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
    };

    const spokenText = formatQuestionForSpeech(mcqQuestion, 0, 5);
    assert.match(spokenText, /Question 1 of 5/);
    assert.match(spokenText, /Allocated marks: 2 marks/);
    assert.match(spokenText, /What is the capital of France\?/);
    assert.match(spokenText, /Option A: London/);
    assert.match(spokenText, /Option B: Paris/);
    assert.match(spokenText, /Option C: Berlin/);
    assert.match(spokenText, /Option D: Madrid/);
  });

  it('4. Formats short and long answer questions with assistive input guidance', () => {
    const shortQ = {
      id: 'q2',
      question_type: 'short_answer',
      marks: 3,
      question_text: 'Define polymorphism in object-oriented programming.',
    };

    const text = formatQuestionForSpeech(shortQ, 1, 5);
    assert.match(text, /Question 2 of 5/);
    assert.match(text, /short answer question/);
    assert.match(text, /Alt \+ E/);
    assert.match(text, /Alt \+ A/);
  });

  it('5. Formats answer readback and handles empty drafts gracefully', () => {
    // Empty draft
    const emptySpeech = formatAnswerForSpeech('', 'short_answer');
    assert.strictEqual(emptySpeech, 'You have not entered an answer for this question yet.');

    // MCQ answer
    const mcqAnswerSpeech = formatAnswerForSpeech('Option B: Paris', 'mcq');
    assert.strictEqual(mcqAnswerSpeech, 'Your selected option is: Option B: Paris.');

    // Text answer
    const textAnswerSpeech = formatAnswerForSpeech('Polymorphism allows objects to take multiple forms.', 'long_answer');
    assert.strictEqual(textAnswerSpeech, 'Your current drafted answer is: Polymorphism allows objects to take multiple forms.');
  });

  it('6. Formats comprehensive examination instructions and keyboard shortcuts', () => {
    const exam = {
      title: 'Midterm Examination',
      subject: 'Computer Science',
      duration_minutes: 90,
      total_marks: 50,
    };

    const instructions = formatInstructionsForSpeech(exam, 10);
    assert.match(instructions, /Midterm Examination/);
    assert.match(instructions, /90 minutes/);
    assert.match(instructions, /10 questions/);
    assert.match(instructions, /50 marks/);
    assert.match(instructions, /automatically saved/);
    assert.match(instructions, /Alt \+ Right Arrow and Alt \+ Left Arrow/);
    assert.match(instructions, /Alt \+ R/);
    assert.match(instructions, /Alt \+ A/);
    assert.match(instructions, /Alt \+ E/);
    assert.match(instructions, /Alt \+ S/);
  });

  it('7. Speech can be initiated, paused, resumed, and stopped immediately', () => {
    let started = false;
    speechService.speak('Hello accessibility test', {
      rate: 1.25,
      volume: 0.9,
      voiceName: 'Microsoft David',
      onStart: () => {
        started = true;
      },
    });

    assert.strictEqual(started, true);
    assert.strictEqual(speechService.isSpeakingState, true);
    assert.strictEqual(speechService.isPausedState, false);

    // Pause
    speechService.pause();
    assert.strictEqual(speechService.isPausedState, true);

    // Resume
    speechService.resume();
    assert.strictEqual(speechService.isPausedState, false);

    // Stop immediately
    speechService.stop();
    assert.strictEqual(speechService.isSpeakingState, false);
    assert.strictEqual(speechService.isPausedState, false);
  });

  it('8. Cancels active speech before starting new speech to prevent overlapping', () => {
    speechService.speak('First question being read aloud');
    assert.strictEqual(speechService.synth.utterances.length, 1);
    assert.strictEqual(speechService.synth.utterances[0].text, 'First question being read aloud');

    // Start second speech - should cancel and replace
    speechService.speak('Second question being read aloud');
    assert.strictEqual(speechService.synth.utterances.length, 1);
    assert.strictEqual(speechService.synth.utterances[0].text, 'Second question being read aloud');
  });

  it('9. Subscribers receive state notifications on speech lifecycle events', () => {
    const events = [];
    const unsubscribe = speechService.subscribe((state) => {
      events.push({ ...state });
    });

    speechService.speak('Subscriber notification test');
    speechService.pause();
    speechService.stop();

    unsubscribe();

    assert.ok(events.length >= 3);
    assert.ok(events.some((e) => e.isSpeaking === true));
    assert.ok(events.some((e) => e.isPaused === true));
    assert.strictEqual(events[events.length - 1].isSpeaking, false);
  });
});
