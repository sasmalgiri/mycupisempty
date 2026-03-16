import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { searchParams } = new URL(request.url);

    const topicId = searchParams.get('topicId');
    const subjectId = searchParams.get('subjectId');
    const type = searchParams.get('type');
    const difficulty = searchParams.get('difficulty');

    let query = supabase
      .from('activities')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (topicId) query = query.eq('topic_id', topicId);
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (type) query = query.eq('activity_type', type);
    if (difficulty) query = query.eq('difficulty', difficulty);

    const { data, error } = await query.limit(50);

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { activity_id, score, max_score, time_taken_seconds, completed, result_data } = body;

    if (!activity_id) {
      return NextResponse.json({ error: 'activity_id is required' }, { status: 400 });
    }

    // Save attempt
    const { data: attempt, error } = await supabase
      .from('activity_attempts')
      .insert({
        user_id: user.id,
        activity_id,
        score: score || 0,
        max_score: max_score || 100,
        time_taken_seconds: time_taken_seconds || 0,
        completed: completed || false,
        result_data: result_data || {},
      })
      .select()
      .single();

    if (error) throw error;

    // Award XP if completed
    if (completed) {
      const { data: activity } = await supabase
        .from('activities')
        .select('xp_reward')
        .eq('id', activity_id)
        .single();

      if (activity?.xp_reward) {
        const { data: stats } = await supabase
          .from('user_stats')
          .select('total_xp')
          .eq('user_id', user.id)
          .single();

        if (stats) {
          await supabase
            .from('user_stats')
            .update({ total_xp: stats.total_xp + activity.xp_reward })
            .eq('user_id', user.id);
        }
      }
    }

    return NextResponse.json({ success: true, data: attempt });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
