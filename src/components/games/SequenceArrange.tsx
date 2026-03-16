'use client';

import React, { useState, useMemo } from 'react';
import type { SequenceArrangeConfig } from '@/types/upgrade';

interface SequenceArrangeProps {
  config: SequenceArrangeConfig;
  addScore: (points: number) => void;
  setGameComplete: () => void;
  maxScore: number;
}

export default function SequenceArrange({ config, addScore, setGameComplete, maxScore }: SequenceArrangeProps) {
  const shuffled = useMemo(
    () => [...config.items].sort(() => Math.random() - 0.5),
    [config.items]
  );

  const [arrangement, setArrangement] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(shuffled.map(i => i.id));
  const [checked, setChecked] = useState(false);

  const addToArrangement = (id: string) => {
    setArrangement(prev => [...prev, id]);
    setRemaining(prev => prev.filter(r => r !== id));
  };

  const removeFromArrangement = (id: string) => {
    setArrangement(prev => prev.filter(a => a !== id));
    setRemaining(prev => [...prev, id]);
  };

  const checkOrder = () => {
    setChecked(true);
    let correct = 0;
    for (let i = 0; i < config.correct_order.length; i++) {
      if (arrangement[i] === config.correct_order[i]) {
        correct++;
      }
    }
    const score = Math.round((correct / config.correct_order.length) * maxScore);
    addScore(score);
    setTimeout(setGameComplete, 2000);
  };

  const getItemText = (id: string) => {
    return config.items.find(i => i.id === id)?.text || id;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-sm text-gray-400 mb-6 text-center">{config.instruction}</p>

      {/* Arranged items */}
      <div className="mb-6">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Your Arrangement</h4>
        <div className="min-h-[60px] p-3 border-2 border-dashed border-gray-600 rounded-xl">
          {arrangement.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-2">Click items below to arrange them in order</p>
          ) : (
            <div className="space-y-2">
              {arrangement.map((id, i) => {
                const isCorrect = checked ? config.correct_order[i] === id : null;
                return (
                  <div
                    key={id}
                    onClick={() => !checked && removeFromArrangement(id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      isCorrect === true
                        ? 'bg-green-500/20 border border-green-500'
                        : isCorrect === false
                          ? 'bg-red-500/20 border border-red-500'
                          : 'bg-gray-800 border border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm text-white flex-1">{getItemText(id)}</span>
                    {!checked && <span className="text-gray-500 text-xs">click to remove</span>}
                    {isCorrect === true && <span>✅</span>}
                    {isCorrect === false && <span>❌</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Remaining items */}
      {remaining.length > 0 && !checked && (
        <div>
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Available Items</h4>
          <div className="flex flex-wrap gap-2">
            {remaining.map(id => (
              <button
                key={id}
                onClick={() => addToArrangement(id)}
                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white hover:border-primary-500 hover:bg-gray-750 transition-all"
              >
                {getItemText(id)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Check button */}
      {arrangement.length === config.correct_order.length && !checked && (
        <div className="text-center mt-6">
          <button
            onClick={checkOrder}
            className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-lg"
          >
            Check My Order
          </button>
        </div>
      )}

      {/* Show correct order after checking */}
      {checked && (
        <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Correct Order:</h4>
          {config.correct_order.map((id, i) => (
            <p key={id} className="text-sm text-green-400">
              {i + 1}. {getItemText(id)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
