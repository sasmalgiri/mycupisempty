/**
 * DirectiveAdapter — turns main-brain directives into concrete adaptation
 * deltas for the learning pipelines.
 *
 * Without this, directives are just text the companion reads. With it,
 * directives actually change: challenge difficulty, session length targets,
 * task count in assignments, content depth in practice generation, and
 * reminder cadence.
 *
 * Usage:
 *   const { data } = await loadActiveDirectives(supabase, userId);
 *   const delta = adaptationDelta(data);
 *   // delta.difficultyAdjust: -2..+2
 *   // delta.maxTaskCount: number | undefined
 *   // delta.maxDurationMinutes: number | undefined
 *   // delta.encouragementIntensity: 'high'|'moderate'|'low'|undefined
 *   // delta.mustMentionBreakthroughs: string[]
 *   // delta.mustAddressConcern: string | undefined
 */

import type { BrainDirective } from './main-brain';
import { activeOnly } from './main-brain';

export interface AdaptationDelta {
  difficultyAdjust: number;                    // -2..+2 applied to base difficulty
  maxTaskCount: number | undefined;            // cap on number of tasks in an assignment
  maxDurationMinutes: number | undefined;      // cap on session length
  encouragementIntensity: 'high' | 'moderate' | 'low' | undefined;
  mustMentionBreakthroughs: string[];          // AI should warmly acknowledge these
  mustAddressConcern: string | undefined;      // focus area concern to lead with
  crossInsights: Array<{ hint: string; fromSubject?: string }>;
  // Raw list of directives that contributed (for UI / analytics)
  applied: BrainDirective[];
}

const emptyDelta = (): AdaptationDelta => ({
  difficultyAdjust: 0,
  maxTaskCount: undefined,
  maxDurationMinutes: undefined,
  encouragementIntensity: undefined,
  mustMentionBreakthroughs: [],
  mustAddressConcern: undefined,
  crossInsights: [],
  applied: [],
});

/**
 * Load active directives for this user from brain_directives.
 */
export async function loadActiveDirectives(
  supabase: any,
  userId: string,
): Promise<BrainDirective[]> {
  try {
    const { data } = await supabase
      .from('brain_directives')
      .select('directives')
      .eq('user_id', userId)
      .maybeSingle();
    const list = Array.isArray(data?.directives) ? (data.directives as BrainDirective[]) : [];
    return activeOnly(list);
  } catch {
    return [];
  }
}

/**
 * Compute a concrete adaptation delta from active directives, optionally
 * filtered by a subject-specific or companion-specific scope.
 */
export function adaptationDelta(
  directives: BrainDirective[],
  options: { forCompanionId?: string; forSubjectId?: string } = {},
): AdaptationDelta {
  const delta = emptyDelta();
  if (!directives.length) return delta;

  const relevant = directives.filter((d) => {
    if (options.forCompanionId) {
      return d.appliesTo === 'all' || (Array.isArray(d.appliesTo) && d.appliesTo.includes(options.forCompanionId));
    }
    return true;
  });

  for (const d of relevant) {
    switch (d.type) {
      case 'ease_up':
        delta.difficultyAdjust = Math.min(delta.difficultyAdjust, -1);
        delta.encouragementIntensity = 'high';
        delta.applied.push(d);
        break;
      case 'push_harder':
        delta.difficultyAdjust = Math.max(delta.difficultyAdjust, 1);
        delta.encouragementIntensity = delta.encouragementIntensity || 'moderate';
        delta.applied.push(d);
        break;
      case 'shorten_session':
        delta.maxDurationMinutes = Math.min(delta.maxDurationMinutes ?? 20, 12);
        delta.maxTaskCount = Math.min(delta.maxTaskCount ?? 4, 3);
        delta.applied.push(d);
        break;
      case 'celebrate': {
        const breakthroughs = d.params?.breakthroughs;
        if (Array.isArray(breakthroughs)) {
          delta.mustMentionBreakthroughs.push(...breakthroughs.slice(0, 2));
        }
        delta.applied.push(d);
        break;
      }
      case 'focus_area': {
        const concern = d.params?.concern;
        if (typeof concern === 'string') {
          delta.mustAddressConcern = delta.mustAddressConcern || concern;
        }
        delta.applied.push(d);
        break;
      }
      case 'cross_insight': {
        const hint = d.params?.hint;
        const fromSubject = d.params?.fromSubject;
        if (typeof hint === 'string') {
          delta.crossInsights.push({ hint, fromSubject });
        }
        delta.applied.push(d);
        break;
      }
      case 'switch_modality':
      case 'watch_for':
        // Informational — the companion handles these via prompt text.
        delta.applied.push(d);
        break;
    }
  }

  // Normalize ranges
  delta.difficultyAdjust = Math.max(-2, Math.min(2, delta.difficultyAdjust));
  if (delta.mustMentionBreakthroughs.length > 3) delta.mustMentionBreakthroughs = delta.mustMentionBreakthroughs.slice(0, 3);

  return delta;
}

/**
 * Render the delta as a short prompt block that any AI endpoint can prepend.
 * Kept compact so it doesn't balloon tokens.
 */
export function deltaToPromptBlock(delta: AdaptationDelta): string {
  if (delta.applied.length === 0) return '';
  const lines: string[] = ['MAIN-BRAIN ADAPTATION (honor these this turn):'];
  if (delta.difficultyAdjust < 0) {
    lines.push(`  • Student needs EASIER content. Reduce difficulty by ${Math.abs(delta.difficultyAdjust)} step${Math.abs(delta.difficultyAdjust) === 1 ? '' : 's'}. More scaffolding.`);
  }
  if (delta.difficultyAdjust > 0) {
    lines.push(`  • Student is ready for STRETCH. Increase difficulty by ${delta.difficultyAdjust} step${delta.difficultyAdjust === 1 ? '' : 's'}.`);
  }
  if (delta.maxDurationMinutes) {
    lines.push(`  • Keep this session under ${delta.maxDurationMinutes} minutes.`);
  }
  if (delta.maxTaskCount) {
    lines.push(`  • Maximum ${delta.maxTaskCount} tasks/steps.`);
  }
  if (delta.encouragementIntensity) {
    lines.push(`  • Encouragement intensity: ${delta.encouragementIntensity}.`);
  }
  if (delta.mustMentionBreakthroughs.length > 0) {
    lines.push(`  • Warmly acknowledge recent breakthrough(s): ${delta.mustMentionBreakthroughs.join('; ')}`);
  }
  if (delta.mustAddressConcern) {
    lines.push(`  • Lead with this concern: "${delta.mustAddressConcern}" (if your subject touches it).`);
  }
  for (const ci of delta.crossInsights) {
    lines.push(`  • Cross-insight${ci.fromSubject ? ` from ${ci.fromSubject}` : ''}: "${ci.hint}" — use only if relevant.`);
  }
  return lines.join('\n');
}
