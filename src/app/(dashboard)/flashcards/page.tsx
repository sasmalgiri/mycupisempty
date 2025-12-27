'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Mock flashcard data
const mockFlashcards = [
  {
    id: '1',
    front: 'What is the Fundamental Theorem of Arithmetic?',
    back: 'Every composite number can be expressed as a product of prime numbers in a unique way (ignoring the order of factors).',
    subject: 'Mathematics',
    chapter: 'Real Numbers',
    difficulty: 'medium',
    lastReviewed: null,
    nextReview: new Date().toISOString(),
    streak: 0,
    easeFactor: 2.5,
  },
  {
    id: '2',
    front: 'What is photosynthesis?',
    back: 'Photosynthesis is the process by which plants convert light energy, water, and carbon dioxide into glucose and oxygen. It occurs mainly in leaves.',
    subject: 'Science',
    chapter: 'Life Processes',
    difficulty: 'easy',
    lastReviewed: null,
    nextReview: new Date().toISOString(),
    streak: 0,
    easeFactor: 2.5,
  },
  {
    id: '3',
    front: 'What is the quadratic formula?',
    back: 'x = (-b ± √(b²-4ac)) / 2a\n\nThis formula gives the solutions to ax² + bx + c = 0',
    subject: 'Mathematics',
    chapter: 'Quadratic Equations',
    difficulty: 'medium',
    lastReviewed: null,
    nextReview: new Date().toISOString(),
    streak: 0,
    easeFactor: 2.5,
  },
  {
    id: '4',
    front: 'What is Ohm\'s Law?',
    back: 'V = IR\n\nVoltage (V) equals Current (I) multiplied by Resistance (R).\n\nUnit: Voltage in Volts, Current in Amperes, Resistance in Ohms',
    subject: 'Science',
    chapter: 'Electricity',
    difficulty: 'easy',
    lastReviewed: null,
    nextReview: new Date().toISOString(),
    streak: 0,
    easeFactor: 2.5,
  },
  {
    id: '5',
    front: 'What is nationalism?',
    back: 'Nationalism is a political ideology where people who share a common language, culture, and history believe they should form an independent nation-state. It was a major force in 19th century Europe.',
    subject: 'Social Science',
    chapter: 'Rise of Nationalism',
    difficulty: 'medium',
    lastReviewed: null,
    nextReview: new Date().toISOString(),
    streak: 0,
    easeFactor: 2.5,
  },
  {
    id: '6',
    front: 'What is a balanced chemical equation?',
    back: 'A balanced chemical equation has equal numbers of atoms of each element on both sides (reactants and products).\n\nExample: 2H₂ + O₂ → 2H₂O',
    subject: 'Science',
    chapter: 'Chemical Reactions',
    difficulty: 'easy',
    lastReviewed: null,
    nextReview: new Date().toISOString(),
    streak: 0,
    easeFactor: 2.5,
  },
  {
    id: '7',
    front: 'What is the distance formula?',
    back: 'd = √[(x₂-x₁)² + (y₂-y₁)²]\n\nThis formula calculates the distance between two points (x₁, y₁) and (x₂, y₂) in a coordinate plane.',
    subject: 'Mathematics',
    chapter: 'Coordinate Geometry',
    difficulty: 'medium',
    lastReviewed: null,
    nextReview: new Date().toISOString(),
    streak: 0,
    easeFactor: 2.5,
  },
  {
    id: '8',
    front: 'What are the three laws of motion?',
    back: '1. Law of Inertia: An object remains at rest or in uniform motion unless acted upon by an external force.\n\n2. F = ma: Force equals mass times acceleration.\n\n3. Action-Reaction: For every action, there is an equal and opposite reaction.',
    subject: 'Science',
    chapter: 'Force and Motion',
    difficulty: 'hard',
    lastReviewed: null,
    nextReview: new Date().toISOString(),
    streak: 0,
    easeFactor: 2.5,
  },
];

interface Flashcard {
  id: string;
  front: string;
  back: string;
  subject: string;
  chapter: string;
  difficulty: string;
  lastReviewed: string | null;
  nextReview: string;
  streak: number;
  easeFactor: number;
}

export default function FlashcardsPage() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>(mockFlashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0, wrong: 0 });
  const [filter, setFilter] = useState<'all' | 'due' | 'new'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCard, setNewCard] = useState({ front: '', back: '', subject: 'Mathematics' });

  const subjects = [...new Set(flashcards.map(f => f.subject))];
  
  const filteredCards = flashcards.filter(card => {
    if (selectedSubject !== 'all' && card.subject !== selectedSubject) return false;
    if (filter === 'due') {
      return new Date(card.nextReview) <= new Date();
    }
    if (filter === 'new') {
      return card.lastReviewed === null;
    }
    return true;
  });

  const currentCard = filteredCards[currentIndex];
  const dueCount = flashcards.filter(c => new Date(c.nextReview) <= new Date()).length;
  const newCount = flashcards.filter(c => c.lastReviewed === null).length;

  const handleFlip = () => setIsFlipped(!isFlipped);

  const handleResponse = (quality: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard) return;

    const qualityMap = { again: 0, hard: 1, good: 3, easy: 5 };
    const q = qualityMap[quality];
    
    // SM-2 Algorithm (simplified)
    let newEaseFactor = currentCard.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    newEaseFactor = Math.max(1.3, newEaseFactor);
    
    let interval = 1;
    if (q >= 3) {
      if (currentCard.streak === 0) interval = 1;
      else if (currentCard.streak === 1) interval = 6;
      else interval = Math.round(currentCard.streak * newEaseFactor);
    }
    
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    
    // Update flashcard
    const updatedCards = flashcards.map(card =>
      card.id === currentCard.id
        ? {
            ...card,
            easeFactor: newEaseFactor,
            streak: q >= 3 ? card.streak + 1 : 0,
            lastReviewed: new Date().toISOString(),
            nextReview: nextReview.toISOString(),
          }
        : card
    );
    
    setFlashcards(updatedCards);
    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (q >= 3 ? 1 : 0),
      wrong: prev.wrong + (q < 3 ? 1 : 0),
    }));
    
    // Move to next card
    setIsFlipped(false);
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleCreateCard = () => {
    if (!newCard.front.trim() || !newCard.back.trim()) return;
    
    const card: Flashcard = {
      id: Date.now().toString(),
      front: newCard.front,
      back: newCard.back,
      subject: newCard.subject,
      chapter: 'Custom',
      difficulty: 'medium',
      lastReviewed: null,
      nextReview: new Date().toISOString(),
      streak: 0,
      easeFactor: 2.5,
    };
    
    setFlashcards([...flashcards, card]);
    setNewCard({ front: '', back: '', subject: 'Mathematics' });
    setShowCreateModal(false);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'hard': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Flashcards</h1>
                <p className="text-sm text-gray-500">Spaced repetition for better memory</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              Create Card
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-primary-600">{flashcards.length}</div>
            <div className="text-sm text-gray-500">Total Cards</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-orange-500">{dueCount}</div>
            <div className="text-sm text-gray-500">Due Today</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-blue-500">{newCount}</div>
            <div className="text-sm text-gray-500">New Cards</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-green-500">{sessionStats.correct}</div>
            <div className="text-sm text-gray-500">Session Correct</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold text-gray-700">{sessionStats.reviewed}</div>
            <div className="text-sm text-gray-500">Session Reviewed</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-2">
            {['all', 'due', 'new'].map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f as any); setCurrentIndex(0); }}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filter === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <select
            value={selectedSubject}
            onChange={(e) => { setSelectedSubject(e.target.value); setCurrentIndex(0); }}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium text-sm"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Flashcard Area */}
        {filteredCards.length > 0 ? (
          <div className="max-w-2xl mx-auto">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
              <span>Card {currentIndex + 1} of {filteredCards.length}</span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(currentCard.difficulty)}`}>
                  {currentCard.difficulty}
                </span>
                <span className="text-gray-400">•</span>
                <span>{currentCard.subject}</span>
              </div>
            </div>

            {/* Card */}
            <div
              onClick={handleFlip}
              className="relative w-full h-80 cursor-pointer perspective-1000"
              style={{ perspective: '1000px' }}
            >
              <div
                className={`absolute inset-0 transition-transform duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Front */}
                <div
                  className="absolute inset-0 bg-white rounded-2xl shadow-lg border border-gray-100 p-8 flex flex-col items-center justify-center backface-hidden"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="text-xs text-gray-400 mb-4 uppercase tracking-wide">Question</div>
                  <p className="text-xl font-semibold text-gray-900 text-center leading-relaxed">
                    {currentCard.front}
                  </p>
                  <div className="absolute bottom-4 text-sm text-gray-400">
                    Click to reveal answer
                  </div>
                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl shadow-lg border border-primary-100 p-8 flex flex-col items-center justify-center rotate-y-180 backface-hidden"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="text-xs text-primary-600 mb-4 uppercase tracking-wide">Answer</div>
                  <p className="text-lg text-gray-800 text-center leading-relaxed whitespace-pre-wrap">
                    {currentCard.back}
                  </p>
                </div>
              </div>
            </div>

            {/* Response Buttons */}
            {isFlipped && (
              <div className="grid grid-cols-4 gap-3 mt-6 animate-fade-in">
                <button
                  onClick={() => handleResponse('again')}
                  className="py-3 px-4 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 transition-colors"
                >
                  <div className="text-lg">😵</div>
                  <div className="text-sm">Again</div>
                  <div className="text-xs text-red-500">&lt;1 min</div>
                </button>
                <button
                  onClick={() => handleResponse('hard')}
                  className="py-3 px-4 bg-orange-100 text-orange-700 rounded-xl font-semibold hover:bg-orange-200 transition-colors"
                >
                  <div className="text-lg">😓</div>
                  <div className="text-sm">Hard</div>
                  <div className="text-xs text-orange-500">1 day</div>
                </button>
                <button
                  onClick={() => handleResponse('good')}
                  className="py-3 px-4 bg-green-100 text-green-700 rounded-xl font-semibold hover:bg-green-200 transition-colors"
                >
                  <div className="text-lg">😊</div>
                  <div className="text-sm">Good</div>
                  <div className="text-xs text-green-500">3 days</div>
                </button>
                <button
                  onClick={() => handleResponse('easy')}
                  className="py-3 px-4 bg-blue-100 text-blue-700 rounded-xl font-semibold hover:bg-blue-200 transition-colors"
                >
                  <div className="text-lg">🎉</div>
                  <div className="text-sm">Easy</div>
                  <div className="text-xs text-blue-500">7 days</div>
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setIsFlipped(false); }}
                disabled={currentIndex === 0}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={() => { setCurrentIndex(Math.min(filteredCards.length - 1, currentIndex + 1)); setIsFlipped(false); }}
                disabled={currentIndex === filteredCards.length - 1}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">All caught up!</h3>
            <p className="text-gray-500 mb-6">No cards match your current filter.</p>
            <button
              onClick={() => { setFilter('all'); setSelectedSubject('all'); }}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700"
            >
              View All Cards
            </button>
          </div>
        )}

        {/* Card List */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">All Cards ({filteredCards.length})</h2>
          <div className="grid gap-4">
            {filteredCards.map((card, index) => (
              <div
                key={card.id}
                onClick={() => { setCurrentIndex(index); setIsFlipped(false); window.scrollTo({ top: 200, behavior: 'smooth' }); }}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-primary-200 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 line-clamp-2">{card.front}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                      <span>{card.subject}</span>
                      <span>•</span>
                      <span>{card.chapter}</span>
                      <span>•</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(card.difficulty)}`}>
                        {card.difficulty}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-gray-500">Streak: {card.streak}</div>
                    {card.lastReviewed ? (
                      <div className="text-green-600">Reviewed</div>
                    ) : (
                      <div className="text-blue-600">New</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Flashcard</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  value={newCard.subject}
                  onChange={(e) => setNewCard({ ...newCard, subject: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option>Mathematics</option>
                  <option>Science</option>
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Social Science</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Front (Question)</label>
                <textarea
                  value={newCard.front}
                  onChange={(e) => setNewCard({ ...newCard, front: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter your question..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Back (Answer)</label>
                <textarea
                  value={newCard.back}
                  onChange={(e) => setNewCard({ ...newCard, back: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter the answer..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCard}
                disabled={!newCard.front.trim() || !newCard.back.trim()}
                className="px-6 py-2 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50"
              >
                Create Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
