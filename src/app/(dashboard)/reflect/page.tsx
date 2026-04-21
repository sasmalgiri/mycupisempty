'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';

interface ReflectionEntry {
  id: string;
  reflection_type: string;
  prompt_text: string;
  response_text: string;
  dimension_tags: string[];
  created_at: string;
}

const REFLECTION_TYPES = [
  { key: 'daily_review', label: 'Daily Review', icon: '📝', desc: 'What did I learn today?' },
  { key: 'gratitude', label: 'Gratitude', icon: '🙏', desc: 'What am I grateful for?' },
  { key: 'emotion_check', label: 'Emotion Check', icon: '💭', desc: 'How am I feeling and why?' },
  { key: 'failure_reflection', label: 'Learn from Failure', icon: '💪', desc: 'What went wrong and what did I learn?' },
  { key: 'success_reflection', label: 'Celebrate Success', icon: '🎉', desc: 'What went right and why?' },
  { key: 'goal_review', label: 'Goal Check-in', icon: '🎯', desc: 'Am I on track with my goals?' },
];

export default function ReflectPage() {
  const [entries, setEntries] = useState<ReflectionEntry[]>([]);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState('daily_review');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [view, setView] = useState<'write' | 'history'>('write');

  const supabase = createBrowserClient();

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch past reflections
      const res = await fetch('/api/development?action=reflections');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.reflections || []);
      }

      // Fetch profile for age
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('current_class')
        .eq('id', user.id)
        .single();

      const age = (profile?.current_class || 8) + 5; // rough age estimate

      // Fetch prompts
      const promptRes = await fetch(`/api/development?action=reflection_prompts&age=${age}&type=${selectedType}`);
      if (promptRes.ok) {
        const data = await promptRes.json();
        setPrompts(data.prompts || []);
        if (data.prompts?.length > 0) {
          setSelectedPrompt(data.prompts[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load reflections:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedType]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    if (!response.trim()) return;
    setSubmitting(true);

    try {
      const typeInfo = REFLECTION_TYPES.find(t => t.key === selectedType);
      const dimensionTags = selectedType === 'emotion_check'
        ? ['emotional_regulation']
        : selectedType === 'goal_review'
          ? ['decision_making', 'consistency']
          : ['reflection', 'self_learning'];

      const res = await fetch('/api/development', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_reflection',
          reflection_type: selectedType,
          prompt_text: selectedPrompt || typeInfo?.desc || '',
          response_text: response.trim(),
          dimension_tags: dimensionTags,
        }),
      });

      if (res.ok) {
        setResponse('');
        loadData();
      }
    } catch (err) {
      console.error('Failed to submit reflection:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const todayEntries = entries.filter(e => {
    const today = new Date().toISOString().split('T')[0];
    return e.created_at.startsWith(today);
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reflect</h1>
        <p className="text-gray-500 mt-1">Pause, think, and grow through self-reflection</p>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setView('write')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            view === 'write' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-600'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setView('history')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            view === 'history' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-600'
          }`}
        >
          Journal ({entries.length})
        </button>
      </div>

      {view === 'write' ? (
        <>
          {/* Today's Status */}
          {todayEntries.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-medium text-green-800">
                  You&apos;ve reflected {todayEntries.length} time{todayEntries.length > 1 ? 's' : ''} today!
                </p>
                <p className="text-sm text-green-600">Keep it going. Reflection builds self-awareness.</p>
              </div>
            </div>
          )}

          {/* Reflection Type Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {REFLECTION_TYPES.map(type => (
              <button
                key={type.key}
                type="button"
                onClick={() => setSelectedType(type.key)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedType === type.key
                    ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                    : 'border-gray-100 bg-white hover:border-primary-200'
                }`}
              >
                <span className="text-2xl">{type.icon}</span>
                <h3 className="font-semibold text-gray-900 mt-2 text-sm">{type.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{type.desc}</p>
              </button>
            ))}
          </div>

          {/* Prompt Selection */}
          {prompts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">Choose a prompt</h3>
              <div className="space-y-2">
                {prompts.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedPrompt(prompt)}
                    className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                      selectedPrompt === prompt
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-100 hover:border-primary-200'
                    }`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Writing Area */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-1 text-sm">
              {selectedPrompt || REFLECTION_TYPES.find(t => t.key === selectedType)?.desc}
            </h3>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Write your reflection here... Take your time, be honest with yourself."
              className="w-full mt-3 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none text-gray-700"
              rows={6}
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-400">
                {response.length} characters
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!response.trim() || submitting}
                className="btn-primary px-6 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Save Reflection'}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* History View */
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-4xl mb-4">📔</p>
              <p className="text-gray-500 font-medium">No reflections yet</p>
              <p className="text-sm text-gray-400 mt-1">Start writing to build your reflection journal</p>
              <button type="button" onClick={() => setView('write')} className="btn-primary px-6 py-2 mt-4 text-sm">
                Write First Reflection
              </button>
            </div>
          ) : (
            entries.map(entry => {
              const typeInfo = REFLECTION_TYPES.find(t => t.key === entry.reflection_type);
              return (
                <div key={entry.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">{typeInfo?.icon || '📝'}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{typeInfo?.label || entry.reflection_type}</h3>
                      <p className="text-xs text-gray-400">{formatDate(entry.created_at)}</p>
                    </div>
                  </div>
                  {entry.prompt_text && (
                    <p className="text-sm text-primary-600 italic mb-2">&quot;{entry.prompt_text}&quot;</p>
                  )}
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{entry.response_text}</p>
                  {entry.dimension_tags?.length > 0 && (
                    <div className="flex gap-1.5 mt-3 flex-wrap">
                      {entry.dimension_tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                          {tag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
