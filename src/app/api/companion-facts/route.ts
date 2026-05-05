/**
 * Companion Facts + Interests API.
 *
 * GET ?companionId=...           → list active facts the companion remembers
 * POST { companionId, fact, category?, source? }
 *                                → companion remembers a new fact
 * POST { factId, action: 'forget' } → student asks the companion to forget it
 * POST { factId, action: 'reference' } → bump last_referenced_at (analytics)
 *
 * Interests:
 * GET /interests                 → list current interests with weights
 * POST /interests { interest, weight?, source? }
 * POST /interests { interest, action: 'remove' }
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const VALID_CATEGORIES = ['aspiration', 'family', 'interest', 'struggle', 'celebration'];

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const companionId = url.searchParams.get('companionId');

    let q = supabase
      .from('companion_facts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);
    if (companionId) q = q.eq('companion_id', companionId);

    const { data: rows } = await q.order('remembered_at', { ascending: false }).limit(40);
    return NextResponse.json({ success: true, facts: rows || [] });
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

    if (body.action === 'forget' && body.factId) {
      await supabase.from('companion_facts').update({ is_active: false }).eq('id', body.factId).eq('user_id', user.id);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'reference' && body.factId) {
      await supabase.from('companion_facts')
        .update({ last_referenced_at: new Date().toISOString() })
        .eq('id', body.factId)
        .eq('user_id', user.id);
      return NextResponse.json({ success: true });
    }

    // Insert new fact
    const fact = String(body.fact || '').trim();
    const companionId = body.companionId;
    if (!fact || !companionId) return NextResponse.json({ error: 'fact + companionId required' }, { status: 400 });
    const category = VALID_CATEGORIES.includes(body.category) ? body.category : 'interest';
    const source = body.source === 'onboarding' || body.source === 'inferred' ? body.source : 'chat';
    const confidence = Math.max(0, Math.min(1, Number(body.confidence) || 0.7));

    const { data: row, error } = await supabase.from('companion_facts').insert({
      user_id: user.id,
      companion_id: companionId,
      fact: fact.slice(0, 280),
      category,
      source,
      confidence,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, fact: row });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
