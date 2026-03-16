'use client';

import React, { useState } from 'react';
import type { VirtualLabConfig } from '@/types/upgrade';

interface VirtualLabProps {
  config: VirtualLabConfig;
  addScore: (points: number) => void;
  setGameComplete: () => void;
  maxScore: number;
}

export default function VirtualLab({ config, addScore, setGameComplete, maxScore }: VirtualLabProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [observations, setObservations] = useState<string[]>([]);
  const [userResult, setUserResult] = useState('');
  const [isExperimentDone, setIsExperimentDone] = useState(false);

  const toggleElement = (id: string) => {
    setSelectedElements(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const runExperiment = () => {
    // Simulate observations based on selected elements
    const newObservations = config.expected_result
      ? [`Based on your combination, you observe: ${config.expected_result}`]
      : ['Experiment completed! Record your observations.'];
    setObservations(newObservations);
    setIsExperimentDone(true);
  };

  const submitResult = () => {
    const similarity = userResult.toLowerCase().includes(config.expected_result.toLowerCase().split(' ')[0])
      ? 0.8 : 0.4;
    const score = Math.round(maxScore * similarity);
    addScore(score);
    setTimeout(setGameComplete, 2000);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-xl mb-6">
        <h3 className="text-white font-semibold mb-1">🔬 {config.title}</h3>
        <p className="text-sm text-gray-400">Virtual {config.lab_type} Lab</p>
      </div>

      {/* Instructions */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Instructions:</h4>
        <ol className="space-y-1">
          {config.instructions.map((instruction, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 text-sm ${i <= currentStep ? 'text-white' : 'text-gray-600'}`}
            >
              <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold
                ${i < currentStep ? 'bg-green-600 text-white' : i === currentStep ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-500'}`}>
                {i < currentStep ? '✓' : i + 1}
              </span>
              {instruction}
            </li>
          ))}
        </ol>
      </div>

      {/* Lab Workspace */}
      <div className="p-6 bg-gray-900 border border-gray-700 rounded-2xl mb-6">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Lab Elements</h4>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {config.elements.map((element) => (
            <button
              key={element.id}
              onClick={() => { toggleElement(element.id); setCurrentStep(Math.max(currentStep, 1)); }}
              className={`p-3 rounded-xl border-2 transition-all text-center ${
                selectedElements.includes(element.id)
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-500'
              }`}
            >
              <div className="text-2xl mb-1">
                {element.type === 'chemical' ? '🧪' : element.type === 'tool' ? '🔧' : '📦'}
              </div>
              <p className="text-xs text-white font-medium">{element.name}</p>
              <p className="text-[10px] text-gray-500">{element.type}</p>
            </button>
          ))}
        </div>

        {selectedElements.length >= 2 && !isExperimentDone && (
          <button
            onClick={() => { runExperiment(); setCurrentStep(config.instructions.length - 1); }}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium"
          >
            🧪 Run Experiment
          </button>
        )}
      </div>

      {/* Observations */}
      {observations.length > 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-4">
          <h4 className="text-sm font-medium text-yellow-400 mb-2">Observations:</h4>
          {observations.map((obs, i) => (
            <p key={i} className="text-sm text-gray-300">{obs}</p>
          ))}
        </div>
      )}

      {/* Submit result */}
      {isExperimentDone && (
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
          <h4 className="text-sm font-medium text-white mb-2">What did you learn?</h4>
          <textarea
            value={userResult}
            onChange={(e) => setUserResult(e.target.value)}
            placeholder="Write your conclusion from this experiment..."
            className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 resize-none h-24 mb-3"
          />
          <button
            onClick={submitResult}
            disabled={!userResult.trim()}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            Submit Conclusion
          </button>
        </div>
      )}
    </div>
  );
}
