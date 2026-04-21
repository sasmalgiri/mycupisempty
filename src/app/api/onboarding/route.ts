/**
 * Onboarding API — seeds the student's profile on first arrival.
 *
 * Five pieces of information asked, SHORT + honest:
 *   1. Class + board        (for topic alignment — NOT affiliation claim)
 *   2. Preferred language   (en/hi/bn)
 *   3. Easiest subject      (to seed first companion relationship)
 *   4. Toughest subject     (to seed first focus area)
 *   5. One character quality to grow this year
 *      — this is the ONE thing the founder wants us to anchor around.
 *
 * Onboarding is NOT a VARK-style quiz. We observe behavior; here we just
 * establish scaffolding so the first session isn't cold-start.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { CharacterDim } from '@/lib/content-library';

const VALID_CHARACTER_GOALS: CharacterDim[] = [
  'patience', 'curiosity', 'honesty', 'empathy', 'discipline',
  'persistence', 'failure_handling', 'confidence', 'responsibility',
  'consistency', 'emotional_regulation', 'self_direction',
];

const VALID_BOARDS = ['cbse', 'icse', 'cisce', 'wbbse', 'ssc', 'state', 'other'];
const VALID_LANGS = ['en', 'hi', 'bn'];

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      fullName,
      classLevel,
      boardCode,
      language,
      easiestSubject,
      toughestSubject,
      characterGoal,
    } = body;

    // Validate
    const cls = Number(classLevel);
    if (!Number.isInteger(cls) || cls < 1 || cls > 12) {
      return NextResponse.json({ error: 'classLevel must be 1..12' }, { status: 400 });
    }
    if (boardCode && !VALID_BOARDS.includes(boardCode)) {
      return NextResponse.json({ error: `boardCode must be one of ${VALID_BOARDS.join(', ')}` }, { status: 400 });
    }
    if (language && !VALID_LANGS.includes(language)) {
      return NextResponse.json({ error: 'language must be en | hi | bn' }, { status: 400 });
    }
    if (characterGoal && !VALID_CHARACTER_GOALS.includes(characterGoal)) {
      return NextResponse.json({ error: 'Invalid characterGoal' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Upsert profile
    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName ? String(fullName).slice(0, 100) : undefined,
        current_class: cls,
        board_code: boardCode || null,
        language: language || 'en',
        character_goal: characterGoal || null,
        onboarded_at: now,
      }, { onConflict: 'id' });
    } catch (err) {
      console.error('Profile upsert failed:', err);
    }

    // Persist initial character goal as a growth-dimension intent
    if (characterGoal) {
      try {
        await supabase.from('learner_signals').insert({
          user_id: user.id,
          signal_type: 'character_goal_set',
          category: 'character',
          source: 'onboarding',
          value: 1,
          metadata: { dimension: characterGoal, set_at: now },
          created_at: now,
        });
      } catch {}
    }

    // Seed initial subject focus signals (used by MainBrain on first aggregate)
    try {
      const signals: any[] = [];
      if (easiestSubject) {
        signals.push({
          user_id: user.id,
          signal_type: 'onboarding_easiest',
          category: 'engagement',
          source: 'onboarding',
          value: 1,
          metadata: { subject_name: String(easiestSubject).slice(0, 60) },
          created_at: now,
        });
      }
      if (toughestSubject) {
        signals.push({
          user_id: user.id,
          signal_type: 'onboarding_toughest',
          category: 'engagement',
          source: 'onboarding',
          value: 0,
          metadata: { subject_name: String(toughestSubject).slice(0, 60) },
          created_at: now,
        });
      }
      if (signals.length > 0) await supabase.from('learner_signals').insert(signals);
    } catch {}

    // Upsert learner_profile row so the profile is "active"
    try {
      await supabase.from('learner_profiles').upsert({
        user_id: user.id,
        baseline_profile: {
          character_goal: characterGoal || null,
          easiest_subject_declared: easiestSubject || null,
          toughest_subject_declared: toughestSubject || null,
          language: language || 'en',
          onboarded_at: now,
        },
        updated_at: now,
      }, { onConflict: 'user_id' });
    } catch {}

    return NextResponse.json({
      success: true,
      message: characterGoal
        ? `Got it. This year we'll help you grow ${characterGoal.replace(/_/g, ' ')} alongside your studies.`
        : `All set. Let\'s begin.`,
    });
  } catch (error: any) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
