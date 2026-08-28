import { describe, it, expect } from 'vitest';
import {
  classifyUnit,
  segmentAndClassify,
  chapterMix,
  legalRepresentations,
  affinityFor,
  selectRepresentation,
  buildConversionPlan,
  planChapter,
  flavourBias,
  evidenceStateFor,
  honestStatement,
  conversionContextKey,
  rewardFor,
  MIN_AFFINITY,
  KNOWLEDGE_TYPES,
  REPRESENTATIONS,
  type RepStats,
  type KnowledgeType,
  type RepresentationCode,
} from '../conversion-engine';

// Deterministic RNG so bandit tests are reproducible.
function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function stats(
  knowledgeType: KnowledgeType,
  representation: RepresentationCode,
  over: Partial<RepStats> = {},
): RepStats {
  return {
    representation,
    knowledgeType,
    attempts: 10,
    wins: 8,
    losses: 2,
    avgAccuracyDelta: 0.4,
    retentionRate: 0.8,
    avgEngagement: 0.7,
    completionRate: 0.9,
    ...over,
  };
}

// ===========================================================================
// Classification
// ===========================================================================

describe('classifyUnit', () => {
  it('reads a date-bearing history line as an arbitrary fact', () => {
    const c = classifyUnit({
      id: 'u1',
      text: 'The Indian National Congress was founded in 1885 at Bombay.',
      subjectSlug: 'history',
    });
    expect(c.type).toBe('arbitrary_fact');
  });

  it('reads a causal process as a causal sequence, not a list to memorise', () => {
    const c = classifyUnit({
      id: 'u2',
      text: 'In the process of digestion, food first enters the stomach. Gastric juice then breaks down proteins, which leads to the formation of chyme. This results in absorption in the small intestine.',
      subjectSlug: 'life_science',
    });
    expect(c.type).toBe('causal_sequence');
  });

  it('reads a definition as a concept', () => {
    const c = classifyUnit({
      id: 'u3',
      text: 'Inertia is defined as the tendency of a body to resist a change in its state of motion. Explain why a passenger lurches forward when a bus stops.',
      subjectSlug: 'physical_science',
    });
    expect(c.type).toBe('concept');
  });

  it('reads a task instruction as a procedure', () => {
    const c = classifyUnit({
      id: 'u4',
      text: 'Solve the quadratic equation 2x^2 + 5x - 3 = 0 by factorising. Substitute the values and simplify to find the value of x.',
      subjectSlug: 'math',
    });
    expect(c.type).toBe('procedure');
  });

  it('reads classification content as a relational structure', () => {
    const c = classifyUnit({
      id: 'u5',
      text: 'Classification of plants into groups. The types of tissue and the categories they belong to. Study the relationship between the family and the hierarchy shown in the table.',
      subjectSlug: 'life_science',
    });
    expect(c.type).toBe('relational_structure');
  });

  it('reads an evaluative prompt as judgment', () => {
    const c = classifyUnit({
      id: 'u6',
      text: 'Critically evaluate the significance of the Salt March. Do you agree that it was the turning point? Justify your answer.',
      subjectSlug: 'history',
    });
    expect(c.type).toBe('judgment');
  });

  it('returns a full distribution that sums to 1', () => {
    const c = classifyUnit({ id: 'u7', text: 'Solve and define and discuss the cycle of 1947.' });
    const sum = KNOWLEDGE_TYPES.reduce((s, t) => s + c.distribution[t], 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('records the cues that fired so a teacher can audit the decision', () => {
    const c = classifyUnit({ id: 'u8', text: 'Calculate the value of x. Show your work.' });
    expect(c.cues.length).toBeGreaterThan(0);
  });

  it('falls back to the safer treatment when nothing matches', () => {
    const c = classifyUnit({ id: 'u9', text: 'aaaa bbbb cccc dddd eeee ffff gggg hhhh' });
    expect(c.type).toBe('concept');
    expect(c.ambiguous).toBe(true);
    expect(c.confidence).toBe(0);
  });

  it('subject nudges never override what the text plainly says', () => {
    // Maths nudges 'procedure', but this text is plainly a definition.
    const c = classifyUnit({
      id: 'u10',
      text: 'A prime number is defined as a natural number greater than 1 with no positive divisors other than 1 and itself. The concept of primality refers to indivisibility.',
      subjectSlug: 'math',
    });
    expect(c.type).toBe('concept');
  });
});

// ===========================================================================
// SAFETY PROPERTY (b) — ambiguity resolves upward
// ===========================================================================

describe('safety: ambiguity resolves toward the more expensive treatment', () => {
  it('never silently downgrades a near-tie into rote memorisation', () => {
    // Deliberately mixed: a definition sitting next to a date.
    const c = classifyUnit({
      id: 'amb',
      text: 'Nationalism is defined as devotion to one nation. It is called swadeshi. In 1905 the term was used widely.',
    });
    if (c.ambiguous && c.runnerUp) {
      const order = ['arbitrary_fact', 'causal_sequence', 'relational_structure', 'procedure', 'concept', 'judgment'];
      expect(order.indexOf(c.type)).toBeGreaterThanOrEqual(
        Math.min(order.indexOf(c.type), order.indexOf(c.runnerUp)),
      );
    }
    // Whatever else happens, an ambiguous unit must not land on arbitrary_fact
    // when a costlier type was in contention.
    if (c.ambiguous && c.runnerUp && c.runnerUp !== 'arbitrary_fact') {
      expect(c.type).not.toBe('arbitrary_fact');
    }
  });
});

// ===========================================================================
// SAFETY PROPERTY (a) — illegal representations are never reachable
// ===========================================================================

describe('safety: the gate on representations', () => {
  it('excludes memorisation representations from concepts', () => {
    const legal = legalRepresentations('concept');
    expect(legal).not.toContain('mnemonic_link');
    expect(legal).not.toContain('mnemonic_peg');
  });

  it('excludes memorisation representations from judgment', () => {
    const legal = legalRepresentations('judgment');
    expect(legal).not.toContain('mnemonic_link');
    expect(legal).not.toContain('mnemonic_peg');
    expect(legal).not.toContain('mnemonic_substitute');
  });

  it('keeps faded worked examples out of pure fact recall', () => {
    expect(legalRepresentations('arbitrary_fact')).not.toContain('worked_example_faded');
  });

  it('every legal representation clears MIN_AFFINITY', () => {
    for (const t of KNOWLEDGE_TYPES) {
      for (const r of legalRepresentations(t)) {
        expect(affinityFor(t, r)).toBeGreaterThanOrEqual(MIN_AFFINITY);
      }
    }
  });

  it('every knowledge type has at least two legal options to choose between', () => {
    for (const t of KNOWLEDGE_TYPES) {
      expect(legalRepresentations(t).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('exploration cannot escape the gate even when the data screams for it', () => {
    // Fabricate overwhelming evidence that rote memorisation "works" for concepts.
    const rigged: RepStats[] = [
      stats('concept', 'mnemonic_link', { attempts: 500, wins: 500, losses: 0, retentionRate: 1, avgAccuracyDelta: 1, avgEngagement: 1, completionRate: 1 }),
      stats('concept', 'mnemonic_peg', { attempts: 500, wins: 500, losses: 0, retentionRate: 1, avgAccuracyDelta: 1, avgEngagement: 1, completionRate: 1 }),
    ];
    for (let seed = 1; seed <= 50; seed++) {
      const sel = selectRepresentation({
        knowledgeType: 'concept',
        stats: rigged,
        sweepOffset: seed,
        rng: seededRng(seed),
      });
      expect(sel.representation).not.toBe('mnemonic_link');
      expect(sel.representation).not.toBe('mnemonic_peg');
      expect(affinityFor('concept', sel.representation)).toBeGreaterThanOrEqual(MIN_AFFINITY);
    }
  });

  it('holds the gate across every type and every seed', () => {
    for (const t of KNOWLEDGE_TYPES) {
      const rigged = REPRESENTATIONS.map((r) =>
        stats(t, r, { attempts: 100, wins: 100, losses: 0, retentionRate: 1 }),
      );
      for (let seed = 1; seed <= 20; seed++) {
        const sel = selectRepresentation({ knowledgeType: t, stats: rigged, sweepOffset: seed, rng: seededRng(seed) });
        expect(affinityFor(t, sel.representation)).toBeGreaterThanOrEqual(MIN_AFFINITY);
      }
    }
  });
});

// ===========================================================================
// Evidence honesty — the founder's second point
// ===========================================================================

describe('evidence banding', () => {
  it('bands observation counts honestly', () => {
    expect(evidenceStateFor(0)).toBe('no_evidence');
    expect(evidenceStateFor(2)).toBe('weak');
    expect(evidenceStateFor(4)).toBe('weak');
    expect(evidenceStateFor(5)).toBe('emerging');
    expect(evidenceStateFor(14)).toBe('emerging');
    expect(evidenceStateFor(15)).toBe('established');
    expect(evidenceStateFor(60)).toBe('established');
  });

  it('refuses to claim a learning style from a couple of observations', () => {
    const s = honestStatement(2, 'causal_chain', 'History', 'causal_sequence');
    expect(s).toMatch(/too early/i);
  });

  it('says plainly that it knows nothing at zero observations', () => {
    const s = honestStatement(0, 'contrast_set', 'Science', 'concept');
    expect(s).toMatch(/not.*yet|no.*evidence/i);
  });

  it('only becomes confident once evidence is established', () => {
    const s = honestStatement(30, 'contrast_set', 'Science', 'concept');
    expect(s).toMatch(/confident/i);
  });
});

describe('selection under thin evidence', () => {
  it('reports no_evidence and sweeps rather than pretending to know', () => {
    const sel = selectRepresentation({ knowledgeType: 'arbitrary_fact', sweepOffset: 0, rng: seededRng(1) });
    expect(sel.evidence).toBe('no_evidence');
    expect(sel.observations).toBe(0);
    expect(sel.rationale).toMatch(/not guessing|fits this kind of material|rotating/i);
  });

  it('spreads the first sessions across candidates instead of locking on', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      seen.add(selectRepresentation({
        knowledgeType: 'arbitrary_fact',
        sweepOffset: i,
        rng: seededRng(7),
      }).representation);
    }
    // A naive bandit would return the same arm every time here.
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('labels early spread as a coverage sweep, not bandit jitter', () => {
    const results = [0, 1, 2].map((i) =>
      selectRepresentation({ knowledgeType: 'concept', sweepOffset: i, rng: seededRng(3) }),
    );
    expect(results.some((r) => r.explorationReason === 'coverage_sweep')).toBe(true);
    expect(results.every((r) => r.explorationReason !== 'thompson')).toBe(true);
  });

  it('switches to Thompson sampling once evidence accumulates', () => {
    const withData = REPRESENTATIONS
      .filter((r) => affinityFor('procedure', r) >= MIN_AFFINITY)
      .map((r) => stats('procedure', r, { attempts: 6 }));
    const sel = selectRepresentation({
      knowledgeType: 'procedure',
      stats: withData,
      sweepOffset: 0,
      rng: seededRng(11),
    });
    expect(sel.evidence).not.toBe('no_evidence');
    expect(sel.explorationReason).not.toBe('coverage_sweep');
  });

  it('lets strong personal evidence overtake the affinity prior', () => {
    // analogy_bridge is legal for concepts but ranks below contrast_set by prior.
    const strong: RepStats[] = [
      stats('concept', 'analogy_bridge', { attempts: 40, wins: 38, losses: 2, retentionRate: 0.95, avgAccuracyDelta: 0.8 }),
      stats('concept', 'contrast_set', { attempts: 40, wins: 8, losses: 32, retentionRate: 0.2, avgAccuracyDelta: -0.5, avgEngagement: 0.2, completionRate: 0.3 }),
    ];
    const sel = selectRepresentation({ knowledgeType: 'concept', stats: strong, rng: seededRng(5) });
    expect(sel.bestKnown).toBe('analogy_bridge');
  });
});

// ===========================================================================
// Confidence must measure EVIDENCE, not just margin
// ===========================================================================

describe('confidence reflects textual evidence, not the subject prior', () => {
  // These are verbatim rows from migration 030 — syllabus outline, not prose.
  const outlineRows: Array<[string, string, string]> = [
    ['Recognising a quadratic', 'Standard form, identifying a, b, c.', 'math'],
    ['Quadratic formula', 'Discriminant, roots, nature.', 'math'],
    ['Reflection', 'Laws of reflection, plane mirrors.', 'physical_science'],
    ['Spherical mirrors', 'Concave/convex; image formation.', 'physical_science'],
  ];

  it('never reports high confidence for a row where no cue fired', () => {
    for (const [title, obj, slug] of outlineRows) {
      const c = classifyUnit({ id: title, title, text: obj, subjectSlug: slug });
      if (c.evidenceStrength === 0) {
        expect(c.confidence).toBe(0);
        expect(c.needsEnrichment).toBe(true);
        expect(c.ambiguous).toBe(true);
      }
    }
  });

  it('flags outline-only content as needing enrichment', () => {
    const c = classifyUnit({
      id: 'q',
      title: 'Quadratic formula',
      text: 'Discriminant, roots, nature.',
      subjectSlug: 'math',
    });
    expect(c.needsEnrichment).toBe(true);
    expect(c.cues.join(' ')).toMatch(/enrich/i);
  });

  it('still reports real confidence once there is prose to read', () => {
    const c = classifyUnit({
      id: 'prose',
      text: 'Solve the quadratic equation by factorising. Substitute the values, rearrange and simplify to find the value of x. Show your work.',
      subjectSlug: 'math',
    });
    expect(c.needsEnrichment).toBe(false);
    expect(c.evidenceStrength).toBeGreaterThan(0);
    expect(c.confidence).toBeGreaterThan(0.5);
  });

  it('a single weak cue does not buy full confidence', () => {
    const c = classifyUnit({ id: 'thin', text: 'The table below shows the values.' });
    expect(c.confidence).toBeLessThan(1);
  });

  it('confidence stays within 0..1 across a wide range of inputs', () => {
    const samples = [
      'Solve for x.',
      'Critically evaluate and justify, discuss and assess to what extent this holds.',
      'In 1947, 1885, 1919, 1930 and 1942 the following happened.',
      '',
      'aaaa bbbb',
    ];
    for (const s of samples) {
      const c = classifyUnit({ id: 's', text: s });
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ===========================================================================
// Fact flavour — the right Lorayne tool for the right kind of fact
// ===========================================================================

describe('fact flavour', () => {
  it('reads an ordered list as a list, not a term', () => {
    const c = classifyUnit({
      id: 'f1',
      text: 'The reactivity series lists the metals in order: potassium, sodium, calcium, magnesium, aluminium, zinc, iron, lead, copper.',
      subjectSlug: 'physical_science',
    });
    expect(c.type).toBe('arbitrary_fact');
    expect(c.flavour).toBe('list');
  });

  it('reads a date as a number', () => {
    const c = classifyUnit({ id: 'f2', text: 'The Congress was founded in 1885. This date is a key fact.', subjectSlug: 'history' });
    expect(c.flavour).toBe('number');
  });

  it('reads a lone vocabulary item as a term', () => {
    const c = classifyUnit({ id: 'f3', text: 'The word meaning of ephemeral. Give a synonym for this word in the exam.', subjectSlug: 'english' });
    expect(c.flavour).toBe('term');
  });

  it('leaves flavour null for non-fact types', () => {
    const c = classifyUnit({ id: 'f4', text: 'Critically evaluate and justify whether this policy succeeded.' });
    expect(c.flavour).toBeNull();
  });

  it('sends a list to the Link and a number to the Peg', () => {
    const list = classifyUnit({
      id: 'f5',
      text: 'Learn the list of names in order: potassium, sodium, calcium, magnesium, aluminium, zinc.',
      subjectSlug: 'physical_science',
    });
    const num = classifyUnit({ id: 'f6', text: 'Independence came in 1947 and partition in 1947 too.', subjectSlug: 'history' });

    const listPick = selectRepresentation({ knowledgeType: 'arbitrary_fact', affinityBias: flavourBias(list), rng: seededRng(1) });
    const numPick = selectRepresentation({ knowledgeType: 'arbitrary_fact', affinityBias: flavourBias(num), rng: seededRng(1) });

    expect(listPick.representation).toBe('mnemonic_link');
    expect(numPick.representation).toBe('mnemonic_peg');
  });

  it('the flavour nudge can never push an arm through the gate', () => {
    // A huge bias on an illegal arm must still be rejected.
    const sel = selectRepresentation({
      knowledgeType: 'judgment',
      affinityBias: { mnemonic_link: 10, mnemonic_peg: 10 },
      rng: seededRng(2),
    });
    expect(sel.representation).not.toBe('mnemonic_link');
    expect(sel.representation).not.toBe('mnemonic_peg');
  });
});

// ===========================================================================
// Coverage sweep ordering
// ===========================================================================

describe('coverage sweep ordering', () => {
  it('gives the best-fitting treatment on the FIRST encounter with a type', () => {
    // Zero observations must mean canonical treatment, not arm 2 of a rotation.
    expect(selectRepresentation({ knowledgeType: 'procedure', rng: seededRng(1) }).representation)
      .toBe('worked_example_faded');
    expect(selectRepresentation({ knowledgeType: 'concept', rng: seededRng(1) }).representation)
      .toBe('contrast_set');
    expect(selectRepresentation({ knowledgeType: 'judgment', rng: seededRng(1) }).representation)
      .toBe('exemplar_comparison');
    expect(selectRepresentation({ knowledgeType: 'relational_structure', rng: seededRng(1) }).representation)
      .toBe('spatial_map');
    expect(selectRepresentation({ knowledgeType: 'causal_sequence', rng: seededRng(1) }).representation)
      .toBe('causal_chain');
  });

  it('rotates on the SECOND and THIRD encounters, not within one chapter', () => {
    const seen = [0, 1, 2].map((n) =>
      selectRepresentation({
        knowledgeType: 'concept',
        stats: [stats('concept', 'contrast_set', { attempts: n })],
        rng: seededRng(1),
      }).representation,
    );
    expect(seen[0]).toBe('contrast_set');
    expect(new Set(seen).size).toBeGreaterThanOrEqual(2);
  });

  it('every unit of a first chapter still gets its own best-fit treatment', () => {
    const chapter = [
      'Solve the equation 3x + 2 = 11. Substitute and simplify to find the value of x.',
      'Democracy is defined as rule by the people. Explain why consent matters.',
      'Critically evaluate whether the reform succeeded. Justify your answer.',
    ].join('\n\n');
    const { plans } = planChapter(chapter, { subjectName: 'Civics', rng: seededRng(1) });
    const byType = new Map(plans.map((p) => [p.knowledgeType, p.representation]));
    // No unit is penalised for its position in the chapter.
    if (byType.has('procedure')) expect(byType.get('procedure')).toBe('worked_example_faded');
    if (byType.has('concept')) expect(byType.get('concept')).toBe('contrast_set');
    if (byType.has('judgment')) expect(byType.get('judgment')).toBe('exemplar_comparison');
  });
});

// ===========================================================================
// Segmentation — a chapter is a mixture
// ===========================================================================

describe('segmentAndClassify', () => {
  const chapter = [
    'The reactivity series lists the metals in order: potassium, sodium, calcium, magnesium, aluminium, zinc, iron, lead, copper, silver, gold. Learn the list of names in order.',
    'Balance the following chemical equation. Substitute the coefficients and simplify until both sides match. Solve for the missing value.',
    'Oxidation is defined as the loss of electrons. The concept of oxidation refers to a change in oxidation state. Explain why this is not the same as reacting with oxygen.',
    'Rusting is a slow process. Iron reacts with oxygen and water, which leads to hydrated iron oxide. This results in flaking, which then exposes fresh metal.',
  ].join('\n\n');

  it('classifies each block on its own terms', () => {
    const cs = segmentAndClassify(chapter, { subjectSlug: 'physical_science' });
    expect(cs.length).toBe(4);
    expect(cs[1].type).toBe('procedure');
    expect(cs[2].type).toBe('concept');
    expect(cs[3].type).toBe('causal_sequence');
  });

  it('finds more than one knowledge type in a single chapter', () => {
    const cs = segmentAndClassify(chapter, { subjectSlug: 'physical_science' });
    expect(new Set(cs.map((c) => c.type)).size).toBeGreaterThanOrEqual(3);
  });

  it('reports the mixture as proportions summing to 1', () => {
    const mix = chapterMix(segmentAndClassify(chapter, { subjectSlug: 'physical_science' }));
    const sum = KNOWLEDGE_TYPES.reduce((s, t) => s + mix[t], 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('drops fragments too short to classify', () => {
    expect(segmentAndClassify('short\n\nalso short').length).toBe(0);
  });
});

// ===========================================================================
// Plans
// ===========================================================================

describe('buildConversionPlan', () => {
  it('produces a construction prompt, never a delivered answer', () => {
    const c = classifyUnit({ id: 'p1', text: 'The Congress was founded in 1885.', subjectSlug: 'history' });
    const sel = selectRepresentation({ knowledgeType: c.type, sweepOffset: 0, rng: seededRng(2) });
    const plan = buildConversionPlan(c, sel, 'History');
    expect(plan.companionInstruction.length).toBeGreaterThan(20);
    expect(plan.studentPrompt.length).toBeGreaterThan(20);
    expect(plan.checkQuestion.length).toBeGreaterThan(10);
    expect(plan.retentionProbeDays).toBeGreaterThan(0);
  });

  it('tells the companion not to hand over the mnemonic', () => {
    const c = classifyUnit({ id: 'p2', text: 'Learn the list of names of the metals in order.', subjectSlug: 'physical_science' });
    const sel = selectRepresentation({ knowledgeType: 'arbitrary_fact', sweepOffset: 0, rng: seededRng(4) });
    const plan = buildConversionPlan(c, sel, 'Science');
    expect(plan.companionInstruction).toMatch(/NOT supply|let the STUDENT|before you offer|find a concrete/i);
  });

  it('checks with a performance question, never a satisfaction question', () => {
    for (const t of KNOWLEDGE_TYPES) {
      const c = { ...classifyUnit({ id: 'p3', text: 'placeholder text for the unit under test' }), type: t };
      const sel = selectRepresentation({ knowledgeType: t, sweepOffset: 0, rng: seededRng(6) });
      const plan = buildConversionPlan(c, sel, 'Science');
      expect(plan.checkQuestion).not.toMatch(/did you (like|enjoy)|was that (fun|helpful)/i);
    }
  });
});

describe('planChapter', () => {
  const chapter = [
    'Define the concept of democracy. It refers to rule by the people and is defined as government by consent.',
    'In 1947 India became independent. The date is a key fact to remember for the paper.',
    'Critically evaluate whether partition was avoidable. Justify your answer with evidence.',
  ].join('\n\n');

  it('returns one plan per unit with per-unit representations', () => {
    const { plans, mix } = planChapter(chapter, { subjectSlug: 'history', subjectName: 'History', rng: seededRng(9) });
    expect(plans.length).toBe(3);
    const sum = KNOWLEDGE_TYPES.reduce((s, t) => s + mix[t], 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('gives different parts of one chapter different treatments', () => {
    const { plans } = planChapter(chapter, { subjectSlug: 'history', subjectName: 'History', rng: seededRng(9) });
    expect(new Set(plans.map((p) => p.knowledgeType)).size).toBeGreaterThanOrEqual(2);
  });

  it('never assigns a mnemonic to the evaluative unit', () => {
    const { plans } = planChapter(chapter, { subjectSlug: 'history', subjectName: 'History', rng: seededRng(9) });
    const judgmentPlans = plans.filter((p) => p.knowledgeType === 'judgment');
    for (const p of judgmentPlans) {
      expect(p.representation).not.toMatch(/^mnemonic_/);
    }
  });
});

// ===========================================================================
// Context key + reward
// ===========================================================================

describe('conversionContextKey', () => {
  it('separates knowledge types that the old key collapsed together', () => {
    const a = conversionContextKey({ subjectName: 'History', knowledgeType: 'arbitrary_fact', classBand: 'senior' });
    const b = conversionContextKey({ subjectName: 'History', knowledgeType: 'judgment', classBand: 'senior' });
    expect(a).not.toBe(b);
  });

  it('is stable for identical inputs', () => {
    const p = { subjectName: 'Science', knowledgeType: 'concept' as KnowledgeType, classBand: 'middle' as const, maturityBand: 3 };
    expect(conversionContextKey(p)).toBe(conversionContextKey(p));
  });
});

describe('rewardFor', () => {
  const base = {
    unitId: 'u1',
    knowledgeType: 'arbitrary_fact' as KnowledgeType,
    representation: 'mnemonic_link' as RepresentationCode,
    constructedOwn: true,
    immediateScore: 0.9,
    engagementScore: 0.9,
    completed: true,
    timeSpentSeconds: 400,
  };

  it('marks an unresolved outcome provisional and pulls it toward neutral', () => {
    const { reward, provisional } = rewardFor({ ...base, retentionScore: null });
    expect(provisional).toBe(true);
    expect(Math.abs(reward - 0.5)).toBeLessThan(0.25);
  });

  it('lets retention dominate once the probe fires', () => {
    const good = rewardFor({ ...base, retentionScore: 0.95 });
    const bad = rewardFor({ ...base, retentionScore: 0.05 });
    expect(good.provisional).toBe(false);
    expect(good.reward).toBeGreaterThan(bad.reward + 0.3);
  });

  it('a fun session that is forgotten scores worse than a hard one that sticks', () => {
    const funButForgotten = rewardFor({ ...base, engagementScore: 1, immediateScore: 1, retentionScore: 0.1 });
    const hardButRetained = rewardFor({ ...base, engagementScore: 0.3, immediateScore: 0.5, retentionScore: 0.9 });
    expect(hardButRetained.reward).toBeGreaterThan(funButForgotten.reward);
  });

  it('discounts a mnemonic the student was handed rather than built', () => {
    const built = rewardFor({ ...base, retentionScore: 0.8, constructedOwn: true });
    const handed = rewardFor({ ...base, retentionScore: 0.8, constructedOwn: false });
    expect(built.reward).toBeGreaterThan(handed.reward);
  });

  it('keeps every reward inside 0..1', () => {
    for (const r of [0, 0.5, 1]) {
      for (const c of [true, false]) {
        const { reward } = rewardFor({ ...base, retentionScore: r, constructedOwn: c });
        expect(reward).toBeGreaterThanOrEqual(0);
        expect(reward).toBeLessThanOrEqual(1);
      }
    }
  });
});
