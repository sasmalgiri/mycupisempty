'use client';

import React, { useState } from 'react';
import type { NumberGameConfig } from '@/types/upgrade';

interface NumberGameProps {
  config: NumberGameConfig;
  addScore: (points: number) => void;
  setGameComplete: () => void;
  maxScore: number;
}

export default function NumberGame({ config, addScore, setGameComplete, maxScore }: NumberGameProps) {
  const pointsPerProblem = Math.floor(maxScore / config.problems.length);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);

  const current = config.problems[currentIndex];

  const checkAnswer = () => {
    const isCorrect = Number(userAnswer) === current.answer;
    setShowResult(isCorrect);

    if (isCorrect) {
      addScore(pointsPerProblem);
    }

    setAnsweredCount(prev => prev + 1);

    setTimeout(() => {
      if (currentIndex < config.problems.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setUserAnswer('');
        setShowResult(null);
        setShowHint(false);
      } else {
        setGameComplete();
      }
    }, 1500);
  };

  return (
    <div className="max-w-lg mx-auto text-center">
      {/* Progress */}
      <div className="flex gap-1 mb-6">
        {config.problems.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i < answeredCount ? 'bg-primary-500' : i === currentIndex ? 'bg-primary-400/50' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-2">
        Problem {currentIndex + 1} of {config.problems.length}
      </p>

      {/* Question */}
      <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-2xl mb-6">
        <p className="text-xl text-white font-medium mb-4">{current.question}</p>

        {showHint && current.hint && (
          <p className="text-sm text-yellow-400 mb-3">💡 Hint: {current.hint}</p>
        )}

        <div className="flex gap-3 justify-center">
          <input
            type="number"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && showResult === null && checkAnswer()}
            disabled={showResult !== null}
            placeholder="Your answer"
            className="w-40 px-4 py-3 bg-gray-900 border border-gray-600 rounded-xl text-white text-center text-xl focus:outline-none focus:border-primary-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Result feedback */}
      {showResult !== null && (
        <div className={`p-4 rounded-xl mb-4 ${showResult ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {showResult ? '🎉 Correct!' : `❌ The answer was ${current.answer}`}
        </div>
      )}

      {/* Actions */}
      {showResult === null && (
        <div className="flex gap-3 justify-center">
          {current.hint && !showHint && (
            <button
              onClick={() => setShowHint(true)}
              className="px-4 py-2 bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 rounded-lg text-sm"
            >
              💡 Show Hint
            </button>
          )}
          <button
            onClick={checkAnswer}
            disabled={!userAnswer}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            Submit Answer
          </button>
        </div>
      )}
    </div>
  );
}
