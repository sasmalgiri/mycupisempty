/**
 * Method Calibration API
 *
 * GET — returns per-subject method effectiveness + current recommendation.
 *       This is what the dashboard + parent digest show: "for Math, Vedic Math
 *       is working best (82% effectiveness, 12 attempts). For English,
 *       storytelling."
 *
 * POST — records a behavioral outcome from a completed learning session.
 *        Called at the end of Daily Mix, quiz, guru chat, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  buildCalibrationMap,
  recordMethodOutcome,
  type MethodOutcome,
} from '@/lib/method-calibration';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId') || user.id;

    if (studentId !== user.id) {
      // Parent viewing — verify link
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('*')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the student's class level + subjects
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', studentId)
      .single();

    const classLevel = profile?.current_class || 8;

    // Get subjects the student is actively engaged with
    const { data: learnerStates } = await supabase
      .from('learner_state')
      .select('topics(subject_id, subjects(id, title))')
      .eq('user_id', studentId);

    const subjectMap = new Map<string, string>();
    (learnerStates || []).forEach((ls: any) => {
      const sid = ls.topics?.subject_id;
      const sname = ls.topics?.subjects?.title;
      if (sid && sname) subjectMap.set(sid, sname);
    });

    // If no subjects from learner_state, fall back to all subjects for this class
    if (subjectMap.size === 0) {
      const { data: allSubjects } = await supabase
        .from('subjects')
        .select('id, title')
        .eq('class_level', classLevel);
      (allSubjects || []).forEach((s: any) => subjectMap.set(s.id, s.title));
    }

    const subjectList = Array.from(subjectMap.entries()).map(([id, name]) => ({ id, name }));
    const calibrationMap = await buildCalibrationMap(supabase, studentId, subjectList);

    return NextResponse.json({
      success: true,
      studentId,
      calibration: calibrationMap,
    });
  } catch (error: any) {
    console.error('Method calibration GET error:', error);
    return NextResponse.json({ error: error.message || 'Calibration failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      subjectId, topicId, method,
      accuracyDelta, completed, timeSpentSeconds, engagementScore,
      retentionAt7Days, confidenceGapAfter,
    } = body;

    if (!subjectId || !method) {
      return NextResponse.json({ error: 'subjectId and method required' }, { status: 400 });
    }

    const outcome: Omit<MethodOutcome, 'timestamp'> = {
      userId: user.id,
      subjectId,
      topicId,
      method,
      accuracyDelta: Number(accuracyDelta) || 0,
      completed: Boolean(completed),
      timeSpentSeconds: Number(timeSpentSeconds) || 0,
      engagementScore: Number(engagementScore) || 0.5,
      retentionAt7Days,
      confidenceGapAfter,
    };

    await recordMethodOutcome(supabase, outcome);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Method calibration POST error:', error);
    return NextResponse.json({ error: error.message || 'Record failed' }, { status: 500 });
  }
}
