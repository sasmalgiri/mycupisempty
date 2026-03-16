'use client';

import { useState, useEffect, useCallback } from 'react';

interface HabitFreezeStatus {
  habit_id: string;
  name: string;
  current_streak: number;
  freezes_available: number;
  freezes_used: number;
  last_freeze_date: string | null;
}

interface UseStreakFreezesReturn {
  habits: HabitFreezeStatus[];
  loading: boolean;
  error: string | null;
  useFreeze: (habitId: string) => Promise<{ success: boolean; error?: string }>;
  refresh: () => void;
}

export function useStreakFreezes(): UseStreakFreezesReturn {
  const [habits, setHabits] = useState<HabitFreezeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFreezes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/streak-freeze');
      if (!response.ok) {
        throw new Error('Failed to fetch streak freeze data');
      }

      const data = await response.json();
      if (data.success && data.data?.habits) {
        setHabits(data.data.habits);
      } else if (data.success) {
        setHabits([]);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFreezes();
  }, [fetchFreezes]);

  const useFreeze = async (
    habitId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/streak-freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'use_freeze', habit_id: habitId }),
      });

      const data = await response.json();

      if (!data.success) {
        return { success: false, error: data.error };
      }

      // Refresh the data after using a freeze
      await fetchFreezes();
      return { success: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to use streak freeze';
      return { success: false, error: message };
    }
  };

  return {
    habits,
    loading,
    error,
    useFreeze,
    refresh: fetchFreezes,
  };
}
