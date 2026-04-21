/**
 * Prefill data for the onboarding page so we don't re-ask class + board
 * when the signup flow already captured them.
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
      .select('full_name, current_class, board_code, language, onboarded_at')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({ success: true, profile: profile || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
