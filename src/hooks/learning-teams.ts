'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  LearningStyleMaster, LearningStyleCode, TeamMembership, LifecycleProgress,
  StyleEvaluationAttempt, StyleScores, EducationLevel, StyleTransition,
  ComprehensionEvaluation,
} from '@/types/learning-teams';

// ============================================================================
// useLearningStyles — fetch master list of all 8 styles
// ============================================================================
export function useLearningStyles() {
  const [styles, setStyles] = useState<LearningStyleMaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/style-evaluation?action=styles')
      .then(r => r.json())
      .then(d => setStyles(d.styles || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { styles, loading };
}

// ============================================================================
// useEducationLevels — fetch all education levels (Class 1 to PhD)
// ============================================================================
export function useEducationLevels() {
  const [levels, setLevels] = useState<EducationLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/style-evaluation?action=education_levels')
      .then(r => r.json())
      .then(d => setLevels(d.levels || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { levels, loading };
}

// ============================================================================
// useStyleEvaluation — manage the evaluation flow
// ============================================================================
export function useStyleEvaluation(subjectName?: string) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ selected_option_index: number; time_taken_seconds: number }[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    style_scores: StyleScores;
    primary_style: LearningStyleCode;
    secondary_style: LearningStyleCode;
    confidence: number;
    team_id: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  // Load questions
  useEffect(() => {
    const url = subjectName
      ? `/api/style-evaluation?action=questions&subject=${encodeURIComponent(subjectName)}`
      : '/api/style-evaluation?action=questions';

    fetch(url)
      .then(r => r.json())
      .then(d => {
        const allQ = [...(d.general_questions || []), ...(d.subject_questions || [])];
        setQuestions(allQ);
      });
  }, [subjectName]);

  // Start evaluation
  const startEvaluation = useCallback(async (subjectId?: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/style-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', subject_id: subjectId }),
      });
      const data = await res.json();
      setAttemptId(data.attempt?.id);
      setCurrentIndex(0);
      setAnswers([]);
      setResult(null);
      setQuestionStartTime(Date.now());
    } finally {
      setLoading(false);
    }
  }, []);

  // Answer question
  const answerQuestion = useCallback((optionIndex: number) => {
    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
    const newAnswers = [...answers, { selected_option_index: optionIndex, time_taken_seconds: timeTaken }];
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setQuestionStartTime(Date.now());
    }
  }, [answers, currentIndex, questions.length, questionStartTime]);

  // Submit evaluation
  const submitEvaluation = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/style-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          attempt_id: attemptId,
          answers,
          questions,
        }),
      });
      const data = await res.json();
      setResult({
        style_scores: data.style_scores,
        primary_style: data.primary_style,
        secondary_style: data.secondary_style,
        confidence: data.confidence,
        team_id: data.team_id,
      });
    } finally {
      setLoading(false);
    }
  }, [attemptId, answers, questions]);

  const isComplete = answers.length === questions.length && questions.length > 0;
  const progress = questions.length > 0 ? (answers.length / questions.length) * 100 : 0;

  return {
    questions, currentIndex, answers, attemptId, result, loading,
    isComplete, progress,
    currentQuestion: questions[currentIndex] || null,
    startEvaluation, answerQuestion, submitEvaluation,
  };
}

// ============================================================================
// useMyTeams — fetch student's current team assignments
// ============================================================================
export function useMyTeams() {
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/style-teams?action=my_teams');
      const data = await res.json();
      setMemberships(data.memberships || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  return { memberships, loading, refetch: fetchTeams };
}

// ============================================================================
// useLifecycleProgress — student's progress across education levels
// ============================================================================
export function useLifecycleProgress() {
  const [progress, setProgress] = useState<LifecycleProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lifecycle?action=progress');
      const data = await res.json();
      setProgress(data.progress || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  return { progress, loading, refetch: fetchProgress };
}

// ============================================================================
// useStyleHistory — student's style transitions over time
// ============================================================================
export function useStyleHistory() {
  const [transitions, setTransitions] = useState<StyleTransition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/style-teams?action=style_history')
      .then(r => r.json())
      .then(d => setTransitions(d.transitions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { transitions, loading };
}

// ============================================================================
// useComprehensionEvals — student's comprehension evaluations
// ============================================================================
export function useComprehensionEvals(subjectId?: string) {
  const [evaluations, setEvaluations] = useState<ComprehensionEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = subjectId
      ? `/api/comprehension?subject_id=${subjectId}`
      : '/api/comprehension';
    fetch(url)
      .then(r => r.json())
      .then(d => setEvaluations(d.evaluations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subjectId]);

  return { evaluations, loading };
}

// ============================================================================
// useTeamManagement — teacher's team view
// ============================================================================
export function useTeamManagement(levelCode?: string, subjectId?: string) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    let url = '/api/style-teams?action=all_teams';
    if (levelCode) url += `&level=${levelCode}`;
    if (subjectId) url += `&subject_id=${subjectId}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setTeams(data.teams || []);
    } finally {
      setLoading(false);
    }
  }, [levelCode, subjectId]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const reassignStudent = useCallback(async (studentId: string, newStyleCode: string, subId?: string, notes?: string) => {
    const res = await fetch('/api/style-teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reassign',
        student_id: studentId,
        subject_id: subId,
        new_style_code: newStyleCode,
        notes,
      }),
    });
    const data = await res.json();
    if (data.success) await fetchTeams();
    return data;
  }, [fetchTeams]);

  return { teams, loading, refetch: fetchTeams, reassignStudent };
}
