/**
 * Content Library — seeded, character-laden educational content.
 *
 * We keep this in code (not DB) so it ships with the app, version-controls
 * cleanly, is free (no AI generation cost), and — critically — is curated
 * to intentionally shape character alongside academics.
 *
 * Every piece of content here maps to a CHARACTER DIMENSION the system
 * tracks (patience, curiosity, honesty, empathy, discipline, persistence,
 * failure_handling, confidence, etc.). This is THE end goal: the cup isn't
 * filled only with facts — it's filled with who the student is becoming.
 *
 * Legal compliance: every item is original, paraphrased, or classical public
 * domain (e.g., a parable from Indian tradition used for its moral lesson,
 * not verbatim textbook content). No NCERT/CBSE copy-paste.
 */

export type CharacterDim =
  | 'patience' | 'curiosity' | 'honesty' | 'empathy' | 'discipline'
  | 'persistence' | 'failure_handling' | 'confidence' | 'responsibility'
  | 'consistency' | 'emotional_regulation' | 'self_direction';

export type ContentKind = 'reading_passage' | 'reflection_prompt' | 'parable' | 'lab_challenge' | 'writing_prompt' | 'daily_thought';

export interface ContentPiece {
  id: string;
  kind: ContentKind;
  title: string;
  body: string;                // content (max ~500 words)
  lang: 'en' | 'hi' | 'bn';
  subject?: string;            // optional — 'Mathematics', 'Science', etc. or null for cross-subject
  classBand: 'primary' | 'middle' | 'senior' | 'any';
  targetsCharacter: CharacterDim[];
  questions?: Array<{ q: string; a: string }>;  // for reading passages
  readingMinutes?: number;
  tags?: string[];
}

// ============================================================
// CURATED CORPUS — character-first
// ============================================================

export const CONTENT_LIBRARY: ContentPiece[] = [
  // === PARABLES (cross-subject, character-dense) ===
  {
    id: 'parable_potter_clay',
    kind: 'parable',
    title: 'The Potter and the Clay',
    body: `A young apprentice was impatient. "Why can't I make a pot on my first try?" he asked the master. The master smiled. "The wheel does not ask the clay to be beautiful on the first spin. It asks it to stay centered." For days the apprentice's pots collapsed. One evening he sat, frustrated. "What am I missing?" The master said, "You are missing the patience to let your hands learn what your eyes cannot see yet."\n\nHe tried again. He stopped watching the shape he wanted. He only watched his breath and his hands. The pot rose, slowly, then faster. It was not perfect — but it was a pot. Real, centered, his.`,
    lang: 'en',
    classBand: 'middle',
    targetsCharacter: ['patience', 'persistence', 'failure_handling'],
    readingMinutes: 3,
    tags: ['craft', 'mastery', 'learning-process'],
  },
  {
    id: 'parable_river_stones',
    kind: 'parable',
    title: 'How the River Shapes the Stone',
    body: `A boy watched a stream in his village. "These stones are so smooth," he said to his grandmother. "Did someone polish them?" His grandmother laughed. "The river polished them — but not by trying. Every day, a little water, a little time. The river did not force anything. It just kept flowing."\n\nThe boy thought of his handwriting. Every day a little practice. Not forcing. Just flowing. He understood why his grandmother had never told him he was smart or clever. She had only told him: "Show up. Be like the river."`,
    lang: 'en',
    classBand: 'primary',
    targetsCharacter: ['consistency', 'patience', 'discipline'],
    readingMinutes: 2,
    tags: ['habits', 'gentle-pressure'],
  },

  // === READING PASSAGES (academic + character) ===
  {
    id: 'passage_honeybee',
    kind: 'reading_passage',
    title: 'The Intelligence of the Honeybee',
    body: `A single honeybee alone cannot survive for long. But together, a colony of thousands behaves almost like one organism. They share food, share warmth, and even vote — yes, vote! — on where to build their next hive. Scout bees return with information about possible sites, and perform a special dance. The more excited the dance, the more other bees go to check. Slowly, through this dance-and-check process, the colony arrives at a decision. No single bee decides for the others.\n\nScientists call this "collective intelligence". It is one of the oldest democracies on Earth, older than any human parliament.\n\nWhen you work in a team — with classmates, siblings, or friends — you are doing something bees have been doing for millions of years. Each person's careful observation helps the whole group find the right answer. But it only works if everyone is honest about what they actually see, even when others disagree.`,
    lang: 'en',
    subject: 'Science',
    classBand: 'middle',
    targetsCharacter: ['empathy', 'honesty', 'curiosity'],
    questions: [
      { q: 'How do bees decide where to build a new hive?', a: 'Scout bees dance to share information; the colony slowly converges through observation and confirmation.' },
      { q: 'What does the writer mean by "collective intelligence"?', a: 'A group arriving at a better decision together than any single member could alone.' },
      { q: 'What one quality must every bee have for the system to work?', a: 'Honesty — reporting what they actually saw, not what they wish to be true.' },
    ],
    readingMinutes: 4,
    tags: ['biology', 'teamwork'],
  },
  {
    id: 'passage_zero_aryabhata',
    kind: 'reading_passage',
    title: 'The Courage of Zero',
    body: `Before the mathematician Aryabhata, many civilizations counted just fine without a symbol for "nothing". Why would you need a number to describe what isn't there? But Aryabhata saw something no one else had seen clearly: the PLACE where a digit sits matters.\n\nWithout zero, 23 and 203 look different sizes, but you cannot write them with the same digits. With zero, the 2 shifts, the 3 shifts, and the place does the work. This simple idea changed everything — banking, astronomy, rockets. All of it depends on zero holding a place until something arrives to fill it.\n\nThere's a life lesson here too. Sometimes we feel like zero — like we haven't done anything yet, like we don't know enough, like we don't matter. But a zero isn't a failure. A zero is a place that's waiting. It means a future digit is on the way. Aryabhata saw that. The zero gave numbers their power. Your zeros — the things you haven't learned yet, the tries that haven't worked yet — are doing the same for you.`,
    lang: 'en',
    subject: 'Mathematics',
    classBand: 'middle',
    targetsCharacter: ['confidence', 'failure_handling', 'persistence'],
    questions: [
      { q: 'Why did the invention of zero matter for writing numbers?', a: 'Because the place of each digit carries meaning, and zero holds that place when no other digit is there.' },
      { q: 'What does the writer mean by "your zeros"?', a: 'Things you haven\'t learned or succeeded at yet — placeholders for what is coming.' },
    ],
    readingMinutes: 4,
    tags: ['history-of-ideas', 'growth-mindset'],
  },

  // === REFLECTION PROMPTS (end-of-session) ===
  {
    id: 'reflect_today_hard',
    kind: 'reflection_prompt',
    title: 'One Hard Thing',
    body: `Name ONE thing today that felt hard — not something that broke you, something that stretched you. What did you do next?`,
    lang: 'en',
    classBand: 'any',
    targetsCharacter: ['persistence', 'failure_handling', 'emotional_regulation'],
  },
  {
    id: 'reflect_help_given',
    kind: 'reflection_prompt',
    title: 'A Tiny Help',
    body: `Did you help someone today — a classmate, a sibling, a parent — even for 30 seconds? What did you do? If no, is there one person you could help tomorrow?`,
    lang: 'en',
    classBand: 'any',
    targetsCharacter: ['empathy', 'responsibility'],
  },
  {
    id: 'reflect_honest_mistake',
    kind: 'reflection_prompt',
    title: 'Honest Mistake',
    body: `Did you make a mistake today and own it instead of hiding it? It doesn't have to be big — the smallest admissions build the biggest trust.`,
    lang: 'en',
    classBand: 'any',
    targetsCharacter: ['honesty', 'confidence'],
  },
  {
    id: 'reflect_patience_today',
    kind: 'reflection_prompt',
    title: 'Slow Moment',
    body: `When did you slow down today instead of rushing? What happened?`,
    lang: 'en',
    classBand: 'any',
    targetsCharacter: ['patience', 'emotional_regulation'],
  },
  // Hindi
  {
    id: 'reflect_today_hard_hi',
    kind: 'reflection_prompt',
    title: 'आज का कठिन पल',
    body: `आज ऐसा कौन-सा पल था जो कठिन लगा — वह जिसने तुम्हें तोड़ा नहीं, पर फैलाया? उसके बाद तुमने क्या किया?`,
    lang: 'hi',
    classBand: 'any',
    targetsCharacter: ['persistence', 'failure_handling'],
  },
  // Bengali
  {
    id: 'reflect_today_hard_bn',
    kind: 'reflection_prompt',
    title: 'আজকের কঠিন মুহূর্ত',
    body: `আজকের সেই মুহূর্তটা কোনটা — যেটা সহজ ছিল না, কিন্তু তোমাকে বাড়িয়েছে? তার পরে তুমি কী করেছিলে?`,
    lang: 'bn',
    classBand: 'any',
    targetsCharacter: ['persistence', 'failure_handling'],
  },

  // === DAILY THOUGHTS (morning briefing garnish) ===
  {
    id: 'thought_seed',
    kind: 'daily_thought',
    title: 'Seed',
    body: `A seed doesn't argue with the darkness. It grows anyway.`,
    lang: 'en',
    classBand: 'any',
    targetsCharacter: ['persistence', 'failure_handling'],
  },
  {
    id: 'thought_cup_empty',
    kind: 'daily_thought',
    title: 'Cup',
    body: `An empty cup holds the most. Today, come empty. That's how the filling happens.`,
    lang: 'en',
    classBand: 'any',
    targetsCharacter: ['curiosity', 'self_direction'],
  },
  {
    id: 'thought_river',
    kind: 'daily_thought',
    title: 'River',
    body: `The river does not hurry, yet it always arrives.`,
    lang: 'en',
    classBand: 'any',
    targetsCharacter: ['patience', 'consistency'],
  },
  {
    id: 'thought_honest',
    kind: 'daily_thought',
    title: 'Honesty',
    body: `The shortest distance between two minds is honesty. Start there.`,
    lang: 'en',
    classBand: 'any',
    targetsCharacter: ['honesty', 'empathy'],
  },

  // === WRITING PROMPTS (English + regional) ===
  {
    id: 'write_everyday_hero',
    kind: 'writing_prompt',
    title: 'An Everyday Hero',
    body: `Write 4–6 sentences about a person in your daily life — a watchman, a vegetable seller, a bus conductor, an old teacher — who you think is a hero in a quiet way. What makes them so?`,
    lang: 'en',
    classBand: 'middle',
    targetsCharacter: ['empathy', 'responsibility'],
  },
  {
    id: 'write_small_decision',
    kind: 'writing_prompt',
    title: 'A Small Decision',
    body: `Write about a small decision you made this week — something that took 10 seconds. Did it feel easy or hard? What guided you?`,
    lang: 'en',
    classBand: 'senior',
    targetsCharacter: ['self_direction', 'honesty'],
  },

  // === EXTRA LAB CHALLENGES (character-laden) ===
  {
    id: 'lab_patience_10min',
    kind: 'lab_challenge',
    title: 'The 10-Minute Challenge',
    body: `Pick ONE math problem you've been stuck on. Set a timer for 10 minutes. Work on it without switching apps, without checking the answer, without asking anyone. If you solve it, notice how long 10 minutes really felt. If you don't, write down exactly where you got stuck. Both outcomes win.`,
    lang: 'en',
    subject: 'Mathematics',
    classBand: 'middle',
    targetsCharacter: ['patience', 'persistence', 'discipline'],
  },
  {
    id: 'lab_teach_a_pet',
    kind: 'lab_challenge',
    title: 'Teach Your Pet',
    body: `Pick a concept you learned this week. Explain it out loud — to your cat, dog, plant, or teddy bear. Real explaining. The ones with actual fur or leaves are more patient than humans. Afterwards, write one sentence on where you got stuck explaining.`,
    lang: 'en',
    classBand: 'primary',
    targetsCharacter: ['confidence', 'self_direction'],
  },
];

// ============================================================
// Lookup helpers
// ============================================================

export function pickContent(filter: {
  kind?: ContentKind;
  lang?: 'en' | 'hi' | 'bn';
  subject?: string;
  classBand?: 'primary' | 'middle' | 'senior' | 'any';
  targetsCharacter?: CharacterDim;
}): ContentPiece[] {
  return CONTENT_LIBRARY.filter((c) => {
    if (filter.kind && c.kind !== filter.kind) return false;
    if (filter.lang && c.lang !== filter.lang) return false;
    if (filter.subject && c.subject && !c.subject.toLowerCase().includes(filter.subject.toLowerCase())) return false;
    if (filter.classBand && c.classBand !== 'any' && c.classBand !== filter.classBand) return false;
    if (filter.targetsCharacter && !c.targetsCharacter.includes(filter.targetsCharacter)) return false;
    return true;
  });
}

export function dailyThought(seed?: number): ContentPiece {
  const thoughts = CONTENT_LIBRARY.filter((c) => c.kind === 'daily_thought' && c.lang === 'en');
  const idx = (seed ?? new Date().getDate()) % thoughts.length;
  return thoughts[idx];
}

/**
 * Pick a character-targeting reflection prompt based on the dimension we
 * want to cultivate this session.
 */
export function reflectionForDimension(dim: CharacterDim, lang: 'en' | 'hi' | 'bn' = 'en'): ContentPiece | null {
  const matching = pickContent({ kind: 'reflection_prompt', lang, targetsCharacter: dim });
  return matching[0] || pickContent({ kind: 'reflection_prompt', lang })[0] || null;
}
