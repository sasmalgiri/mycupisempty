/**
 * Conversion API
 *
 * GET  — "how should this chapter be taught to THIS student?"
 *        Enriches the syllabus outline into teaching prose, classifies each
 *        unit by knowledge type, gates the legal representations, picks one
 *        from behavioural evidence, and returns a per-unit teaching plan plus
 *        an honest statement of how much we actually know yet.
 *
 * POST — records one observation, or resolves a retention probe.
 *
 * Reads the CURRICULUM schema (curriculum_subjects_by_class → curriculum_
 * chapters → curriculum_topics), which is where the seeded syllabus actually
 * lives. The legacy public.topics/chapters/subjects tables from migration 001
 * have no rows in any migration.
 *
 * How this differs from /api/method-calibration: that route answers "what
 * works for this student in Maths". This one answers "what works for this
 * student on FACTS in Maths, versus on PROCEDURES in Maths" — different
 * questions, different answers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  buildConversionPlan,
  selectRepresentation,
  honestStatement,
  chapterMix,
  legalRepresentations,
  flavourBias,
  KNOWLEDGE_TYPE_LABEL,
  REPRESENTATION_LABEL,
  type KnowledgeType,
} from '@/lib/conversion-engine';
import {
  loadRepStats,
  loadGlobalPriors,
  recordConversionOutcome,
  resolveRetentionProbe,
  dueRetentionProbes,
  cacheClassifications,
} from '@/lib/conversion-store';
import {
  getOrCreateEnrichment,
  classifyEnriched,
  type CurriculumTopicRow,
} from '@/lib/conversion-enrich';

export const maxDuration = 60; // enrichment calls the model per topic

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const chapterId = url.searchParams.get('chapterId');
    const topicId = url.searchParams.get('topicId');
    const studentId = url.searchParams.get('studentId') || user.id;

    if (!chapterId && !topicId) {
      return NextResponse.json({ error: 'chapterId or topicId required' }, { status: 400 });
    }

    // Parent or teacher viewing a linked child.
    if (studentId !== user.id) {
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('parent_id')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // --- Load the syllabus rows -------------------------------------------
    let topics: CurriculumTopicRow[] = [];
    let resolvedChapterId: string | null = chapterId;
    let chapterTitle = '';
    let subjectSlug = '';
    let subjectName = '';
    let subjectClassId: string | undefined;
    let classLevel = 8;

    const chapterSelect =
      'id, chapter_no, title_en, subject_class_id, ' +
      'curriculum_subjects_by_class(id, subject_slug, class_level, textbook_title_en)';

    if (topicId) {
      const { data: t } = await supabase
        .from('curriculum_topics')
        .select(`id, topic_no, title_en, title_native, learning_objectives, bloom_level, expected_minutes, chapter_id, curriculum_chapters(${chapterSelect})`)
        .eq('id', topicId)
        .maybeSingle();
      if (!t) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

      topics = [t as CurriculumTopicRow];
      const ch = (t as any).curriculum_chapters;
      resolvedChapterId = ch?.id ?? null;
      chapterTitle = ch?.title_en ?? '';
      subjectClassId = ch?.curriculum_subjects_by_class?.id;
      subjectSlug = ch?.curriculum_subjects_by_class?.subject_slug ?? '';
      subjectName = ch?.curriculum_subjects_by_class?.textbook_title_en || prettySubject(subjectSlug);
      classLevel = ch?.curriculum_subjects_by_class?.class_level ?? 8;
    } else {
      const { data: chapter } = await supabase
        .from('curriculum_chapters')
        .select(chapterSelect)
        .eq('id', chapterId)
        .maybeSingle();
      if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });

      chapterTitle = chapter.title_en;
      subjectClassId = chapter.curriculum_subjects_by_class?.id;
      subjectSlug = chapter.curriculum_subjects_by_class?.subject_slug ?? '';
      subjectName = chapter.curriculum_subjects_by_class?.textbook_title_en || prettySubject(subjectSlug);
      classLevel = chapter.curriculum_subjects_by_class?.class_level ?? 8;

      const { data: ts } = await supabase
        .from('curriculum_topics')
        .select('id, topic_no, title_en, title_native, learning_objectives, bloom_level, expected_minutes')
        .eq('chapter_id', chapterId)
        .order('topic_no', { ascending: true });
      topics = (ts || []) as CurriculumTopicRow[];
    }

    if (topics.length === 0) {
      return NextResponse.json({ error: 'This chapter has no topics yet' }, { status: 404 });
    }

    // --- Load the student's evidence --------------------------------------
    const [stats, globalPriors] = await Promise.all([
      loadRepStats(supabase, studentId, subjectClassId),
      loadGlobalPriors(supabase, { subjectName, classLevel }),
    ]);

    // --- Enrich, then classify --------------------------------------------
    // Enrichment is cached per topic, so this is a one-time cost per chapter.
    const enriched = await Promise.all(
      topics.map((t) => getOrCreateEnrichment(supabase, t, { subject: subjectName, classLevel })),
    );

    const warnings = Array.from(
      new Set(enriched.map((e) => e.warning).filter(Boolean) as string[]),
    );
    const generatedCount = enriched.filter((e) => e.usedModel).length;

    const allUnits = enriched.flatMap((e) => e.units);
    const classifications = classifyEnriched(allUnits as any, { subjectSlug, classLevel });

    if (classifications.length === 0) {
      return NextResponse.json({ error: 'Nothing to convert' }, { status: 422 });
    }

    // Best-effort audit cache; never blocks the lesson.
    void cacheClassifications(supabase, classifications, resolvedChapterId);

    // Total observations, shown so the UI can say how much is actually known.
    const { count: priorSessions } = await supabase
      .from('conversion_outcomes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', studentId);

    const plans = classifications.map((c) => {
      const selection = selectRepresentation({
        knowledgeType: c.type,
        subjectName,
        stats: stats[c.type],
        globalPriors: globalPriors[c.type],
        affinityBias: flavourBias(c),
      });
      const plan = buildConversionPlan(c, selection, subjectName);
      return {
        unitId: plan.unitId,
        topicId: c.topicId,
        heading: c.heading,
        body: c.body,
        source: c.source,

        knowledgeType: plan.knowledgeType,
        typeLabel: KNOWLEDGE_TYPE_LABEL[c.type],
        representation: plan.representation,
        representationLabel: REPRESENTATION_LABEL[selection.representation],

        companionInstruction: plan.companionInstruction,
        studentPrompt: plan.studentPrompt,
        checkQuestion: plan.checkQuestion,
        retentionProbeDays: plan.retentionProbeDays,

        honest: honestStatement(selection.observations, selection.representation, subjectName, c.type),
        rationale: selection.rationale,
        exploring: selection.exploring,
        evidence: selection.evidence,
        observations: selection.observations,

        // The audit trail — a teacher must be able to ask "why this way?"
        cues: c.cues,
        confidence: c.confidence,
        needsEnrichment: c.needsEnrichment,
        alsoLegal: legalRepresentations(c.type)
          .filter((r) => r !== selection.representation)
          .map((r) => REPRESENTATION_LABEL[r]),
      };
    });

    const mix = chapterMix(classifications);

    return NextResponse.json({
      success: true,
      studentId,
      subject: { id: subjectClassId, name: subjectName, slug: subjectSlug, classLevel },
      chapter: { id: resolvedChapterId, title: chapterTitle },
      // The headline: one chapter is several kinds of knowledge.
      mix: Object.entries(mix)
        .filter(([, v]) => (v as number) > 0)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([type, share]) => ({
          type,
          label: KNOWLEDGE_TYPE_LABEL[type as KnowledgeType],
          share: Math.round((share as number) * 100),
        })),
      unitCount: classifications.length,
      topicCount: topics.length,
      generatedTopics: generatedCount,
      observations: priorSessions || 0,
      warnings,
      plans,
    });
  } catch (error: any) {
    console.error('Conversion GET error:', error);
    return NextResponse.json({ error: error.message || 'Conversion failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const action = body.action || 'record';

    // ---- Resolve a retention probe --------------------------------------
    if (action === 'resolve_probe') {
      const { outcomeId, retentionScore } = body;
      if (!outcomeId || retentionScore == null) {
        return NextResponse.json({ error: 'outcomeId and retentionScore required' }, { status: 400 });
      }
      const { data: owned } = await supabase
        .from('conversion_outcomes')
        .select('id')
        .eq('id', outcomeId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await resolveRetentionProbe(supabase, outcomeId, clamp01(retentionScore, 0.5));
      return NextResponse.json({ success: true });
    }

    // ---- List probes that are due ---------------------------------------
    if (action === 'due_probes') {
      const probes = await dueRetentionProbes(supabase, user.id, Number(body.limit) || 10);
      return NextResponse.json({ success: true, probes });
    }

    // ---- Record one observation -----------------------------------------
    const {
      unitId, knowledgeType, representation,
      constructedOwn, immediateScore, retentionScore,
      engagementScore, completed, timeSpentSeconds,
      subjectId, subjectName, topicId, chapterId, retentionProbeDays,
      studentId,
    } = body;

    if (!unitId || !knowledgeType || !representation) {
      return NextResponse.json(
        { error: 'unitId, knowledgeType and representation required' },
        { status: 400 },
      );
    }

    // A teacher may record on behalf of a linked student.
    let targetId = user.id;
    if (studentId && studentId !== user.id) {
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('parent_id')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      targetId = studentId;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', targetId)
      .maybeSingle();

    const result = await recordConversionOutcome(supabase, {
      userId: targetId,
      unitId,
      knowledgeType,
      representation,
      constructedOwn: Boolean(constructedOwn),
      immediateScore: clamp01(immediateScore, 0.5),
      retentionScore: retentionScore == null ? null : clamp01(retentionScore, 0.5),
      engagementScore: clamp01(engagementScore, 0.5),
      completed: Boolean(completed),
      timeSpentSeconds: Number(timeSpentSeconds) || 0,
      subjectId,
      subjectName,
      topicId,
      chapterId,
      classLevel: profile?.current_class ?? undefined,
      retentionProbeDays: Number(retentionProbeDays) || undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Conversion POST error:', error);
    return NextResponse.json({ error: error.message || 'Record failed' }, { status: 500 });
  }
}

function clamp01(v: any, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function prettySubject(slug: string): string {
  if (!slug) return 'this subject';
  return slug
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
