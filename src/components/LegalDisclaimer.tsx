/**
 * LegalDisclaimer — the standard, mandatory footer notice.
 *
 * Appears on every authenticated page + on Terms/Privacy. Deliberately visible
 * but not intrusive. Wording chosen so we keep a clear legal boundary:
 *
 *   - MyCupIsEmpty is independent
 *   - We are NOT affiliated with / endorsed by / a partner of any board
 *   - We teach publicly available educational concepts
 *   - Students should verify with their school/teacher/textbook
 *
 * Two variants:
 *   <LegalDisclaimer /> — full paragraph for footers / Terms page
 *   <LegalDisclaimer compact /> — one-line for very tight places
 */

interface Props {
  compact?: boolean;
  className?: string;
}

export default function LegalDisclaimer({ compact = false, className = '' }: Props) {
  if (compact) {
    return (
      <p className={`text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 ${className}`}>
        MyCupIsEmpty is an independent educational platform — not affiliated with or endorsed by CBSE, CISCE/ICSE, WBBSE, NCERT, or any state education board. All content is for general learning only.
      </p>
    );
  }

  return (
    <div className={`text-xs leading-relaxed text-gray-500 dark:text-gray-400 space-y-1 ${className}`}>
      <p>
        <strong>Independent &amp; unaffiliated.</strong>{' '}
        MyCupIsEmpty is an independent educational platform. We are <em>not</em> affiliated with, endorsed by, sponsored by, or officially recognised by CBSE, CISCE/ICSE, WBBSE, NCERT, any State Board of Education, any university, or any school.
      </p>
      <p>
        <strong>What we offer.</strong>{' '}
        We help students learn general educational concepts that are publicly available as part of standard Indian school syllabi. When a student selects a board (e.g., CBSE / ICSE / WBBSE), we use that only to order topics according to the publicly-published curriculum framework — we do not reproduce or republish any board&apos;s textbooks, question papers, or proprietary content.
      </p>
      <p>
        <strong>Not a substitute.</strong>{' '}
        AI-generated explanations are a supplementary learning aid, not a replacement for school, teachers, official textbooks, or formal assessment. Students should verify important information with their teachers and prescribed textbooks.
      </p>
      <p>
        <strong>Trademarks.</strong>{' '}
        &quot;CBSE&quot;, &quot;ICSE&quot;, &quot;CISCE&quot;, &quot;WBBSE&quot;, &quot;NCERT&quot;, and any state board names are the trademarks of their respective owners. Our use is strictly nominative (to describe which curriculum a student follows), not to claim association.
      </p>
    </div>
  );
}
