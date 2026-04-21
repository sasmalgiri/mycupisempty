'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGuruChat } from '@/hooks/upgrade';
import { Slider, MethodCard, BuddyBubble } from '@/components/ui/upgrade';
import { Button, LoadingSpinner } from '@/components/ui/index';
import LearningModePill, { type ExplanationMode } from '@/components/LearningModePill';

// Map the abstract "how I learn" mode onto Guru's existing method + socratic toggle.
const MODE_TO_GURU: Record<ExplanationMode, { method: string; socratic: boolean }> = {
  visual:        { method: 'mind_map',        socratic: false },
  story:         { method: 'storytelling',    socratic: false },
  example_first: { method: 'analogy',         socratic: false },
  step_by_step:  { method: 'feynman',         socratic: false },
  socratic:      { method: 'socratic',        socratic: true },
  drill:         { method: 'active_recall',   socratic: false },
  hands_on:      { method: 'project_based',   socratic: false },
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'ELI5', 2: 'Simple', 3: 'Easy', 4: 'Basic', 5: 'Standard',
  6: 'Advanced', 7: 'Deep', 8: 'Olympiad', 9: 'College', 10: 'Expert',
};

const QUICK_METHODS = [
  { code: 'feynman', name: 'Feynman', icon: '🎯', category: 'modern' as const },
  { code: 'socratic', name: 'Socratic', icon: '❓', category: 'ancient' as const },
  { code: 'storytelling', name: 'Story', icon: '📚', category: 'ancient' as const },
  { code: 'vedic_math', name: 'Vedic', icon: '🕉️', category: 'ancient' as const },
  { code: 'mind_map', name: 'Mind Map', icon: '🧠', category: 'modern' as const },
  { code: 'visualization', name: 'Visualize', icon: '🧘', category: 'ancient' as const },
  { code: 'active_recall', name: 'Recall', icon: '🧪', category: 'scientific' as const },
  { code: 'analogy', name: 'Analogy', icon: '🔗', category: 'modern' as const },
];

const ALL_METHODS = [
  ...QUICK_METHODS,
  { code: 'cornell_notes', name: 'Cornell Notes', icon: '📝', category: 'modern' as const },
  { code: 'pomodoro', name: 'Pomodoro', icon: '🍅', category: 'modern' as const },
  { code: 'teach_back', name: 'Teach-Back', icon: '🎓', category: 'modern' as const },
  { code: 'project_based', name: 'Project', icon: '🏗️', category: 'modern' as const },
  { code: 'pq4r', name: 'PQ4R', icon: '📑', category: 'modern' as const },
  { code: 'gurukul', name: 'Gurukul', icon: '🙏', category: 'ancient' as const },
  { code: 'memory_palace', name: 'Memory Palace', icon: '🏛️', category: 'ancient' as const },
  { code: 'sutra_learning', name: 'Sutra', icon: '🕉️', category: 'ancient' as const },
  { code: 'spaced_rep', name: 'Spaced Rep', icon: '📅', category: 'scientific' as const },
  { code: 'interleaving', name: 'Interleave', icon: '🔀', category: 'scientific' as const },
  { code: 'elaborative_interrogation', name: 'Why/How', icon: '🔎', category: 'scientific' as const },
  { code: 'dual_coding', name: 'Dual Coding', icon: '🖼️', category: 'scientific' as const },
  { code: 'chunking', name: 'Chunking', icon: '🧩', category: 'scientific' as const },
];

export default function GuruPage() {
  const {
    messages, loading, method, setMethod, difficulty, setDifficulty,
    isSocratic, setIsSocratic, isBeyondCurriculum, setIsBeyondCurriculum,
    sendMessage, resetChat,
  } = useGuruChat();

  const searchParams = useSearchParams();

  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(true);
  const [showAllMethods, setShowAllMethods] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sticky mode: hydrate method + socratic from the learner's saved/observed mode
  // on first load so returning students don't have to re-pick every session.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/learning-mode')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.success || !d?.mode) return;
        const mapped = MODE_TO_GURU[d.mode as ExplanationMode];
        if (mapped) {
          setMethod(mapped.method);
          setIsSocratic(mapped.socratic);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [setMethod, setIsSocratic]);

  // Handle inbound URLs from Daily Mix mode entry points and elsewhere.
  // ?q=... pre-fills (and auto-sends) a prompt; ?mode=... overrides the
  // teaching method; ?socratic=1 forces socratic on; ?topic=... is passed
  // as the topicId to sendMessage for context routing.
  useEffect(() => {
    const mode = searchParams?.get('mode') as ExplanationMode | null;
    const socratic = searchParams?.get('socratic');
    const q = searchParams?.get('q');
    const topic = searchParams?.get('topic');

    if (mode && MODE_TO_GURU[mode]) {
      setMethod(MODE_TO_GURU[mode].method);
      setIsSocratic(MODE_TO_GURU[mode].socratic);
    }
    if (socratic === '1' || socratic === 'true') {
      setIsSocratic(true);
    }
    if (q && !autoSentRef.current) {
      autoSentRef.current = true;
      const trimmed = q.trim().slice(0, 500);
      setInput(trimmed);
      setShowSettings(false);
      // Defer so state updates from ?mode= land before the send
      const t = setTimeout(() => {
        sendMessage(trimmed, topic || undefined);
        setInput('');
      }, 60);
      return () => clearTimeout(t);
    }
  }, [searchParams, setMethod, setIsSocratic, sendMessage]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
    setInput('');
    setShowSettings(false);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧙</span>
            <div>
              <h1 className="text-xl font-bold text-white">AI Guru</h1>
              <p className="text-xs text-gray-400">Your personal learning companion — ask anything</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* How I learn — one-click shortcut that sets method + socratic together */}
            <LearningModePill
              variant="dark"
              onChange={(m) => {
                const mapped = MODE_TO_GURU[m];
                if (mapped) {
                  setMethod(mapped.method);
                  setIsSocratic(mapped.socratic);
                }
              }}
            />

            {/* Toggles */}
            <button
              onClick={() => setIsSocratic(!isSocratic)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSocratic ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              ❓ Socratic {isSocratic ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setIsBeyondCurriculum(!isBeyondCurriculum)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isBeyondCurriculum ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              🚀 Explore Beyond {isBeyondCurriculum ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-1.5 bg-gray-800 text-gray-400 border border-gray-700 rounded-lg text-xs"
            >
              ⚙️ Settings
            </button>

            <button
              onClick={resetChat}
              className="px-3 py-1.5 bg-gray-800 text-gray-400 border border-gray-700 rounded-lg text-xs hover:text-white"
            >
              🗑️ New Chat
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mt-4 p-4 bg-gray-900 rounded-xl border border-gray-700">
            {/* Difficulty */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-2 block">
                Difficulty Level: <span className="text-primary-400 font-bold">{DIFFICULTY_LABELS[difficulty]}</span>
              </label>
              <Slider
                min={1} max={10} value={difficulty} onChange={setDifficulty}
                labels={{ 1: 'ELI5', 10: 'Expert' }}
              />
            </div>

            {/* Method selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-400">Teaching Method</label>
                <button type="button" onClick={() => setShowAllMethods(!showAllMethods)} className="text-[10px] text-primary-400 hover:text-primary-300">
                  {showAllMethods ? 'Show Less' : `Show All ${ALL_METHODS.length} Methods`}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(showAllMethods ? ALL_METHODS : QUICK_METHODS).map(m => (
                  <button
                    type="button"
                    key={m.code}
                    onClick={() => setMethod(m.code)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      method === m.code
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <span>{m.icon}</span> {m.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <span className="text-6xl block mb-4">🧙</span>
            <h2 className="text-xl font-bold text-white mb-2">Hello! I'm your AI Guru.</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Ask me anything — I'll explain it using the teaching method and difficulty level you choose.
              I can be your study buddy, mentor, or guide.
            </p>

            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {[
                'Explain photosynthesis using a story',
                'How does gravity work? (ELI5)',
                'Teach me Vedic Math multiplication',
                'Why is water called universal solvent?',
                'Help me understand quadratic equations',
                'What is DNA? Use mind mapping',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); }}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:border-primary-500 hover:text-white transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-800 border border-gray-700 text-gray-200'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">🧙</span>
                  <span className="text-[10px] text-gray-500">AI Guru • {method} • Level {difficulty}</span>
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span className="text-xs text-gray-400">Guru is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-800">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={
              isSocratic ? "Ask your question... (Guru will guide you with questions)"
              : isBeyondCurriculum ? "Explore anything — beyond textbooks..."
              : "Ask your Guru anything..."
            }
            className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
          />
          <Button onClick={handleSend} disabled={!input.trim() || loading} variant="primary">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
