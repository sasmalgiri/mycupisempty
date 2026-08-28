/**
 * Seed curriculum_chapters for a subject that has none.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS, AND ITS ONE HONEST WEAKNESS
 * ---------------------------------------------------------------------------
 * seed-topics.ts breaks existing chapters into topics. But English for WBBSE
 * classes 1-5 (the Butterfly series) was never seeded at all — zero chapters —
 * so there is nothing for it to break down.
 *
 * The weakness is real and worth stating: unlike topics, which are a genuine
 * decomposition of a chapter title we already have, CHAPTER TITLES are the
 * actual contents page of a specific printed book. A model can produce a
 * plausible Class 5 English syllabus; it cannot know that Butterfly 5 chapter 7
 * is a particular poem. So output from this script is a SCAFFOLD, marked as
 * such, and should be corrected against the real book's contents page.
 *
 * `--from-list` exists for exactly that: paste the real titles and skip
 * generation entirely. That path is always better when the book is to hand.
 *
 *   npx tsx --env-file=.env.local scripts/seed-chapters.ts --class 5 --board wbbse --subject english
 *   ... --from-list "Chapter one|Chapter two|Chapter three"    (real titles, no model)
 *   ... --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { generateJSON } from '../src/lib/ai-provider';

function arg(n: string, d?: string) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}
const flag = (n: string) => process.argv.includes(`--${n}`);

const CLASS_LEVEL = Number(arg('class', '5'));
const BOARD = arg('board', 'wbbse')!;
const SUBJECT = arg('subject', 'english')!;
const FROM_LIST = arg('from-list');
const DRY = flag('dry-run');

interface GenChapter {
  title_en?: string;
  summative_no?: number;
  is_grammar?: boolean;
  maturity_band?: number;
}

function buildPrompt(textbook: string | null, existing: number): string {
  return `List the chapters of the West Bengal Board (WBBSE) Class ${CLASS_LEVEL} ${SUBJECT} textbook${textbook ? ` "${textbook}"` : ''}.

Give the chapters a Class ${CLASS_LEVEL} student would actually study across the year, in order.
${SUBJECT === 'english' ? `
This subject has TWO strands and both must appear:
  - the reader: stories, poems and prose pieces
  - grammar and writing: parts of speech, tenses, sentence types, punctuation,
    letter and paragraph writing

Mark grammar chapters with "is_grammar": true. Roughly a third of the chapters
should be grammar and writing — that is how the Butterfly series is organised
and how the paper is set.` : ''}

Assign each chapter to a summative window:
  1 = first third of the year, 2 = middle third, 3 = final third (annual exam)

Return ONLY JSON:
{"chapters":[{"title_en":"...","summative_no":1,"is_grammar":false,"maturity_band":2}]}

Give ${existing > 0 ? existing : '14 to 18'} chapters.`;
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: subj } = await db.from('curriculum_subjects_by_class')
    .select('id, subject_slug, textbook_title_en, total_chapters, language')
    .eq('class_level', CLASS_LEVEL).eq('board_code', BOARD).eq('subject_slug', SUBJECT)
    .maybeSingle();
  if (!subj) { console.error(`✗ No ${SUBJECT} for class ${CLASS_LEVEL} ${BOARD}`); process.exit(1); }

  const { count } = await db.from('curriculum_chapters')
    .select('id', { count: 'exact', head: true }).eq('subject_class_id', subj.id);
  if ((count || 0) > 0 && !flag('force')) {
    console.log(`${SUBJECT} class ${CLASS_LEVEL} already has ${count} chapters. Use --force to add more.`);
    return;
  }

  let chapters: GenChapter[] = [];
  let provider = 'manual';

  if (FROM_LIST) {
    // Real titles from the book — always preferable to generation.
    chapters = FROM_LIST.split('|').map((t, i) => ({
      title_en: t.trim(),
      summative_no: Math.min(3, Math.floor(i / Math.ceil(FROM_LIST.split('|').length / 3)) + 1),
      is_grammar: /grammar|tense|noun|verb|adjective|punctuat|letter|writing|preposition|sentence/i.test(t),
      maturity_band: 2,
    })).filter((c) => c.title_en);
  } else {
    const res = await generateJSON<{ chapters?: GenChapter[] }>(
      buildPrompt(subj.textbook_title_en, subj.total_chapters || 0),
      { temperature: 0.3, maxOutputTokens: 2500, timeoutMs: 120_000 },
    );
    if (!res.ok || !res.data?.chapters?.length) {
      console.error(`✗ generation failed — ${(res.error || 'nothing returned').slice(0, 120)}`);
      process.exit(1);
    }
    chapters = res.data.chapters.filter((c) => (c.title_en || '').trim().length > 1);
    provider = res.provider || 'unknown';
  }

  console.log(`${SUBJECT} class ${CLASS_LEVEL} ${BOARD.toUpperCase()}${subj.textbook_title_en ? ` (${subj.textbook_title_en})` : ''}`);
  console.log(`${chapters.length} chapters via ${provider}${DRY ? '  [DRY RUN]' : ''}\n`);

  const rows = chapters.map((c, i) => ({
    subject_class_id: subj.id,
    chapter_no: i + 1,
    title_en: String(c.title_en).slice(0, 200),
    summative_no: Math.min(3, Math.max(1, Number(c.summative_no) || Math.floor(i / Math.ceil(chapters.length / 3)) + 1)),
    maturity_band: Math.min(5, Math.max(1, Number(c.maturity_band) || 2)),
    season_hint: 'flexible',
  }));

  for (const [i, r] of rows.entries()) {
    console.log(`  ${String(r.chapter_no).padStart(2)}. ${r.title_en.padEnd(46)} S${r.summative_no}${chapters[i].is_grammar ? '  [grammar]' : ''}`);
  }

  if (DRY) { console.log('\nDry run — nothing written.'); return; }

  const { error } = await db.from('curriculum_chapters')
    .upsert(rows, { onConflict: 'subject_class_id,chapter_no' });
  if (error) { console.error(`\n✗ ${error.message}`); process.exit(1); }

  await db.from('curriculum_subjects_by_class')
    .update({ total_chapters: rows.length }).eq('id', subj.id);

  console.log(`\n✓ ${rows.length} chapters written.`);
  console.log(`  These are a SCAFFOLD, not the verified contents page.`);
  console.log(`  Check them against the real book and re-run with --from-list "..." --force to correct.`);
  console.log(`\n  Next: npx tsx --env-file=.env.local scripts/seed-topics.ts --class ${CLASS_LEVEL} --board ${BOARD} --subject ${SUBJECT}`);
}

main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
