/**
 * Gemini wrapper — single entrypoint for AI text generation.
 *
 * The free Gemini API (Google AI Studio) is what we have. Use raw fetch to
 * avoid adding a new SDK dependency; the REST API is stable and small.
 *
 * All callers are expected to:
 *   - Provide their own short, focused prompt
 *   - Have a deterministic fallback for when GEMINI_API_KEY isn't set OR
 *     the call errors out — Gemini free tier has rate limits and we never
 *     want a transient failure to block a student session
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *
 * Default model is gemini-2.0-flash (fast, generous free tier). Set
 * GEMINI_MODEL to override.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

export interface GeminiOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** System-level instruction the model holds onto (no role hierarchy in REST; we prepend). */
  system?: string;
  /** Hard timeout in ms (default 20s) — keep student-facing flows snappy. */
  timeoutMs?: number;
}

export interface GeminiResult {
  ok: boolean;
  text: string | null;
  error?: string;
  /** True when GEMINI_API_KEY is missing — caller should use its fallback silently. */
  unconfigured?: boolean;
}

/**
 * Generate text. Caller decides what to do on failure — every consumer in
 * this codebase has a deterministic fallback so a missing key or rate-limit
 * never breaks the student-facing flow.
 */
export async function geminiGenerate(prompt: string, opts: GeminiOptions = {}): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { ok: false, text: null, error: 'GEMINI_API_KEY not set', unconfigured: true };
  }

  const model = opts.model || DEFAULT_MODEL;
  const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body: any = {
    contents: [{
      role: 'user',
      parts: [{ text: opts.system ? `${opts.system}\n\n${prompt}` : prompt }],
    }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
    },
    // Sensible safety defaults — we already filter educational scope upstream
    // so we don't need ultra-strict thresholds blocking legitimate science
    // content (e.g. "violence" in history-of-WW2 context).
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',         threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',         threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',   threshold: 'BLOCK_LOW_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT',   threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, text: null, error: `Gemini ${res.status}: ${errText.slice(0, 300)}` };
    }
    const json = await res.json();
    // Standard response shape: candidates[0].content.parts[0].text
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      // Sometimes blocked by safety filters — preserve that as a soft fail.
      const finishReason: string | undefined = json?.candidates?.[0]?.finishReason;
      return { ok: false, text: null, error: `No text in response (finishReason=${finishReason || 'unknown'})` };
    }
    return { ok: true, text: text.trim() };
  } catch (err: any) {
    clearTimeout(timer);
    return { ok: false, text: null, error: err?.message || String(err) };
  }
}

/**
 * Generate a JSON object. Wraps geminiGenerate with a JSON-mode hint and
 * defensive parsing. Returns null on any failure so callers can fall back.
 */
export async function geminiGenerateJSON<T = any>(prompt: string, opts: GeminiOptions = {}): Promise<{ ok: boolean; data: T | null; error?: string; unconfigured?: boolean }> {
  const wrapped = `${prompt}\n\nRespond ONLY with a single valid JSON object. No prose, no markdown fences, no commentary.`;
  const result = await geminiGenerate(wrapped, { ...opts, temperature: opts.temperature ?? 0.4 });
  if (!result.ok || !result.text) {
    return { ok: false, data: null, error: result.error, unconfigured: result.unconfigured };
  }
  // Strip ```json fences if the model added them anyway
  let raw = result.text.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  // Try to slice the first {...} block in case prose snuck in
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    raw = raw.slice(firstBrace, lastBrace + 1);
  }
  try {
    const data = JSON.parse(raw);
    return { ok: true, data: data as T };
  } catch (err: any) {
    return { ok: false, data: null, error: `JSON parse: ${err?.message || err}` };
  }
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
