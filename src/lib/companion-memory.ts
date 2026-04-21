/**
 * CompanionMemory — structured long-term memory per (student × subject × companion).
 *
 * This replaces the old free-text summary with typed facts, preferences, topic
 * progress, rapport, and a standing "report to main brain". Every companion
 * session reads this to keep continuity and contributes back with fresh
 * observations.
 *
 * Design rules:
 *   1. Bounded size — caps on facts / preferences / topic entries so context
 *      doesn't balloon across turns.
 *   2. Confidence-weighted merging — repeated observations reinforce a fact;
 *      contradicted facts decay.
 *   3. Typed not free-text — the main brain can aggregate across companions
 *      only because entries are structured.
 *   4. Explicit "report to brain" — every session update regenerates a
 *      CompanionReport that the main brain reads.
 */

export interface StudentFact {
  content: string;              // short declarative claim
  confidence: number;           // 0..1
  reinforcements: number;       // times confirmed
  lastSeenAt: string;           // ISO
  firstObservedAt: string;
}

export interface StudentPreference {
  kind: 'pace' | 'style' | 'format' | 'tone' | 'modality';
  value: string;                // "short bursts", "visual", "playful", etc.
  confidence: number;
  lastSeenAt: string;
}

export interface TopicProgressEntry {
  topicKey: string;             // topic id OR short name used in conversation
  label: string;                // human-readable
  status: 'exploring' | 'struggling' | 'improving' | 'confident' | 'mastered';
  confidence: number;           // 0..1
  lastTouchedAt: string;
  notes: string;                // one-line nuance
}

export interface RapportState {
  strength: number;             // 0..100
  tone: 'formal' | 'warm' | 'playful' | 'mentor';
  humorWelcomed: boolean;
  nicknameAccepted: boolean;
  trustSignals: number;         // count of trust-indicating moments
  frictionSignals: number;      // count of friction moments
}

export interface CompanionReport {
  generatedAt: string;
  sentimentWindow: 'flourishing' | 'steady' | 'strained' | 'unknown';
  urgentFlags: string[];        // things main brain should know NOW
  breakthroughs: string[];      // cause to celebrate
  concerns: string[];           // to watch
  recommendedAction: string;    // what main brain should consider pushing
  crossSubjectHints: string[];  // insights other companions may use
}

export interface CompanionMemoryV2 {
  userId: string;
  subjectId: string;
  companionId: string;

  facts: StudentFact[];
  preferences: StudentPreference[];
  topicProgress: TopicProgressEntry[];

  rapport: RapportState;

  sessionCount: number;
  totalMinutesTogether: number;
  firstMetAt: string | null;
  lastMetAt: string | null;

  // Latest sync with the main brain
  lastReport: CompanionReport | null;
  lastDirectiveSeenAt: string | null;

  updatedAt: string;
}

// Caps to keep context bounded
const MAX_FACTS = 18;
const MAX_PREFERENCES = 10;
const MAX_TOPIC_ENTRIES = 25;

// ============================================================
// Empty / seed memory
// ============================================================

export function emptyMemory(userId: string, subjectId: string, companionId: string): CompanionMemoryV2 {
  const now = new Date().toISOString();
  return {
    userId, subjectId, companionId,
    facts: [],
    preferences: [],
    topicProgress: [],
    rapport: {
      strength: 10,
      tone: 'warm',
      humorWelcomed: false,
      nicknameAccepted: false,
      trustSignals: 0,
      frictionSignals: 0,
    },
    sessionCount: 0,
    totalMinutesTogether: 0,
    firstMetAt: null,
    lastMetAt: null,
    lastReport: null,
    lastDirectiveSeenAt: null,
    updatedAt: now,
  };
}

// ============================================================
// Ingest a new observation block from the companion's reply
// ============================================================

export interface ObservationBlock {
  mood_seen?: string;
  frustration_seen?: number;            // 0..10
  engagement_seen?: number;             // 0..10
  pace_preference?: string;             // e.g., "short steps"
  explanation_style_preferred?: string; // e.g., "analogy-first", "formal"
  misconception_seen?: string | null;
  breakthrough?: string | null;
  topic_touched?: string | null;
  topic_status?: TopicProgressEntry['status'];
  confusion_markers?: string[];
  strength_noticed?: string | null;
  question_quality?: 'shallow' | 'average' | 'deep';
  humor_exchange?: boolean;
  trust_moment?: boolean;
  friction_moment?: boolean;
  next_topic?: string | null;
  cross_subject_hint?: string | null;   // insight for OTHER companions
  // Character — THE point of the whole system.
  // Companion names a specific moment where the student's chosen character
  // quality showed up (or notably didn't).
  character_moment?: string | null;
  character_dimension?: string | null;  // e.g., 'patience', 'honesty'
}

export function ingestObservation(
  memory: CompanionMemoryV2,
  obs: ObservationBlock,
  sessionDurationSeconds: number = 0,
): CompanionMemoryV2 {
  const now = new Date().toISOString();
  const m = { ...memory, updatedAt: now };

  // === Facts ===
  const addFact = (content: string) => {
    if (!content) return;
    const existing = m.facts.find((f) => similar(f.content, content));
    if (existing) {
      existing.confidence = Math.min(1, existing.confidence + 0.08);
      existing.reinforcements += 1;
      existing.lastSeenAt = now;
    } else {
      m.facts.unshift({
        content: content.slice(0, 200),
        confidence: 0.55,
        reinforcements: 1,
        lastSeenAt: now,
        firstObservedAt: now,
      });
    }
    // Keep bounded — drop lowest confidence first
    m.facts.sort((a, b) => b.confidence * 100 + b.reinforcements - (a.confidence * 100 + a.reinforcements));
    m.facts = m.facts.slice(0, MAX_FACTS);
  };

  if (obs.strength_noticed) addFact(`Shows strength in: ${obs.strength_noticed}`);
  if (obs.confusion_markers?.length) {
    for (const marker of obs.confusion_markers) addFact(`Signals confusion when: ${marker}`);
  }
  if (obs.question_quality === 'deep') addFact(`Asks deep, probing questions`);

  // === Preferences ===
  const addPreference = (kind: StudentPreference['kind'], value: string) => {
    if (!value) return;
    const existing = m.preferences.find((p) => p.kind === kind && similar(p.value, value));
    if (existing) {
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.lastSeenAt = now;
    } else {
      m.preferences.unshift({
        kind, value: value.slice(0, 80),
        confidence: 0.5,
        lastSeenAt: now,
      });
    }
    m.preferences.sort((a, b) => b.confidence - a.confidence);
    m.preferences = m.preferences.slice(0, MAX_PREFERENCES);
  };
  if (obs.pace_preference) addPreference('pace', obs.pace_preference);
  if (obs.explanation_style_preferred) addPreference('style', obs.explanation_style_preferred);

  // === Topic progress ===
  if (obs.topic_touched) {
    const key = obs.topic_touched.toLowerCase().replace(/\s+/g, '_').slice(0, 80);
    const existing = m.topicProgress.find((t) => t.topicKey === key);
    if (existing) {
      existing.lastTouchedAt = now;
      if (obs.topic_status) existing.status = obs.topic_status;
      if (obs.breakthrough) existing.confidence = Math.min(1, existing.confidence + 0.15);
      if (obs.misconception_seen) existing.confidence = Math.max(0, existing.confidence - 0.1);
      existing.notes = obs.breakthrough || obs.misconception_seen || existing.notes;
    } else {
      m.topicProgress.unshift({
        topicKey: key,
        label: obs.topic_touched,
        status: obs.topic_status || 'exploring',
        confidence: obs.breakthrough ? 0.7 : 0.4,
        lastTouchedAt: now,
        notes: obs.breakthrough || obs.misconception_seen || '',
      });
    }
    m.topicProgress.sort((a, b) => b.lastTouchedAt.localeCompare(a.lastTouchedAt));
    m.topicProgress = m.topicProgress.slice(0, MAX_TOPIC_ENTRIES);
  }

  // === Rapport ===
  if (obs.humor_exchange) {
    m.rapport.humorWelcomed = true;
    m.rapport.strength = Math.min(100, m.rapport.strength + 2);
  }
  if (obs.trust_moment) {
    m.rapport.trustSignals += 1;
    m.rapport.strength = Math.min(100, m.rapport.strength + 4);
  }
  if (obs.friction_moment) {
    m.rapport.frictionSignals += 1;
    m.rapport.strength = Math.max(0, m.rapport.strength - 3);
  }
  if (obs.breakthrough) {
    m.rapport.strength = Math.min(100, m.rapport.strength + 5);
  }

  // Let tone evolve naturally
  if (m.rapport.humorWelcomed && m.rapport.strength > 40) m.rapport.tone = 'playful';
  else if (m.rapport.strength > 65) m.rapport.tone = 'mentor';
  else if (m.rapport.strength > 25) m.rapport.tone = 'warm';
  else m.rapport.tone = 'formal';

  // === Session counters ===
  m.totalMinutesTogether += sessionDurationSeconds / 60;
  m.lastMetAt = now;
  if (!m.firstMetAt) m.firstMetAt = now;

  return m;
}

// ============================================================
// Generate the report this companion sends to the main brain
// ============================================================

export function buildReport(memory: CompanionMemoryV2, recentObs: ObservationBlock[]): CompanionReport {
  const now = new Date().toISOString();
  const urgent: string[] = [];
  const breakthroughs: string[] = [];
  const concerns: string[] = [];
  const crossHints: string[] = [];

  let highFrustrationCount = 0;
  let totalEngagement = 0;
  let engagementSamples = 0;

  for (const o of recentObs) {
    if (typeof o.frustration_seen === 'number') {
      if (o.frustration_seen >= 7) highFrustrationCount++;
    }
    if (typeof o.engagement_seen === 'number') {
      totalEngagement += o.engagement_seen;
      engagementSamples++;
    }
    if (o.breakthrough) breakthroughs.push(o.breakthrough);
    if (o.misconception_seen) concerns.push(o.misconception_seen);
    if (o.cross_subject_hint) crossHints.push(o.cross_subject_hint);
  }

  if (highFrustrationCount >= 2) {
    urgent.push(`Frustration observed ${highFrustrationCount}× this window`);
  }
  if (memory.rapport.frictionSignals > memory.rapport.trustSignals && memory.rapport.strength < 20) {
    urgent.push(`Low rapport — student disengaging from this subject`);
  }

  const avgEngagement = engagementSamples > 0 ? totalEngagement / engagementSamples : null;

  let sentiment: CompanionReport['sentimentWindow'];
  if (avgEngagement === null) sentiment = 'unknown';
  else if (avgEngagement >= 7 && breakthroughs.length > 0) sentiment = 'flourishing';
  else if (avgEngagement >= 5) sentiment = 'steady';
  else sentiment = 'strained';

  let recommendedAction: string;
  if (urgent.length > 0) {
    recommendedAction = 'Ease difficulty, increase encouragement, consider a rest day.';
  } else if (breakthroughs.length > 0 && memory.rapport.strength > 40) {
    recommendedAction = 'Push a stretch challenge — rapport + breakthrough momentum.';
  } else if (concerns.length >= 2) {
    recommendedAction = 'Schedule a misconception intervention session.';
  } else {
    recommendedAction = 'Maintain current pace.';
  }

  return {
    generatedAt: now,
    sentimentWindow: sentiment,
    urgentFlags: urgent.slice(0, 5),
    breakthroughs: breakthroughs.slice(0, 3),
    concerns: concerns.slice(0, 3),
    recommendedAction,
    crossSubjectHints: crossHints.slice(0, 3),
  };
}

// ============================================================
// Format memory back into a compact prompt block for the next session
// ============================================================

export function memoryToPromptBlock(memory: CompanionMemoryV2): string {
  if (memory.sessionCount === 0 && memory.facts.length === 0) return '';

  const parts: string[] = [];
  parts.push(`MEMORY OF THIS STUDENT (accumulated over ${memory.sessionCount} session${memory.sessionCount === 1 ? '' : 's'}${memory.totalMinutesTogether > 0 ? `, ~${Math.round(memory.totalMinutesTogether)} min together` : ''}):`);

  if (memory.facts.length > 0) {
    parts.push('\nFacts you\'ve learned about them:');
    parts.push(...memory.facts.slice(0, 6).map((f) => `  • ${f.content}${f.reinforcements > 1 ? ` (observed ${f.reinforcements}×)` : ''}`));
  }

  const strongPrefs = memory.preferences.filter((p) => p.confidence > 0.5);
  if (strongPrefs.length > 0) {
    parts.push('\nTheir preferences:');
    parts.push(...strongPrefs.slice(0, 5).map((p) => `  • ${p.kind}: ${p.value}`));
  }

  const recentTopics = memory.topicProgress.slice(0, 5);
  if (recentTopics.length > 0) {
    parts.push('\nRecent topics:');
    parts.push(...recentTopics.map((t) => `  • ${t.label} — ${t.status}${t.notes ? ` (${t.notes})` : ''}`));
  }

  parts.push(`\nYour relationship: rapport ${memory.rapport.strength}/100, tone "${memory.rapport.tone}"${memory.rapport.humorWelcomed ? ', humor is welcome' : ''}.`);

  if (memory.lastReport?.urgentFlags.length) {
    parts.push(`\nOPEN CONCERNS: ${memory.lastReport.urgentFlags.join('; ')}`);
  }

  return parts.join('\n');
}

// ============================================================
// Fuzzy similarity — avoid storing near-duplicate facts
// ============================================================

function similar(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 60);
  const nb = b.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 60);
  if (na === nb) return true;
  if (na.length > 10 && nb.includes(na.slice(0, Math.floor(na.length * 0.8)))) return true;
  if (nb.length > 10 && na.includes(nb.slice(0, Math.floor(nb.length * 0.8)))) return true;
  return false;
}
