/**
 * Content Generator — on-demand examples, analogies, stories, simpler
 * explanations, real-world applications, or exam tips.
 *
 * When a student is stuck on a concept, they can hit "show me differently"
 * and we generate content in a new modality. This is the difference between
 * a static textbook and an infinite tutor.
 *
 * The AI is rooted in StudentState, so "show me an example" respects
 * their class level, method calibration, misconceptions, and mood.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState, generateAIContext } from '@/lib/student-state';
import { IP_AFFILIATION_RULES } from '@/lib/legal-prompts';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

type ContentType = 'example' | 'analogy' | 'story' | 'eli5' | 'real_world' | 'exam_tip' | 'mnemonic' | 'visual_description';

const TYPE_INSTRUCTIONS: Record<ContentType, string> = {
  example: `Give 2 concrete worked examples with full step-by-step solutions. Each should be slightly different (different numbers, different framing) to build flexibility. Keep each under 150 words.`,
  analogy: `Explain using a single vivid ANALOGY the student can hold in their head. Pick something from everyday Indian life (cricket, food, buses, family, Indian festivals). After the analogy, one line on what maps to what. Max 120 words.`,
  story: `Tell a SHORT story (3 paragraphs max) with a character the student can relate to, where the concept emerges naturally from a problem the character is solving. End with the concept stated plainly.`,
  eli5: `Explain this to a 5-year-old. No jargon AT ALL. Use only words a kindergartener knows. Short sentences. Every technical term must be defined in plain words. Max 100 words.`,
  real_world: `Show 3 real-world places where this concept is used in Indian daily life (e.g., banking, cooking, sports, transport, healthcare, shops). One line each. Then one surprising use most students don\'t know.`,
  exam_tip: `Share 3 exam-specific tips for this topic: (1) a common trap that wastes marks, (2) a shortcut or pattern that saves time, (3) a phrasing trick examiners use that students miss. Indian CBSE/ICSE/State-board context.`,
  mnemonic: `Create a SHORT mnemonic or memory hook. Could be an acronym, a silly sentence, a rhyme, or a visual image. Must actually help recall. Under 60 words. Explain briefly how the mnemonic maps to the concept.`,
  visual_description: `Describe in clear words what a diagram/visualization of this concept would look like — boxes, arrows, labels, colors, layout. So detailed that the student could draw it on paper. Max 200 words.`,
};

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { concept, contentType, subjectId, topicId } = body as {
      concept: string;
      contentType: ContentType;
      subjectId?: string;
      topicId?: string;
    };

    if (!concept || typeof concept !== 'string' || concept.trim().length < 2) {
      return NextResponse.json({ error: 'concept required' }, { status: 400 });
    }
    if (!TYPE_INSTRUCTIONS[contentType]) {
      return NextResponse.json({ error: 'Invalid contentType' }, { status: 400 });
    }
    if (!XAI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // Student state for contextual generation
    const state = await buildStudentState(supabase, user.id).catch(() => null);
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class, board_code')
      .eq('id', user.id)
      .single()
      .catch(() => ({ data: null }));
    const classLevel = profile?.current_class || state?.classLevel || 8;
    const board = profile?.board_code || 'CBSE';

    const studentContext = state ? generateAIContext(state, subjectId) : '';

    const prompt = `${IP_AFFILIATION_RULES}

You are generating educational content for a Class ${classLevel} Indian student who studies under the ${board} syllabus (stated only for topic alignment, not for any claim of affiliation).

CONCEPT: ${concept}

CONTENT TYPE: ${contentType}

INSTRUCTIONS: ${TYPE_INSTRUCTIONS[contentType]}

${studentContext}

RULES:
- Use Indian context (₹, kg/km, Indian names, local references)
- Never condescend — respect the student's intelligence
- Use Markdown formatting (bold, lists, headers) for readability
- Use LaTeX notation for any math ($...$ for inline, $$...$$ for display)
- Stay strictly educational — refuse non-educational requests

Generate now.`;

    let content = '';
    try {
      const aiResponse = await fetch(`${XAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: XAI_MODEL,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'Please generate the content now.' },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });
      if (!aiResponse.ok) throw new Error(`AI ${aiResponse.status}`);
      const data = await aiResponse.json();
      const raw = data.choices?.[0]?.message?.content;
      content = typeof raw === 'string' ? raw : '';
    } catch (aiErr: any) {
      console.error('Content gen failed:', aiErr);
      return NextResponse.json({
        error: 'Could not generate content right now. Try a different approach or check your connection.',
      }, { status: 502 });
    }

    if (!content || content.length < 20) {
      return NextResponse.json({ error: 'AI returned empty content' }, { status: 502 });
    }

    // Record signal — student wanted a different modality for this concept
    try {
      await supabase.from('learner_signals').insert({
        user_id: user.id,
        signal_type: 'content_gen_request',
        category: 'help_seeking',
        source: 'content_gen',
        subject_id: subjectId || null,
        value: 1,
        metadata: { concept, content_type: contentType, topic_id: topicId },
        created_at: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      contentType,
      concept,
      content,
    });
  } catch (error: any) {
    console.error('Content-gen error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
