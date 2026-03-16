'use client';

import React, { useState } from 'react';
import { useActivities, useChallenges } from '@/hooks/upgrade';
import { Card, Badge, LoadingSpinner, Button } from '@/components/ui/index';
import Link from 'next/link';

const ACTIVITY_ICONS: Record<string, string> = {
  word_puzzle: '🔤', number_game: '🔢', drag_drop: '🎯', case_study: '📋',
  virtual_lab: '🔬', timed_challenge: '⚡', creative_project: '🎨',
  simulation: '🌐', sequence_arrange: '📝', concept_match: '🔗',
};

const ACTIVITY_LABELS: Record<string, string> = {
  word_puzzle: 'Word Puzzle', number_game: 'Number Game', drag_drop: 'Drag & Drop',
  case_study: 'Case Study', virtual_lab: 'Virtual Lab', timed_challenge: 'Speed Challenge',
  creative_project: 'Creative Project', simulation: 'Simulation',
  sequence_arrange: 'Sequence', concept_match: 'Concept Match',
};

export default function ActivitiesPage() {
  const [activeType, setActiveType] = useState<string>('all');
  const { activities, loading } = useActivities(
    activeType !== 'all' ? { type: activeType } : undefined
  );
  const { challenges } = useChallenges();

  const activeChallenges = challenges.filter(c => c.is_active);

  const types = ['all', 'word_puzzle', 'number_game', 'concept_match', 'sequence_arrange',
    'timed_challenge', 'case_study', 'virtual_lab', 'creative_project'];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">🎮 Activities Hub</h1>
        <p className="text-gray-400">
          Learn through games, puzzles, labs, and challenges. Fun meets education!
        </p>
      </div>

      {/* Active Challenges Banner */}
      {activeChallenges.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-500/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">
                🏆 Active Challenges
                <Badge variant="warning">{activeChallenges.length} live</Badge>
              </h3>
              <p className="text-sm text-gray-400 mt-1">{activeChallenges[0]?.title}</p>
            </div>
            <Link href="/challenges">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Type filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {types.map(type => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeType === type
                ? 'bg-primary-600 text-white'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'
            }`}
          >
            {type !== 'all' && <span>{ACTIVITY_ICONS[type]}</span>}
            {type === 'all' ? '📚 All' : ACTIVITY_LABELS[type]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : activities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map(activity => (
            <Link key={activity.id} href={`/activities/${activity.id}`}>
              <Card className="p-4 hover:border-primary-500 transition-all cursor-pointer h-full">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{ACTIVITY_ICONS[activity.activity_type] || '🎮'}</span>
                  <div className="flex gap-1">
                    <Badge variant={
                      activity.difficulty === 'easy' ? 'success' :
                      activity.difficulty === 'medium' ? 'warning' : 'danger'
                    }>
                      {activity.difficulty}
                    </Badge>
                  </div>
                </div>

                <h3 className="font-semibold text-white text-sm mb-1">{activity.title}</h3>
                {activity.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 mb-3">{activity.description}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-800">
                  <span className="text-[10px] text-gray-500">
                    {ACTIVITY_LABELS[activity.activity_type]}
                  </span>
                  <div className="flex items-center gap-2">
                    {activity.time_limit_seconds && (
                      <span className="text-[10px] text-gray-500">
                        ⏱ {Math.floor(activity.time_limit_seconds / 60)}m
                      </span>
                    )}
                    <span className="text-[10px] text-primary-400 font-bold">+{activity.xp_reward} XP</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <span className="text-5xl block mb-4">🎮</span>
          <h3 className="text-xl font-bold text-white mb-2">No Activities Yet</h3>
          <p className="text-gray-400 mb-6">
            Activities will be generated for topics as you study. Start learning a subject
            and activities will appear here!
          </p>
          <Link href="/subjects">
            <Button variant="primary">Browse Subjects</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
