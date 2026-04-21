/**
 * MainBrain — the cross-subject orchestrator.
 *
 * Each subject companion observes the student and writes a `CompanionReport`.
 * MainBrain aggregates all reports, detects cross-subject patterns, and
 * issues `BrainDirective`s back to every companion so the whole system
 * adapts coherently.
 *
 * Examples of cross-subject directives this emits:
 *   - Frustration spike in Math → tell ALL companions: ease_up today.
 *   - Breakthrough in Physics → tell other STEM companions: try stretch.
 *   - Student preference "visual first" learned in Math → share with Science.
 *   - Attention span dropping → tell all companions: keep sessions short.
 *
 * Design: directives are short-lived (expire after N hours), typed, and
 * carry a reason the companion can reference honestly with the student.
 */

import type { CompanionReport } from './companion-memory';
import type { StudentState } from './student-state';

export type DirectiveType =
  | 'ease_up'            // gentle today, smaller steps
  | 'push_harder'        // student is flourishing — stretch them
  | 'focus_area'         // spend time on a specific topic/misconception
  | 'celebrate'          // acknowledge a recent breakthrough
  | 'watch_for'          // look for a specific signal
  | 'cross_insight'      // share an insight from another companion
  | 'shorten_session'    // attention is low — keep it brief
  | 'switch_modality';   // try a different explanation style

export interface BrainDirective {
  id: string;                    // unique per issuance
  type: DirectiveType;
  reason: string;                // why main brain is pushing this
  appliesTo: 'all' | string[];   // 'all' or list of companion IDs
  params?: Record<string, any>;
  issuedAt: string;
  expiresAt: string;
  sourceCompanionId?: string;    // which companion's observation triggered this (if any)
}

export interface BrainSnapshot {
  userId: string;
  generatedAt: string;
  overallSentiment: 'flourishing' | 'steady' | 'strained' | 'mixed' | 'unknown';
  activeDirectives: BrainDirective[];
  companionReports: Array<{
    companionId: string;
    subjectId: string;
    subjectName?: string;
    report: CompanionReport;
  }>;
  crossSubjectPatterns: string[];  // detected patterns (human-readable)
  recommendedFocusThisWeek: string;
}

// ============================================================
// Aggregate companion reports into a brain snapshot
// ============================================================

export function aggregateReports(
  userId: string,
  reports: Array<{ companionId: string; subjectId: string; subjectName?: string; report: CompanionReport }>,
  studentState?: StudentState,
): BrainSnapshot {
  const generatedAt = new Date().toISOString();

  // Detect cross-subject patterns
  const crossSubjectPatterns: string[] = [];
  let strainedCount = 0;
  let flourishingCount = 0;
  const allUrgent = reports.flatMap((r) => r.report.urgentFlags);
  const allBreakthroughs = reports.flatMap((r) => r.report.breakthroughs);
  const allConcerns = reports.flatMap((r) => r.report.concerns);
  const allHints = reports.flatMap((r) => r.report.crossSubjectHints);

  for (const r of reports) {
    if (r.report.sentimentWindow === 'strained') strainedCount++;
    if (r.report.sentimentWindow === 'flourishing') flourishingCount++;
  }

  if (strainedCount >= 2) {
    crossSubjectPatterns.push(`Strain appearing across ${strainedCount} subjects — likely student-wide overload, not a single-subject issue.`);
  }
  if (flourishingCount >= 2) {
    crossSubjectPatterns.push(`Momentum across ${flourishingCount} subjects — great window to push a stretch challenge.`);
  }
  if (allBreakthroughs.length >= 3) {
    crossSubjectPatterns.push(`Multiple breakthroughs this window — capture in growth story.`);
  }
  if (allConcerns.length >= 4) {
    crossSubjectPatterns.push(`Concern count is elevated — an intervention session may help before the next cycle.`);
  }

  // Detect cross-subject hints that should propagate
  const propagatableHints = allHints.filter(Boolean);

  // Overall sentiment
  let overallSentiment: BrainSnapshot['overallSentiment'];
  if (reports.length === 0) overallSentiment = 'unknown';
  else if (strainedCount > flourishingCount && strainedCount >= 2) overallSentiment = 'strained';
  else if (flourishingCount > strainedCount && flourishingCount >= 2) overallSentiment = 'flourishing';
  else if (flourishingCount > 0 && strainedCount > 0) overallSentiment = 'mixed';
  else overallSentiment = 'steady';

  // === Issue directives ===
  const directives: BrainDirective[] = [];
  const now = new Date();
  const expiresIn = (hours: number) => new Date(now.getTime() + hours * 3600000).toISOString();
  let directiveIdCounter = 0;
  const nextId = () => `dir_${now.getTime()}_${++directiveIdCounter}`;

  // Overall strain → ease up across the board
  if (overallSentiment === 'strained' || strainedCount >= 2) {
    directives.push({
      id: nextId(),
      type: 'ease_up',
      reason: `Strain observed across ${strainedCount} subjects`,
      appliesTo: 'all',
      issuedAt: now.toISOString(),
      expiresAt: expiresIn(24),
    });
  }

  // Attention / cognitive load
  if (studentState?.isNearDropOff || studentState?.cognitiveLoad === 'heavy') {
    directives.push({
      id: nextId(),
      type: 'shorten_session',
      reason: studentState.isNearDropOff ? 'Student near attention drop-off' : 'Cognitive load heavy',
      appliesTo: 'all',
      issuedAt: now.toISOString(),
      expiresAt: expiresIn(6),
    });
  }

  // Flourishing → push harder
  if (overallSentiment === 'flourishing') {
    directives.push({
      id: nextId(),
      type: 'push_harder',
      reason: `Student is flourishing across ${flourishingCount} subjects`,
      appliesTo: 'all',
      issuedAt: now.toISOString(),
      expiresAt: expiresIn(48),
    });
  }

  // Celebrate breakthroughs — all companions should acknowledge
  if (allBreakthroughs.length > 0) {
    directives.push({
      id: nextId(),
      type: 'celebrate',
      reason: `Recent breakthroughs to acknowledge: ${allBreakthroughs.slice(0, 2).join('; ')}`,
      appliesTo: 'all',
      params: { breakthroughs: allBreakthroughs },
      issuedAt: now.toISOString(),
      expiresAt: expiresIn(24),
    });
  }

  // Cross-subject hints — propagate to relevant companions
  for (const r of reports) {
    for (const hint of r.report.crossSubjectHints) {
      if (!hint) continue;
      // Push hint to all OTHER companions (not the source)
      const otherCompanions = reports
        .filter((rr) => rr.companionId !== r.companionId)
        .map((rr) => rr.companionId);
      if (otherCompanions.length > 0) {
        directives.push({
          id: nextId(),
          type: 'cross_insight',
          reason: `${r.subjectName || r.companionId} companion observed: "${hint}"`,
          appliesTo: otherCompanions,
          params: { hint, fromSubject: r.subjectName, fromCompanion: r.companionId },
          sourceCompanionId: r.companionId,
          issuedAt: now.toISOString(),
          expiresAt: expiresIn(72),
        });
      }
    }
  }

  // Focus area — if multiple companions flagged the same concern
  const concernCounts: Record<string, number> = {};
  for (const c of allConcerns) {
    const key = c.toLowerCase().slice(0, 40);
    concernCounts[key] = (concernCounts[key] || 0) + 1;
  }
  const repeatedConcern = Object.entries(concernCounts).find(([_, count]) => count >= 2);
  if (repeatedConcern) {
    directives.push({
      id: nextId(),
      type: 'focus_area',
      reason: `Concern appears in multiple subjects: "${repeatedConcern[0]}"`,
      appliesTo: 'all',
      params: { concern: repeatedConcern[0] },
      issuedAt: now.toISOString(),
      expiresAt: expiresIn(36),
    });
  }

  // === Weekly focus recommendation ===
  let recommendedFocusThisWeek: string;
  if (overallSentiment === 'strained') {
    recommendedFocusThisWeek = `Ease the student's load this week. Shorter sessions, smaller goals, celebrate small wins.`;
  } else if (overallSentiment === 'flourishing') {
    recommendedFocusThisWeek = `Capitalize on momentum — introduce a stretch project that spans two subjects.`;
  } else if (allConcerns.length >= 3) {
    recommendedFocusThisWeek = `Dedicate a session this week to addressing misconceptions head-on.`;
  } else {
    recommendedFocusThisWeek = `Maintain steady practice. Look for opportunities to connect subjects.`;
  }

  return {
    userId,
    generatedAt,
    overallSentiment,
    activeDirectives: directives,
    companionReports: reports,
    crossSubjectPatterns,
    recommendedFocusThisWeek,
  };
}

// ============================================================
// Format directives as a short prompt block a companion can read
// ============================================================

export function directivesToPromptBlock(directives: BrainDirective[], companionId: string): string {
  if (directives.length === 0) return '';

  const applicable = directives.filter((d) => d.appliesTo === 'all' || (Array.isArray(d.appliesTo) && d.appliesTo.includes(companionId)));
  if (applicable.length === 0) return '';

  const lines: string[] = ['MAIN-BRAIN DIRECTIVES (from cross-subject orchestrator — honor these in THIS turn):'];
  for (const d of applicable) {
    switch (d.type) {
      case 'ease_up':
        lines.push(`  • EASE UP: ${d.reason}. Use smaller steps today and more encouragement.`);
        break;
      case 'push_harder':
        lines.push(`  • PUSH HARDER: ${d.reason}. Offer a stretch question this turn.`);
        break;
      case 'shorten_session':
        lines.push(`  • SHORTEN: ${d.reason}. Keep responses compact.`);
        break;
      case 'celebrate':
        lines.push(`  • CELEBRATE: ${d.reason}. If relevant, warmly acknowledge this before teaching.`);
        break;
      case 'focus_area':
        lines.push(`  • FOCUS AREA: ${d.reason}. If your subject touches this, lead with it.`);
        break;
      case 'cross_insight': {
        const p = d.params || {};
        lines.push(`  • INSIGHT FROM ${p.fromSubject || 'another subject'}: "${p.hint || d.reason}". Use it only if it genuinely helps THIS subject.`);
        break;
      }
      case 'watch_for':
        lines.push(`  • WATCH FOR: ${d.reason}. Note it in your observation block if seen.`);
        break;
      case 'switch_modality':
        lines.push(`  • SWITCH MODALITY: ${d.reason}. Try a different explanation style this turn.`);
        break;
    }
  }
  return lines.join('\n');
}

// ============================================================
// Serialize + hydrate directives for persistence
// ============================================================

export function activeOnly(directives: BrainDirective[]): BrainDirective[] {
  const now = Date.now();
  return directives.filter((d) => new Date(d.expiresAt).getTime() > now);
}
