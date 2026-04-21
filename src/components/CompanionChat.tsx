'use client';

/**
 * CompanionChat — per-subject AI companion with persona.
 * Strips OBS blocks before rendering (those go to the main brain).
 */

import { useEffect, useRef, useState } from 'react';
import RichContent from './RichContent';

interface Companion { id: string; name: string; avatar: string; color: string; }
interface Turn { role: 'user' | 'assistant'; text: string; }

interface Props {
  subjectId: string;
  subjectName: string;
  initialGreeting?: boolean;
}

export default function CompanionChat({ subjectId, subjectName, initialGreeting = true }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [maturity, setMaturity] = useState<{ band: number; composite: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length === 0 && initialGreeting && !sending) {
      send('Hi! I want to study ' + subjectName + ' today.', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const send = async (text: string, isGreeting = false) => {
    if (!text.trim()) return;
    setError(null);
    if (!isGreeting) {
      setTurns((t) => [...t, { role: 'user', text }]);
    }
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', subjectId, message: text, sessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Companion failed');
      setCompanion(data.companion);
      setSessionId(data.sessionId);
      if (data.maturity) setMaturity(data.maturity);
      if (isGreeting) {
        setTurns([{ role: 'assistant', text: data.reply }]);
      } else {
        setTurns((t) => [...t, { role: 'assistant', text: data.reply }]);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col" style={{ height: 520 }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-800">
        {companion && (
          <>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: companion.color + '30', color: companion.color }}
            >{companion.avatar}</div>
            <div className="flex-1">
              <h3 className="font-bold">{companion.name}</h3>
              <p className="text-xs text-gray-500">Your {subjectName} companion</p>
            </div>
            {maturity && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800" title={`Maturity ${maturity.composite}/100`}>
                Band {maturity.band}/5
              </span>
            )}
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {turns.length === 0 && !sending && (
          <p className="text-sm text-gray-500 text-center py-8">Meeting your {subjectName} companion…</p>
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
        {sending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 opacity-70">
              <span className="inline-block animate-pulse">{companion?.name || 'Companion'} is thinking…</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs border-t border-red-200 dark:border-red-800">{error}</div>
      )}

      {/* Composer */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask anything about this subject…"
          aria-label="Message"
          className="flex-1 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-950"
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={!input.trim() || sending}
          aria-label="Send"
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
        >Send</button>
      </div>
    </div>
  );
}
