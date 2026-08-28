/**
 * AI Provider — one call, three providers, never blocked.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Gemini's free tier is 20 requests per day per project per model. That is a
 * demo allowance, not something a child can study on — and when it runs out
 * mid-session the Conversion Engine silently degrades to bare syllabus text,
 * which is exactly the failure it was built to prevent.
 *
 * So generation goes through a chain, ordered by what actually matters here:
 *
 *   1. GROQ    ~4s, generous daily free tier. The interactive path — a student
 *              is waiting, and 4 seconds is the difference between a lesson
 *              and a loading screen.
 *   2. GEMINI  ~15-30s, tiny free quota. Kept because it is already wired and
 *              is the best option once billing is enabled.
 *   3. OLLAMA  ~40s on the local RTX 3060, but UNLIMITED and private. The
 *              floor that means bulk generation can always finish, even at
 *              3am with every cloud quota spent.
 *
 * The ordering is deliberate: fastest-with-quota first, unlimited-but-slow
 * last. A batch job can invert it with `preferLocal` — when nobody is waiting,
 * spending 40 seconds of your own GPU beats spending a scarce cloud request.
 *
 * Every provider is optional. Configure none and callers get `unconfigured`
 * and fall back to their own deterministic path, exactly as before.
 */

import { geminiGenerateJSON, isGeminiConfigured } from './gemini';

export type ProviderName = 'groq' | 'gemini' | 'ollama';

export interface GenOptions {
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Put the local model first — for batch work where nobody is waiting. */
  preferLocal?: boolean;
  /** Restrict to these providers. */
  only?: ProviderName[];
}

export interface GenResult<T = any> {
  ok: boolean;
  data: T | null;
  /** Which provider actually answered — surfaced so cost/latency is visible. */
  provider?: ProviderName;
  error?: string;
  unconfigured?: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

/**
 * Ceiling on max_tokens for Groq requests.
 *
 * Groq's free tier is 1000 requests/day but only 8000 TOKENS PER MINUTE, and
 * it reserves against the max_tokens you ASK for, not what you use. So a call
 * requesting 8192 output tokens exceeds the whole minute's budget on its own
 * and is refused before generating anything — which looks exactly like the
 * provider being down, and silently sent every request to the slow local
 * fallback instead.
 *
 * 3000 leaves room for two or three calls per minute and is ample for a
 * topic's worth of JSON.
 */
const GROQ_MAX_TOKENS = Number(process.env.GROQ_MAX_TOKENS || 3000);
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b-instruct';

function groqKeys(): string[] {
  return (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
    .split(',').map((k) => k.trim()).filter(Boolean);
}

export function availableProviders(): ProviderName[] {
  const out: ProviderName[] = [];
  if (groqKeys().length) out.push('groq');
  if (isGeminiConfigured()) out.push('gemini');
  if (OLLAMA_URL) out.push('ollama');
  return out;
}

// ============================================================================
// Groq — OpenAI-compatible
// ============================================================================

async function groqJSON<T>(prompt: string, opts: GenOptions): Promise<GenResult<T>> {
  const keys = groqKeys();
  if (!keys.length) return { ok: false, data: null, unconfigured: true, error: 'no GROQ_API_KEY' };

  let lastError = '';
  for (const key of keys) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: GROQ_MODEL,
          // Server-side JSON guarantee beats hoping the prompt holds.
          response_format: { type: 'json_object' },
          temperature: opts.temperature ?? 0.5,
          max_tokens: Math.min(opts.maxOutputTokens ?? 4096, GROQ_MAX_TOKENS),
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      clearTimeout(timer);

      if (!res.ok) {
        lastError = `Groq ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`;
        // 429/5xx may succeed on another key; a 400 will not.
        if (res.status === 429 || res.status >= 500) continue;
        return { ok: false, data: null, error: lastError };
      }

      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content;
      if (!text) { lastError = 'Groq returned no content'; continue; }
      return { ok: true, data: JSON.parse(text) as T, provider: 'groq' };
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err?.message || String(err);
    }
  }
  return { ok: false, data: null, error: lastError };
}

// ============================================================================
// Ollama — local, unlimited
// ============================================================================

async function ollamaJSON<T>(prompt: string, opts: GenOptions): Promise<GenResult<T>> {
  const controller = new AbortController();
  // Local generation is slower by design; a 60s cloud timeout would abort a
  // perfectly healthy 14B mid-answer.
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 300_000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: opts.temperature ?? 0.5,
          num_predict: opts.maxOutputTokens ?? 4096,
        },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, data: null, error: `Ollama ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}` };
    }
    const json = await res.json();
    if (!json?.response) return { ok: false, data: null, error: 'Ollama returned no response' };
    return { ok: true, data: JSON.parse(json.response) as T, provider: 'ollama' };
  } catch (err: any) {
    clearTimeout(timer);
    return { ok: false, data: null, error: err?.message || String(err) };
  }
}

// ============================================================================
// The chain
// ============================================================================

export async function generateJSON<T = any>(
  prompt: string,
  opts: GenOptions = {},
): Promise<GenResult<T>> {
  const order: ProviderName[] = opts.preferLocal
    ? ['ollama', 'groq', 'gemini']
    : ['groq', 'gemini', 'ollama'];

  const chain = opts.only?.length ? order.filter((p) => opts.only!.includes(p)) : order;

  let lastError = 'no provider configured';
  let anyConfigured = false;

  for (const provider of chain) {
    let result: GenResult<T>;

    if (provider === 'groq') {
      if (!groqKeys().length) continue;
      anyConfigured = true;
      result = await groqJSON<T>(prompt, opts);
    } else if (provider === 'gemini') {
      if (!isGeminiConfigured()) continue;
      anyConfigured = true;
      const g = await geminiGenerateJSON<T>(prompt, {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
        timeoutMs: opts.timeoutMs,
      });
      result = { ok: g.ok, data: g.data, error: g.error, provider: 'gemini' };
    } else {
      anyConfigured = true;
      result = await ollamaJSON<T>(prompt, opts);
    }

    if (result.ok) return { ...result, provider };
    lastError = `${provider}: ${result.error || 'failed'}`;
  }

  return {
    ok: false, data: null, error: lastError,
    unconfigured: !anyConfigured,
  };
}
