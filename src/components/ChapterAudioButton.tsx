'use client';

/**
 * Lightweight "listen to this chapter" button. Uses the browser's built-in
 * SpeechSynthesis (Bengali / English / Hindi voices when available). No API
 * call needed — works offline once the voice list is loaded.
 */

import { useEffect, useState } from 'react';

export default function ChapterAudioButton({ text, language = 'en' }: { text: string; language?: string }) {
  const [available, setAvailable] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setAvailable(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  if (!available) return null;

  const speak = () => {
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text.slice(0, 4000));
    utter.lang = language === 'bn' ? 'bn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    utter.rate = 0.95;
    utter.onend = () => setPlaying(false);
    utter.onerror = () => setPlaying(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setPlaying(true);
  };

  return (
    <button
      type="button"
      onClick={speak}
      className="text-xs px-3 py-1.5 bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 hover:bg-sky-200 dark:hover:bg-sky-900/60 rounded-lg font-semibold inline-flex items-center gap-1"
      aria-label={playing ? 'Stop reading aloud' : 'Read this aloud'}
    >
      <span aria-hidden="true">{playing ? '⏹' : '🔊'}</span>
      {playing ? 'Stop' : 'Listen'}
    </button>
  );
}
