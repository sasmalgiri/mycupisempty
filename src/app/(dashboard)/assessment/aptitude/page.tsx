'use client';

import React, { useState, useEffect } from 'react';
import { useSubjectAptitude } from '@/hooks/upgrade';
import { Button, Card, Confetti } from '@/components/ui/index';
import { RadarChart } from '@/components/ui/upgrade';
import Link from 'next/link';

interface AptitudeQuestion {
  id: number;
  subject: string;
  subject_label: string;
  question: string;
  options: string[];
  correct: number;
  difficulty: number;
}

const APTITUDE_QUESTIONS: AptitudeQuestion[] = [
  // Mathematics
  {
    id: 1, subject: 'math', subject_label: 'Mathematics',
    question: 'If 3x + 7 = 22, what is x?',
    options: ['3', '5', '7', '15'], correct: 1, difficulty: 3,
  },
  {
    id: 2, subject: 'math', subject_label: 'Mathematics',
    question: 'What is the area of a triangle with base 10 and height 6?',
    options: ['60', '30', '16', '36'], correct: 1, difficulty: 3,
  },
  {
    id: 3, subject: 'math', subject_label: 'Mathematics',
    question: 'If a₁ = 2 and d = 3, what is the 10th term of this arithmetic sequence?',
    options: ['29', '32', '27', '30'], correct: 0, difficulty: 5,
  },
  // Science
  {
    id: 4, subject: 'science', subject_label: 'Science',
    question: 'Which organelle is known as the "powerhouse of the cell"?',
    options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi body'], correct: 2, difficulty: 2,
  },
  {
    id: 5, subject: 'science', subject_label: 'Science',
    question: 'What is Newton\'s second law of motion?',
    options: ['F = ma', 'E = mc²', 'PV = nRT', 'V = IR'], correct: 0, difficulty: 3,
  },
  {
    id: 6, subject: 'science', subject_label: 'Science',
    question: 'Which gas is released during photosynthesis?',
    options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'], correct: 2, difficulty: 2,
  },
  // English
  {
    id: 7, subject: 'english', subject_label: 'English',
    question: 'Which is the correct sentence?',
    options: [
      'Him and me went to the store.',
      'He and I went to the store.',
      'Him and I went to the store.',
      'He and me went to the store.',
    ], correct: 1, difficulty: 3,
  },
  {
    id: 8, subject: 'english', subject_label: 'English',
    question: 'What is a "metaphor"?',
    options: [
      'A comparison using "like" or "as"',
      'A direct comparison without "like" or "as"',
      'An exaggeration for effect',
      'A question asked for effect',
    ], correct: 1, difficulty: 3,
  },
  // Social Science
  {
    id: 9, subject: 'social_science', subject_label: 'Social Science',
    question: 'Who wrote the Indian Constitution?',
    options: ['Mahatma Gandhi', 'Jawaharlal Nehru', 'B.R. Ambedkar', 'Sardar Patel'], correct: 2, difficulty: 2,
  },
  {
    id: 10, subject: 'social_science', subject_label: 'Social Science',
    question: 'What does GDP stand for?',
    options: [
      'Gross Domestic Product',
      'General Domestic Price',
      'Government Development Plan',
      'Grand Distribution Protocol',
    ], correct: 0, difficulty: 2,
  },
  // Hindi
  {
    id: 11, subject: 'hindi', subject_label: 'Hindi',
    question: '"सूर्य" का पर्यायवाची शब्द कौन-सा है?',
    options: ['चंद्रमा', 'दिनकर', 'तारा', 'आकाश'], correct: 1, difficulty: 2,
  },
  {
    id: 12, subject: 'hindi', subject_label: 'Hindi',
    question: '"जहाँ तक नज़र जाती है" — यह किस प्रकार का वाक्य है?',
    options: ['साधारण वाक्य', 'संयुक्त वाक्य', 'मिश्र वाक्य', 'विस्मयादिबोधक वाक्य'], correct: 2, difficulty: 4,
  },
  // Logical Reasoning
  {
    id: 13, subject: 'reasoning', subject_label: 'Logical Reasoning',
    question: 'Complete the pattern: 2, 6, 18, 54, ?',
    options: ['108', '162', '72', '216'], correct: 1, difficulty: 3,
  },
  {
    id: 14, subject: 'reasoning', subject_label: 'Logical Reasoning',
    question: 'If all roses are flowers and some flowers fade quickly, which is true?',
    options: [
      'All roses fade quickly',
      'Some roses may fade quickly',
      'No roses fade quickly',
      'Some roses are not flowers',
    ], correct: 1, difficulty: 4,
  },
  // Computer Science
  {
    id: 15, subject: 'computer', subject_label: 'Computer Science',
    question: 'What does HTML stand for?',
    options: [
      'Hyper Text Markup Language',
      'High Tech Modern Language',
      'Hyper Transfer Markup Layout',
      'Home Tool Markup Language',
    ], correct: 0, difficulty: 1,
  },
];

const SUBJECTS = ['math', 'science', 'english', 'social_science', 'hindi', 'reasoning', 'computer'];
const SUBJECT_LABELS: Record<string, string> = {
  math: 'Mathematics', science: 'Science', english: 'English',
  social_science: 'Social Science', hindi: 'Hindi', reasoning: 'Reasoning', computer: 'Computer',
};
const SUBJECT_ICONS: Record<string, string> = {
  math: '📐', science: '🔬', english: '📝', social_science: '🌍',
  hindi: '🕉️', reasoning: '🧩', computer: '💻',
};

export default function AptitudeAssessmentPage() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { aptitudes, saveAptitude } = useSubjectAptitude();

  const question = APTITUDE_QUESTIONS[currentIdx];
  const progress = ((currentIdx + 1) / APTITUDE_QUESTIONS.length) * 100;

  const selectAnswer = (optionIdx: number) => {
    setAnswers(prev => ({ ...prev, [question.id]: optionIdx }));
  };

  const goNext = () => {
    if (currentIdx < APTITUDE_QUESTIONS.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const computeResults = () => {
    const scores: Record<string, { correct: number; total: number; totalDifficulty: number }> = {};

    APTITUDE_QUESTIONS.forEach(q => {
      if (!scores[q.subject]) scores[q.subject] = { correct: 0, total: 0, totalDifficulty: 0 };
      scores[q.subject].total++;
      scores[q.subject].totalDifficulty += q.difficulty;
      if (answers[q.id] === q.correct) {
        scores[q.subject].correct++;
      }
    });

    return SUBJECTS.map(sub => {
      const s = scores[sub] || { correct: 0, total: 1, totalDifficulty: 1 };
      const accuracy = s.correct / s.total;
      const avgDifficulty = s.totalDifficulty / s.total;
      const aptitudeScore = Math.round(accuracy * avgDifficulty * 20);
      return {
        subject: sub,
        label: SUBJECT_LABELS[sub],
        score: Math.min(aptitudeScore, 100),
        correct: s.correct,
        total: s.total,
      };
    });
  };

  const handleSubmit = async () => {
    setShowResult(true);
    const results = computeResults();
    const topScore = Math.max(...results.map(r => r.score));
    if (topScore >= 60) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    // Save each subject aptitude
    for (const r of results) {
      try {
        await saveAptitude(r.subject, { aptitude_score: r.score, interest_score: 50, performance_score: r.score });
      } catch {
        // continue even if one fails
      }
    }
  };

  const allAnswered = APTITUDE_QUESTIONS.every(q => answers[q.id] !== undefined);
  const results = showResult ? computeResults() : [];

  if (showResult) {
    const radarData = results.map(r => ({ label: r.label, value: r.score }));
    const topSubject = results.reduce((a, b) => a.score > b.score ? a : b);
    const weakSubject = results.reduce((a, b) => a.score < b.score ? a : b);

    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        {showConfetti && <Confetti />}

        <h1 className="text-3xl font-bold text-white mb-2 text-center">Your Subject Aptitude</h1>
        <p className="text-gray-400 text-center mb-8">
          Based on your performance across {APTITUDE_QUESTIONS.length} questions
        </p>

        {/* Radar Chart */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8">
          <RadarChart
            data={radarData}
            size={300}
            color="#8b5cf6"
          />
        </div>

        {/* Subject Scores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {results.map(r => (
            <div key={r.subject} className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
              <span className="text-2xl">{SUBJECT_ICONS[r.subject]}</span>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-white font-medium text-sm">{r.label}</span>
                  <span className="text-xs text-gray-400">{r.correct}/{r.total} correct</span>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded-full">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-500"
                    style={{ width: `${r.score}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Aptitude: {r.score}%</p>
              </div>
            </div>
          ))}
        </div>

        {/* Insights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <p className="text-green-400 text-xs uppercase tracking-wider mb-1">Strongest Subject</p>
            <p className="text-white font-bold text-lg flex items-center gap-2">
              {SUBJECT_ICONS[topSubject.subject]} {topSubject.label}
            </p>
            <p className="text-gray-400 text-sm">Score: {topSubject.score}%</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <p className="text-amber-400 text-xs uppercase tracking-wider mb-1">Needs More Practice</p>
            <p className="text-white font-bold text-lg flex items-center gap-2">
              {SUBJECT_ICONS[weakSubject.subject]} {weakSubject.label}
            </p>
            <p className="text-gray-400 text-sm">Score: {weakSubject.score}%</p>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => { setShowResult(false); setCurrentIdx(0); setAnswers({}); }}
            className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Retake Assessment
          </button>
          <Link
            href="/learning-dna"
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            View Full Learning DNA →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <Link href="/learning-dna" className="text-gray-400 hover:text-white text-sm mb-3 flex items-center gap-1">
          ← Back to Learning DNA
        </Link>
        <h1 className="text-3xl font-bold text-white mb-2">Subject Aptitude Assessment</h1>
        <p className="text-gray-400">
          Answer questions across multiple subjects to discover your natural strengths.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Question {currentIdx + 1} of {APTITUDE_QUESTIONS.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{SUBJECT_ICONS[question.subject]}</span>
          <span className="text-xs text-gray-500 uppercase tracking-wider">{question.subject_label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
            question.difficulty <= 2 ? 'bg-green-500/20 text-green-400' :
            question.difficulty <= 4 ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            Level {question.difficulty}
          </span>
        </div>

        <h2 className="text-lg text-white font-semibold mb-6">{question.question}</h2>

        <div className="space-y-3">
          {question.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => selectAnswer(idx)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                answers[question.id] === idx
                  ? 'border-primary-500 bg-primary-500/10 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
              }`}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs mr-3 flex-shrink-0 ${answers[question.id] === idx ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-600 text-gray-500'}`}>
                {String.fromCharCode(65 + idx)}
              </span>
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>

        {/* Question dots */}
        <div className="flex gap-1 flex-wrap justify-center max-w-[200px]">
          {APTITUDE_QUESTIONS.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(idx)}
              className={`w-3 h-3 rounded-full transition-all ${
                idx === currentIdx ? 'bg-primary-500 scale-125' :
                answers[q.id] !== undefined ? 'bg-primary-500/40' : 'bg-gray-700'
              }`}
            />
          ))}
        </div>

        {currentIdx < APTITUDE_QUESTIONS.length - 1 ? (
          <button
            onClick={goNext}
            className="px-4 py-2 text-primary-400 hover:text-primary-300"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            See Results
          </button>
        )}
      </div>

      {/* Answered count */}
      <p className="text-center text-xs text-gray-500 mt-4">
        {Object.keys(answers).length} of {APTITUDE_QUESTIONS.length} answered
      </p>
    </div>
  );
}
