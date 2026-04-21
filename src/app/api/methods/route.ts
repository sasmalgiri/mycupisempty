import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const vark = searchParams.get('vark');
    const subjectRaw = searchParams.get('subject');

    // Subject goes into a raw PostgREST filter string via .or(); reject anything
    // that isn't a plain slug/UUID so a crafted value like "x},extra_filter" can't
    // inject additional predicates into the query.
    const subject = subjectRaw && /^[a-zA-Z0-9_-]{1,64}$/.test(subjectRaw)
      ? subjectRaw
      : null;

    let query = supabase
      .from('teaching_methods')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    if (vark) {
      query = query.contains('best_for_vark', [vark]);
    }

    if (subject) {
      query = query.or(`best_for_subjects.cs.{${subject}},best_for_subjects.cs.{all}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
