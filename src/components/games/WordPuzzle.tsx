'use client';

import React, { useState, useMemo } from 'react';
import type { WordPuzzleConfig } from '@/types/upgrade';

interface WordPuzzleProps {
  config: WordPuzzleConfig;
  addScore: (points: number) => void;
  setGameComplete: () => void;
  maxScore: number;
}

export default function WordPuzzle({ config, addScore, setGameComplete, maxScore }: WordPuzzleProps) {
  const pointsPerWord = Math.floor(maxScore / config.words.length);

  // Scramble mode
  const scrambledWords = useMemo(() => {
    return config.words.map(w => ({
      ...w,
      scrambled: w.word.split('').sort(() => Math.random() - 0.5).join(''),
    }));
  }, [config.words]);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [completed, setCompleted] = useState(false);

  const checkAnswer = (index: number) => {
    const answer = (answers[index] || '').trim().toUpperCase();
    const correct = config.words[index].word.toUpperCase();
    const isCorrect = answer === correct;

    setResults(prev => ({ ...prev, [index]: isCorrect }));

    if (isCorrect) {
      addScore(pointsPerWord);
    }

    // Check if all answered
    const newResults = { ...results, [index]: isCorrect };
    if (Object.keys(newResults).length === config.words.length) {
      setCompleted(true);
      setTimeout(setGameComplete, 1500);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <p className="text-sm text-gray-400 mb-4">
        {config.puzzle_type === 'scramble'
          ? 'Unscramble each word using the clue!'
          : 'Fill in the correct word for each clue!'}
      </p>

      {scrambledWords.map((word, i) => (
        <div
          key={i}
          className={`p-4 rounded-xl border transition-all ${
            results[i] === true
              ? 'border-green-500 bg-green-500/10'
              : results[i] === false
                ? 'border-red-500 bg-red-500/10'
                : 'border-gray-700 bg-gray-800/50'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-300 mb-1">
                <span className="text-primary-400 font-medium">Clue:</span> {word.clue}
              </p>
              {config.puzzle_type === 'scramble' && (
                <p className="text-lg font-mono font-bold text-yellow-400 tracking-widest mb-2">
                  {word.scrambled}
                </p>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={answers[i] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && !results[i] && checkAnswer(i)}
                  disabled={results[i] !== undefined}
                  placeholder="Your answer..."
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 disabled:opacity-50"
                />
                {results[i] === undefined && (
                  <button
                    onClick={() => checkAnswer(i)}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
                  >
                    Check
                  </button>
                )}
              </div>
            </div>

            <div className="text-2xl">
              {results[i] === true && '✅'}
              {results[i] === false && '❌'}
            </div>
          </div>

          {results[i] === false && (
            <p className="mt-2 text-sm text-red-400">
              Correct answer: <span className="font-bold">{word.word}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
