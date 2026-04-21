/**
 * Dictionary lookup API — word → meaning, examples, translations.
 *
 * English uses free dictionaryapi.dev (no key). For Hindi / Bengali we use
 * our AI (Grok) to generate a structured entry (meaning, example, synonyms,
 * usage notes) — no licensed dictionary needed for K-12 scope.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { IP_AFFILIATION_RULES } from '@/lib/legal-prompts';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

type Language = 'en' | 'hi' | 'bn';

interface DictionaryEntry {
  word: string;
  language: Language;
  pronunciation?: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: string[];
    example?: string;
    synonyms?: string[];
    antonyms?: string[];
  }>;
  translations?: {
    en?: string;
    hi?: string;
    bn?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const word = url.searchParams.get('word')?.trim();
    const language = (url.searchParams.get('language') || 'en') as Language;

    if (!word) return NextResponse.json({ error: 'word required' }, { status: 400 });
    if (word.length > 80) return NextResponse.json({ error: 'word too long' }, { status: 400 });

    if (language === 'en') {
      const entry = await lookupEnglish(word);
      if (entry) return NextResponse.json({ success: true, entry });
      // Fall through to AI if free API didn't return
    }

    if (!XAI_API_KEY) {
      return NextResponse.json({ error: 'Dictionary AI not configured' }, { status: 503 });
    }
    const aiEntry = await lookupWithAI(word, language);
    return NextResponse.json({ success: true, entry: aiEntry });
  } catch (error: any) {
    console.error('Dictionary error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function lookupEnglish(word: string): Promise<DictionaryEntry | null> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data) && data[0];
    if (!first) return null;
    return {
      word: first.word || word,
      language: 'en',
      pronunciation: first.phonetic || first.phonetics?.[0]?.text,
      meanings: (first.meanings || []).map((m: any) => ({
        partOfSpeech: m.partOfSpeech || '',
        definitions: (m.definitions || []).slice(0, 3).map((d: any) => d.definition).filter(Boolean),
        example: m.definitions?.[0]?.example,
        synonyms: (m.synonyms || []).slice(0, 6),
        antonyms: (m.antonyms || []).slice(0, 4),
      })).slice(0, 3),
    };
  } catch {
    return null;
  }
}

async function lookupWithAI(word: string, language: Language): Promise<DictionaryEntry> {
  const langName = language === 'en' ? 'English' : language === 'hi' ? 'Hindi' : 'Bengali';

  const prompt = `${IP_AFFILIATION_RULES}

You are a dictionary for Indian K-12 students. Use general publicly-available linguistic knowledge only.

WORD: ${word}
LANGUAGE: ${langName}

Return ONLY valid JSON matching this exact shape (no prose):
{
  "word": "${word}",
  "language": "${language}",
  "pronunciation": "IPA or transliteration, optional",
  "meanings": [
    {
      "partOfSpeech": "noun|verb|adjective|adverb|...",
      "definitions": ["up to 3 short definitions in ${langName}"],
      "example": "one short example sentence in ${langName}",
      "synonyms": ["up to 4 synonyms"],
      "antonyms": ["up to 2 antonyms"]
    }
  ],
  "translations": {
    "en": "English translation (if source is not English)",
    "hi": "Hindi translation (if source is not Hindi)",
    "bn": "Bengali translation (if source is not Bengali)"
  }
}

If the word doesn't exist in ${langName}, return {"error": "not found"}.`;

  const res = await fetch(`${XAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Please look up the word now.' },
      ],
      temperature: 0.2,
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  const text = typeof raw === 'string' ? raw : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in AI response');
  const parsed = JSON.parse(match[0]);
  if (parsed.error) throw new Error(parsed.error);
  return parsed as DictionaryEntry;
}
