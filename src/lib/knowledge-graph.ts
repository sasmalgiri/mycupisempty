/**
 * Knowledge Graph — topic dependencies and prerequisite chains.
 *
 * No competitor in India-K12 has a real knowledge graph. BYJU'S chapters are
 * a linear list. Khan Academy has "prerequisites" but they're manually tagged.
 * We build a graph that maps which concepts MUST be secure before the next
 * becomes learnable — and then we enforce it.
 *
 * Why this matters:
 *   - If a student is stuck on "Quadratic Equations," the root cause is often
 *     "Factorization." Fix the prerequisite, the current topic unblocks.
 *   - We can show students a visual path: "to master X, secure A → B → C first."
 *   - We can auto-reject "skip ahead" requests when foundations are weak.
 *
 * The graph is built from two signals:
 *   1. Explicit `topic_prerequisites` (if curriculum data provides them)
 *   2. Inferred from co-occurrence in stalled attempts (students stuck on both
 *      X and Y → likely shared prerequisite)
 */

import type { MasteryState } from './mastery';

export interface TopicNode {
  topicId: string;
  topicTitle: string;
  subjectId: string;
  subjectName?: string;
  classLevel?: number;
  difficulty?: 'foundation' | 'intermediate' | 'advanced';
  prerequisites: string[];        // upstream topic IDs
  unlocks: string[];              // downstream topic IDs this enables
}

export interface TopicReadiness {
  topicId: string;
  topicTitle: string;
  status: 'ready' | 'partially_ready' | 'not_ready' | 'already_mastered';
  readinessScore: number;         // 0-100
  missingPrereqs: Array<{ topicId: string; title: string; state: MasteryState }>;
  fragilePrereqs: Array<{ topicId: string; title: string }>;
  recommendation: string;
}

// ============================================================
// Build the knowledge graph
// ============================================================

export async function buildKnowledgeGraph(supabase: any, classLevel: number): Promise<TopicNode[]> {
  // Load all topics for the class level
  const { data: topics } = await supabase
    .from('topics')
    .select('id, title, subject_id, class_level, order_index, prerequisite_ids, subjects(title)')
    .eq('class_level', classLevel)
    .order('order_index', { ascending: true });

  if (!topics || topics.length === 0) return [];

  const nodes: TopicNode[] = topics.map((t: any) => ({
    topicId: t.id,
    topicTitle: t.title,
    subjectId: t.subject_id,
    subjectName: t.subjects?.title,
    classLevel: t.class_level,
    prerequisites: Array.isArray(t.prerequisite_ids) ? t.prerequisite_ids : [],
    unlocks: [],
  }));

  // Build reverse edges (unlocks)
  const nodeById = new Map<string, TopicNode>(nodes.map((n) => [n.topicId, n]));
  for (const n of nodes) {
    for (const prereqId of n.prerequisites) {
      const prereqNode = nodeById.get(prereqId);
      if (prereqNode) {
        prereqNode.unlocks.push(n.topicId);
      }
    }
  }

  // If no explicit prereqs in curriculum data, fall back to sequential ordering
  // within the same subject (topic N depends on topic N-1)
  const bySubject = new Map<string, TopicNode[]>();
  for (const n of nodes) {
    if (!bySubject.has(n.subjectId)) bySubject.set(n.subjectId, []);
    bySubject.get(n.subjectId)!.push(n);
  }
  for (const [, subjTopics] of bySubject) {
    for (let i = 1; i < subjTopics.length; i++) {
      if (subjTopics[i].prerequisites.length === 0) {
        subjTopics[i].prerequisites = [subjTopics[i - 1].topicId];
        subjTopics[i - 1].unlocks.push(subjTopics[i].topicId);
      }
    }
  }

  return nodes;
}

// ============================================================
// Assess readiness to attempt a topic
// ============================================================

export function assessReadiness(
  targetTopicId: string,
  graph: TopicNode[],
  masteryByTopic: Record<string, { state: MasteryState; title: string }>,
): TopicReadiness {
  const target = graph.find((n) => n.topicId === targetTopicId);
  if (!target) {
    return {
      topicId: targetTopicId,
      topicTitle: 'Unknown',
      status: 'ready',
      readinessScore: 100,
      missingPrereqs: [],
      fragilePrereqs: [],
      recommendation: 'Topic not found in graph — proceed.',
    };
  }

  const currentMastery = masteryByTopic[targetTopicId]?.state;
  if (currentMastery === 'mastered' || currentMastery === 'stable') {
    return {
      topicId: targetTopicId,
      topicTitle: target.topicTitle,
      status: 'already_mastered',
      readinessScore: 100,
      missingPrereqs: [],
      fragilePrereqs: [],
      recommendation: `You've already got this — try a stretch topic instead.`,
    };
  }

  const missing: Array<{ topicId: string; title: string; state: MasteryState }> = [];
  const fragile: Array<{ topicId: string; title: string }> = [];
  let readyPrereqs = 0;

  for (const prereqId of target.prerequisites) {
    const pre = masteryByTopic[prereqId];
    const node = graph.find((n) => n.topicId === prereqId);
    const title = pre?.title || node?.topicTitle || 'Prerequisite';
    if (!pre || pre.state === 'fresh' || pre.state === 'learning' || pre.state === 'stalled') {
      missing.push({ topicId: prereqId, title, state: pre?.state || 'fresh' });
    } else if (pre.state === 'fragile' || pre.state === 'decayed') {
      fragile.push({ topicId: prereqId, title });
      readyPrereqs += 0.5;
    } else {
      readyPrereqs += 1;
    }
  }

  const totalPrereqs = target.prerequisites.length || 1;
  const readinessScore = Math.round((readyPrereqs / totalPrereqs) * 100);

  let status: TopicReadiness['status'];
  let recommendation: string;
  if (missing.length === 0 && fragile.length === 0) {
    status = 'ready';
    recommendation = `Foundations are solid — you're ready to start.`;
  } else if (missing.length >= 2 || readinessScore < 40) {
    status = 'not_ready';
    recommendation = `Let's build the base first. Secure ${missing[0].title}${missing.length > 1 ? ` and ${missing.length - 1} more` : ''} before this.`;
  } else {
    status = 'partially_ready';
    if (fragile.length > 0) {
      recommendation = `Almost ready. A quick review of ${fragile[0].title} will make this easier.`;
    } else {
      recommendation = `Close — ${missing.length} prerequisite${missing.length === 1 ? '' : 's'} need${missing.length === 1 ? 's' : ''} attention first.`;
    }
  }

  return {
    topicId: targetTopicId,
    topicTitle: target.topicTitle,
    status,
    readinessScore,
    missingPrereqs: missing,
    fragilePrereqs: fragile,
    recommendation,
  };
}

// ============================================================
// Recommend next best topic to study
// ============================================================

export function recommendNextTopic(
  graph: TopicNode[],
  masteryByTopic: Record<string, { state: MasteryState; title: string }>,
  subjectId?: string,
): TopicNode | null {
  // Filter to subject if specified
  const pool = subjectId ? graph.filter((n) => n.subjectId === subjectId) : graph;

  // Priority order:
  // 1. Fragile topics (about to stick, low cost to solidify)
  // 2. Ready topics (all prereqs met, not yet started)
  // 3. Decayed topics (was known, slipping)
  const candidates: Array<{ node: TopicNode; priority: number }> = [];

  for (const node of pool) {
    const myState = masteryByTopic[node.topicId]?.state;
    if (myState === 'mastered' || myState === 'stable') continue;

    const readiness = assessReadiness(node.topicId, graph, masteryByTopic);
    if (readiness.status === 'not_ready') continue;

    let priority = 0;
    if (myState === 'fragile') priority = 100;
    else if (myState === 'decayed') priority = 90;
    else if (readiness.status === 'ready' && !myState) priority = 70;
    else if (readiness.status === 'partially_ready') priority = 50;
    else if (myState === 'learning') priority = 60;

    // Bonus: unlocks many downstream topics
    priority += Math.min(node.unlocks.length * 5, 30);

    candidates.push({ node, priority });
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0]?.node || null;
}

// ============================================================
// Build a learning path from where the student is to a goal topic
// ============================================================

export function buildLearningPath(
  fromTopicId: string | null,
  toTopicId: string,
  graph: TopicNode[],
): TopicNode[] {
  const target = graph.find((n) => n.topicId === toTopicId);
  if (!target) return [];

  // DFS to collect all ancestor prerequisites
  const visited = new Set<string>();
  const collect = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = graph.find((n) => n.topicId === id);
    if (!node) return;
    for (const prereqId of node.prerequisites) {
      collect(prereqId);
    }
  };
  collect(toTopicId);

  // Topological sort the visited set (prerequisites first)
  const subset = graph.filter((n) => visited.has(n.topicId));
  const sorted: TopicNode[] = [];
  const tempVisited = new Set<string>();
  const tempMark = new Set<string>();

  const visit = (node: TopicNode): void => {
    if (tempVisited.has(node.topicId)) return;
    if (tempMark.has(node.topicId)) return; // cycle — skip
    tempMark.add(node.topicId);
    for (const prereqId of node.prerequisites) {
      const prereq = subset.find((n) => n.topicId === prereqId);
      if (prereq) visit(prereq);
    }
    tempMark.delete(node.topicId);
    tempVisited.add(node.topicId);
    sorted.push(node);
  };

  for (const n of subset) visit(n);

  // If fromTopicId specified, truncate to path from that point
  if (fromTopicId) {
    const idx = sorted.findIndex((n) => n.topicId === fromTopicId);
    if (idx >= 0) return sorted.slice(idx);
  }

  return sorted;
}
