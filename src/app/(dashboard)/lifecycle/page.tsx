'use client';

import React, { useState } from 'react';
import { useLifecycleProgress, useEducationLevels, useMyTeams } from '@/hooks/learning-teams';
import { LearningRoad } from '@/components/ui/upgrade';
import { Card, LoadingSpinner } from '@/components/ui/index';
import Link from 'next/link';

const LEVEL_GROUP_INFO: Record<string, { label: string; icon: string; color: string }> = {
  primary: { label: 'Primary School', icon: '🌱', color: '#22c55e' },
  upper_primary: { label: 'Upper Primary', icon: '🌿', color: '#10b981' },
  secondary: { label: 'Secondary (Madhyamik)', icon: '📚', color: '#3b82f6' },
  higher_secondary: { label: 'Higher Secondary', icon: '🎓', color: '#8b5cf6' },
  undergraduate: { label: 'Bachelor\'s Degree', icon: '🏛️', color: '#6366f1' },
  postgraduate: { label: 'Master\'s Degree', icon: '🎯', color: '#ec4899' },
  doctoral: { label: 'Doctoral', icon: '🔬', color: '#ef4444' },
  professional: { label: 'Professional', icon: '💼', color: '#f59e0b' },
};

const STYLE_ICONS: Record<string, string> = {
  visual_spatial: '👁️', auditory_musical: '👂', reading_writing: '📖',
  kinesthetic_tactile: '🤲', logical_mathematical: '🧮', social_interpersonal: '🤝',
  solitary_intrapersonal: '🧘', naturalistic: '🌿',
};

export default function LifecyclePage() {
  const { levels, loading: levelsLoading } = useEducationLevels();
  const { progress, loading: progressLoading } = useLifecycleProgress();
  const { memberships } = useMyTeams();
  const [activeGroup, setActiveGroup] = useState<string>('all');

  const loading = levelsLoading || progressLoading;
  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  // Group levels by level_group
  const groups = levels.reduce<Record<string, typeof levels>>((acc, level) => {
    if (!acc[level.level_group]) acc[level.level_group] = [];
    acc[level.level_group].push(level);
    return acc;
  }, {});

  // Build road steps for LearningRoad
  const roadSteps = levels.map(level => {
    const prog = progress.find(p => p.education_level_code === level.code);
    const isActive = prog?.status === 'active';
    const isCompleted = prog?.status === 'completed';

    return {
      id: level.code,
      title: level.name,
      description: level.age_range
        ? `Age ${level.age_range} | ${LEVEL_GROUP_INFO[level.level_group]?.label || level.level_group}`
        : LEVEL_GROUP_INFO[level.level_group]?.label || level.level_group,
      status: isCompleted ? 'completed' as const
        : isActive ? 'in_progress' as const
        : prog ? 'available' as const
        : 'locked' as const,
      xp: isCompleted ? undefined : (level.level_order * 100),
      icon: LEVEL_GROUP_INFO[level.level_group]?.icon,
    };
  });

  // Current team style
  const generalTeam = memberships.find(m => !m.subject_id);

  // Filter levels by group
  const filteredGroups = activeGroup === 'all'
    ? Object.entries(groups)
    : Object.entries(groups).filter(([key]) => key === activeGroup);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">My Learning Lifecycle</h1>
          <p className="text-gray-400 text-sm">
            Your learning style carries you from Class 1 to Master's degree and beyond.
          </p>
        </div>
        {generalTeam && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl border border-gray-700">
            <span className="text-xl">{STYLE_ICONS[generalTeam.style_code]}</span>
            <div>
              <p className="text-[10px] text-gray-500">My Style</p>
              <p className="text-sm font-medium text-white capitalize">{generalTeam.style_code.replace(/_/g, ' ')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Group filter tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveGroup('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
            activeGroup === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700'
          }`}
        >
          Full Journey
        </button>
        {Object.entries(LEVEL_GROUP_INFO).map(([key, info]) => (
          groups[key] ? (
            <button
              key={key}
              onClick={() => setActiveGroup(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeGroup === key ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              <span>{info.icon}</span> {info.label}
            </button>
          ) : null
        ))}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-white">{progress.filter(p => p.status === 'completed').length}</p>
          <p className="text-xs text-gray-400">Levels Completed</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary-400">{progress.filter(p => p.status === 'active').length}</p>
          <p className="text-xs text-gray-400">Currently Active</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">
            {progress.reduce((sum, p) => sum + (p.topics_mastered || 0), 0)}
          </p>
          <p className="text-xs text-gray-400">Topics Mastered</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-400">
            {progress.reduce((sum, p) => sum + (p.total_study_hours || 0), 0).toFixed(0)}h
          </p>
          <p className="text-xs text-gray-400">Total Study Time</p>
        </Card>
      </div>

      {/* Road Map View */}
      {activeGroup === 'all' ? (
        <Card className="p-6">
          <h2 className="text-lg font-bold text-white mb-4">Complete Learning Road</h2>
          <LearningRoad steps={roadSteps} />
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredGroups.map(([groupKey, groupLevels]) => {
            const groupInfo = LEVEL_GROUP_INFO[groupKey];
            return (
              <Card key={groupKey} className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{groupInfo?.icon}</span>
                  <h2 className="text-lg font-bold text-white">{groupInfo?.label}</h2>
                </div>

                {groupLevels.map(level => {
                  const prog = progress.find(p => p.education_level_code === level.code);
                  const percentage = prog && prog.chapters_total > 0
                    ? Math.round((prog.chapters_completed / prog.chapters_total) * 100) : 0;

                  return (
                    <div key={level.code} className="mb-4 last:mb-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{level.name}</span>
                          {level.age_range && <span className="text-xs text-gray-500">Age {level.age_range}</span>}
                          {prog?.style_code && (
                            <span className="text-sm">{STYLE_ICONS[prog.style_code]}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {prog && (
                            <span className="text-xs text-gray-400">
                              {prog.chapters_completed}/{prog.chapters_total} chapters
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            prog?.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            prog?.status === 'active' ? 'bg-primary-500/20 text-primary-400' :
                            'bg-gray-700 text-gray-500'
                          }`}>
                            {prog?.status || 'not started'}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: groupInfo?.color || '#8b5cf6',
                          }}
                        />
                      </div>
                      {prog?.avg_comprehension ? (
                        <p className="text-[10px] text-gray-500 mt-1">
                          Comprehension: {Math.round(prog.avg_comprehension)}% | {prog.total_study_hours || 0}h studied
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </Card>
            );
          })}
        </div>
      )}

      {/* CTA if no progress yet */}
      {progress.length === 0 && (
        <Card className="p-8 text-center mt-6">
          <span className="text-4xl block mb-3">🚀</span>
          <h3 className="text-lg font-bold text-white mb-2">Start Your Learning Journey</h3>
          <p className="text-sm text-gray-400 mb-4">
            First, discover your learning style. Then your journey will be mapped through every level.
          </p>
          <Link href="/style-discovery" className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 inline-block">
            Discover My Style
          </Link>
        </Card>
      )}
    </div>
  );
}
