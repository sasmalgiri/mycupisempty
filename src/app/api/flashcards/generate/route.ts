/**
 * Auto-Flashcard Generation from any content.
 *
 * Quizlet's "Magic Notes" and Anki power-users manually craft flashcards.
 * We do it automatically: paste a textbook paragraph, an AI chat session,
 * or a PDF extract, and we produce high-quality flashcards tagged to the
 * right topic + difficulty.
 *
 * The cards are SEEDED into the spaced-rep system (flashcards table with
 * SM-2) so they enter the review queue immediately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { IP_AFFILIATION_RULES } from '@/lib/legal-prompts';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

interface GeneratedCard {
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'definition' | 'concept' | 'formula' | 'example' | 'fact';
  hint?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      content,               // textbook text or chat transcript
      subjectId,
      topicId,
      count = 8,
      includeTypes = ['definition', 'concept', 'formula'],
    } = body;

    if (!content || typeof content !== 'string' || content.trim().length < 30) {
      return NextResponse.json({ error: 'Need at least 30 characters of content' }, { status: 400 });
    }
    if (content.length > 15000) {
      return NextResponse.json({ error: 'Content too long — please send max 15,000 characters' }, { status: 413 });
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
    const classLevel = profile?.current_class || 8;

    let topicName = '';
    let subjectName = '';
    if (topicId) {
      const { data: topic } = await supabase
        .from('topics')
        .select('title, subjects(title)')
        .eq('id', topicId)
        .single()
        .catch(() => ({ data: null }));
      topicName = topic?.title || '';
      subjectName = topic?.subjects?.title || '';
    }

    const prompt = `${IP_AFFILIATION_RULES}

You are generating ORIGINAL flashcards (re-written in your own words, never verbatim copies) for a Class ${classLevel} Indian student from this source material:

---
${content}
---

${topicName ? `Topic: ${topicName}\nSubject: ${subjectName}\n` : ''}

Produce EXACTLY ${count} flashcards that:
1. Cover the most important facts, definitions, concepts, and formulas
2. Each card has a short FRONT (question/prompt, max 20 words) and a short BACK (answer, max 40 words)
3. Mix these types: ${includeTypes.join(', ')}
4. Span difficulty: some easy (recall), some medium (apply), one or two hard (synthesize)
5. Use Indian curriculum terminology
6. The FRONT must be answerable from the BACK alone — no "see above" references

Return ONLY valid JSON in this exact shape, no prose wrapper:
{
  "cards": [
    {
      "front": "...",
      "back": "...",
      "difficulty": "easy" | "medium" | "hard",
      "type": "definition" | "concept" | "formula" | "example" | "fact",
      "hint": "optional short hint"
    }
  ]
}`;

    let cards: GeneratedCard[] = [];
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
            { role: 'user', content: 'Please generate the flashcards now.' },
          ],
          temperature: 0.5,
          max_tokens: 2000,
        }),
      });
      if (!aiResponse.ok) throw new Error(`AI ${aiResponse.status}`);
      const data = await aiResponse.json();
      const rawContent = data.choices?.[0]?.message?.content;
      const text = typeof rawContent === 'string' ? rawContent : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);
      cards = Array.isArray(parsed.cards) ? parsed.cards : [];
    } catch (aiErr: any) {
      console.error('Flashcard AI generation failed:', aiErr);
      return NextResponse.json({
        error: 'Could not generate cards right now. Try shorter content or different topic.',
      }, { status: 502 });
    }

    if (cards.length === 0) {
      return NextResponse.json({ error: 'AI returned no cards' }, { status: 502 });
    }

    // Persist into flashcards table + seed spaced-rep state
    const now = new Date().toISOString();
    const insertRows = cards.map((c) => ({
      user_id: user.id,
      topic_id: topicId || null,
      subject_id: subjectId || null,
      front: c.front,
      back: c.back,
      difficulty: c.difficulty,
      card_type: c.type,
      hint: c.hint || null,
      ease_factor: 2.5,
      interval_days: 1,
      next_review_at: now,
      source: 'ai_generated',
      created_at: now,
    }));

    let savedCount = 0;
    try {
      const { data: saved } = await supabase
        .from('flashcards')
        .insert(insertRows)
        .select('id');
      savedCount = saved?.length || 0;
    } catch (persistErr) {
      console.error('Flashcard persist failed (non-fatal):', persistErr);
    }

    return NextResponse.json({
      success: true,
      cards,
      savedCount,
      message: savedCount > 0
        ? `${savedCount} cards added to your review queue — they'll appear in Flashcards.`
        : 'Cards generated. Saving to review queue may be unavailable right now.',
    });
  } catch (error: any) {
    console.error('Flashcard generate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
