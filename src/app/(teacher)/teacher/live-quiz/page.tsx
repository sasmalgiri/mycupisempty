'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';

interface Question {
  question_text: string;
  options: string[];
  correct_answer: number;
  time_limit: number;
  points: number;
}

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
  total_score: number;
  answers: any[];
  rank?: number;
  profiles?: { full_name: string };
}

interface Quiz {
  id: string;
  title: string;
  join_code: string;
  status: string;
  current_question: number;
  question_started_at: string;
  questions: Question[];
  time_per_question: number;
  participants: Participant[];
}

const emptyQuestion: Question = {
  question_text: '',
  options: ['', '', '', ''],
  correct_answer: 0,
  time_limit: 20,
  points: 1000,
};

export default function TeacherLiveQuizPage() {
  const [mode, setMode] = useState<'create' | 'host'>('create');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // Create mode state
  const [title, setTitle] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [timePerQuestion, setTimePerQuestion] = useState(20);
  const [teamMode, setTeamMode] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([{ ...emptyQuestion }]);

  // Dropdowns data
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: cls } = await (supabase.from('classrooms') as any)
      .select('id, name')
      .eq('teacher_id', user.id);
    setClassrooms(cls || []);

    const { data: subs } = await (supabase.from('subjects') as any)
      .select('id, name');
    setSubjects(subs || []);
  };

  useEffect(() => {
    if (!subjectId) return;
    const fetchTopics = async () => {
      const supabase = createBrowserClient();
      const { data } = await (supabase.from('topics') as any)
        .select('id, title, chapters!inner(subject_id)')
        .eq('chapters.subject_id', subjectId);
      setTopics(data || []);
    };
    fetchTopics();
  }, [subjectId]);

  // Poll for participants and quiz state
  useEffect(() => {
    if (!quiz || quiz.status === 'finished') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/live-quiz?action=get&id=${quiz.id}`);
        const data = await res.json();
        if (data.success) {
          setQuiz(data.data);
        }
      } catch {}
    }, 2000);

    return () => clearInterval(interval);
  }, [quiz?.id, quiz?.status]);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timer <= 0) {
      if (timer <= 0) setTimerActive(false);
      return;
    }

    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          setTimerActive(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, timer]);

  const addQuestion = () => {
    setQuestions([...questions, { ...emptyQuestion }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    if (field.startsWith('option_')) {
      const optIdx = parseInt(field.split('_')[1]);
      updated[index].options[optIdx] = value;
    } else {
      (updated[index] as any)[field] = value;
    }
    setQuestions(updated);
  };

  const createQuiz = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (questions.length < 5) {
      setError('At least 5 questions are required');
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setError(`Question ${i + 1} text is empty`);
        return;
      }
      if (q.options.some((o) => !o.trim())) {
        setError(`Question ${i + 1} has empty options`);
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/live-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title,
          classroom_id: classroomId || undefined,
          subject_id: subjectId || undefined,
          topic_id: topicId || undefined,
          questions,
          time_per_question: timePerQuestion,
          team_mode: teamMode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuiz({ ...data.data, participants: [] });
        setMode('host');
      } else {
        setError(data.error || 'Failed to create quiz');
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const startQuiz = async () => {
    if (!quiz) return;
    setLoading(true);
    try {
      const res = await fetch('/api/live-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', quiz_id: quiz.id }),
      });
      const data = await res.json();
      if (data.success) {
        setQuiz({ ...quiz, ...data.data, participants: quiz.participants });
        const q = quiz.questions[0];
        setTimer(q.time_limit || timePerQuestion);
        setTimerActive(true);
      }
    } catch {}
    setLoading(false);
  };

  const nextQuestion = async () => {
    if (!quiz) return;
    setLoading(true);
    try {
      const res = await fetch('/api/live-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'next_question', quiz_id: quiz.id }),
      });
      const data = await res.json();
      if (data.success) {
        setQuiz({ ...quiz, ...data.data, participants: quiz.participants });
        const nextQ = data.data.current_question;
        const q = quiz.questions[nextQ];
        setTimer(q.time_limit || timePerQuestion);
        setTimerActive(true);
      } else if (data.finished) {
        finishQuiz();
      }
    } catch {}
    setLoading(false);
  };

  const finishQuiz = async () => {
    if (!quiz) return;
    setLoading(true);
    try {
      const res = await fetch('/api/live-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finish', quiz_id: quiz.id }),
      });
      const data = await res.json();
      if (data.success) {
        setQuiz({ ...data.data });
      }
    } catch {}
    setLoading(false);
  };

  // Render Create Mode
  const renderCreateMode = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Live Quiz</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter quiz title..."
            />
          </div>

          {/* Selects */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classroom (optional)</label>
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select classroom</option>
                {classrooms.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject (optional)</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select subject</option>
                {subjects.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic (optional)</label>
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select topic</option>
                {topics.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time per Question (seconds)
              </label>
              <input
                type="number"
                value={timePerQuestion}
                onChange={(e) => setTimePerQuestion(parseInt(e.target.value) || 20)}
                min={5}
                max={120}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teamMode}
                  onChange={(e) => setTeamMode(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Team Mode</span>
              </label>
            </div>
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Questions ({questions.length})
              </h3>
              <button
                onClick={addQuestion}
                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
              >
                + Add Question
              </button>
            </div>

            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-xl p-6 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-blue-600">
                      Question {idx + 1}
                    </span>
                    {questions.length > 1 && (
                      <button
                        onClick={() => removeQuestion(idx)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <textarea
                    value={q.question_text}
                    onChange={(e) => updateQuestion(idx, 'question_text', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 mb-4 resize-none"
                    rows={2}
                    placeholder="Enter question text..."
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {q.options.map((opt, optIdx) => {
                      const colors = ['bg-red-50 border-red-200', 'bg-blue-50 border-blue-200', 'bg-green-50 border-green-200', 'bg-yellow-50 border-yellow-200'];
                      const labels = ['A', 'B', 'C', 'D'];
                      return (
                        <div key={optIdx} className="flex items-center gap-2">
                          <label className="flex items-center gap-2 flex-1">
                            <input
                              type="radio"
                              name={`correct_${idx}`}
                              checked={q.correct_answer === optIdx}
                              onChange={() => updateQuestion(idx, 'correct_answer', optIdx)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className={`font-bold text-sm w-6 h-6 flex items-center justify-center rounded ${colors[optIdx]}`}>
                              {labels[optIdx]}
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateQuestion(idx, `option_${optIdx}`, e.target.value)}
                              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${colors[optIdx]}`}
                              placeholder={`Option ${labels[optIdx]}`}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Time Limit (sec)</label>
                      <input
                        type="number"
                        value={q.time_limit}
                        onChange={(e) => updateQuestion(idx, 'time_limit', parseInt(e.target.value) || 20)}
                        min={5}
                        max={120}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Max Points</label>
                      <input
                        type="number"
                        value={q.points}
                        onChange={(e) => updateQuestion(idx, 'points', parseInt(e.target.value) || 1000)}
                        min={100}
                        max={2000}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={createQuiz}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 shadow-lg"
          >
            {loading ? 'Creating...' : 'Create & Start Hosting'}
          </button>
        </div>
      </div>
    </div>
  );

  // Render Host Mode
  const renderHostMode = () => {
    if (!quiz) return null;

    const isLobby = quiz.status === 'lobby';
    const isActive = quiz.status === 'active';
    const isFinished = quiz.status === 'finished';
    const currentQ = quiz.current_question >= 0 ? quiz.questions[quiz.current_question] : null;
    const sortedParticipants = [...(quiz.participants || [])].sort(
      (a, b) => b.total_score - a.total_score
    );

    return (
      <div className="max-w-5xl mx-auto">
        {/* Lobby */}
        {isLobby && (
          <div className="text-center">
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{quiz.title}</h2>
              <p className="text-gray-500 mb-8">Share this code with your students</p>

              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 mb-8 inline-block">
                <p className="text-white/80 text-sm mb-2 uppercase tracking-wider">Join Code</p>
                <p className="text-white text-6xl md:text-8xl font-black tracking-[0.3em] font-mono">
                  {quiz.join_code}
                </p>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Participants ({sortedParticipants.length})
                </h3>
                {sortedParticipants.length === 0 ? (
                  <p className="text-gray-400">Waiting for students to join...</p>
                ) : (
                  <div className="flex flex-wrap gap-3 justify-center">
                    {sortedParticipants.map((p) => (
                      <div
                        key={p.id}
                        className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full font-medium text-sm animate-pulse"
                      >
                        {p.profiles?.full_name || p.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={startQuiz}
                disabled={loading || sortedParticipants.length === 0}
                className="px-12 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-xl hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50 shadow-lg"
              >
                {loading ? 'Starting...' : 'Start Quiz'}
              </button>
            </div>
          </div>
        )}

        {/* Active Quiz */}
        {isActive && currentQ && (
          <div>
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
              {/* Timer bar */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-500">
                    Question {quiz.current_question + 1} of {quiz.questions.length}
                  </span>
                  <span className={`text-2xl font-black ${timer <= 5 ? 'text-red-500 animate-pulse' : 'text-blue-600'}`}>
                    {timer}s
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-1000 ${timer <= 5 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
                    style={{ width: `${(timer / (currentQ.time_limit || timePerQuestion)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question */}
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                {currentQ.question_text}
              </h3>

              {/* Options display */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {currentQ.options.map((opt, i) => {
                  const bgColors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'];
                  const labels = ['A', 'B', 'C', 'D'];
                  const isCorrect = i === currentQ.correct_answer;
                  return (
                    <div
                      key={i}
                      className={`${bgColors[i]} ${!timerActive && isCorrect ? 'ring-4 ring-white shadow-2xl scale-105' : ''} rounded-xl p-6 text-white font-bold text-lg transition-all`}
                    >
                      <span className="opacity-70 mr-2">{labels[i]}.</span>
                      {opt}
                      {!timerActive && isCorrect && (
                        <span className="ml-2 text-2xl">&#10003;</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Participant count */}
              <div className="text-center text-gray-500 mb-4">
                {sortedParticipants.length} participants
              </div>

              {/* Next/Finish buttons */}
              {!timerActive && (
                <div className="flex justify-center gap-4">
                  {quiz.current_question < quiz.questions.length - 1 ? (
                    <button
                      onClick={nextQuestion}
                      disabled={loading}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
                    >
                      Next Question
                    </button>
                  ) : (
                    <button
                      onClick={finishQuiz}
                      disabled={loading}
                      className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50"
                    >
                      Finish Quiz
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Live leaderboard sidebar */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Live Leaderboard</h3>
              <div className="space-y-2">
                {sortedParticipants.slice(0, 10).map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-yellow-50' : i === 1 ? 'bg-gray-50' : i === 2 ? 'bg-orange-50' : ''}`}
                  >
                    <span className={`font-black text-lg w-8 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                      #{i + 1}
                    </span>
                    <span className="flex-1 font-medium text-gray-700 truncate">
                      {p.profiles?.full_name || p.display_name}
                    </span>
                    <span className="font-bold text-blue-600">{p.total_score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Finished - Podium */}
        {isFinished && (
          <div className="text-center">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-3xl font-black text-gray-900 mb-2">Quiz Complete!</h2>
              <p className="text-gray-500 mb-8">{quiz.title}</p>

              {/* Podium */}
              <div className="flex items-end justify-center gap-4 mb-12 h-64">
                {/* 2nd Place */}
                {sortedParticipants[1] && (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center text-white font-black text-2xl mb-2 shadow-lg">
                      2
                    </div>
                    <p className="font-bold text-gray-700 text-sm mb-1 truncate max-w-[100px]">
                      {sortedParticipants[1].profiles?.full_name || sortedParticipants[1].display_name}
                    </p>
                    <p className="text-gray-500 text-xs mb-2">{sortedParticipants[1].total_score} pts</p>
                    <div className="w-24 bg-gradient-to-t from-gray-300 to-gray-200 rounded-t-xl h-32"></div>
                  </div>
                )}

                {/* 1st Place */}
                {sortedParticipants[0] && (
                  <div className="flex flex-col items-center">
                    <div className="text-4xl mb-1">&#127942;</div>
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center text-white font-black text-3xl mb-2 shadow-lg">
                      1
                    </div>
                    <p className="font-bold text-gray-900 mb-1 truncate max-w-[120px]">
                      {sortedParticipants[0].profiles?.full_name || sortedParticipants[0].display_name}
                    </p>
                    <p className="text-gray-500 text-sm mb-2">{sortedParticipants[0].total_score} pts</p>
                    <div className="w-28 bg-gradient-to-t from-yellow-400 to-yellow-200 rounded-t-xl h-44"></div>
                  </div>
                )}

                {/* 3rd Place */}
                {sortedParticipants[2] && (
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-300 to-orange-400 rounded-full flex items-center justify-center text-white font-black text-xl mb-2 shadow-lg">
                      3
                    </div>
                    <p className="font-bold text-gray-700 text-sm mb-1 truncate max-w-[100px]">
                      {sortedParticipants[2].profiles?.full_name || sortedParticipants[2].display_name}
                    </p>
                    <p className="text-gray-500 text-xs mb-2">{sortedParticipants[2].total_score} pts</p>
                    <div className="w-20 bg-gradient-to-t from-orange-300 to-orange-200 rounded-t-xl h-24"></div>
                  </div>
                )}
              </div>

              {/* Full leaderboard */}
              <div className="text-left max-w-lg mx-auto">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Full Results</h3>
                <div className="space-y-2">
                  {sortedParticipants.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                    >
                      <span className="font-black text-lg w-8 text-gray-400">#{i + 1}</span>
                      <span className="flex-1 font-medium text-gray-700">
                        {p.profiles?.full_name || p.display_name}
                      </span>
                      <span className="font-bold text-blue-600">{p.total_score} pts</span>
                      <span className="text-xs text-gray-400">
                        {(p.answers || []).filter((a: any) => a.is_correct).length}/{quiz.questions.length} correct
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setQuiz(null);
                  setMode('create');
                  setTitle('');
                  setQuestions([{ ...emptyQuestion }]);
                }}
                className="mt-8 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition"
              >
                Create New Quiz
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Live Quiz
        </h1>
        <p className="text-gray-500 mt-1">Host interactive quizzes for your students in real-time</p>
      </div>

      {/* Mode Toggle (only when not hosting) */}
      {!quiz && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('create')}
            className={`px-6 py-2 rounded-xl font-medium transition ${
              mode === 'create'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Create Quiz
          </button>
        </div>
      )}

      {mode === 'create' && !quiz && renderCreateMode()}
      {mode === 'host' && quiz && renderHostMode()}
    </div>
  );
}
