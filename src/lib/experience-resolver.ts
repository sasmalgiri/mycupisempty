/**
 * ExperienceResolver — closes the self-learning loop for DELAYED outcomes.
 *
 * Some adaptive choices only resolve minutes/hours/days later:
 *   - Method choice → "did retention hold after 7 days?"
 *   - Intervention → "did the student's accuracy on this pattern improve?"
 *   - Assignment scope → "did the student complete it without giving up?"
 *
 * When a fresh learner signal lands (answer_result, breakthrough, mastery_gain,
 * etc.), we look back at recent unresolved experiences and retroactively
 * assign rewards. This is how the system actually *learns* — not just logs.
 *
 * Call `tryResolveFromSignal()` right after inserting a new signal.
 */

import { resolveExperience } from './self-learning';

interface Signal {
  signal_type: string;
  value: number | null;
  subject_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string;
}

/**
 * Given a just-observed signal, resolve any matching unresolved experiences
 * in the last 48 hours.
 *
 * Matching rules:
 *   - method_choice experiences with matching topic_id or subject_id → resolve
 *     with reward = +1 if answer correct on that topic, -0.5 if wrong.
 *   - intervention experiences tagged with a pattern → resolve with reward
 *     computed from whether the student stopped making that error.
 *   - assignment_shape experiences → resolve when assignment_graded signal fires
 *     with reward proportional to grade.
 */
export async function tryResolveFromSignal(supabase: any, userId: string, sig: Signal): Promise<number> {
  try {
    if (!sig.signal_type) return 0;

    // Only certain signal types carry outcome information we can map
    if (!['answer_result', 'breakthrough', 'method_outcome', 'assignment_graded', 'flashcard_review'].includes(sig.signal_type)) {
      return 0;
    }

    // Fetch unresolved experiences in the last 48h for this user, possibly
    // filtered by metadata affinity to this signal.
    const { data: pending } = await supabase
      .from('experiences')
      .select('id, kind, context_key, action_key, metadata, issued_at')
      .eq('user_id', userId)
      .eq('resolved', false)
      .gte('issued_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
      .limit(50);

    if (!pending || pending.length === 0) return 0;

    let resolved = 0;

    for (const exp of pending) {
      const meta = exp.metadata || {};
      const sigMeta = sig.metadata || {};
      let reward: number | null = null;

      // --- method_choice / method_outcome mapping ---
      if (exp.kind === 'method_choice') {
        const topicMatch = meta.topic_id && sigMeta.topic_id && meta.topic_id === sigMeta.topic_id;
        const subjectMatch = meta.subject_id && sig.subject_id && meta.subject_id === sig.subject_id;
        if (topicMatch && sig.signal_type === 'answer_result') {
          reward = sig.value && sig.value >= 0.5 ? 0.8 : -0.4;
        } else if (subjectMatch && sig.signal_type === 'method_outcome') {
          reward = Number(sig.value) || 0;  // already -1..1 scale
        } else if (subjectMatch && sig.signal_type === 'breakthrough') {
          reward = 0.9;
        }
      }

      // --- intervention mapping ---
      if (exp.kind === 'intervention') {
        const patternMatch = meta.pattern && (
          sigMeta.misconception === meta.pattern ||
          sigMeta.error_type === meta.pattern ||
          sigMeta.pattern === meta.pattern
        );
        if (sig.signal_type === 'answer_result' && patternMatch) {
          reward = sig.value && sig.value >= 0.5 ? 1.0 : -0.3;
        } else if (sig.signal_type === 'breakthrough' && (meta.subject_id === sig.subject_id || !meta.subject_id)) {
          reward = 0.8;
        }
      }

      // --- assignment_shape mapping ---
      if (exp.kind === 'assignment_shape' && sig.signal_type === 'assignment_graded') {
        if (meta.assignment_id && sigMeta.assignment_id === meta.assignment_id) {
          // sig.value is 0..1 grade scale
          reward = (Number(sig.value) || 0.5) * 2 - 1;  // map 0..1 → -1..+1
        }
      }

      // --- difficulty_choice mapping ---
      if (exp.kind === 'difficulty_choice' && sig.signal_type === 'answer_result') {
        if (meta.question_id && sigMeta.question_id === meta.question_id) {
          // Ideal is 70% success — reward proximity to that
          const correct = Number(sig.value) >= 0.5;
          // Without global stats we approximate: if correct on medium → +0.5, on hard → +0.8
          reward = correct ? (meta.difficulty === 'hard' ? 0.8 : meta.difficulty === 'easy' ? 0.3 : 0.5) : -0.2;
        }
      }

      if (reward !== null) {
        await resolveExperience(supabase, exp.id, reward, {
          ...meta,
          resolved_via_signal: sig.signal_type,
          resolved_at: new Date().toISOString(),
        });
        resolved++;
      }
    }

    return resolved;
  } catch (err) {
    console.error('Experience resolve failed (non-fatal):', err);
    return 0;
  }
}
