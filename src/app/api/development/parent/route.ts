import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { detectConcerns, computeDomainAffinities } from '@/lib/development-engine';

// ============================================================================
// Parent API — View child development, give feedback, set goals
// ============================================================================

export async function GET(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'children';

  // --- List linked children ---
  if (action === 'children') {
    const { data: links } = await supabase
      .from('parent_student_link')
      .select('*, profiles!parent_student_link_student_id_fkey(id, full_name, avatar_url)')
      .eq('parent_id', user.id)
      .eq('is_active', true);

    return NextResponse.json({ children: links || [] });
  }

  // --- Child overview ---
  if (action === 'child_overview') {
    const studentId = searchParams.get('student_id');
    if (!studentId) return NextResponse.json({ error: 'student_id required' }, { status: 400 });

    // Verify link
    const { data: link } = await supabase
      .from('parent_student_link')
      .select('*')
      .eq('parent_id', user.id)
      .eq('student_id', studentId)
      .eq('is_active', true)
      .single();

    if (!link) return NextResponse.json({ error: 'Not linked to this student' }, { status: 403 });

    const result: any = {};

    // Profile (always visible)
    const { data: profile } = await supabase
      .from('student_development_profile')
      .select('*')
      .eq('user_id', studentId)
      .single();

    if (profile) {
      result.profile = {
        cognitive_composite: profile.cognitive_composite,
        character_composite: link.can_see_character ? profile.character_composite : null,
        life_readiness_composite: link.can_see_life_readiness ? profile.life_readiness_composite : null,
        archetype_tags: profile.archetype_tags,
        top_strengths: profile.top_strengths,
        growth_areas: profile.growth_areas,
      };
      result.concerns = detectConcerns(profile);
      result.domain_affinities = computeDomainAffinities(profile);
    }

    // Goals
    if (link.can_see_character || link.can_see_life_readiness) {
      const { data: goals } = await supabase
        .from('student_goals')
        .select('*')
        .eq('user_id', studentId)
        .eq('status', 'active')
        .order('priority', { ascending: false });
      result.goals = goals || [];
    }

    // Habit streaks
    const { data: habits } = await supabase
      .from('student_habits')
      .select('*, habit_definitions(name, icon)')
      .eq('user_id', studentId)
      .eq('is_active', true);
    result.habits = (habits || []).map((h: any) => ({
      name: h.habit_definitions?.name,
      icon: h.habit_definitions?.icon,
      streak: h.current_streak,
      total: h.total_completions,
    }));

    // Reflections (only if allowed)
    if (link.can_see_reflections) {
      const { data: reflections } = await supabase
        .from('reflection_entries')
        .select('*')
        .eq('user_id', studentId)
        .eq('shared_with_parent', true)
        .order('created_at', { ascending: false })
        .limit(10);
      result.reflections = reflections || [];
    }

    // Recent milestones
    const { data: events } = await supabase
      .from('development_events')
      .select('*')
      .eq('user_id', studentId)
      .in('event_type', ['goal_progress', 'assessment'])
      .order('created_at', { ascending: false })
      .limit(10);
    result.milestones = events || [];

    // Badges
    const { data: badges } = await supabase
      .from('student_badges')
      .select('*, development_badges(*)')
      .eq('user_id', studentId)
      .order('earned_at', { ascending: false })
      .limit(10);
    result.badges = badges || [];

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  // --- Link child (by invite code in future; direct for now) ---
  if (action === 'link_child') {
    const { student_id, relationship } = body;

    const { data, error } = await supabase
      .from('parent_student_link')
      .upsert({
        parent_id: user.id,
        student_id,
        relationship: relationship || 'parent',
      }, { onConflict: 'parent_id,student_id' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ link: data });
  }

  // --- Give feedback ---
  if (action === 'give_feedback') {
    const { student_id, pillar, dimension_code, feedback_type, message, is_visible_to_student } = body;

    // Verify link
    const { data: link } = await supabase
      .from('parent_student_link')
      .select('can_give_feedback')
      .eq('parent_id', user.id)
      .eq('student_id', student_id)
      .eq('is_active', true)
      .single();

    if (!link?.can_give_feedback) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const { data: feedback, error } = await supabase
      .from('mentor_feedback')
      .insert({
        student_id,
        mentor_id: user.id,
        mentor_role: 'parent',
        pillar,
        dimension_code,
        feedback_type: feedback_type || 'observation',
        message,
        is_visible_to_student: is_visible_to_student !== false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ feedback });
  }

  // --- Set goal for child ---
  if (action === 'set_goal') {
    const { student_id, pillar, dimension_code, domain, title, description, due_date } = body;

    const { data: link } = await supabase
      .from('parent_student_link')
      .select('can_set_goals')
      .eq('parent_id', user.id)
      .eq('student_id', student_id)
      .eq('is_active', true)
      .single();

    if (!link?.can_set_goals) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const { data: goal, error } = await supabase
      .from('student_goals')
      .insert({
        user_id: student_id,
        pillar, dimension_code, domain, title, description, due_date,
        set_by: 'parent',
        mentor_id: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ goal });
  }

  // --- Update visibility preferences ---
  if (action === 'update_preferences') {
    const { student_id, ...prefs } = body;
    const allowed = ['can_see_reflections', 'can_see_emotions', 'can_see_academic', 'can_see_character', 'can_see_life_readiness', 'notify_on_concern', 'notify_on_milestone', 'notify_weekly_summary'];

    const updates: any = {};
    for (const key of allowed) {
      if (prefs[key] !== undefined) updates[key] = prefs[key];
    }

    await supabase.from('parent_student_link')
      .update(updates)
      .eq('parent_id', user.id)
      .eq('student_id', student_id);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
