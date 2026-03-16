'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  StudentDevelopmentProfile, DevelopmentDimensionMaster, StudentHabit,
  HabitDefinition, ReflectionEntry, StudentGoal, StudentBadge,
  StudentInterest, MentorFeedback, DevelopmentEvent, ReflectionPrompt,
  ScenarioBankItem, DevelopmentPillar, GoalStatus, ReflectionType,
} from '@/types/student-development';

// ============================================================================
// 1. useDevProfile — Holistic student development profile
// ============================================================================

export function useDevProfile() {
  const [profile, setProfile] = useState<StudentDevelopmentProfile | null>(null);
  const [archetypes, setArchetypes] = useState<any[]>([]);
  const [concerns, setConcerns] = useState<any[]>([]);
  const [domainAffinities, setDomainAffinities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/development?action=profile');
      const data = await res.json();
      setProfile(data.profile);
      setArchetypes(data.archetypes || []);
      setConcerns(data.concerns || []);
      setDomainAffinities(data.domain_affinities || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const initProfile = useCallback(async () => {
    const res = await fetch('/api/development', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'init_profile' }),
    });
    const data = await res.json();
    if (data.profile) setProfile(data.profile);
    return data;
  }, []);

  return { profile, archetypes, concerns, domainAffinities, loading, refresh: fetch_, initProfile };
}

// ============================================================================
// 2. useDimensions — Development dimensions master list
// ============================================================================

export function useDimensions(pillar?: DevelopmentPillar) {
  const [dimensions, setDimensions] = useState<DevelopmentDimensionMaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ action: 'dimensions' });
    if (pillar) params.set('pillar', pillar);
    fetch(`/api/development?${params}`)
      .then(r => r.json())
      .then(d => setDimensions(d.dimensions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pillar]);

  return { dimensions, loading };
}

// ============================================================================
// 3. useHabits — Habit tracking
// ============================================================================

export function useHabits() {
  const [myHabits, setMyHabits] = useState<StudentHabit[]>([]);
  const [availableHabits, setAvailableHabits] = useState<HabitDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHabits = useCallback(async () => {
    setLoading(true);
    try {
      const [myRes, availRes] = await Promise.all([
        fetch('/api/development?action=my_habits'),
        fetch('/api/development?action=available_habits'),
      ]);
      const myData = await myRes.json();
      const availData = await availRes.json();
      setMyHabits(myData.habits || []);
      setAvailableHabits(availData.habits || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  const trackHabit = useCallback(async (habitId: string, completed: boolean, qualityRating?: number, notes?: string) => {
    const res = await fetch('/api/development', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track_habit', habit_id: habitId, completed, quality_rating: qualityRating, notes }),
    });
    const data = await res.json();
    fetchHabits(); // refresh
    return data;
  }, [fetchHabits]);

  const addHabit = useCallback(async (habitId: string) => {
    await fetch('/api/development', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_habit', habit_id: habitId }),
    });
    fetchHabits();
  }, [fetchHabits]);

  return { myHabits, availableHabits, loading, trackHabit, addHabit, refresh: fetchHabits };
}

// ============================================================================
// 4. useReflections — Journaling
// ============================================================================

export function useReflections(type?: ReflectionType) {
  const [reflections, setReflections] = useState<ReflectionEntry[]>([]);
  const [prompts, setPrompts] = useState<ReflectionPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ action: 'reflections' });
    if (type) params.set('type', type);
    fetch(`/api/development?${params}`)
      .then(r => r.json())
      .then(d => setReflections(d.reflections || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type]);

  const fetchPrompts = useCallback(async (age: number, promptType?: ReflectionType) => {
    const params = new URLSearchParams({ action: 'reflection_prompts', age: String(age) });
    if (promptType) params.set('type', promptType);
    const res = await fetch(`/api/development?${params}`);
    const data = await res.json();
    setPrompts(data.prompts || []);
    return data.prompts;
  }, []);

  const submitReflection = useCallback(async (params: {
    reflection_type: ReflectionType; prompt_text?: string;
    response_text: string; dimension_tags?: string[];
    shared_with_teacher?: boolean; shared_with_parent?: boolean;
  }) => {
    const res = await fetch('/api/development', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit_reflection', ...params }),
    });
    const data = await res.json();
    if (data.entry) setReflections(prev => [data.entry, ...prev]);
    return data;
  }, []);

  return { reflections, prompts, loading, fetchPrompts, submitReflection };
}

// ============================================================================
// 5. useGoals — Goal setting and tracking
// ============================================================================

export function useGoals(pillar?: DevelopmentPillar, status?: GoalStatus) {
  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    const params = new URLSearchParams({ action: 'goals' });
    if (pillar) params.set('pillar', pillar);
    if (status) params.set('status', status);
    const res = await fetch(`/api/development?${params}`);
    const data = await res.json();
    setGoals(data.goals || []);
    setLoading(false);
  }, [pillar, status]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const createGoal = useCallback(async (params: {
    pillar: DevelopmentPillar; title: string; description?: string;
    dimension_code?: string; domain?: string; target_value?: number;
    due_date?: string; priority?: string;
  }) => {
    const res = await fetch('/api/development', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_goal', ...params }),
    });
    const data = await res.json();
    if (data.goal) setGoals(prev => [data.goal, ...prev]);
    return data;
  }, []);

  const updateGoal = useCallback(async (goalId: string, updates: { current_value?: number; status?: GoalStatus; review_notes?: string }) => {
    const res = await fetch('/api/development', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_goal', goal_id: goalId, ...updates }),
    });
    const data = await res.json();
    if (data.goal) setGoals(prev => prev.map(g => g.id === goalId ? data.goal : g));
    return data;
  }, []);

  return { goals, loading, createGoal, updateGoal, refresh: fetchGoals };
}

// ============================================================================
// 6. useScenarios — Scenario-based assessments
// ============================================================================

export function useScenarios(pillar?: DevelopmentPillar, age: number = 12) {
  const [scenarios, setScenarios] = useState<ScenarioBankItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ action: 'scenarios', age: String(age) });
    if (pillar) params.set('pillar', pillar);
    fetch(`/api/development?${params}`)
      .then(r => r.json())
      .then(d => setScenarios(d.scenarios || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pillar, age]);

  const submitResponse = useCallback(async (scenarioId: string, optionIndex: number, timeSec: number, reflection?: string) => {
    const res = await fetch('/api/development', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit_scenario', scenario_id: scenarioId, selected_option_index: optionIndex, response_time_seconds: timeSec, reflection_text: reflection }),
    });
    return await res.json();
  }, []);

  return { scenarios, loading, submitResponse };
}

// ============================================================================
// 7. useBadges — Development badges
// ============================================================================

export function useBadges() {
  const [badges, setBadges] = useState<StudentBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/development?action=my_badges')
      .then(r => r.json())
      .then(d => setBadges(d.badges || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { badges, loading };
}

// ============================================================================
// 8. useInterests — Student interests
// ============================================================================

export function useInterests() {
  const [interests, setInterests] = useState<StudentInterest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/development?action=interests')
      .then(r => r.json())
      .then(d => setInterests(d.interests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { interests, loading };
}

// ============================================================================
// 9. useFeedback — Mentor feedback
// ============================================================================

export function useFeedback() {
  const [feedback, setFeedback] = useState<MentorFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/development?action=feedback')
      .then(r => r.json())
      .then(d => setFeedback(d.feedback || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const acknowledge = useCallback(async (feedbackId: string) => {
    await fetch('/api/development', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge_feedback', feedback_id: feedbackId }),
    });
    setFeedback(prev => prev.map(f => f.id === feedbackId ? { ...f, student_acknowledged: true } : f));
  }, []);

  return { feedback, loading, acknowledge };
}

// ============================================================================
// 10. useDevEvents — Development event history
// ============================================================================

export function useDevEvents(pillar?: DevelopmentPillar) {
  const [events, setEvents] = useState<DevelopmentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ action: 'events' });
    if (pillar) params.set('pillar', pillar);
    fetch(`/api/development?${params}`)
      .then(r => r.json())
      .then(d => setEvents(d.events || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pillar]);

  return { events, loading };
}

// ============================================================================
// 11. useParentDashboard — Parent hooks
// ============================================================================

export function useParentDashboard() {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/development/parent?action=children')
      .then(r => r.json())
      .then(d => setChildren(d.children || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getChildOverview = useCallback(async (studentId: string) => {
    const res = await fetch(`/api/development/parent?action=child_overview&student_id=${studentId}`);
    return await res.json();
  }, []);

  const giveFeedback = useCallback(async (params: {
    student_id: string; feedback_type: string; message: string;
    pillar?: string; dimension_code?: string;
  }) => {
    const res = await fetch('/api/development/parent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'give_feedback', ...params }),
    });
    return await res.json();
  }, []);

  const setGoalForChild = useCallback(async (params: {
    student_id: string; pillar: string; title: string;
    description?: string; due_date?: string;
  }) => {
    const res = await fetch('/api/development/parent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_goal', ...params }),
    });
    return await res.json();
  }, []);

  return { children, loading, getChildOverview, giveFeedback, setGoalForChild };
}
