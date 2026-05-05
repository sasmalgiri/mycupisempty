/**
 * Read endpoint for the admin QBank coverage view.
 * Role-gated.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Admin / teacher role required' }, { status: 403 });
    }

    const { data: rows } = await supabase
      .from('v_qbank_coverage')
      .select('*')
      .order('class_level', { ascending: true })
      .order('subject_slug', { ascending: true });
    return NextResponse.json({ success: true, rows: rows || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
