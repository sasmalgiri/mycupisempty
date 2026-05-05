/**
 * Courses API.
 *
 * GET                                            → list available courses
 * GET ?id=...                                    → course detail with chapter map
 * GET ?my=1                                      → student's enrollments + active plan
 * POST { action: 'enroll', courseId, startDate, weeklyMinutes }
 * POST { action: 'unenroll', enrollmentId }
 *
 * The "publish" of courses happens by setting curriculum_courses.is_published.
 * This route doesn't expose unpublished rows.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const my = url.searchParams.get('my');
    const id = url.searchParams.get('id');

    if (my) {
      // Use the v_student_current_course view defined in migration 022.
      const { data } = await supabase
        .from('course_enrollments')
        .select('id, course_id, enrolled_at, start_date, target_completion_date, weekly_minutes_target, status, curriculum_courses!inner(*)')
        .eq('user_id', user.id)
        .order('enrolled_at', { ascending: false });
      return NextResponse.json({ success: true, enrollments: data || [] });
    }

    if (id) {
      const { data: course } = await supabase
        .from('curriculum_courses')
        .select('*')
        .eq('id', id)
        .eq('is_published', true)
        .maybeSingle();
      if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      // Pull subjects + chapters for this board+class+language.
      const { data: subjects } = await supabase
        .from('curriculum_subjects_by_class')
        .select('id, subject_slug, textbook_title_native, textbook_title_romanized, textbook_title_en, total_chapters, expected_hours_per_year, expected_minutes_per_week, language')
        .eq('board_code', course.board_code)
        .eq('class_level', course.class_level);

      const subjectIds = (subjects || []).map((s: any) => s.id);
      const { data: chapters } = subjectIds.length
        ? await supabase
            .from('curriculum_chapters')
            .select('id, subject_class_id, chapter_no, title_en, title_native, description, season_hint, expected_hours, maturity_band, exam_weight_pct')
            .in('subject_class_id', subjectIds)
            .order('chapter_no', { ascending: true })
        : { data: [] };

      // Already enrolled?
      const { data: myEnrollment } = await supabase
        .from('course_enrollments')
        .select('id, status, start_date, weekly_minutes_target')
        .eq('user_id', user.id)
        .eq('course_id', id)
        .maybeSingle();

      return NextResponse.json({ success: true, course, subjects: subjects || [], chapters: chapters || [], myEnrollment: myEnrollment || null });
    }

    // Default: list published courses
    const klass = url.searchParams.get('class');
    let q = supabase
      .from('curriculum_courses')
      .select('*')
      .eq('is_published', true);
    if (klass) q = q.eq('class_level', Number(klass));
    const { data: rows } = await q.order('class_level', { ascending: true });
    return NextResponse.json({ success: true, courses: rows || [] });
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

    if (body.action === 'enroll') {
      const courseId = body.courseId;
      if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });
      const startDate = body.startDate || new Date().toISOString().split('T')[0];
      const weeklyMinutes = Math.max(60, Math.min(1200, Number(body.weeklyMinutes) || 300));

      // Pull course duration so we can set a default target completion.
      const { data: course } = await supabase
        .from('curriculum_courses')
        .select('expected_weeks')
        .eq('id', courseId)
        .maybeSingle();
      const weeks = course?.expected_weeks || 40;
      const target = new Date(startDate);
      target.setDate(target.getDate() + weeks * 7);

      const { data: row, error } = await supabase
        .from('course_enrollments')
        .upsert({
          user_id: user.id,
          course_id: courseId,
          start_date: startDate,
          target_completion_date: target.toISOString().split('T')[0],
          weekly_minutes_target: weeklyMinutes,
          status: 'active',
        }, { onConflict: 'user_id,course_id' })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Fire-and-forget plan generation. We don't block the enrol response —
      // if it fails the student can replan manually from the course page.
      try {
        const baseUrl = new URL(req.url).origin;
        fetch(`${baseUrl}/api/plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: req.headers.get('cookie') || '',
          },
          body: JSON.stringify({ enrollmentId: row.id, action: 'generate' }),
        }).catch((err) => console.warn('plan generation failed:', err));
      } catch { /* non-blocking */ }

      return NextResponse.json({ success: true, enrollment: row });
    }

    if (body.action === 'unenroll' && body.enrollmentId) {
      await supabase
        .from('course_enrollments')
        .update({ status: 'dropped' })
        .eq('id', body.enrollmentId)
        .eq('user_id', user.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
