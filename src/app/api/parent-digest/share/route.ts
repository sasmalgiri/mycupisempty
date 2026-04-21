/**
 * Parent WhatsApp-shareable weekly summary.
 *
 * India runs on WhatsApp. BYJU's sends emails. PW sends telegrams. We generate
 * a short, emoji-friendly text the parent can paste or one-tap share to
 * WhatsApp, SMS, or any chat app.
 *
 * The text is SHORT by design — under 500 chars so it fits in a WhatsApp
 * preview and reads clean on a feature-phone SMS.
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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId') || user.id;
    const format = url.searchParams.get('format') || 'whatsapp'; // whatsapp | sms | plain

    if (studentId !== user.id) {
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('*')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [state, masteryMaps, profile, stats] = await Promise.all([
      buildStudentState(supabase, studentId),
      buildMasteryMap(supabase, studentId),
      supabase.from('profiles').select('full_name, current_class').eq('id', studentId).single().catch(() => ({ data: null })),
      supabase.from('user_stats').select('current_streak, total_xp').eq('user_id', studentId).single().catch(() => ({ data: null })),
    ]);

    const name = (profile?.data?.full_name?.split(' ')[0] || '').trim() || 'Your child';
    const classLevel = profile?.data?.current_class || state.classLevel;
    const streak = stats?.data?.current_streak || 0;
    const summary = honestMasterySummary(masteryMaps);

    // Count mastery states across subjects
    let mastered = 0, fragile = 0, decayed = 0, stalled = 0;
    for (const m of masteryMaps) {
      mastered += (m.counts.mastered || 0) + (m.counts.stable || 0);
      fragile += m.counts.fragile || 0;
      decayed += m.counts.decayed || 0;
      stalled += m.counts.stalled || 0;
    }

    const subjectList = Object.values(state.subjectStates).map((s) => ({ id: s.subjectId, name: s.subjectName }));
    const calib = subjectList.length > 0
      ? await buildCalibrationMap(supabase, studentId, subjectList).catch(() => [])
      : [];

    const bestMethodLine = calib.slice(0, 2).map((c: any) =>
      `• ${c.subjectName}: ${c.recommendedMethod.replace(/_/g, ' ')}`,
    ).join('\n');

    // Build a clean, short summary
    let message = '';
    if (format === 'whatsapp') {
      message = `📚 *${name}'s week* (Class ${classLevel})

🏆 *${mastered} topics* truly learned
${fragile > 0 ? `⚠️ ${fragile} almost there — one more review\n` : ''}${stalled > 0 ? `🛑 ${stalled} stuck — working on a new approach\n` : ''}${decayed > 0 ? `⏳ ${decayed} slipping — refreshing soon\n` : ''}🔥 ${streak}-day streak

*How ${name} learns best:*
${bestMethodLine || '(still learning their style)'}

${summary.headline}

_Sent from MyCupIsEmpty_`;
    } else if (format === 'sms') {
      message = `${name} (Class ${classLevel}): ${mastered} topics mastered, ${streak}d streak. ${summary.headline} Full report: open MyCupIsEmpty parent dashboard.`;
    } else {
      message = `${name} — Class ${classLevel}

This week:
- ${mastered} topics truly learned
- ${fragile} topics almost stuck${decayed > 0 ? `\n- ${decayed} topics slipping (refresh soon)` : ''}${stalled > 0 ? `\n- ${stalled} topics need a new approach` : ''}
- ${streak}-day consistency streak

${summary.headline}
${summary.details.join('\n')}

Best learning methods observed:
${bestMethodLine}`;
    }

    // Prepare share URLs (client can open these)
    const encodedMessage = encodeURIComponent(message);
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodedMessage}`,
      sms: `sms:?body=${encodedMessage}`,
      telegram: `https://t.me/share/url?url=&text=${encodedMessage}`,
      copy: message, // use clipboard API client-side
    };

    return NextResponse.json({
      success: true,
      format,
      message,
      characterCount: message.length,
      shareUrls,
    });
  } catch (error: any) {
    console.error('Parent share error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
