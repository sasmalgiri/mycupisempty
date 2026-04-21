'use client';

/**
 * VoiceConversation — hands-free voice tutoring.
 *
 * Students speak → we transcribe → AI responds → we speak response → loop.
 * No button presses between turns; the AI finishes, we listen, student answers.
 * Mirrors Khanmigo-voice + Duolingo-Max roleplay.
 *
 * State machine:
 *   idle → listening → thinking → speaking → [auto] listening
 *
 * Respects the same StudentState-aware AI as the text Guru. Locale-aware.
 * Falls back to text if speech APIs unavailable.
 */

import { useEffect, useRef, useState } from 'react';
import { isSTTAvailable, isTTSAvailable, listen, speak, stopSpeaking, type VoiceRecognitionHandle } from '@/lib/voice';
import { useClientLocale } from '@/lib/i18n';
import RichContent from '@/components/RichContent';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceConversationProps {
  topicId?: string;
  subjectId?: string;
  teachingMethod?: string;
  mode?: 'socratic' | 'direct' | 'teach_back';
  onClose?: () => void;
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export default function VoiceConversation({
  topicId, subjectId, teachingMethod, mode = 'socratic', onClose,
}: VoiceConversationProps) {
  const [locale] = useClientLocale();
  const [state, setState] = useState<VoiceState>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [supported, setSupported] = useState({ tts: false, stt: false });

  const handleRef = useRef<VoiceRecognitionHandle | null>(null);
  const turnsRef = useRef<Turn[]>([]);

  useEffect(() => {
    setSupported({ tts: isTTSAvailable(), stt: isSTTAvailable() });
  }, []);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      handleRef.current?.abort();
    };
  }, []);

  if (!supported.tts && !supported.stt) {
    return (
      <div className="p-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 rounded-xl">
        <p className="text-sm">
          Voice mode isn&apos;t supported in this browser. Try Chrome, Edge, or Safari — or use the text Guru.
        </p>
      </div>
    );
  }

  const startListening = () => {
    setError(null);
    setInterim('');
    setState('listening');

    const handle = listen({
      locale,
      continuous: false,
      interim: true,
      onResult: (transcript, isFinal) => {
        setInterim(transcript);
        if (isFinal) {
          handle?.stop();
          sendToAI(transcript);
        }
      },
      onError: (err: any) => {
        console.error('STT error', err);
        setError('Could not hear you. Tap the mic to try again.');
        setState('idle');
        handleRef.current = null;
      },
      onEnd: () => {
        if (state === 'listening') {
          // ended without a final result
          setState('idle');
        }
      },
    });
    handleRef.current = handle;
  };

  const stopListening = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setState('idle');
  };

  const sendToAI = async (userText: string) => {
    if (!userText || userText.trim().length < 1) {
      setState('idle');
      return;
    }
    const userTurn: Turn = { role: 'user', text: userText };
    setTurns((t) => [...t, userTurn]);
    setInterim('');
    setState('thinking');

    try {
      const response = await fetch('/api/ai/guru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          session_id: sessionId,
          topic_id: topicId,
          teaching_method: teachingMethod,
          mode,
        }),
      });
      const data = await response.json();
      if (!data.success || !data.reply) {
        throw new Error(data.error || 'No reply');
      }
      if (data.session_id) setSessionId(data.session_id);

      const reply: string = data.reply;
      const asstTurn: Turn = { role: 'assistant', text: reply };
      setTurns((t) => [...t, asstTurn]);
      setState('speaking');

      // Strip markdown for cleaner TTS (speak the plain text)
      const plain = reply
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\n\s*[-*]\s+/g, '. ')
        .replace(/\$\$?([^$]+)\$\$?/g, '$1')
        .slice(0, 1500); // respect TTS length limits

      speak(plain, {
        locale,
        onEnd: () => {
          // Auto-restart listening after AI finishes
          setTimeout(() => startListening(), 300);
        },
        onError: () => {
          setState('idle');
        },
      });
    } catch (err: any) {
      console.error('AI error', err);
      setError(err.message || 'Something went wrong. Try again.');
      setState('idle');
    }
  };

  const handleCancel = () => {
    stopSpeaking();
    stopListening();
    setState('idle');
  };

  const stateColor = state === 'listening' ? 'bg-red-500'
    : state === 'thinking' ? 'bg-amber-500'
    : state === 'speaking' ? 'bg-emerald-500'
    : 'bg-gray-400';

  const stateLabel = state === 'listening' ? 'Listening…'
    : state === 'thinking' ? 'Thinking…'
    : state === 'speaking' ? 'Speaking…'
    : 'Tap to talk';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          🎙️ Voice Tutor
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${stateColor} ${state === 'listening' || state === 'speaking' ? 'animate-pulse' : ''}`} />
        </h3>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        )}
      </div>

      {/* Transcript */}
      <div className="max-h-80 overflow-y-auto space-y-3 mb-4 pr-2">
        {turns.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tap the mic and ask your question out loud. I&apos;ll respond, and you can keep talking.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
              t.role === 'user'
                ? 'bg-primary-600 text-white rounded-br-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
            }`}>
              {t.role === 'assistant' ? <RichContent text={t.text} /> : t.text}
            </div>
          </div>
        ))}
        {interim && state === 'listening' && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl px-4 py-2 text-sm bg-primary-200 dark:bg-primary-900 text-primary-800 dark:text-primary-100 italic opacity-70">
              {interim}…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {state === 'idle' && (
          <button
            type="button"
            onClick={startListening}
            aria-label="Start speaking"
            className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white text-2xl flex items-center justify-center shadow-lg"
          >
            🎙️
          </button>
        )}
        {state === 'listening' && (
          <button
            type="button"
            onClick={stopListening}
            aria-label="Stop listening"
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white text-2xl flex items-center justify-center shadow-lg animate-pulse"
          >
            ⏸
          </button>
        )}
        {(state === 'thinking' || state === 'speaking') && (
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Cancel"
            className="w-16 h-16 rounded-full bg-gray-500 hover:bg-gray-600 text-white text-2xl flex items-center justify-center shadow-lg"
          >
            ⏹
          </button>
        )}
      </div>
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">{stateLabel}</p>
    </div>
  );
}
