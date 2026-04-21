/**
 * Main Brain API.
 *
 * GET                  — snapshot: active directives + per-subject companion reports + cross-subject patterns
 * POST action=refresh  — re-aggregate reports NOW and issue new directives
 *
 * The snapshot powers the /companions dashboard and the parent digest, and
 * the directives are consumed by every companion session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState } from '@/lib/student-state';
import { aggregateReports, activeOnly, type BrainDirective } from '@/lib/main-brain';
import type { CompanionMemoryV2 } from '@/lib/companion-memory';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId') || user.id;

    if (studentId !== user.id) {
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('*')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Pull current directives + per-subject memory for reports
    const [{ data: directiveRow }, { data: memoryRows }] = await Promise.all([
      supabase.from('brain_directives').select('directives, updated_at').eq('user_id', studentId).maybeSingle(),
      supabase.from('companion_memory').select('subject_id, companion_id, memory_v2, subjects(title)').eq('user_id', studentId),
    ]);

    const activeDirectives: BrainDirective[] = directiveRow?.directives
      ? activeOnly(directiveRow.directives as BrainDirective[])
      : [];

    const reports = (memoryRows || [])
      .map((m: any) => {
        const memory = m.memory_v2 as CompanionMemoryV2 | null;
        if (!memory?.lastReport) return null;
        return {
          companionId: m.companion_id,
          subjectId: m.subject_id,
          subjectName: m.subjects?.title,
          report: memory.lastReport,
          rapport: memory.rapport,
          sessionCount: memory.sessionCount,
          facts: memory.facts?.slice(0, 3).map((f) => f.content) || [],
        };
      })
      .filter(Boolean);

    const state = await buildStudentState(supabase, studentId).catch(() => null);
    const snapshot = aggregateReports(studentId, reports as any, state || undefined);

    return NextResponse.json({
      success: true,
      snapshot,
      companionDetails: reports,
      currentDirectives: activeDirectives,
      lastUpdated: directiveRow?.updated_at,
    });
  } catch (error: any) {
    console.error('Main-brain GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    if (body.action !== 'refresh') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    // Read all companion memories, build fresh reports, aggregate, persist directives
    const { data: memoryRows } = await supabase
      .from('companion_memory')
      .select('subject_id, companion_id, memory_v2, subjects(title)')
      .eq('user_id', user.id);

    const reports = (memoryRows || [])
      .map((m: any) => {
        const memory = m.memory_v2 as CompanionMemoryV2 | null;
        if (!memory?.lastReport) return null;
        return {
          companionId: m.companion_id,
          subjectId: m.subject_id,
          subjectName: m.subjects?.title,
          report: memory.lastReport,
        };
      })
      .filter(Boolean);

    const state = await buildStudentState(supabase, user.id).catch(() => null);
    const snapshot = aggregateReports(user.id, reports as any, state || undefined);

    // Persist the new directives
    try {
      await supabase.from('brain_directives').upsert({
        user_id: user.id,
        directives: snapshot.activeDirectives,
        cross_patterns: snapshot.crossSubjectPatterns,
        recommended_focus: snapshot.recommendedFocusThisWeek,
        overall_sentiment: snapshot.overallSentiment,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (err) {
      console.error('Directive persist failed:', err);
    }

    return NextResponse.json({ success: true, snapshot });
  } catch (error: any) {
    console.error('Main-brain POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
