import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET: Fetch weakness heat map data
export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subject_id');

    // Query learner_state joined with topics, chapters, subjects
    let query = supabase
      .from('learner_state')
      .select(`
        *,
        topics!inner (
          id,
          title,
          chapter_id,
          chapters!inner (
            id,
            title,
            subject_id,
            subjects!inner (
              id,
              name
            )
          )
        )
      `)
      .eq('user_id', user.id);

    // Filter by subject if provided
    if (subjectId) {
      query = query.eq('topics.chapters.subject_id', subjectId);
    }

    const { data: learnerStates, error } = await query;

    if (error) {
      console.error('Heatmap query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform the data into heat map format
    const topics = (learnerStates || []).map((state: any) => ({
      topic_id: state.topics?.id || state.topic_id,
      topic_title: state.topics?.title || 'Unknown Topic',
      chapter_title: state.topics?.chapters?.title || 'Unknown Chapter',
      subject_name: state.topics?.chapters?.subjects?.name || 'Unknown Subject',
      mastery_recall: state.mastery_score_recall ?? 0,
      mastery_comprehension: state.mastery_score_comprehension ?? 0,
      mastery_application: state.mastery_score_application ?? 0,
      mastery_transfer: state.mastery_score_transfer ?? 0,
      mastery_retention: state.mastery_score_retention ?? 0,
      mastery_metacognition: state.mastery_score_metacognition ?? 0,
      mastery_independence: state.mastery_score_independence ?? 0,
      mastery_total: state.mastery_total ?? 0,
      mastery_band: state.current_band || 'foundation',
    }));

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Heatmap API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch heatmap data' },
      { status: 500 }
    );
  }
}
