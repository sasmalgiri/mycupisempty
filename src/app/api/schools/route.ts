/**
 * Schools — list with type-ahead, attach to profile.
 *
 * GET ?q=term&board=wbbse → top 12 matching rows
 * POST { schoolId | createNew: { name, board_code, city, state }, section } →
 *      sets profiles.school_id (and school_section). Auto-creates a school
 *      row when createNew is supplied (treated as unverified until an admin
 *      flips is_verified).
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
    const board = url.searchParams.get('board');
    let query = supabase.from('schools').select('id, name, board_code, city, state, is_verified').order('is_verified', { ascending: false }).limit(12);
    if (q) query = query.ilike('name', `%${q.replace(/[%_]/g, '')}%`);
    if (board) query = query.eq('board_code', board);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true, schools: data || [] });
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
    let schoolId: string | null = body.schoolId || null;
    const section: string | null = body.section ? String(body.section).trim().slice(0, 4).toUpperCase() : null;

    if (!schoolId && body.createNew?.name) {
      const c = body.createNew;
      const { data: created, error } = await supabase
        .from('schools')
        .insert({
          name: String(c.name).trim().slice(0, 120),
          board_code: c.board_code || null,
          city: c.city ? String(c.city).trim().slice(0, 60) : null,
          state: c.state ? String(c.state).trim().slice(0, 60) : 'WB',
          is_verified: false,
        })
        .select('id')
        .single();
      if (error) throw error;
      schoolId = created.id;
    }

    if (schoolId === null && !body.unset) {
      return NextResponse.json({ error: 'schoolId or createNew.name required' }, { status: 400 });
    }

    await supabase.from('profiles').update({
      school_id: body.unset ? null : schoolId,
      school_section: body.unset ? null : section,
    }).eq('id', user.id);

    return NextResponse.json({ success: true, schoolId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
