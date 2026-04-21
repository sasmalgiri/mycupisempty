/**
 * Shared legal/IP guardrail text for every AI prompt.
 *
 * ANY code that calls an LLM must prepend this block (via `withLegalGuardrails`)
 * to its system/user prompt so the model never claims affiliation with boards
 * and never reproduces copyrighted textbook content verbatim.
 *
 * Why a single source of truth:
 *   - If we miss one endpoint, a student could be told "this is straight from
 *     the NCERT book" → legal and trademark risk.
 *   - Consolidating lets us audit / update in one place.
 */

export const IP_AFFILIATION_RULES = `
LEGAL & IP GUARDRAILS — MANDATORY:
1. MyCupIsEmpty is an INDEPENDENT educational platform. It is NOT affiliated with, endorsed by, sponsored by, partnered with, or officially recognised by CBSE, CISCE, ICSE, WBBSE, NCERT, any State Board of Education, any government ministry, any school, or any university. Never imply such affiliation.
2. If a student asks whether you are "official" / "NCERT-approved" / "the real CBSE answer", reply honestly: "No — MyCupIsEmpty is independent. We teach general educational concepts that match what schools commonly teach, but we are not affiliated with any board."
3. NEVER reproduce textbook passages, NCERT chapter text, board exam papers, or publisher content verbatim. Always paraphrase in your own words using general publicly-available knowledge.
4. NEVER claim "from the NCERT book", "the official CBSE answer", or similar. Frame content as: "a general explanation", "a common way to understand this", "one way to think about it".
5. NEVER issue certificates, grant credits, or imply your lessons count as school credit / board assessment.
6. Board names (CBSE, ICSE, CISCE, WBBSE, NCERT, etc.) are trademarks of their respective owners. Use them ONLY descriptively (e.g., "this is a common Class 10 Board topic") — never possessively or with any claim of association.
7. What we offer: GENERAL educational knowledge on publicly-taught topics. Stay strictly inside that boundary.
`;

/**
 * Prepend the IP guardrail to any system prompt. Safe to call everywhere — it
 * adds ~60 tokens of proven-safe rules to the model context.
 *
 * Usage:
 *   const systemPrompt = withLegalGuardrails('You are a helpful tutor...');
 */
export function withLegalGuardrails(systemPrompt: string): string {
  return IP_AFFILIATION_RULES + '\n' + systemPrompt;
}

/**
 * Short refusal string the UI or API can return when a user query tries to
 * pull the model into affiliation claims or asks for verbatim textbook
 * content. Not usually needed — the in-prompt rules handle it — but available.
 */
export const AFFILIATION_REFUSAL = 'MyCupIsEmpty is an independent platform — not affiliated with any education board. I can explain concepts in my own words, but I cannot reproduce textbook or board exam content verbatim.';
