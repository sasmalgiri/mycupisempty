'use client';

/**
 * PronunciationCoach — speak target phrase, hear TTS, record student's attempt,
 * compare via STT transcript, score similarity.
 *
 * Supports English, Hindi, Bengali. Uses Web Speech API (STT + TTS) — no
 * backend transcription cost, privacy stays on-device.
 *
 * Score is word-level similarity (simple Levenshtein + length-aware).
 */

import { useEffect, useRef, useState } from 'react';
import { isSTTAvailable, isTTSAvailable, listen, speak, stopSpeaking, voiceCodeFor, type VoiceRecognitionHandle } from '@/lib/voice';
import type { Locale } from '@/lib/i18n';

const SAMPLE_PHRASES: Record<Locale, Array<{ text: string; hint?: string }>> = {
  en: [
    { text: 'The quick brown fox jumps over the lazy dog.' },
    { text: 'She sells seashells by the seashore.' },
    { text: 'Education is the most powerful weapon to change the world.' },
    { text: 'Knowledge is like a garden — if not cultivated, it will not grow.' },
  ],
  hi: [
    { text: 'विद्या ही सबसे बड़ा धन है।', hint: 'vidyā hī sabse baṛā dhan hai' },
    { text: 'सच्ची मेहनत कभी बेकार नहीं जाती।' },
    { text: 'मेरा भारत महान है।' },
    { text: 'शिक्षा हमें जीवन में सफल बनाती है।' },
  ],
  bn: [
    { text: 'বিদ্যাই সবচেয়ে বড় সম্পদ।', hint: 'bidyāi sabcheye baṛo sampad' },
    { text: 'জল শুকায় না যতক্ষণ ঝর্ণা চলে।' },
    { text: 'আমার সোনার বাংলা আমি তোমায় ভালবাসি।' },
    { text: 'পরিশ্রমই সাফল্যের চাবিকাঠি।' },
  ],
};

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) dp[j] = prev;
      else dp[j] = Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = temp;
    }
  }
  return dp[b.length];
}

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[.,!?;:"'()\-–—]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarityScore(target: string, actual: string): number {
  const t = normalize(target);
  const a = normalize(actual);
  if (!a) return 0;
  const dist = levenshtein(t, a);
  const maxLen = Math.max(t.length, a.length, 1);
  return Math.max(0, Math.round((1 - dist / maxLen) * 100));
}

interface Props { language?: Locale; }

export default function PronunciationCoach({ language = 'en' }: Props) {
  const [lang, setLang] = useState<Locale>(language);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [supported, setSupported] = useState({ tts: false, stt: false });
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<VoiceRecognitionHandle | null>(null);

  useEffect(() => {
    setSupported({ tts: isTTSAvailable(), stt: isSTTAvailable() });
  }, []);

  useEffect(() => {
    setPhraseIdx(0);
    setTranscript('');
    setInterim('');
    setScore(null);
  }, [lang]);

  const phrases = SAMPLE_PHRASES[lang];
  const target = phrases[phraseIdx]?.text || '';
  const hint = phrases[phraseIdx]?.hint;

  const playTarget = () => {
    stopSpeaking();
    speak(target, { locale: lang, rate: 0.9 });
  };

  const startListen = () => {
    setError(null);
    setTranscript('');
    setInterim('');
    setScore(null);
    if (!supported.stt) {
      setError('Speech recognition not supported in this browser.');
      return;
    }
    const h = listen({
      locale: lang,
      continuous: false,
      interim: true,
      onResult: (text, isFinal) => {
        setInterim(text);
        if (isFinal) {
          setTranscript(text);
          setInterim('');
          setScore(similarityScore(target, text));
          setListening(false);
          handleRef.current = null;
        }
      },
      onError: (e: any) => {
        setError(e?.error || 'Microphone error. Please allow mic access.');
        setListening(false);
        handleRef.current = null;
      },
      onEnd: () => setListening(false),
    });
    if (h) { handleRef.current = h; setListening(true); }
  };

  const stopListen = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setListening(false);
  };

  const scoreColor = score === null ? 'bg-gray-300'
    : score >= 85 ? 'bg-emerald-500'
    : score >= 65 ? 'bg-amber-500'
    : 'bg-red-500';
  const scoreLabel = score === null ? '—'
    : score >= 90 ? 'Native-like ⭐'
    : score >= 75 ? 'Great!'
    : score >= 60 ? 'Good — small polish needed'
    : score >= 40 ? 'On the way — try again'
    : 'Keep trying — go slower';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold">🗣️ Pronunciation Coach</h3>
        <div className="flex gap-1">
          {(['en', 'hi', 'bn'] as Locale[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-label={l}
              className={`px-3 py-1 rounded text-xs font-semibold ${lang === l ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
            >
              {l === 'en' ? 'English' : l === 'hi' ? 'हिन्दी' : 'বাংলা'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 mb-3">
        <p className="text-xs text-gray-500 mb-1">Say this:</p>
        <p className="text-lg font-semibold">{target}</p>
        {hint && <p className="text-xs text-gray-500 mt-1 italic">({hint})</p>}
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          type="button"
          onClick={playTarget}
          disabled={!supported.tts}
          aria-label="Hear phrase"
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm"
        >🔊 Hear it</button>
        {!listening ? (
          <button
            type="button"
            onClick={startListen}
            disabled={!supported.stt}
            aria-label="Record"
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium text-sm"
          >🎙️ Record</button>
        ) : (
          <button
            type="button"
            onClick={stopListen}
            aria-label="Stop"
            className="px-4 py-2 rounded-lg bg-red-500 text-white font-medium text-sm animate-pulse"
          >⏹ Stop</button>
        )}
        <button
          type="button"
          onClick={() => { setPhraseIdx((phraseIdx + 1) % phrases.length); setTranscript(''); setScore(null); }}
          aria-label="Next phrase"
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm"
        >Next phrase →</button>
      </div>

      {(!supported.tts || !supported.stt) && (
        <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2 rounded mb-3">
          {!supported.tts && !supported.stt ? 'Voice features not supported in this browser.'
            : !supported.stt ? 'Speech recognition not supported. You can still hear the phrase.'
            : 'Text-to-speech not supported. You can still record.'}
        </p>
      )}

      {error && <div className="p-2 bg-red-50 text-red-700 text-xs rounded mb-2">{error}</div>}

      {(interim || transcript) && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 mb-3">
          <p className="text-xs text-gray-500 mb-1">You said:</p>
          <p className="text-base italic">{transcript || interim}</p>
        </div>
      )}

      {score !== null && (
        <div className="p-4 bg-white dark:bg-gray-950 rounded-lg border-2 border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Score</span>
            <span className="text-2xl font-bold">{score}/100</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
            <div className={`h-full ${scoreColor} transition-all`} style={{ width: `${score}%` }} />
          </div>
          <p className="text-sm">{scoreLabel}</p>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-500">
        Voice code: {voiceCodeFor(lang)}. All audio stays on your device.
      </p>
    </div>
  );
}
