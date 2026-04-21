/**
 * My Notebook — the student's own archive of what they wrote, reflected on,
 * and how they felt across sessions. Read-write learners (and any student who
 * wants to look back) get a flip-through of their own history.
 *
 * Aggregates:
 *   - reflection_entries: long-form written reflections
 *   - session_reflections: 15-second session pulses (usefulness, confusion, etc.)
 *
 * Ordered newest first. Capped at 60 combined entries to keep the page light.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface NotebookEntry {
  id: string;
  kind: 'reflection' | 'session_pulse';
  created_at: string;
  prompt?: string;
  body?: string;
  session_kind?: string;
  usefulness?: number;
  understood?: string;
  confusing?: string;
  difficulty_felt?: string;
  dimension_tags?: string[];
}

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [reflRes, pulseRes] = await Promise.all([
      supabase
        .from('reflection_entries')
        .select('id, reflection_type, prompt_text, response_text, dimension_tags, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('session_reflections')
        .select('id, session_kind, usefulness, understood, confusing, difficulty_felt, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    const entries: NotebookEntry[] = [];

    (reflRes?.data || []).forEach((r: any) => {
      entries.push({
        id: `r-${r.id}`,
        kind: 'reflection',
        created_at: r.created_at,
        prompt: r.prompt_text,
        body: r.response_text,
        dimension_tags: r.dimension_tags || [],
      });
    });

    (pulseRes?.data || []).forEach((p: any) => {
      entries.push({
        id: `p-${p.id}`,
        kind: 'session_pulse',
        created_at: p.created_at,
        session_kind: p.session_kind,
        usefulness: p.usefulness,
        understood: p.understood,
        confusing: p.confusing,
        difficulty_felt: p.difficulty_felt,
      });
    });

    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ success: true, entries: entries.slice(0, 60) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
