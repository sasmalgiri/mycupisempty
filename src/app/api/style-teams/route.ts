import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET: Fetch student's team assignments, or teacher's team view
export async function GET(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'my_teams';

  if (action === 'my_teams') {
    // Get student's current team assignments (per subject)
    const { data: memberships } = await supabase
      .from('team_memberships' as any)
      .select(`
        *,
        learning_style_teams (
          id, style_code, team_name, description, education_level_code, subject_id
        ),
        learning_styles_master!team_memberships_style_code_fkey (
          code, name, name_hindi, icon, color, teaching_strategies
        )
      `)
      .eq('user_id', user.id)
      .eq('is_current', true)
      .order('assigned_at', { ascending: false });

    return NextResponse.json({ memberships: memberships || [] });
  }

  if (action === 'team_members') {
    // Teacher: see all members of a specific team
    const teamId = searchParams.get('team_id');
    if (!teamId) return NextResponse.json({ error: 'team_id required' }, { status: 400 });

    const { data: members } = await supabase
      .from('team_memberships' as any)
      .select(`
        *,
        profiles!team_memberships_user_id_fkey (
          id, full_name, avatar_url, education_level
        )
      `)
      .eq('team_id', teamId)
      .eq('is_current', true)
      .order('style_strength', { ascending: false });

    return NextResponse.json({ members: members || [] });
  }

  if (action === 'all_teams') {
    // Get all teams for a level + subject + board
    const levelCode = searchParams.get('level');
    const subjectId = searchParams.get('subject_id');

    let query = supabase
      .from('learning_style_teams' as any)
      .select(`
        *,
        learning_styles_master!learning_style_teams_style_code_fkey (
          code, name, icon, color
        )
      `)
      .eq('is_active', true);

    if (levelCode) query = query.eq('education_level_code', levelCode);
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data: teams } = await query.order('style_code');

    // Count members per team
    const teamIds = (teams || []).map((t: any) => t.id);
    const { data: memberCounts } = await supabase
      .from('team_memberships' as any)
      .select('team_id')
      .in('team_id', teamIds)
      .eq('is_current', true);

    const counts: Record<string, number> = {};
    (memberCounts || []).forEach((m: any) => {
      counts[m.team_id] = (counts[m.team_id] || 0) + 1;
    });

    const teamsWithCounts = (teams || []).map((t: any) => ({
      ...t,
      member_count: counts[t.id] || 0,
    }));

    return NextResponse.json({ teams: teamsWithCounts });
  }

  if (action === 'style_history') {
    // Student's style transition history
    const { data: transitions } = await supabase
      .from('style_transitions' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('transitioned_at', { ascending: false });

    return NextResponse.json({ transitions: transitions || [] });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// POST: Teacher override / reassignment
export async function POST(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify teacher role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers can reassign' }, { status: 403 });
  }

  const { action, student_id, subject_id, new_style_code, notes } = await request.json();

  if (action === 'reassign') {
    if (!student_id || !new_style_code) {
      return NextResponse.json({ error: 'student_id and new_style_code required' }, { status: 400 });
    }

    // Get student's education level
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('education_level')
      .eq('id', student_id)
      .single();

    const levelCode = studentProfile?.education_level || 'class_5';

    // Find or create target team
    let teamId: string | null = null;
    const { data: team } = await supabase
      .from('learning_style_teams' as any)
      .select('id')
      .eq('style_code', new_style_code)
      .eq('education_level_code', levelCode)
      .is('subject_id', subject_id || null)
      .limit(1)
      .single();

    if (team) {
      teamId = team.id;
    } else {
      const { data: styleMaster } = await supabase
        .from('learning_styles_master' as any)
        .select('name')
        .eq('code', new_style_code)
        .single();

      const { data: newTeam } = await supabase
        .from('learning_style_teams' as any)
        .insert({
          style_code: new_style_code,
          subject_id: subject_id || null,
          education_level_code: levelCode,
          team_name: `${styleMaster?.name || new_style_code} Team`,
        })
        .select()
        .single();

      teamId = newTeam?.id || null;
    }

    if (!teamId) return NextResponse.json({ error: 'Failed to find/create team' }, { status: 500 });

    // Get old style
    const { data: oldMembership } = await supabase
      .from('team_memberships' as any)
      .select('style_code')
      .eq('user_id', student_id)
      .is('subject_id', subject_id || null)
      .eq('is_current', true)
      .single();

    // Deactivate old
    await supabase
      .from('team_memberships' as any)
      .update({ is_current: false })
      .eq('user_id', student_id)
      .is('subject_id', subject_id || null)
      .eq('is_current', true);

    // Create new membership
    await supabase
      .from('team_memberships' as any)
      .insert({
        user_id: student_id,
        team_id: teamId,
        style_code: new_style_code,
        subject_id: subject_id || null,
        style_strength: 0, // teacher override, no eval score
        is_current: true,
        notes: notes || 'Teacher reassignment',
      });

    // Log transition
    await supabase
      .from('style_transitions' as any)
      .insert({
        user_id: student_id,
        subject_id: subject_id || null,
        from_style: oldMembership?.style_code || null,
        to_style: new_style_code,
        reason: 'teacher_override',
        notes,
      });

    return NextResponse.json({ success: true, team_id: teamId });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
