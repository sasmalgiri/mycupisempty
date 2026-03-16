'use client';

import React from 'react';
import { useChallenges } from '@/hooks/upgrade';
import { Card, Badge, Button, LoadingSpinner } from '@/components/ui/index';
import { Timer } from '@/components/ui/upgrade';

const TYPE_ICONS: Record<string, string> = {
  speed: '⚡', accuracy: '🎯', creative: '🎨', collaborative: '🤝',
};

export default function ChallengesPage() {
  const { challenges, loading, joinChallenge } = useChallenges();

  const active = challenges.filter(c => c.is_active && (!c.ends_at || new Date(c.ends_at) > new Date()));
  const past = challenges.filter(c => !c.is_active || (c.ends_at && new Date(c.ends_at) <= new Date()));

  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">🏆 Challenges</h1>
        <p className="text-gray-400">Compete, collaborate, and push your limits!</p>
      </div>

      {/* Active challenges */}
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        Active Challenges
        {active.length > 0 && <Badge variant="success">{active.length} live</Badge>}
      </h2>

      {active.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {active.map(challenge => {
            const timeLeft = challenge.ends_at
              ? Math.max(0, Math.floor((new Date(challenge.ends_at).getTime() - Date.now()) / 1000))
              : null;

            return (
              <Card key={challenge.id} className="p-5 border-primary-500/20">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{TYPE_ICONS[challenge.challenge_type] || '🏆'}</span>
                    <div>
                      <h3 className="font-semibold text-white">{challenge.title}</h3>
                      <Badge variant="primary">{challenge.challenge_type}</Badge>
                    </div>
                  </div>
                  {timeLeft !== null && timeLeft > 0 && (
                    <Timer totalSeconds={timeLeft} onComplete={() => {}} size="sm" />
                  )}
                </div>

                {challenge.description && (
                  <p className="text-sm text-gray-400 mb-3">{challenge.description}</p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {(challenge as any).participant_count || 0} participants
                  </span>

                  {(challenge as any).my_participation ? (
                    <Badge variant="success">Joined</Badge>
                  ) : (
                    <Button
                      onClick={() => joinChallenge(challenge.id)}
                      variant="primary"
                      size="sm"
                    >
                      Join Challenge
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center mb-10">
          <span className="text-4xl block mb-2">🏆</span>
          <p className="text-gray-400">No active challenges right now. Check back soon!</p>
        </Card>
      )}

      {/* Past challenges */}
      {past.length > 0 && (
        <>
          <h2 className="text-xl font-semibold text-white mb-4">Past Challenges</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.map(challenge => (
              <Card key={challenge.id} className="p-4 opacity-70">
                <div className="flex items-center gap-2 mb-2">
                  <span>{TYPE_ICONS[challenge.challenge_type] || '🏆'}</span>
                  <h3 className="font-medium text-white text-sm">{challenge.title}</h3>
                </div>
                {(challenge as any).my_participation && (
                  <div className="text-xs text-gray-400">
                    Your score: {(challenge as any).my_participation.score}
                    {(challenge as any).my_participation.rank && (
                      <span className="text-primary-400 ml-2">
                        Rank #{(challenge as any).my_participation.rank}
                      </span>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
