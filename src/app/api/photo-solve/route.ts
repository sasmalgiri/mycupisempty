/**
 * Photo-to-Solve
 *
 * Student snaps a textbook problem, AI reads it and solves step-by-step.
 * Every Indian ed-tech (Photomath, Socratic, PW, Embibe, BYJU's) has this —
 * it's table-stakes.
 *
 * We differentiate by:
 *   - Using the Guru's Socratic mode (doesn't just hand answer)
 *   - Recording the snapped problem as a "stuck signal" for StudentState
 *   - Detecting recurring photo types → misconception pattern
 *   - Respecting founder's education-only guardrail
 *
 * Uses Grok vision API (grok-4-vision if available, falls back to text-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState } from '@/lib/student-state';
import { generateAIContext } from '@/lib/student-state';
import { IP_AFFILIATION_RULES } from '@/lib/legal-prompts';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_VISION_MODEL = process.env.XAI_VISION_MODEL || 'grok-2-vision-latest';

const EDUCATION_GUARDRAIL = `
CRITICAL SAFETY: You are STRICTLY an educational tutor.
- Only help with Indian school curriculum problems (Class 1-12: Math, Science, English, Hindi, Social Science, etc.)
- If the image is not an educational problem (not homework, not a textbook page, not study material), politely decline: "This doesn't look like a study problem. Can you send me a homework or textbook question?"
- Never solve puzzles that are not educational (crosswords, games, CAPTCHAs, etc.)
- Refuse any content that is: adult, violent, political, private, or non-educational.
- If the image contains personal information or exam papers that look leaked, refuse.
`;

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { imageBase64, mode = 'socratic', subjectId, topicId } = body as {
      imageBase64?: string;
      mode?: 'socratic' | 'direct';
      subjectId?: string;
      topicId?: string;
    };

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 });
    }

    // Size guard — reject images over ~4MB base64
    if (imageBase64.length > 5_400_000) {
      return NextResponse.json({
        error: 'Image too large. Please resize to under 4MB.',
      }, { status: 413 });
    }

    // Build live student state for personalization
    let studentState;
    try { studentState = await buildStudentState(supabase, user.id); } catch {}

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', user.id)
      .single()
      .catch(() => ({ data: null }));
    const classLevel = profile?.current_class || 8;

    // Build the vision prompt
    const modeInstructions = mode === 'socratic'
      ? `Use the Socratic method. After reading the problem, don't give the answer. Ask ONE guiding question that helps the student take the first step. Then wait — in the next turn they'll respond.`
      : `Solve step-by-step. Show every step clearly. Explain the reasoning. At the end, summarize the key concept.`;

    const systemPrompt = `${IP_AFFILIATION_RULES}
${EDUCATION_GUARDRAIL}
You are helping a Class ${classLevel} Indian student who snapped a photo of a study problem.
${studentState ? generateAIContext(studentState, subjectId) : ''}

${modeInstructions}

Your response MUST be:
1. Written in clear, age-appropriate language for Class ${classLevel}
2. Formatted well: use newlines, numbered steps, and key terms in **bold**
3. Encouraging in tone — never make the student feel bad for asking
4. Honest — if the image is unclear, say so and ask them to re-take
5. Safe — refuse anything outside the school curriculum
`;

    // Call Grok vision
    if (!XAI_API_KEY) {
      return NextResponse.json({
        error: 'AI service not configured. Please try text chat instead.',
      }, { status: 503 });
    }

    let solution = '';
    let extractedProblem = '';

    try {
      const visionResponse = await fetch(`${XAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: XAI_VISION_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Here\'s the problem I\'m stuck on. Please help me understand it.' },
                { type: 'image_url', image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } },
              ],
            },
          ],
          temperature: 0.4,
          max_tokens: 1200,
        }),
      });

      if (!visionResponse.ok) {
        const errText = await visionResponse.text().catch(() => '');
        throw new Error(`Vision API error ${visionResponse.status}: ${errText}`);
      }

      const data = await visionResponse.json();
      const rawContent = data.choices?.[0]?.message?.content;
      solution = typeof rawContent === 'string' ? rawContent : '';

      // Also extract what the problem was (best-effort) for signal recording
      const firstLine = solution && typeof solution === 'string'
        ? solution.split('\n').find((l: string) => l.trim().length > 10)
        : undefined;
      extractedProblem = firstLine?.slice(0, 200) || 'Photo problem';
    } catch (visionErr: any) {
      console.error('Vision API failed:', visionErr);
      return NextResponse.json({
        error: 'Could not read the image. Please make sure the problem is clear and well-lit, or try typing the question instead.',
      }, { status: 502 });
    }

    // Record the photo-solve event as a "stuck signal" — feeds StudentState
    try {
      await supabase.from('learner_signals').insert({
        user_id: user.id,
        signal_type: 'photo_solve_request',
        category: 'help_seeking',
        source: 'photo_solve',
        subject_id: subjectId || null,
        value: 1,
        metadata: {
          topic_id: topicId,
          mode,
          problem_preview: extractedProblem,
          solution_length: solution.length,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      solution,
      mode,
    });
  } catch (error: any) {
    console.error('Photo-solve error:', error);
    return NextResponse.json({
      error: error.message || 'Could not solve from photo',
    }, { status: 500 });
  }
}
