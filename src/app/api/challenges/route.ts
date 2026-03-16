import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active challenges
    const { data: challenges, error } = await supabase
      .from('challenges')
      .select(`
        *,
        challenge_participants(id, user_id, score, rank, completed_at)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Annotate with user's participation
    const enriched = (challenges || []).map((c: any) => ({
      ...c,
      my_participation: c.challenge_participants?.find((p: any) => p.user_id === user.id) || null,
      participant_count: c.challenge_participants?.length || 0,
    }));

    return NextResponse.json({ success: true, data: enriched });
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
    const { action } = body;

    if (action === 'join') {
      const { challenge_id } = body;
      const { data, error } = await supabase
        .from('challenge_participants')
        .upsert({
          challenge_id,
          user_id: user.id,
          score: 0,
        }, { onConflict: 'challenge_id,user_id' })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (action === 'submit') {
      const { challenge_id, score } = body;

      const { data, error } = await supabase
        .from('challenge_participants')
        .update({
          score,
          completed_at: new Date().toISOString(),
        })
        .eq('challenge_id', challenge_id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Recalculate ranks for this challenge
      const { data: participants } = await supabase
        .from('challenge_participants')
        .select('id, score')
        .eq('challenge_id', challenge_id)
        .not('completed_at', 'is', null)
        .order('score', { ascending: false });

      if (participants) {
        for (let i = 0; i < participants.length; i++) {
          await supabase
            .from('challenge_participants')
            .update({ rank: i + 1 })
            .eq('id', participants[i].id);
        }
      }

      return NextResponse.json({ success: true, data });
    }

    if (action === 'create') {
      // Teacher creates a challenge
      const { title, description, challenge_type, topic_id, subject_id, classroom_id, config, starts_at, ends_at } = body;

      const { data, error } = await supabase
        .from('challenges')
        .insert({
          created_by: user.id,
          title,
          description,
          challenge_type: challenge_type || 'speed',
          topic_id,
          subject_id,
          classroom_id,
          config: config || {},
          starts_at,
          ends_at,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
