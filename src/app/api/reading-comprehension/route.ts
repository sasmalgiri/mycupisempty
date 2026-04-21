/**
 * Reading Comprehension generator — creates a passage + questions on demand.
 *
 * Given a topic + class level + language (EN/HI/BN), the AI produces:
 *   - A passage (length scaled to class level)
 *   - 5 comprehension questions with answers
 *   - 1 vocabulary question (word-in-context)
 *   - 1 inference question
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { IP_AFFILIATION_RULES } from '@/lib/legal-prompts';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

type Language = 'en' | 'hi' | 'bn';

const LANG_NAMES: Record<Language, string> = {
  en: 'English', hi: 'Hindi (हिन्दी)', bn: 'Bengali (বাংলা)',
};

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { topic, language = 'en', genre } = body as { topic?: string; language?: Language; genre?: string };
    if (!LANG_NAMES[language]) return NextResponse.json({ error: 'Unsupported language' }, { status: 400 });
    if (!XAI_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', user.id)
      .single()
      .catch(() => ({ data: null }));
    const cls = profile?.current_class || 8;

    const wordTarget = cls <= 5 ? 150 : cls <= 8 ? 250 : cls <= 10 ? 350 : 450;

    const prompt = `${IP_AFFILIATION_RULES}

You are a language teacher for a Class ${cls} Indian student. Generate an ORIGINAL reading comprehension task (do NOT use passages from any textbook — write your own) in ${LANG_NAMES[language]}.

${topic ? `Topic: ${topic}` : 'Pick a topic appropriate for the class level (science, history, daily life, or Indian culture).'}
${genre ? `Genre: ${genre}` : 'Genre: narrative or informative.'}

Length: about ${wordTarget} words (scaled to Class ${cls}).

Return ONLY JSON in this shape (no prose wrapper):
{
  "title": "string in ${LANG_NAMES[language]}",
  "passage": "the passage text in ${LANG_NAMES[language]}, about ${wordTarget} words",
  "questions": [
    {
      "type": "factual" | "inference" | "vocabulary" | "main_idea",
      "question": "question in ${LANG_NAMES[language]}",
      "options": ["A", "B", "C", "D"],
      "answer": "A" | "B" | "C" | "D",
      "explanation": "short explanation in ${LANG_NAMES[language]}"
    }
  ]
}

Rules:
- Generate 7 questions total: 3 factual, 1 main_idea, 2 inference, 1 vocabulary (word-in-context).
- Indian cultural context preferred.
- Age-appropriate vocabulary for Class ${cls}.
- Answer letter must match options ordering.`;

    const res = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}` },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Please generate the reading comprehension task now.' },
        ],
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return NextResponse.json({ error: `AI ${res.status}: ${err.slice(0, 200)}` }, { status: 502 });
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    const text = typeof raw === 'string' ? raw : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: 'AI response unparseable' }, { status: 502 });
    const parsed = JSON.parse(match[0]);

    return NextResponse.json({ success: true, task: parsed });
  } catch (error: any) {
    console.error('Reading comprehension error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
