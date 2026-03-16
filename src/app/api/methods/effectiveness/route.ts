import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('student_method_effectiveness')
      .select('*, topics(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

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
    const { topic_id, method_code, understanding_before, understanding_after, time_spent_minutes, rating } = body;

    if (!topic_id || !method_code) {
      return NextResponse.json({ error: 'topic_id and method_code required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('student_method_effectiveness')
      .insert({
        user_id: user.id,
        topic_id,
        method_code,
        understanding_before: understanding_before || 0,
        understanding_after: understanding_after || 0,
        time_spent_minutes: time_spent_minutes || 0,
        rating: rating || 3,
      })
      .select()
      .single();

    if (error) throw error;

    // Update learning DNA preferred methods based on effectiveness
    const { data: topMethods } = await supabase
      .from('student_method_effectiveness')
      .select('method_code')
      .eq('user_id', user.id)
      .gte('rating', 4)
      .order('understanding_after', { ascending: false })
      .limit(5);

    if (topMethods && topMethods.length > 0) {
      const preferredMethods = [...new Set(topMethods.map((m: any) => m.method_code))];
      await supabase.from('learning_dna').upsert({
        user_id: user.id,
        preferred_methods: preferredMethods,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
