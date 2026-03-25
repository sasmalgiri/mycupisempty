'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';

interface HabitDef {
  id: string;
  code: string;
  name: string;
  description: string;
  pillar: string;
  dimension_code: string;
  frequency: string;
  icon: string;
}

interface StudentHabit {
  id: string;
  habit_id: string;
  is_active: boolean;
  current_streak: number;
  longest_streak: number;
  total_completions: number;
  habit_definitions: HabitDef;
}

interface HabitTracking {
  habit_id: string;
  completed: boolean;
  quality_rating: number | null;
  notes: string;
}

const PILLAR_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  cognitive: { label: 'Cognitive', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  character: { label: 'Character', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  life_readiness: { label: 'Life Skills', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
};

export default function HabitsPage() {
  const [myHabits, setMyHabits] = useState<StudentHabit[]>([]);
  const [availableHabits, setAvailableHabits] = useState<HabitDef[]>([]);
  const [todayTracking, setTodayTracking] = useState<Record<string, HabitTracking>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const supabase = createBrowserClient();

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch my active habits
      const { data: habits } = await (supabase as any)
        .from('student_habits')
        .select('*, habit_definitions(*)')
        .eq('user_id', user.id)
        .eq('is_active', true);

      setMyHabits(habits || []);

      // Fetch today's tracking
      const today = new Date().toISOString().split('T')[0];
      const { data: tracking } = await (supabase as any)
        .from('habit_tracking')
        .select('habit_id, completed, quality_rating, notes')
        .eq('user_id', user.id)
        .eq('date', today);

      const trackingMap: Record<string, HabitTracking> = {};
      (tracking || []).forEach((t: HabitTracking) => {
        trackingMap[t.habit_id] = t;
      });
      setTodayTracking(trackingMap);

      // Fetch available habits for adding
      const { data: allHabits } = await (supabase as any)
        .from('habit_definitions')
        .select('*')
        .eq('is_active', true);

      setAvailableHabits(allHabits || []);
    } catch (err) {
      console.error('Failed to load habits:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleHabit = async (habitId: string, completed: boolean) => {
    try {
      const res = await fetch('/api/development', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_habit',
          habit_id: habitId,
          completed,
          quality_rating: completed ? 4 : null,
        }),
      });

      if (res.ok) {
        setTodayTracking(prev => ({
          ...prev,
          [habitId]: { habit_id: habitId, completed, quality_rating: completed ? 4 : null, notes: '' },
        }));
        // Refresh streak data
        loadData();
      }
    } catch (err) {
      console.error('Failed to track habit:', err);
    }
  };

  const addHabit = async (habitId: string) => {
    try {
      const res = await fetch('/api/development', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_habit', habit_id: habitId }),
      });

      if (res.ok) {
        setShowAdd(false);
        loadData();
      }
    } catch (err) {
      console.error('Failed to add habit:', err);
    }
  };

  const completedToday = myHabits.filter(h => todayTracking[h.habit_id]?.completed).length;
  const totalHabits = myHabits.length;
  const completionRate = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

  const filteredHabits = activeFilter === 'all'
    ? myHabits
    : myHabits.filter(h => h.habit_definitions.pillar === activeFilter);

  const myHabitIds = new Set(myHabits.map(h => h.habit_id));
  const addableHabits = availableHabits.filter(h => !myHabitIds.has(h.id));

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Habits</h1>
          <p className="text-gray-500 mt-1">Build consistency, build character</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="btn-primary px-4 py-2 text-sm"
        >
          + Add Habit
        </button>
      </div>

      {/* Today's Progress */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Today&apos;s Progress</h2>
          <span className="text-2xl font-bold text-primary-600">{completionRate}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-primary-500 to-secondary-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {completedToday} of {totalHabits} habits completed today
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'cognitive', label: 'Cognitive' },
          { key: 'character', label: 'Character' },
          { key: 'life_readiness', label: 'Life Skills' },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeFilter === tab.key
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Habit Cards */}
      {filteredHabits.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-4">🌱</p>
          <p className="text-gray-500 font-medium">No habits yet</p>
          <p className="text-sm text-gray-400 mt-1">Add habits to start building positive routines</p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="btn-primary px-6 py-2 mt-4 text-sm"
          >
            Browse Habits
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHabits.map(habit => {
            const def = habit.habit_definitions;
            const tracked = todayTracking[habit.habit_id];
            const isCompleted = tracked?.completed || false;
            const pillarInfo = PILLAR_LABELS[def.pillar] || PILLAR_LABELS.cognitive;

            return (
              <div
                key={habit.id}
                className={`bg-white rounded-2xl shadow-sm border p-4 transition-all ${
                  isCompleted ? 'border-green-200 bg-green-50/30' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleHabit(habit.habit_id, !isCompleted)}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-primary-400'
                    }`}
                    aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {isCompleted && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{def.icon}</span>
                      <h3 className={`font-semibold ${isCompleted ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                        {def.name}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{def.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${pillarInfo.bg} ${pillarInfo.color}`}>
                        {pillarInfo.label}
                      </span>
                      <span className="text-xs text-gray-400">{def.frequency}</span>
                    </div>
                  </div>

                  {/* Streak */}
                  <div className="text-center flex-shrink-0">
                    <p className="text-xl font-bold text-orange-500">{habit.current_streak}</p>
                    <p className="text-xs text-gray-400">streak</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Habit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Add a Habit</h2>
              <button type="button" onClick={() => setShowAdd(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-3">
              {addableHabits.length === 0 ? (
                <p className="text-gray-500 text-center py-8">You&apos;ve added all available habits!</p>
              ) : (
                addableHabits.map(habit => {
                  const pillarInfo = PILLAR_LABELS[habit.pillar] || PILLAR_LABELS.cognitive;
                  return (
                    <div key={habit.id} className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:border-primary-200 transition-all">
                      <span className="text-2xl">{habit.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{habit.name}</h3>
                        <p className="text-sm text-gray-500">{habit.description}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border mt-1 inline-block ${pillarInfo.bg} ${pillarInfo.color}`}>
                          {pillarInfo.label} &middot; {habit.frequency}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => addHabit(habit.id)}
                        className="btn-primary px-4 py-2 text-sm flex-shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
