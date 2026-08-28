/**
 * Build mastery packs for one summative window.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PRODUCES
 * ---------------------------------------------------------------------------
 * For every chapter in the target summative:
 *   - teaching units, one kind of knowledge each      → topic_enrichment
 *   - exam-shaped questions with answers and marking  → chapter_question_bank
 *
 * Neither table is new. Reusing them means the packs are visible to the rest
 * of the app (the question bank already feeds mock tests and practice) rather
 * than living in a private silo.
 *
 * ---------------------------------------------------------------------------
 * ONE CALL PER TOPIC, AND WHY
 * ---------------------------------------------------------------------------
 * The obvious design is two calls per topic — one to write the lesson, one to
 * write the questions. That doubles quota consumption, and free-tier Gemini is
 * 20 requests per day PER PROJECT PER MODEL. At 65 topics that is the
 * difference between finishing today and finishing on Thursday.
 *
 * So one call returns both. The model is asked for a SUPERSET of question
 * types per unit; the deterministic classifier then decides what kind of
 * knowledge each unit actually is, and anything that does not fit is dropped.
 * The model never gets to decide that a judgement can be tested by filling in
 * a blank — it only gets to write the words.
 *
 *   npx tsx --env-file=.env.local scripts/build-packs.ts --class 5 --board wbbse --summative 3
 *   ... --subject math    ... --limit 2    ... --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { generateJSON } from '../src/lib/ai-provider';
import { isGeminiConfigured } from '../src/lib/gemini';
import {
  classifyEnriched, loadCachedEnrichment, saveEnrichment,
  type CurriculumTopicRow, type EnrichedUnit,
} from '../src/lib/conversion-enrich';
import {
  selectRepresentation, buildConversionPlan, flavourBias,
} from '../src/lib/conversion-engine';
import {
  allocateQuestions, questionFit, MIN_QUESTION_FIT, QUESTION_MARKS,
  type QuestionType, type ExamShape,
} from '../src/lib/mastery-pack';

// ---------------------------------------------------------------------------

function arg(n: string, d?: string) {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}
const flag = (n: string) => process.argv.includes(`--${n}`);

const CLASS_LEVEL = Number(arg('class', '5'));
const BOARD = arg('board', 'wbbse')!;
const SUMMATIVE = Number(arg('summative', '3'));
const SUBJECT = arg('subject');
const LIMIT = Number(arg('limit', '0'));
const DRY = flag('dry-run');
/** Rebuild topics that already have questions instead of skipping them. */
const FORCE = flag('force');
const DELAY_MS = Number(arg('delay', '2500'));
/** Marks of practice per topic — over-provides vs the exam, keeps its shape. */
const MARKS_PER_TOPIC = Number(arg('marks-per-topic', '10'));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------

interface GenUnit {
  heading?: string;
  kind?: string;
  body?: string;
  questions?: Array<{
    type?: string;
    prompt?: string;
    options?: string[];
    correct_index?: number;
    answer?: string;
    working?: string;
    mark_scheme?: string[];
    difficulty?: string;
    probes_misconception?: string;
  }>;
}

function buildPrompt(topic: CurriculumTopicRow, subject: string, chapter: string): string {
  const obj = (topic.learning_objectives || []).filter(Boolean).join('; ');
  return `Write the teaching material AND exam questions for one topic of an Indian school syllabus.

Board: ${BOARD.toUpperCase()} (West Bengal)   Class: ${CLASS_LEVEL}
Subject: ${subject}
Chapter: ${chapter}
Topic: ${topic.title_en}
Objectives: ${obj || '(none)'}

STEP 1 — Break the topic into 2 to 4 units. Each unit must hold ONE kind of knowledge:
  arbitrary_fact       dates, names, symbols, ordered lists — nothing derivable, must simply be known
  causal_sequence      steps where each one CAUSES the next
  concept              an idea with a boundary; the point is what counts and what does not
  procedure            a skill the student must be able to perform
  relational_structure a system where grouping or position carries the meaning
  judgment             more than one defensible answer

For each unit write "body": 70-140 words of real teaching prose at Class ${CLASS_LEVEL} reading level.
Use Indian and West Bengal examples where they fit naturally. Do NOT tell the student how to memorise it.

STEP 2 — For each unit write questions in this board's exam style.

The board's paper is 20% mcq, 20% fill_blank, 25% very_short, 25% short, 10% long.
Your questions must reflect that. Write ALL FIVE of these for every unit unless a type is
genuinely impossible for that unit's kind of knowledge:

  mcq        1 mark. Exactly 4 options, ONE correct. The three wrong options must be
             believable near-misses a student could actually pick — never silly.
  fill_blank 1 mark. One blank, one exact word or number.
  very_short 1 mark. Answerable in ONE line — "Name two…", "What is…", "State the…".
             This is a QUARTER of the real paper. Do not skip it.
  short      3 marks. Needs 2-3 distinct points.
  long       5 marks. Needs an extended answer with several parts or reasoning.
             This is a TENTH of the real paper. Include it wherever the unit can carry it.

The only reason to omit a type is that the content cannot support it: no 5-mark essay about a
single remembered fact, no fill-in-the-blank about a matter of opinion. Being unsure is not a
reason to omit — write it.

Every question needs: the exact answer, and for anything above 1 mark a "mark_scheme" listing
the points a marker would award. For procedure questions include "working" showing the steps.
Where a question is designed to catch a common mistake, name it in "probes_misconception".

Return ONLY JSON:
{"units":[{"heading":"...","kind":"concept","body":"...","questions":[
  {"type":"mcq","prompt":"...","options":["a","b","c","d"],"correct_index":0,"answer":"a","difficulty":"easy"},
  {"type":"short","prompt":"...","answer":"...","mark_scheme":["...","..."],"difficulty":"medium"}
]}]}`;
}

const VALID_Q: QuestionType[] = ['mcq', 'fill_blank', 'very_short', 'short', 'long'];
function normType(t?: string): QuestionType | null {
  const k = (t || '').toLowerCase().replace(/[^a-z]/g, '_');
  return (VALID_Q.find((v) => k.includes(v.replace('_', ''))) || VALID_Q.find((v) => v === k)) ?? null;
}

// ---------------------------------------------------------------------------

async function main() {
  // any provider will do — groq, gemini or local ollama
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: shapeRow } = await db.from('exam_shape_profiles').select('*')
    .eq('board_code', BOARD).eq('class_level', CLASS_LEVEL)
    .eq('exam_kind', `summative_${SUMMATIVE}`).maybeSingle();
  if (!shapeRow) { console.error(`✗ No exam shape for summative_${SUMMATIVE}.`); process.exit(1); }

  const exam: ExamShape = {
    examKind: shapeRow.exam_kind, totalMarks: shapeRow.total_marks,
    durationMinutes: shapeRow.duration_minutes, typeProportions: shapeRow.type_proportions,
  };

  let sq = db.from('curriculum_subjects_by_class')
    .select('id, subject_slug, textbook_title_en, language')
    .eq('class_level', CLASS_LEVEL).eq('board_code', BOARD);
  if (SUBJECT) sq = sq.eq('subject_slug', SUBJECT);
  const { data: subjects } = await sq;
  if (!subjects?.length) { console.error('✗ No subjects.'); process.exit(1); }

  const subjById = new Map(subjects.map((s: any) => [s.id, s]));
  const { data: chaptersRaw } = await db.from('curriculum_chapters')
    .select('id, chapter_no, title_en, subject_class_id')
    .in('subject_class_id', subjects.map((s: any) => s.id))
    .eq('summative_no', SUMMATIVE).order('chapter_no');

  let chapters = chaptersRaw || [];
  if (LIMIT > 0) chapters = chapters.slice(0, LIMIT);

  console.log(`Class ${CLASS_LEVEL} ${BOARD.toUpperCase()} summative ${SUMMATIVE}: ${chapters.length} chapters` + (DRY ? '  [DRY RUN]' : ''));
  console.log(`Exam shape: ${exam.totalMarks} marks / ${exam.durationMinutes} min\n`);

  let totalQ = 0, totalU = 0, failed = 0;

  for (const ch of chapters) {
    const subj: any = subjById.get(ch.subject_class_id);
    const { data: topics } = await db.from('curriculum_topics')
      .select('id, topic_no, title_en, learning_objectives')
      .eq('chapter_id', ch.id).order('topic_no');
    if (!topics?.length) continue;

    console.log(`── ${subj.subject_slug} ch${ch.chapter_no} ${ch.title_en}  (${topics.length} topics)`);

    /**
     * How many marks of practice each TOPIC gets.
     *
     * Deriving this as a fraction of the paper was wrong: the summative is
     * 60 marks across a whole subject, so a strict share gives about two
     * marks per topic — one question, no variety, and useless as a bank.
     * Practice should over-provide relative to the exam while keeping the
     * exam's TYPE proportions, which is what actually transfers.
     */
    const topicShare = MARKS_PER_TOPIC / exam.totalMarks;

    // Topics that already have questions are skipped, so a re-run resumes
    // rather than duplicating. Without this, restarting after a rate-limit
    // silently doubles the bank — and duplicate questions in practice are
    // worse than missing ones, because they look like coverage.
    const { data: existingQ } = await db
      .from('chapter_question_bank')
      .select('topic_id')
      .eq('chapter_id', ch.id);
    const alreadyBuilt = new Set((existingQ || []).map((r: any) => r.topic_id));

    for (const t of topics as CurriculumTopicRow[]) {
      if (!FORCE && alreadyBuilt.has(t.id)) continue;
      process.stdout.write(`   ${String(t.title_en).slice(0, 46).padEnd(46)} `);

      /**
       * Only reuse cached teaching text when this topic ALREADY has questions.
       *
       * The cache holds units, not questions. Reusing it for a topic with an
       * empty question bank produced "4 units, 0 questions" — teaching text
       * with nothing to practise on, which reads like success in the log and
       * is useless in the app. When questions are missing we regenerate, which
       * costs one call and returns both.
       */
      const cached = alreadyBuilt.has(t.id) ? await loadCachedEnrichment(db, t) : null;
      let units: EnrichedUnit[] = [];
      let gen: GenUnit[] = [];
      let provider: string | undefined;

      if (cached && cached.length) {
        units = cached;
        process.stdout.write("(cached) ");
      } else {
        const { ok, data, error, provider: p } = await generateJSON<{ units?: GenUnit[] }>(
          buildPrompt(t, subj.subject_slug, ch.title_en),
          { temperature: 0.5, maxOutputTokens: 8192, timeoutMs: 120_000 },
        );
        provider = p;
        gen = (ok && data?.units ? data.units : []).filter((u) => (u.body || '').trim().length >= 40);
        if (!gen.length) { console.log(`FAILED — ${(error || 'nothing returned').slice(0, 70)}`); failed++; await sleep(DELAY_MS); continue; }

        const prefix = String(t.id).slice(0, 8);
        units = gen.map((u, i) => ({
          unitId: `${prefix}-u${i + 1}`, topicId: t.id,
          heading: (u.heading || `${t.title_en} (${i + 1})`).slice(0, 120),
          body: (u.body || '').trim(),
          _modelKind: (u.kind as any) || null,
          source: 'gemini' as const,
        })) as any;
        if (!DRY) await saveEnrichment(db, t, units, true);
      }

      // Deterministic classification decides the knowledge type — never the model.
      const cls = classifyEnriched(units as any, { subjectSlug: subj.subject_slug, classLevel: CLASS_LEVEL });
      const alloc = allocateQuestions(
        cls.map((c) => ({ unitId: c.unitId, knowledgeType: c.type })), exam, topicShare,
      );

      const rows: any[] = [];
      cls.forEach((c, idx) => {
        const wanted = alloc.filter((a) => a.unitId === c.unitId);
        const produced = gen[idx]?.questions || [];

        for (const w of wanted) {
          // Take a generated question of the right type; drop any whose type
          // does not suit this unit's knowledge kind.
          const match = produced.find((q) => normType(q.type) === w.questionType && q.prompt);
          if (!match) continue;
          if (questionFit(c.type, w.questionType) < MIN_QUESTION_FIT) continue;

          rows.push({
            chapter_id: ch.id, topic_id: t.id,
            question_text: String(match.prompt).slice(0, 2000),
            answer_text: String(match.answer ?? '').slice(0, 2000),
            working: match.working ? String(match.working).slice(0, 4000) : null,
            options: match.options?.length ? match.options : null,
            correct_index: typeof match.correct_index === 'number' ? match.correct_index : null,
            question_type: w.questionType,
            marks: QUESTION_MARKS[w.questionType],
            difficulty: ['easy', 'medium', 'hard'].includes(String(match.difficulty)) ? match.difficulty : 'medium',
            cognitive_level: c.type === 'judgment' ? 5 : c.type === 'concept' ? 3 : 2,
            source: 'ai_generated',
            confidence: 0.8,
            language: subj.language || 'en',
            tags: [subj.subject_slug, `class${CLASS_LEVEL}`, `summative_${SUMMATIVE}`, c.type],
          });
        }

        // Record the chosen representation so /teach and the pack agree.
        const sel = selectRepresentation({ knowledgeType: c.type, subjectName: subj.subject_slug, affinityBias: flavourBias(c) });
        buildConversionPlan(c, sel, subj.subject_slug);
      });

      if (DRY) {
        console.log(`${cls.length} units, ${rows.length} questions`);
      } else if (rows.length) {
        const { error: qe } = await db.from('chapter_question_bank').insert(rows);
        console.log(qe ? `DB FAILED — ${qe.message.slice(0, 60)}` : `${cls.length} units, ${rows.length} questions  [${provider ?? 'cache'}]`);
        if (!qe) { totalQ += rows.length; totalU += cls.length; }
      } else {
        console.log(`${cls.length} units, 0 questions`);
        totalU += cls.length;
      }
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✓ ${totalU} units, ${totalQ} questions written.` + (failed ? `  ${failed} topic(s) failed — re-run to retry.` : ''));
}

main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
