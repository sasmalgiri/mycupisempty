/**
 * AI-Generated Practice Sets — on-demand, targeted to weakness.
 *
 * Every competitor has a static question bank. Embibe has AI-gen but
 * it's a premium feature. We make it free and adaptive:
 *
 * - Reads student's StudentState: finds their weakest topic + most common
 *   error pattern
 * - Generates 5 practice questions targeted at THAT error, at the right
 *   difficulty, using their best-calibrated teaching method framing
 * - Each question includes a hint + a "common-wrong" distractor (the
 *   specific error we're attacking)
 *
 * This closes the loop: StudentState → Intervention → Generated practice
 * → Signals → StudentState.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState } from '@/lib/student-state';
import { detectInterventions } from '@/lib/intervention-engine';
import { IP_AFFILIATION_RULES } from '@/lib/legal-prompts';
import { loadActiveDirectives, adaptationDelta, deltaToPromptBlock } from '@/lib/directive-adapter';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_answer: string;
  hint: string;
  explanation: string;
  targets_error: string;      // which error this problem targets
  difficulty: 'easy' | 'medium' | 'hard';
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      subjectId,
      topicId,
      count = 5,
      focusPattern,  // optional: specific mistake pattern to target
      difficulty,    // optional: 'easy' | 'medium' | 'hard'
    } = body;

    if (!XAI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // Build live student state for targeting
    const state = await buildStudentState(supabase, user.id).catch(() => null);
    if (!state) {
      return NextResponse.json({ error: 'Could not build student state' }, { status: 500 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class, board_code')
      .eq('id', user.id)
      .single()
      .catch(() => ({ data: null }));
    const classLevel = profile?.current_class || state.classLevel;
    const board = profile?.board_code || 'CBSE';

    // Determine target
    const subjectState = subjectId ? state.subjectStates[subjectId] : null;
    const subjectName = subjectState?.subjectName || 'Mathematics';

    // Pick the mistake pattern to target
    const interventions = detectInterventions(state, subjectId);
    const targetPattern = focusPattern
      || interventions[0]?.triggerPattern
      || subjectState?.commonErrors[0]
      || 'general_practice';

    // Topic info
    let topicName = 'the current topic';
    if (topicId) {
      const { data: topic } = await supabase
        .from('topics')
        .select('title')
        .eq('id', topicId)
        .single()
        .catch(() => ({ data: null }));
      if (topic?.title) topicName = topic.title;
    }

    // Base difficulty: use adaptation
    let targetDifficulty = difficulty
      || (subjectState?.currentBand === 'foundation' ? 'easy'
      : subjectState?.currentBand === 'advanced' ? 'hard'
      : 'medium');

    // Apply main-brain directives (ease_up / push_harder)
    const directives = await loadActiveDirectives(supabase, user.id);
    const delta = adaptationDelta(directives);
    if (delta.difficultyAdjust < 0) {
      targetDifficulty = targetDifficulty === 'hard' ? 'medium' : 'easy';
    } else if (delta.difficultyAdjust > 0) {
      targetDifficulty = targetDifficulty === 'easy' ? 'medium' : 'hard';
    }
    const directiveBlock = deltaToPromptBlock(delta);

    // Build generation prompt
    const prompt = `${IP_AFFILIATION_RULES}
${directiveBlock ? '\n' + directiveBlock + '\n' : ''}

You are generating ${count} high-quality, ORIGINAL MCQ practice questions (never copied from any textbook or question paper) for a Class ${classLevel} student whose syllabus is ${board} — stated only to align topic scope, not to claim affiliation. Subject: ${subjectName}. Topic: ${topicName}.

TARGETING: The student is repeatedly making this mistake: "${targetPattern}". Every question you generate must EXPOSE this specific error. One of the wrong options must be the answer a student with this exact misconception would pick.

DIFFICULTY: ${targetDifficulty}

STUDENT CONTEXT:
- Mastery band in this subject: ${subjectState?.currentBand || 'developing'}
- Recent accuracy: ${subjectState ? Math.round(subjectState.recentAccuracy * 100) : 50}%
- Attention span: short — questions must be concise

RULES:
- Generate EXACTLY ${count} MCQ questions
- Each question has 4 options (A, B, C, D)
- One option is correct; one option is the "trap" that matches the target error
- Use Indian curriculum context (₹ for money, kg/km/°C for units, Indian names for word problems)
- Include a short hint (one line) and a clear explanation
- Return ONLY valid JSON matching this schema:

{
  "questions": [
    {
      "question_text": "string",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "A",
      "hint": "one-line hint",
      "explanation": "one-paragraph explanation focused on WHY the correct answer is correct and why the trap is wrong",
      "targets_error": "${targetPattern}",
      "difficulty": "${targetDifficulty}"
    }
  ]
}

Generate now. Respond with ONLY the JSON, no prose wrapper.`;

    let questions: GeneratedQuestion[] = [];
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
            { role: 'user', content: 'Please generate the practice questions now.' },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text().catch(() => '');
        throw new Error(`AI ${aiResponse.status}: ${errText}`);
      }

      const data = await aiResponse.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);
      questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    } catch (aiErr: any) {
      console.error('AI generation failed:', aiErr);
      return NextResponse.json({
        error: 'Could not generate practice this time. Try a different topic, or check your connection.',
      }, { status: 502 });
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: 'AI returned no questions' }, { status: 502 });
    }

    // Persist as a practice set
    let practiceSetId: string | null = null;
    try {
      const { data: inserted } = await supabase
        .from('generated_practice_sets')
        .insert({
          user_id: user.id,
          subject_id: subjectId || null,
          topic_id: topicId || null,
          target_pattern: targetPattern,
          difficulty: targetDifficulty,
          questions,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();
      practiceSetId = inserted?.id || null;
    } catch {
      // table may not exist yet — silently continue
    }

    return NextResponse.json({
      success: true,
      practiceSetId,
      targetPattern,
      difficulty: targetDifficulty,
      subject: subjectName,
      topic: topicName,
      questions,
      metacognitivePrompt: 'Before each answer, rate how confident you are (1-5). This builds self-awareness — a real exam superpower.',
    });
  } catch (error: any) {
    console.error('Practice-generate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
