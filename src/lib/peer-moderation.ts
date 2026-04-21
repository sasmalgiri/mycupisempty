/**
 * Peer Moderation — runs student-submitted Q&A through safety + correctness
 * checks before publishing.
 *
 * Brainly has a huge peer-Q&A feed but lets junk + inaccurate answers through.
 * Our bar:
 *   1. Safety first — block anything flagged by our education guardrail.
 *   2. Correctness — if the question is factual, AI-verifies the answer and
 *      flags disagreements for teacher review (doesn't outright reject).
 *   3. Length / format — reject empty, single-word, or all-emoji answers.
 *
 * Results in a moderation status:
 *   - 'approved'   — visible immediately
 *   - 'flagged'    — hidden, reviewed by a teacher
 *   - 'blocked'    — rejected outright (safety violation)
 */

export type ModerationStatus = 'approved' | 'flagged' | 'blocked';

export interface ModerationResult {
  status: ModerationStatus;
  reason?: string;
  confidence?: number;        // 0..1
  suggestedImprovement?: string;
}

const BLOCK_PATTERNS = [
  /\b(porn|sex|nude|xxx|nsfw|hentai|onlyfans|rape)\b/i,
  /\b(kill|murder|suicide|self.?harm|cut\s+myself)\b/i,
  /\b(bomb|explosive|weapon|how\s+to\s+make\s+(a|an))\b/i,
  /\b(hack|exploit|ddos|phish|malware|ransomware)\b/i,
  /\b(drug|cocaine|meth|heroin|mdma|lsd|weed\s+for\s+sale)\b/i,
  /\b(cheat\s+in\s+exam|leak\s+paper|answer\s+key\s+leak|buy\s+marks)\b/i,
  /\b(hate\s+|slur\s+)/i,
];

const NON_EDUCATIONAL_PATTERNS = [
  /\bgambling\b/i, /\bbetting\b/i, /\bcasino\b/i,
  /\bcrypto\s+trading\b/i,
  /\bwhatsapp\s+me\b/i, /\bdm\s+me\b/i,  // solicitation
];

// ============================================================
// Fast rule-based safety check (always runs, server or client)
// ============================================================

export function fastModerate(text: string): ModerationResult | null {
  if (!text || typeof text !== 'string') {
    return { status: 'blocked', reason: 'Empty content' };
  }
  const trimmed = text.trim();
  if (trimmed.length < 5) {
    return { status: 'blocked', reason: 'Too short to be useful' };
  }
  if (trimmed.length > 8000) {
    return { status: 'blocked', reason: 'Too long — please keep under 8000 characters' };
  }
  // Emoji-only
  const nonEmoji = trimmed.replace(/[\p{Emoji}\s\p{P}]/gu, '');
  if (nonEmoji.length < 3) {
    return { status: 'flagged', reason: 'Not enough text — please explain in words too' };
  }

  for (const pat of BLOCK_PATTERNS) {
    if (pat.test(trimmed)) {
      return { status: 'blocked', reason: 'Content violates our safety policy.' };
    }
  }
  for (const pat of NON_EDUCATIONAL_PATTERNS) {
    if (pat.test(trimmed)) {
      return { status: 'blocked', reason: 'Not educational content.' };
    }
  }

  // Obvious spam: too many links
  const linkCount = (trimmed.match(/https?:\/\//gi) || []).length;
  if (linkCount > 3) {
    return { status: 'flagged', reason: 'Too many links — looks like spam.' };
  }

  return null; // no block/flag from fast rules
}

// ============================================================
// AI-assisted correctness + quality check
// ============================================================

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

export async function aiModerate(params: {
  question: string;
  answer: string;
  subject?: string;
  classLevel?: number;
}): Promise<ModerationResult> {
  const { question, answer, subject, classLevel } = params;

  // Fast check first
  const fast = fastModerate(answer);
  if (fast && fast.status === 'blocked') return fast;

  if (!XAI_API_KEY) {
    // Without AI, default to flagged-for-review on anything that isn't fast-approved
    return fast || { status: 'flagged', reason: 'Awaiting teacher review (AI moderation unavailable)' };
  }

  const prompt = `You are moderating a peer answer in a K-12 Indian educational Q&A feed.

QUESTION: ${question}
${subject ? `SUBJECT: ${subject}\n` : ''}${classLevel ? `CLASS: ${classLevel}\n` : ''}

ANSWER FROM PEER: ${answer}

Assess and reply with a single JSON object:
{
  "status": "approved" | "flagged" | "blocked",
  "reason": "short reason",
  "confidence": 0.0-1.0,
  "suggestedImprovement": "optional short suggestion if flagged"
}

RULES:
- "blocked" only for safety violations, non-educational content, or deliberate misinformation.
- "flagged" if the answer is incomplete, factually dubious, wrong, or too vague — needs teacher review.
- "approved" if the answer is educational, accurate (to your best knowledge), and helpful to a classmate.
- Err on the side of "flagged" over "approved" when factual correctness is unclear; never guess.
- Do NOT include any text outside the JSON.`;

  try {
    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Please moderate now and return JSON.' },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });
    if (!response.ok) throw new Error(`AI ${response.status}`);
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    const text = typeof raw === 'string' ? raw : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in moderator response');
    const parsed = JSON.parse(match[0]);
    if (!['approved', 'flagged', 'blocked'].includes(parsed.status)) {
      return { status: 'flagged', reason: 'Moderator returned invalid status' };
    }
    return {
      status: parsed.status,
      reason: parsed.reason,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
      suggestedImprovement: parsed.suggestedImprovement,
    };
  } catch (err) {
    console.error('AI moderation failed:', err);
    // On error, flag for human review — never blindly approve
    return { status: 'flagged', reason: 'Automatic review unavailable — teacher will look at this.' };
  }
}
