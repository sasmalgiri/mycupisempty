import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateGeneralStyleQuestions, generateSubjectStyleQuestions, computeStyleScores, determinePrimaryAndSecondary } from '@/lib/style-evaluation-engine';

// GET: Fetch learning styles master list + student's evaluation history
export async function GET(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'styles';

  if (action === 'styles') {
    const { data: styles } = await supabase
      .from('learning_styles_master' as any)
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    return NextResponse.json({ styles: styles || [] });
  }

  if (action === 'my_evaluations') {
    const { data: attempts } = await supabase
      .from('style_evaluation_attempts' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ evaluations: attempts || [] });
  }

  if (action === 'questions') {
    const subjectName = searchParams.get('subject');
    const generalQuestions = generateGeneralStyleQuestions();
    const subjectQuestions = subjectName ? generateSubjectStyleQuestions(subjectName) : [];

    return NextResponse.json({
      general_questions: generalQuestions,
      subject_questions: subjectQuestions,
      total_questions: generalQuestions.length + subjectQuestions.length,
    });
  }

  if (action === 'education_levels') {
    const { data: levels } = await supabase
      .from('education_levels' as any)
      .select('*')
      .eq('is_active', true)
      .order('level_order');

    return NextResponse.json({ levels: levels || [] });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// POST: Start or complete an evaluation
export async function POST(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  // Start a new evaluation
  if (action === 'start') {
    const { subject_id } = body;

    const { data: attempt, error } = await supabase
      .from('style_evaluation_attempts' as any)
      .insert({
        user_id: user.id,
        evaluation_id: body.evaluation_id || null,
        subject_id: subject_id || null,
        answers: [],
        status: 'in_progress',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attempt });
  }

  // Submit completed evaluation
  if (action === 'complete') {
    const { attempt_id, answers, questions } = body;

    if (!attempt_id || !answers || !questions) {
      return NextResponse.json({ error: 'Missing attempt_id, answers, or questions' }, { status: 400 });
    }

    // Compute style scores
    const styleScores = computeStyleScores(answers, questions);
    const { primary, secondary, confidence } = determinePrimaryAndSecondary(styleScores);

    // Update the attempt
    const { data: attempt, error } = await supabase
      .from('style_evaluation_attempts' as any)
      .update({
        answers,
        style_scores: styleScores,
        primary_style: primary,
        secondary_style: secondary,
        confidence_score: confidence,
        completed_at: new Date().toISOString(),
        status: 'completed',
      })
      .eq('id', attempt_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-assign to team
    const subjectId = attempt?.subject_id;

    // Check if team exists, create if not
    const { data: profile } = await supabase
      .from('profiles')
      .select('education_level')
      .eq('id', user.id)
      .single();

    const levelCode = profile?.education_level || 'class_5';

    let teamId: string | null = null;
    const { data: existingTeam } = await supabase
      .from('learning_style_teams' as any)
      .select('id')
      .eq('style_code', primary)
      .eq('education_level_code', levelCode)
      .is('subject_id', subjectId || null)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (existingTeam) {
      teamId = existingTeam.id;
    } else {
      // Get style name
      const { data: styleMaster } = await supabase
        .from('learning_styles_master' as any)
        .select('name')
        .eq('code', primary)
        .single();

      const { data: newTeam } = await supabase
        .from('learning_style_teams' as any)
        .insert({
          style_code: primary,
          subject_id: subjectId,
          education_level_code: levelCode,
          team_name: `${styleMaster?.name || primary} Team`,
        })
        .select()
        .single();

      teamId = newTeam?.id || null;
    }

    // Deactivate old membership
    if (teamId) {
      await supabase
        .from('team_memberships' as any)
        .update({ is_current: false })
        .eq('user_id', user.id)
        .is('subject_id', subjectId || null)
        .eq('is_current', true);

      // Create new membership
      await supabase
        .from('team_memberships' as any)
        .insert({
          user_id: user.id,
          team_id: teamId,
          style_code: primary,
          subject_id: subjectId,
          evaluation_id: attempt_id,
          style_strength: confidence,
          is_current: true,
        });

      // Log transition
      await supabase
        .from('style_transitions' as any)
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          to_style: primary,
          reason: 'initial_assessment',
          evaluation_id: attempt_id,
          confidence_score: confidence,
        });
    }

    // Update learning DNA preferred methods
    const { STYLE_METHOD_MAP } = await import('@/lib/style-evaluation-engine');
    const preferredMethods = STYLE_METHOD_MAP[primary] || [];

    await supabase
      .from('learning_dna')
      .upsert({
        user_id: user.id,
        preferred_methods: preferredMethods,
        computed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    return NextResponse.json({
      attempt,
      style_scores: styleScores,
      primary_style: primary,
      secondary_style: secondary,
      confidence,
      team_id: teamId,
      preferred_methods: preferredMethods,
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
