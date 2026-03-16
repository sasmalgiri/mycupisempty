'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  LearnerState, PedagogyModule, EngineRoute, DiagnosticItem,
  RetrievalQueueItem, MasteryCheckpoint, StudentMisconception,
  ModuleEvent, EngineDecision, PreferredFormat, LanguageLevel, Pacing, ChunkSize,
} from '@/types/pedagogy-engine';

// ============================================================================
// 1. useLearnerState — Central state for current student + subject + topic
// ============================================================================

export function useLearnerState(subjectId?: string, topicId?: string) {
  const [state, setState] = useState<LearnerState | null>(null);
  const [route, setRoute] = useState<EngineRoute | null>(null);
  const [dueRetrievalCount, setDueRetrievalCount] = useState(0);
  const [activeMisconceptionCount, setActiveMisconceptionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    if (!subjectId) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'state', subject_id: subjectId });
      if (topicId) params.set('topic_id', topicId);
      const res = await fetch(`/api/pedagogy?${params}`);
      const data = await res.json();
      setState(data.state);
      setRoute(data.current_route);
      setDueRetrievalCount(data.due_retrieval_count || 0);
      setActiveMisconceptionCount(data.active_misconception_count || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [subjectId, topicId]);

  useEffect(() => { fetchState(); }, [fetchState]);

  const initState = useCallback(async (params: {
    subject_id: string; chapter_id?: string; topic_id?: string;
    education_level_code?: string; preferred_format?: PreferredFormat;
    language_level?: LanguageLevel; pacing?: Pacing;
  }) => {
    const res = await fetch('/api/pedagogy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'init', ...params }),
    });
    const data = await res.json();
    setState(data.state);
    return data.state;
  }, []);

  return { state, route, dueRetrievalCount, activeMisconceptionCount, loading, refresh: fetchState, initState };
}

// ============================================================================
// 2. usePreferences — Update Module 1 access preferences
// ============================================================================

export function usePreferences() {
  const [saving, setSaving] = useState(false);

  const updatePreferences = useCallback(async (learnerStateId: string, prefs: {
    preferred_format?: PreferredFormat;
    language_level?: LanguageLevel;
    pacing?: Pacing;
    chunk_size?: ChunkSize;
    accessibility_needs?: string[];
  }) => {
    setSaving(true);
    try {
      const res = await fetch('/api/pedagogy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preferences', learner_state_id: learnerStateId, ...prefs }),
      });
      const data = await res.json();
      return data.state;
    } finally { setSaving(false); }
  }, []);

  return { updatePreferences, saving };
}

// ============================================================================
// 3. useDiagnostic — Fetch items and submit diagnostic responses
// ============================================================================

export function useDiagnostic(topicId?: string, subjectId?: string) {
  const [items, setItems] = useState<DiagnosticItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!topicId && !subjectId) return;
    setLoading(true);
    const params = new URLSearchParams({ action: 'diagnostic_items' });
    if (topicId) params.set('topic_id', topicId);
    if (subjectId) params.set('subject_id', subjectId);
    fetch(`/api/pedagogy?${params}`)
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topicId, subjectId]);

  const submitDiagnostic = useCallback(async (learnerStateId: string, responses: {
    diagnostic_item_id: string; answer: any; is_correct: boolean;
    confidence_rating: number; time_taken_seconds: number;
    misconception_detected?: string;
  }[]) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/pedagogy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'diagnostic_submit', learner_state_id: learnerStateId, responses }),
      });
      return await res.json();
    } finally { setSubmitting(false); }
  }, []);

  return { items, loading, submitDiagnostic, submitting };
}

// ============================================================================
// 4. useScaffold — Interact with scaffold steps
// ============================================================================

export function useScaffold(topicId?: string, level?: number) {
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!topicId) return;
    setLoading(true);
    const params = new URLSearchParams({ action: 'scaffold_steps', topic_id: topicId });
    if (level !== undefined) params.set('level', String(level));
    fetch(`/api/pedagogy?${params}`)
      .then(r => r.json())
      .then(d => setSteps(d.steps || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topicId, level]);

  const submitInteraction = useCallback(async (learnerStateId: string, scaffoldStepId: string, answer: any, isCorrect: boolean, usedHint: boolean, timeTaken: number) => {
    const res = await fetch('/api/pedagogy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'scaffold_interact',
        learner_state_id: learnerStateId,
        scaffold_step_id: scaffoldStepId,
        answer, is_correct: isCorrect, used_hint: usedHint, time_taken_seconds: timeTaken,
      }),
    });
    return await res.json();
  }, []);

  return { steps, loading, submitInteraction };
}

// ============================================================================
// 5. useRetrieval — Spaced repetition practice
// ============================================================================

export function useRetrieval() {
  const [dueItems, setDueItems] = useState<RetrievalQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pedagogy?action=retrieval_due');
      const data = await res.json();
      setDueItems(data.items || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDue(); }, [fetchDue]);

  const submitAnswer = useCallback(async (learnerStateId: string, itemId: string, quality: number, timeTaken: number) => {
    const res = await fetch('/api/pedagogy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'retrieval_submit',
        learner_state_id: learnerStateId,
        retrieval_item_id: itemId,
        quality, time_taken_seconds: timeTaken,
      }),
    });
    const data = await res.json();
    // Remove from local list
    setDueItems(prev => prev.filter(i => i.id !== itemId));
    return data;
  }, []);

  return { dueItems, loading, refresh: fetchDue, submitAnswer };
}

// ============================================================================
// 6. useMasteryCheck — Submit mastery checkpoint
// ============================================================================

export function useMasteryCheck() {
  const [submitting, setSubmitting] = useState(false);

  const submitCheckpoint = useCallback(async (
    learnerStateId: string,
    checkpointType: string,
    questionScores: { component: string; earned: number; max: number }[],
    questionsJson?: any[],
    answersJson?: any[],
    timeTakenMinutes?: number,
  ) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/pedagogy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mastery_submit',
          learner_state_id: learnerStateId,
          checkpoint_type: checkpointType,
          question_scores: questionScores,
          questions_json: questionsJson,
          answers_json: answersJson,
          time_taken_minutes: timeTakenMinutes,
        }),
      });
      return await res.json();
    } finally { setSubmitting(false); }
  }, []);

  return { submitCheckpoint, submitting };
}

// ============================================================================
// 7. useMetacognition — Submit metacognition self-assessment
// ============================================================================

export function useMetacognition() {
  const [submitting, setSubmitting] = useState(false);

  const submitMetacognition = useCallback(async (
    learnerStateId: string,
    params: {
      confidence_before: number; actual_score: number;
      used_planning: boolean; used_monitoring: boolean; used_evaluation: boolean;
      total_attempts?: number; careless_errors?: number;
    },
  ) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/pedagogy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'metacognition_submit', learner_state_id: learnerStateId, ...params }),
      });
      return await res.json();
    } finally { setSubmitting(false); }
  }, []);

  return { submitMetacognition, submitting };
}

// ============================================================================
// 8. useMisconceptions — View and resolve misconceptions
// ============================================================================

export function useMisconceptions() {
  const [misconceptions, setMisconceptions] = useState<StudentMisconception[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pedagogy?action=my_misconceptions')
      .then(r => r.json())
      .then(d => setMisconceptions(d.misconceptions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const resolve = useCallback(async (learnerStateId: string, misconceptionCode: string, method: string) => {
    await fetch('/api/pedagogy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve_misconception', learner_state_id: learnerStateId, misconception_code: misconceptionCode, resolution_method: method }),
    });
    setMisconceptions(prev => prev.filter(m => m.misconception_code !== misconceptionCode));
  }, []);

  return { misconceptions, loading, resolve };
}

// ============================================================================
// 9. useMasteryHistory — View mastery checkpoints
// ============================================================================

export function useMasteryHistory(subjectId?: string, topicId?: string) {
  const [checkpoints, setCheckpoints] = useState<MasteryCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ action: 'checkpoints' });
    if (subjectId) params.set('subject_id', subjectId);
    if (topicId) params.set('topic_id', topicId);
    fetch(`/api/pedagogy?${params}`)
      .then(r => r.json())
      .then(d => setCheckpoints(d.checkpoints || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subjectId, topicId]);

  return { checkpoints, loading };
}

// ============================================================================
// 10. useModuleEvents — View event history
// ============================================================================

export function useModuleEvents(stateId?: string) {
  const [events, setEvents] = useState<ModuleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ action: 'events' });
    if (stateId) params.set('state_id', stateId);
    fetch(`/api/pedagogy?${params}`)
      .then(r => r.json())
      .then(d => setEvents(d.events || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stateId]);

  return { events, loading };
}

// ============================================================================
// 11. useEngineDecisions — View decision log
// ============================================================================

export function useEngineDecisions(stateId?: string) {
  const [decisions, setDecisions] = useState<EngineDecision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ action: 'decisions' });
    if (stateId) params.set('state_id', stateId);
    fetch(`/api/pedagogy?${params}`)
      .then(r => r.json())
      .then(d => setDecisions(d.decisions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stateId]);

  return { decisions, loading };
}

// ============================================================================
// 12. useEngagement — Log engagement signals
// ============================================================================

export function useEngagement() {
  const logSignal = useCallback(async (learnerStateId: string, signalType: 'abandoned_session' | 'format_change_request' | 'frustration' | 'long_pause') => {
    await fetch('/api/pedagogy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log_engagement', learner_state_id: learnerStateId, signal_type: signalType }),
    });
  }, []);

  return { logSignal };
}

// ============================================================================
// 13. useTeacherPedagogy — Teacher-facing hooks
// ============================================================================

export function useTeacherPedagogy() {
  const [students, setStudents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [flagged, setFlagged] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async (subjectId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'overview' });
      if (subjectId) params.set('subject_id', subjectId);
      const res = await fetch(`/api/pedagogy/teacher?${params}`);
      const data = await res.json();
      setStudents(data.states || []);
      setSummary(data.summary);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchFlagged = useCallback(async () => {
    const res = await fetch('/api/pedagogy/teacher?action=flagged');
    const data = await res.json();
    setFlagged(data.flagged || []);
  }, []);

  const getStudentDetail = useCallback(async (studentId: string) => {
    const res = await fetch(`/api/pedagogy/teacher?action=student_detail&student_id=${studentId}`);
    return await res.json();
  }, []);

  const overrideTier = useCallback(async (params: {
    student_id: string; subject_id: string; topic_id?: string;
    new_tier: number; reason: string; interventions?: any[];
  }) => {
    const res = await fetch('/api/pedagogy/teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tier_override', ...params }),
    });
    return await res.json();
  }, []);

  const addNotes = useCallback(async (learnerStateId: string, notes: string) => {
    await fetch('/api/pedagogy/teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_notes', learner_state_id: learnerStateId, notes }),
    });
  }, []);

  const resolveReview = useCallback(async (learnerStateId: string, notes: string) => {
    await fetch('/api/pedagogy/teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve_review', learner_state_id: learnerStateId, notes }),
    });
  }, []);

  return { students, summary, flagged, loading, fetchOverview, fetchFlagged, getStudentDetail, overrideTier, addNotes, resolveReview };
}
