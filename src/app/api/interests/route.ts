/**
 * Interests API — feeds Khan-Interests-style word problem personalization.
 * Both declared (student types it) and inferred (chat-extracted, click-based).
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data } = await supabase
      .from('interests')
      .select('*')
      .eq('user_id', user.id)
      .order('weight', { ascending: false })
      .limit(40);
    return NextResponse.json({ success: true, interests: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const interest = String(body.interest || '').trim().toLowerCase();
    if (!interest) return NextResponse.json({ error: 'interest required' }, { status: 400 });

    if (body.action === 'remove') {
      await supabase.from('interests').delete().eq('user_id', user.id).eq('interest', interest);
      return NextResponse.json({ success: true });
    }

    const weight = Math.max(0, Math.min(2, Number(body.weight) || 1.0));
    const source = body.source || 'declared';
    await supabase.from('interests').upsert({
      user_id: user.id,
      interest: interest.slice(0, 40),
      weight,
      source,
      last_used_at: null,
    }, { onConflict: 'user_id,interest' });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
