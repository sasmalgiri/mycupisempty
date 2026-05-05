'use client';

/**
 * Daily spelling drill. Companion (or browser TTS) speaks the word, student
 * types it. Bengali conjuncts + English commonly-misspelt words. Difficulty
 * adapts to recent accuracy.
 */

import { useEffect, useRef, useState } from 'react';

interface Word {
  id: string;
  word: string;
  meaning: string | null;
  category: string;
  difficulty: number;
  example_sentence: string | null;
}

export default function SpellingDrillPage() {
  const [word, setWord] = useState<Word | null>(null);
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctWord: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const startRef = useRef<number>(Date.now());

  const load = () => {
    setLoading(true); setFeedback(null); setInput('');
    fetch(`/api/spelling-drill?lang=${language}`)
      .then((r) => r.json())
      .then((d) => {
        setWord(d?.word || null);
        setAccuracy(d?.recentAccuracy ?? null);
        startRef.current = Date.now();
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [language]);

  const speak = () => {
    if (!word) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(word.example_sentence || word.word);
    utter.lang = language === 'bn' ? 'bn-IN' : 'en-IN';
    utter.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const submit = async () => {
    if (!word || !input.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/spelling-drill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordId: word.id,
          studentInput: input,
          durationSeconds: Math.max(1, Math.round((Date.now() - startRef.current) / 1000)),
        }),
      });
      const json = await res.json();
      if (json?.success) {
        setFeedback({ correct: json.isCorrect, correctWord: json.correctWord });
        if (json.isCorrect) setStreak((s) => s + 1);
        else setStreak(0);
      }
    } finally { setBusy(false); }
  };

  if (loading) return <div className="max-w-2xl mx-auto p-8 text-center text-sm text-gray-500">Loading…</div>;
  if (!word) return <div className="max-w-2xl mx-auto p-8 text-center text-sm text-gray-500">No words available for your class+language yet.</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">📝 Spelling drill</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          One word a day, dictated by your phone. Bengali conjuncts ({'যুক্তাক্ষর'}) and English commonly-misspelt words.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button type="button" onClick={() => setLanguage('bn')} className={`px-3 py-1.5 rounded-lg font-semibold ${language === 'bn' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>বাংলা</button>
        <button type="button" onClick={() => setLanguage('en')} className={`px-3 py-1.5 rounded-lg font-semibold ${language === 'en' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>English</button>
        <span className="ml-auto text-gray-500">streak {streak} · accuracy {accuracy != null ? `${Math.round(accuracy * 100)}%` : '—'}</span>
      </div>

      <section className="rounded-2xl border-2 border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 p-5 space-y-3">
        <button type="button" onClick={speak} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold">
          🔊 Hear the word
        </button>
        {word.example_sentence && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Hint sentence (don&apos;t look at the answer): <span aria-hidden="true">{word.example_sentence.replace(word.word, '_____')}</span>
          </p>
        )}
        <label htmlFor="spelling-input" className="block text-xs font-bold uppercase text-gray-500">Type what you heard</label>
        <input
          id="spelling-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy || !!feedback}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-base"
        />
        {!feedback && (
          <button type="button" onClick={submit} disabled={busy || !input.trim()} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            Submit
          </button>
        )}
        {feedback && (
          <div className={`p-3 rounded-lg ${feedback.correct ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-rose-50 dark:bg-rose-950/30'}`}>
            <p className="font-bold">{feedback.correct ? '✅ Correct!' : `❌ Correct spelling: ${feedback.correctWord}`}</p>
            {!feedback.correct && word.meaning && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Meaning: {word.meaning}</p>}
            <button type="button" onClick={load} className="mt-2 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold">
              Next word →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
