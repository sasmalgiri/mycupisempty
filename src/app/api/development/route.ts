import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  detectArchetypes, habitScoreImpact, scoreScenarioResponse,
  computeStreak, updateDimensionScore, detectConcerns,
  computeDomainAffinities, getReflectionPrompts, dimensionToColumn,
} from '@/lib/development-engine';

// ============================================================================
// GET: Fetch development data
// ============================================================================

export async function GET(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'profile';

  // --- Student development profile ---
  if (action === 'profile') {
    const { data: profile } = await supabase
      .from('student_development_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) return NextResponse.json({ profile: null });

    const archetypes = detectArchetypes(profile);
    const concerns = detectConcerns(profile);
    const domainAffinities = computeDomainAffinities(profile);

    return NextResponse.json({ profile, archetypes, concerns, domain_affinities: domainAffinities });
  }

  // --- Development dimensions master list ---
  if (action === 'dimensions') {
    const pillar = searchParams.get('pillar');
    let query = supabase.from('development_dimensions').select('*').eq('is_active', true);
    if (pillar) query = query.eq('pillar', pillar);
    const { data } = await query.order('display_order');
    return NextResponse.json({ dimensions: data || [] });
  }

  // --- My habits ---
  if (action === 'my_habits') {
    const { data: habits } = await supabase
      .from('student_habits')
      .select('*, habit_definitions(*)')
      .eq('user_id', user.id)
      .eq('is_active', true);

    return NextResponse.json({ habits: habits || [] });
  }

  // --- Available habits ---
  if (action === 'available_habits') {
    const { data: habits } = await supabase
      .from('habit_definitions')
      .select('*')
      .eq('is_active', true)
      .order('pillar, dimension_code');

    return NextResponse.json({ habits: habits || [] });
  }

  // --- Habit history for a date range ---
  if (action === 'habit_history') {
    const startDate = searchParams.get('start') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from('habit_tracking')
      .select('*, habit_definitions(name, icon, dimension_code)')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    return NextResponse.json({ history: data || [] });
  }

  // --- Reflections ---
  if (action === 'reflections') {
    const type = searchParams.get('type');
    let query = supabase.from('reflection_entries').select('*').eq('user_id', user.id);
    if (type) query = query.eq('reflection_type', type);

    const { data } = await query.order('created_at', { ascending: false }).limit(30);
    return NextResponse.json({ reflections: data || [] });
  }

  // --- Reflection prompts ---
  if (action === 'reflection_prompts') {
    const age = parseInt(searchParams.get('age') || '12');
    const type = searchParams.get('type') as any;
    const prompts = getReflectionPrompts(age, type, 5);
    return NextResponse.json({ prompts });
  }

  // --- Goals ---
  if (action === 'goals') {
    const status = searchParams.get('status');
    const pillar = searchParams.get('pillar');
    let query = supabase.from('student_goals').select('*').eq('user_id', user.id);
    if (status) query = query.eq('status', status);
    if (pillar) query = query.eq('pillar', pillar);

    const { data } = await query.order('priority', { ascending: false }).order('created_at', { ascending: false });
    return NextResponse.json({ goals: data || [] });
  }

  // --- Scenarios ---
  if (action === 'scenarios') {
    const pillar = searchParams.get('pillar');
    const age = parseInt(searchParams.get('age') || '12');

    let query = supabase.from('scenario_bank').select('*').eq('is_active', true)
      .lte('age_min', age).gte('age_max', age);
    if (pillar) query = query.eq('pillar', pillar);

    const { data } = await query.limit(10);
    return NextResponse.json({ scenarios: data || [] });
  }

  // --- Badges ---
  if (action === 'my_badges') {
    const { data: badges } = await supabase
      .from('student_badges')
      .select('*, development_badges(*)')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false });

    return NextResponse.json({ badges: badges || [] });
  }

  // --- Interests ---
  if (action === 'interests') {
    const { data: interests } = await supabase
      .from('student_interests')
      .select('*')
      .eq('user_id', user.id)
      .order('strength_level');

    return NextResponse.json({ interests: interests || [] });
  }

  // --- Mentor feedback ---
  if (action === 'feedback') {
    const { data: feedback } = await supabase
      .from('mentor_feedback')
      .select('*')
      .eq('student_id', user.id)
      .eq('is_visible_to_student', true)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ feedback: feedback || [] });
  }

  // --- Development events ---
  if (action === 'events') {
    const pillar = searchParams.get('pillar');
    let query = supabase.from('development_events').select('*').eq('user_id', user.id);
    if (pillar) query = query.eq('pillar', pillar);

    const { data } = await query.order('created_at', { ascending: false }).limit(50);
    return NextResponse.json({ events: data || [] });
  }

  // --- Domain affinities (Path) ---
  if (action === 'domain_affinities') {
    const { data: profile } = await supabase
      .from('student_development_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) return NextResponse.json({ affinities: [] });
    return NextResponse.json({ affinities: computeDomainAffinities(profile) });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// ============================================================================
// POST: Development interactions
// ============================================================================

export async function POST(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  // --- Init profile ---
  if (action === 'init_profile') {
    const { data: existing } = await supabase
      .from('student_development_profile')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) return NextResponse.json({ profile_id: existing.id, message: 'Profile already exists' });

    const { data: profile, error } = await supabase
      .from('student_development_profile')
      .insert({ user_id: user.id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile });
  }

  // --- Track habit ---
  if (action === 'track_habit') {
    const { habit_id, completed, notes, quality_rating } = body;
    const today = new Date().toISOString().split('T')[0];

    // Upsert tracking
    const { data: tracking, error } = await supabase
      .from('habit_tracking')
      .upsert({ user_id: user.id, habit_id, date: today, completed, notes, quality_rating }, { onConflict: 'user_id,habit_id,date' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (completed) {
      // Update streak
      const { data: history } = await supabase
        .from('habit_tracking')
        .select('date')
        .eq('user_id', user.id)
        .eq('habit_id', habit_id)
        .eq('completed', true)
        .order('date', { ascending: false })
        .limit(365);

      const dates = (history || []).map((h: any) => h.date);
      const { current, longest } = computeStreak(dates);

      await supabase.from('student_habits').upsert({
        user_id: user.id,
        habit_id,
        current_streak: current,
        longest_streak: longest,
        total_completions: dates.length,
        is_active: true,
      }, { onConflict: 'user_id,habit_id' });

      // Update dimension score
      const { data: habit } = await supabase
        .from('habit_definitions')
        .select('dimension_code, pillar')
        .eq('id', habit_id)
        .single();

      if (habit?.dimension_code) {
        const { data: profile } = await supabase
          .from('student_development_profile')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          const col = dimensionToColumn(habit.dimension_code);
          const currentScore = profile[col] || 50;
          const impact = habitScoreImpact(currentScore, quality_rating || 3, current);
          const newScore = updateDimensionScore(currentScore, currentScore + impact * 10, 0.1);

          await supabase.from('student_development_profile')
            .update({ [col]: newScore, updated_at: new Date().toISOString() })
            .eq('user_id', user.id);

          // Log event
          await supabase.from('development_events').insert({
            user_id: user.id,
            pillar: habit.pillar,
            dimension_code: habit.dimension_code,
            event_type: 'habit_completion',
            score_change: impact,
            evidence: { habit_id, streak: current, quality: quality_rating },
          });
        }
      }

      return NextResponse.json({ tracking, streak: current });
    }

    return NextResponse.json({ tracking });
  }

  // --- Add habit to my list ---
  if (action === 'add_habit') {
    const { habit_id } = body;
    const { data, error } = await supabase
      .from('student_habits')
      .upsert({ user_id: user.id, habit_id, is_active: true }, { onConflict: 'user_id,habit_id' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ habit: data });
  }

  // --- Submit reflection ---
  if (action === 'submit_reflection') {
    const { reflection_type, prompt_text, response_text, dimension_tags, shared_with_teacher, shared_with_parent } = body;

    const { data: entry, error } = await supabase
      .from('reflection_entries')
      .insert({
        user_id: user.id,
        reflection_type,
        prompt_text,
        response_text,
        dimension_tags: dimension_tags || [],
        shared_with_teacher: shared_with_teacher || false,
        shared_with_parent: shared_with_parent || false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update reflection dimension score
    if (dimension_tags?.length) {
      const { data: profile } = await supabase
        .from('student_development_profile')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const updates: any = { updated_at: new Date().toISOString() };
        for (const dim of dimension_tags) {
          const col = dimensionToColumn(dim);
          if (profile[col] !== undefined) {
            updates[col] = updateDimensionScore(profile[col], profile[col] + 2, 0.1);
          }
        }
        await supabase.from('student_development_profile').update(updates).eq('user_id', user.id);
      }

      await supabase.from('development_events').insert({
        user_id: user.id,
        pillar: 'cognitive',
        dimension_code: 'reflection',
        event_type: 'reflection',
        score_change: 2,
        evidence: { type: reflection_type, dimension_tags },
      });
    }

    return NextResponse.json({ entry });
  }

  // --- Submit scenario response ---
  if (action === 'submit_scenario') {
    const { scenario_id, selected_option_index, response_time_seconds, reflection_text } = body;

    // Get the scenario
    const { data: scenario } = await supabase
      .from('scenario_bank')
      .select('*')
      .eq('id', scenario_id)
      .single();

    if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });

    const option = scenario.options[selected_option_index];
    if (!option) return NextResponse.json({ error: 'Invalid option' }, { status: 400 });

    const { scores, isGrowthChoice } = scoreScenarioResponse(option, response_time_seconds || 10);

    const { data: response, error } = await supabase
      .from('scenario_responses')
      .insert({
        user_id: user.id,
        scenario_id,
        selected_option_index,
        response_time_seconds,
        reflection_text,
        dimension_scores_earned: scores,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update dimension scores
    const { data: profile } = await supabase
      .from('student_development_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profile && Object.keys(scores).length > 0) {
      const updates: any = { updated_at: new Date().toISOString() };
      for (const [dim, change] of Object.entries(scores)) {
        const col = dimensionToColumn(dim as any);
        if (profile[col] !== undefined) {
          updates[col] = updateDimensionScore(profile[col], profile[col] + (change as number), 0.15);
        }
      }

      // Detect archetypes after update
      const updatedProfile = { ...profile, ...updates };
      const archetypes = detectArchetypes(updatedProfile);
      updates.archetype_tags = archetypes.slice(0, 3).map((a: any) => a.code);

      await supabase.from('student_development_profile').update(updates).eq('user_id', user.id);
    }

    return NextResponse.json({
      response,
      scores_earned: scores,
      is_growth_choice: isGrowthChoice,
      feedback: option.feedback_text,
      debrief: scenario.debrief_text,
    });
  }

  // --- Create/update goal ---
  if (action === 'create_goal') {
    const { pillar, dimension_code, domain, title, description, target_value, due_date, priority } = body;

    const { data: goal, error } = await supabase
      .from('student_goals')
      .insert({
        user_id: user.id,
        pillar, dimension_code, domain, title, description,
        target_value, due_date, priority: priority || 'medium',
        set_by: 'student',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ goal });
  }

  if (action === 'update_goal') {
    const { goal_id, current_value, status, review_notes } = body;
    const updates: any = { updated_at: new Date().toISOString() };
    if (current_value !== undefined) updates.current_value = current_value;
    if (status) {
      updates.status = status;
      if (status === 'completed') updates.completed_at = new Date().toISOString();
    }
    if (review_notes) updates.review_notes = review_notes;

    const { data: goal, error } = await supabase
      .from('student_goals')
      .update(updates)
      .eq('id', goal_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (status === 'completed') {
      await supabase.from('development_events').insert({
        user_id: user.id,
        pillar: goal.pillar,
        dimension_code: goal.dimension_code,
        domain: goal.domain,
        event_type: 'goal_progress',
        score_change: 3,
        evidence: { goal_id, title: goal.title },
      });
    }

    return NextResponse.json({ goal });
  }

  // --- Acknowledge feedback ---
  if (action === 'acknowledge_feedback') {
    const { feedback_id } = body;
    await supabase.from('mentor_feedback')
      .update({ student_acknowledged: true })
      .eq('id', feedback_id)
      .eq('student_id', user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
