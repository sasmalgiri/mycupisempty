import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// ============================================================================
// GET: Fetch existing growth stories for the user
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: stories, error } = await supabase
      .from('growth_stories')
      .select('*')
      .eq('user_id', user.id)
      .order('period_end', { ascending: false });

    if (error) {
      console.error('Growth stories fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stories: stories || [] });
  } catch (error) {
    console.error('Growth story GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch growth stories' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Generate a new growth story
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action !== 'generate') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { period_start, period_end, story_type } = body;

    if (!period_start || !period_end || !story_type) {
      return NextResponse.json(
        { error: 'Missing required fields: period_start, period_end, story_type' },
        { status: 400 }
      );
    }

    // --- Gather data from multiple sources ---

    // 1. Outcome snapshots nearest to period_start and period_end
    const { data: startSnapshot } = await supabase
      .from('outcome_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .lte('created_at', period_start)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: endSnapshot } = await supabase
      .from('outcome_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .lte('created_at', period_end)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 2. Student development profile: current dimension scores
    const { data: devProfile } = await supabase
      .from('student_development_profile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // 3. Habit stats from student_habits
    const { data: studentHabits } = await supabase
      .from('student_habits')
      .select('id, user_id, current_streak, is_active, habit_definitions(name)')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // 4. Reflection entries count
    const { data: reflections } = await supabase
      .from('reflection_entries')
      .select('id, reflection_type')
      .eq('user_id', user.id)
      .gte('created_at', period_start)
      .lte('created_at', period_end);

    // 5. Learner state: topics mastered, mastery bands
    const { data: learnerStates } = await supabase
      .from('learner_state')
      .select('current_band, mastery_total')
      .eq('user_id', user.id);

    // 6. Profile info for the student's name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, current_class')
      .eq('id', user.id)
      .single();

    // --- Compile context ---
    const studentName = profile?.full_name || 'Student';
    const classLevel = profile?.current_class || '';

    const activeHabits = studentHabits || [];
    const totalHabitCompletions = activeHabits.length;
    const uniqueHabitsTracked = activeHabits.length;
    const longestStreak = Math.max(...activeHabits.map((h: any) => h.current_streak || 0), 0);

    const reflectionCount = (reflections || []).length;

    const topicsMastered = (learnerStates || []).filter((ls: any) => ls.current_band === 'advanced').length;
    const totalTopics = (learnerStates || []).length;
    const avgMastery = totalTopics > 0
      ? Math.round((learnerStates || []).reduce((s: number, ls: any) => s + (ls.mastery_total || 0), 0) / totalTopics)
      : 0;

    const masteryBandCounts: Record<string, number> = {};
    (learnerStates || []).forEach((ls: any) => {
      const band = ls.current_band || 'unknown';
      masteryBandCounts[band] = (masteryBandCounts[band] || 0) + 1;
    });

    const archetypeTags = devProfile?.archetype_tags || [];
    const strengths: string[] = [];
    const growthAreas: string[] = [];

    if (devProfile) {
      const dimensionScores: Record<string, number> = {};
      const dims = [
        'focus', 'memory_habits', 'reasoning', 'problem_solving', 'reflection',
        'decision_making', 'self_learning', 'curiosity', 'discipline', 'patience',
        'honesty', 'empathy', 'responsibility', 'consistency', 'failure_handling',
        'confidence', 'emotional_regulation', 'social_conduct', 'communication',
        'financial_awareness', 'digital_safety', 'time_management',
        'real_world_problem_solving', 'career_awareness', 'teamwork', 'practical_skills',
      ];
      dims.forEach(dim => {
        const score = devProfile[`${dim}_score`];
        if (score !== undefined && score !== null) {
          dimensionScores[dim] = score;
        }
      });

      const sorted = Object.entries(dimensionScores).sort((a, b) => b[1] - a[1]);
      sorted.slice(0, 5).forEach(([dim]) => strengths.push(dim.replace(/_/g, ' ')));
      sorted.slice(-5).forEach(([dim]) => growthAreas.push(dim.replace(/_/g, ' ')));
    }

    // --- Snapshot comparison ---
    let snapshotComparison = 'No snapshot data available for comparison.';
    if (startSnapshot && endSnapshot) {
      snapshotComparison = `Start of period scores: ${JSON.stringify(startSnapshot.scores || {})}. End of period scores: ${JSON.stringify(endSnapshot.scores || {})}.`;
    } else if (endSnapshot) {
      snapshotComparison = `Current period scores: ${JSON.stringify(endSnapshot.scores || {})}.`;
    }

    // --- Build the AI prompt ---
    // Map invalid story types to valid ones
    const validStoryTypes = ['monthly', 'term', 'annual', 'on_demand'];
    const storyTypeMapping: Record<string, string> = {
      weekly: 'on_demand',
      milestone: 'on_demand',
    };
    const resolvedStoryType = storyTypeMapping[story_type] || story_type;
    if (!validStoryTypes.includes(resolvedStoryType)) {
      return NextResponse.json(
        { error: `Invalid story_type. Must be one of: ${validStoryTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const storyTypeLabels: Record<string, string> = {
      monthly: 'a monthly growth narrative',
      term: 'a term-end growth reflection',
      annual: 'an annual growth story',
      on_demand: 'a growth summary',
    };

    const prompt = `You are a warm, encouraging educational storyteller. Write ${storyTypeLabels[resolvedStoryType] || 'a growth narrative'} for a student.

STUDENT PROFILE:
- Name: ${studentName}
- Class: ${classLevel}
- Archetypes: ${archetypeTags.join(', ') || 'Not yet determined'}
- Top strengths: ${strengths.join(', ') || 'Still discovering'}
- Growth areas: ${growthAreas.join(', ') || 'Still discovering'}

PERIOD: ${period_start} to ${period_end}

ACADEMIC DATA:
- Topics studied: ${totalTopics}
- Topics mastered: ${topicsMastered}
- Average mastery score: ${avgMastery}%
- Mastery band distribution: ${JSON.stringify(masteryBandCounts)}
- ${snapshotComparison}

HABITS & CHARACTER:
- Total habit completions in period: ${totalHabitCompletions}
- Unique habits tracked: ${uniqueHabitsTracked}
- Longest active habit streak: ${longestStreak} days
- Reflections written: ${reflectionCount}

DEVELOPMENT COMPOSITES:
- Cognitive: ${devProfile?.cognitive_composite || 'N/A'}
- Character: ${devProfile?.character_composite || 'N/A'}
- Life Readiness: ${devProfile?.life_readiness_composite || 'N/A'}

INSTRUCTIONS:
- Write a 200-400 word narrative in second person ("you")
- Address the student by name (${studentName})
- Celebrate specific achievements and growth
- Acknowledge challenges with empathy and encouragement
- If data is limited, focus on potential and the journey ahead
- Use warm, motivating language appropriate for an Indian student
- Include 3-5 key highlights as bullet points at the end
- End with an encouraging forward-looking statement

Write the growth story now:`;

    // --- Call Ollama to generate the story ---
    let narrative = '';
    let highlights: string[] = [];

    try {
      const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          options: { temperature: 0.8, top_p: 0.9, num_predict: 1024 },
        }),
      });

      if (!ollamaResponse.ok) {
        throw new Error(`Ollama API error: ${ollamaResponse.status}`);
      }

      const ollamaData = await ollamaResponse.json();
      narrative = ollamaData.response || '';

      // Try to extract highlights from the narrative
      const bulletMatches = narrative.match(/[-*]\s+(.+)/g);
      if (bulletMatches) {
        highlights = bulletMatches.slice(0, 5).map((b: string) => b.replace(/^[-*]\s+/, '').trim());
      }
    } catch (ollamaError) {
      console.error('Ollama generation error, using fallback:', ollamaError);

      // Fallback narrative when Ollama is unavailable
      narrative = buildFallbackNarrative(
        studentName, period_start, period_end, resolvedStoryType,
        totalTopics, topicsMastered, avgMastery,
        totalHabitCompletions, longestStreak, reflectionCount,
        strengths, growthAreas
      );
      highlights = [
        topicsMastered > 0 ? `Mastered ${topicsMastered} topics` : `Studied ${totalTopics} topics`,
        totalHabitCompletions > 0 ? `Completed habits ${totalHabitCompletions} times` : 'Building new habits',
        reflectionCount > 0 ? `Wrote ${reflectionCount} reflections` : 'Growing in self-awareness',
        `Average mastery: ${avgMastery}%`,
        strengths.length > 0 ? `Key strength: ${strengths[0]}` : 'Discovering your unique strengths',
      ];
    }

    // --- Save to growth_stories table ---
    const { data: story, error: insertError } = await supabase
      .from('growth_stories')
      .insert({
        user_id: user.id,
        period_start,
        period_end,
        story_type: resolvedStoryType,
        narrative_text: narrative,
        highlights,
        archetype_journey: {
          archetype_tags: archetypeTags,
          strengths,
          growth_areas: growthAreas,
        },
        academic_snapshot: {
          total_topics: totalTopics,
          topics_mastered: topicsMastered,
          avg_mastery: avgMastery,
          mastery_band_counts: masteryBandCounts,
        },
        development_snapshot: {
          cognitive_composite: devProfile?.cognitive_composite,
          character_composite: devProfile?.character_composite,
          life_readiness_composite: devProfile?.life_readiness_composite,
        },
        engagement_snapshot: {
          habit_completions: totalHabitCompletions,
          reflection_count: reflectionCount,
          longest_streak: longestStreak,
          unique_habits_tracked: uniqueHabitsTracked,
        },
        milestones: [],
      })
      .select()
      .single();

    if (insertError) {
      console.error('Growth story insert error:', insertError);
      // Return the story even if save fails
      return NextResponse.json({
        story: {
          narrative_text: narrative,
          highlights,
          period_start,
          period_end,
          story_type: resolvedStoryType,
          created_at: new Date().toISOString(),
        },
        saved: false,
        error: insertError.message,
      });
    }

    return NextResponse.json({ story, saved: true });
  } catch (error) {
    console.error('Growth story POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate growth story' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Fallback narrative builder (when Ollama is unavailable)
// ============================================================================

function buildFallbackNarrative(
  name: string, periodStart: string, periodEnd: string, storyType: string,
  totalTopics: number, topicsMastered: number, avgMastery: number,
  habitCompletions: number, longestStreak: number, reflectionCount: number,
  strengths: string[], growthAreas: string[]
): string {
  const periodLabel = storyType === 'monthly' ? 'month' : storyType === 'term' ? 'term' : storyType === 'annual' ? 'year' : 'period';

  let story = `Dear ${name},\n\n`;
  story += `What a journey this ${periodLabel} has been! From ${periodStart} to ${periodEnd}, you've been working hard on your learning, and every step matters.\n\n`;

  if (totalTopics > 0) {
    story += `You explored ${totalTopics} topic${totalTopics > 1 ? 's' : ''} during this time`;
    if (topicsMastered > 0) {
      story += `, and you've truly mastered ${topicsMastered} of them -- that's real progress! `;
    } else {
      story += `, and you're building a strong foundation for mastery. `;
    }
    story += `Your average mastery sits at ${avgMastery}%, which shows ${avgMastery >= 70 ? 'excellent understanding' : avgMastery >= 50 ? 'solid progress with room to grow' : 'that you\'re on your way -- keep going!'}.\n\n`;
  }

  if (habitCompletions > 0) {
    story += `Your habits are shaping who you're becoming. You completed your habits ${habitCompletions} times this ${periodLabel}`;
    if (longestStreak > 3) {
      story += `, with an impressive ${longestStreak}-day streak! Consistency is the key to greatness, and you're proving that every day`;
    }
    story += `.\n\n`;
  }

  if (reflectionCount > 0) {
    story += `You also took time to reflect ${reflectionCount} time${reflectionCount > 1 ? 's' : ''} -- that's the mark of a thoughtful learner who cares about growing, not just scoring.\n\n`;
  }

  if (strengths.length > 0) {
    story += `Your biggest strengths right now are ${strengths.slice(0, 3).join(', ')}. These are your superpowers -- lean into them!\n\n`;
  }

  if (growthAreas.length > 0) {
    story += `And there's always room to grow. Areas like ${growthAreas.slice(0, 2).join(' and ')} are your next frontiers. Remember, every expert was once a beginner.\n\n`;
  }

  story += `Keep filling your cup, ${name}. The journey of learning never ends, and you're doing better than you think. Your future self will thank you for the effort you're putting in today.`;

  return story;
}
