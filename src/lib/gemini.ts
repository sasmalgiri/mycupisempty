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
 * Default model is gemini-3.6-flash. Set
 * GEMINI_MODEL to override.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// gemini-2.0-flash was retired — the API now answers requests for it with
// 404 "no longer available", which reads like a broken key rather than a stale
// model name and silently sent every caller down its fallback path.
// Verified live: gemini-3.6-flash and gemini-2.5-flash both respond.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

export interface GeminiOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** System-level instruction the model holds onto (no role hierarchy in REST; we prepend). */
  system?: string;
  /** Hard timeout in ms (default 20s) — keep student-facing flows snappy. */
  timeoutMs?: number;
  /** Thinking-token budget. Minimum 128 — 0 is rejected as an invalid argument. */
  thinkingBudget?: number;
  /** Have the API itself guarantee JSON rather than hoping the prompt holds. */
  jsonMode?: boolean;
}

export interface GeminiResult {
  ok: boolean;
  text: string | null;
  error?: string;
  /** True on HTTP 429 — this MODEL's daily quota is spent; another may still have some. */
  rateLimited?: boolean;
  /** True when GEMINI_API_KEY is missing — caller should use its fallback silently. */
  unconfigured?: boolean;
}

/**
 * Generate text. Caller decides what to do on failure — every consumer in
 * this codebase has a deterministic fallback so a missing key or rate-limit
 * never breaks the student-facing flow.
 */
/**
 * Models to fall back to when the primary is overloaded.
 *
 * Free-tier Flash returns 503 "experiencing high demand" fairly regularly, and
 * that lands mid-lesson. Silently dropping to the deterministic fallback would
 * hand the student bare syllabus text; trying a sibling model first almost
 * always recovers, because the shards are not busy at the same time.
 */
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.6-flash'];

/**
 * All three are worth retrying on a different model.
 *
 * 503/500 mean THIS model is busy, and a sibling usually answers.
 *
 * 429 also warrants switching, which is not obvious: the free-tier quota is
 * `GenerateRequestsPerDayPerProjectPerModel`, i.e. 20 requests per day PER
 * MODEL, not per key. So an exhausted gemini-3.6-flash says nothing about
 * gemini-2.5-flash-lite, and walking the chain genuinely buys more capacity
 * rather than burning a shared allowance.
 */
function isTransient(status: number): boolean {
  return status === 503 || status === 500 || status === 429;
}

/**
 * All configured keys, in order.
 *
 * GEMINI_API_KEYS (comma-separated) takes precedence over the single
 * GEMINI_API_KEY. Free-tier quota is per PROJECT per model, so two keys from
 * two projects genuinely double the daily allowance — this is the difference
 * between four chapters a day and a working syllabus.
 */
function apiKeys(): string[] {
  const many = (process.env.GEMINI_API_KEYS || '')
    .split(',').map((k) => k.trim()).filter(Boolean);
  if (many.length) return many;
  const one = process.env.GEMINI_API_KEY?.trim();
  return one ? [one] : [];
}

/** The -lite models do not support thinkingConfig and 400 if it is sent. */
function isThinkingModel(model: string): boolean {
  return !/-lite/i.test(model);
}

/** Google auto-revokes keys it finds published. Never worth retrying. */
function isLeakedKey(error?: string): boolean {
  return /reported as leaked/i.test(error || '');
}

export async function geminiGenerate(prompt: string, opts: GeminiOptions = {}): Promise<GeminiResult> {
  const keys = apiKeys();
  if (keys.length === 0) {
    return { ok: false, text: null, error: 'No Gemini API key configured', unconfigured: true };
  }

  const primary = opts.model || DEFAULT_MODEL;
  const chain = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];

  let lastError = 'unknown error';

  // Model outer, key inner: exhaust every key on the BEST model before
  // dropping to a weaker one. The reverse order would quietly downgrade
  // quality while good quota was still sitting unused on another project.
  for (const candidate of chain) {
    for (const key of keys) {
      const attempt = await callGemini(prompt, { ...opts, model: candidate }, key);
      if (attempt.ok) return attempt;
      lastError = attempt.error || lastError;

      if (isLeakedKey(attempt.error)) continue;   // dead key, try the next one
      if (attempt.transient) continue;            // out of quota / busy — next key
      return attempt;                             // a real error: same on every key
    }
  }
  return { ok: false, text: null, error: `All keys and models exhausted. Last: ${lastError}` };
}

async function callGemini(
  prompt: string,
  opts: GeminiOptions,
  key: string,
): Promise<GeminiResult & { transient?: boolean }> {
  const model = opts.model || DEFAULT_MODEL;
  const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body: any = {
    contents: [{
      role: 'user',
      parts: [{ text: opts.system ? `${opts.system}\n\n${prompt}` : prompt }],
    }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      // Current Flash models are THINKING models: reasoning tokens are billed
      // against maxOutputTokens before a single character of the answer is
      // emitted. Observed on a trivial prompt: 330 thinking tokens vs 136 of
      // actual output. A 1024 budget therefore truncates real answers
      // mid-sentence and, for JSON callers, produces an unparseable object —
      // which looked like a broken API key rather than a budget problem.
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      // Keep reasoning short so the budget goes to the answer. Two traps here:
      //   - budget 0 is REJECTED by gemini-3.6-flash with a bare 400; thinking
      //     can be bounded but not switched off. 128 is the smallest that works.
      //   - the *-lite models are not thinking models at all and reject the
      //     field outright with 400 "invalid argument", which surfaced only
      //     once the chain fell through to lite after the others hit quota.
      ...(isThinkingModel(model)
        ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 128 } }
        : {}),
      ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
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
      return {
        ok: false,
        text: null,
        error: `Gemini ${res.status} on ${model}: ${errText.slice(0, 200)}`,
        transient: isTransient(res.status),
        rateLimited: res.status === 429,
      };
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
    // A network drop or an abort is transient too.
    return { ok: false, text: null, error: err?.message || String(err), transient: true };
  }
}

/**
 * Generate a JSON object. Wraps geminiGenerate with a JSON-mode hint and
 * defensive parsing. Returns null on any failure so callers can fall back.
 */
export async function geminiGenerateJSON<T = any>(prompt: string, opts: GeminiOptions = {}): Promise<{ ok: boolean; data: T | null; error?: string; unconfigured?: boolean }> {
  const wrapped = `${prompt}\n\nRespond ONLY with a single valid JSON object. No prose, no markdown fences, no commentary.`;
  const result = await geminiGenerate(wrapped, {
    ...opts,
    temperature: opts.temperature ?? 0.4,
    // Let the API enforce the shape rather than trusting the prompt, and give
    // structured output room — a truncated object is unrecoverable, whereas
    // spare budget costs nothing.
    jsonMode: opts.jsonMode ?? true,
    maxOutputTokens: opts.maxOutputTokens ?? 8192,
  });
  if (!result.ok || !result.text) {
    return { ok: false, data: null, error: result.error, unconfigured: result.unconfigured };
  }
  // Strip ```json fences if the model added them anyway
  const unsliced = result.text.trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Try to slice the first {...} block in case prose snuck in.
  let raw = unsliced;
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    raw = raw.slice(firstBrace, lastBrace + 1);
  }
  try {
    const data = JSON.parse(raw);
    return { ok: true, data: data as T };
  } catch (err: any) {
    // A truncated response is the common failure, not malformed syntax — the
    // model ran out of output budget mid-array. Salvage the complete objects
    // rather than discarding the whole generation: five good units out of six
    // is a usable lesson, and the alternative is falling back to bare syllabus
    // text that classifies as nothing.
    // Salvage from the UNSLICED text: the lastIndexOf('}') slice above closes
    // the object at the last complete child, which corrupts a truncated array
    // rather than repairing it.
    const salvaged = salvageTruncatedJSON(unsliced) ?? salvageTruncatedJSON(raw);
    if (salvaged) return { ok: true, data: salvaged as T };
    return { ok: false, data: null, error: `JSON parse: ${err?.message || err}` };
  }
}

export function isGeminiConfigured(): boolean {
  return apiKeys().length > 0;
}

/**
 * Recover a usable object from JSON that was cut off mid-generation.
 *
 * Thinking models spend part of the output budget reasoning, so a long
 * structured answer can stop mid-string. Rather than lose the whole call,
 * walk the text and close whatever is still open, discarding the final
 * incomplete element.
 *
 * Only ever used as a fallback after a real parse has failed.
 */
function salvageTruncatedJSON(raw: string): any | null {
  // Cut back to the last point where an element cleanly ended.
  for (const end of ['}', ']']) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let lastGood = -1;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 1 && ch === end) lastGood = i;  // a complete child element
      }
    }
    if (lastGood < 0) continue;

    // Rebuild: everything up to the last complete child, then close the parents.
    const head = raw.slice(0, lastGood + 1);
    for (const closers of [']}', '}]', ']', '}', '}}', ']]']) {
      try {
        return JSON.parse(head + closers);
      } catch { /* try the next closing shape */ }
    }
  }
  return null;
}
