'use client';

import React, { useState, useCallback } from 'react';
import type { TimedChallengeConfig } from '@/types/upgrade';

interface TimedChallengeProps {
  config: TimedChallengeConfig;
  addScore: (points: number) => void;
  setGameComplete: () => void;
  maxScore: number;
}

export default function TimedChallenge({ config, addScore, setGameComplete, maxScore }: TimedChallengeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [streak, setStreak] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  const current = config.questions[currentIndex];

  const submitAnswer = useCallback((optionIndex: number) => {
    setSelectedOption(optionIndex);
    setShowResult(true);

    const isCorrect = optionIndex === current.correct;

    if (isCorrect) {
      const streakBonus = Math.min(streak, 5); // max 5x streak bonus
      const points = current.points + streakBonus;
      addScore(points);
      setStreak(prev => prev + 1);
    } else {
      setStreak(0);
    }

    setAnsweredCount(prev => prev + 1);

    setTimeout(() => {
      if (currentIndex < config.questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setShowResult(false);
      } else {
        setGameComplete();
      }
    }, 1000);
  }, [current, currentIndex, config.questions.length, streak, addScore, setGameComplete]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress & Streak */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 flex-1 mr-4">
          {config.questions.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i < answeredCount ? 'bg-primary-500' : 'bg-gray-700'}`}
            />
          ))}
        </div>
        {streak > 1 && (
          <div className="px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full">
            <span className="text-orange-400 text-xs font-bold">🔥 {streak}x Streak!</span>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center mb-2">
        Question {currentIndex + 1} / {config.questions.length}
      </p>

      {/* Question */}
      <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-2xl mb-4">
        <p className="text-lg text-white font-medium text-center mb-6">{current.question}</p>

        <div className="grid grid-cols-2 gap-3">
          {current.options.map((option, i) => {
            let bgClass = 'bg-gray-900 border-gray-700 hover:border-primary-500 text-gray-300';

            if (showResult) {
              if (i === current.correct) {
                bgClass = 'bg-green-500/20 border-green-500 text-green-400';
              } else if (i === selectedOption && i !== current.correct) {
                bgClass = 'bg-red-500/20 border-red-500 text-red-400';
              } else {
                bgClass = 'bg-gray-900 border-gray-800 text-gray-600';
              }
            }

            return (
              <button
                key={i}
                onClick={() => !showResult && submitAnswer(i)}
                disabled={showResult}
                className={`p-4 border-2 rounded-xl text-sm font-medium transition-all ${bgClass}`}
              >
                <span className="block text-xs opacity-50 mb-1">{String.fromCharCode(65 + i)}</span>
                {option}
              </button>
            );
          })}
        </div>

        {/* Points indicator */}
        <div className="text-center mt-3">
          <span className="text-xs text-gray-500">
            Worth: {current.points} pts
            {streak > 1 && <span className="text-orange-400"> + {Math.min(streak, 5)} streak bonus</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
