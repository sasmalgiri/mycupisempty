'use client';

import React, { useState, useEffect } from 'react';
import { useLearnerState, useRetrieval, useMisconceptions, useMasteryHistory, useModuleEvents } from '@/hooks/pedagogy-engine';
import { Card, LoadingSpinner, Button } from '@/components/ui/index';
import { BuddyBubble } from '@/components/ui/upgrade';
import Link from 'next/link';

const MODULE_INFO: Record<string, { label: string; icon: string; color: string; description: string }> = {
  access_fit: { label: 'Getting Started', icon: '🎯', color: '#6366f1', description: 'Setting up your learning preferences' },
  diagnostic: { label: 'Diagnostic Check', icon: '🔍', color: '#f59e0b', description: 'Finding out what you already know' },
  teach_scaffold: { label: 'Learning', icon: '📚', color: '#3b82f6', description: 'Building understanding step by step' },
  retrieve_retain: { label: 'Practice & Remember', icon: '🧠', color: '#8b5cf6', description: 'Strengthening your memory through practice' },
  feedback_repair: { label: 'Fixing Gaps', icon: '🔧', color: '#ef4444', description: 'Clearing up misunderstandings' },
  metacognition: { label: 'Self-Check', icon: '🪞', color: '#14b8a6', description: 'Reflecting on how you learn' },
  mastery_check: { label: 'Mastery Test', icon: '🏆', color: '#f97316', description: 'Proving what you know' },
  tiered_support: { label: 'Extra Help', icon: '🤝', color: '#ec4899', description: 'Getting additional support' },
};

const BAND_COLORS: Record<string, string> = {
  foundation: '#ef4444', emerging: '#f59e0b', developing: '#3b82f6', secure: '#22c55e', advanced: '#8b5cf6',
};

const BAND_LABELS: Record<string, string> = {
  foundation: 'Foundation', emerging: 'Emerging', developing: 'Developing', secure: 'Secure', advanced: 'Advanced',
};

export default function PedagogyDashboard() {
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);

  // Load subjects
  useEffect(() => {
    fetch('/api/subjects')
      .then(r => r.json())
      .then(d => {
        const subs = d.subjects || d.data || [];
        setSubjects(subs);
        if (subs.length > 0 && !subjectId) setSubjectId(subs[0].id);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Learning Engine</h1>
          <p className="text-gray-400 text-sm">Your adaptive learning path powered by evidence-based pedagogy</p>
        </div>
        {subjects.length > 1 && (
          <select
            value={subjectId || ''}
            onChange={e => setSubjectId(e.target.value)}
            aria-label="Select subject"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            {subjects.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {subjectId ? <PedagogyContent subjectId={subjectId} /> : (
        <Card className="p-8 text-center">
          <p className="text-gray-400">Select a subject to view your learning engine</p>
        </Card>
      )}
    </div>
  );
}

function PedagogyContent({ subjectId }: { subjectId: string }) {
  const { state, route, dueRetrievalCount, activeMisconceptionCount, loading } = useLearnerState(subjectId);
  const { dueItems } = useRetrieval();
  const { misconceptions } = useMisconceptions();
  const { checkpoints } = useMasteryHistory(subjectId);
  const { events } = useModuleEvents(state?.id);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  if (!state) {
    return (
      <Card className="p-8 text-center">
        <span className="text-5xl mb-4 block">🚀</span>
        <h2 className="text-xl font-bold text-white mb-2">Ready to Start Learning?</h2>
        <p className="text-gray-400 mb-4">The engine will adapt to your needs as you learn.</p>
        <Link
          href={`/pedagogy/start?subject_id=${subjectId}`}
          className="inline-block px-6 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700"
        >
          Begin Learning
        </Link>
      </Card>
    );
  }

  const moduleInfo = MODULE_INFO[state.current_module] || MODULE_INFO.diagnostic;
  const bandColor = BAND_COLORS[state.current_band] || BAND_COLORS.foundation;

  return (
    <div className="space-y-6">
      {/* Buddy message based on route */}
      {route && (
        <BuddyBubble
          message={getBuddyMessage(state, route)}
          mood={route.priority === 'escalated' ? 'thinking' : route.priority === 'urgent' ? 'thinking' : 'encouraging'}
          className="mb-2"
        />
      )}

      {/* Current Module + Band */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Module */}
        <Card className="p-5">
          <p className="text-[10px] text-gray-500 uppercase mb-2">Current Module</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: moduleInfo.color + '20' }}>
              {moduleInfo.icon}
            </div>
            <div>
              <p className="text-white font-bold">{moduleInfo.label}</p>
              <p className="text-xs text-gray-400">{moduleInfo.description}</p>
            </div>
          </div>
        </Card>

        {/* Mastery Band */}
        <Card className="p-5">
          <p className="text-[10px] text-gray-500 uppercase mb-2">Mastery Level</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: bandColor + '20' }}>
              <span className="text-2xl font-bold" style={{ color: bandColor }}>{Math.round(state.mastery_total)}</span>
            </div>
            <div>
              <p className="text-white font-bold">{BAND_LABELS[state.current_band]}</p>
              <p className="text-xs text-gray-400">Score: {state.mastery_total.toFixed(1)}/100</p>
            </div>
          </div>
          {/* Band progress bar */}
          <div className="mt-3 flex gap-1">
            {['foundation', 'emerging', 'developing', 'secure', 'advanced'].map(band => (
              <div
                key={band}
                className="h-2 flex-1 rounded-full"
                style={{
                  backgroundColor: state.current_band === band ? BAND_COLORS[band] : '#374151',
                  opacity: state.current_band === band ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        </Card>

        {/* Support Tier */}
        <Card className="p-5">
          <p className="text-[10px] text-gray-500 uppercase mb-2">Support Level</p>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
              state.support_tier === 1 ? 'bg-green-600/20' :
              state.support_tier === 2 ? 'bg-yellow-600/20' : 'bg-red-600/20'
            }`}>
              {state.support_tier === 1 ? '🟢' : state.support_tier === 2 ? '🟡' : '🔴'}
            </div>
            <div>
              <p className="text-white font-bold">
                Tier {state.support_tier}
                {state.support_tier === 1 ? ' — Standard' : state.support_tier === 2 ? ' — Extra Help' : ' — Intensive'}
              </p>
              <p className="text-xs text-gray-400">
                {state.support_tier === 1 ? 'Core learning path' : state.support_tier === 2 ? 'Targeted support active' : 'Individualized path'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 7-Component Mastery Breakdown */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-white mb-4">Mastery Breakdown</h2>
        <div className="space-y-3">
          {[
            { key: 'recall', label: 'Recall', max: 20, value: state.mastery_score_recall },
            { key: 'comprehension', label: 'Comprehension', max: 20, value: state.mastery_score_comprehension },
            { key: 'application', label: 'Application', max: 20, value: state.mastery_score_application },
            { key: 'transfer', label: 'Transfer', max: 15, value: state.mastery_score_transfer },
            { key: 'retention', label: 'Retention', max: 10, value: state.mastery_score_retention },
            { key: 'metacognition', label: 'Metacognition', max: 10, value: state.mastery_score_metacognition },
            { key: 'independence', label: 'Independence', max: 5, value: state.mastery_score_independence },
          ].map(comp => {
            const pct = comp.max > 0 ? (comp.value / comp.max) * 100 : 0;
            const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#3b82f6' : pct >= 25 ? '#f59e0b' : '#ef4444';
            return (
              <div key={comp.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{comp.label}</span>
                  <span className="text-xs text-white">{comp.value.toFixed(1)} / {comp.max}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Items */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-white mb-4">What To Do Next</h2>
          <div className="space-y-3">
            {route && (
              <ActionItem
                icon={MODULE_INFO[route.next_module]?.icon || '📋'}
                label={MODULE_INFO[route.next_module]?.label || route.next_module}
                description={route.reason}
                priority={route.priority}
                href={getModuleLink(route.next_module, subjectId, state.topic_id)}
              />
            )}
            {dueRetrievalCount > 0 && (
              <ActionItem
                icon="🧠"
                label={`${dueRetrievalCount} Review Items Due`}
                description="Spaced repetition items ready for practice"
                priority="normal"
                href={`/pedagogy/practice?subject_id=${subjectId}`}
              />
            )}
            {activeMisconceptionCount > 0 && (
              <ActionItem
                icon="🔧"
                label={`${activeMisconceptionCount} Misconceptions to Fix`}
                description="Active misunderstandings that need attention"
                priority="urgent"
                href={`/pedagogy/misconceptions?subject_id=${subjectId}`}
              />
            )}
          </div>
        </Card>

        {/* Quick Stats */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-white mb-4">Learning Stats</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatBox label="Sessions" value={state.sessions_count} icon="📊" />
            <StatBox label="Total Time" value={`${Math.round(state.total_time_minutes)}m`} icon="⏱️" />
            <StatBox label="Streak" value={`${state.streak_days}d`} icon="🔥" />
            <StatBox label="Retrieval Strength" value={`${state.retrieval_strength.toFixed(0)}%`} icon="💪" />
            <StatBox label="Confidence Calibration" value={`${state.confidence_calibration.toFixed(0)}%`} icon="🎯" />
            <StatBox label="Scaffold Level" value={`${state.scaffold_level}/5`} icon="🏗️" />
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      {events.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-bold text-white mb-4">Recent Activity</h2>
          <div className="space-y-2">
            {events.slice(0, 8).map((event: any) => {
              const info = MODULE_INFO[event.module] || { icon: '📋', label: event.module };
              return (
                <div key={event.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                  <span className="text-lg">{info.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{info.label}: {event.trigger_reason}</p>
                    <p className="text-[10px] text-gray-500">
                      {event.outcome && <span className={`mr-2 ${event.outcome === 'promoted' ? 'text-green-400' : event.outcome === 'fallback' ? 'text-red-400' : 'text-gray-400'}`}>{event.outcome}</span>}
                      {new Date(event.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {event.score_after !== null && (
                    <span className="text-xs text-gray-400">{event.score_after?.toFixed(0)}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Mastery History */}
      {checkpoints.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-bold text-white mb-4">Mastery Checkpoints</h2>
          <div className="space-y-2">
            {checkpoints.slice(0, 5).map((cp: any) => (
              <div key={cp.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div>
                  <p className="text-sm text-white">{cp.checkpoint_type.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-gray-500">{new Date(cp.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold" style={{ color: BAND_COLORS[cp.band] || '#9ca3af' }}>
                    {cp.total_score?.toFixed(0) || 0}/100
                  </span>
                  {cp.promoted ? (
                    <span className="text-xs px-2 py-0.5 bg-green-600/20 text-green-400 rounded">Promoted</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded">In Progress</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// --- Sub-components ---

function ActionItem({ icon, label, description, priority, href }: {
  icon: string; label: string; description: string; priority: string; href: string;
}) {
  return (
    <Link href={href} className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:border-primary-500 ${
      priority === 'escalated' ? 'bg-red-900/20 border-red-500/40' :
      priority === 'urgent' ? 'bg-yellow-900/20 border-yellow-500/40' :
      'bg-gray-800 border-gray-700'
    }`}>
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-[10px] text-gray-400">{description}</p>
      </div>
      <span className="text-gray-500 text-sm">→</span>
    </Link>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="p-3 bg-gray-800 rounded-lg text-center">
      <span className="text-lg">{icon}</span>
      <p className="text-lg font-bold text-white mt-1">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}

function getBuddyMessage(state: any, route: any): string {
  if (route.priority === 'escalated') {
    return "I can see you're finding this tough. Let's slow down and get you some extra help. You're not alone in this!";
  }
  if (route.priority === 'urgent' && route.next_module === 'feedback_repair') {
    return "I noticed a pattern in your answers. Let's clear up a misunderstanding before moving forward — it'll make everything easier!";
  }
  if (route.next_module === 'mastery_check') {
    return `You've been doing great! Ready to show what you know? Let's take a mastery check.`;
  }
  if (route.next_module === 'retrieve_retain') {
    return "Time for some spaced practice! This is how we make sure you remember things long-term.";
  }
  if (route.next_module === 'metacognition') {
    return "Let's take a moment to reflect on your learning. How well do you think you understand this?";
  }
  if (state.current_band === 'advanced') {
    return "You're in the Advanced band — incredible work! Keep pushing for mastery.";
  }
  return "Let's keep learning! Every step forward counts.";
}

function getModuleLink(module: string, subjectId: string, topicId?: string | null): string {
  const base = `/pedagogy/${module.replace(/_/g, '-')}`;
  const params = new URLSearchParams({ subject_id: subjectId });
  if (topicId) params.set('topic_id', topicId);
  return `${base}?${params}`;
}
