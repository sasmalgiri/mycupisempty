/**
 * Top up missing question types for topics that already have a bank.
 *
 * ---------------------------------------------------------------------------
 * WHY
 * ---------------------------------------------------------------------------
 * The first build produced 395 questions but only three of the five types:
 * mcq, fill_blank and short. The board's paper is 25% very_short and 10% long,
 * so her practice was short-answer-heavy compared with the paper she will sit.
 *
 * The cause was the prompt, not the models: it listed five types and then told
 * the model to omit any that "did not suit" the unit, which a model reads as
 * permission to write only the types it is most confident about.
 *
 * This pass is ADDITIVE. It leaves the existing 395 questions alone and asks
 * only for what is missing, using the teaching text already cached in
 * topic_enrichment — so it costs one call per topic and nothing is regenerated
 * or duplicated.
 *
 *   npx tsx --env-file=.env.local scripts/topup-questions.ts --class 5 --board wbbse --summative 3
 *   ... --dry-run    ... --limit 5
 */

import { createClient } from '@supabase/supabase-js';
import { generateJSON } from '../src/lib/ai-provider';
import { classifyEnriched } from '../src/lib/conversion-enrich';
import { questionFit, MIN_QUESTION_FIT, QUESTION_MARKS, type QuestionType } from '../src/lib/mastery-pack';
import type { KnowledgeType } from '../src/lib/conversion-engine';

function arg(n: string, d?: string) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}
const flag = (n: string) => process.argv.includes(`--${n}`);

const CLASS_LEVEL = Number(arg('class', '5'));
const BOARD = arg('board', 'wbbse')!;
const SUMMATIVE = Number(arg('summative', '3'));
const LIMIT = Number(arg('limit', '0'));
const DRY = flag('dry-run');
const DELAY_MS = Number(arg('delay', '2000'));

/** The types the first pass under-produced. */
const WANTED: QuestionType[] = ['very_short', 'long'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface GenQ {
  unit_heading?: string;
  type?: string;
  prompt?: string;
  answer?: string;
  mark_scheme?: string[];
  difficulty?: string;
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: subjects } = await db.from('curriculum_subjects_by_class')
    .select('id, subject_slug, language').eq('class_level', CLASS_LEVEL).eq('board_code', BOARD);
  if (!subjects?.length) { console.error('✗ no subjects'); process.exit(1); }

  const subjById = new Map(subjects.map((s: any) => [s.id, s]));
  const { data: chapters } = await db.from('curriculum_chapters')
    .select('id, chapter_no, title_en, subject_class_id')
    .in('subject_class_id', subjects.map((s: any) => s.id))
    .eq('summative_no', SUMMATIVE).order('chapter_no');
  if (!chapters?.length) { console.error('✗ no chapters'); process.exit(1); }

  // Which (topic, type) pairs already exist?
  const { data: existing } = await db.from('chapter_question_bank')
    .select('topic_id, question_type')
    .in('chapter_id', chapters.map((c: any) => c.id));
  const have = new Map<string, Set<string>>();
  for (const r of existing || []) {
    if (!have.has(r.topic_id)) have.set(r.topic_id, new Set());
    have.get(r.topic_id)!.add(r.question_type);
  }

  const { data: enrich } = await db.from('topic_enrichment').select('topic_id, units');
  const unitsByTopic = new Map<string, any[]>();
  for (const e of enrich || []) if (e.topic_id) unitsByTopic.set(e.topic_id, e.units || []);

  let todo: any[] = [];
  for (const ch of chapters) {
    const { data: topics } = await db.from('curriculum_topics')
      .select('id, title_en, learning_objectives').eq('chapter_id', ch.id).order('topic_no');
    for (const t of topics || []) {
      const got = have.get(t.id) || new Set();
      const missing = WANTED.filter((w) => !got.has(w));
      if (missing.length && unitsByTopic.has(t.id)) {
        todo.push({ ch, subj: subjById.get(ch.subject_class_id), topic: t, missing });
      }
    }
  }
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);

  console.log(`${todo.length} topics missing ${WANTED.join(' / ')}` + (DRY ? '  [DRY RUN]' : '') + '\n');
  if (!todo.length) { console.log('Nothing to do.'); return; }

  let added = 0, failed = 0;

  for (const [i, job] of todo.entries()) {
    const { ch, subj, topic, missing } = job;
    process.stdout.write(`  [${i + 1}/${todo.length}] ${String(topic.title_en).slice(0, 44).padEnd(44)} `);

    const rawUnits = unitsByTopic.get(topic.id) || [];
    const cls = classifyEnriched(rawUnits as any, { subjectSlug: subj.subject_slug, classLevel: CLASS_LEVEL });

    // Only ask for a type where at least one unit can legitimately carry it.
    const askFor: Array<{ type: QuestionType; units: typeof cls }> = [];
    for (const qt of missing as QuestionType[]) {
      const eligible = cls.filter((c) => questionFit(c.type as KnowledgeType, qt) >= MIN_QUESTION_FIT);
      if (eligible.length) askFor.push({ type: qt, units: eligible });
    }
    if (!askFor.length) { console.log('no unit can carry those types — skipped'); continue; }

    const unitBlock = cls.map((c) => `- "${c.heading}" [${c.type}]: ${c.body.slice(0, 300)}`).join('\n');
    const typeSpec = askFor.map(({ type }) =>
      type === 'very_short'
        ? '  very_short (1 mark): answerable in ONE line. "Name two…", "What is…", "State the…"'
        : '  long (5 marks): an extended answer needing several points or reasoning',
    ).join('\n');

    const prompt = `These are the teaching units for one topic of a ${BOARD.toUpperCase()} Class ${CLASS_LEVEL} syllabus.

Subject: ${subj.subject_slug}   Chapter: ${ch.title_en}   Topic: ${topic.title_en}

UNITS:
${unitBlock}

Write exam questions of ONLY these types, one or two per suitable unit:
${typeSpec}

Match each question to a unit by copying its heading into "unit_heading".
Every question needs the exact answer. For 5-mark questions include "mark_scheme"
listing the points a marker would award.

Return ONLY JSON:
{"questions":[{"unit_heading":"...","type":"very_short","prompt":"...","answer":"...","difficulty":"easy"}]}`;

    const { ok, data, error, provider } = await generateJSON<{ questions?: GenQ[] }>(
      prompt, { temperature: 0.5, maxOutputTokens: 2500, timeoutMs: 120_000 },
    );

    const qs = (ok && data?.questions ? data.questions : []).filter((q) => q?.prompt && q?.type);
    if (!qs.length) { console.log(`FAILED — ${(error || 'nothing returned').slice(0, 60)}`); failed++; await sleep(DELAY_MS); continue; }

    const rows: any[] = [];
    for (const q of qs) {
      const qt = (WANTED as string[]).includes(String(q.type)) ? (q.type as QuestionType) : null;
      if (!qt) continue;
      // Match back to the unit, and re-check fit — the model does not get to
      // decide that a judgement can be answered in one line.
      const unit = cls.find((c) => c.heading === q.unit_heading) || cls[0];
      if (!unit || questionFit(unit.type as KnowledgeType, qt) < MIN_QUESTION_FIT) continue;

      rows.push({
        chapter_id: ch.id, topic_id: topic.id,
        question_text: String(q.prompt).slice(0, 2000),
        answer_text: String(q.answer ?? '').slice(0, 2000),
        question_type: qt,
        marks: QUESTION_MARKS[qt],
        difficulty: ['easy', 'medium', 'hard'].includes(String(q.difficulty)) ? q.difficulty : 'medium',
        cognitive_level: unit.type === 'judgment' ? 5 : unit.type === 'concept' ? 3 : 2,
        source: 'ai_generated', confidence: 0.8,
        language: subj.language || 'en',
        tags: [subj.subject_slug, `class${CLASS_LEVEL}`, `summative_${SUMMATIVE}`, unit.type],
      });
    }

    if (DRY) {
      console.log(`would add ${rows.length}  [${provider}]`);
    } else if (rows.length) {
      const { error: ie } = await db.from('chapter_question_bank').insert(rows);
      console.log(ie ? `DB FAILED — ${ie.message.slice(0, 50)}` : `+${rows.length}  [${provider}]`);
      if (!ie) added += rows.length;
    } else {
      console.log('0 usable');
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n✓ ${added} questions added.` + (failed ? `  ${failed} failed — re-run to retry.` : ''));
}

main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
