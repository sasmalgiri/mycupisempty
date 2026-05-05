/**
 * Lightweight self-profile read. Used by client components that need
 * current_class / board_code / language without bundling the supabase client.
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
      .select('id, full_name, current_class, board_code, language, school_id, school_section, character_goal, onboarded_at')
      .eq('id', user.id)
      .maybeSingle();
    return NextResponse.json({ success: true, profile: profile || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
