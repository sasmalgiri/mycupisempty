/**
 * Cross-Subject Quest Generator.
 *
 * A "quest" is a multi-step challenge that spans TWO or more subjects,
 * co-designed by the relevant companions. Example:
 *
 *   "The Cricket Ball Problem" (Nambi Narayanan × Aryabhata × Chanakya)
 *     Step 1 (Physics/Nambi): projectile trajectory of a cricket shot
 *     Step 2 (Math/Aryabhata): calculate the peak height algebraically
 *     Step 3 (History/Chanakya): which cricketer first used swing bowling?
 *
 * No Indian ed-tech competitor does this. Multi-subject quests are the
 * conceptual bridge that shows students knowledge is one web, not 10 boxes.
 *
 * Quests are generated on-demand based on the student's current state:
 *   - Pick 2–3 subjects they've been active in
 *   - Pick companions with highest rapport
 *   - Theme around a topic they care about (from observation memory)
 */

import type { StudentState } from './student-state';
import type { CompanionMemoryV2 } from './companion-memory';
import type { CompanionPersona } from './companion';

export interface QuestStep {
  order: number;
  subjectId: string;
  subjectName: string;
  companionId: string;
  companionName: string;
  prompt: string;
  kind: 'question' | 'calculation' | 'explanation' | 'diagram' | 'design';
  successCriteria: string;
  hint?: string;
  estimatedMinutes: number;
}

export interface Quest {
  id: string;
  title: string;
  theme: string;
  totalEstimatedMinutes: number;
  steps: QuestStep[];
  xpReward: number;
  createdAt: string;
  narrative: string;             // intro paragraph that weaves subjects together
}

/**
 * Pick the 2–3 strongest companions (by rapport) from the student's memory.
 */
export function pickQuestCompanions(
  memories: Array<{ subjectId: string; subjectName: string; memory: CompanionMemoryV2 }>,
  persona: Record<string, CompanionPersona>,
  max = 3,
): Array<{ subjectId: string; subjectName: string; persona: CompanionPersona; rapport: number }> {
  return memories
    .filter((m) => persona[m.memory.companionId])
    .sort((a, b) => b.memory.rapport.strength - a.memory.rapport.strength)
    .slice(0, max)
    .map((m) => ({
      subjectId: m.subjectId,
      subjectName: m.subjectName,
      persona: persona[m.memory.companionId],
      rapport: m.memory.rapport.strength,
    }));
}

// ============================================================
// Theme library — pre-seeded cross-subject narratives.
// AI generation can override these with a student-specific theme.
// ============================================================

interface ThemeTemplate {
  id: string;
  title: string;
  subjects: string[];              // substring match on subject name
  narrative: string;
  steps: Array<{
    subjectMatcher: string;        // substring match
    prompt: string;
    kind: QuestStep['kind'];
    successCriteria: string;
    hint?: string;
    minutes: number;
  }>;
}

export const QUEST_THEMES: ThemeTemplate[] = [
  {
    id: 'cricket_physics',
    title: 'The Cricket Ball Problem',
    subjects: ['math', 'science', 'physics'],
    narrative: `A batsman hits a ball at 30 m/s at an angle of 40° from the ground. Your mission: figure out where it lands, how high it goes, and why swing bowlers can bend its path.`,
    steps: [
      {
        subjectMatcher: 'science',
        prompt: 'Using projectile motion, calculate the range of the ball (assume flat ground, g = 9.8 m/s²). Show your formula.',
        kind: 'calculation',
        successCriteria: 'Answer within 5% of ~90.3 m',
        hint: 'Range R = v² × sin(2θ) / g',
        minutes: 8,
      },
      {
        subjectMatcher: 'math',
        prompt: 'Find the peak height of the same ball. Express your answer as a function of v and θ and evaluate.',
        kind: 'calculation',
        successCriteria: 'H = (v·sinθ)² / (2g) ≈ 18.9 m, within 5% tolerance',
        hint: 'Peak is when vertical velocity = 0',
        minutes: 6,
      },
      {
        subjectMatcher: 'english',
        prompt: 'Write 3–4 sentences explaining (in English) why swing bowling curves the ball. Focus on clarity — imagine explaining to a younger sibling.',
        kind: 'explanation',
        successCriteria: 'Mentions air pressure + ball seam; clear for Class 6 level',
        minutes: 6,
      },
    ],
  },
  {
    id: 'monsoon_story',
    title: 'The Monsoon Story',
    subjects: ['science', 'social', 'geography'],
    narrative: `Every year, billions of litres of water cross India over a few months. Let's trace the monsoon as physics, as geography, and as a story that shapes every Indian harvest.`,
    steps: [
      {
        subjectMatcher: 'science',
        prompt: 'Explain in your own words why the Indian monsoon blows from the SW in summer and from the NE in winter. Use the words "low pressure" and "land-sea temperature difference".',
        kind: 'explanation',
        successCriteria: 'Correct direction + correct driver mentioned',
        minutes: 8,
      },
      {
        subjectMatcher: 'social',
        prompt: 'Name 3 Indian states that receive >3000 mm of monsoon rain and 3 that receive <500 mm. One sentence each on why.',
        kind: 'question',
        successCriteria: 'Six states named correctly with geographic reasoning',
        minutes: 6,
      },
      {
        subjectMatcher: 'english',
        prompt: 'Write a 4-sentence descriptive paragraph of the first monsoon rain in a village, using at least 3 sensory details.',
        kind: 'explanation',
        successCriteria: 'Scored 7+/10 by writing feedback',
        minutes: 8,
      },
    ],
  },
  {
    id: 'budget_builder',
    title: 'Run Your Own Kirana',
    subjects: ['math', 'social', 'economics'],
    narrative: `You're opening a kirana store in your neighbourhood. Let's figure out the numbers, the market, and the pitch.`,
    steps: [
      {
        subjectMatcher: 'math',
        prompt: 'If fixed costs are ₹15,000/month and you earn ₹8 profit per transaction, how many transactions to break even? How many to earn ₹20,000/month profit?',
        kind: 'calculation',
        successCriteria: 'Break-even = 1,875 transactions; for ₹20k = 4,375',
        minutes: 6,
      },
      {
        subjectMatcher: 'social',
        prompt: 'Name 3 Indian laws or government schemes that protect a small retailer or support new businesses.',
        kind: 'question',
        successCriteria: 'Three correct identifications',
        minutes: 7,
      },
      {
        subjectMatcher: 'english',
        prompt: 'Write a 3-line English pitch to a local supplier explaining why they should give you credit for 30 days.',
        kind: 'explanation',
        successCriteria: 'Clear, persuasive, respectful tone',
        minutes: 8,
      },
    ],
  },
];

// ============================================================
// Build a quest given the student's state + active companions
// ============================================================

export function generateQuest(params: {
  studentState: StudentState;
  availableCompanions: Array<{ subjectId: string; subjectName: string; persona: CompanionPersona }>;
}): Quest | null {
  const { availableCompanions } = params;
  if (availableCompanions.length < 2) return null;

  // Pick a theme where at least 2 of the student's active companions match
  const matchedTheme = QUEST_THEMES.find((theme) => {
    const matches = availableCompanions.filter((c) =>
      theme.subjects.some((s) => c.subjectName.toLowerCase().includes(s)),
    );
    return matches.length >= 2;
  });

  if (!matchedTheme) return null;

  const steps: QuestStep[] = [];
  let order = 1;
  for (const tpl of matchedTheme.steps) {
    const companion = availableCompanions.find((c) =>
      c.subjectName.toLowerCase().includes(tpl.subjectMatcher),
    );
    if (!companion) continue;
    steps.push({
      order: order++,
      subjectId: companion.subjectId,
      subjectName: companion.subjectName,
      companionId: companion.persona.id,
      companionName: companion.persona.name,
      prompt: tpl.prompt,
      kind: tpl.kind,
      successCriteria: tpl.successCriteria,
      hint: tpl.hint,
      estimatedMinutes: tpl.minutes,
    });
  }

  if (steps.length < 2) return null;

  const totalMins = steps.reduce((s, x) => s + x.estimatedMinutes, 0);
  const id = `quest_${matchedTheme.id}_${Date.now()}`;

  return {
    id,
    title: matchedTheme.title,
    theme: matchedTheme.id,
    totalEstimatedMinutes: totalMins,
    steps,
    xpReward: 25 + steps.length * 10,   // base 25 + 10 per step
    createdAt: new Date().toISOString(),
    narrative: matchedTheme.narrative,
  };
}
