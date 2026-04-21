/**
 * Parent Empathy Digest
 *
 * BYJU's sends "your child scored 78%" emails. Parents have no idea what to do with that.
 *
 * This digest tells parents what their child is GOING THROUGH. In natural language.
 * "This week Aarav struggled with fractions — not because he can't do math, but because he
 *  rushes when tired. Try asking him to show you the 1/2 + 1/3 problem on paper. He'll teach
 *  you and it'll click for him too."
 *
 * That's something a parent can actually use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState } from '@/lib/student-state';
import { buildMasteryMap, honestMasterySummary } from '@/lib/mastery';
import { detectInterventions } from '@/lib/intervention-engine';
import { buildCalibrationMap } from '@/lib/method-calibration';
import { IP_AFFILIATION_RULES } from '@/lib/legal-prompts';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Query params: ?studentId=... (parent viewing child) or default to self
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('studentId') || user.id;

    // Verify parent-student link if different user
    if (targetUserId !== user.id) {
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('*')
        .eq('parent_id', user.id)
        .eq('student_id', targetUserId)
        .maybeSingle();
      if (!link) {
        return NextResponse.json({ error: 'Not authorized to view this student' }, { status: 403 });
      }
    }

    const [state, masteryMaps, profileResult] = await Promise.all([
      buildStudentState(supabase, targetUserId),
      buildMasteryMap(supabase, targetUserId),
      supabase.from('profiles').select('full_name, current_class').eq('id', targetUserId).single().catch(() => ({ data: null })),
    ]);

    // Calibration map — what methods are working for this student per subject
    const subjectList = Object.values(state.subjectStates).map((s) => ({ id: s.subjectId, name: s.subjectName }));
    const calibrationMap = subjectList.length > 0
      ? await buildCalibrationMap(supabase, targetUserId, subjectList).catch(() => [])
      : [];

    // Growth timeline for whole-human picture
    let growthDeltas: any = null;
    let growthHighlights: string[] = [];
    try {
      const { data: devProfile } = await supabase
        .from('student_development_profile')
        .select('cognitive_composite, character_composite, life_readiness_composite')
        .eq('user_id', targetUserId)
        .maybeSingle();
      if (devProfile) {
        growthDeltas = {
          cognitive: devProfile.cognitive_composite ?? 50,
          character: devProfile.character_composite ?? 50,
          lifeReadiness: devProfile.life_readiness_composite ?? 50,
        };
        if ((devProfile.character_composite ?? 50) > 65) growthHighlights.push('character is developing steadily');
        if ((devProfile.cognitive_composite ?? 50) > 65) growthHighlights.push('cognitive strengths are building');
        if ((devProfile.life_readiness_composite ?? 50) > 60) growthHighlights.push('life readiness skills are growing');
      }
    } catch {}

    const studentName = profileResult?.data?.full_name?.split(' ')[0] || 'your child';
    const classLevel = profileResult?.data?.current_class || state.classLevel;

    const summary = honestMasterySummary(masteryMaps);
    const interventions = detectInterventions(state);

    // Character growth — LEAD with this in the parent letter
    let characterGoal: string | null = null;
    let characterMomentCount = 0;
    let recentCharacterMoments: string[] = [];
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('character_goal')
        .eq('id', targetUserId)
        .maybeSingle();
      characterGoal = prof?.character_goal || null;
      if (characterGoal) {
        const { data: momentRows } = await supabase
          .from('learner_signals')
          .select('metadata, created_at')
          .eq('user_id', targetUserId)
          .eq('signal_type', 'character_moment')
          .order('created_at', { ascending: false })
          .limit(60);
        const relevant = (momentRows || []).filter((m: any) => m.metadata?.dimension === characterGoal);
        characterMomentCount = relevant.length;
        recentCharacterMoments = relevant.slice(0, 3).map((m: any) => m.metadata?.moment).filter(Boolean);
      }
    } catch {}

    // Build structured digest data
    const digest = {
      studentName,
      classLevel,
      periodDescription: 'the last 7 days',
      headline: summary.headline,
      masteryDetails: summary.details,
      emotionalSnapshot: {
        mood: state.currentMood,
        energy: state.energyLevel,
        frustration: state.frustrationLevel,
        confidence: state.confidenceLevel,
        activeMinutesToday: state.minutesActiveToday,
        attentionSpan: state.attentionSpanMinutes,
      },
      subjectBreakdown: Object.values(state.subjectStates).map((s) => ({
        name: s.subjectName,
        accuracy: Math.round(s.recentAccuracy * 100),
        trend: s.accuracyTrend,
        band: s.currentBand,
        stuckOn: s.stalledTopics,
        strongIn: s.strongTopics,
      })),
      whatToDoThisWeek: interventions.slice(0, 3).map((i) => ({
        title: i.title,
        why: i.misconception,
        howToHelp: i.correction,
        askYourChild: i.practicePrompt,
      })),
      celebrate: masteryMaps.flatMap((m) => m.readyToStretch).slice(0, 3).map((t) => t.topicTitle),
      // Per-subject learning method calibration (what's working, evidence-backed)
      methodCalibration: calibrationMap.map((c) => ({
        subject: c.subjectName,
        bestMethod: c.bestMethod,
        score: Math.round(c.bestScore * 100),
        evidence: c.evidence,
      })),
      // Whole-human growth picture
      wholeHumanGrowth: growthDeltas ? {
        cognitive: growthDeltas.cognitive,
        character: growthDeltas.character,
        lifeReadiness: growthDeltas.lifeReadiness,
        highlights: growthHighlights,
      } : null,
      // The heart of the letter: the character quality this student is growing
      characterFocus: characterGoal ? {
        dimension: characterGoal,
        label: characterGoal.replace(/_/g, ' '),
        momentCount: characterMomentCount,
        recentMoments: recentCharacterMoments,
      } : null,
    };

    // Generate natural-language letter
    let letter = '';
    try {
      if (XAI_API_KEY) {
        const prompt = buildLetterPrompt(digest);
        const aiResponse = await fetch(`${XAI_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${XAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: XAI_MODEL,
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: 'Please write the letter now.' },
            ],
            temperature: 0.7,
            max_tokens: 700,
          }),
        });
        if (aiResponse.ok) {
          const data = await aiResponse.json();
          letter = data.choices?.[0]?.message?.content || '';
        }
      }
    } catch (e) {
      console.error('Parent digest AI error, using fallback:', e);
    }

    if (!letter) {
      letter = buildFallbackLetter(digest);
    }

    return NextResponse.json({
      digest,
      letter,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Parent digest error:', error);
    return NextResponse.json({ error: 'Failed to generate digest' }, { status: 500 });
  }
}

// ============================================================
// Prompt: natural letter to a parent
// ============================================================

function buildLetterPrompt(d: any): string {
  return `${IP_AFFILIATION_RULES}

You are writing a warm, honest letter to the parent of a Class ${d.classLevel} student in India. The parent wants to know what their child is going through in school learning — not test scores, but the emotional and cognitive picture.

Your voice: a caring, experienced teacher. Warm but honest. No jargon. No "your child scored X%." No manipulative language. Actionable.

Student's first name: ${d.studentName}

This week's data (observed, not self-reported):
- Current mood: ${d.emotionalSnapshot.mood}, energy: ${d.emotionalSnapshot.energy}
- Frustration level today: ${d.emotionalSnapshot.frustration}/10
- Confidence level: ${d.emotionalSnapshot.confidence}/10
- Active for ${d.emotionalSnapshot.activeMinutesToday} minutes today (attention span is ~${d.emotionalSnapshot.attentionSpan} min)
- Overall headline: ${d.headline}
- Detail: ${d.masteryDetails.join(' ')}

Subjects:
${d.subjectBreakdown.map((s: any) => `- ${s.name}: ${s.accuracy}% accuracy (${s.trend}), ${s.band} band${s.stuckOn?.length ? `. Stuck on: ${s.stuckOn.join(', ')}` : ''}${s.strongIn?.length ? `. Strong in: ${s.strongIn.join(', ')}` : ''}`).join('\n')}

${d.methodCalibration?.length > 0 ? `How ${d.studentName} learns best (observed, per subject):
${d.methodCalibration.map((c: any) => `- ${c.subject}: ${c.bestMethod.replace(/_/g, ' ')} (${c.score}% effectiveness). ${c.evidence}`).join('\n')}` : ''}

${d.wholeHumanGrowth ? `Whole-human growth scores:
- Cognitive (focus, reasoning, curiosity): ${d.wholeHumanGrowth.cognitive}/100
- Character (discipline, patience, empathy, responsibility): ${d.wholeHumanGrowth.character}/100
- Life readiness (communication, time management, teamwork): ${d.wholeHumanGrowth.lifeReadiness}/100
${d.wholeHumanGrowth.highlights?.length ? `Notable: ${d.wholeHumanGrowth.highlights.join(', ')}` : ''}` : ''}

${d.whatToDoThisWeek.length > 0 ? `Specific misconceptions to help with:
${d.whatToDoThisWeek.map((w: any, i: number) => `${i + 1}. ${w.title} — ${w.why}`).join('\n')}` : ''}

${d.celebrate.length > 0 ? `Things to celebrate: ${d.celebrate.join(', ')}` : ''}

${d.characterFocus ? `
CHARACTER FOCUS (this is ${d.studentName}'s chosen quality to grow this year — "${d.characterFocus.label}"):
- ${d.characterFocus.momentCount} moment${d.characterFocus.momentCount === 1 ? '' : 's'} of "${d.characterFocus.label}" observed so far
${d.characterFocus.recentMoments.length > 0 ? 'Recent moments we noticed:\n' + d.characterFocus.recentMoments.map((m: string) => `  • ${m}`).join('\n') : 'No observed moments yet — they will come'}
` : ''}

Write a 200-300 word letter. Structure (IMPORTANT: LEAD with character, not grades):
1. Open with ONE warm, specific sentence about ${d.studentName}'s character quality showing up (or the quality they chose, if no moments yet). This is THE most important line in the letter.
2. Then, briefly: what's working academically (with specifics).
3. What's hard right now — explain WHY, not just WHAT.
4. 2-3 concrete things the parent can try this week. Be specific. Not "read with them" — but "after dinner, ask them to explain one math problem to you like you don't know it. Notice if they pause before answering — that pause IS ${d.characterFocus ? d.characterFocus.label : 'character'} in action."
5. End with ONE sentence that shows faith in who the child is becoming, not just what they're learning.

Do NOT start with "Dear Parent." Start with something warmer and more personal.
Do NOT end with "Best regards" or signatures. End with the forward-looking sentence about who they're becoming.`;
}

function buildFallbackLetter(d: any): string {
  const mood = d.emotionalSnapshot.mood;
  const frust = d.emotionalSnapshot.frustration;

  let opening = `This week with ${d.studentName}:`;
  if (frust > 5) opening = `It\'s been a tough week for ${d.studentName}.`;
  else if (mood === 'energetic') opening = `${d.studentName} has been in a great rhythm this week.`;
  else if (mood === 'bored') opening = `${d.studentName} seems a little under-stimulated lately.`;

  const subjectsLine = d.subjectBreakdown.length > 0
    ? d.subjectBreakdown.map((s: any) => `${s.name} is at ${s.accuracy}% (${s.trend})`).join(', ')
    : 'Not enough data yet for subject-level insights.';

  const suggestion = d.whatToDoThisWeek[0];
  const tryThis = suggestion
    ? `This week, try asking them: "${suggestion.askYourChild}" — it\'s tied to something they\'re currently working through (${suggestion.why}).`
    : `This week, set aside 10 quiet minutes where they can show you anything they\'re learning. You don\'t need to teach — just listen and be curious.`;

  const celebrate = d.celebrate.length > 0
    ? ` Worth celebrating: they\'ve genuinely understood ${d.celebrate.slice(0, 2).join(' and ')}.`
    : '';

  return `${opening} ${d.headline}

Where they stand: ${subjectsLine}.${celebrate}

${d.emotionalSnapshot.confidence < 5 ? 'Their confidence has dipped — this is usually temporary and often means they\'re about to push through. ' : ''}${frust > 5 ? 'They\'ve shown some frustration signals, which usually means they care about getting it right. ' : ''}

${tryThis}

${d.studentName} is doing the work. The cup doesn\'t fill in a week — but we\'re watching it fill, drop by drop.`;
}
