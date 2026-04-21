/**
 * Mastery Engine — Real learning state, not fake progress bars.
 *
 * Every competitor shows "75% complete" — a meaningless metric that counts
 * views or time spent. We compute TRUE mastery states that answer:
 *   "If we asked you this tomorrow, would you get it right?"
 *   "In a month, would you still remember?"
 *
 * This is the difference between FAMILIARITY and KNOWING.
 */

export type MasteryState =
  | 'fresh'       // never attempted
  | 'learning'    // attempting, mixed results
  | 'fragile'     // recently got right, but not retained
  | 'stable'      // consistent correct answers over time
  | 'mastered'    // long-term retention proven (spaced repetition validated)
  | 'stalled'     // tried multiple times, stuck
  | 'decayed';    // was known, now slipping (forgetting curve)

export interface TopicMastery {
  topicId: string;
  topicTitle: string;
  subjectId: string;
  state: MasteryState;
  confidence: number;            // 0-1 — how sure are we about this state?
  attempts: number;
  correctAttempts: number;
  lastSeenDaysAgo: number;
  nextAction: NextAction;
  reason: string;                // human-readable explanation
}

export interface NextAction {
  kind: 'practice' | 'relearn' | 'review' | 'stretch' | 'rest' | 'intervene';
  urgency: 'now' | 'today' | 'this_week' | 'whenever';
  label: string;                 // "Quick review", "Relearn basics", etc.
  reason: string;
}

export interface SubjectMasteryMap {
  subjectId: string;
  subjectName: string;
  topics: TopicMastery[];
  counts: Record<MasteryState, number>;
  // Honest metrics — not "% complete"
  trueMasteryPercent: number;    // only counts 'mastered' + 'stable'
  fragilePercent: number;        // warning zone
  needsAttention: TopicMastery[];
  readyToStretch: TopicMastery[];
}

// ============================================================
// Classify a topic into a mastery state
// ============================================================

export function classifyMastery(input: {
  attempts: number;
  correctAttempts: number;
  recentAccuracy: number;        // last 5 attempts
  stalledCycles: number;
  lastSeenDaysAgo: number;
  currentBand?: string;          // from learner_state
  easeFactor?: number;           // from SM-2 flashcards
  interval?: number;             // days until next review
}): { state: MasteryState; confidence: number; reason: string } {
  const { attempts, correctAttempts, recentAccuracy, stalledCycles, lastSeenDaysAgo, currentBand, interval } = input;

  // Never attempted
  if (attempts === 0) {
    return { state: 'fresh', confidence: 1, reason: 'Haven\'t started yet' };
  }

  // Stalled — multiple tries, still stuck
  if (stalledCycles >= 3) {
    return {
      state: 'stalled',
      confidence: 0.9,
      reason: `Tried ${stalledCycles} cycles, still stuck. Needs a different approach.`,
    };
  }

  // Long-term mastery — proven by SM-2 interval or advanced band
  if ((interval && interval >= 21) || currentBand === 'advanced') {
    // Check for decay: if not seen in > 2x the interval, it may be slipping
    if (interval && lastSeenDaysAgo > interval * 2) {
      return {
        state: 'decayed',
        confidence: 0.8,
        reason: `You knew this ${lastSeenDaysAgo} days ago — time to refresh before it fades.`,
      };
    }
    return {
      state: 'mastered',
      confidence: 0.95,
      reason: `Proven long-term retention (${interval || 'high-band'} confidence).`,
    };
  }

  // Stable — consistent correct answers
  const overallAcc = attempts > 0 ? correctAttempts / attempts : 0;
  if (attempts >= 5 && recentAccuracy >= 0.8 && overallAcc >= 0.7) {
    return {
      state: 'stable',
      confidence: 0.85,
      reason: `${Math.round(recentAccuracy * 100)}% recent accuracy over ${attempts} attempts.`,
    };
  }

  // Fragile — got it right recently but not enough evidence
  if (recentAccuracy >= 0.6 && attempts < 5) {
    return {
      state: 'fragile',
      confidence: 0.6,
      reason: `Looks good so far, but needs more practice to stick.`,
    };
  }

  // Learning — active struggle
  if (attempts >= 2) {
    return {
      state: 'learning',
      confidence: 0.7,
      reason: `In progress. ${correctAttempts}/${attempts} correct so far.`,
    };
  }

  return {
    state: 'learning',
    confidence: 0.5,
    reason: 'Just getting started.',
  };
}

// ============================================================
// Decide the next action for a topic
// ============================================================

export function decideNextAction(mastery: { state: MasteryState; confidence: number }, lastSeenDaysAgo: number): NextAction {
  switch (mastery.state) {
    case 'fresh':
      return {
        kind: 'practice',
        urgency: 'whenever',
        label: 'Start learning',
        reason: 'New territory — let\'s explore it.',
      };
    case 'learning':
      return {
        kind: 'practice',
        urgency: 'today',
        label: 'Keep practicing',
        reason: 'You\'re in the middle of understanding this.',
      };
    case 'fragile':
      return {
        kind: 'review',
        urgency: lastSeenDaysAgo > 2 ? 'now' : 'today',
        label: 'Quick review',
        reason: 'You got it, but it needs repetition to stick.',
      };
    case 'stable':
      return {
        kind: 'review',
        urgency: lastSeenDaysAgo > 7 ? 'this_week' : 'whenever',
        label: 'Light review',
        reason: 'Solid. A quick check-in keeps it sharp.',
      };
    case 'mastered':
      return {
        kind: 'rest',
        urgency: 'whenever',
        label: 'Rest it',
        reason: 'You\'ve got this. Coming back later is fine.',
      };
    case 'stalled':
      return {
        kind: 'intervene',
        urgency: 'now',
        label: 'Try differently',
        reason: 'Same approach isn\'t working. Time to switch methods.',
      };
    case 'decayed':
      return {
        kind: 'relearn',
        urgency: 'now',
        label: 'Refresh now',
        reason: 'You knew this once. A quick review brings it back fast.',
      };
  }
}

// ============================================================
// Build full mastery map from learner state + signals
// ============================================================

export async function buildMasteryMap(supabase: any, userId: string): Promise<SubjectMasteryMap[]> {
  const [learnerStateResult, signalsResult, flashcardsResult] = await Promise.all([
    supabase.from('learner_state')
      .select('topic_id, current_band, stalled_cycles, last_active_at, mastery_total, topics(id, title, subject_id, subjects(id, title))')
      .eq('user_id', userId)
      .catch(() => ({ data: [] })),
    supabase.from('learner_signals')
      .select('signal_type, value, subject_id, metadata, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500)
      .catch(() => ({ data: [] })),
    supabase.from('flashcard_reviews')
      .select('topic_id, ease_factor, interval_days, reviewed_at')
      .eq('user_id', userId)
      .order('reviewed_at', { ascending: false })
      .limit(200)
      .catch(() => ({ data: [] })),
  ]);

  const learnerStates = learnerStateResult?.data || [];
  const signals = signalsResult?.data || [];
  const flashcards = flashcardsResult?.data || [];

  // Group by subject
  const subjectMap: Record<string, { name: string; topics: any[] }> = {};
  const nowMs = Date.now();

  for (const ls of learnerStates) {
    const subjectId = ls.topics?.subject_id || ls.topics?.subjects?.id;
    const subjectName = ls.topics?.subjects?.title || 'Unknown';
    if (!subjectId) continue;
    if (!subjectMap[subjectId]) subjectMap[subjectId] = { name: subjectName, topics: [] };

    // Compute per-topic metrics from signals
    const topicSignals = signals.filter((s: any) =>
      s.signal_type === 'answer_result' &&
      (s.metadata?.topic_id === ls.topic_id || s.metadata?.topicId === ls.topic_id),
    );
    const attempts = topicSignals.length;
    const correctAttempts = topicSignals.filter((s: any) => s.value === 1).length;
    const recent5 = topicSignals.slice(0, 5);
    const recentAccuracy = recent5.length > 0
      ? recent5.reduce((sum: number, s: any) => sum + s.value, 0) / recent5.length
      : 0;

    const lastFlashcard = flashcards.find((f: any) => f.topic_id === ls.topic_id);
    const interval = lastFlashcard?.interval_days;

    const lastActiveMs = ls.last_active_at ? new Date(ls.last_active_at).getTime() : nowMs;
    const lastSeenDaysAgo = Math.floor((nowMs - lastActiveMs) / (1000 * 60 * 60 * 24));

    const classification = classifyMastery({
      attempts,
      correctAttempts,
      recentAccuracy,
      stalledCycles: ls.stalled_cycles || 0,
      lastSeenDaysAgo,
      currentBand: ls.current_band,
      interval,
    });

    const nextAction = decideNextAction(classification, lastSeenDaysAgo);

    subjectMap[subjectId].topics.push({
      topicId: ls.topic_id,
      topicTitle: ls.topics?.title || ls.topic_id,
      subjectId,
      state: classification.state,
      confidence: classification.confidence,
      attempts,
      correctAttempts,
      lastSeenDaysAgo,
      nextAction,
      reason: classification.reason,
    });
  }

  // Build subject maps
  return Object.entries(subjectMap).map(([subjectId, data]) => {
    const counts: Record<MasteryState, number> = {
      fresh: 0, learning: 0, fragile: 0, stable: 0, mastered: 0, stalled: 0, decayed: 0,
    };
    for (const t of data.topics) counts[t.state as MasteryState]++;

    const total = data.topics.length || 1;
    const trueMasteryPercent = Math.round(((counts.mastered + counts.stable) / total) * 100);
    const fragilePercent = Math.round((counts.fragile / total) * 100);

    // Priorities
    const needsAttention = data.topics.filter((t: TopicMastery) =>
      t.state === 'stalled' || t.state === 'decayed' ||
      (t.state === 'fragile' && t.lastSeenDaysAgo > 2),
    ).slice(0, 5);

    const readyToStretch = data.topics.filter((t: TopicMastery) => t.state === 'mastered' || t.state === 'stable').slice(0, 3);

    return {
      subjectId,
      subjectName: data.name,
      topics: data.topics as TopicMastery[],
      counts,
      trueMasteryPercent,
      fragilePercent,
      needsAttention,
      readyToStretch,
    };
  });
}

// ============================================================
// Honest summary — what to tell the student
// ============================================================

export function honestMasterySummary(maps: SubjectMasteryMap[]): {
  headline: string;
  details: string[];
  priorityTopic: TopicMastery | null;
} {
  if (maps.length === 0) {
    return {
      headline: 'Ready when you are.',
      details: ['Start any subject to begin building your mastery map.'],
      priorityTopic: null,
    };
  }

  const totals = maps.reduce(
    (acc, m) => {
      for (const [k, v] of Object.entries(m.counts)) {
        acc[k as MasteryState] = (acc[k as MasteryState] || 0) + v;
      }
      return acc;
    },
    {} as Record<MasteryState, number>,
  );

  const allTopics = maps.flatMap((m) => m.topics);
  const urgent = allTopics
    .filter((t) => t.nextAction.urgency === 'now')
    .sort((a, b) => (a.state === 'stalled' ? -1 : 0) - (b.state === 'stalled' ? -1 : 0));

  const mastered = totals.mastered || 0;
  const stable = totals.stable || 0;
  const fragile = totals.fragile || 0;
  const stalled = totals.stalled || 0;
  const decayed = totals.decayed || 0;

  const details: string[] = [];
  if (mastered > 0) details.push(`${mastered} topic${mastered > 1 ? 's' : ''} truly mastered — you could teach ${mastered > 1 ? 'these' : 'this'}.`);
  if (stable > 0) details.push(`${stable} topic${stable > 1 ? 's' : ''} in stable memory — reliable for exams.`);
  if (fragile > 0) details.push(`${fragile} topic${fragile > 1 ? 's' : ''} fragile — one more practice round and ${fragile > 1 ? 'they' : 'it'} stick${fragile > 1 ? '' : 's'}.`);
  if (decayed > 0) details.push(`${decayed} topic${decayed > 1 ? 's' : ''} slipping — refresh soon or lose ${decayed > 1 ? 'them' : 'it'}.`);
  if (stalled > 0) details.push(`${stalled} topic${stalled > 1 ? 's' : ''} stuck — we'll try a new angle.`);

  let headline = 'Your learning is growing.';
  if (stalled > 0) headline = `Let's unstick ${stalled} topic${stalled > 1 ? 's' : ''} today.`;
  else if (decayed > 0) headline = `Quick refresh: ${decayed} topic${decayed > 1 ? 's' : ''} need${decayed > 1 ? '' : 's'} you.`;
  else if (mastered + stable > 5) headline = `You\'ve truly mastered ${mastered + stable} topics. Real progress.`;

  return {
    headline,
    details,
    priorityTopic: urgent[0] || null,
  };
}
