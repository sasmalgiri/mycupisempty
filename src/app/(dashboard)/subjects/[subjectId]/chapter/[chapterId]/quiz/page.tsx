'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  bloom_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  difficulty: 'easy' | 'medium' | 'hard';
  xp_reward: number;
}

interface QuizState {
  currentIndex: number;
  selectedAnswer: number | null;
  showExplanation: boolean;
  answers: (number | null)[];
  score: number;
  xpEarned: number;
  isComplete: boolean;
  streak: number;
}

const bloomLevelInfo = {
  remember: { label: 'Remember', color: 'bg-blue-100 text-blue-700', icon: '🧠' },
  understand: { label: 'Understand', color: 'bg-green-100 text-green-700', icon: '💡' },
  apply: { label: 'Apply', color: 'bg-yellow-100 text-yellow-700', icon: '⚙️' },
  analyze: { label: 'Analyze', color: 'bg-orange-100 text-orange-700', icon: '🔍' },
  evaluate: { label: 'Evaluate', color: 'bg-purple-100 text-purple-700', icon: '⚖️' },
  create: { label: 'Create', color: 'bg-pink-100 text-pink-700', icon: '🎨' }
};

const difficultyInfo = {
  easy: { label: 'Easy', color: 'text-success-500', stars: 1 },
  medium: { label: 'Medium', color: 'text-warning-500', stars: 2 },
  hard: { label: 'Hard', color: 'text-error-500', stars: 3 }
};

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizState, setQuizState] = useState<QuizState>({
    currentIndex: 0,
    selectedAnswer: null,
    showExplanation: false,
    answers: [],
    score: 0,
    xpEarned: 0,
    isComplete: false,
    streak: 0
  });
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`/api/curriculum?chapterId=${params.chapterId}&questions=true`);
      const data = await res.json();
      setQuestions(data.questions || getMockQuestions());
    } catch (error) {
      setQuestions(getMockQuestions());
    } finally {
      setLoading(false);
    }
  };

  const getMockQuestions = (): Question[] => [
    {
      id: '1',
      question: 'What is the numerator in the fraction 3/4?',
      options: ['3', '4', '7', '1'],
      correct_answer: 0,
      explanation: 'The numerator is the top number in a fraction. In 3/4, the numerator is 3, which tells us how many parts we have.',
      bloom_level: 'remember',
      difficulty: 'easy',
      xp_reward: 10
    },
    {
      id: '2',
      question: 'Which of these is an improper fraction?',
      options: ['1/2', '3/4', '7/5', '2/3'],
      correct_answer: 2,
      explanation: 'An improper fraction has a numerator greater than or equal to the denominator. 7/5 is improper because 7 > 5.',
      bloom_level: 'understand',
      difficulty: 'easy',
      xp_reward: 15
    },
    {
      id: '3',
      question: 'What is 1/4 + 1/4?',
      options: ['1/4', '2/8', '1/2', '2/4'],
      correct_answer: 2,
      explanation: 'When adding fractions with the same denominator, add the numerators: 1/4 + 1/4 = 2/4 = 1/2 (simplified).',
      bloom_level: 'apply',
      difficulty: 'medium',
      xp_reward: 20
    },
    {
      id: '4',
      question: 'Ram ate 2/5 of a pizza. Shyam ate 1/5 of the same pizza. How much pizza did they eat together?',
      options: ['3/10', '3/5', '1/5', '2/10'],
      correct_answer: 1,
      explanation: 'Same denominator, so add numerators: 2/5 + 1/5 = 3/5. They ate 3/5 of the pizza together.',
      bloom_level: 'apply',
      difficulty: 'medium',
      xp_reward: 25
    },
    {
      id: '5',
      question: 'Which fraction is equivalent to 2/4?',
      options: ['3/6', '2/8', '4/6', '3/4'],
      correct_answer: 0,
      explanation: '2/4 = 1/2. To check: 3/6 simplified is also 1/2 (divide both by 3). So 2/4 and 3/6 are equivalent.',
      bloom_level: 'understand',
      difficulty: 'medium',
      xp_reward: 20
    },
    {
      id: '6',
      question: 'Compare: Which is greater, 3/4 or 2/3?',
      options: ['3/4', '2/3', 'They are equal', 'Cannot compare'],
      correct_answer: 0,
      explanation: 'Convert to same denominator (12): 3/4 = 9/12, 2/3 = 8/12. Since 9/12 > 8/12, therefore 3/4 > 2/3.',
      bloom_level: 'analyze',
      difficulty: 'hard',
      xp_reward: 30
    },
    {
      id: '7',
      question: 'What is 2/3 × 3/4?',
      options: ['6/12', '5/7', '1/2', '6/7'],
      correct_answer: 2,
      explanation: 'Multiply numerators: 2 × 3 = 6. Multiply denominators: 3 × 4 = 12. Result: 6/12 = 1/2 (simplified).',
      bloom_level: 'apply',
      difficulty: 'hard',
      xp_reward: 30
    },
    {
      id: '8',
      question: 'Convert 7/4 to a mixed number.',
      options: ['1 1/4', '1 3/4', '2 1/4', '1 2/4'],
      correct_answer: 1,
      explanation: '7 ÷ 4 = 1 remainder 3. So 7/4 = 1 3/4 (one whole and three-fourths).',
      bloom_level: 'apply',
      difficulty: 'medium',
      xp_reward: 25
    },
    {
      id: '9',
      question: 'A rope is 3/4 meters long. If you cut 1/4 meter, how much is left?',
      options: ['2/4 m', '1/2 m', '3/8 m', '1/4 m'],
      correct_answer: 1,
      explanation: '3/4 - 1/4 = 2/4 = 1/2 meter. Same denominator, subtract numerators: 3-1 = 2.',
      bloom_level: 'apply',
      difficulty: 'medium',
      xp_reward: 25
    },
    {
      id: '10',
      question: 'If 1/3 of a number is 12, what is the number?',
      options: ['4', '24', '36', '48'],
      correct_answer: 2,
      explanation: 'If 1/3 of a number = 12, then the number = 12 × 3 = 36. (To find whole when given a fraction, multiply by reciprocal)',
      bloom_level: 'analyze',
      difficulty: 'hard',
      xp_reward: 35
    }
  ];

  const handleSelectAnswer = (index: number) => {
    if (quizState.showExplanation) return;
    setQuizState(prev => ({ ...prev, selectedAnswer: index }));
  };

  const handleCheckAnswer = () => {
    if (quizState.selectedAnswer === null) return;
    
    const currentQuestion = questions[quizState.currentIndex];
    const isCorrect = quizState.selectedAnswer === currentQuestion.correct_answer;
    
    const newAnswers = [...quizState.answers];
    newAnswers[quizState.currentIndex] = quizState.selectedAnswer;
    
    const newStreak = isCorrect ? quizState.streak + 1 : 0;
    const streakBonus = newStreak >= 3 ? Math.floor(currentQuestion.xp_reward * 0.5) : 0;
    const xpGained = isCorrect ? currentQuestion.xp_reward + streakBonus : 0;

    if (isCorrect && newStreak >= 3) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    }

    setQuizState(prev => ({
      ...prev,
      showExplanation: true,
      answers: newAnswers,
      score: isCorrect ? prev.score + 1 : prev.score,
      xpEarned: prev.xpEarned + xpGained,
      streak: newStreak
    }));
  };

  const handleNextQuestion = () => {
    if (quizState.currentIndex < questions.length - 1) {
      setQuizState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        selectedAnswer: null,
        showExplanation: false
      }));
    } else {
      setQuizState(prev => ({ ...prev, isComplete: true }));
    }
  };

  const handleRetryQuiz = () => {
    setQuizState({
      currentIndex: 0,
      selectedAnswer: null,
      showExplanation: false,
      answers: [],
      score: 0,
      xpEarned: 0,
      isComplete: false,
      streak: 0
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (quizState.isComplete) {
    const percentage = Math.round((quizState.score / questions.length) * 100);
    const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : 'D';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center animate-fade-in">
          <div className="text-6xl mb-4">
            {percentage >= 80 ? '🎉' : percentage >= 60 ? '👍' : '💪'}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Complete!</h1>
          <p className="text-gray-600 mb-6">Great effort! Here's how you did:</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-primary-50 rounded-2xl p-4">
              <div className="text-4xl font-bold text-primary-600">{quizState.score}/{questions.length}</div>
              <div className="text-sm text-gray-600">Correct Answers</div>
            </div>
            <div className="bg-secondary-50 rounded-2xl p-4">
              <div className="text-4xl font-bold text-secondary-600">{percentage}%</div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
            <div className="bg-success-50 rounded-2xl p-4">
              <div className="text-4xl font-bold text-success-600">+{quizState.xpEarned}</div>
              <div className="text-sm text-gray-600">XP Earned</div>
            </div>
            <div className="bg-warning-50 rounded-2xl p-4">
              <div className="text-4xl font-bold text-warning-600">{grade}</div>
              <div className="text-sm text-gray-600">Grade</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{percentage}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${
                  percentage >= 80 ? 'bg-success-500' : percentage >= 60 ? 'bg-warning-500' : 'bg-error-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Feedback */}
          <div className={`p-4 rounded-xl mb-6 ${
            percentage >= 80 ? 'bg-success-50 text-success-700' : 
            percentage >= 60 ? 'bg-warning-50 text-warning-700' : 
            'bg-primary-50 text-primary-700'
          }`}>
            {percentage >= 80 ? '🌟 Excellent! You\'ve mastered this topic!' :
             percentage >= 60 ? '👏 Good job! A bit more practice and you\'ll ace it!' :
             '📚 Keep learning! Review the explanations and try again.'}
          </div>

          <div className="flex gap-4">
            <button onClick={handleRetryQuiz} className="flex-1 btn-secondary">
              🔄 Retry Quiz
            </button>
            <Link href={`/subjects/${params.subjectId}/chapter/${params.chapterId}`} className="flex-1 btn-primary">
              📖 Back to Chapter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[quizState.currentIndex];
  const bloom = bloomLevelInfo[currentQuestion.bloom_level];
  const difficulty = difficultyInfo[currentQuestion.difficulty];
  const isCorrect = quizState.selectedAnswer === currentQuestion.correct_answer;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                backgroundColor: ['#A855F7', '#F97316', '#10B981', '#3B82F6', '#EF4444'][Math.floor(Math.random() * 5)],
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random()}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 glass-effect border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="flex items-center gap-4">
              {/* Streak */}
              {quizState.streak >= 2 && (
                <div className="flex items-center gap-1 px-3 py-1 bg-warning-100 text-warning-600 rounded-full text-sm font-bold animate-pulse">
                  🔥 {quizState.streak} streak!
                </div>
              )}
              
              {/* XP */}
              <div className="flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-600 rounded-full text-sm font-bold">
                ⭐ {quizState.xpEarned} XP
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-300"
                style={{ width: `${((quizState.currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-600">
              {quizState.currentIndex + 1}/{questions.length}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Question Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${bloom.color}`}>
                {bloom.icon} {bloom.label}
              </span>
              <span className={`flex items-center gap-1 text-sm font-medium ${difficulty.color}`}>
                {'⭐'.repeat(difficulty.stars)} {difficulty.label}
              </span>
              <span className="ml-auto text-sm text-gray-500">
                +{currentQuestion.xp_reward} XP
              </span>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 leading-relaxed">
              {currentQuestion.question}
            </h2>
          </div>

          {/* Options */}
          <div className="p-6 space-y-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = quizState.selectedAnswer === index;
              const isCorrectAnswer = index === currentQuestion.correct_answer;
              const showResult = quizState.showExplanation;
              
              let optionClass = 'bg-gray-50 border-gray-200 hover:bg-primary-50 hover:border-primary-300';
              
              if (showResult) {
                if (isCorrectAnswer) {
                  optionClass = 'bg-success-50 border-success-500';
                } else if (isSelected && !isCorrectAnswer) {
                  optionClass = 'bg-error-50 border-error-500';
                } else {
                  optionClass = 'bg-gray-50 border-gray-200 opacity-60';
                }
              } else if (isSelected) {
                optionClass = 'bg-primary-50 border-primary-500';
              }

              return (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  disabled={showResult}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${optionClass}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                    showResult && isCorrectAnswer ? 'bg-success-500 text-white' :
                    showResult && isSelected && !isCorrectAnswer ? 'bg-error-500 text-white' :
                    isSelected ? 'bg-primary-500 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {showResult && isCorrectAnswer ? '✓' :
                     showResult && isSelected && !isCorrectAnswer ? '✗' :
                     String.fromCharCode(65 + index)}
                  </div>
                  <span className="text-lg font-medium text-gray-800">{option}</span>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {quizState.showExplanation && (
            <div className={`mx-6 mb-6 p-5 rounded-xl ${isCorrect ? 'bg-success-50' : 'bg-primary-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{isCorrect ? '🎉' : '💡'}</span>
                <span className={`font-bold ${isCorrect ? 'text-success-700' : 'text-primary-700'}`}>
                  {isCorrect ? 'Correct!' : 'Explanation'}
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed">{currentQuestion.explanation}</p>
            </div>
          )}

          {/* Actions */}
          <div className="p-6 border-t border-gray-100 flex justify-between">
            <div className="text-sm text-gray-500">
              Score: <strong>{quizState.score}/{quizState.currentIndex + (quizState.showExplanation ? 1 : 0)}</strong>
            </div>
            
            {!quizState.showExplanation ? (
              <button
                onClick={handleCheckAnswer}
                disabled={quizState.selectedAnswer === null}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Check Answer
              </button>
            ) : (
              <button onClick={handleNextQuestion} className="btn-primary">
                {quizState.currentIndex < questions.length - 1 ? 'Next Question →' : 'See Results'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
