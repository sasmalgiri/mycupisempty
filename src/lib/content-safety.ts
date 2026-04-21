/**
 * Minimal content-safety utilities for user-authored text (circle prompts,
 * reflections shared with peers, etc.).
 *
 * K-12 product: we don't try to be a full moderation system here — just catch
 * the obvious stuff (slurs, graphic content, bullying patterns) and let the
 * rest go through. Reports + parent review are the second line of defense.
 *
 * The block-list deliberately isn't exhaustive and deliberately isn't public.
 * It's a tripwire, not a wall.
 */

// English + Hindi + Bengali roots that flag the post. Kept short and
// conservative — false positives are annoying; missed slurs are worse.
const BLOCK_PATTERNS: RegExp[] = [
  // Generic slur / hate roots (stem-match so "stupid", "stupids", "stupidly" all hit)
  /\b(stupid|idiot|dumb|loser|ugly|fat|moron|retard)\b/i,
  /\b(kill\s*yourself|kys)\b/i,
  /\b(die|hate)\s+(you|u|him|her|them)\b/i,
  // Profanity — partial; regex matches root
  /\b(fuck|shit|bitch|asshole|dick|pussy|cunt)\w*/i,
  // Adult content tells
  /\b(porn|sex\s*video|nude|xxx)\b/i,
  // Hindi / transliteration (conservative)
  /\b(madarchod|bhenchod|chutiya|bhosdi|gandu|randi|harami)\w*/i,
  // Bengali transliteration
  /\b(bara|magi|khanki|baler)\w*/i,
];

export interface SafetyVerdict {
  ok: boolean;
  reason?: 'profanity' | 'harassment' | 'adult' | 'too_short' | 'too_long';
  hint?: string;
}

/**
 * Check whether a user-authored string is safe to publish to a peer group.
 * Returns { ok: false, reason } when we want to block; otherwise { ok: true }.
 */
export function checkPeerPrompt(text: string, opts?: { minLen?: number; maxLen?: number }): SafetyVerdict {
  const minLen = opts?.minLen ?? 3;
  const maxLen = opts?.maxLen ?? 300;

  const trimmed = (text || '').trim();
  if (trimmed.length < minLen) {
    return { ok: false, reason: 'too_short', hint: 'Please write a bit more.' };
  }
  if (trimmed.length > maxLen) {
    return { ok: false, reason: 'too_long', hint: `Keep it under ${maxLen} characters.` };
  }
  for (const pat of BLOCK_PATTERNS) {
    if (pat.test(trimmed)) {
      return {
        ok: false,
        reason: 'harassment',
        hint: 'That prompt looks unkind. Try something focused on learning together.',
      };
    }
  }
  return { ok: true };
}

/**
 * Curated starter prompts any circle member can pick — no moderation needed
 * because the text is ours. We ship Indian-classroom-aware framing.
 */
export interface CircleTemplate {
  id: string;
  icon: string;
  prompt: string;
  subjectHint?: string;
}

export const CIRCLE_PROMPT_TEMPLATES: CircleTemplate[] = [
  {
    id: 'learned_today',
    icon: '💡',
    prompt: 'Share one thing each of you learned today — even a small thing counts.',
  },
  {
    id: 'teach_one',
    icon: '🎓',
    prompt: "Teach your circle one concept you're strong in — in two or three sentences.",
  },
  {
    id: 'stuck_point',
    icon: '🤔',
    prompt: 'What confused you this week? Maybe someone here has seen it before.',
  },
  {
    id: 'quick_math',
    icon: '🧮',
    prompt: 'Each member shares a quick mental-math problem (under 10 seconds) for the others.',
    subjectHint: 'Math',
  },
  {
    id: 'vocab_swap',
    icon: '📚',
    prompt: 'Share one new English word you learned — with a sentence using it.',
    subjectHint: 'English',
  },
  {
    id: 'science_wonder',
    icon: '🔬',
    prompt: 'What are you curious about in science right now? Post one "why does…?" question.',
    subjectHint: 'Science',
  },
  {
    id: 'habit_streak',
    icon: '🔁',
    prompt: 'Whose streak are you keeping alive today? Say hi to a circle-mate who motivates you.',
  },
  {
    id: 'weekend_goal',
    icon: '🎯',
    prompt: 'One thing you want to finish by Sunday — write it down, come back to check in.',
  },
];

export function findTemplate(id: string): CircleTemplate | null {
  return CIRCLE_PROMPT_TEMPLATES.find((t) => t.id === id) || null;
}
