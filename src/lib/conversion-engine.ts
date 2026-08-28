/**
 * Conversion Engine — turn ANY content into a form that is both
 * memorable AND understood, by first asking what KIND of knowledge it is.
 *
 * ---------------------------------------------------------------------------
 * THE PROBLEM THIS FIXES
 * ---------------------------------------------------------------------------
 * Everything else in this codebase picks a teaching method by SUBJECT.
 * `narrowMethod('math', …)` returns 'drill' for all of Math. But one Math
 * chapter contains at least four different kinds of knowledge:
 *
 *   - "the quadratic formula is x = (-b ± √(b²-4ac))/2a"  → arbitrary fact
 *   - "solve 2x² + 5x - 3 = 0"                            → procedure
 *   - "what a discriminant actually tells you"            → concept
 *   - "how the graph shifts as a changes"                 → relational structure
 *
 * Drilling all four is why students can recite a formula and still fail the
 * application question. Animating all four is why they enjoy the video and
 * remember nothing. Both apply ONE converter to SIX kinds of content.
 *
 * This engine does three things nothing else here does:
 *   1. CLASSIFY  content into a knowledge type (per unit, not per chapter).
 *   2. GATE      which representations are even legal for that type.
 *   3. SELECT    among the legal ones from behavioural evidence, keyed on
 *                (subject × knowledgeType × representation) — and say honestly
 *                when it does not yet have enough evidence to know.
 *
 * ---------------------------------------------------------------------------
 * THE TWO SAFETY PROPERTIES
 * ---------------------------------------------------------------------------
 * (a) Exploration can never propose an illegal representation. The bandit only
 *     samples arms above MIN_AFFINITY for the classified type, so the system
 *     can never decide to make a student memorise a concept — no matter what
 *     the reward data says.
 *
 * (b) Under classification uncertainty we resolve UPWARD (SAFETY_ORDER).
 *     Teaching a fact as if it were a concept wastes a few minutes.
 *     Teaching a concept as if it were a fact builds fake mastery that
 *     collapses in the exam. The costs are not symmetric, so the tie-break
 *     is not symmetric.
 *
 * Pure functions only. No I/O, no Supabase, no model calls — fully testable
 * and it runs offline. LLM refinement is an optional additive hook.
 */

// ============================================================================
// 1. KNOWLEDGE TYPES — what kind of thing is this, really?
// ============================================================================

export type KnowledgeType =
  /** Dates, symbols, valencies, capitals, vocabulary, constants. No derivable
   *  structure — the only route in is association. Lorayne territory. */
  | 'arbitrary_fact'
  /** Ordered steps where each step CAUSES the next: Krebs, digestion, the
   *  chain from Bengal famine to Quit India. Memory and understanding are the
   *  same act here, so long as the causality is preserved. */
  | 'causal_sequence'
  /** An abstraction with a boundary: inertia, electronegativity, irony,
   *  derivative, mole. You do not memorise a boundary — you feel it by meeting
   *  things just inside and just outside it. */
  | 'concept'
  /** A repeatable skill: balance an equation, factorise, construct a bisector,
   *  structure an essay. Knowing the steps is not being able to do it; only
   *  fading scaffolds close that gap. */
  | 'procedure'
  /** A system where POSITION carries meaning: periodic trends, food webs,
   *  grammar, taxonomy, circuit topology. Flattening it to a list destroys the
   *  actual information. */
  | 'relational_structure'
  /** Taste and evaluation: is this essay good, which method fits, was this
   *  historically significant. No shortcut exists — only many contrasting
   *  exemplars with feedback. */
  | 'judgment';

export const KNOWLEDGE_TYPES: KnowledgeType[] = [
  'arbitrary_fact', 'causal_sequence', 'concept',
  'procedure', 'relational_structure', 'judgment',
];

/**
 * Ascending cost-of-being-wrong. When the classifier is torn between two types
 * we pick the one LATER in this list — the more expensive treatment.
 * Over-teaching is recoverable; under-teaching is not.
 */
const SAFETY_ORDER: KnowledgeType[] = [
  'arbitrary_fact',       // cheapest to deliver, worst to wrongly assume
  'causal_sequence',
  'relational_structure',
  'procedure',
  'concept',
  'judgment',             // most expensive, safest to wrongly assume
];

function safetyRank(t: KnowledgeType): number {
  return SAFETY_ORDER.indexOf(t);
}

export const KNOWLEDGE_TYPE_LABEL: Record<KnowledgeType, string> = {
  arbitrary_fact: 'Fact to lock in',
  causal_sequence: 'Chain of events',
  concept: 'Idea to grasp',
  procedure: 'Skill to build',
  relational_structure: 'System to map',
  judgment: 'Judgement to develop',
};

// ============================================================================
// 2. REPRESENTATIONS — the actual conversions we can apply
// ============================================================================

export type RepresentationCode =
  /** Lorayne Link: chain of absurd, oversized, moving images. Ordered lists. */
  | 'mnemonic_link'
  /** Peg / Major system: digits → consonant sounds → picture. Numbers, indices. */
  | 'mnemonic_peg'
  /** Substitute Word: abstract or foreign term → concrete sound-alike. Vocabulary. */
  | 'mnemonic_substitute'
  /** Story where each step FORCES the next. Memorable because understood. */
  | 'causal_chain'
  /** Anchor example + near-miss non-examples. The only way to teach a boundary. */
  | 'contrast_set'
  /** Full worked example → faded → solo. The only thing that builds procedures. */
  | 'worked_example_faded'
  /** 2-D layout where position means something. Maps, trees, grids, webs. */
  | 'spatial_map'
  /** Graded exemplars side by side; student ranks, then justifies. Builds taste. */
  | 'exemplar_comparison'
  /** Map the unfamiliar onto a familiar domain, then mark where it breaks. */
  | 'analogy_bridge'
  /** Verbal + visual presented together. A support layer, rarely a primary. */
  | 'dual_coding';

export const REPRESENTATIONS: RepresentationCode[] = [
  'mnemonic_link', 'mnemonic_peg', 'mnemonic_substitute', 'causal_chain',
  'contrast_set', 'worked_example_faded', 'spatial_map', 'exemplar_comparison',
  'analogy_bridge', 'dual_coding',
];

export const REPRESENTATION_LABEL: Record<RepresentationCode, string> = {
  mnemonic_link: 'Link story',
  mnemonic_peg: 'Number pegs',
  mnemonic_substitute: 'Sound-alike picture',
  causal_chain: 'Cause-and-effect story',
  contrast_set: 'This-but-not-that',
  worked_example_faded: 'Fading worked examples',
  spatial_map: 'Map it out',
  exemplar_comparison: 'Compare the samples',
  analogy_bridge: 'Bridge from something you know',
  dual_coding: 'Words plus picture',
};

/**
 * Affinity matrix: how well does representation R serve knowledge type K?
 * 0 = actively harmful, 1 = the canonical treatment.
 *
 * The low numbers matter more than the high ones. `concept × mnemonic_link =
 * 0.15` is the line that stops this product becoming rote coaching with nicer
 * animations.
 */
const AFFINITY: Record<KnowledgeType, Record<RepresentationCode, number>> = {
  arbitrary_fact: {
    mnemonic_substitute: 0.90, mnemonic_link: 0.85, mnemonic_peg: 0.80,
    dual_coding: 0.60, spatial_map: 0.45, analogy_bridge: 0.35,
    contrast_set: 0.30, causal_chain: 0.20, worked_example_faded: 0.10,
    exemplar_comparison: 0.10,
  },
  causal_sequence: {
    causal_chain: 0.95, mnemonic_link: 0.70, dual_coding: 0.65,
    spatial_map: 0.60, analogy_bridge: 0.55, worked_example_faded: 0.40,
    mnemonic_peg: 0.40, contrast_set: 0.35, mnemonic_substitute: 0.20,
    exemplar_comparison: 0.20,
  },
  concept: {
    contrast_set: 0.95, analogy_bridge: 0.85, dual_coding: 0.70,
    exemplar_comparison: 0.60, causal_chain: 0.50, worked_example_faded: 0.45,
    spatial_map: 0.40, mnemonic_substitute: 0.30, mnemonic_link: 0.15,
    mnemonic_peg: 0.10,
  },
  procedure: {
    worked_example_faded: 0.95, dual_coding: 0.60, causal_chain: 0.55,
    contrast_set: 0.50, analogy_bridge: 0.50, exemplar_comparison: 0.40,
    spatial_map: 0.35, mnemonic_link: 0.30, mnemonic_peg: 0.30,
    mnemonic_substitute: 0.15,
  },
  relational_structure: {
    spatial_map: 0.95, dual_coding: 0.75, contrast_set: 0.60,
    analogy_bridge: 0.60, causal_chain: 0.50, exemplar_comparison: 0.45,
    mnemonic_link: 0.40, mnemonic_peg: 0.35, worked_example_faded: 0.30,
    mnemonic_substitute: 0.25,
  },
  judgment: {
    exemplar_comparison: 0.95, contrast_set: 0.80, analogy_bridge: 0.50,
    worked_example_faded: 0.45, causal_chain: 0.40, spatial_map: 0.35,
    dual_coding: 0.35, mnemonic_substitute: 0.10, mnemonic_link: 0.05,
    mnemonic_peg: 0.05,
  },
};

/** Below this, a representation is never offered — not even by exploration. */
export const MIN_AFFINITY = 0.35;

export function affinityFor(type: KnowledgeType, rep: RepresentationCode): number {
  return AFFINITY[type]?.[rep] ?? 0;
}

/** The legal representations for a knowledge type, best-fit first. */
export function legalRepresentations(type: KnowledgeType): RepresentationCode[] {
  return REPRESENTATIONS
    .filter((r) => affinityFor(type, r) >= MIN_AFFINITY)
    .sort((a, b) => affinityFor(type, b) - affinityFor(type, a));
}

// ============================================================================
// 3. CLASSIFIER — what kind of knowledge is this unit?
// ============================================================================

export interface ContentUnit {
  id: string;
  text: string;
  title?: string;
  subjectSlug?: string;
  classLevel?: number;
}

/**
 * Sub-flavour of an arbitrary fact. All three are "memorise it", but they want
 * different Lorayne tools: an ordered list wants the Link, a number wants the
 * Peg/Major system, a term wants the Substitute Word. Without this the engine
 * offers a sound-alike picture for the reactivity series, which is the right
 * family and the wrong tool.
 */
export type FactFlavour = 'list' | 'number' | 'term';

export interface Classification {
  unitId: string;
  type: KnowledgeType;
  /** Only meaningful when type === 'arbitrary_fact'. */
  flavour: FactFlavour | null;
  /**
   * 0..1. Combines TWO things, and needs both:
   *   - margin: how far the winner beat the runner-up
   *   - evidence: how much actual textual cue weight fired
   * A unit whose type came only from the subject nudge scores 0, however
   * lopsided the margin looks. Margin alone would report 1.00 for a bare
   * topic title, which is a confident-sounding guess.
   */
  confidence: number;
  /**
   * True when there is too little text to classify on: no cue fired and the
   * decision rests on the subject prior alone. Callers should enrich the
   * content (authored body text or an LLM pass) before trusting the plan.
   * A syllabus outline row — "Quadratic formula / Discriminant, roots,
   * nature." — lands here.
   */
  needsEnrichment: boolean;
  /** Total cue weight that fired. 0 = nothing in the text matched. */
  evidenceStrength: number;
  /** True when confidence fell below AMBIGUOUS_MARGIN and SAFETY_ORDER decided. */
  ambiguous: boolean;
  runnerUp: KnowledgeType | null;
  /** Full normalised distribution — a chapter is usually a mixture. */
  distribution: Record<KnowledgeType, number>;
  /** Human-readable cues that fired, for the "why did you teach it this way" panel. */
  cues: string[];
}

interface Cue {
  type: KnowledgeType;
  weight: number;
  pattern: RegExp;
  label: string;
}

/**
 * Lexical + structural cues. Deliberately readable rather than clever: a
 * teacher should be able to audit this table and say "yes, that is why".
 */
const CUES: Cue[] = [
  // ---- arbitrary_fact --------------------------------------------------
  { type: 'arbitrary_fact', weight: 2.0, pattern: /\b(1[0-9]{3}|20[0-2][0-9])\b/, label: 'a year appears' },
  { type: 'arbitrary_fact', weight: 1.8, pattern: /\b(symbol|valency|atomic (number|mass)|capital of|full form|abbreviation|SI unit|chemical formula)\b/i, label: 'label-style fact' },
  { type: 'arbitrary_fact', weight: 1.8, pattern: /\b(synonym|antonym|meaning of the word|word meaning|spelling of)\b/i, label: 'vocabulary item' },
  { type: 'arbitrary_fact', weight: 1.5, pattern: /=\s*-?\d+(\.\d+)?\s*(×|x)?\s*10\s*(\^|\*\*)?\s*-?\d+/i, label: 'a numeric constant' },
  { type: 'arbitrary_fact', weight: 1.2, pattern: /\b(list of|names of|table of contents)\b/i, label: 'a bare list' },
  { type: 'arbitrary_fact', weight: 1.0, pattern: /\b(is called|is known as|named after|the term for)\b/i, label: 'naming statement' },
  // "in order" (but not "in order to") and "series" are how Indian science
  // texts introduce the reactivity series, the activity series, spectral
  // order — all classic memorise-this items that otherwise fire no cue at all.
  { type: 'arbitrary_fact', weight: 1.4, pattern: /\bin (the correct |the )?order\b(?!\s+to)/i, label: 'an order to be learned' },
  { type: 'arbitrary_fact', weight: 0.8, pattern: /\b(series|arrange in order|by rank)\b/i, label: 'a ranked series' },

  // ---- causal_sequence -------------------------------------------------
  { type: 'causal_sequence', weight: 2.0, pattern: /\b(leads to|results in|causes|gives rise to|is followed by|produces|thereby|converted into|triggers)\b/i, label: 'causal connective' },
  { type: 'causal_sequence', weight: 1.8, pattern: /\b(cycle|process|pathway|mechanism|stages? of|sequence of|life ?cycle)\b/i, label: 'process language' },
  { type: 'causal_sequence', weight: 1.5, pattern: /\b(step\s?\d|firstly|then|next|after that|finally|subsequently)\b/i, label: 'ordering words' },
  { type: 'causal_sequence', weight: 1.2, pattern: /(→|->|=>)/, label: 'arrow notation' },

  // ---- concept ---------------------------------------------------------
  { type: 'concept', weight: 2.0, pattern: /\b(define|definition|is defined as|what is meant by|refers to|concept of|principle of|law of|theory of)\b/i, label: 'definitional framing' },
  { type: 'concept', weight: 1.2, pattern: /\b(why does|why is|the reason (why|that)|explain why)\b/i, label: 'asks for a reason' },
  { type: 'concept', weight: 0.9, pattern: /\b(means that|in other words|that is to say)\b/i, label: 'restatement' },
  { type: 'concept', weight: 0.9, pattern: /\b(understand(ing)? of|intuition|grasp)\b/i, label: 'understanding language' },

  // ---- procedure -------------------------------------------------------
  { type: 'procedure', weight: 2.0, pattern: /\b(solve|calculate|find the value|evaluate|compute|construct|balance|derive|prove|simplify|factoris|factoriz|integrate|differentiate)\w*\b/i, label: 'an imperative task verb' },
  { type: 'procedure', weight: 1.8, pattern: /\b(how to|method to|procedure|algorithm|steps to solve|working|show your work)\b/i, label: 'procedure framing' },
  { type: 'procedure', weight: 1.4, pattern: /\b(substitute|rearrange|apply the formula|transpose|cross[- ]multiply)\b/i, label: 'manipulation step' },
  { type: 'procedure', weight: 1.0, pattern: /[a-z]\s*[=]\s*[^=]*[+\-*/^]/i, label: 'an equation to manipulate' },

  // ---- relational_structure -------------------------------------------
  { type: 'relational_structure', weight: 1.8, pattern: /\b(classification|classify|types of|kinds of|categor(y|ies)|hierarchy|taxonomy|periodic|trend|belongs to the (family|group))\b/i, label: 'classification language' },
  { type: 'relational_structure', weight: 1.6, pattern: /\b(relationship between|varies with|proportional to|depends on|correlat)\w*\b/i, label: 'relational language' },
  { type: 'relational_structure', weight: 1.5, pattern: /\b(food (web|chain)|ecosystem|circuit diagram|network|family tree)\b/i, label: 'a network structure' },
  { type: 'relational_structure', weight: 1.0, pattern: /\b(table|chart|map|diagram showing|flow ?chart)\b/i, label: 'a structured display' },

  // ---- judgment --------------------------------------------------------
  { type: 'judgment', weight: 2.2, pattern: /\b(discuss|evaluate|critically|justify|do you (agree|think)|in your (own )?opinion|argue|assess|comment on|to what extent)\b/i, label: 'an evaluative prompt' },
  { type: 'judgment', weight: 1.5, pattern: /\b(interpret|appreciation|theme of|character sketch|literary device|tone of the (poem|passage))\b/i, label: 'interpretive task' },
  { type: 'judgment', weight: 1.4, pattern: /\b(significance of|importance of|impact of|merits and demerits|advantages and disadvantages)\b/i, label: 'weighing a case' },
];

/**
 * Small subject-level nudges. Deliberately weak (max 0.6) so they bias ties
 * without ever overriding what the text actually says — a definition inside a
 * Maths chapter is still a concept.
 */
const SUBJECT_NUDGE: Record<string, Partial<Record<KnowledgeType, number>>> = {
  math: { procedure: 0.6, concept: 0.2 },
  physical_science: { concept: 0.4, procedure: 0.4 },
  life_science: { causal_sequence: 0.4, relational_structure: 0.4 },
  science: { concept: 0.4, causal_sequence: 0.3 },
  history: { causal_sequence: 0.5, arbitrary_fact: 0.3 },
  geography: { relational_structure: 0.5, arbitrary_fact: 0.2 },
  social: { causal_sequence: 0.4, judgment: 0.3 },
  english: { judgment: 0.4, arbitrary_fact: 0.2 },
  bengali: { judgment: 0.4, arbitrary_fact: 0.2 },
  hindi: { judgment: 0.3, arbitrary_fact: 0.3 },
};

/** Below this winner-vs-runner-up margin we call it ambiguous and resolve upward. */
export const AMBIGUOUS_MARGIN = 0.15;

/** Which Lorayne tool this fact wants. Only consulted for arbitrary_fact. */
function detectFlavour(haystack: string): FactFlavour {
  const listy = (haystack.match(/^\s*(\d+[.)]|[-*•])\s+/gm) || []).length >= 3
    || /\b(in order|list of|names of|sequence:|series)\b/i.test(haystack)
    || (haystack.match(/,/g) || []).length >= 4;
  const numeric = /\b(1[0-9]{3}|20[0-2][0-9])\b/.test(haystack)
    || /=\s*-?\d+(\.\d+)?/.test(haystack)
    || (haystack.match(/\d/g) || []).length >= 6;

  // Order matters: an ordered list of items beats the stray year inside it.
  if (listy) return 'list';
  if (numeric) return 'number';
  return 'term';
}

/**
 * Nudge the mnemonic arms toward the right tool for this flavour.
 * Small (≤0.15) so accumulated behavioural evidence still wins — this only
 * decides the opening move, not the long-run answer.
 */
export function flavourBias(
  c: Pick<Classification, 'type' | 'flavour'>,
): Partial<Record<RepresentationCode, number>> {
  if (c.type !== 'arbitrary_fact' || !c.flavour) return {};
  switch (c.flavour) {
    case 'list':   return { mnemonic_link: 0.15, mnemonic_peg: 0.02, mnemonic_substitute: -0.10 };
    case 'number': return { mnemonic_peg: 0.15, mnemonic_link: 0.02, mnemonic_substitute: -0.10 };
    case 'term':   return { mnemonic_substitute: 0.10, mnemonic_link: -0.05, mnemonic_peg: -0.10 };
  }
}

export function classifyUnit(unit: ContentUnit): Classification {
  const haystack = `${unit.title || ''}\n${unit.text || ''}`;

  const raw: Record<KnowledgeType, number> = {
    arbitrary_fact: 0, causal_sequence: 0, concept: 0,
    procedure: 0, relational_structure: 0, judgment: 0,
  };
  const cues: string[] = [];
  // Cue weight only — subject nudges are deliberately excluded, because a
  // nudge is a prior about the subject, not evidence about this text.
  let evidenceStrength = 0;

  for (const cue of CUES) {
    const matches = haystack.match(new RegExp(cue.pattern.source, cue.pattern.flags.includes('g') ? cue.pattern.flags : `${cue.pattern.flags}g`));
    if (matches && matches.length > 0) {
      // Diminishing returns: 3 causal connectives are not 3× the evidence of 1.
      const multiplier = 1 + Math.log2(matches.length);
      raw[cue.type] += cue.weight * multiplier;
      evidenceStrength += cue.weight * multiplier;
      cues.push(cue.label);
    }
  }

  // Structural signal: an enumerated list with no causal connectives reads as
  // a bare list to memorise, not a process.
  const numberedLines = (haystack.match(/^\s*(\d+[.)]|[-*•])\s+/gm) || []).length;
  if (numberedLines >= 3) {
    if (raw.causal_sequence > 0) raw.causal_sequence += 1.0;
    else raw.arbitrary_fact += 1.0;
    evidenceStrength += 1.0;
    cues.push('an enumerated list');
  }

  // A long comma run with no causal connectives is a roll-call of items to
  // learn, not a process. This is the reactivity series, the cranial nerves,
  // the Mughal emperors — prose-formatted lists that no keyword catches.
  const commaRun = (haystack.match(/,/g) || []).length;
  if (commaRun >= 4 && raw.causal_sequence === 0) {
    raw.arbitrary_fact += 1.5;
    evidenceStrength += 1.5;
    cues.push('a long comma-separated list');
  }

  const nudges = SUBJECT_NUDGE[(unit.subjectSlug || '').toLowerCase()] || {};
  for (const [t, n] of Object.entries(nudges)) {
    raw[t as KnowledgeType] += n as number;
  }

  // Nothing matched at all — fall back to the safest treatment rather than
  // guessing "memorise it".
  const total = KNOWLEDGE_TYPES.reduce((s, t) => s + raw[t], 0);
  if (total === 0) {
    const flat = 1 / KNOWLEDGE_TYPES.length;
    const distribution = Object.fromEntries(
      KNOWLEDGE_TYPES.map((t) => [t, flat]),
    ) as Record<KnowledgeType, number>;
    return {
      unitId: unit.id,
      type: 'concept',
      flavour: null,
      confidence: 0,
      needsEnrichment: true,
      evidenceStrength: 0,
      ambiguous: true,
      runnerUp: null,
      distribution,
      cues: ['no cues matched — defaulting to the safer treatment'],
    };
  }

  const distribution = Object.fromEntries(
    KNOWLEDGE_TYPES.map((t) => [t, raw[t] / total]),
  ) as Record<KnowledgeType, number>;

  const ranked = [...KNOWLEDGE_TYPES].sort((a, b) => distribution[b] - distribution[a]);
  const top = ranked[0];
  const second = ranked[1];
  const margin = distribution[top] - distribution[second];

  // Full confidence needs roughly two solid cues' worth of weight. A single
  // weak cue on a five-word topic title is a hint, not a finding.
  const EVIDENCE_FOR_FULL_CONFIDENCE = 3.0;
  const evidenceFactor = Math.min(1, evidenceStrength / EVIDENCE_FOR_FULL_CONFIDENCE);
  const needsEnrichment = evidenceStrength === 0;

  // Ambiguous when the margin is thin OR when there is no textual evidence at
  // all — a lopsided margin produced entirely by the subject nudge is not a
  // confident classification, it is a confident-looking guess.
  const ambiguous = margin < AMBIGUOUS_MARGIN || needsEnrichment;

  // Safety property (b): under uncertainty, resolve upward in SAFETY_ORDER.
  // With zero textual evidence we keep the subject prior's answer rather than
  // forcing everything to 'judgment' — but we flag it, and confidence is 0, so
  // no caller can mistake it for a real classification.
  const type = margin < AMBIGUOUS_MARGIN && safetyRank(second) > safetyRank(top) ? second : top;

  return {
    unitId: unit.id,
    type,
    flavour: type === 'arbitrary_fact' ? detectFlavour(haystack) : null,
    confidence: Math.min(1, margin / AMBIGUOUS_MARGIN) * evidenceFactor * (margin < AMBIGUOUS_MARGIN ? 0.5 : 1),
    needsEnrichment,
    evidenceStrength,
    ambiguous,
    runnerUp: second,
    distribution,
    cues: needsEnrichment
      ? ['no cues in the text — classified from the subject prior alone; enrich before use']
      : Array.from(new Set(cues)),
  };
}

/**
 * Split a raw chapter into units and classify each one.
 *
 * A chapter is a MIXTURE — this is the whole point. "Chemical Reactions"
 * returns arbitrary_fact for the reactivity series, procedure for balancing,
 * concept for oxidation, causal_sequence for rusting. The Daily Mix then
 * teaches each part with its own converter instead of drilling all four.
 */
export function segmentAndClassify(
  chapterText: string,
  opts: { subjectSlug?: string; classLevel?: number; idPrefix?: string } = {},
): Classification[] {
  const prefix = opts.idPrefix || 'u';
  const blocks = chapterText
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length >= 25);

  return blocks.map((text, i) =>
    classifyUnit({
      id: `${prefix}${i + 1}`,
      text,
      subjectSlug: opts.subjectSlug,
      classLevel: opts.classLevel,
    }),
  );
}

/** Aggregate a chapter's mixture — what proportion of it is each type. */
export function chapterMix(classifications: Classification[]): Record<KnowledgeType, number> {
  const counts = Object.fromEntries(KNOWLEDGE_TYPES.map((t) => [t, 0])) as Record<KnowledgeType, number>;
  for (const c of classifications) counts[c.type] += 1;
  const n = classifications.length || 1;
  for (const t of KNOWLEDGE_TYPES) counts[t] = counts[t] / n;
  return counts;
}

// ============================================================================
// 4. EVIDENCE — how much do we actually know about this student?
// ============================================================================

/**
 * The founder's second point, encoded: a couple of questions is not enough to
 * decide anything. The engine reports what it does not know rather than
 * dressing three observations up as a profile.
 */
export type EvidenceState = 'no_evidence' | 'weak' | 'emerging' | 'established';

export const EVIDENCE_BANDS: Record<EvidenceState, { min: number; label: string }> = {
  no_evidence: { min: 0, label: 'No evidence yet' },
  weak: { min: 1, label: 'Too early to say' },
  emerging: { min: 5, label: 'A pattern is forming' },
  established: { min: 15, label: 'Backed by evidence' },
};

export function evidenceStateFor(observations: number): EvidenceState {
  if (observations >= EVIDENCE_BANDS.established.min) return 'established';
  if (observations >= EVIDENCE_BANDS.emerging.min) return 'emerging';
  if (observations >= EVIDENCE_BANDS.weak.min) return 'weak';
  return 'no_evidence';
}

/**
 * The sentence we are willing to show a parent. Every competitor overclaims
 * here; refusing to is the differentiator. When we DO make a claim at session
 * 40, it is believed.
 */
export function honestStatement(
  observations: number,
  rep: RepresentationCode,
  subjectName: string | undefined,
  knowledgeType: KnowledgeType,
): string {
  const where = `${subjectName || 'this subject'} (${KNOWLEDGE_TYPE_LABEL[knowledgeType].toLowerCase()})`;
  const what = REPRESENTATION_LABEL[rep];
  switch (evidenceStateFor(observations)) {
    case 'no_evidence':
      return `We have not taught this kind of material in ${where} yet. Starting with ${what} because it fits the material, not because we know it fits your child — we will find out.`;
    case 'weak':
      return `Only ${observations} session${observations === 1 ? '' : 's'} of evidence in ${where}. Far too early to call this a learning style — we are still deliberately trying different approaches.`;
    case 'emerging':
      return `Across ${observations} sessions in ${where}, ${what} is looking stronger than the alternatives. Treat this as a working hypothesis, not a conclusion.`;
    case 'established':
      return `Across ${observations} sessions in ${where}, ${what} consistently produces better retention at 7 days. This one we are confident about.`;
  }
}

// ============================================================================
// 4b. SELF-KNOWLEDGE — what the student is told about how she learns
// ============================================================================

export interface SelfInsight {
  subjectName: string;
  knowledgeType: KnowledgeType;
  typeLabel: string;
  representation: RepresentationCode;
  representationLabel: string;
  observations: number;
  evidence: EvidenceState;
  /** 0..1 — retention at the 7-day probe under this representation. */
  retentionRate: number;
  /** Written to the student, in the second person. */
  sentence: string;
}

/**
 * Turn evidence into something the student can actually use.
 *
 * The founder's brief was "the student will know what is the best method to
 * learn any subject". The important correction the Conversion Engine forces
 * is that "per subject" is the wrong grain — it is per subject × KIND of
 * knowledge. "Storytelling works for you in History" is close to useless,
 * because History contains dates, causal chains and essay judgement, and
 * those three do not respond to the same thing. "Your own picture-stories
 * hold the dates; for the essays, comparing sample answers works better" is
 * advice she can act on tomorrow.
 *
 * Only 'emerging' and 'established' evidence produces a claim. Below that the
 * honest output is silence, not a hedge — telling a child "you might be a
 * visual learner" on three data points is how the whole learning-styles
 * industry went wrong.
 */
export function summariseLearningSelf(
  statsBySubject: Array<{ subjectName: string; stats: RepStats[] }>,
  opts: { minEvidence?: EvidenceState } = {},
): { insights: SelfInsight[]; stillLearning: string[] } {
  const floor = opts.minEvidence ?? 'emerging';
  const floorRank = ['no_evidence', 'weak', 'emerging', 'established'].indexOf(floor);

  const insights: SelfInsight[] = [];
  const stillLearning: string[] = [];

  for (const { subjectName, stats } of statsBySubject) {
    const byType = new Map<KnowledgeType, RepStats[]>();
    for (const s of stats) {
      if (!byType.has(s.knowledgeType)) byType.set(s.knowledgeType, []);
      byType.get(s.knowledgeType)!.push(s);
    }

    for (const [type, rows] of byType.entries()) {
      const legal = legalRepresentations(type);
      const usable = rows.filter((r) => legal.includes(r.representation));
      if (usable.length === 0) continue;

      const observations = usable.reduce((n, r) => n + r.attempts, 0);
      const evidence = evidenceStateFor(observations);
      const rank = ['no_evidence', 'weak', 'emerging', 'established'].indexOf(evidence);

      const best = [...usable].sort((a, b) => effectiveness(b) - effectiveness(a))[0];

      if (rank < floorRank) {
        stillLearning.push(
          `${subjectName} — ${KNOWLEDGE_TYPE_LABEL[type].toLowerCase()} (${observations} so far)`,
        );
        continue;
      }

      insights.push({
        subjectName,
        knowledgeType: type,
        typeLabel: KNOWLEDGE_TYPE_LABEL[type],
        representation: best.representation,
        representationLabel: REPRESENTATION_LABEL[best.representation],
        observations,
        evidence,
        retentionRate: best.retentionRate,
        sentence: selfSentence(subjectName, type, best, evidence),
      });
    }
  }

  insights.sort((a, b) => b.observations - a.observations);
  return { insights, stillLearning };
}

function selfSentence(
  subject: string,
  type: KnowledgeType,
  best: RepStats,
  evidence: EvidenceState,
): string {
  const rep = REPRESENTATION_LABEL[best.representation].toLowerCase();
  const pct = Math.round(best.retentionRate * 100);
  const hedge = evidence === 'established' ? '' : ' — still early, but it is holding up so far';

  const what: Record<KnowledgeType, string> = {
    arbitrary_fact: `the facts you have to simply know in ${subject}`,
    causal_sequence: `the chains of cause and effect in ${subject}`,
    concept: `the ideas in ${subject} you have to actually grasp`,
    procedure: `the things you have to be able to DO in ${subject}`,
    relational_structure: `the systems and classifications in ${subject}`,
    judgment: `the questions in ${subject} where you have to weigh things up`,
  };

  return `For ${what[type]}, ${rep} works best for you — ${pct}% of it was still there a week later${hedge}.`;
}

// ============================================================================
// 5. SELECTOR — which legal representation do we actually use?
// ============================================================================

export interface RepStats {
  representation: RepresentationCode;
  knowledgeType: KnowledgeType;
  attempts: number;
  wins: number;
  losses: number;
  /** -1..1 accuracy change against this student's baseline. */
  avgAccuracyDelta: number;
  /** 0..1 — held up at the 7-day check. The single most informative signal. */
  retentionRate: number;
  /** 0..1 — composite of dwell time and interaction density. */
  avgEngagement: number;
  /** 0..1 — did the student finish. */
  completionRate: number;
}

export interface SelectionResult {
  knowledgeType: KnowledgeType;
  representation: RepresentationCode;
  /** Best-known arm, which may differ from `representation` while exploring. */
  bestKnown: RepresentationCode;
  exploring: boolean;
  /** Why we are exploring — coverage sweeps are not the same as bandit jitter. */
  explorationReason: 'none' | 'coverage_sweep' | 'thompson';
  evidence: EvidenceState;
  observations: number;
  candidates: Array<{
    representation: RepresentationCode;
    affinity: number;
    score: number;
    attempts: number;
  }>;
  rationale: string;
}

/** How many observations before personal data outweighs the affinity prior. */
const PERSONAL_WEIGHT_K = 8;

/** Deterministic RNG hook so tests are reproducible. */
export type Rng = () => number;

function effectiveness(s: RepStats): number {
  // Same weighting as method-calibration.ts so the two engines stay comparable:
  // 40% accuracy delta, 25% retention, 20% engagement, 15% completion.
  return clamp(
    0.40 * (0.5 + s.avgAccuracyDelta / 2) +
    0.25 * s.retentionRate +
    0.20 * s.avgEngagement +
    0.15 * s.completionRate,
    0, 1,
  );
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface SelectInput {
  knowledgeType: KnowledgeType;
  subjectName?: string;
  /** This student's stats, already filtered to this knowledge type. */
  stats?: RepStats[];
  /** Cross-student learned priors for the same (subject × type) context, 0..1. */
  globalPriors?: Partial<Record<RepresentationCode, number>>;
  /**
   * Extra offset for the coverage sweep. Normally leave this alone: the sweep
   * advances on how many times we have already taught THIS knowledge type, so
   * it rotates across sessions rather than across units within one chapter.
   */
  sweepOffset?: number;
  /** Opening-move nudge, e.g. flavourBias() — never large enough to beat data. */
  affinityBias?: Partial<Record<RepresentationCode, number>>;
  rng?: Rng;
}

/**
 * Pick a representation.
 *
 * Three regimes, in order:
 *   1. COVERAGE SWEEP (< 5 observations) — round-robin the top-3 legal
 *      representations. With almost no data, a bandit will happily lock onto
 *      whichever arm it happened to pull first. Deliberate spread beats
 *      accidental commitment, and it is the honest answer to "you cannot
 *      decide this from two data points."
 *   2. THOMPSON SAMPLING (>= 5) — sample each legal arm from its Beta
 *      posterior; wide posteriors explore themselves.
 *   3. Illegal arms are excluded at every stage. This is not a soft penalty.
 */
export function selectRepresentation(input: SelectInput): SelectionResult {
  const { knowledgeType, subjectName, sweepOffset = 0 } = input;
  const rng = input.rng || Math.random;
  const stats = input.stats || [];
  const globalPriors = input.globalPriors || {};
  const bias = input.affinityBias || {};

  const legal = legalRepresentations(knowledgeType);
  const statMap = new Map<RepresentationCode, RepStats>();
  for (const s of stats) {
    if (s.knowledgeType === knowledgeType && legal.includes(s.representation)) {
      statMap.set(s.representation, s);
    }
  }

  const observations = Array.from(statMap.values()).reduce((n, s) => n + s.attempts, 0);
  const evidence = evidenceStateFor(observations);

  // Blended score per legal arm: affinity prior → global prior → personal data.
  const candidates = legal.map((rep) => {
    const s = statMap.get(rep);
    const attempts = s?.attempts ?? 0;
    // The flavour nudge shifts the ranking inside a family (list → Link,
    // number → Peg, term → Substitute Word) without ever crossing the gate:
    // affinity itself is untouched, so legality is unaffected.
    const affinity = affinityFor(knowledgeType, rep);
    const biasedAffinity = clamp(affinity + (bias[rep] ?? 0), 0, 1);
    const globalPrior = globalPriors[rep];

    // The prior itself is a blend of "does this fit the material" and "what has
    // worked for comparable students".
    const prior = globalPrior != null ? 0.5 * biasedAffinity + 0.5 * globalPrior : biasedAffinity;

    const personal = s ? effectiveness(s) : prior;
    const w = attempts / (attempts + PERSONAL_WEIGHT_K);
    const score = w * personal + (1 - w) * prior;

    return { representation: rep, affinity, score, attempts, stats: s, prior };
  });

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const bestKnown = sorted[0].representation;

  let chosen: RepresentationCode;
  let explorationReason: SelectionResult['explorationReason'];

  if (observations < EVIDENCE_BANDS.emerging.min) {
    // Regime 1 — deliberate coverage of the top-3 legal options.
    //
    // The sweep advances on `observations` — how many times we have already
    // taught THIS knowledge type — so the FIRST encounter always gets the
    // best-fitting representation and later sessions rotate. Driving it off a
    // global session counter instead would hand a brand-new student the 2nd-
    // and 3rd-best treatment for the later units of their very first chapter.
    const sweep = sorted.slice(0, Math.min(3, sorted.length));
    chosen = sweep[(observations + sweepOffset) % sweep.length].representation;
    explorationReason = chosen === bestKnown ? 'none' : 'coverage_sweep';
  } else {
    // Regime 2 — Thompson sampling over legal arms only.
    let bestSample = -Infinity;
    chosen = bestKnown;
    for (const c of candidates) {
      const priorStrength = 3;
      const alpha = (c.stats?.wins ?? 0) + priorStrength * c.prior + 1;
      const beta = (c.stats?.losses ?? 0) + priorStrength * (1 - c.prior) + 1;
      const sample = sampleBeta(alpha, beta, rng);
      if (sample > bestSample) {
        bestSample = sample;
        chosen = c.representation;
      }
    }
    explorationReason = chosen === bestKnown ? 'none' : 'thompson';
  }

  const rationale = buildRationale(
    knowledgeType, chosen, bestKnown, observations, evidence,
    explorationReason, subjectName,
  );

  return {
    knowledgeType,
    representation: chosen,
    bestKnown,
    exploring: chosen !== bestKnown,
    explorationReason,
    evidence,
    observations,
    candidates: candidates.map((c) => ({
      representation: c.representation,
      affinity: c.affinity,
      score: c.score,
      attempts: c.attempts,
    })),
    rationale,
  };
}

function buildRationale(
  type: KnowledgeType,
  chosen: RepresentationCode,
  best: RepresentationCode,
  observations: number,
  evidence: EvidenceState,
  reason: SelectionResult['explorationReason'],
  subjectName?: string,
): string {
  const typeLabel = KNOWLEDGE_TYPE_LABEL[type].toLowerCase();
  const article = /^[aeiou]/.test(typeLabel) ? 'an' : 'a';
  const chosenLabel = REPRESENTATION_LABEL[chosen];
  const where = subjectName ? ` in ${subjectName}` : '';
  const obs = `${observations} observation${observations === 1 ? '' : 's'}`;

  if (reason === 'coverage_sweep') {
    return `This is ${article} ${typeLabel}. Only ${obs} so far${where}, so we are deliberately rotating through the approaches that suit this material — trying ${chosenLabel} to see how it lands. We are not guessing a learning style from this little data.`;
  }
  if (reason === 'thompson') {
    return `This is ${article} ${typeLabel}. ${REPRESENTATION_LABEL[best]} leads so far across ${obs}${where}, but ${chosenLabel} is close enough that it is worth another look.`;
  }
  if (evidence === 'established') {
    return `This is ${article} ${typeLabel}, and across ${obs}${where} ${chosenLabel} has consistently held up best at the 7-day check.`;
  }
  return `This is ${article} ${typeLabel}, so we are using ${chosenLabel} — the approach that fits this kind of material. ${obs} so far${where}: not yet enough to call it personal.`;
}

// --- Beta sampling (Marsaglia & Tsang gamma), injectable RNG for tests ------

function sampleBeta(alpha: number, beta: number, rng: Rng): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  return x + y === 0 ? 0.5 : x / (x + y);
}

function sampleGamma(shape: number, rng: Rng): number {
  if (shape < 1) return sampleGamma(shape + 1, rng) * Math.pow(rng(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let guard = 0; guard < 1000; guard++) {
    let x = 0;
    let v = 0;
    do {
      x = randn(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d; // guard fallback — never hit in practice
}

function randn(rng: Rng): number {
  const u = 1 - rng();
  const v = 1 - rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ============================================================================
// 6. PLAN — the actual instruction handed to the companion
// ============================================================================

export interface ConversionPlan {
  unitId: string;
  knowledgeType: KnowledgeType;
  representation: RepresentationCode;
  /** What the companion is told to DO. Goes into the system prompt. */
  companionInstruction: string;
  /** What the student is asked. Always construction, never delivery. */
  studentPrompt: string;
  /** The check that proves it worked — deliberately not "did you like it?" */
  checkQuestion: string;
  /** Days until the retention probe that resolves this into evidence. */
  retentionProbeDays: number;
  selection: SelectionResult;
  classification: Classification;
}

/**
 * Construction, not delivery.
 *
 * Lorayne's own finding, and the reason this matters commercially: a mnemonic
 * you were HANDED works at roughly half the strength of one you BUILT. The
 * encoding happens during the making. So every template below asks the student
 * to produce the image, the chain, the counter-example — the companion only
 * prompts and reacts.
 *
 * This is also why a competitor cannot copy this by scraping our content:
 * the valuable artefact is generated inside the student, not stored on a CDN.
 */
const TEMPLATES: Record<RepresentationCode, {
  companion: string;
  student: (subject: string) => string;
  check: string;
  probeDays: number;
}> = {
  mnemonic_link: {
    companion: 'Do NOT supply the story. Name the items in order, then ask the student to chain them into one absurd moving picture, applying the four rules: out of proportion, exaggerated quantity, substitution, action. React to whatever they invent; make it MORE ridiculous rather than more sensible.',
    student: (s) => `Picture the first item in ${s}. Now make it do something ridiculous to the second — far too big, far too many, or in the wrong place entirely. Keep it moving. Tell me what you see.`,
    check: 'Recall the items in order, from your own picture, without looking.',
    probeDays: 7,
  },
  mnemonic_peg: {
    companion: 'Convert the digits to consonant sounds using the Major system (1=t/d 2=n 3=m 4=r 5=l 6=j/sh 7=k/g 8=f/v 9=p/b 0=s/z), but let the STUDENT find the word. Offer the sounds, not the answer.',
    student: (s) => `These digits in ${s} turn into sounds. What word could those sounds make? Any word you can picture will do — the sillier the better.`,
    check: 'Give the number back from the picture, and the picture back from the number.',
    probeDays: 7,
  },
  mnemonic_substitute: {
    companion: 'Ask the student to find a concrete sound-alike for the term before you offer one. Only if they stall, give two options and let them choose. Then link the sound-alike to the actual meaning in one image.',
    student: (s) => `Say this ${s} term out loud. What everyday thing does it sound like? Now put that thing together with what the word actually means, in one picture.`,
    check: 'Use the term correctly in a sentence you make up yourself.',
    probeDays: 7,
  },
  causal_chain: {
    companion: 'Present the steps as a chain of forced consequences. After each step ask "so what had to happen next?" BEFORE revealing it. Never let the student memorise the order without stating the mechanism.',
    student: (s) => `Here is where this ${s} process starts. Given only this, what has to happen next — and why can it not happen the other way round?`,
    check: 'Explain what breaks downstream if one named step is removed.',
    probeDays: 10,
  },
  contrast_set: {
    companion: 'Give one clear example, then near-misses that fail for ONE reason each. Ask the student to say which side of the line each falls on and why. The boundary is the lesson; the definition is only a summary of it.',
    student: (s) => `This one counts as the ${s} idea. This next one is very close but does not count. What is the single difference that decides it?`,
    check: 'Invent your own borderline case and say which side it falls on.',
    probeDays: 10,
  },
  worked_example_faded: {
    companion: 'Show one fully worked example. Then the same problem with the final step blank, then the last two blank, then none given. Never remove more than one support at a time. If they stall, restore the previous level silently.',
    student: (s) => `Watch this ${s} one all the way through. Now the same kind, but you take the last step.`,
    check: 'Complete a fresh problem of the same type with no scaffolding.',
    probeDays: 7,
  },
  spatial_map: {
    companion: 'Have the student place the items themselves — grid, axis, tree, or web — before you correct anything. Where they PUT something reveals what they think it relates to. Ask about the gaps.',
    student: (s) => `Lay these ${s} items out so that things which belong together sit together. Where does each one go, and what does the space between them mean?`,
    check: 'Predict where an unseen item belongs on your map, and defend the position.',
    probeDays: 14,
  },
  exemplar_comparison: {
    companion: 'Show three samples of clearly different quality WITHOUT labelling them. The student ranks first and justifies. Only then reveal the marks and discuss where their criteria matched the marker.',
    student: (s) => `Three ${s} samples. Rank them best to worst before I say anything — then tell me what made you put the top one first.`,
    check: 'Apply your own stated criteria to a fourth unseen sample.',
    probeDays: 14,
  },
  analogy_bridge: {
    companion: 'Map the new idea onto something the student already knows well (use their logged interests). Critically: ALWAYS finish by asking where the analogy breaks down. An unbroken analogy becomes a misconception.',
    student: (s) => `This ${s} idea works a lot like something you already know. Once you see the match — tell me where the comparison stops being true.`,
    check: 'State one thing the analogy gets right and one it gets wrong.',
    probeDays: 10,
  },
  dual_coding: {
    companion: 'Pair the words with a diagram the student draws themselves, however rough. Do not supply the visual first — a drawn-then-corrected sketch encodes far better than a viewed one.',
    student: (s) => `Draw this ${s} idea — badly is fine. Then label it in your own words, not the textbook words.`,
    check: 'Redraw it from memory and explain each label.',
    probeDays: 7,
  },
};

export function buildConversionPlan(
  classification: Classification,
  selection: SelectionResult,
  subjectName?: string,
): ConversionPlan {
  const t = TEMPLATES[selection.representation];
  const subject = subjectName || 'this';

  return {
    unitId: classification.unitId,
    knowledgeType: classification.type,
    representation: selection.representation,
    companionInstruction: t.companion,
    studentPrompt: t.student(subject),
    checkQuestion: t.check,
    retentionProbeDays: t.probeDays,
    selection,
    classification,
  };
}

/**
 * End-to-end: raw chapter text in, a per-unit teaching plan out.
 *
 * `sessionIndex` is threaded through so the early coverage sweep advances
 * across units rather than picking the same arm for the whole chapter.
 */
export function planChapter(
  chapterText: string,
  opts: {
    subjectSlug?: string;
    subjectName?: string;
    classLevel?: number;
    statsByType?: Partial<Record<KnowledgeType, RepStats[]>>;
    globalPriorsByType?: Partial<Record<KnowledgeType, Partial<Record<RepresentationCode, number>>>>;
    rng?: Rng;
  } = {},
): { plans: ConversionPlan[]; mix: Record<KnowledgeType, number> } {
  const classifications = segmentAndClassify(chapterText, {
    subjectSlug: opts.subjectSlug,
    classLevel: opts.classLevel,
  });

  const plans = classifications.map((c) => {
    const selection = selectRepresentation({
      knowledgeType: c.type,
      subjectName: opts.subjectName,
      stats: opts.statsByType?.[c.type],
      globalPriors: opts.globalPriorsByType?.[c.type],
      affinityBias: flavourBias(c),
      rng: opts.rng,
    });
    return buildConversionPlan(c, selection, opts.subjectName);
  });

  return { plans, mix: chapterMix(classifications) };
}

// ============================================================================
// 7. CONTEXT KEY — so learned priors are keyed by knowledge type too
// ============================================================================

/**
 * self-learning.ts keys global priors as `subject|class|band|mood`, which
 * cannot distinguish "storytelling worked for the dates" from "storytelling
 * worked for the concepts". This adds the missing axis.
 *
 * Deliberately a separate function rather than a change to `contextKeyFor`, so
 * existing accumulated priors are not invalidated.
 */
export function conversionContextKey(params: {
  subjectName?: string;
  knowledgeType: KnowledgeType;
  classBand?: 'primary' | 'middle' | 'senior';
  maturityBand?: number;
}): string {
  const subj = (params.subjectName || 'any').toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
  const cls = params.classBand || 'any';
  const band = params.maturityBand != null ? `b${params.maturityBand}` : 'b?';
  return `${subj}|${cls}|${band}|kt:${params.knowledgeType}`;
}

// ============================================================================
// 8. OUTCOME → REWARD
// ============================================================================

export interface ConversionOutcome {
  unitId: string;
  knowledgeType: KnowledgeType;
  representation: RepresentationCode;
  /** Did the student produce their own artefact (image/chain/counter-example)? */
  constructedOwn: boolean;
  /** Immediate post-check, 0..1. */
  immediateScore: number;
  /** The probe that actually matters. Null until the probe fires. */
  retentionScore?: number | null;
  engagementScore: number;
  completed: boolean;
  timeSpentSeconds: number;
}

/**
 * Reward for the experience log.
 *
 * Retention dominates when we have it, because it is the only signal that
 * distinguishes real learning from a pleasant session. Until the probe fires
 * the reward is provisional and weighted down — this is what stops the system
 * concluding anything from a single enjoyable lesson.
 */
export function rewardFor(outcome: ConversionOutcome): { reward: number; provisional: boolean } {
  const construction = outcome.constructedOwn ? 1 : 0.5;

  if (outcome.retentionScore == null) {
    const provisionalReward = clamp(
      0.55 * outcome.immediateScore +
      0.25 * outcome.engagementScore +
      0.20 * (outcome.completed ? 1 : 0),
      0, 1,
    ) * construction;
    // Pulled toward the neutral 0.5 — an unresolved outcome is weak evidence.
    return { reward: 0.5 + (provisionalReward - 0.5) * 0.4, provisional: true };
  }

  const reward = clamp(
    0.50 * outcome.retentionScore +
    0.25 * outcome.immediateScore +
    0.15 * outcome.engagementScore +
    0.10 * (outcome.completed ? 1 : 0),
    0, 1,
  ) * construction;

  return { reward, provisional: false };
}
