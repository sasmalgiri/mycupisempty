'use client';

/**
 * Teacher AI Tools — MagicSchool-style assistants for teachers.
 * Free for teacher accounts; gates on profiles.role === 'teacher'.
 */

import { useState } from 'react';

const TOOL_META = {
  ai_resistant_assignment: { label: 'AI-resistant assignment', icon: '🛡' },
  misconception_radar:     { label: 'Misconception radar',     icon: '📡' },
  lesson_plan:             { label: '40-min lesson plan',      icon: '📋' },
  group_jam_question:      { label: 'Group jam question',      icon: '🎤' },
} as const;

type ToolKey = keyof typeof TOOL_META;

export default function AIToolsPage() {
  const [tool, setTool] = useState<ToolKey>('ai_resistant_assignment');
  const [subject, setSubject] = useState('Math');
  const [topic, setTopic] = useState('');
  const [classLevel, setClassLevel] = useState('8');
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setOutput(null);
    try {
      const res = await fetch('/api/teacher-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, params: { subject, topic, classLevel } }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Tool failed.');
      setOutput(json.output);
    } catch (err: any) {
      setError(err?.message || 'Network error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">AI Teacher Tools</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Free for teachers. Built for the post-ChatGPT classroom.
        </p>
      </div>

      <section className="grid sm:grid-cols-2 gap-3">
        {(Object.keys(TOOL_META) as ToolKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTool(k)}
            className={`text-left p-3 rounded-2xl border-2 transition-colors ${
              tool === k
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-200 dark:border-gray-800 hover:border-primary-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>{TOOL_META[k].icon}</span>
              <span>{TOOL_META[k].label}</span>
            </div>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="block text-xs">
            <span className="block text-gray-500 mb-1">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="block text-gray-500 mb-1">Topic</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Quadratic equations" className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="block text-gray-500 mb-1">Class</span>
            <input type="number" min={1} max={12} value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </label>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy || !topic.trim()}
          className="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
        >
          {busy ? 'Generating…' : `Generate ${TOOL_META[tool].label.toLowerCase()}`}
        </button>
        {error && <p className="text-xs text-rose-700">{error}</p>}
      </section>

      {output && (
        <section className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm">Output</h3>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(output)}
              className="text-xs text-emerald-700 hover:underline"
            >
              Copy
            </button>
          </div>
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{output}</pre>
        </section>
      )}
    </div>
  );
}
