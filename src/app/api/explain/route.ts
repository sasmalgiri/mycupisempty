/**
 * Explain Differently — when a student says "I don't get it".
 *
 * GET ?chapterId=...&topicId=...&style=story|step_by_step|analogy|...
 *   → returns a cached explanation for this (user, chapter, topic, style) if
 *     it exists; otherwise generates a fresh one via Gemini, persists, returns
 * POST { explanationId, helpful: boolean } → student rates the explanation
 *
 * Critical constraint: the model is told NOT to reproduce textbook prose.
 * Every explanation is a fresh original walkthrough tailored to the student's
 * persona axes + the companion overlay for their class.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { geminiGenerate, isGeminiConfigured } from '@/lib/gemini';

type Style = 'analogy' | 'step_by_step' | 'story' | 'visual_described' | 'numerical_walkthrough' | 'predict_then_reveal';
const VALID_STYLES: Style[] = ['analogy', 'step_by_step', 'story', 'visual_described', 'numerical_walkthrough', 'predict_then_reveal'];

const STYLE_INSTRUCTIONS: Record<Style, string> = {
  analogy: 'Use one strong analogy from everyday Indian life (cricket, kitchen, traffic, family) that maps onto the concept faithfully. Then say "now in textbook terms..." and connect.',
  step_by_step: 'Walk through the concept in 4-6 numbered steps. Each step is one short sentence. End with one worked example.',
  story: 'Tell a short story (max 80 words) where a character encounters this concept. Then say "the idea here is..." and state it cleanly.',
  visual_described: 'Describe a picture or diagram in words so vivid the student can sketch it. Then explain what each labelled part does.',
  numerical_walkthrough: 'Pick one concrete example with numbers. Compute slowly, justifying each step. End with what the answer means.',
  predict_then_reveal: 'Pose ONE prediction question first ("what do you think happens if..."), then reveal the answer with reasoning. Force the student to commit before revealing.',
};

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const chapterId = url.searchParams.get('chapterId');
    const topicId = url.searchParams.get('topicId');
    const styleParam = (url.searchParams.get('style') || 'analogy') as Style;
    const style: Style = VALID_STYLES.includes(styleParam) ? styleParam : 'analogy';
    const force = url.searchParams.get('force') === '1';
    const confusionNote = url.searchParams.get('q')?.slice(0, 500) || null;

    if (!chapterId) return NextResponse.json({ error: 'chapterId required' }, { status: 400 });

    // Cache check — same student + chapter + topic + style
    if (!force) {
      let cacheQuery = supabase
        .from('chapter_explanations')
        .select('*')
        .eq('user_id', user.id)
        .eq('chapter_id', chapterId)
        .eq('style', style)
        .order('generated_at', { ascending: false })
        .limit(1);
      if (topicId) cacheQuery = cacheQuery.eq('topic_id', topicId);
      else cacheQuery = cacheQuery.is('topic_id', null);
      const { data: cached } = await cacheQuery.maybeSingle();
      if (cached) return NextResponse.json({ success: true, explanation: cached, cached: true });
    }

    // Pull chapter context (NOT prose — just title + description + objectives)
    const { data: chapter } = await supabase
      .from('curriculum_chapters')
      .select('id, title_en, description, subject_class_id, maturity_band')
      .eq('id', chapterId)
      .maybeSingle();
    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });

    const { data: scc } = await supabase
      .from('curriculum_subjects_by_class')
      .select('class_level, language, subject_slug')
      .eq('id', chapter.subject_class_id)
      .maybeSingle();

    let topicTitle: string | null = null;
    let topicObjectives: string[] = [];
    if (topicId) {
      const { data: topic } = await supabase
        .from('curriculum_topics')
        .select('title_en, learning_objectives')
        .eq('id', topicId)
        .maybeSingle();
      topicTitle = topic?.title_en || null;
      topicObjectives = topic?.learning_objectives || [];
    }

    // Persona snapshot
    const { data: persona } = await supabase
      .from('persona_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Interests for personalization
    const { data: interests } = await supabase
      .from('interests')
      .select('interest, weight')
      .eq('user_id', user.id)
      .order('weight', { ascending: false })
      .limit(5);
    const interestList = (interests || []).map((r: any) => r.interest);

    if (!isGeminiConfigured()) {
      // Fallback explanation — no AI
      const fallback = `Let's slow down on "${topicTitle || chapter.title_en}". Try saying it back to yourself in your own words. If you still feel stuck, ask your companion to walk you through one example step by step.`;
      const { data: row } = await supabase.from('chapter_explanations').insert({
        user_id: user.id,
        chapter_id: chapterId,
        topic_id: topicId || null,
        style,
        confusion_note: confusionNote,
        persona_snapshot: persona || {},
        body_md: fallback,
        generator: 'fallback',
      }).select().single();
      return NextResponse.json({ success: true, explanation: row, cached: false, source: 'fallback' });
    }

    const langName = scc?.language === 'bn' ? 'Bengali' : scc?.language === 'hi' ? 'Hindi' : 'English';
    const prompt = `A class ${scc?.class_level || 8} student is stuck on "${topicTitle || chapter.title_en}" ${scc?.subject_slug ? `(${scc.subject_slug})` : ''}.

${chapter.description ? `Chapter scope: ${chapter.description}` : ''}
${topicObjectives.length ? `Learning objectives: ${topicObjectives.slice(0, 4).join('; ')}` : ''}
${confusionNote ? `Their stated confusion: "${confusionNote}"` : ''}

Persona:
${persona?.curiosity_breadth != null ? `- curiosity ${(persona.curiosity_breadth * 100).toFixed(0)}/100` : ''}
${persona?.effort_tolerance != null ? `- effort tolerance ${(persona.effort_tolerance * 100).toFixed(0)}/100 — ${(persona.effort_tolerance < 0.4) ? 'gets discouraged on hard problems' : 'pushes through difficulty'}` : ''}
${persona?.reading_fluency != null ? `- reading fluency ${(persona.reading_fluency * 100).toFixed(0)}/100` : ''}
${interestList.length ? `- interests: ${interestList.join(', ')}` : ''}

Style for this re-explanation: ${style.replace(/_/g, ' ')}.
${STYLE_INSTRUCTIONS[style]}

CRITICAL: Write a FRESH original explanation. DO NOT reproduce or paraphrase textbook prose. Use your own words and a fresh example.

Respond in ${langName}. ~150-200 words. Markdown OK. End with one tiny self-check question the student can answer in 10 seconds.`;

    const ai = await geminiGenerate(prompt, {
      temperature: 0.85,
      maxOutputTokens: 700,
      timeoutMs: 25_000,
    });

    let body = ai.text || '';
    let generator = 'gemini';
    if (!ai.ok || !body) {
      body = `Let's slow down on "${topicTitle || chapter.title_en}". Try saying it back to yourself in your own words. If still stuck, ask in chat for a step-by-step walk-through.`;
      generator = 'fallback';
    }

    const { data: row, error } = await supabase.from('chapter_explanations').insert({
      user_id: user.id,
      chapter_id: chapterId,
      topic_id: topicId || null,
      style,
      confusion_note: confusionNote,
      persona_snapshot: persona || {},
      body_md: body,
      generator,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, explanation: row, cached: false, source: generator });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body.explanationId) return NextResponse.json({ error: 'explanationId required' }, { status: 400 });
    const helpful = !!body.helpful;
    await supabase
      .from('chapter_explanations')
      .update({ helpful, helpful_rated_at: new Date().toISOString() })
      .eq('id', body.explanationId)
      .eq('user_id', user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
