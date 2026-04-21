import { describe, it, expect } from 'vitest';
import { emptyMemory, ingestObservation, buildReport, memoryToPromptBlock } from '../companion-memory';

describe('emptyMemory', () => {
  it('initialises with sensible defaults', () => {
    const m = emptyMemory('u1', 's1', 'aryabhata');
    expect(m.userId).toBe('u1');
    expect(m.rapport.strength).toBe(10);
    expect(m.rapport.tone).toBe('warm');
    expect(m.facts).toHaveLength(0);
    expect(m.sessionCount).toBe(0);
  });
});

describe('ingestObservation', () => {
  it('adds a fact when strength noticed', () => {
    const m = ingestObservation(
      emptyMemory('u1', 's1', 'aryabhata'),
      { strength_noticed: 'pattern recognition' },
    );
    expect(m.facts.length).toBe(1);
    expect(m.facts[0].content).toMatch(/pattern recognition/);
  });

  it('reinforces duplicate facts (dedup)', () => {
    let m = emptyMemory('u1', 's1', 'aryabhata');
    m = ingestObservation(m, { strength_noticed: 'pattern recognition' });
    m = ingestObservation(m, { strength_noticed: 'pattern recognition' });
    expect(m.facts.length).toBe(1);
    expect(m.facts[0].reinforcements).toBe(2);
    expect(m.facts[0].confidence).toBeGreaterThan(0.55);
  });

  it('stores topic progress', () => {
    const m = ingestObservation(
      emptyMemory('u1', 's1', 'aryabhata'),
      { topic_touched: 'Quadratic Equations', topic_status: 'improving', breakthrough: 'aha!' },
    );
    expect(m.topicProgress).toHaveLength(1);
    expect(m.topicProgress[0].status).toBe('improving');
    expect(m.topicProgress[0].confidence).toBeGreaterThan(0.5);
  });

  it('evolves rapport tone as strength grows', () => {
    let m = emptyMemory('u1', 's1', 'aryabhata');
    for (let i = 0; i < 10; i++) {
      m = ingestObservation(m, { trust_moment: true, breakthrough: 'aha' });
    }
    expect(m.rapport.strength).toBeGreaterThan(40);
    expect(['warm', 'mentor']).toContain(m.rapport.tone);
  });

  it('marks humor welcomed when observed', () => {
    const m = ingestObservation(emptyMemory('u1', 's1', 'aryabhata'), { humor_exchange: true });
    expect(m.rapport.humorWelcomed).toBe(true);
  });

  it('caps facts at 18', () => {
    let m = emptyMemory('u1', 's1', 'aryabhata');
    for (let i = 0; i < 25; i++) {
      m = ingestObservation(m, { strength_noticed: `strength ${i}` });
    }
    expect(m.facts.length).toBeLessThanOrEqual(18);
  });
});

describe('buildReport', () => {
  it('flags urgent when multiple frustration observations', () => {
    const mem = emptyMemory('u1', 's1', 'aryabhata');
    const recent = [
      { frustration_seen: 8, engagement_seen: 3 },
      { frustration_seen: 7, engagement_seen: 2 },
    ];
    const r = buildReport(mem, recent);
    expect(r.urgentFlags.length).toBeGreaterThan(0);
    expect(r.sentimentWindow).toBe('strained');
  });

  it('reports flourishing on engaged + breakthrough window', () => {
    const mem = emptyMemory('u1', 's1', 'aryabhata');
    const recent = [
      { engagement_seen: 9, breakthrough: 'got logarithms' },
      { engagement_seen: 8 },
    ];
    const r = buildReport(mem, recent);
    expect(r.sentimentWindow).toBe('flourishing');
    expect(r.breakthroughs).toContain('got logarithms');
  });
});

describe('memoryToPromptBlock', () => {
  it('returns empty for zero-session memory', () => {
    const b = memoryToPromptBlock(emptyMemory('u1', 's1', 'aryabhata'));
    expect(b).toBe('');
  });

  it('renders facts once memory is populated', () => {
    let m = emptyMemory('u1', 's1', 'aryabhata');
    m = ingestObservation(m, { strength_noticed: 'visual thinking' });
    m.sessionCount = 3;
    const b = memoryToPromptBlock(m);
    expect(b).toContain('visual thinking');
    expect(b).toContain('3 session');
  });
});
