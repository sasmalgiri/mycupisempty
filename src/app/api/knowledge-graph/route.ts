/**
 * Knowledge Graph API
 *
 * GET ?topicId=...     — readiness check: can you attempt this topic?
 * GET ?next=subject    — recommend the next best topic for that subject
 * GET ?path=<topicId>  — build a learning path to the target topic
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildKnowledgeGraph, assessReadiness, recommendNextTopic, buildLearningPath } from '@/lib/knowledge-graph';
import { buildMasteryMap } from '@/lib/mastery';
import type { MasteryState } from '@/lib/mastery';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const topicId = url.searchParams.get('topicId');
    const nextForSubject = url.searchParams.get('next');
    const pathTo = url.searchParams.get('path');

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', user.id)
      .single()
      .catch(() => ({ data: null }));
    const classLevel = profile?.current_class || 8;

    const [graph, masteryMaps] = await Promise.all([
      buildKnowledgeGraph(supabase, classLevel).catch(() => []),
      buildMasteryMap(supabase, user.id).catch(() => []),
    ]);

    // Flatten mastery by topic
    const masteryByTopic: Record<string, { state: MasteryState; title: string }> = {};
    for (const m of masteryMaps) {
      for (const t of m.topics) {
        masteryByTopic[t.topicId] = { state: t.state, title: t.topicTitle };
      }
    }

    if (topicId) {
      const readiness = assessReadiness(topicId, graph, masteryByTopic);
      return NextResponse.json({ success: true, readiness });
    }

    if (nextForSubject) {
      const next = recommendNextTopic(graph, masteryByTopic, nextForSubject);
      if (!next) {
        return NextResponse.json({ success: true, recommendation: null, message: 'No ready topic found — you may have completed this subject.' });
      }
      const readiness = assessReadiness(next.topicId, graph, masteryByTopic);
      return NextResponse.json({ success: true, recommendation: next, readiness });
    }

    if (pathTo) {
      const path = buildLearningPath(null, pathTo, graph);
      const annotatedPath = path.map((n) => ({
        ...n,
        currentState: masteryByTopic[n.topicId]?.state || 'fresh',
      }));
      return NextResponse.json({ success: true, path: annotatedPath });
    }

    // Default: return the full graph summary
    return NextResponse.json({
      success: true,
      graph: graph.map((n) => ({
        topicId: n.topicId,
        topicTitle: n.topicTitle,
        subjectId: n.subjectId,
        subjectName: n.subjectName,
        prerequisites: n.prerequisites.length,
        unlocks: n.unlocks.length,
        currentState: masteryByTopic[n.topicId]?.state || 'fresh',
      })),
    });
  } catch (error: any) {
    console.error('Knowledge graph error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
