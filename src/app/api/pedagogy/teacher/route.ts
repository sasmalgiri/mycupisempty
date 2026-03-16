import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// ============================================================================
// Teacher-facing Pedagogy Engine API
// View student states, tier assignments, intervention management
// ============================================================================

export async function GET(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify teacher
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'teacher') return NextResponse.json({ error: 'Teachers only' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'overview';

  // --- Overview: all students with active states ---
  if (action === 'overview') {
    const subjectId = searchParams.get('subject_id');

    let query = supabase.from('learner_state').select(`
      *,
      profiles!learner_state_user_id_fkey(id, full_name, avatar_url)
    `);
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data: states } = await query.order('updated_at', { ascending: false }).limit(100);

    // Group by band for quick summary
    const summary = {
      foundation: 0, emerging: 0, developing: 0, secure: 0, advanced: 0,
      tier1: 0, tier2: 0, tier3: 0, needs_review: 0,
    };
    (states || []).forEach((s: any) => {
      summary[s.current_band as keyof typeof summary]++;
      if (s.support_tier === 1) summary.tier1++;
      else if (s.support_tier === 2) summary.tier2++;
      else if (s.support_tier === 3) summary.tier3++;
      if (s.needs_human_review) summary.needs_review++;
    });

    return NextResponse.json({ states: states || [], summary });
  }

  // --- Student detail ---
  if (action === 'student_detail') {
    const studentId = searchParams.get('student_id');
    if (!studentId) return NextResponse.json({ error: 'student_id required' }, { status: 400 });

    const [statesRes, eventsRes, tiersRes, miscRes, decisionsRes] = await Promise.all([
      supabase.from('learner_state').select('*').eq('user_id', studentId).order('updated_at', { ascending: false }),
      supabase.from('module_events').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(30),
      supabase.from('tier_assignments').select('*').eq('user_id', studentId).order('created_at', { ascending: false }),
      supabase.from('student_misconceptions').select('*, misconception_bank!student_misconceptions_misconception_code_fkey(*)').eq('user_id', studentId).eq('is_resolved', false),
      supabase.from('engine_decisions').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(20),
    ]);

    return NextResponse.json({
      states: statesRes.data || [],
      events: eventsRes.data || [],
      tier_assignments: tiersRes.data || [],
      misconceptions: miscRes.data || [],
      decisions: decisionsRes.data || [],
    });
  }

  // --- Flagged students (needs_human_review or tier 3) ---
  if (action === 'flagged') {
    const { data: flagged } = await supabase
      .from('learner_state')
      .select('*, profiles!learner_state_user_id_fkey(id, full_name, avatar_url)')
      .or('needs_human_review.eq.true,support_tier.eq.3')
      .order('frustration_signals', { ascending: false });

    return NextResponse.json({ flagged: flagged || [] });
  }

  // --- Tier assignments ---
  if (action === 'tier_assignments') {
    const tier = searchParams.get('tier');
    let query = supabase.from('tier_assignments')
      .select('*, profiles!tier_assignments_user_id_fkey(id, full_name, avatar_url)')
      .eq('is_active', true);
    if (tier) query = query.eq('tier', parseInt(tier));

    const { data: assignments } = await query.order('assigned_at', { ascending: false });
    return NextResponse.json({ assignments: assignments || [] });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'teacher') return NextResponse.json({ error: 'Teachers only' }, { status: 403 });

  const body = await request.json();
  const { action } = body;

  // --- Override tier assignment ---
  if (action === 'tier_override') {
    const { student_id, subject_id, topic_id, new_tier, reason, interventions } = body;

    // Deactivate old
    await supabase.from('tier_assignments')
      .update({ is_active: false, resolved_at: new Date().toISOString(), resolved_reason: 'teacher_override' })
      .eq('user_id', student_id)
      .eq('subject_id', subject_id)
      .eq('is_active', true);

    // Create new
    const { data: assignment } = await supabase.from('tier_assignments').insert({
      user_id: student_id,
      subject_id,
      topic_id: topic_id || null,
      tier: new_tier,
      reason,
      assigned_by: 'teacher',
      teacher_id: user.id,
      interventions: interventions || [],
    }).select().single();

    // Update learner state
    await supabase.from('learner_state')
      .update({ support_tier: new_tier, needs_human_review: false, teacher_notes: reason })
      .eq('user_id', student_id)
      .eq('subject_id', subject_id);

    return NextResponse.json({ assignment });
  }

  // --- Add teacher notes ---
  if (action === 'add_notes') {
    const { learner_state_id, notes } = body;

    await supabase.from('learner_state')
      .update({ teacher_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', learner_state_id);

    return NextResponse.json({ success: true });
  }

  // --- Resolve human review flag ---
  if (action === 'resolve_review') {
    const { learner_state_id, notes } = body;

    await supabase.from('learner_state')
      .update({ needs_human_review: false, teacher_notes: notes, updated_at: new Date().toISOString() })
      .eq('id', learner_state_id);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
