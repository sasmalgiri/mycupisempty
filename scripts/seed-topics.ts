/**
 * Seed curriculum_topics for chapters that have none.
 *
 * ---------------------------------------------------------------------------
 * WHY
 * ---------------------------------------------------------------------------
 * curriculum_chapters has 792 real rows; curriculum_topics had 16. The
 * Conversion Engine reads TOPICS — a chapter with none produces "this chapter
 * has no topics yet" and cannot be taught. This closes that gap: for each
 * empty chapter it asks the model to break the chapter into the 3-6 teachable
 * topics a syllabus would list, and writes them.
 *
 * It generates the SYLLABUS OUTLINE, not the lesson. The lesson is still
 * written later by conversion-enrich.ts at teach time and cached per topic.
 * Keeping those separate matters: the outline is stable and shared by every
 * student, the lesson is regenerated when the syllabus row changes.
 *
 * The learning objectives are written deliberately with the natural verbs of
 * whatever kind of knowledge the topic is ("solve", "explain why", "list in
 * order", "weigh up"), because those verbs are exactly what the deterministic
 * classifier reads. Vague objectives produce unclassifiable topics.
 *
 *   npx tsx --env-file=.env.local scripts/seed-topics.ts --class 5 --board wbbse
 *   ... --subject math          only one subject
 *   ... --dry-run               print, write nothing
 *   ... --limit 5               first N chapters (try before committing)
 *   ... --force                 regenerate even where topics exist
 */

import { createClient } from '@supabase/supabase-js';
import { geminiGenerateJSON, isGeminiConfigured } from '../src/lib/gemini';

// ---------------------------------------------------------------------------

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const CLASS_LEVEL = Number(arg('class', '5'));
const BOARD = arg('board', 'wbbse')!;
const SUBJECT = arg('subject');
const LIMIT = Number(arg('limit', '0'));
const DRY = flag('dry-run');
const FORCE = flag('force');

/**
 * Free-tier pacing.
 *
 * The first run did 25 chapters then hit 429 for the remaining 28. Free-tier
 * Flash allows roughly 10-15 requests per minute, so ~1.5s between calls was
 * about four times too fast. 5s keeps us under the per-minute ceiling; when we
 * hit one anyway we wait out the window rather than pushing through it, since
 * the quota is per-key and hammering it only extends the lockout.
 */
const DELAY_MS = Number(arg('delay', '5000'));
const RATE_LIMIT_BACKOFF_MS = 65_000;
const MAX_BACKOFFS = Number(arg("backoffs", "0"));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------

interface TopicOut {
  title_en: string;
  objectives: string[];
  bloom?: number;
  minutes?: number;
}

function buildPrompt(chapter: string, subject: string, textbook: string | null): string {
  return `You are writing the syllabus breakdown for one chapter of an Indian school textbook.

Board: ${BOARD.toUpperCase()} (West Bengal)
Class: ${CLASS_LEVEL}
Subject: ${subject}
${textbook ? `Textbook: ${textbook}` : ''}
Chapter: ${chapter}

Break this chapter into the 3 to 6 topics a teacher would actually cover, in teaching order.

For each topic give:
  - title_en   : short, specific. Not "Introduction" — say what it introduces.
  - objectives : 1-2 short phrases stating what the student must be able to do.
  - bloom      : 1-6 (1 remember, 2 understand, 3 apply, 4 analyse, 5 evaluate, 6 create)
  - minutes    : realistic teaching time, 15-45

CRITICAL — write each objective using the natural verbs of the kind of knowledge it is:
  - things to simply KNOW (dates, names, symbols, ordered lists) -> "list in order", "name", "recall"
  - a process where each step causes the next                    -> "trace how X leads to Y"
  - an idea with a boundary                                      -> "explain why", "distinguish X from Y"
  - a skill to perform                                           -> "solve", "calculate", "construct"
  - a system where grouping matters                              -> "classify", "map", "compare across"
  - a matter of judgement                                        -> "justify", "weigh up", "give an opinion on"

Be accurate to a Class ${CLASS_LEVEL} level — do not include material from higher classes.
${subject === 'bengali' ? 'This is a literature chapter (poem/story/essay). Topics should cover comprehension, language and appreciation — not grammar drills unrelated to the text.' : ''}

Return ONLY JSON:
{"topics":[{"title_en":"...","objectives":["..."],"bloom":2,"minutes":30}]}`;
}

// ---------------------------------------------------------------------------

async function main() {
  if (!isGeminiConfigured()) {
    console.error('✗ GEMINI_API_KEY not set. Run with: npx tsx --env-file=.env.local ...');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('✗ Supabase URL / service role key missing from the environment.');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // --- chapters in scope ------------------------------------------------
  let sq = db
    .from('curriculum_subjects_by_class')
    .select('id, subject_slug, textbook_title_en, language')
    .eq('class_level', CLASS_LEVEL)
    .eq('board_code', BOARD);
  if (SUBJECT) sq = sq.eq('subject_slug', SUBJECT);

  const { data: subjects, error: se } = await sq;
  if (se) { console.error('✗', se.message); process.exit(1); }
  if (!subjects?.length) {
    console.error(`✗ No subjects for class ${CLASS_LEVEL} ${BOARD}${SUBJECT ? ` / ${SUBJECT}` : ''}`);
    process.exit(1);
  }

  const subjectById = new Map(subjects.map((s: any) => [s.id, s]));
  const { data: chapters, error: ce } = await db
    .from('curriculum_chapters')
    .select('id, chapter_no, title_en, subject_class_id')
    .in('subject_class_id', subjects.map((s: any) => s.id))
    .order('chapter_no');
  if (ce) { console.error('✗', ce.message); process.exit(1); }

  // Which already have topics?
  const { data: existing } = await db
    .from('curriculum_topics')
    .select('chapter_id')
    .in('chapter_id', (chapters || []).map((c: any) => c.id));
  const hasTopics = new Set((existing || []).map((r: any) => r.chapter_id));

  let todo = (chapters || []).filter((c: any) => FORCE || !hasTopics.has(c.id));
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);

  console.log(
    `Class ${CLASS_LEVEL} ${BOARD.toUpperCase()}: ${chapters?.length ?? 0} chapters, ` +
    `${hasTopics.size} already have topics, ${todo.length} to generate.` +
    (DRY ? '  [DRY RUN]' : ''),
  );
  if (todo.length === 0) { console.log('Nothing to do.'); return; }

  let made = 0;
  let failed = 0;

  for (const [i, ch] of todo.entries()) {
    const subj: any = subjectById.get(ch.subject_class_id);
    const label = `${subj.subject_slug} ch${ch.chapter_no} ${ch.title_en}`;
    process.stdout.write(`  [${i + 1}/${todo.length}] ${label.slice(0, 52).padEnd(52)} `);

    // Wait out a rate-limit window rather than burning the chapter. Losing a
    // minute is cheap; losing the chapter means a re-run and another minute
    // anyway, and a half-seeded syllabus is worse than a slow one.
    let topics: TopicOut[] = [];
    let error: string | undefined;
    for (let backoff = 0; backoff <= MAX_BACKOFFS; backoff++) {
      const res = await geminiGenerateJSON<{ topics?: TopicOut[] }>(
        buildPrompt(ch.title_en, subj.subject_slug, subj.textbook_title_en),
        { temperature: 0.4, maxOutputTokens: 4096, timeoutMs: 60_000 },
      );
      error = res.error;
      topics = (res.ok && res.data?.topics ? res.data.topics : []).filter(
        (t) => t?.title_en && String(t.title_en).trim().length > 2,
      );
      if (topics.length > 0) break;

      const quota = /\b429\b|quota|rate limit|RESOURCE_EXHAUSTED/i.test(error || '');
      if (!quota || backoff === MAX_BACKOFFS) break;
      process.stdout.write(`rate-limited, waiting ${Math.round(RATE_LIMIT_BACKOFF_MS / 1000)}s … `);
      await sleep(RATE_LIMIT_BACKOFF_MS);
    }

    if (topics.length === 0) {
      console.log(`FAILED — ${(error || 'no topics returned').slice(0, 90)}`);
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    if (DRY) {
      console.log(`${topics.length} topics`);
      topics.forEach((t, n) => console.log(`         ${n + 1}. ${t.title_en}  — ${(t.objectives || []).join('; ')}`));
      await sleep(DELAY_MS);
      continue;
    }

    const rows = topics.slice(0, 8).map((t, n) => ({
      chapter_id: ch.id,
      topic_no: n + 1,
      title_en: String(t.title_en).slice(0, 200),
      learning_objectives: (t.objectives || []).map((o) => String(o).slice(0, 300)).slice(0, 4),
      bloom_level: Math.min(6, Math.max(1, Number(t.bloom) || 2)),
      expected_minutes: Math.min(45, Math.max(15, Number(t.minutes) || 30)),
      language: subj.language || 'en',
    }));

    const { error: ie } = await db
      .from('curriculum_topics')
      .upsert(rows, { onConflict: 'chapter_id,topic_no' });

    if (ie) {
      console.log(`DB FAILED — ${ie.message}`);
      failed++;
    } else {
      console.log(`${rows.length} topics`);
      made += rows.length;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n✓ ${made} topics written across ${todo.length - failed} chapters.` +
              (failed ? `  ${failed} chapter(s) failed — re-run to retry just those.` : ''));
}

main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
