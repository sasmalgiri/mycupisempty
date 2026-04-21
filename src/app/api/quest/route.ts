/**
 * Cross-Subject Quest API.
 *
 * GET                  — list active + completed quests
 * POST action=generate — create a new quest based on student state + companions
 * POST action=complete_step { questId, stepOrder, submission } — mark progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState } from '@/lib/student-state';
import { COMPANIONS } from '@/lib/companion';
import type { CompanionMemoryV2 } from '@/lib/companion-memory';
import { generateQuest, pickQuestCompanions } from '@/lib/quest-generator';

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: quests } = await supabase
      .from('quests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ success: true, quests: quests || [] });
  } catch (error: any) {
    console.error('Quests GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    if (body.action === 'generate') {
      const state = await buildStudentState(supabase, user.id);

      // Read companion memories for rapport-sorted picks
      const { data: memoryRows } = await supabase
        .from('companion_memory')
        .select('subject_id, companion_id, memory_v2, subjects(id, title)')
        .eq('user_id', user.id);

      const memories = (memoryRows || [])
        .filter((r: any) => r.memory_v2)
        .map((r: any) => ({
          subjectId: r.subjects?.id || r.subject_id,
          subjectName: r.subjects?.title || 'Subject',
          memory: r.memory_v2 as CompanionMemoryV2,
        }));

      const personaMap: Record<string, typeof COMPANIONS[number]> = {};
      for (const c of COMPANIONS) personaMap[c.id] = c;

      const companions = pickQuestCompanions(memories, personaMap, 3);
      if (companions.length < 2) {
        return NextResponse.json({
          error: 'Not enough active companions yet. Spend time in at least 2 subjects to unlock quests.',
        }, { status: 422 });
      }

      const quest = generateQuest({
        studentState: state,
        availableCompanions: companions,
      });

      if (!quest) {
        return NextResponse.json({
          error: 'No matching quest theme for your current subjects. Try again after exploring a different subject.',
        }, { status: 422 });
      }

      // Persist
      try {
        await supabase.from('quests').insert({
          id: quest.id,
          user_id: user.id,
          title: quest.title,
          theme: quest.theme,
          narrative: quest.narrative,
          steps: quest.steps,
          progress: {},
          status: 'active',
          xp_reward: quest.xpReward,
          created_at: quest.createdAt,
        });
      } catch (err) {
        console.error('Quest persist failed (non-fatal):', err);
      }

      return NextResponse.json({ success: true, quest });
    }

    if (body.action === 'complete_step') {
      const { questId, stepOrder, submission } = body;
      if (!questId || stepOrder == null) {
        return NextResponse.json({ error: 'questId and stepOrder required' }, { status: 400 });
      }

      const { data: quest } = await supabase
        .from('quests')
        .select('*')
        .eq('id', questId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!quest) return NextResponse.json({ error: 'Quest not found' }, { status: 404 });

      const progress = quest.progress || {};
      progress[stepOrder] = {
        completed: true,
        submission,
        completedAt: new Date().toISOString(),
      };

      const totalSteps = Array.isArray(quest.steps) ? quest.steps.length : 0;
      const completedSteps = Object.values(progress).filter((p: any) => p.completed).length;
      const fullyDone = completedSteps >= totalSteps && totalSteps > 0;

      await supabase.from('quests')
        .update({
          progress,
          status: fullyDone ? 'completed' : 'active',
          completed_at: fullyDone ? new Date().toISOString() : null,
        })
        .eq('id', questId)
        .eq('user_id', user.id);

      // Award XP on full completion
      if (fullyDone && quest.xp_reward) {
        try {
          await supabase.from('xp_events').insert({
            user_id: user.id,
            source_pillar: 'academic',
            source_action: 'quest_completed',
            source_id: questId,
            xp_amount: quest.xp_reward,
            description: `Quest completed: ${quest.title}`,
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        progress,
        completed: fullyDone,
        xpAwarded: fullyDone ? quest.xp_reward : 0,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Quest POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
