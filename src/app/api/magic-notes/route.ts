/**
 * Magic Notes API — student photographs notes; we OCR + extract concepts +
 * stage flashcards and a practice set.
 *
 * Pipeline (server-side staged; AI calls deliberately abstracted so this
 * commit ships without cloud dependencies):
 *
 *   POST { storagePath } → create notes_uploads row, status='pending'
 *   POST { uploadId, action: 'process' } → kicks the local stub processor
 *      (currently extracts concepts heuristically from ocr_text if present;
 *       AI-enabled when OPENAI/anthropic key is added).
 *   POST { uploadId, action: 'mark_ready', concepts, cardIds, practiceIds }
 *      → admin/worker hook for the eventual extractor service
 *   GET ?id=...           → status of one upload
 *   GET                   → list user's recent uploads
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { geminiGenerateJSON, isGeminiConfigured } from '@/lib/gemini';

export async function GET(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (id) {
      const { data } = await supabase
        .from('notes_uploads')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, upload: data });
    }
    const { data: rows } = await supabase
      .from('notes_uploads')
      .select('id, status, extracted_concepts, generated_card_ids, generated_practice_ids, created_at, ready_at, error')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    return NextResponse.json({ success: true, uploads: rows || [] });
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

    if (body.action === 'process' && body.uploadId) {
      const { data: row } = await supabase
        .from('notes_uploads')
        .select('*')
        .eq('id', body.uploadId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!row) return NextResponse.json({ error: 'Upload not found' }, { status: 404 });

      await supabase.from('notes_uploads').update({ status: 'processing' }).eq('id', row.id);

      const text: string = row.ocr_text || '';
      let concepts: string[] = [];
      let suggestedFlashcards: Array<{ front: string; back: string }> = [];
      let aiUsed = false;

      // Prefer Gemini extraction when configured. Falls back to heuristic
      // line-splitting so this works without keys.
      if (isGeminiConfigured() && text.trim()) {
        const ai = await geminiGenerateJSON<{ concepts: string[]; flashcards: Array<{ front: string; back: string }> }>(
          `These are class notes (raw, possibly messy) from an Indian K-12 student:

---
${text.slice(0, 4000)}
---

Extract:
1. The 3-10 most important concepts as short bullet labels (max 80 chars each).
2. 5-10 atomic flashcard pairs ({ front: a question or term, back: the concise answer/definition }). Front must NOT be the answer; back must be unambiguous.

Return JSON: { "concepts": [...], "flashcards": [{ "front": "...", "back": "..." }, ...] }`,
          { temperature: 0.4, maxOutputTokens: 1200 },
        );
        if (ai.ok && ai.data) {
          concepts = Array.isArray(ai.data.concepts) ? ai.data.concepts.slice(0, 12).map((c) => String(c).slice(0, 120)) : [];
          suggestedFlashcards = Array.isArray(ai.data.flashcards)
            ? ai.data.flashcards.slice(0, 12).filter((f) => f?.front && f?.back).map((f) => ({ front: String(f.front).slice(0, 240), back: String(f.back).slice(0, 480) }))
            : [];
          aiUsed = true;
        }
      }

      if (!aiUsed) {
        // Heuristic fallback: lines containing a colon or that start capitalized.
        concepts = text
          .split(/\n+/)
          .map((l) => l.trim())
          .filter((l) => l.length > 6 && (l.includes(':') || /[A-Z]\w/.test(l)))
          .slice(0, 12);
      }

      await supabase.from('notes_uploads').update({
        extracted_concepts: concepts,
        status: text ? 'ready' : 'pending',
        ready_at: text ? new Date().toISOString() : null,
        error: text ? null : 'No OCR text available — paste text or connect an OCR provider.',
      }).eq('id', row.id);

      return NextResponse.json({ success: true, concepts, flashcards: suggestedFlashcards, source: aiUsed ? 'gemini' : 'heuristic' });
    }

    if (body.action === 'mark_ready' && body.uploadId) {
      // Worker hook: an external service can call this with the extracted
      // concept list + freshly created flashcard / practice IDs.
      await supabase.from('notes_uploads').update({
        status: 'ready',
        extracted_concepts: Array.isArray(body.concepts) ? body.concepts.slice(0, 50) : [],
        generated_card_ids: Array.isArray(body.cardIds) ? body.cardIds.slice(0, 100) : [],
        generated_practice_ids: Array.isArray(body.practiceIds) ? body.practiceIds.slice(0, 50) : [],
        ready_at: new Date().toISOString(),
        error: null,
      }).eq('id', body.uploadId).eq('user_id', user.id);
      return NextResponse.json({ success: true });
    }

    // Default: create a new upload row.
    const storagePath = String(body.storagePath || '').slice(0, 500);
    if (!storagePath) return NextResponse.json({ error: 'storagePath required' }, { status: 400 });
    const { data: row, error } = await supabase.from('notes_uploads').insert({
      user_id: user.id,
      storage_path: storagePath,
      ocr_text: body.ocrText || null,
      status: 'pending',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, upload: row });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
