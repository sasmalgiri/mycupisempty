'use client';

import React, { useState, useCallback } from 'react';
import { Timer, ScoreDisplay } from '@/components/ui/upgrade';
import { Button, Confetti } from '@/components/ui/index';

interface GameWrapperProps {
  title: string;
  description?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit?: number;
  maxScore: number;
  xpReward: number;
  onComplete: (score: number, timeTaken: number) => void;
  children: (props: {
    addScore: (points: number) => void;
    setGameComplete: () => void;
    currentScore: number;
    isComplete: boolean;
  }) => React.ReactNode;
}

export default function GameWrapper({
  title, description, difficulty, timeLimit, maxScore, xpReward, onComplete, children,
}: GameWrapperProps) {
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [startTime] = useState(Date.now());
  const [showConfetti, setShowConfetti] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const addScore = useCallback((points: number) => {
    setScore(prev => Math.min(prev + points, maxScore));
  }, [maxScore]);

  const setGameComplete = useCallback(() => {
    if (isComplete) return;
    setIsComplete(true);
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const finalScore = score;

    if (finalScore / maxScore >= 0.8) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    onComplete(finalScore, timeTaken);
  }, [isComplete, startTime, score, maxScore, onComplete]);

  const difficultyColors = {
    easy: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    hard: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  if (!isStarted) {
    return (
      <div className="max-w-lg mx-auto text-center p-8">
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        {description && <p className="text-gray-400 mb-4">{description}</p>}

        <div className="flex items-center justify-center gap-3 mb-6">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${difficultyColors[difficulty]}`}>
            {difficulty}
          </span>
          {timeLimit && (
            <span className="text-sm text-gray-400">
              ⏱️ {Math.floor(timeLimit / 60)}:{(timeLimit % 60).toString().padStart(2, '0')}
            </span>
          )}
          <span className="text-sm text-primary-400 font-medium">+{xpReward} XP</span>
        </div>

        <Button onClick={() => setIsStarted(true)} variant="primary" size="lg">
          Start Activity
        </Button>
      </div>
    );
  }

  if (isComplete) {
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    return (
      <div className="max-w-lg mx-auto text-center p-8">
        {showConfetti && <Confetti />}
        <ScoreDisplay
          score={score}
          maxScore={maxScore}
          xpEarned={Math.round(xpReward * (score / maxScore))}
          label="Activity Complete!"
        />
        <p className="text-gray-400 mt-4">
          Time: {Math.floor(timeTaken / 60)}m {timeTaken % 60}s
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Game header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${difficultyColors[difficulty]}`}>
            {difficulty}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-400">Score</p>
            <p className="text-lg font-bold text-primary-400">{score}/{maxScore}</p>
          </div>
          {timeLimit && (
            <Timer
              totalSeconds={timeLimit}
              onComplete={setGameComplete}
              size="sm"
            />
          )}
        </div>
      </div>

      {/* Game content */}
      {children({ addScore, setGameComplete, currentScore: score, isComplete })}
    </div>
  );
}
