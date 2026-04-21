/**
 * Session Reflection — 15-second end-of-session pulse.
 *
 * At the end of every meaningful session, we ask the student:
 *   • How useful was this? (1–5)
 *   • Something you understood? (optional short text)
 *   • Something still confusing? (optional short text)
 *
 * The answers feed self-learning as a resolved experience + become rich
 * signals for the main brain. No AI required — pure intake + signals.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  logExperience,
  contextKeyFor,
  classBandFromClassLevel,
  moodBucketFromState,
} from '@/lib/self-learning';
import { buildStudentState } from '@/lib/student-state';

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      sessionKind,           // 'daily_mix' | 'companion_chat' | 'lab' | 'exam' | 'assignment'
      sessionId,
      subjectId,
      usefulness,            // 1..5 — student's rating
      understoodSomething,   // optional short text
      stillConfusing,        // optional short text
      difficultyFelt,        // 'too_easy' | 'just_right' | 'too_hard'
    } = body;

    if (typeof usefulness !== 'number' || usefulness < 1 || usefulness > 5) {
      return NextResponse.json({ error: 'usefulness must be 1..5' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Persist the reflection (always safe — table may not exist yet)
    try {
      await supabase.from('session_reflections').insert({
        user_id: user.id,
        session_kind: sessionKind || 'unknown',
        session_id: sessionId || null,
        subject_id: subjectId || null,
        usefulness,
        understood: understoodSomething?.slice(0, 300) || null,
        confusing: stillConfusing?.slice(0, 300) || null,
        difficulty_felt: difficultyFelt || null,
        created_at: now,
      });
    } catch (err) {
      console.warn('Reflection persist warning:', err);
    }

    // Emit signals so StudentState can use them
    try {
      const signals: any[] = [];

      // Usefulness rating → overall engagement signal
      signals.push({
        user_id: user.id,
        signal_type: 'session_reflection',
        category: 'metacognition',
        source: 'reflection',
        subject_id: subjectId || null,
        value: (usefulness - 1) / 4,      // map 1..5 → 0..1
        metadata: { session_kind: sessionKind, session_id: sessionId, difficulty_felt: difficultyFelt },
        created_at: now,
      });

      // Confusion surfaced → misconception signal
      if (stillConfusing && stillConfusing.trim().length > 3) {
        signals.push({
          user_id: user.id,
          signal_type: 'error_pattern',
          category: 'performance',
          source: 'reflection',
          subject_id: subjectId || null,
          value: 0,
          metadata: { misconception: stillConfusing.slice(0, 120), from: 'self_reflection' },
          created_at: now,
        });
      }

      // Understanding moment → breakthrough signal
      if (understoodSomething && understoodSomething.trim().length > 3) {
        signals.push({
          user_id: user.id,
          signal_type: 'breakthrough',
          category: 'performance',
          source: 'reflection',
          subject_id: subjectId || null,
          value: 1,
          metadata: { insight: understoodSomething.slice(0, 120), from: 'self_reflection' },
          created_at: now,
        });
      }

      // Difficulty-felt → feedback on calibration
      if (difficultyFelt) {
        signals.push({
          user_id: user.id,
          signal_type: 'difficulty_feel',
          category: 'metacognition',
          source: 'reflection',
          subject_id: subjectId || null,
          value: difficultyFelt === 'too_easy' ? 1 : difficultyFelt === 'just_right' ? 0.5 : 0,
          metadata: { felt: difficultyFelt, session_kind: sessionKind },
          created_at: now,
        });
      }

      if (signals.length > 0) {
        await supabase.from('learner_signals').insert(signals);
      }
    } catch (err) {
      console.warn('Reflection signals warning:', err);
    }

    // Log as a resolved experience so the self-learning system improves
    try {
      const state = await buildStudentState(supabase, user.id).catch(() => null);
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_class')
        .eq('id', user.id)
        .single()
        .catch(() => ({ data: null }));
      const classLevel = profile?.current_class || 8;

      if (state && sessionKind) {
        // Subject name (best-effort) — look it up for context key
        let subjectName: string | undefined;
        if (subjectId) {
          const { data: sub } = await supabase.from('subjects').select('title').eq('id', subjectId).maybeSingle();
          subjectName = sub?.title;
        }
        const contextKey = contextKeyFor({
          subjectName,
          moodBucket: moodBucketFromState(state.frustrationLevel, state.confidenceLevel),
          classBand: classBandFromClassLevel(classLevel),
        });
        const reward = (usefulness - 3) / 2;   // map 1..5 → -1..+1
        await logExperience(supabase, {
          userId: user.id,
          kind: 'adaptation_decision',
          contextKey,
          actionKey: `session:${sessionKind}`,
          reward,
          metadata: {
            usefulness,
            session_kind: sessionKind,
            difficulty_felt: difficultyFelt,
          },
        }, { resolvedNow: true });
      }
    } catch {}

    return NextResponse.json({
      success: true,
      thanks: usefulness >= 4
        ? 'Glad it clicked. Noted for next time.'
        : usefulness >= 3
        ? 'Got it — your companions will adjust.'
        : 'Sorry it was rough. We\'ll make it better.',
    });
  } catch (error: any) {
    console.error('Session reflection error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
