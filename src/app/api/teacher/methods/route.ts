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
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    // Get assigned methods
    const { data: assigned } = await supabase
      .from('student_teaching_methods')
      .select('*, subjects(name, icon)')
      .eq('student_id', studentId);

    // Get effectiveness data
    const { data: effectiveness } = await supabase
      .from('student_method_effectiveness')
      .select('method_code, understanding_before, understanding_after, rating, time_spent_minutes')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })
      .limit(30);

    // Compute method stats
    const methodStats: Record<string, { attempts: number; avg_rating: number; avg_improvement: number }> = {};
    if (effectiveness) {
      for (const e of effectiveness) {
        if (!methodStats[e.method_code]) {
          methodStats[e.method_code] = { attempts: 0, avg_rating: 0, avg_improvement: 0 };
        }
        const s = methodStats[e.method_code];
        s.attempts++;
        s.avg_rating = ((s.avg_rating * (s.attempts - 1)) + (e.rating || 3)) / s.attempts;
        s.avg_improvement = ((s.avg_improvement * (s.attempts - 1)) + ((e.understanding_after || 0) - (e.understanding_before || 0))) / s.attempts;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        assigned: assigned || [],
        effectiveness: effectiveness || [],
        method_stats: methodStats,
      },
    });
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
    const { student_id, subject_id, recommended_methods, notes } = body;

    if (!student_id || !recommended_methods || recommended_methods.length === 0) {
      return NextResponse.json({ error: 'student_id and recommended_methods required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('student_teaching_methods')
      .upsert({
        student_id,
        teacher_id: user.id,
        subject_id: subject_id || null,
        recommended_methods,
        notes: notes || null,
      }, { onConflict: 'student_id,teacher_id,subject_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
