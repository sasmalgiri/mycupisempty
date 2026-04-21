/**
 * Daily Briefing — the first thing the student sees in the morning.
 *
 * Aggregates across all companions:
 *   - What each companion noticed yesterday
 *   - Any breakthroughs to celebrate
 *   - One top thing to work on today
 *   - A single warm one-liner from the "strongest rapport" companion
 *
 * Served deterministically (no AI call required) so it's fast and free.
 * The companion's rapport level picks who speaks; tone matches that companion's
 * personality.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { COMPANIONS } from '@/lib/companion';
import type { CompanionMemoryV2 } from '@/lib/companion-memory';
import { buildStudentState } from '@/lib/student-state';
import { buildMasteryMap } from '@/lib/mastery';
import { dailyThought, pickContent, type CharacterDim } from '@/lib/content-library';
import { briefingCache, cached, cacheKey, studentStateCache, masteryCache } from '@/lib/cache';

interface BriefingSection {
  companionId: string;
  companionName: string;
  companionAvatar: string;
  subjectName: string;
  line: string;                  // one-line companion speaks
  sentiment: string;
  rapport: number;
}

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Try cache first (TTL 30 min — briefing is a "once a day" feel anyway)
    const cachedBriefing = briefingCache.get(cacheKey(user.id, 'briefing'));
    if (cachedBriefing) {
      return NextResponse.json({ success: true, briefing: cachedBriefing, cached: true });
    }

    const [state, masteryMaps, memoryRowsResult, statsResult, profileResult, goalRowResult] = await Promise.all([
      (cached(studentStateCache, cacheKey(user.id, 'state'), () => buildStudentState(supabase, user.id)) as ReturnType<typeof buildStudentState>).catch(() => null as any),
      (cached(masteryCache, cacheKey(user.id, 'mastery'), () => buildMasteryMap(supabase, user.id)) as ReturnType<typeof buildMasteryMap>).catch(() => [] as any),
      supabase.from('companion_memory')
        .select('subject_id, companion_id, memory_v2, subjects(title)')
        .eq('user_id', user.id)
        .catch(() => ({ data: [] })),
      supabase.from('user_stats')
        .select('current_streak, last_activity_date, total_xp')
        .eq('user_id', user.id)
        .maybeSingle()
        .catch(() => ({ data: null })),
      supabase.from('profiles')
        .select('full_name, language, character_goal')
        .eq('id', user.id)
        .single()
        .catch(() => ({ data: null })),
      // Character goal from onboarding signal (fallback if profiles.character_goal isn't set yet)
      supabase.from('learner_signals')
        .select('metadata')
        .eq('user_id', user.id)
        .eq('signal_type', 'character_goal_set')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .catch(() => ({ data: null })),
    ]);

    const characterGoal: CharacterDim | null =
      (profileResult?.data?.character_goal as CharacterDim | null) ||
      (goalRowResult?.data?.metadata?.dimension as CharacterDim | null) ||
      null;
    const language = (profileResult?.data?.language as 'en' | 'hi' | 'bn') || 'en';

    const firstName = (profileResult?.data?.full_name || '').split(' ')[0] || 'there';
    const streak = statsResult?.data?.current_streak || 0;
    const lastActivity = statsResult?.data?.last_activity_date;
    const memoryRows = memoryRowsResult?.data || [];

    // === Companion-by-companion briefing sections ===
    const sections: BriefingSection[] = [];
    for (const row of memoryRows) {
      const memory = row.memory_v2 as CompanionMemoryV2 | null;
      if (!memory?.lastReport) continue;
      const persona = COMPANIONS.find((c) => c.id === memory.companionId) || COMPANIONS[COMPANIONS.length - 1];
      const subjectName = row.subjects?.title || 'your subject';
      const report = memory.lastReport;

      // Compose one natural line based on report + rapport
      let line: string;
      if (report.breakthroughs.length > 0) {
        line = rapportFlavored(persona, `You had a breakthrough with ${report.breakthroughs[0]} — let's build on it today.`, memory.rapport.tone);
      } else if (report.urgentFlags.length > 0) {
        line = rapportFlavored(persona, `Yesterday felt heavy (${report.urgentFlags[0]}). Let's start gentle today.`, memory.rapport.tone);
      } else if (report.concerns.length > 0) {
        line = rapportFlavored(persona, `Keep an eye on ${report.concerns[0]} — 10 minutes today and we'll untangle it.`, memory.rapport.tone);
      } else if (report.sentimentWindow === 'flourishing') {
        line = rapportFlavored(persona, `You're in a flow with ${subjectName}. Ready to stretch a little?`, memory.rapport.tone);
      } else {
        line = rapportFlavored(persona, `Quick ${subjectName} check-in whenever you're ready.`, memory.rapport.tone);
      }

      sections.push({
        companionId: persona.id,
        companionName: persona.name,
        companionAvatar: persona.avatar,
        subjectName,
        line,
        sentiment: report.sentimentWindow,
        rapport: memory.rapport.strength,
      });
    }

    // Sort by rapport (strongest first — they get to open the briefing)
    sections.sort((a, b) => b.rapport - a.rapport);

    // === Headline + one recommended action ===
    let headline: string;
    const breakthroughCount = sections.filter((s) => s.sentiment === 'flourishing').length;
    const strainedCount = sections.filter((s) => s.sentiment === 'strained').length;

    const today = new Date().toISOString().split('T')[0];
    const studiedToday = lastActivity === today;
    const greeting = greetingForTime();

    // Day-1 honesty: no companion has spoken yet, so don't pretend they have
    const isFirstDay = sections.length === 0 && !lastActivity;
    if (isFirstDay) {
      headline = `${greeting}, ${firstName}. Day 1. Your companions will get to know you this week — start with anything that feels right.`;
    } else if (!lastActivity) {
      headline = `${greeting}, ${firstName}. Fresh start today — pick any subject to begin.`;
    } else if (streak >= 7 && breakthroughCount > 0) {
      headline = `${greeting}, ${firstName}. Day ${streak} of your streak — your companions noticed real momentum yesterday.`;
    } else if (strainedCount >= 2) {
      headline = `${greeting}, ${firstName}. Yesterday was heavy. Let's ease in today — one topic, one win.`;
    } else if (studiedToday) {
      headline = `${greeting}, ${firstName}. You've already been at it today. Keep going at your own pace.`;
    } else if (streak > 0) {
      headline = `${greeting}, ${firstName}. Day ${streak + 1} awaits.`;
    } else {
      headline = `${greeting}, ${firstName}. Welcome back — your companions have been waiting.`;
    }

    // === Top things to focus on ===
    const todayActions: Array<{ kind: 'review' | 'fix' | 'stretch' | 'start'; label: string; href: string }> = [];
    const allFragile = masteryMaps.flatMap((m: any) => m.counts.fragile || 0).reduce((s: number, n: number) => s + n, 0);
    const allStalled = masteryMaps.flatMap((m: any) => m.counts.stalled || 0).reduce((s: number, n: number) => s + n, 0);
    const allDecayed = masteryMaps.flatMap((m: any) => m.counts.decayed || 0).reduce((s: number, n: number) => s + n, 0);

    if (allStalled > 0) todayActions.push({ kind: 'fix', label: `${allStalled} topic${allStalled > 1 ? 's' : ''} needs a new angle`, href: '/subjects' });
    if (allDecayed > 0) todayActions.push({ kind: 'review', label: `${allDecayed} topic${allDecayed > 1 ? 's are' : ' is'} slipping — quick refresh`, href: '/flashcards' });
    if (allFragile > 0 && todayActions.length < 3) todayActions.push({ kind: 'review', label: `Lock in ${allFragile} fragile topic${allFragile > 1 ? 's' : ''}`, href: '/flashcards' });
    if (todayActions.length === 0) todayActions.push({ kind: 'start', label: 'Daily Mix — 15 focused minutes', href: '/daily-mix' });

    // Character-goal + daily thought — the quiet thread that shapes WHO the
    // student is becoming, beyond just grades.
    const thought = dailyThought();
    let characterNudge: string | null = null;
    if (characterGoal) {
      const reflection = pickContent({ kind: 'reflection_prompt', targetsCharacter: characterGoal, lang: language })[0];
      const label = characterGoal.replace(/_/g, ' ');
      characterNudge = reflection?.body
        || `Small thing for today: grow your ${label} by one notch. Any moment counts.`;
    }

    const briefing = {
      generatedAt: new Date().toISOString(),
      greeting: headline,
      sections: sections.slice(0, 4),         // cap at 4 companions speaking
      todayActions: todayActions.slice(0, 3),
      streak,
      studiedToday,
      dailyThought: { title: thought.title, body: thought.body },
      characterGoal,
      characterNudge,
    };

    briefingCache.set(cacheKey(user.id, 'briefing'), briefing);

    return NextResponse.json({ success: true, briefing });
  } catch (error: any) {
    console.error('Daily briefing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// Flavor a line by companion tone + persona quirk
// ============================================================

function rapportFlavored(persona: { id: string; name: string; signatureQuirk: string }, line: string, tone: string): string {
  const prefix = tone === 'playful' ? `${persona.name}: ` : tone === 'mentor' ? `${persona.name} (mentor-mode): ` : `${persona.name}: `;
  return prefix + line;
}

function greetingForTime(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Good morning';
  if (h < 16) return 'Good afternoon';
  if (h < 20) return 'Good evening';
  return 'Still up';
}
