'use client';

import React, { useState } from 'react';
import { useKolbAssessment } from '@/hooks/upgrade';
import { Button, Card, Confetti } from '@/components/ui/index';
import { RadarChart } from '@/components/ui/upgrade';

const KOLB_QUESTIONS = [
  {
    id: 1, scenario: 'When learning something new, I prefer to:',
    options: {
      concrete_experience: 'Jump in and try it hands-on',
      reflective_observation: 'Watch someone else do it first',
      abstract_conceptualization: 'Read about the theory behind it',
      active_experimentation: 'Experiment with different approaches',
    },
  },
  {
    id: 2, scenario: 'In a group project, I usually:',
    options: {
      concrete_experience: 'Share personal experiences and ideas',
      reflective_observation: 'Listen and observe before contributing',
      abstract_conceptualization: 'Analyze the problem logically',
      active_experimentation: 'Suggest we start building right away',
    },
  },
  {
    id: 3, scenario: 'When I encounter a problem, I first:',
    options: {
      concrete_experience: 'Trust my feelings and intuition',
      reflective_observation: 'Think about it from different angles',
      abstract_conceptualization: 'Look for patterns and logical solutions',
      active_experimentation: 'Try different solutions quickly',
    },
  },
  {
    id: 4, scenario: 'I learn best when I can:',
    options: {
      concrete_experience: 'Relate the topic to my own life',
      reflective_observation: 'Take time to reflect and think deeply',
      abstract_conceptualization: 'Understand the underlying principles',
      active_experimentation: 'Practice and apply what I learned',
    },
  },
  {
    id: 5, scenario: 'In class, I enjoy it most when:',
    options: {
      concrete_experience: 'We do activities and discussions',
      reflective_observation: 'The teacher gives us time to think',
      abstract_conceptualization: 'We learn concepts and theories',
      active_experimentation: 'We do projects and experiments',
    },
  },
  {
    id: 6, scenario: 'When studying for an exam, I:',
    options: {
      concrete_experience: 'Use real examples to understand concepts',
      reflective_observation: 'Review my notes and think about them',
      abstract_conceptualization: 'Create summaries and frameworks',
      active_experimentation: 'Solve practice problems immediately',
    },
  },
  {
    id: 7, scenario: 'I remember things best when:',
    options: {
      concrete_experience: 'They are connected to an experience',
      reflective_observation: 'I have had time to process them',
      abstract_conceptualization: 'They are part of a logical system',
      active_experimentation: 'I have used them in practice',
    },
  },
  {
    id: 8, scenario: 'When reading a textbook chapter, I:',
    options: {
      concrete_experience: 'Look for stories and real-world examples',
      reflective_observation: 'Read slowly and reflect on each section',
      abstract_conceptualization: 'Focus on definitions and formulas',
      active_experimentation: 'Skip to the exercises and try them',
    },
  },
  {
    id: 9, scenario: 'My ideal teacher would:',
    options: {
      concrete_experience: 'Create interactive, fun learning experiences',
      reflective_observation: 'Give us space to think and explore',
      abstract_conceptualization: 'Explain concepts clearly with logic',
      active_experimentation: 'Give us hands-on challenges to solve',
    },
  },
  {
    id: 10, scenario: 'When I make a mistake, I:',
    options: {
      concrete_experience: 'Think about how it made me feel',
      reflective_observation: 'Reflect on what went wrong',
      abstract_conceptualization: 'Analyze the error logically',
      active_experimentation: 'Try again with a different approach',
    },
  },
  {
    id: 11, scenario: 'I get excited about learning when:',
    options: {
      concrete_experience: 'I can see how it applies to real life',
      reflective_observation: 'I discover something unexpected',
      abstract_conceptualization: 'I understand a complex idea deeply',
      active_experimentation: 'I create something new with what I learned',
    },
  },
  {
    id: 12, scenario: 'When choosing between two explanations, I prefer the one that:',
    options: {
      concrete_experience: 'Uses examples from everyday life',
      reflective_observation: 'Gives me things to think about',
      abstract_conceptualization: 'Is logically structured and precise',
      active_experimentation: 'Shows me how to apply it immediately',
    },
  },
];

type KolbDimension = 'concrete_experience' | 'reflective_observation' | 'abstract_conceptualization' | 'active_experimentation';

export default function KolbAssessmentPage() {
  const { result, loading, saveResult } = useKolbAssessment();
  const [currentQ, setCurrentQ] = useState(0);
  const [scores, setScores] = useState({
    concrete_experience: 0,
    reflective_observation: 0,
    abstract_conceptualization: 0,
    active_experimentation: 0,
  });
  const [showResult, setShowResult] = useState(!!result);
  const [showConfetti, setShowConfetti] = useState(false);

  if (result && showResult) {
    const radarData = [
      { label: 'Concrete\nExperience', value: result.concrete_experience },
      { label: 'Reflective\nObservation', value: result.reflective_observation },
      { label: 'Abstract\nConcept', value: result.abstract_conceptualization },
      { label: 'Active\nExperiment', value: result.active_experimentation },
    ];

    const typeDescriptions: Record<string, { title: string; icon: string; desc: string }> = {
      diverger: { title: 'Diverger (Feel & Watch)', icon: '🌊', desc: 'You learn best through concrete experiences and reflection. You are creative, imaginative, and great at seeing things from different perspectives.' },
      assimilator: { title: 'Assimilator (Think & Watch)', icon: '📐', desc: 'You learn best through abstract ideas and reflection. You are great at understanding theories, creating models, and logical reasoning.' },
      converger: { title: 'Converger (Think & Do)', icon: '🎯', desc: 'You learn best through abstract ideas and active practice. You are a practical problem-solver who loves applying theories to real situations.' },
      accommodator: { title: 'Accommodator (Feel & Do)', icon: '🚀', desc: 'You learn best through hands-on experience. You are action-oriented, adaptable, and learn by trial and error.' },
    };

    const type = typeDescriptions[result.kolb_type || 'diverger'];

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <span className="text-6xl block mb-4">{type.icon}</span>
          <h2 className="text-2xl font-bold text-white mb-2">{type.title}</h2>
          <p className="text-gray-400 mb-6">{type.desc}</p>
          <RadarChart data={radarData} size={250} color="#f59e0b" />
          <div className="mt-6 flex gap-3 justify-center">
            <Button onClick={() => window.location.href = '/learning-dna'} variant="primary">
              View Full Learning DNA
            </Button>
            <Button onClick={() => { setShowResult(false); setCurrentQ(0); }} variant="outline">
              Retake Assessment
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const question = KOLB_QUESTIONS[currentQ];
  const progress = ((currentQ) / KOLB_QUESTIONS.length) * 100;

  const selectOption = async (dimension: KolbDimension) => {
    const newScores = { ...scores, [dimension]: scores[dimension] + 1 };
    setScores(newScores);

    if (currentQ < KOLB_QUESTIONS.length - 1) {
      setCurrentQ(prev => prev + 1);
    } else {
      // Normalize to 0-100
      const max = KOLB_QUESTIONS.length;
      const normalized = {
        concrete_experience: Math.round((newScores.concrete_experience / max) * 100),
        reflective_observation: Math.round((newScores.reflective_observation / max) * 100),
        abstract_conceptualization: Math.round((newScores.abstract_conceptualization / max) * 100),
        active_experimentation: Math.round((newScores.active_experimentation / max) * 100),
      };

      await saveResult(normalized);
      setShowConfetti(true);
      setShowResult(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {showConfetti && <Confetti />}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">🔄 Kolb Learning Cycle Assessment</h1>
        <p className="text-gray-400 text-sm">
          Discover how you process and transform learning experiences.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Question {currentQ + 1} of {KOLB_QUESTIONS.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question */}
      <Card className="p-6 mb-4">
        <p className="text-lg text-white font-medium mb-6">{question.scenario}</p>

        <div className="space-y-3">
          {(Object.entries(question.options) as [KolbDimension, string][]).map(([dimension, text]) => (
            <button
              key={dimension}
              onClick={() => selectOption(dimension)}
              className="w-full text-left p-4 bg-gray-900 border border-gray-700 rounded-xl hover:border-amber-500 hover:bg-gray-850 transition-all text-sm text-gray-300"
            >
              {text}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
