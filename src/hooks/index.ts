'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

// ============================================
// SUPABASE CLIENT
// ============================================
function getSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ============================================
// USE AUTH HOOK
// ============================================
interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  class_level: number;
  role: 'student' | 'parent' | 'teacher';
  avatar_url?: string;
  xp_points: number;
  level: number;
  streak_days: number;
  preferred_language: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setState(prev => ({ ...prev, loading: false, error: error.message }));
        return;
      }

      if (session?.user) {
        setState(prev => ({ ...prev, user: session.user }));
        fetchProfile(session.user.id);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setState(prev => ({ ...prev, user: session.user }));
          fetchProfile(session.user.id);
        } else {
          setState({ user: null, profile: null, loading: false, error: null });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
    } else {
      setState(prev => ({ ...prev, profile: data, loading: false }));
    }
  };

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { error };
    }
    
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, classLevel: number) => {
    const supabase = getSupabaseClient();
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, class_level: classLevel },
      },
    });
    
    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { error };
    }
    
    return { error: null, data };
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setState({ user: null, profile: null, loading: false, error: null });
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!state.user) return { error: 'Not authenticated' };
    
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', state.user.id);

    if (!error) {
      setState(prev => ({
        ...prev,
        profile: prev.profile ? { ...prev.profile, ...updates } : null,
      }));
    }

    return { error };
  };

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile: () => state.user && fetchProfile(state.user.id),
  };
}

// ============================================
// USE PROGRESS HOOK
// ============================================
interface ProgressData {
  totalXP: number;
  level: number;
  streak: number;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  studyTime: number;
  subjectProgress: Record<string, { completed: number; total: number; accuracy: number }>;
  weeklyActivity: number[];
  bloomDistribution: Record<string, number>;
}

export function useProgress() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/progress');
      
      if (!response.ok) throw new Error('Failed to fetch progress');
      
      const data = await response.json();
      setProgress(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const updateProgress = async (type: string, data: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...data }),
      });

      if (!response.ok) throw new Error('Failed to update progress');

      // Refresh progress after update
      fetchProgress();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  const addXP = (amount: number) => updateProgress('add_xp', { amount });
  
  const recordAnswer = (correct: boolean, bloomLevel: string) => 
    updateProgress('question_answered', { correct, bloomLevel });

  const updateStreak = () => updateProgress('streak_update', {});

  const addStudyTime = (minutes: number) => 
    updateProgress('study_time', { minutes });

  return {
    progress,
    loading,
    error,
    refresh: fetchProgress,
    addXP,
    recordAnswer,
    updateStreak,
    addStudyTime,
  };
}

// ============================================
// USE LEARNING STYLE HOOK
// ============================================
interface LearningStyle {
  visual: number;
  auditory: number;
  reading: number;
  kinesthetic: number;
  dominant: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  multipleIntelligences: Record<string, number>;
}

export function useLearningStyle() {
  const [learningStyle, setLearningStyle] = useState<LearningStyle | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAssessment, setHasAssessment] = useState(false);

  useEffect(() => {
    fetchLearningStyle();
  }, []);

  const fetchLearningStyle = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('learning_styles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching learning style:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const dominant = getDominantStyle({
          visual: data.visual_score,
          auditory: data.auditory_score,
          reading: data.reading_score,
          kinesthetic: data.kinesthetic_score,
        });

        setLearningStyle({
          visual: data.visual_score,
          auditory: data.auditory_score,
          reading: data.reading_score,
          kinesthetic: data.kinesthetic_score,
          dominant,
          multipleIntelligences: {
            linguistic: data.linguistic || 0,
            logical: data.logical || 0,
            spatial: data.spatial || 0,
            musical: data.musical || 0,
            bodily: data.bodily || 0,
            interpersonal: data.interpersonal || 0,
            intrapersonal: data.intrapersonal || 0,
            naturalistic: data.naturalistic || 0,
          },
        });
        setHasAssessment(true);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDominantStyle = (scores: Record<string, number>) => {
    const entries = Object.entries(scores);
    const max = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
    return max[0] as 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  };

  const saveLearningStyle = async (scores: {
    visual: number;
    auditory: number;
    reading: number;
    kinesthetic: number;
  }) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('learning_styles')
      .upsert({
        user_id: user.id,
        visual_score: scores.visual,
        auditory_score: scores.auditory,
        reading_score: scores.reading,
        kinesthetic_score: scores.kinesthetic,
        updated_at: new Date().toISOString(),
      });

    if (!error) {
      setLearningStyle({
        ...scores,
        dominant: getDominantStyle(scores),
        multipleIntelligences: learningStyle?.multipleIntelligences || {},
      });
      setHasAssessment(true);
    }

    return { error };
  };

  return {
    learningStyle,
    loading,
    hasAssessment,
    saveLearningStyle,
    refresh: fetchLearningStyle,
  };
}

// ============================================
// USE ACHIEVEMENTS HOOK
// ============================================
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requirement: number;
  earned: boolean;
  earnedAt?: string;
  progress?: number;
}

export function useAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/achievements');
      
      if (!response.ok) throw new Error('Failed to fetch achievements');
      
      const data = await response.json();
      setAchievements(data.achievements || []);
    } catch (err) {
      console.error('Error fetching achievements:', err);
    } finally {
      setLoading(false);
    }
  };

  const unlockAchievement = async (achievementId: string) => {
    try {
      const response = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ achievementId }),
      });

      if (!response.ok) throw new Error('Failed to unlock achievement');

      const data = await response.json();
      
      // Update local state
      setAchievements(prev =>
        prev.map(a =>
          a.id === achievementId
            ? { ...a, earned: true, earnedAt: new Date().toISOString() }
            : a
        )
      );

      return { success: true, xpEarned: data.xpEarned };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  const earnedCount = achievements.filter(a => a.earned).length;
  const totalXP = achievements.filter(a => a.earned).reduce((sum, a) => sum + a.xp_reward, 0);

  return {
    achievements,
    loading,
    earnedCount,
    totalXP,
    refresh: fetchAchievements,
    unlockAchievement,
  };
}

// ============================================
// USE CURRICULUM HOOK
// ============================================
interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  chapters: Chapter[];
}

interface Chapter {
  id: string;
  name: string;
  order: number;
  topics: Topic[];
}

interface Topic {
  id: string;
  name: string;
  order: number;
  content?: string;
}

export function useCurriculum(classLevel: number) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurriculum();
  }, [classLevel]);

  const fetchCurriculum = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/curriculum?class=${classLevel}`);
      
      if (!response.ok) throw new Error('Failed to fetch curriculum');
      
      const data = await response.json();
      setSubjects(data.subjects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return {
    subjects,
    loading,
    error,
    refresh: fetchCurriculum,
  };
}

// ============================================
// USE LOCAL STORAGE HOOK
// ============================================
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}

// ============================================
// USE DEBOUNCE HOOK
// ============================================
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
