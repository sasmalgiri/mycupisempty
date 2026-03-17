'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Phase = 'join' | 'lobby' | 'playing' | 'answer_result' | 'results';

interface QuizData {
  id: string;
  title: string;
  status: string;
  current_question: number;
  question_started_at: string;
  questions: any[];
  time_per_question: number;
  join_code: string;
  participants: any[];
  my_participation: any;
}

export default function StudentLiveQuizPage() {
  const [phase, setPhase] = useState<Phase>('join');
  const [joinCode, setJoinCode] = useState('');
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [lastAnswer, setLastAnswer] = useState<any>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [totalScore, setTotalScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lastQuestionSeen, setLastQuestionSeen] = useState(-1);

  // Poll quiz state
  useEffect(() => {
    if (!quiz || phase === 'join' || phase === 'results') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/live-quiz?action=lobby&join_code=${quiz.join_code}`);
        const data = await res.json();
        if (data.success) {
          const q = data.data;
          setQuiz(q);

          // Update my data
          if (q.my_participation) {
            setTotalScore(q.my_participation.total_score || 0);
            setCorrectCount(
              (q.my_participation.answers || []).filter((a: any) => a.is_correct).length
            );
          }

          // Transition logic
          if (q.status === 'lobby' && phase !== 'lobby') {
            setPhase('lobby');
          } else if (q.status === 'active') {
            // New question appeared
            if (q.current_question !== lastQuestionSeen && !answeredQuestions.has(q.current_question)) {
              setLastQuestionSeen(q.current_question);
              setSelectedOption(null);
              setLastAnswer(null);
              setPhase('playing');
              // Calculate remaining time
              const started = new Date(q.question_started_at).getTime();
              const elapsed = (Date.now() - started) / 1000;
              const questionTimeLimit = q.questions[q.current_question]?.time_limit || q.time_per_question || 20;
              setTimer(Math.max(0, Math.round(questionTimeLimit - elapsed)));
            }
          } else if (q.status === 'finished') {
            setPhase('results');
          }
        }
      } catch {}
    }, 2000);

    return () => clearInterval(interval);
  }, [quiz?.join_code, phase, lastQuestionSeen, answeredQuestions]);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing' || timer <= 0) return;

    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) return 0;
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, timer]);

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      setError('Enter a join code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // First join
      const joinRes = await fetch('/api/live-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', join_code: joinCode.toUpperCase() }),
      });
      const joinData = await joinRes.json();
      if (!joinData.success) {
        setError(joinData.error || 'Failed to join');
        setLoading(false);
        return;
      }

      // Get quiz data
      const lobbyRes = await fetch(`/api/live-quiz?action=lobby&join_code=${joinCode.toUpperCase()}`);
      const lobbyData = await lobbyRes.json();
      if (lobbyData.success) {
        setQuiz(lobbyData.data);
        if (lobbyData.data.status === 'active') {
          setPhase('playing');
        } else {
          setPhase('lobby');
        }
      } else {
        setError(lobbyData.error || 'Quiz not found');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleAnswer = async (optionIndex: number) => {
    if (!quiz || selectedOption !== null) return;
    setSelectedOption(optionIndex);

    try {
      const res = await fetch('/api/live-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          quiz_id: quiz.id,
          question_index: quiz.current_question,
          selected_option: optionIndex,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLastAnswer(data.data.last_answer);
        setTotalScore(data.data.total_score);
        if (data.data.last_answer.is_correct) {
          setCorrectCount((c) => c + 1);
        }
        setAnsweredQuestions((s) => new Set(s).add(quiz.current_question));
        setPhase('answer_result');
      }
    } catch {}
  };

  const optionColors = [
    { bg: 'bg-red-500 hover:bg-red-600', text: 'text-white', shape: 'triangle' },
    { bg: 'bg-blue-500 hover:bg-blue-600', text: 'text-white', shape: 'diamond' },
    { bg: 'bg-green-500 hover:bg-green-600', text: 'text-white', shape: 'circle' },
    { bg: 'bg-yellow-500 hover:bg-yellow-600', text: 'text-white', shape: 'square' },
  ];

  // JOIN SCREEN
  if (phase === 'join') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center"
        >
          <div className="text-6xl mb-4">&#127918;</div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Live Quiz</h1>
          <p className="text-gray-500 mb-8">Enter the code your teacher shared</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="w-full text-center text-4xl font-black tracking-[0.4em] px-4 py-6 border-2 border-gray-300 rounded-2xl focus:ring-4 focus:ring-blue-300 focus:border-blue-500 uppercase mb-6"
            placeholder="CODE"
            maxLength={6}
          />

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-xl hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 shadow-lg"
          >
            {loading ? 'Joining...' : 'Join Quiz'}
          </button>
        </motion.div>
      </div>
    );
  }

  // LOBBY
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center"
        >
          <div className="text-5xl mb-4">&#9203;</div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            {quiz?.title || 'Live Quiz'}
          </h2>
          <p className="text-gray-500 mb-6">Waiting for the host to start...</p>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6">
            <p className="text-sm text-blue-600 font-medium mb-1">Join Code</p>
            <p className="text-3xl font-black text-blue-700 tracking-[0.3em]">{quiz?.join_code}</p>
          </div>

          <div className="text-left">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Players ({quiz?.participants?.length || 0})
            </p>
            <div className="flex flex-wrap gap-2">
              {(quiz?.participants || []).map((p: any) => (
                <span
                  key={p.id}
                  className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                >
                  {p.profiles?.full_name || p.display_name}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="animate-bounce text-gray-400">
              <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // PLAYING
  if (phase === 'playing' && quiz) {
    const currentQ = quiz.questions[quiz.current_question];
    if (!currentQ) return null;

    const timeLimit = currentQ.time_limit || quiz.time_per_question || 20;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-indigo-900 flex flex-col">
        {/* Timer Bar */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-sm font-medium">
              Q{quiz.current_question + 1}/{quiz.questions.length}
            </span>
            <span className={`text-3xl font-black ${timer <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {timer}
            </span>
            <span className="text-white/70 text-sm font-medium">
              Score: {totalScore}
            </span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <motion.div
              className={`h-2 rounded-full ${timer <= 5 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-400 to-indigo-400'}`}
              initial={{ width: '100%' }}
              animate={{ width: `${(timer / timeLimit) * 100}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
          <motion.div
            key={quiz.current_question}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 mb-6 max-w-2xl w-full text-center shadow-2xl"
          >
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {currentQ.question_text}
            </p>
          </motion.div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3 max-w-2xl w-full">
            {currentQ.options.map((opt: string, i: number) => {
              const color = optionColors[i];
              const labels = ['A', 'B', 'C', 'D'];
              const isSelected = selectedOption === i;
              const isDisabled = selectedOption !== null || timer <= 0;

              return (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  whileTap={!isDisabled ? { scale: 0.95 } : {}}
                  onClick={() => !isDisabled && handleAnswer(i)}
                  disabled={isDisabled}
                  className={`${color.bg} ${color.text} p-6 rounded-2xl font-bold text-lg transition-all shadow-lg ${
                    isDisabled ? 'opacity-60' : ''
                  } ${isSelected ? 'ring-4 ring-white scale-105' : ''}`}
                >
                  <span className="block text-3xl mb-1 opacity-60">{labels[i]}</span>
                  <span className="block">{opt}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ANSWER RESULT
  if (phase === 'answer_result' && lastAnswer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center max-w-md w-full"
          >
            {lastAnswer.is_correct ? (
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: 0 }}
                className="bg-white rounded-3xl shadow-2xl p-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 8 }}
                  className="text-8xl mb-4"
                >
                  &#127881;
                </motion.div>
                <h2 className="text-3xl font-black text-green-600 mb-2">Correct!</h2>
                <p className="text-5xl font-black text-gray-900 mb-2">+{lastAnswer.points}</p>
                <p className="text-gray-500">
                  Answered in {(lastAnswer.time_taken_ms / 1000).toFixed(1)}s
                </p>
                <div className="mt-6 bg-green-50 rounded-xl p-4">
                  <p className="text-green-700 font-bold">Total Score: {totalScore}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ x: -20 }}
                animate={{ x: 0 }}
                className="bg-white rounded-3xl shadow-2xl p-8"
              >
                <div className="text-8xl mb-4">&#128532;</div>
                <h2 className="text-3xl font-black text-red-500 mb-2">Incorrect</h2>
                <p className="text-xl text-gray-500 mb-2">+0 points</p>
                <div className="mt-6 bg-red-50 rounded-xl p-4">
                  <p className="text-red-700 font-bold">Total Score: {totalScore}</p>
                </div>
              </motion.div>
            )}

            <p className="mt-6 text-gray-400 text-sm animate-pulse">
              Waiting for next question...
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // RESULTS
  if (phase === 'results' && quiz) {
    const sortedParticipants = [...(quiz.participants || [])].sort(
      (a: any, b: any) => b.total_score - a.total_score
    );
    const myRank = sortedParticipants.findIndex(
      (p: any) => p.user_id === quiz.my_participation?.user_id
    ) + 1;
    const isTop3 = myRank > 0 && myRank <= 3;

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center"
        >
          {isTop3 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 8 }}
              className="text-7xl mb-2"
            >
              {myRank === 1 ? '\u{1F3C6}' : myRank === 2 ? '\u{1F948}' : '\u{1F949}'}
            </motion.div>
          )}

          <h2 className="text-3xl font-black text-gray-900 mb-1">
            {isTop3 ? 'Amazing!' : 'Quiz Complete!'}
          </h2>
          <p className="text-gray-500 mb-6">{quiz.title}</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-3xl font-black text-blue-600">#{myRank || '-'}</p>
              <p className="text-xs text-blue-500">Rank</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4">
              <p className="text-3xl font-black text-indigo-600">{totalScore}</p>
              <p className="text-xs text-indigo-500">Score</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-3xl font-black text-green-600">
                {correctCount}/{quiz.questions.length}
              </p>
              <p className="text-xs text-green-500">Correct</p>
            </div>
          </div>

          {/* Top 5 Leaderboard */}
          <div className="text-left mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Leaderboard</h3>
            <div className="space-y-2">
              {sortedParticipants.slice(0, 5).map((p: any, i: number) => {
                const isMe = p.user_id === quiz.my_participation?.user_id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      isMe ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-50'
                    }`}
                  >
                    <span className={`font-black text-lg w-8 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                      #{i + 1}
                    </span>
                    <span className={`flex-1 font-medium truncate ${isMe ? 'text-blue-700' : 'text-gray-700'}`}>
                      {p.profiles?.full_name || p.display_name}
                      {isMe && ' (You)'}
                    </span>
                    <span className="font-bold text-gray-600">{p.total_score}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <a
            href="/dashboard"
            className="inline-block px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition"
          >
            Back to Dashboard
          </a>
        </motion.div>
      </div>
    );
  }

  return null;
}
