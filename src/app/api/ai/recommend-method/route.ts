import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateMethodRecommendation } from '@/lib/ollama-guru';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { topic, subject, class_level } = await request.json();

    // Get learning DNA
    const { data: dna } = await supabase
      .from('learning_dna')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get method effectiveness history
    const { data: effectiveness } = await supabase
      .from('student_method_effectiveness')
      .select('method_code, understanding_after, rating')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const recommendations = await generateMethodRecommendation(
      dna || {},
      topic || 'General',
      subject || 'General',
      class_level || 8
    );

    // Boost methods the student has rated highly
    if (effectiveness && effectiveness.length > 0) {
      const methodRatings: Record<string, number> = {};
      for (const e of effectiveness) {
        if (!methodRatings[e.method_code] || e.rating > methodRatings[e.method_code]) {
          methodRatings[e.method_code] = e.rating;
        }
      }

      for (const rec of recommendations) {
        if (methodRatings[rec.method_code] && methodRatings[rec.method_code] >= 4) {
          rec.match_score = Math.min(100, rec.match_score + 5);
          rec.reason += ' (You rated this method highly before!)';
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: recommendations.sort((a, b) => b.match_score - a.match_score),
    });
  } catch (error: any) {
    console.error('Method recommendation error:', error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
