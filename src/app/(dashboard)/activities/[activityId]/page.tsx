'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Activity } from '@/types/upgrade';
import { useActivities } from '@/hooks/upgrade';
import { LoadingSpinner } from '@/components/ui/index';
import {
  GameWrapper,
  WordPuzzle,
  NumberGame,
  ConceptMatch,
  SequenceArrange,
  CaseStudy,
  TimedChallenge,
  VirtualLab,
  CreativeProject,
} from '@/components/games';

const ACTIVITY_ICONS: Record<string, string> = {
  word_puzzle: '🔤', number_game: '🔢', drag_drop: '🎯', case_study: '📋',
  virtual_lab: '🔬', timed_challenge: '⚡', creative_project: '🎨',
  simulation: '🌐', sequence_arrange: '📝', concept_match: '🔗',
};

type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  hard: 'bg-red-500/20 text-red-400 border-red-500/30',
};

interface GameProps {
  config: Activity['config'];
  addScore: (points: number) => void;
  setGameComplete: () => void;
  maxScore: number;
}

function ActivityPlayer({ config, addScore, setGameComplete, maxScore }: GameProps) {
  const commonProps = { addScore, setGameComplete, maxScore };

  switch (config.type) {
    case 'word_puzzle':
      return <WordPuzzle config={config} {...commonProps} />;
    case 'number_game':
      return <NumberGame config={config} {...commonProps} />;
    case 'concept_match':
      return <ConceptMatch config={config} {...commonProps} />;
    case 'sequence_arrange':
      return <SequenceArrange config={config} {...commonProps} />;
    case 'case_study':
      return <CaseStudy config={config} {...commonProps} />;
    case 'timed_challenge':
      return <TimedChallenge config={config} {...commonProps} />;
    case 'virtual_lab':
      return <VirtualLab config={config} {...commonProps} />;
    case 'creative_project':
      return <CreativeProject config={config} {...commonProps} />;
    default:
      return (
        <div className="text-center p-8">
          <p className="text-gray-400 text-lg">This activity type is coming soon!</p>
          <p className="text-gray-500 text-sm mt-2">Activity type: {(config as any).type}</p>
        </div>
      );
  }
}

export default function ActivityPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const activityId = params.activityId as string;
  const { activities, loading, submitAttempt } = useActivities();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; xp: number } | null>(null);

  useEffect(() => {
    if (activities.length > 0) {
      const found = activities.find(a => a.id === activityId);
      setActivity(found || null);
    }
  }, [activities, activityId]);

  const handleComplete = useCallback(async (score: number, timeTaken: number) => {
    if (submitted) return;
    setSubmitted(true);

    try {
      const success = await submitAttempt({
        activity_id: activityId,
        score,
        max_score: activity?.max_score || 100,
        time_taken_seconds: timeTaken,
        completed: true,
      });
      setResult({ score, xp: success ? (activity?.xp_reward || 0) : 0 });
    } catch {
      setResult({ score, xp: 0 });
    }
  }, [submitted, activityId, submitAttempt, activity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-6xl mb-4">🔍</p>
        <h2 className="text-2xl font-bold text-white mb-2">Activity Not Found</h2>
        <p className="text-gray-400 mb-6">This activity may have been removed or doesn't exist.</p>
        <button
          onClick={() => router.push('/activities')}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Back to Activities
        </button>
      </div>
    );
  }

  if (result) {
    const percentage = Math.round((result.score / activity.max_score) * 100);
    const isGreat = percentage >= 80;

    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-6xl mb-4">{isGreat ? '🎉' : '💪'}</p>
        <h2 className="text-3xl font-bold text-white mb-2">
          {isGreat ? 'Excellent Work!' : 'Good Effort!'}
        </h2>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-3xl font-bold text-white">{result.score}</p>
            <p className="text-xs text-gray-400 mt-1">Score</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-3xl font-bold text-white">{percentage}%</p>
            <p className="text-xs text-gray-400 mt-1">Accuracy</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-3xl font-bold text-accent-400">+{result.xp}</p>
            <p className="text-xs text-gray-400 mt-1">XP Earned</p>
          </div>
        </div>

        <div className="mt-8 flex gap-3 justify-center">
          <button
            onClick={() => { setSubmitted(false); setResult(null); }}
            className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Try Again
          </button>
          <button
            onClick={() => router.push('/activities')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            More Activities
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/activities')}
          className="text-gray-400 hover:text-white text-sm mb-3 flex items-center gap-1"
        >
          ← Back to Activities
        </button>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{ACTIVITY_ICONS[activity.activity_type] || '🎮'}</span>
          <div>
            <h1 className="text-2xl font-bold text-white">{activity.title}</h1>
            {activity.description && (
              <p className="text-gray-400 text-sm mt-1">{activity.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span className={`text-xs px-2 py-1 rounded-full border ${DIFFICULTY_COLORS[activity.difficulty]}`}>
            Level {activity.difficulty}
          </span>
          {activity.time_limit_seconds && (
            <span className="text-xs text-gray-500">⏱ {Math.round(activity.time_limit_seconds / 60)} min</span>
          )}
          <span className="text-xs text-accent-400">🏆 {activity.xp_reward} XP</span>
          <span className="text-xs text-gray-500">Max: {activity.max_score} pts</span>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
        <GameWrapper
          title={activity.title}
          difficulty={activity.difficulty}
          timeLimit={activity.time_limit_seconds || undefined}
          maxScore={activity.max_score}
          xpReward={activity.xp_reward}
          onComplete={handleComplete}
        >
          {({ addScore, setGameComplete }) => (
            <ActivityPlayer
              config={activity.config}
              addScore={addScore}
              setGameComplete={setGameComplete}
              maxScore={activity.max_score}
            />
          )}
        </GameWrapper>
      </div>
    </div>
  );
}
