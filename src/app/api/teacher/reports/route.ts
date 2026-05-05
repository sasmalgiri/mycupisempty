/**
 * Teacher reports — class-level rollup of progress + adherence + character
 * growth + recent stuck-detections, scoped to the teacher's classrooms.
 *
 * GET ?classroomId=...  → { classroom, students[] }
 * GET (no params)       → { classrooms[] } so the teacher can pick one
 *
 * Returns aggregate per-student rows so the teacher can spot students lagging
 * on adherence, character XP, or who triggered a stuck-detection this week.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Teacher gate
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden — teacher only' }, { status: 403 });
    }

    const url = new URL(req.url);
    const classroomId = url.searchParams.get('classroomId');

    if (!classroomId) {
      const { data: classrooms } = await supabase
        .from('classrooms')
        .select('id, name, invite_code, class_level, created_at')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });
      return NextResponse.json({ success: true, classrooms: classrooms || [] });
    }

    const { data: classroom } = await supabase
      .from('classrooms')
      .select('id, name, invite_code, class_level, teacher_id')
      .eq('id', classroomId)
      .maybeSingle();
    if (!classroom || classroom.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Classroom not found or not owned' }, { status: 404 });
    }

    const { data: members } = await supabase
      .from('classroom_enrollments')
      .select('student_id, joined_at')
      .eq('classroom_id', classroomId)
      .eq('status', 'active');
    const userIds = (members || []).map((m: any) => m.student_id);

    if (userIds.length === 0) {
      return NextResponse.json({ success: true, classroom, students: [] });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Pull each rollup in parallel
    const [profilesRes, statsRes, streaksRes, weeklyXpRes, stuckRes, charactersRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, current_class').in('id', userIds),
      supabase.from('user_stats').select('user_id, total_xp, current_streak').in('user_id', userIds),
      supabase.from('streaks').select('user_id, current_streak, honesty_xp').in('user_id', userIds),
      supabase.from('xp_events').select('user_id, xp_amount, created_at').in('user_id', userIds).gte('created_at', sevenDaysAgo),
      supabase.from('stuck_detections').select('user_id, status, chapter_id, avg_score').in('user_id', userIds).in('status', ['detected', 'remediation_offered', 'remediation_running']),
      supabase.from('xp_events').select('user_id, xp_amount, created_at').in('user_id', userIds).eq('source_pillar', 'character').gte('created_at', sevenDaysAgo),
    ]);

    const profilesById = new Map<string, any>();
    for (const p of profilesRes.data || []) profilesById.set(p.id, p);
    const statsByUser = new Map<string, any>();
    for (const s of statsRes.data || []) statsByUser.set(s.user_id, s);
    const streaksByUser = new Map<string, any>();
    for (const s of streaksRes.data || []) streaksByUser.set(s.user_id, s);

    const weeklyXp: Record<string, number> = {};
    for (const e of weeklyXpRes.data || []) weeklyXp[e.user_id] = (weeklyXp[e.user_id] || 0) + (e.xp_amount || 0);

    const stuckByUser: Record<string, number> = {};
    for (const s of stuckRes.data || []) stuckByUser[s.user_id] = (stuckByUser[s.user_id] || 0) + 1;

    const characterByUser: Record<string, number> = {};
    for (const c of charactersRes.data || []) characterByUser[c.user_id] = (characterByUser[c.user_id] || 0) + (c.xp_amount || 0);

    const students = userIds.map((uid: string) => {
      const p = profilesById.get(uid) || {};
      return {
        user_id: uid,
        name: p.full_name || 'Student',
        class_level: p.current_class || classroom.class_level,
        total_xp: statsByUser.get(uid)?.total_xp || 0,
        current_streak: streaksByUser.get(uid)?.current_streak ?? statsByUser.get(uid)?.current_streak ?? 0,
        honesty_xp: streaksByUser.get(uid)?.honesty_xp || 0,
        weekly_xp: weeklyXp[uid] || 0,
        active_stuck_count: stuckByUser[uid] || 0,
        weekly_character_growth: characterByUser[uid] || 0,
      };
    });

    students.sort((a: any, b: any) => b.weekly_xp - a.weekly_xp);

    return NextResponse.json({ success: true, classroom, students });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
