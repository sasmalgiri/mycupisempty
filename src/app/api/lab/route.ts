/**
 * Lab API — virtual lab challenges.
 *
 * GET ?subjectId=&chapter=&tool=  — selected challenges for student
 * POST action=submit { challengeId, submission } — grade + record
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState } from '@/lib/student-state';
import { computeMaturity } from '@/lib/maturity';
import { LAB_CHALLENGE_LIBRARY, selectChallengesForStudent, gradeSubmission } from '@/lib/lab-challenges';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const subjectId = url.searchParams.get('subjectId') || undefined;
    const chapter = url.searchParams.get('chapter') || undefined;
    const tool = (url.searchParams.get('tool') || undefined) as any;
    const limit = Math.min(20, parseInt(url.searchParams.get('limit') || '6', 10));

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', user.id)
      .single()
      .catch(() => ({ data: null }));
    const classLevel = profile?.current_class || 8;

    // Maturity band — per subject if known, else default 2
    let band: 1 | 2 | 3 | 4 | 5 = 2;
    let subjectName: string | undefined;
    const state = await buildStudentState(supabase, user.id);

    if (subjectId && state.subjectStates[subjectId]) {
      const subjectState = state.subjectStates[subjectId];
      subjectName = subjectState.subjectName;
      const mp = computeMaturity({
        userId: user.id,
        subjectId,
        subjectName,
        subjectState,
        studentState: state,
        classLevel,
      });
      band = mp.band;
    }

    const challenges = selectChallengesForStudent({
      maturityBand: band,
      subjectName,
      chapter,
      tool,
      limit,
    });

    // Check which ones this student has already completed
    const { data: completed } = await supabase
      .from('lab_attempts')
      .select('challenge_id, best_score, correct, created_at')
      .eq('user_id', user.id)
      .in('challenge_id', challenges.map((c) => c.id));

    const completedMap = new Map<string, any>();
    for (const row of completed || []) completedMap.set(row.challenge_id, row);

    const enriched = challenges.map((c) => ({
      ...c,
      studentProgress: completedMap.get(c.id) || null,
    }));

    return NextResponse.json({ success: true, challenges: enriched, maturityBand: band });
  } catch (error: any) {
    console.error('Lab GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action } = body;
    if (action !== 'submit') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    const { challengeId, submission } = body;
    const challenge = LAB_CHALLENGE_LIBRARY.find((c) => c.id === challengeId);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

    const result = gradeSubmission(challenge, submission);

    // Record the attempt (upsert with best score)
    try {
      const { data: prior } = await supabase
        .from('lab_attempts')
        .select('best_score, attempts, correct')
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId)
        .maybeSingle();

      const attempts = (prior?.attempts || 0) + 1;
      const bestScore = Math.max(prior?.best_score || 0, result.score);
      const everCorrect = prior?.correct || result.correct;

      await supabase.from('lab_attempts').upsert({
        user_id: user.id,
        challenge_id: challengeId,
        attempts,
        best_score: bestScore,
        last_score: result.score,
        correct: everCorrect,
        submission,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,challenge_id' });

      // Award XP only the first time correct
      if (result.correct && !prior?.correct) {
        try {
          await supabase.from('xp_events').insert({
            user_id: user.id,
            source_pillar: 'academic',
            source_action: 'lab_challenge_completed',
            source_id: challengeId,
            xp_amount: challenge.xpReward,
            description: `Lab challenge: ${challenge.title}`,
          });
        } catch {}
      }
    } catch (err) {
      console.error('Lab attempt persist failed:', err);
    }

    // Record signal
    try {
      await supabase.from('learner_signals').insert({
        user_id: user.id,
        signal_type: 'lab_submission',
        category: 'performance',
        source: 'lab',
        subject_id: null,
        value: result.score,
        metadata: {
          challenge_id: challengeId,
          tool: challenge.tool,
          correct: result.correct,
        },
        created_at: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({ success: true, result, xpAwarded: result.correct ? challenge.xpReward : 0 });
  } catch (error: any) {
    console.error('Lab POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
