'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type {
  LearningDNA, LearningDNAFull, KolbStyle, SubjectAptitude,
  TeachingMethod, StudentMethodEffectiveness, MethodCategory,
  Activity, ActivityAttempt, Challenge, ChallengeParticipant,
  CharacterTrait, CharacterGoal, CharacterTraitCategory,
  GuruChatRequest,
} from '@/types/upgrade';

function getSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ============================================
// USE LEARNING DNA
// ============================================
export function useLearningDNA() {
  const [dna, setDna] = useState<LearningDNAFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDNA = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/learning-dna');
      if (!res.ok) throw new Error('Failed to fetch Learning DNA');
      const data = await res.json();
      setDna(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDNA(); }, [fetchDNA]);

  const updateDNA = useCallback(async (updates: Partial<LearningDNA>) => {
    try {
      const res = await fetch('/api/learning-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchDNA();
    } catch (err: any) {
      setError(err.message);
    }
  }, [fetchDNA]);

  return { dna, loading, error, fetchDNA, updateDNA };
}

// ============================================
// USE KOLB ASSESSMENT
// ============================================
export function useKolbAssessment() {
  const [result, setResult] = useState<KolbStyle | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchKolb = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('kolb_styles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) setResult(data);
  }, []);

  useEffect(() => { fetchKolb(); }, [fetchKolb]);

  const saveResult = useCallback(async (scores: {
    concrete_experience: number;
    reflective_observation: number;
    abstract_conceptualization: number;
    active_experimentation: number;
  }) => {
    setLoading(true);
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Determine Kolb type
    const ac_ce = scores.abstract_conceptualization - scores.concrete_experience;
    const ae_ro = scores.active_experimentation - scores.reflective_observation;
    let kolb_type: string;
    if (ac_ce <= 0 && ae_ro <= 0) kolb_type = 'diverger';
    else if (ac_ce > 0 && ae_ro <= 0) kolb_type = 'assimilator';
    else if (ac_ce > 0 && ae_ro > 0) kolb_type = 'converger';
    else kolb_type = 'accommodator';

    const { data, error } = await supabase
      .from('kolb_styles')
      .upsert({
        user_id: user.id,
        ...scores,
        kolb_type,
        assessment_date: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (data) setResult(data);
    setLoading(false);
    return data;
  }, []);

  return { result, loading, fetchKolb, saveResult };
}

// ============================================
// USE TEACHING METHODS
// ============================================
export function useTeachingMethods(filters?: { category?: MethodCategory; vark?: string }) {
  const [methods, setMethods] = useState<TeachingMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMethods = useCallback(async () => {
    try {
      setLoading(true);
      let url = '/api/methods';
      const params = new URLSearchParams();
      if (filters?.category) params.set('category', filters.category);
      if (filters?.vark) params.set('vark', filters.vark);
      if (params.toString()) url += `?${params}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch methods');
      const data = await res.json();
      setMethods(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters?.category, filters?.vark]);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  return { methods, loading, fetchMethods };
}

// ============================================
// USE METHOD EFFECTIVENESS
// ============================================
export function useMethodEffectiveness() {
  const [history, setHistory] = useState<StudentMethodEffectiveness[]>([]);

  const fetchHistory = useCallback(async () => {
    const res = await fetch('/api/methods/effectiveness');
    if (res.ok) {
      const data = await res.json();
      setHistory(data.data || []);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const recordEffectiveness = useCallback(async (record: {
    topic_id: string;
    method_code: string;
    understanding_before: number;
    understanding_after: number;
    time_spent_minutes: number;
    rating: number;
  }) => {
    const res = await fetch('/api/methods/effectiveness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (res.ok) await fetchHistory();
  }, [fetchHistory]);

  return { history, fetchHistory, recordEffectiveness };
}

// ============================================
// USE ACTIVITIES
// ============================================
export function useActivities(filters?: { topicId?: string; subjectId?: string; type?: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters?.topicId) params.set('topicId', filters.topicId);
      if (filters?.subjectId) params.set('subjectId', filters.subjectId);
      if (filters?.type) params.set('type', filters.type);

      const res = await fetch(`/api/activities?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setActivities(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters?.topicId, filters?.subjectId, filters?.type]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const submitAttempt = useCallback(async (attempt: {
    activity_id: string;
    score: number;
    max_score: number;
    time_taken_seconds: number;
    completed: boolean;
    result_data?: Record<string, any>;
  }) => {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attempt),
    });
    return res.ok;
  }, []);

  return { activities, loading, fetchActivities, submitAttempt };
}

// ============================================
// USE CHALLENGES
// ============================================
export function useChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/challenges');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setChallenges(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  const joinChallenge = useCallback(async (challengeId: string) => {
    const res = await fetch('/api/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', challenge_id: challengeId }),
    });
    if (res.ok) await fetchChallenges();
    return res.ok;
  }, [fetchChallenges]);

  const submitResult = useCallback(async (challengeId: string, score: number) => {
    const res = await fetch('/api/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', challenge_id: challengeId, score }),
    });
    if (res.ok) await fetchChallenges();
    return res.ok;
  }, [fetchChallenges]);

  return { challenges, loading, fetchChallenges, joinChallenge, submitResult };
}

// ============================================
// USE CHARACTER PROFILE (Teacher view)
// ============================================
export function useCharacterProfile(studentId: string) {
  const [traits, setTraits] = useState<CharacterTrait[]>([]);
  const [goals, setGoals] = useState<CharacterGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/teacher/character?studentId=${studentId}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTraits(data.data?.traits || []);
      setGoals(data.data?.goals || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { if (studentId) fetchProfile(); }, [studentId, fetchProfile]);

  const updateTrait = useCallback(async (trait: {
    trait_category: CharacterTraitCategory;
    score: number;
    observations?: string;
  }) => {
    const res = await fetch('/api/teacher/character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, ...trait }),
    });
    if (res.ok) await fetchProfile();
  }, [studentId, fetchProfile]);

  const setGoal = useCallback(async (goal: {
    trait_category: string;
    goal_description: string;
    target_score: number;
    due_date?: string;
  }) => {
    const res = await fetch('/api/teacher/character', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, ...goal }),
    });
    if (res.ok) await fetchProfile();
  }, [studentId, fetchProfile]);

  return { traits, goals, loading, fetchProfile, updateTrait, setGoal };
}

// ============================================
// USE SUBJECT APTITUDE
// ============================================
export function useSubjectAptitude() {
  const [aptitudes, setAptitudes] = useState<SubjectAptitude[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAptitudes = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('subject_aptitude')
      .select('*')
      .eq('user_id', user.id);

    if (data) setAptitudes(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAptitudes(); }, [fetchAptitudes]);

  const saveAptitude = useCallback(async (subjectId: string, scores: {
    aptitude_score: number;
    interest_score: number;
    performance_score: number;
  }) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('subject_aptitude').upsert({
      user_id: user.id,
      subject_id: subjectId,
      ...scores,
      assessed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,subject_id' });

    await fetchAptitudes();
  }, [fetchAptitudes]);

  return { aptitudes, loading, fetchAptitudes, saveAptitude };
}

// ============================================
// USE GURU CHAT
// ============================================
export function useGuruChat() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<string>('feynman');
  const [difficulty, setDifficulty] = useState(5);
  const [isSocratic, setIsSocratic] = useState(false);
  const [isBeyondCurriculum, setIsBeyondCurriculum] = useState(false);

  const sendMessage = useCallback(async (message: string, topicId?: string) => {
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    try {
      const body: GuruChatRequest = {
        message,
        session_id: sessionId || undefined,
        topic_id: topicId,
        teaching_method: method,
        difficulty_level: difficulty,
        is_socratic: isSocratic,
        is_beyond_curriculum: isBeyondCurriculum,
      };

      const res = await fetch('/api/ai/guru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to get response');

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.session_id) setSessionId(data.session_id);

      return data;
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble connecting. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, method, difficulty, isSocratic, isBeyondCurriculum]);

  const resetChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

  return {
    messages, loading, sessionId,
    method, setMethod,
    difficulty, setDifficulty,
    isSocratic, setIsSocratic,
    isBeyondCurriculum, setIsBeyondCurriculum,
    sendMessage, resetChat,
  };
}
