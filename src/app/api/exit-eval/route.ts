/**
 * Exit Eval API.
 *
 * GET ?topicId=...&subjectId=...
 *   → returns one transfer question for this topic. Cached per
 *     (user, topic, day). Falls back to authored questions tagged 'transfer'
 *     when AI is unavailable or topic has authored items.
 *
 * POST { questionId, prompt, expectedAnswer, studentAnswer, confidenceBefore,
 *        timeToFirstKeystrokeMs, pasteDetected, tabBlurCount, durationSeconds,
 *        topicId, subjectId, companionId, modeUsed, sessionId }
 *   → scores the attempt, appends to session_evaluations (immutable),
 *     awards Honesty XP, returns { score, components, cheatFlags, modeProposal? }
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  scoreExitEval,
  recommendMode,
  statsFromSessions,
  type ExitEvalQuestion,
} from '@/lib/exit-eval';

const QUESTION_CACHE_HOURS = 24;

// In-memory cache for AI-generated questions, keyed by `userId:topicId:day`.
// Per-process; survives on a warm Vercel instance, refreshed otherwise. Cheap.
const memCache = new Map<string, { q: ExitEvalQuestion; expires: number }>();

function dayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const topicId = url.searchParams.get('topicId');
    if (!topicId) return NextResponse.json({ error: 'topicId required' }, { status: 400 });

    const cacheKey = `${user.id}:${topicId}:${dayKey()}`;
    const cached = memCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json({ success: true, question: cached.q });
    }

    // Try authored transfer questions first — they're higher quality when present.
    const { data: authored } = await supabase
      .from('questions')
      .select('id, question_text, correct_answer, explanation, options')
      .eq('topic_id', topicId)
      .eq('question_type', 'mcq')
      .in('difficulty', ['medium', 'hard'])
      .limit(5);

    if (authored && authored.length > 0) {
      const pick = authored[Math.floor(Math.random() * authored.length)];
      const q: ExitEvalQuestion = {
        id: pick.id,
        prompt: pick.question_text,
        expectedAnswer: pick.correct_answer,
        acceptableAnswers: Array.isArray(pick.options) ? [pick.correct_answer] : undefined,
        kind: 'transfer',
        topicId,
        hint: pick.explanation || undefined,
        source: 'authored',
        generatedAt: new Date().toISOString(),
      };
      memCache.set(cacheKey, { q, expires: Date.now() + QUESTION_CACHE_HOURS * 3600 * 1000 });
      return NextResponse.json({ success: true, question: q });
    }

    // Fallback: deterministic generic question. AI generation hook lives here
    // for later — wiring is left as a TODO so the build is dependency-free.
    // The fallback is honest: it tells the student we don't have a custom
    // transfer item for this exact topic yet.
    const { data: topic } = await supabase
      .from('topics')
      .select('title, description')
      .eq('id', topicId)
      .maybeSingle();

    const title = topic?.title || 'today\'s topic';
    const fallback: ExitEvalQuestion = {
      id: `fallback_${topicId}`,
      prompt: `In your own words, explain how today's idea about "${title}" would apply to a slightly different situation than the one we worked through. Pick a real example from your life.`,
      expectedAnswer: '',  // free-form; scoring will partial-credit on length+keywords
      acceptableAnswers: [],
      kind: 'application',
      topicId,
      source: 'fallback',
      generatedAt: new Date().toISOString(),
    };
    memCache.set(cacheKey, { q: fallback, expires: Date.now() + QUESTION_CACHE_HOURS * 3600 * 1000 });
    return NextResponse.json({ success: true, question: fallback });
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
    const required = ['prompt', 'studentAnswer'];
    for (const k of required) {
      if (typeof body[k] !== 'string') {
        return NextResponse.json({ error: `${k} required` }, { status: 400 });
      }
    }

    const result = scoreExitEval({
      question: {
        id: body.questionId || 'unknown',
        prompt: body.prompt,
        expectedAnswer: body.expectedAnswer || '',
        acceptableAnswers: body.acceptableAnswers || [],
        kind: body.questionKind || 'transfer',
        topicId: body.topicId,
        source: body.source || 'authored',
        generatedAt: new Date().toISOString(),
      },
      studentAnswer: body.studentAnswer,
      confidenceBefore: body.confidenceBefore || null,
      timeToFirstKeystrokeMs: Number(body.timeToFirstKeystrokeMs) || 0,
      pasteDetected: !!body.pasteDetected,
      tabBlurCount: Number(body.tabBlurCount) || 0,
      durationSeconds: Number(body.durationSeconds) || 0,
    });

    // Append to session_evaluations (immutable). RLS allows insert by self.
    const { error: insertErr } = await supabase.from('session_evaluations').insert({
      user_id: user.id,
      session_id: body.sessionId || null,
      subject_id: body.subjectId || null,
      topic_id: body.topicId || null,
      companion_id: body.companionId || null,
      mode_used: body.modeUsed || null,
      question_text: body.prompt.slice(0, 1000),
      question_kind: body.questionKind || 'transfer',
      expected_answer: (body.expectedAnswer || '').slice(0, 1000),
      student_answer: body.studentAnswer.slice(0, 2000),
      correct: result.correct,
      score: result.score,
      confidence_before: body.confidenceBefore || null,
      time_to_first_keystroke_ms: Number(body.timeToFirstKeystrokeMs) || null,
      paste_detected: !!body.pasteDetected,
      tab_blur_count: Number(body.tabBlurCount) || 0,
      duration_seconds: Number(body.durationSeconds) || 0,
    });
    if (insertErr) console.error('session_evaluations insert failed:', insertErr);

    // Honesty XP: completing earns XP whether right or wrong; only skips lose.
    try {
      await supabase.from('honesty_xp_events').insert({
        user_id: user.id,
        event_kind: result.correct ? 'exit_eval_completed_correct' : 'exit_eval_completed_wrong',
        delta: result.correct ? 15 : 8,
        notes: result.cheatFlags.length ? `flags: ${result.cheatFlags.join(',')}` : null,
      });
    } catch { /* honesty table optional */ }

    // Mode adaptation: pull recent evals for this companion+subject and ask
    // the recommender if a switch is warranted.
    let modeProposal: any = null;
    if (body.companionId && body.subjectId) {
      const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('session_evaluations')
        .select('mode_used, score, evaluated_at')
        .eq('user_id', user.id)
        .eq('companion_id', body.companionId)
        .eq('subject_id', body.subjectId)
        .gte('evaluated_at', since)
        .limit(40);

      // Count prior decline events for the same proposed switch.
      const { data: declines } = await supabase
        .from('companion_mode_history')
        .select('decision, new_mode, prev_mode')
        .eq('user_id', user.id)
        .eq('companion_id', body.companionId)
        .eq('decision', 'declined')
        .limit(10);

      const stats = statsFromSessions((recent || []) as any[]);
      const ineffective = stats.filter((s) => s.sessions >= 2 && s.avgScore < 0.4).map((s) => s.mode);

      const reco = recommendMode({
        currentMode: (body.modeUsed || 'step_by_step') as any,
        modeStats: stats,
        declinesForCurrentSwitch: (declines || []).length,
        ineffectiveModes: ineffective,
      });

      if (reco.shouldPropose && reco.newMode) {
        // Log the proposal — student response (accept/decline) lands in a
        // follow-up call. This row's existence is the durable proposal.
        try {
          await supabase.from('companion_mode_history').insert({
            user_id: user.id,
            companion_id: body.companionId,
            subject_id: body.subjectId,
            prev_mode: body.modeUsed,
            new_mode: reco.newMode,
            reason: reco.reason,
            evidence: reco.evidence,
            decision: 'proposed',
          });
        } catch { /* table optional */ }
        modeProposal = { newMode: reco.newMode, reason: reco.reason };
      }
    }

    return NextResponse.json({
      success: true,
      result,
      modeProposal,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
