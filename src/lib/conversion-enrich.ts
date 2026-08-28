/**
 * Conversion Enrichment — give the classifier something to read.
 *
 * ---------------------------------------------------------------------------
 * THE PROBLEM
 * ---------------------------------------------------------------------------
 * curriculum_topics holds a syllabus OUTLINE, not lesson content:
 *
 *   title_en            : 'Quadratic formula'
 *   learning_objectives : ['Discriminant, roots, nature.']
 *
 * That is six words. The classifier reads it, finds no cue, and correctly
 * reports needsEnrichment. So before the Conversion Engine can do anything
 * useful on real curriculum, something has to write the actual teachable text.
 *
 * ---------------------------------------------------------------------------
 * THE DIVISION OF LABOUR
 * ---------------------------------------------------------------------------
 * The model WRITES. The deterministic engine CLASSIFIES.
 *
 * We do not ask the model "what kind of knowledge is this?" as the primary
 * route, because then the classification is unauditable and drifts between
 * runs. We ask it to write a lesson body broken into coherent units, then run
 * the same deterministic classifier over that text — so a teacher can still
 * open the cue list and see exactly why a unit was treated the way it was.
 *
 * The model gets ONE narrow second-opinion power, defined in
 * `applySecondOpinion`: it may push an ambiguous unit UP the safety order
 * (fact → concept), never down. It can tell us we are under-teaching. It can
 * never tell us to start memorising something.
 *
 * Everything degrades: with no GEMINI_API_KEY, `synthesiseFallback` builds
 * usable text from the title and objectives alone. Thinner, honestly flagged,
 * but never a blank screen mid-lesson.
 */

import { createHash } from 'crypto';
import { geminiGenerate, geminiGenerateJSON, isGeminiConfigured } from './gemini';
import {
  classifyUnit,
  KNOWLEDGE_TYPES,
  type Classification,
  type KnowledgeType,
} from './conversion-engine';

// ============================================================================
// 1. Types
// ============================================================================

export interface CurriculumTopicRow {
  id: string;
  topic_no?: number | null;
  title_en: string;
  title_native?: string | null;
  learning_objectives?: string[] | null;
  bloom_level?: number | null;
  expected_minutes?: number | null;
}

export interface EnrichedUnit {
  /** Stable id: topic id prefix + unit number. */
  unitId: string;
  topicId: string;
  heading: string;
  /** The teachable prose the classifier reads. */
  body: string;
  /** 'gemini' | 'fallback' | 'cache' — surfaced so you know what you are looking at. */
  source: 'gemini' | 'fallback' | 'cache';
}

export interface EnrichmentResult {
  units: EnrichedUnit[];
  usedModel: boolean;
  /** Populated when the model was tried and failed; the fallback still ran. */
  warning?: string;
}

// ============================================================================
// 2. Prompt
// ============================================================================

/**
 * Deliberately asks for a MIXTURE.
 *
 * If you ask a model to "write a lesson", it writes uniform explanatory prose
 * and every unit classifies as 'concept'. Naming the six kinds up front and
 * asking it to separate them is what makes the chapter come back as the
 * mixture it actually is — the whole premise of the engine.
 *
 * It is NOT told which representation will be used. That decision belongs to
 * the engine, from this student's evidence, after classification.
 */
function buildPrompt(topic: CurriculumTopicRow, subject: string, classLevel: number): string {
  const objectives = (topic.learning_objectives || []).filter(Boolean).join('; ');
  return `You are writing the teaching text for one topic of an Indian school syllabus.

Subject: ${subject}
Class: ${classLevel}
Topic: ${topic.title_en}
Syllabus notes: ${objectives || '(none given)'}

Break this topic into 3 to 6 units. Each unit must contain ONE kind of knowledge, not a mixture. The six kinds are:

1. arbitrary fact      - dates, symbols, constants, vocabulary, ordered lists. Nothing derivable; must simply be known.
2. causal sequence     - steps where each one CAUSES the next.
3. concept             - an idea with a boundary, where the point is knowing what does and does not count.
4. procedure           - a repeatable skill the student must be able to perform.
5. relational structure- a system where position or grouping carries the meaning.
6. judgement           - evaluation and interpretation, where more than one defensible answer exists.

Rules:
- Write real teaching prose, 60-140 words per unit. Not bullet points, not a summary.
- Write in full sentences using the natural vocabulary of that kind of knowledge. For a procedure, use the verbs of doing (solve, substitute, simplify). For a concept, define and say why. For a causal sequence, say what leads to what. For a judgement, ask the student to weigh and justify.
- Use Indian contexts and examples where they fit naturally.
- Do NOT include the answer key, and do NOT tell the student how to memorise anything.
- Class ${classLevel} reading level.

Return ONLY JSON, no markdown fence:
{"units":[{"heading":"short title","kind":"one of the six names above","body":"the teaching prose"}]}`;
}

// ============================================================================
// 3. Fallback — never leave a lesson blank
// ============================================================================

/**
 * Build usable text with no model at all.
 *
 * This is genuinely thinner than generated content and it is meant to be. It
 * gives the classifier the syllabus verbs to read rather than inventing
 * subject matter we cannot verify — an invented "fact" about photosynthesis
 * would be worse than a thin one.
 */
export function synthesiseFallback(
  topic: CurriculumTopicRow,
  subject: string,
): EnrichedUnit[] {
  const objectives = (topic.learning_objectives || []).filter(Boolean);
  const prefix = topic.id.slice(0, 8);

  if (objectives.length === 0) {
    return [{
      unitId: `${prefix}-u1`,
      topicId: topic.id,
      heading: topic.title_en,
      body: `${topic.title_en} in ${subject}. Work through what this topic covers, checking understanding at each stage before moving on.`,
      source: 'fallback',
    }];
  }

  // One unit per objective — objectives are already the syllabus author's own
  // decomposition, and they usually carry the giveaway verb ("Solving by...",
  // "Identifying...", "Laws of...").
  return objectives.map((obj, i) => ({
    unitId: `${prefix}-u${i + 1}`,
    topicId: topic.id,
    heading: objectives.length === 1 ? topic.title_en : `${topic.title_en} (${i + 1})`,
    body: `${topic.title_en}: ${obj} This belongs to ${subject}. Work through it and check the student can handle it unaided before moving on.`,
    source: 'fallback' as const,
  }));
}

// ============================================================================
// 4. Enrich
// ============================================================================

export async function enrichTopic(
  topic: CurriculumTopicRow,
  opts: { subject: string; classLevel: number },
): Promise<EnrichmentResult> {
  if (!isGeminiConfigured()) {
    return {
      units: synthesiseFallback(topic, opts.subject),
      usedModel: false,
      warning: 'GEMINI_API_KEY not set — using syllabus text only. Classification will be thin.',
    };
  }

  const prompt = buildPrompt(topic, opts.subject, opts.classLevel);
  // Budget: up to 6 units x 140 words is ~1,100 tokens of prose, plus JSON
  // scaffolding, plus the model's own thinking tokens which are charged
  // against the SAME budget. 2048 truncated the array mid-object and threw
  // the whole generation away; 8192 leaves real headroom.
  const { ok, data, error } = await geminiGenerateJSON<{
    units?: Array<{ heading?: string; kind?: string; body?: string }>;
  }>(prompt, { temperature: 0.6, maxOutputTokens: 8192, timeoutMs: 60_000 });

  const raw = ok && data?.units ? data.units : null;
  if (!raw || raw.length === 0) {
    return {
      units: synthesiseFallback(topic, opts.subject),
      usedModel: false,
      warning: error ? `Generation failed (${error}) — used syllabus text.` : 'Generation returned nothing — used syllabus text.',
    };
  }

  const prefix = topic.id.slice(0, 8);
  const units = raw
    .filter((u) => (u.body || '').trim().length >= 25)
    .slice(0, 8)
    .map((u, i) => ({
      unitId: `${prefix}-u${i + 1}`,
      topicId: topic.id,
      heading: (u.heading || `${topic.title_en} (${i + 1})`).slice(0, 120),
      body: (u.body || '').trim(),
      // The model's own `kind` is kept only for the second opinion below; the
      // deterministic classifier is still what decides.
      _modelKind: normaliseKind(u.kind),
      source: 'gemini' as const,
    }));

  if (units.length === 0) {
    return {
      units: synthesiseFallback(topic, opts.subject),
      usedModel: false,
      warning: 'Generated units were all too short — used syllabus text.',
    };
  }

  return { units, usedModel: true };
}

/** Map the model's free-text kind onto our enum. Unrecognised → null. */
function normaliseKind(kind?: string): KnowledgeType | null {
  if (!kind) return null;
  const k = kind.toLowerCase().replace(/[^a-z]/g, '_');
  const direct = KNOWLEDGE_TYPES.find((t) => k.includes(t.replace(/_/g, '')) || k === t);
  if (direct) return direct;
  if (k.includes('fact')) return 'arbitrary_fact';
  if (k.includes('causal') || k.includes('sequence')) return 'causal_sequence';
  if (k.includes('concept') || k.includes('idea')) return 'concept';
  if (k.includes('procedure') || k.includes('skill')) return 'procedure';
  if (k.includes('relational') || k.includes('structure')) return 'relational_structure';
  if (k.includes('judg')) return 'judgment';
  return null;
}

// ============================================================================
// 5. Second opinion — the model may raise, never lower
// ============================================================================

/**
 * Safety property (b), extended to the model.
 *
 * The model's opinion is consulted ONLY when the deterministic classifier was
 * unsure (ambiguous or no cues), and it may only move a unit UP the safety
 * order — toward the more expensive treatment.
 *
 * So a model that says "this concept is really just a fact to memorise" is
 * ignored, every time. A model that says "you have this down as a fact but it
 * is really a concept" is listened to. Under uncertainty the system errs
 * toward teaching for understanding, and no amount of model confidence can
 * flip that direction.
 */
const SAFETY_ORDER: KnowledgeType[] = [
  'arbitrary_fact', 'causal_sequence', 'relational_structure',
  'procedure', 'concept', 'judgment',
];

export function applySecondOpinion(
  deterministic: Classification,
  modelKind: KnowledgeType | null,
): Classification {
  if (!modelKind || modelKind === deterministic.type) return deterministic;

  // Only ever consulted where we were genuinely unsure.
  if (!deterministic.ambiguous && !deterministic.needsEnrichment) return deterministic;

  const here = SAFETY_ORDER.indexOf(deterministic.type);
  const there = SAFETY_ORDER.indexOf(modelKind);
  if (there <= here) return deterministic;  // the model wants to downgrade — refuse

  return {
    ...deterministic,
    type: modelKind,
    flavour: modelKind === 'arbitrary_fact' ? deterministic.flavour : null,
    cues: [...deterministic.cues, `raised to ${modelKind} on the model's second opinion`],
  };
}

// ============================================================================
// 6. Classify enriched units
// ============================================================================

export function classifyEnriched(
  units: Array<EnrichedUnit & { _modelKind?: KnowledgeType | null }>,
  opts: { subjectSlug?: string; classLevel?: number },
): Array<Classification & { topicId: string; heading: string; body: string; source: string }> {
  return units.map((u) => {
    const base = classifyUnit({
      id: u.unitId,
      title: u.heading,
      text: u.body,
      subjectSlug: opts.subjectSlug,
      classLevel: opts.classLevel,
    });
    const final = applySecondOpinion(base, u._modelKind ?? null);
    return { ...final, topicId: u.topicId, heading: u.heading, body: u.body, source: u.source };
  });
}

// ============================================================================
// 7. Cache
// ============================================================================

/**
 * Cache key is a hash of (topic id + title + objectives), so an edit to the
 * syllabus row invalidates the generated lesson automatically.
 */
export function enrichmentKey(topic: CurriculumTopicRow): string {
  const material = [
    topic.id,
    topic.title_en,
    (topic.learning_objectives || []).join('|'),
  ].join('::');
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

export async function loadCachedEnrichment(
  supabase: any,
  topic: CurriculumTopicRow,
): Promise<EnrichedUnit[] | null> {
  try {
    const { data } = await supabase
      .from('topic_enrichment')
      .select('units')
      .eq('enrichment_key', enrichmentKey(topic))
      .maybeSingle();
    if (!data?.units || !Array.isArray(data.units) || data.units.length === 0) return null;
    return data.units.map((u: any) => ({ ...u, source: 'cache' as const }));
  } catch {
    return null;
  }
}

export async function saveEnrichment(
  supabase: any,
  topic: CurriculumTopicRow,
  units: EnrichedUnit[],
  usedModel: boolean,
): Promise<void> {
  // Never cache the fallback — it would freeze thin text in place and stop the
  // real generation from ever running once a key is configured.
  if (!usedModel) return;
  try {
    await supabase.from('topic_enrichment').upsert(
      {
        topic_id: topic.id,
        enrichment_key: enrichmentKey(topic),
        title_en: topic.title_en,
        units,
        generated_by: 'gemini',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'enrichment_key' },
    );
  } catch {
    // cache is an optimisation, not a dependency
  }
}

/** Cache-through: read, else generate, else fall back. */
export async function getOrCreateEnrichment(
  supabase: any,
  topic: CurriculumTopicRow,
  opts: { subject: string; classLevel: number },
): Promise<EnrichmentResult> {
  const cached = await loadCachedEnrichment(supabase, topic);
  if (cached) return { units: cached, usedModel: true };

  const result = await enrichTopic(topic, opts);
  await saveEnrichment(supabase, topic, result.units, result.usedModel);
  return result;
}
