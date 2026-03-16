import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const [traits, goals] = await Promise.all([
      supabase
        .from('character_traits')
        .select('*')
        .eq('student_id', studentId)
        .order('trait_category'),
      supabase
        .from('character_goals')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
    ]);

    // Compute overall score and strengths/weaknesses
    const traitData = traits.data || [];
    const latestTraits: Record<string, number> = {};
    for (const t of traitData) {
      if (!latestTraits[t.trait_category] || new Date(t.assessed_at) > new Date(latestTraits[t.trait_category] as any)) {
        latestTraits[t.trait_category] = t.score;
      }
    }

    const scores = Object.entries(latestTraits);
    const overall = scores.length > 0
      ? Math.round(scores.reduce((sum, [, s]) => sum + s, 0) / scores.length)
      : 0;

    const sorted = scores.sort(([, a], [, b]) => b - a);
    const strengths = sorted.slice(0, 3).map(([k]) => k);
    const areasForGrowth = sorted.slice(-3).map(([k]) => k);

    return NextResponse.json({
      success: true,
      data: {
        traits: traitData,
        goals: goals.data || [],
        overall_score: overall,
        strengths,
        areas_for_growth: areasForGrowth,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}

// Create/update character trait
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, trait_category, score, observations } = body;

    if (!student_id || !trait_category) {
      return NextResponse.json({ error: 'student_id and trait_category required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('character_traits')
      .insert({
        student_id,
        teacher_id: user.id,
        trait_category,
        score: score || 50,
        observations: observations || null,
        assessed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}

// Create/update character goal
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { student_id, trait_category, goal_description, target_score, due_date, classroom_id, goal_id, status } = body;

    // Update existing goal
    if (goal_id) {
      const { data, error } = await supabase
        .from('character_goals')
        .update({
          ...(status && { status }),
          ...(goal_description && { goal_description }),
          ...(target_score && { target_score }),
        })
        .eq('id', goal_id)
        .eq('teacher_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // Create new goal
    if (!student_id || !trait_category || !goal_description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('character_goals')
      .insert({
        student_id,
        teacher_id: user.id,
        classroom_id: classroom_id || null,
        trait_category,
        goal_description,
        target_score: target_score || 80,
        due_date: due_date || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
