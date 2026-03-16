import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET: Fetch student's lifecycle progress across all levels
export async function GET(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'progress';

  if (action === 'progress') {
    const { data: progress } = await supabase
      .from('lifecycle_progress' as any)
      .select(`
        *,
        education_levels!lifecycle_progress_education_level_code_fkey (
          code, name, name_hindi, level_order, level_group, age_range
        )
      `)
      .eq('user_id', user.id)
      .order('education_level_code');

    return NextResponse.json({ progress: progress || [] });
  }

  if (action === 'curriculum_for_style') {
    // Get style-optimized curriculum for student's style + subject + level
    const subjectId = searchParams.get('subject_id');
    const styleCode = searchParams.get('style_code');
    const levelCode = searchParams.get('level_code');

    if (!subjectId || !styleCode) {
      return NextResponse.json({ error: 'subject_id and style_code required' }, { status: 400 });
    }

    let query = supabase
      .from('style_curriculum_mapping' as any)
      .select('*')
      .eq('subject_id', subjectId)
      .eq('style_code', styleCode)
      .eq('is_active', true);

    if (levelCode) query = query.eq('education_level_code', levelCode);

    const { data: curriculum } = await query;
    return NextResponse.json({ curriculum: curriculum || [] });
  }

  if (action === 'levels') {
    const { data: levels } = await supabase
      .from('education_levels' as any)
      .select('*')
      .eq('is_active', true)
      .order('level_order');

    return NextResponse.json({ levels: levels || [] });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// POST: Update lifecycle progress
export async function POST(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  if (action === 'init_progress') {
    // Initialize progress for a subject at a level
    const { education_level_code, subject_id, style_code, chapters_total, topics_total } = body;

    const { data, error } = await supabase
      .from('lifecycle_progress' as any)
      .upsert({
        user_id: user.id,
        education_level_code,
        subject_id,
        style_code,
        chapters_total: chapters_total || 0,
        topics_total: topics_total || 0,
        status: 'active',
        started_at: new Date().toISOString(),
      }, { onConflict: 'user_id,education_level_code,subject_id' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ progress: data });
  }

  if (action === 'update_progress') {
    const { progress_id, chapters_completed, topics_mastered, avg_comprehension, study_hours_add, current_chapter_id, current_topic_id } = body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (chapters_completed !== undefined) updates.chapters_completed = chapters_completed;
    if (topics_mastered !== undefined) updates.topics_mastered = topics_mastered;
    if (avg_comprehension !== undefined) updates.avg_comprehension = avg_comprehension;
    if (current_chapter_id) updates.current_chapter_id = current_chapter_id;
    if (current_topic_id) updates.current_topic_id = current_topic_id;

    const { data, error } = await supabase
      .from('lifecycle_progress' as any)
      .update(updates)
      .eq('id', progress_id)
      .eq('user_id', user.id)
      .select()
      .single();

    // If study hours need incrementing
    if (study_hours_add && data) {
      await supabase
        .from('lifecycle_progress' as any)
        .update({ total_study_hours: (data.total_study_hours || 0) + study_hours_add })
        .eq('id', progress_id);
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ progress: data });
  }

  if (action === 'complete_level') {
    const { progress_id } = body;

    const { data, error } = await supabase
      .from('lifecycle_progress' as any)
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', progress_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ progress: data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
