/**
 * Per-chapter Concept Sheet — the one-page must-know summary.
 *
 * GET ?chapterId=...&style=visual&persona=curious
 *   Returns a cached concept_sheets row matching (chapter, language, style, persona).
 *   Falls back from (style+persona) → (style) → (persona) → generic.
 *   If nothing exists and ?generate=1, calls Gemini to create the sheet,
 *   persists it (so the next student of the same profile reads from cache).
 *
 * The sheet is 5-7 must-know facts, the formulas/rules, common mistakes,
 * exam-pattern tip — all derived from the chapter, never from copyrighted
 * textbook prose.
 */

import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase';
import { geminiGenerateJSON, isGeminiConfigured } from '@/lib/gemini';

type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'mixed';
type PersonaAxis = 'high_perfectionist' | 'low_effort' | 'curious' | 'social' | 'quiet' | 'impatient' | 'steady';

const VALID_STYLES: LearningStyle[] = ['visual', 'auditory', 'reading', 'kinesthetic', 'mixed'];
const VALID_PERSONAS: PersonaAxis[] = ['high_perfectionist', 'low_effort', 'curious', 'social', 'quiet', 'impatient', 'steady'];

interface ConceptSheetBody {
  must_know: Array<{ fact: string; why_it_matters: string; example?: string }>;
  formulas: Array<{ name: string; formula_md: string; when_to_use: string }>;
  common_mistakes: Array<{ mistake: string; why_wrong: string; fix: string }>;
  exam_pattern_tip: string;
}

function styleHint(style: LearningStyle | null): string {
  switch (style) {
    case 'visual':       return 'Use vivid imagery and visual metaphors. Suggest a doodle for each fact.';
    case 'auditory':     return 'Use rhythmic phrasing, mnemonics that rhyme, and "say it out loud" cues.';
    case 'reading':      return 'Use precise definitions and short paragraphs.';
    case 'kinesthetic':  return 'Use real-world actions and physical analogies. Suggest tracing or hand gestures.';
    default:             return 'Mix imagery, definitions, and a one-line action.';
  }
}

function personaHint(persona: PersonaAxis | null): string {
  switch (persona) {
    case 'high_perfectionist': return 'Reassure that getting facts ~80% right is fine; emphasise the few essentials.';
    case 'low_effort':         return 'Keep each fact under 12 words. Front-load the easiest wins.';
    case 'curious':            return 'Add one "why does this exist?" angle per fact.';
    case 'social':             return 'Use we/us framing and "explain to a friend" cues.';
    case 'quiet':              return 'Use solo-study framing; no group cues.';
    case 'impatient':          return 'Lead with the answer, then the reason.';
    case 'steady':             return 'Use orderly numbered structure.';
    default:                   return 'Neutral, friendly tone for a 10-year-old.';
  }
}

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const chapterId = url.searchParams.get('chapterId');
    if (!chapterId) return NextResponse.json({ error: 'chapterId required' }, { status: 400 });

    const styleParam = url.searchParams.get('style') as LearningStyle | null;
    const style = styleParam && VALID_STYLES.includes(styleParam) ? styleParam : null;
    const personaParam = url.searchParams.get('persona') as PersonaAxis | null;
    const persona = personaParam && VALID_PERSONAS.includes(personaParam) ? personaParam : null;
    const language = url.searchParams.get('lang') || 'bn';
    const shouldGenerate = url.searchParams.get('generate') === '1';

    // Try most-specific match first, fall back gradually.
    const fallbackTuples: Array<[LearningStyle | null, PersonaAxis | null]> = [
      [style, persona],
      [style, null],
      [null, persona],
      [null, null],
    ];

    for (const [s, p] of fallbackTuples) {
      let q = supabase
        .from('concept_sheets')
        .select('*')
        .eq('chapter_id', chapterId)
        .eq('language', language);
      q = s ? q.eq('learning_style', s) : q.is('learning_style', null);
      q = p ? q.eq('persona_axis', p) : q.is('persona_axis', null);
      const { data } = await q.maybeSingle();
      if (data) return NextResponse.json({ success: true, sheet: data, matchedStyle: s, matchedPersona: p });
    }

    if (!shouldGenerate) {
      return NextResponse.json({ success: true, sheet: null });
    }

    // Generate via Gemini.
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'Gemini not configured. Set GEMINI_API_KEY.' }, { status: 503 });
    }
    const { data: chapter } = await supabase
      .from('curriculum_chapters')
      .select('id, title_en, title_native, description, season_hint, summative_no, curriculum_subjects_by_class!inner(subject_slug, class_level, board_code)')
      .eq('id', chapterId)
      .maybeSingle();
    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });

    const ctx = chapter.curriculum_subjects_by_class as any;
    const langName = language === 'bn' ? 'Bengali' : language === 'hi' ? 'Hindi' : 'English';

    const prompt = `You are writing a ONE-PAGE concept sheet for a Class ${ctx.class_level} ${ctx.board_code.toUpperCase()} student studying "${chapter.title_en}" (${ctx.subject_slug}).

Write in ${langName}. ${styleHint(style)} ${personaHint(persona)}

Output STRICTLY this JSON:
{
  "must_know": [{"fact":"...","why_it_matters":"...","example":"..."}, ...5-7 items],
  "formulas": [{"name":"...","formula_md":"...","when_to_use":"..."}, ...0-4 items],
  "common_mistakes": [{"mistake":"...","why_wrong":"...","fix":"..."}, ...3-5 items],
  "exam_pattern_tip": "one short sentence on how this chapter typically appears in the exam paper"
}

Constraints:
- Do NOT copy textbook prose. Write fresh.
- A 10-year-old must be able to read each fact in under 8 seconds.
- Stay tight to the chapter title; do NOT bring in advanced material from later classes.
- Each "fact" must be ≤ 14 words.
- "formula_md" can use simple LaTeX-ish markdown.

Chapter description: ${chapter.description || '(none)'}
Season hint: ${chapter.season_hint || 'flexible'}
Summative window: ${chapter.summative_no || 'carry-over'}`;

    const result = await geminiGenerateJSON<ConceptSheetBody>(prompt, { temperature: 0.5 });
    if (!result.ok || !result.data) {
      return NextResponse.json({ error: result.error || 'Gemini returned nothing' }, { status: 502 });
    }

    const admin: any = createAdminClient();
    const { data: inserted, error: insErr } = await admin
      .from('concept_sheets')
      .upsert({
        chapter_id: chapterId,
        language,
        learning_style: style,
        persona_axis: persona,
        must_know: result.data.must_know || [],
        formulas: result.data.formulas || [],
        common_mistakes: result.data.common_mistakes || [],
        exam_pattern_tip: result.data.exam_pattern_tip || '',
        generator: 'gemini',
      }, { onConflict: 'chapter_id,language,learning_style,persona_axis' })
      .select()
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({ success: true, sheet: inserted, matchedStyle: style, matchedPersona: persona, generated: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
