import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const vark = searchParams.get('vark');
    const subject = searchParams.get('subject');

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
