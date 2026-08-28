import { describe, it, expect } from 'vitest';
import {
  synthesiseFallback,
  applySecondOpinion,
  classifyEnriched,
  enrichmentKey,
  type CurriculumTopicRow,
} from '../conversion-enrich';
import { classifyUnit, KNOWLEDGE_TYPES, type KnowledgeType } from '../conversion-engine';

const topic: CurriculumTopicRow = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  topic_no: 3,
  title_en: 'Quadratic formula',
  learning_objectives: ['Discriminant, roots, nature.'],
};

// ===========================================================================
// Fallback — never a blank lesson
// ===========================================================================

describe('synthesiseFallback', () => {
  it('produces at least one usable unit with no model available', () => {
    const units = synthesiseFallback(topic, 'Math');
    expect(units.length).toBeGreaterThanOrEqual(1);
    expect(units[0].body.length).toBeGreaterThan(25);
    expect(units[0].source).toBe('fallback');
  });

  it('makes one unit per syllabus objective', () => {
    const units = synthesiseFallback(
      { ...topic, learning_objectives: ['Standard form.', 'Splitting the middle term.', 'Nature of roots.'] },
      'Math',
    );
    expect(units.length).toBe(3);
    expect(new Set(units.map((u) => u.unitId)).size).toBe(3);
  });

  it('still returns a unit when the syllabus row has no objectives', () => {
    const units = synthesiseFallback({ ...topic, learning_objectives: [] }, 'Math');
    expect(units.length).toBe(1);
    expect(units[0].body).toContain('Quadratic formula');
  });

  it('keeps unit ids stable for the same topic', () => {
    const a = synthesiseFallback(topic, 'Math').map((u) => u.unitId);
    const b = synthesiseFallback(topic, 'Math').map((u) => u.unitId);
    expect(a).toEqual(b);
  });

  it('carries the syllabus verb through so the classifier has something to read', () => {
    const units = synthesiseFallback(
      { ...topic, title_en: 'Solving by factorisation', learning_objectives: ['Splitting the middle term, zero-product law.'] },
      'Math',
    );
    const c = classifyUnit({ id: 'x', text: units[0].body, subjectSlug: 'math' });
    expect(c.type).toBe('procedure');
  });
});

// ===========================================================================
// SAFETY — the model may raise, never lower
// ===========================================================================

describe('applySecondOpinion', () => {
  const ambiguous = (type: KnowledgeType) => ({
    ...classifyUnit({ id: 'u', text: 'aaaa bbbb cccc dddd eeee' }),
    type,
    ambiguous: true,
    needsEnrichment: true,
  });

  it('accepts a raise from fact to concept', () => {
    const out = applySecondOpinion(ambiguous('arbitrary_fact'), 'concept');
    expect(out.type).toBe('concept');
    expect(out.cues.join(' ')).toMatch(/second opinion/i);
  });

  it('REFUSES a downgrade from concept to fact', () => {
    const out = applySecondOpinion(ambiguous('concept'), 'arbitrary_fact');
    expect(out.type).toBe('concept');
  });

  it('refuses every downgrade, for every pair', () => {
    const order: KnowledgeType[] = [
      'arbitrary_fact', 'causal_sequence', 'relational_structure',
      'procedure', 'concept', 'judgment',
    ];
    for (let i = 0; i < order.length; i++) {
      for (let j = 0; j < i; j++) {
        // j is strictly cheaper than i — the model must never win this.
        const out = applySecondOpinion(ambiguous(order[i]), order[j]);
        expect(out.type).toBe(order[i]);
      }
    }
  });

  it('accepts every raise, for every pair', () => {
    const order: KnowledgeType[] = [
      'arbitrary_fact', 'causal_sequence', 'relational_structure',
      'procedure', 'concept', 'judgment',
    ];
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const out = applySecondOpinion(ambiguous(order[i]), order[j]);
        expect(out.type).toBe(order[j]);
      }
    }
  });

  it('does not consult the model at all when the classifier was confident', () => {
    const confident = classifyUnit({
      id: 'c',
      text: 'Solve the equation by factorising. Substitute, rearrange and simplify to find the value of x. Show your work.',
      subjectSlug: 'math',
    });
    expect(confident.ambiguous).toBe(false);
    const out = applySecondOpinion(confident, 'judgment');
    expect(out.type).toBe('procedure');
  });

  it('is a no-op when the model agrees or says nothing', () => {
    const base = ambiguous('concept');
    expect(applySecondOpinion(base, 'concept').type).toBe('concept');
    expect(applySecondOpinion(base, null).type).toBe('concept');
  });

  it('clears the fact flavour when raising away from arbitrary_fact', () => {
    const factish = {
      ...classifyUnit({ id: 'f', text: 'Learn the list of names in order: a, b, c, d, e, f.' }),
      ambiguous: true,
    };
    const out = applySecondOpinion(factish, 'concept');
    expect(out.type).toBe('concept');
    expect(out.flavour).toBeNull();
  });
});

// ===========================================================================
// classifyEnriched
// ===========================================================================

describe('classifyEnriched', () => {
  it('classifies each unit independently and keeps its text', () => {
    const units = [
      { unitId: 'u1', topicId: 't1', heading: 'Solving', source: 'gemini' as const,
        body: 'Solve the equation by factorising. Substitute the values, rearrange and simplify to find x.' },
      { unitId: 'u2', topicId: 't1', heading: 'Meaning', source: 'gemini' as const,
        body: 'The discriminant is defined as b squared minus 4ac. The concept refers to what it tells you about the roots. Explain why a negative value means no real roots.' },
    ];
    const out = classifyEnriched(units, { subjectSlug: 'math', classLevel: 10 });
    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('procedure');
    expect(out[1].type).toBe('concept');
    expect(out[0].body).toContain('factorising');
    expect(out[0].topicId).toBe('t1');
  });

  it('produces a valid knowledge type for every unit', () => {
    const units = [
      { unitId: 'u1', topicId: 't1', heading: 'x', body: 'Some short teaching text about a topic here.', source: 'fallback' as const },
    ];
    for (const o of classifyEnriched(units, {})) {
      expect(KNOWLEDGE_TYPES).toContain(o.type);
    }
  });
});

// ===========================================================================
// Cache key
// ===========================================================================

describe('enrichmentKey', () => {
  it('is stable for an unchanged syllabus row', () => {
    expect(enrichmentKey(topic)).toBe(enrichmentKey({ ...topic }));
  });

  it('changes when the objectives are edited, invalidating stale lessons', () => {
    const edited = { ...topic, learning_objectives: ['Discriminant, roots, nature, and the graph.'] };
    expect(enrichmentKey(edited)).not.toBe(enrichmentKey(topic));
  });

  it('changes when the title is edited', () => {
    expect(enrichmentKey({ ...topic, title_en: 'Quadratic equations' })).not.toBe(enrichmentKey(topic));
  });

  it('differs between two topics that share a title', () => {
    const other = { ...topic, id: 'ffffffff-0000-1111-2222-333333333333' };
    expect(enrichmentKey(other)).not.toBe(enrichmentKey(topic));
  });
});
