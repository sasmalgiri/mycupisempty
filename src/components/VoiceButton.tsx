'use client';

import { useEffect, useState } from 'react';
import { speak, stopSpeaking, listen, isTTSAvailable, isSTTAvailable, type VoiceRecognitionHandle } from '@/lib/voice';
import { useClientLocale } from '@/lib/i18n';

interface VoiceButtonProps {
  // Text to speak (TTS)
  speakText?: string;
  // Callback when user speaks (STT)
  onTranscript?: (text: string) => void;
  mode?: 'speak' | 'listen' | 'both';
  size?: 'sm' | 'md' | 'lg';
}

export default function VoiceButton({ speakText, onTranscript, mode = 'both', size = 'md' }: VoiceButtonProps) {
  const [locale] = useClientLocale();
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [handle, setHandle] = useState<VoiceRecognitionHandle | null>(null);
  const [supported, setSupported] = useState<{ tts: boolean; stt: boolean }>({ tts: false, stt: false });

  useEffect(() => {
    setSupported({
      tts: isTTSAvailable(),
      stt: isSTTAvailable(),
    });
  }, []);

  // If neither TTS nor STT is supported, render nothing
  if (!supported.tts && !supported.stt) return null;

  const sizeCls = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-base';

  const handleSpeakClick = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!speakText) return;
    setSpeaking(true);
    speak(speakText, {
      locale,
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const handleListenClick = () => {
    if (listening && handle) {
      handle.stop();
      setListening(false);
      setHandle(null);
      return;
    }
    const h = listen({
      locale,
      interim: true,
      continuous: false,
      onResult: (transcript, isFinal) => {
        if (isFinal) {
          onTranscript?.(transcript);
          setListening(false);
          setHandle(null);
        }
      },
      onError: () => {
        setListening(false);
        setHandle(null);
      },
      onEnd: () => {
        setListening(false);
        setHandle(null);
      },
    });
    if (h) {
      setHandle(h);
      setListening(true);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      {(mode === 'speak' || mode === 'both') && speakText && supported.tts && (
        <button
          type="button"
          onClick={handleSpeakClick}
          aria-label={speaking ? 'Stop' : 'Read aloud'}
          title={speaking ? 'Stop' : 'Read aloud'}
          className={`${sizeCls} rounded-full flex items-center justify-center transition-colors ${
            speaking ? 'bg-red-500 text-white animate-pulse' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
          }`}
        >
          {speaking ? '⏸' : '🔊'}
        </button>
      )}
      {(mode === 'listen' || mode === 'both') && onTranscript && supported.stt && (
        <button
          type="button"
          onClick={handleListenClick}
          aria-label={listening ? 'Stop listening' : 'Speak'}
          title={listening ? 'Stop listening' : 'Speak your answer'}
          className={`${sizeCls} rounded-full flex items-center justify-center transition-colors ${
            listening ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          }`}
        >
          {listening ? '🔴' : '🎙️'}
        </button>
      )}
    </div>
  );
}
