/**
 * Companion API — per-student × per-subject AI companion.
 *
 * POST action=chat   — turn in the companion conversation
 * GET                — list this student's companions + last interaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState } from '@/lib/student-state';
import { computeMaturity } from '@/lib/maturity';
import {
  buildCompanionSystemPrompt,
  getCompanionForSubject,
  parseCompanionObservation,
  COMPANIONS,
} from '@/lib/companion';
import {
  emptyMemory,
  ingestObservation,
  buildReport,
  type CompanionMemoryV2,
  type ObservationBlock,
} from '@/lib/companion-memory';
import { activeOnly, type BrainDirective } from '@/lib/main-brain';
import {
  logExperience,
  contextKeyFor,
  classBandFromClassLevel,
  moodBucketFromState,
} from '@/lib/self-learning';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // List every subject the student has touched + its companion
    const { data: subjects } = await supabase
      .from('learner_state')
      .select('topics(subject_id, subjects(id, title))')
      .eq('user_id', user.id);

    const seen = new Set<string>();
    const list: Array<{ subjectId: string; subjectName: string; companion: any }> = [];
    for (const row of subjects || []) {
      const sid = row.topics?.subject_id || row.topics?.subjects?.id;
      const sname = row.topics?.subjects?.title;
      if (!sid || !sname || seen.has(sid)) continue;
      seen.add(sid);
      const persona = getCompanionForSubject(sname);
      list.push({
        subjectId: sid,
        subjectName: sname,
        companion: {
          id: persona.id,
          name: persona.name,
          avatar: persona.avatar,
          color: persona.color,
          introduction: persona.introduction,
        },
      });
    }

    // All available personas (even for subjects not yet started)
    const allPersonas = COMPANIONS.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      introduction: p.introduction,
      personality: p.personality,
    }));

    return NextResponse.json({ success: true, studentCompanions: list, allPersonas });
  } catch (error: any) {
    console.error('Companion GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, subjectId, message, sessionId } = body;
    if (action !== 'chat') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    if (!subjectId || !message) return NextResponse.json({ error: 'subjectId and message required' }, { status: 400 });
    if (!XAI_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    // Fetch subject name
    const { data: subject } = await supabase
      .from('subjects')
      .select('id, title')
      .eq('id', subjectId)
      .maybeSingle();
    if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

    // Pick companion persona
    const persona = getCompanionForSubject(subject.title);

    // Student profile + state
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class, character_goal')
      .eq('id', user.id)
      .single()
      .catch(() => ({ data: null }));
    const classLevel = profile?.current_class || 8;
    const characterGoal: string | null = profile?.character_goal || null;

    const state = await buildStudentState(supabase, user.id);
    const subjectState = state.subjectStates[subjectId];

    let maturityProfile;
    if (subjectState) {
      maturityProfile = computeMaturity({
        userId: user.id,
        subjectId,
        subjectName: subject.title,
        subjectState,
        studentState: state,
        classLevel,
      });
    }

    // Load structured memory (v2) — falls back to empty if first session
    const { data: memoryRow } = await supabase
      .from('companion_memory')
      .select('memory_v2, summary, updated_at')
      .eq('user_id', user.id)
      .eq('subject_id', subjectId)
      .maybeSingle();
    let memory: CompanionMemoryV2 = memoryRow?.memory_v2
      ? (memoryRow.memory_v2 as CompanionMemoryV2)
      : emptyMemory(user.id, subjectId, persona.id);
    const recentMemorySummary = memoryRow?.summary || '';

    // Pull active main-brain directives for this student
    let activeDirectives: BrainDirective[] = [];
    try {
      const { data: directiveRow } = await supabase
        .from('brain_directives')
        .select('directives')
        .eq('user_id', user.id)
        .maybeSingle();
      if (directiveRow?.directives && Array.isArray(directiveRow.directives)) {
        activeDirectives = activeOnly(directiveRow.directives as BrainDirective[]);
      }
    } catch {
      // table may not exist yet
    }

    // Build or continue a session
    let thisSessionId: string | null = sessionId || null;
    if (!thisSessionId) {
      const { data: s } = await supabase
        .from('companion_sessions')
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          companion_id: persona.id,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();
      thisSessionId = s?.id || null;
    }

    // Fetch prior turns in this session
    let previousTurns: Array<{ role: string; content: string }> = [];
    if (thisSessionId) {
      const { data: turns } = await supabase
        .from('companion_turns')
        .select('role, content')
        .eq('session_id', thisSessionId)
        .order('created_at', { ascending: true })
        .limit(20);
      previousTurns = turns || [];
    }

    // Build system prompt with structured memory + directives + character goal
    const systemPrompt = buildCompanionSystemPrompt({
      persona,
      subjectName: subject.title,
      classLevel,
      maturityProfile,
      studentState: state,
      recentMemorySummary,
      memory,
      brainDirectives: activeDirectives,
      characterGoal,
    });

    // Call the AI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...previousTurns,
      { role: 'user', content: message },
    ];

    const aiResponse = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}` },
      body: JSON.stringify({ model: XAI_MODEL, messages, temperature: 0.7, max_tokens: 1200 }),
    });
    if (!aiResponse.ok) {
      const err = await aiResponse.text().catch(() => '');
      return NextResponse.json({ error: `AI ${aiResponse.status}: ${err.slice(0, 200)}` }, { status: 502 });
    }
    const data = await aiResponse.json();
    const rawReply = typeof data.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content : '';
    const { text: reply, observation } = parseCompanionObservation(rawReply);

    // Persist turns
    if (thisSessionId) {
      try {
        await supabase.from('companion_turns').insert([
          { session_id: thisSessionId, user_id: user.id, role: 'user', content: message },
          { session_id: thisSessionId, user_id: user.id, role: 'assistant', content: reply, metadata: { observation } },
        ]);
      } catch (err) {
        console.error('Turn persist failed:', err);
      }
    }

    // Feed observations back into learner_signals → StudentState adapts
    if (observation) {
      try {
        const signals: any[] = [];
        if (observation.mood_seen) {
          signals.push({
            user_id: user.id,
            signal_type: 'mood',
            category: 'emotional',
            source: `companion_${persona.id}`,
            subject_id: subjectId,
            value: 0.5,
            metadata: { mood: observation.mood_seen, via: 'companion_observation' },
            created_at: new Date().toISOString(),
          });
        }
        if (typeof observation.frustration_seen === 'number' && observation.frustration_seen >= 5) {
          signals.push({
            user_id: user.id,
            signal_type: 'frustration_signal',
            category: 'emotional',
            source: `companion_${persona.id}`,
            subject_id: subjectId,
            value: observation.frustration_seen / 10,
            metadata: { level: observation.frustration_seen, via: 'companion_observation' },
            created_at: new Date().toISOString(),
          });
        }
        if (observation.misconception_seen) {
          signals.push({
            user_id: user.id,
            signal_type: 'error_pattern',
            category: 'performance',
            source: `companion_${persona.id}`,
            subject_id: subjectId,
            value: 0,
            metadata: { misconception: observation.misconception_seen, via: 'companion_observation' },
            created_at: new Date().toISOString(),
          });
        }
        if (observation.breakthrough) {
          signals.push({
            user_id: user.id,
            signal_type: 'breakthrough',
            category: 'performance',
            source: `companion_${persona.id}`,
            subject_id: subjectId,
            value: 1,
            metadata: { insight: observation.breakthrough, via: 'companion_observation' },
            created_at: new Date().toISOString(),
          });
        }
        // === Character moment — the heart of the system ===
        // When companion witnesses the student's chosen character quality
        // showing up, log it as a first-class signal AND award character XP.
        const characterMoment = (observation as any).character_moment;
        const characterDimension = (observation as any).character_dimension;
        if (characterMoment && typeof characterMoment === 'string' && characterMoment.length > 3) {
          signals.push({
            user_id: user.id,
            signal_type: 'character_moment',
            category: 'character',
            source: `companion_${persona.id}`,
            subject_id: subjectId,
            value: 1,
            metadata: {
              moment: characterMoment.slice(0, 200),
              dimension: characterDimension || characterGoal,
              via: 'companion_observation',
              is_chosen_goal: characterDimension === characterGoal,
            },
            created_at: new Date().toISOString(),
          });
          // Award character XP — the explicit signal that "who you're becoming
          // matters as much as what you know".
          try {
            await supabase.from('xp_events').insert({
              user_id: user.id,
              source_pillar: 'character',
              source_action: `character_${characterDimension || 'moment'}`,
              source_id: subjectId,
              xp_amount: characterDimension === characterGoal ? 15 : 8,
              description: characterMoment.slice(0, 140),
            });
          } catch {}
        }
        if (signals.length > 0) {
          await supabase.from('learner_signals').insert(signals);
        }
      } catch (err) {
        console.error('Observation signal persist failed:', err);
      }
    }

    // === Self-learning: log this turn as an experience ===
    // The companion's choice of tone + modality (from the persona) is the "action".
    // The reward is inferred from observation: breakthrough = +1, friction = -1, else 0.
    try {
      if (observation) {
        const obs = observation as any;
        let reward = 0;
        if (obs.breakthrough) reward += 0.6;
        if (obs.trust_moment) reward += 0.3;
        if (typeof obs.engagement_seen === 'number') reward += (obs.engagement_seen - 5) / 20; // -0.25..0.25
        if (obs.friction_moment) reward -= 0.4;
        if (obs.misconception_seen) reward -= 0.15;
        if (typeof obs.frustration_seen === 'number' && obs.frustration_seen >= 7) reward -= 0.25;

        const contextKey = contextKeyFor({
          subjectName: subject.title,
          maturityBand: maturityProfile?.band,
          moodBucket: moodBucketFromState(state.frustrationLevel, state.confidenceLevel),
          classBand: classBandFromClassLevel(classLevel),
        });

        // Log the companion's tone + modality choice as the action.
        const actionKey = `companion:${persona.id}:tone_${memory.rapport.tone}`;
        await logExperience(supabase, {
          userId: user.id,
          kind: 'companion_tone',
          contextKey,
          actionKey,
          reward,
          metadata: {
            subject_id: subjectId,
            rapport_strength: memory.rapport.strength,
            turn_index: previousTurns.length,
          },
        }, { resolvedNow: true });
        // Experience is resolved immediately because we observed the outcome in this very turn.
        // We don't need a separate resolver for companion tone choices.
      }
    } catch (err) {
      console.error('Experience log failed (non-fatal):', err);
    }

    // === Update structured memory EVERY turn ===
    // Rich observations feed typed facts/preferences/topic progress.
    try {
      if (observation) {
        const obsBlock = observation as ObservationBlock;
        memory = ingestObservation(memory, obsBlock, 0);
        memory.sessionCount = previousTurns.length === 0 ? memory.sessionCount + 1 : memory.sessionCount;
      }

      // Recompute the report every 4 turns (or at session start) so main
      // brain has a fresh view without over-querying AI.
      if (previousTurns.length % 4 === 0) {
        // Pull last N observations from companion_turns metadata
        const { data: recentTurnRows } = await supabase
          .from('companion_turns')
          .select('metadata')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        const recentObs: ObservationBlock[] = (recentTurnRows || [])
          .map((t: any) => t.metadata?.observation)
          .filter(Boolean);
        if (observation) recentObs.unshift(observation as ObservationBlock);
        memory.lastReport = buildReport(memory, recentObs);
      }

      await supabase.from('companion_memory').upsert({
        user_id: user.id,
        subject_id: subjectId,
        companion_id: persona.id,
        memory_v2: memory,
        summary: memory.facts.slice(0, 5).map((f) => f.content).join(' | '),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,subject_id' });
    } catch (err) {
      console.error('Memory v2 persist failed:', err);
    }

    return NextResponse.json({
      success: true,
      sessionId: thisSessionId,
      companion: {
        id: persona.id,
        name: persona.name,
        avatar: persona.avatar,
        color: persona.color,
      },
      reply,
      observation,
      maturity: maturityProfile ? {
        band: maturityProfile.band,
        composite: maturityProfile.compositeScore,
      } : null,
    });
  } catch (error: any) {
    console.error('Companion POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
