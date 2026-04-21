/**
 * Report Export — generates printable HTML for parent/teacher reports.
 *
 * Returns a self-contained HTML page with inline CSS that the browser can
 * print as PDF. No backend PDF library needed — we rely on the browser's
 * excellent Print-to-PDF. This keeps the bundle small and the output
 * printable on any device.
 *
 * Usage: fetch('/api/report?studentId=...&type=monthly'), open in a new
 * window, and call window.print(). Or use the 'download' button we render.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState } from '@/lib/student-state';
import { buildMasteryMap, honestMasterySummary } from '@/lib/mastery';
import { buildCalibrationMap } from '@/lib/method-calibration';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId') || user.id;
    const reportType = url.searchParams.get('type') || 'monthly';

    if (studentId !== user.id) {
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('*')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (!link) return new Response('Forbidden', { status: 403 });
    }

    const [state, masteryMaps, profile, stats] = await Promise.all([
      buildStudentState(supabase, studentId),
      buildMasteryMap(supabase, studentId),
      supabase.from('profiles').select('full_name, current_class, school_name').eq('id', studentId).single().catch(() => ({ data: null })),
      supabase.from('user_stats').select('current_streak, longest_streak, total_xp, total_questions_answered, correct_answers').eq('user_id', studentId).single().catch(() => ({ data: null })),
    ]);

    const subjectList = Object.values(state.subjectStates).map((s) => ({ id: s.subjectId, name: s.subjectName }));
    const calibration = subjectList.length > 0
      ? await buildCalibrationMap(supabase, studentId, subjectList).catch(() => [])
      : [];

    const name = profile?.data?.full_name || 'Student';
    const className = profile?.data?.current_class || state.classLevel;
    const school = profile?.data?.school_name || '';
    const summary = honestMasterySummary(masteryMaps);

    const totalTopics = masteryMaps.reduce((s: number, m: any) => s + m.topics.length, 0);
    const mastered = masteryMaps.reduce((s: number, m: any) => s + (m.counts.mastered || 0) + (m.counts.stable || 0), 0);
    const fragile = masteryMaps.reduce((s: number, m: any) => s + (m.counts.fragile || 0), 0);
    const stalled = masteryMaps.reduce((s: number, m: any) => s + (m.counts.stalled || 0), 0);

    const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${name} — Learning Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 32px; color: #1f2937; background: white; max-width: 800px; margin: 0 auto; line-height: 1.5; }
  h1 { color: #6366f1; margin: 0 0 4px 0; }
  h2 { color: #4338ca; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-top: 28px; }
  h3 { color: #374151; margin-top: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #6366f1; margin-bottom: 24px; }
  .logo { font-weight: 800; font-size: 1.25rem; color: #6366f1; }
  .subtitle { color: #6b7280; font-size: 0.9rem; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .stat { padding: 16px; background: #f9fafb; border-radius: 8px; text-align: center; }
  .stat-value { font-size: 1.75rem; font-weight: 800; color: #6366f1; }
  .stat-label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .subject { padding: 12px; background: #f9fafb; border-left: 4px solid #6366f1; margin-bottom: 10px; border-radius: 4px; }
  .subject-name { font-weight: 700; margin-bottom: 4px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .chip { padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
  .chip-green { background: #d1fae5; color: #065f46; }
  .chip-amber { background: #fef3c7; color: #92400e; }
  .chip-red { background: #fee2e2; color: #991b1b; }
  .chip-blue { background: #dbeafe; color: #1e40af; }
  .method-card { padding: 10px; background: #f5f3ff; border-radius: 6px; margin-bottom: 8px; }
  .method-label { font-weight: 600; color: #6d28d9; }
  .evidence { font-size: 0.8rem; color: #4b5563; margin-top: 4px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af; text-align: center; }
  .print-btn { position: fixed; top: 16px; right: 16px; background: #6366f1; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; }
  .print-btn:hover { background: #4f46e5; }
  @media print {
    .print-btn { display: none; }
    body { padding: 0; }
  }
  @page { margin: 16mm; }
</style>
</head>
<body>
  <button onclick="window.print()" class="print-btn">🖨️ Save as PDF</button>
  <div class="header">
    <div>
      <h1>${escape(name)}</h1>
      <div class="subtitle">Class ${className}${school ? ' · ' + escape(school) : ''}</div>
    </div>
    <div style="text-align: right;">
      <div class="logo">MyCupIsEmpty</div>
      <div class="subtitle">${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report · ${now}</div>
    </div>
  </div>

  <h2>Summary</h2>
  <p>${escape(summary.headline)}</p>
  <ul>
    ${summary.details.map((d: string) => `<li>${escape(d)}</li>`).join('')}
  </ul>

  <h2>By the numbers</h2>
  <div class="stats">
    <div class="stat">
      <div class="stat-value">${mastered}</div>
      <div class="stat-label">Topics Mastered</div>
    </div>
    <div class="stat">
      <div class="stat-value">${fragile}</div>
      <div class="stat-label">Almost Stuck</div>
    </div>
    <div class="stat">
      <div class="stat-value">${stats?.data?.current_streak || 0}</div>
      <div class="stat-label">Day Streak</div>
    </div>
    <div class="stat">
      <div class="stat-value">${stats?.data?.total_questions_answered ? Math.round(((stats.data.correct_answers || 0) / stats.data.total_questions_answered) * 100) : 0}%</div>
      <div class="stat-label">Accuracy</div>
    </div>
  </div>

  <h2>Per-Subject Breakdown</h2>
  ${masteryMaps.map((m: any) => `
    <div class="subject">
      <div class="subject-name">${escape(m.subjectName)}</div>
      <div class="chips">
        ${m.counts.mastered > 0 ? `<span class="chip chip-green">🏆 ${m.counts.mastered} mastered</span>` : ''}
        ${m.counts.stable > 0 ? `<span class="chip chip-green">✓ ${m.counts.stable} stable</span>` : ''}
        ${m.counts.fragile > 0 ? `<span class="chip chip-amber">⚠ ${m.counts.fragile} fragile</span>` : ''}
        ${m.counts.decayed > 0 ? `<span class="chip chip-amber">⏳ ${m.counts.decayed} slipping</span>` : ''}
        ${m.counts.stalled > 0 ? `<span class="chip chip-red">🛑 ${m.counts.stalled} stuck</span>` : ''}
        ${m.counts.learning > 0 ? `<span class="chip chip-blue">📖 ${m.counts.learning} learning</span>` : ''}
      </div>
      <div class="evidence"><strong>${m.trueMasteryPercent}%</strong> truly known · ${m.topics.length} topic${m.topics.length === 1 ? '' : 's'} engaged</div>
      ${m.needsAttention?.length ? `<div class="evidence">Next action: ${escape(m.needsAttention[0].nextAction.label)} — ${escape(m.needsAttention[0].topicTitle)}</div>` : ''}
    </div>
  `).join('')}

  ${calibration.length > 0 ? `
    <h2>How ${escape(name.split(' ')[0])} Learns Best</h2>
    <p style="color: #6b7280; font-size: 0.9rem;">Observed from behavior — not self-reported.</p>
    ${calibration.map((c: any) => `
      <div class="method-card">
        <span class="method-label">${escape(c.subjectName)}: ${escape(c.recommendedMethod.replace(/_/g, ' '))}</span>
        <div class="evidence">${escape(c.evidence)}</div>
      </div>
    `).join('')}
  ` : ''}

  <h2>Whole-Human Snapshot</h2>
  <p>${escape(name.split(' ')[0])} is growing in more than academics. We track:</p>
  <ul>
    <li><strong>Cognitive</strong>: focus, reasoning, curiosity, memory habits</li>
    <li><strong>Character</strong>: discipline, patience, empathy, responsibility</li>
    <li><strong>Life Readiness</strong>: communication, time management, teamwork</li>
  </ul>
  <p>See the parent dashboard for monthly scores across all dimensions.</p>

  <div class="footer">
    Generated by MyCupIsEmpty · ${now} · This report is based on behavioral observations from the student's learning activity.
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Report error:', error);
    return new Response(`Report failed: ${error.message}`, { status: 500 });
  }
}

function escape(s: any): string {
  if (typeof s !== 'string') return String(s ?? '');
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
