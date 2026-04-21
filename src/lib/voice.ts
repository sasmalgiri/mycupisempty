/**
 * Voice Mode — TTS + STT via Web Speech API.
 *
 * Khanmigo voice and Duolingo Max roleplay have made voice-first tutoring
 * table-stakes. We use the browser's native Web Speech API — zero backend
 * cost, works offline-ish, respects kids' privacy (no data leaves the browser
 * for STT in modern browsers).
 *
 * Language-aware: matches the user's current locale (en-IN / hi-IN / bn-IN)
 * so Hindi/Bengali students can speak and hear in their language.
 *
 * Graceful degradation: returns a "notSupported" flag if browser doesn't
 * have SpeechRecognition or SpeechSynthesis. UI hides voice button in that
 * case.
 */

'use client';

import type { Locale } from './i18n';

// ============================================================
// Feature detection
// ============================================================

export function isTTSAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSTTAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

// ============================================================
// Locale → BCP-47 voice code
// ============================================================

const LOCALE_TO_SPEECH: Record<Locale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
};

export function voiceCodeFor(locale: Locale): string {
  return LOCALE_TO_SPEECH[locale] || 'en-IN';
}

// ============================================================
// TTS: speak a string
// ============================================================

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, options?: {
  locale?: Locale;
  rate?: number;      // 0.1..10, default 1
  pitch?: number;     // 0..2, default 1
  onEnd?: () => void;
  onError?: (err: any) => void;
}): boolean {
  if (!isTTSAvailable() || !text) return false;
  try {
    // Cancel anything in flight
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = voiceCodeFor(options?.locale || 'en');
    utter.rate = options?.rate ?? 1;
    utter.pitch = options?.pitch ?? 1;

    // Pick the best matching voice
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang === utter.lang)
               || voices.find((v) => v.lang.startsWith(utter.lang.split('-')[0]));
    if (match) utter.voice = match;

    utter.onend = () => {
      currentUtterance = null;
      options?.onEnd?.();
    };
    utter.onerror = (err) => {
      currentUtterance = null;
      options?.onError?.(err);
    };

    currentUtterance = utter;
    window.speechSynthesis.speak(utter);
    return true;
  } catch (err) {
    console.error('TTS error:', err);
    return false;
  }
}

export function stopSpeaking(): void {
  if (!isTTSAvailable()) return;
  try { window.speechSynthesis.cancel(); } catch {}
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  if (!isTTSAvailable()) return false;
  return window.speechSynthesis.speaking;
}

// ============================================================
// STT: listen for a phrase
// ============================================================

export interface VoiceRecognitionHandle {
  stop: () => void;
  abort: () => void;
}

export function listen(options: {
  locale?: Locale;
  continuous?: boolean;
  interim?: boolean;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (err: any) => void;
  onEnd?: () => void;
}): VoiceRecognitionHandle | null {
  if (!isSTTAvailable()) return null;

  try {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recog = new SpeechRecognition();
    recog.lang = voiceCodeFor(options.locale || 'en');
    recog.continuous = options.continuous ?? false;
    recog.interimResults = options.interim ?? true;
    recog.maxAlternatives = 1;

    recog.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        options.onResult(transcript, result.isFinal);
      }
    };

    recog.onerror = (err: any) => options.onError?.(err);
    recog.onend = () => options.onEnd?.();

    recog.start();

    return {
      stop: () => { try { recog.stop(); } catch {} },
      abort: () => { try { recog.abort(); } catch {} },
    };
  } catch (err) {
    console.error('STT error:', err);
    options.onError?.(err);
    return null;
  }
}

// ============================================================
// Convenience: speak + listen (full voice exchange)
// ============================================================

export async function askVoiceQuestion(question: string, locale: Locale = 'en'): Promise<string | null> {
  return new Promise((resolve) => {
    speak(question, {
      locale,
      onEnd: () => {
        // After speaking, start listening
        const handle = listen({
          locale,
          interim: false,
          continuous: false,
          onResult: (transcript, isFinal) => {
            if (isFinal) {
              handle?.stop();
              resolve(transcript);
            }
          },
          onError: () => resolve(null),
          onEnd: () => {
            // If we got no result before end, resolve null
            setTimeout(() => resolve(null), 100);
          },
        });
        if (!handle) resolve(null);
      },
      onError: () => resolve(null),
    });
  });
}
