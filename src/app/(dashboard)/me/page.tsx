'use client';

import React, { useState } from 'react';
import { useDevProfile, useHabits, useGoals, useReflections, useBadges, useFeedback, useInterests } from '@/hooks/student-development';
import { Card, LoadingSpinner, Button } from '@/components/ui/index';
import { BuddyBubble } from '@/components/ui/upgrade';
import Link from 'next/link';
import MyNotebook from '@/components/MyNotebook';

const PILLAR_CONFIG = {
  academic: { label: 'Learn', icon: '📚', color: '#3b82f6', path: '/pedagogy' },
  cognitive: { label: 'Think', icon: '🧠', color: '#8b5cf6', path: '/think' },
  character: { label: 'Grow', icon: '🌱', color: '#22c55e', path: '/grow' },
  life_readiness: { label: 'Live', icon: '🌍', color: '#f59e0b', path: '/live' },
};

const DIMENSION_ICONS: Record<string, string> = {
  focus: '🎯', memory_habits: '🧠', reasoning: '🔍', problem_solving: '🧩',
  reflection: '🪞', decision_making: '⚖️', self_learning: '📚', curiosity: '🔭',
  discipline: '📏', patience: '⏳', honesty: '💎', empathy: '💗',
  responsibility: '🛡️', consistency: '📈', failure_handling: '🔥', confidence: '💪',
  emotional_regulation: '🧘', social_conduct: '🤝', communication: '🗣️',
  financial_awareness: '💰', digital_safety: '🔒', time_management: '⏰',
  real_world_problem_solving: '🌍', career_awareness: '🧭', teamwork: '👥', practical_skills: '🔧',
};

export default function MeDashboard() {
  const { profile, archetypes, concerns, domainAffinities, loading, initProfile } = useDevProfile();
  const { myHabits } = useHabits();
  const { goals } = useGoals(undefined, 'active');
  const { reflections } = useReflections();
  const { badges } = useBadges();
  const { feedback } = useFeedback();
  const { interests } = useInterests();
  const [tab, setTab] = useState<'overview' | 'think' | 'grow' | 'live' | 'path' | 'notebook'>('overview');

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="p-8 text-center">
          <span className="text-6xl block mb-4">🌟</span>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to Your Growth Journey</h1>
          <p className="text-gray-400 mb-2 max-w-md mx-auto">
            MyCupIsEmpty is not just about marks. It helps you grow as a whole person —
            your thinking, your character, and your life skills.
          </p>
          <p className="text-gray-500 text-sm mb-6">Let's set up your development profile.</p>
          <button
            onClick={initProfile}
            className="px-8 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700"
          >
            Start My Journey
          </button>
        </Card>
      </div>
    );
  }

  const overallScore = Math.round((profile.cognitive_composite + profile.character_composite + profile.life_readiness_composite) / 3);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Development</h1>
          <p className="text-gray-400 text-sm">Learn. Think. Grow. Live.</p>
        </div>
        <div className="flex items-center gap-2">
          {badges.length > 0 && (
            <Link href="/badges" className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-yellow-400">
              <span>{(badges[0] as any)?.development_badges?.icon || '🏅'}</span>
              <span>{badges.length} badges</span>
            </Link>
          )}
        </div>
      </div>

      {/* Buddy */}
      <BuddyBubble
        message={getBuddyMessage(profile, archetypes, concerns)}
        mood={concerns.length > 0 ? 'thinking' : 'encouraging'}
        className="mb-6"
      />

      {/* 4-Pillar Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Object.entries(PILLAR_CONFIG).map(([key, config]) => {
          const score = key === 'academic' ? null :
            key === 'cognitive' ? profile.cognitive_composite :
            key === 'character' ? profile.character_composite :
            profile.life_readiness_composite;

          return (
            <Link key={key} href={config.path} className="block">
              <div className="p-4 rounded-xl border border-gray-700 hover:border-opacity-60 transition-all" style={{ borderColor: config.color + '40', backgroundColor: config.color + '08' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{config.icon}</span>
                  <span className="text-sm font-bold text-white">{config.label}</span>
                </div>
                {score !== null ? (
                  <>
                    <p className="text-3xl font-bold" style={{ color: config.color }}>{Math.round(score)}</p>
                    <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: config.color }} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Academic mastery via Pedagogy Engine</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(['overview', 'think', 'grow', 'live', 'path', 'notebook'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              tab === t ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'overview' ? 'Overview' : t === 'think' ? '🧠 Think' : t === 'grow' ? '🌱 Grow' : t === 'live' ? '🌍 Live' : t === 'path' ? '🧭 Path' : '📓 Notebook'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab profile={profile} archetypes={archetypes} myHabits={myHabits} goals={goals} reflections={reflections} feedback={feedback} concerns={concerns} />}
      {tab === 'think' && <PillarTab profile={profile} pillar="cognitive" />}
      {tab === 'grow' && <PillarTab profile={profile} pillar="character" />}
      {tab === 'live' && <PillarTab profile={profile} pillar="life_readiness" />}
      {tab === 'path' && <PathTab domainAffinities={domainAffinities} interests={interests} archetypes={archetypes} />}
      {tab === 'notebook' && <MyNotebook />}
    </div>
  );
}

// --- Overview Tab ---
function OverviewTab({ profile, archetypes, myHabits, goals, reflections, feedback, concerns }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Today's Habits */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Today's Habits</h2>
            <Link href="/habits" className="text-xs text-primary-400 hover:text-primary-300">Manage habits →</Link>
          </div>
          {myHabits.length > 0 ? (
            <div className="space-y-2">
              {myHabits.slice(0, 6).map((h: any) => (
                <div key={h.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{h.habit_definitions?.icon || '📋'}</span>
                    <div>
                      <p className="text-sm text-white">{h.habit_definitions?.name || 'Habit'}</p>
                      <p className="text-[10px] text-gray-500">
                        {h.current_streak > 0 ? `🔥 ${h.current_streak} day streak` : 'Start today!'}
                      </p>
                    </div>
                  </div>
                  <Link href="/habits" className="px-3 py-1 bg-gray-700 rounded text-xs text-white hover:bg-gray-600">Track</Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm mb-2">No habits yet</p>
              <Link href="/habits" className="text-xs text-primary-400">Add your first habit →</Link>
            </div>
          )}
        </Card>

        {/* Active Goals */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Active Goals</h2>
            <Link href="/goals" className="text-xs text-primary-400 hover:text-primary-300">All goals →</Link>
          </div>
          {goals.length > 0 ? (
            <div className="space-y-2">
              {goals.slice(0, 4).map((g: any) => {
                const pct = g.target_value ? (g.current_value / g.target_value) * 100 : 0;
                const pillarConfig = PILLAR_CONFIG[g.pillar as keyof typeof PILLAR_CONFIG];
                return (
                  <div key={g.id} className="p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-white">{g.title}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: pillarConfig?.color + '20', color: pillarConfig?.color }}>
                        {pillarConfig?.label || g.pillar}
                      </span>
                    </div>
                    {g.target_value && (
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pillarConfig?.color || '#6366f1' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm mb-2">No active goals</p>
              <Link href="/goals" className="text-xs text-primary-400">Set a goal →</Link>
            </div>
          )}
        </Card>

        {/* Unread Feedback */}
        {feedback.filter((f: any) => !f.student_acknowledged).length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-bold text-white mb-4">New Feedback</h2>
            {feedback.filter((f: any) => !f.student_acknowledged).slice(0, 3).map((f: any) => (
              <div key={f.id} className="p-3 bg-gray-800 rounded-lg mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{f.feedback_type === 'encouragement' ? '💪' : f.feedback_type === 'milestone' ? '🎉' : f.feedback_type === 'suggestion' ? '💡' : '👀'}</span>
                  <span className="text-xs text-gray-400 capitalize">{f.mentor_role} — {f.feedback_type}</span>
                </div>
                <p className="text-sm text-gray-200">{f.message}</p>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Archetype */}
        {archetypes.length > 0 && (
          <Card className="p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Your Pattern</h3>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">🔮</span>
              <div>
                <p className="text-white font-bold">{archetypes[0].label}</p>
                <p className="text-xs text-gray-400">{archetypes[0].description}</p>
              </div>
            </div>
            {archetypes[0].growth_focus.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 mb-1">Growth focus areas:</p>
                <div className="flex flex-wrap gap-1">
                  {archetypes[0].growth_focus.map((dim: string) => (
                    <span key={dim} className="text-[10px] px-2 py-0.5 bg-gray-800 rounded text-gray-300 capitalize">
                      {DIMENSION_ICONS[dim] || ''} {dim.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Quick Reflect */}
        <Card className="p-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Quick Reflect</h3>
          <Link href="/reflect" className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750">
            <span className="text-2xl">🪞</span>
            <div>
              <p className="text-sm text-white">Daily Reflection</p>
              <p className="text-[10px] text-gray-500">Take 2 minutes to reflect</p>
            </div>
          </Link>
        </Card>

        {/* Concerns (subtle) */}
        {concerns.length > 0 && (
          <Card className="p-6 border-yellow-500/20">
            <h3 className="text-sm font-bold text-yellow-400 uppercase mb-3">Areas to Watch</h3>
            {concerns.slice(0, 3).map((c: any, i: number) => (
              <p key={i} className="text-xs text-gray-400 mb-2">
                {DIMENSION_ICONS[c.dimension] || '⚠️'} {c.message}
              </p>
            ))}
          </Card>
        )}

        {/* Badges Preview */}
        <Card className="p-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Recent Badges</h3>
          <div className="flex flex-wrap gap-2">
            {/* Always show at least a placeholder */}
            {[...Array(Math.max(3, 0))].map((_, i) => (
              <div key={i} className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-xl opacity-30">🏅</div>
            ))}
          </div>
          <Link href="/badges" className="text-xs text-primary-400 mt-2 block">View all →</Link>
        </Card>
      </div>
    </div>
  );
}

// --- Pillar Detail Tab ---
function PillarTab({ profile, pillar }: { profile: any; pillar: 'cognitive' | 'character' | 'life_readiness' }) {
  const dims = pillar === 'cognitive'
    ? ['focus', 'memory_habits', 'reasoning', 'problem_solving', 'reflection', 'decision_making', 'self_learning', 'curiosity']
    : pillar === 'character'
    ? ['discipline', 'patience', 'honesty', 'empathy', 'responsibility', 'consistency', 'failure_handling', 'confidence', 'emotional_regulation', 'social_conduct']
    : ['communication', 'financial_awareness', 'digital_safety', 'time_management', 'real_world_problem_solving', 'career_awareness', 'teamwork', 'practical_skills'];

  const composite = pillar === 'cognitive' ? profile.cognitive_composite :
                    pillar === 'character' ? profile.character_composite :
                    profile.life_readiness_composite;

  const config = pillar === 'cognitive' ? { label: 'Think', color: '#8b5cf6' } :
                 pillar === 'character' ? { label: 'Grow', color: '#22c55e' } :
                 { label: 'Live', color: '#f59e0b' };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{config.label} — Dimension Scores</h2>
          <span className="text-2xl font-bold" style={{ color: config.color }}>{Math.round(composite)}/100</span>
        </div>
        <div className="space-y-3">
          {dims.map(dim => {
            const score = profile[`${dim}_score`] || 50;
            const color = score >= 70 ? '#22c55e' : score >= 50 ? config.color : score >= 30 ? '#f59e0b' : '#ef4444';
            return (
              <div key={dim}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-300 flex items-center gap-1">
                    <span>{DIMENSION_ICONS[dim] || '📊'}</span>
                    <span className="capitalize">{dim.replace(/_/g, ' ')}</span>
                  </span>
                  <span className="text-xs font-bold text-white">{Math.round(score)}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// --- Path Tab ---
function PathTab({ domainAffinities, interests, archetypes }: any) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-bold text-white mb-4">Your Domain Affinities</h2>
        <p className="text-xs text-gray-400 mb-4">Based on your development scores, here's where your strengths naturally align:</p>
        <div className="space-y-3">
          {(domainAffinities || []).map((da: any) => (
            <div key={da.code}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white">{da.label}</span>
                <span className="text-sm font-bold text-primary-400">{da.affinity}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${da.affinity}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {interests.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-bold text-white mb-4">Your Interests</h2>
          <div className="flex flex-wrap gap-2">
            {interests.map((i: any) => (
              <span key={i.id} className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-white capitalize">
                {i.interest_area.replace(/_/g, ' ')}
                <span className="text-[10px] text-gray-500 ml-1">({i.strength_level})</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/20">
        <div className="flex items-center gap-4">
          <span className="text-4xl">🧭</span>
          <div>
            <h3 className="text-lg font-bold text-white">Discover Your Path</h3>
            <p className="text-sm text-gray-300">Not everyone is meant to be a scientist. Find what fits you best.</p>
          </div>
          <Link href="/path-discovery" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm whitespace-nowrap hover:bg-primary-700">
            Take Assessment
          </Link>
        </div>
      </Card>
    </div>
  );
}

// --- Helper ---
function getBuddyMessage(profile: any, archetypes: any[], concerns: any[]): string {
  if (concerns.some((c: any) => c.severity === 'urgent')) {
    return "I notice some areas where you might need extra support. Remember, asking for help is a sign of strength, not weakness.";
  }
  if (archetypes.length > 0) {
    return `Your pattern shows you're a "${archetypes[0].label}". ${archetypes[0].description}. Let's keep building on your strengths!`;
  }
  const overall = Math.round((profile.cognitive_composite + profile.character_composite + profile.life_readiness_composite) / 3);
  if (overall >= 70) return "You're developing really well across all areas. Keep up the great work!";
  if (overall >= 50) return "Steady progress! Every small step counts. Let's focus on your growth areas today.";
  return "Every journey starts somewhere. Let's work on building good habits — that's the foundation of everything.";
}
