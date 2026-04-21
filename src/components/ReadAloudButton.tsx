'use client';

/**
 * ReadAloudButton — one-click "play this to me" for any text block.
 *
 * Auditory learners need a passive listen-mode: briefing, flashcards,
 * reflection prompts, character nudges. Uses the browser Web Speech API
 * via lib/voice.ts so there's no backend cost and no data leaves the device.
 *
 * Silent no-op if TTS isn't available (older browsers, unsupported mobile).
 */

import { useEffect, useState } from 'react';
import { speak, stopSpeaking, isSpeaking, isTTSAvailable } from '@/lib/voice';
import type { Locale } from '@/lib/i18n';

interface Props {
  text: string | (() => string);
  locale?: Locale;
  className?: string;
  label?: string;
  size?: 'sm' | 'md';
}

export default function ReadAloudButton({ text, locale = 'en', className = '', label, size = 'sm' }: Props) {
  const [available, setAvailable] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setAvailable(isTTSAvailable());
  }, []);

  useEffect(() => {
    return () => {
      if (isSpeaking()) stopSpeaking();
    };
  }, []);

  if (!available) return null;

  const handleClick = () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    const body = typeof text === 'function' ? text() : text;
    if (!body?.trim()) return;
    const ok = speak(body, {
      locale,
      onEnd: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
    if (ok) setPlaying(true);
  };

  const sizeClass = size === 'md' ? 'text-sm px-3 py-1.5' : 'text-xs px-2 py-1';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={playing ? 'Stop reading' : 'Read aloud'}
      title={playing ? 'Stop' : 'Read aloud'}
      className={`inline-flex items-center gap-1 rounded-full border transition-colors ${sizeClass} ${
        playing
          ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
          : 'bg-white/70 border-gray-300 text-gray-600 hover:bg-white hover:border-primary-400'
      } ${className}`}
    >
      <span aria-hidden="true">{playing ? '■' : '▶'}</span>
      <span>{label || (playing ? 'Stop' : 'Listen')}</span>
    </button>
  );
}
