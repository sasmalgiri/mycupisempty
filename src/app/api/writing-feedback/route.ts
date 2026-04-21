/**
 * Writing Feedback API — essay/paragraph analysis in English, Hindi, Bengali.
 *
 * Takes student's writing + optional rubric (class level, task type) and
 * returns structured feedback:
 *   - Scores: clarity, grammar, structure, vocabulary, creativity (0–10)
 *   - Grammar suggestions (with corrections inline)
 *   - Structure notes (intro/body/conclusion check)
 *   - Vocabulary upgrades (2–3 stronger word choices)
 *   - Encouraging next-step advice
 *
 * The AI is instructed to respond IN the same language as the writing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { IP_AFFILIATION_RULES } from '@/lib/legal-prompts';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

type Language = 'en' | 'hi' | 'bn';
type TaskType = 'essay' | 'paragraph' | 'letter' | 'story' | 'report' | 'summary' | 'free';

const LANG_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  bn: 'Bengali (বাংলা)',
};

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      text,
      language = 'en',
      taskType = 'essay',
      classLevel,
    } = body as { text: string; language: Language; taskType: TaskType; classLevel?: number };

    if (!text || text.trim().length < 30) {
      return NextResponse.json({ error: 'Please provide at least 30 characters of writing.' }, { status: 400 });
    }
    if (text.length > 12000) {
      return NextResponse.json({ error: 'Keep writing under 12,000 characters.' }, { status: 413 });
    }
    if (!LANG_NAMES[language]) {
      return NextResponse.json({ error: 'Unsupported language' }, { status: 400 });
    }
    if (!XAI_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', user.id)
      .single()
      .catch(() => ({ data: null }));
    const cls = classLevel || profile?.current_class || 8;

    const langName = LANG_NAMES[language];

    const prompt = `${IP_AFFILIATION_RULES}

You are a supportive language teacher for a Class ${cls} Indian student using general educational knowledge only. The student wrote the following ${taskType} in ${langName}.

STUDENT'S WRITING:
---
${text}
---

TASK: Analyze and give honest, encouraging feedback. RESPOND IN ${langName} for the feedback text fields (not the JSON keys). Never shame the student. Always celebrate effort before critique.

Return ONLY valid JSON in this shape:
{
  "overallScore": 0-10 integer,
  "scores": {
    "clarity": 0-10,
    "grammar": 0-10,
    "structure": 0-10,
    "vocabulary": 0-10,
    "creativity": 0-10
  },
  "strengths": ["1-2 specific things the student did well (in ${langName})"],
  "grammarFixes": [
    { "original": "exact quote from student's text", "corrected": "corrected version", "reason": "short explanation in ${langName}" }
  ],
  "structureNotes": "1-2 sentences in ${langName} about organization (intro/body/conclusion)",
  "vocabularyUpgrades": [
    { "word": "word the student used", "betterOption": "stronger alternative", "when": "context in ${langName}" }
  ],
  "nextStep": "One concrete next-step in ${langName} (what to try in the next draft)",
  "wordCount": <number of words>
}

Rules:
- Give at most 5 grammarFixes (pick the most impactful ones).
- Give at most 3 vocabularyUpgrades.
- All scores must be integers 0–10.
- overallScore should be a weighted average, biased toward honesty (if writing is weak, score honestly — but frame it as growth).
- Strengths list must have at least 1 entry. Never say "no strengths."`;

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
          { role: 'user', content: 'Please evaluate the writing now.' },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text().catch(() => '');
      return NextResponse.json({ error: `AI ${aiResponse.status}: ${err.slice(0, 200)}` }, { status: 502 });
    }

    const data = await aiResponse.json();
    const raw = data.choices?.[0]?.message?.content;
    const content = typeof raw === 'string' ? raw : '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: 'AI response could not be parsed' }, { status: 502 });
    }
    let feedback: any;
    try { feedback = JSON.parse(match[0]); }
    catch { return NextResponse.json({ error: 'Invalid feedback JSON' }, { status: 502 }); }

    // Record signal
    try {
      await supabase.from('learner_signals').insert({
        user_id: user.id,
        signal_type: 'writing_feedback',
        category: 'performance',
        source: 'writing_feedback',
        value: (feedback.overallScore || 0) / 10,
        metadata: {
          language,
          task_type: taskType,
          word_count: feedback.wordCount,
          scores: feedback.scores,
        },
        created_at: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({ success: true, feedback });
  } catch (error: any) {
    console.error('Writing feedback error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
