import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET: Fetch student's comprehension evaluations
export async function GET(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get('subject_id');
  const evalType = searchParams.get('eval_type');

  let query = supabase
    .from('comprehension_evaluations' as any)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (subjectId) query = query.eq('subject_id', subjectId);
  if (evalType) query = query.eq('eval_type', evalType);

  const { data } = await query.limit(50);
  return NextResponse.json({ evaluations: data || [] });
}

// POST: Create & submit comprehension evaluation
export async function POST(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  if (action === 'create') {
    const { subject_id, chapter_id, topic_id, style_code, education_level_code, eval_type, questions } = body;

    const { data, error } = await (supabase
      .from('comprehension_evaluations' as any) as any)
      .insert({
        user_id: user.id,
        subject_id,
        chapter_id,
        topic_id,
        style_code,
        education_level_code,
        eval_type: eval_type || 'checkpoint',
        questions: questions || [],
        status: 'in_progress',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ evaluation: data });
  }

  if (action === 'submit') {
    const { evaluation_id, answers, time_taken_minutes } = body;

    if (!evaluation_id || !answers) {
      return NextResponse.json({ error: 'evaluation_id and answers required' }, { status: 400 });
    }

    // Get the evaluation
    const { data: evaluation } = await supabase
      .from('comprehension_evaluations' as any)
      .select('*')
      .eq('id', evaluation_id)
      .eq('user_id', user.id)
      .single();

    if (!evaluation) return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });

    // Score the answers across Bloom's levels
    const questions = evaluation.questions as any[];
    let scoreKnowledge = 0, scoreComprehension = 0, scoreApplication = 0;
    let scoreAnalysis = 0, scoreEvaluation = 0, scoreCreation = 0;
    let totalPoints = 0;
    const styleSignals: Record<string, number> = {};

    answers.forEach((answer: any, i: number) => {
      const q = questions[i];
      if (!q) return;

      const points = q.points || 10;
      totalPoints += points;

      // For MCQ, auto-score
      let earned = 0;
      if (q.type === 'mcq' && q.options) {
        earned = answer.selected === q.correct_answer ? points : 0;
      } else {
        // For open-ended, use self-assessment or default 70%
        earned = answer.self_score !== undefined ? (answer.self_score / 100) * points : points * 0.7;
      }

      // Distribute to Bloom's levels
      switch (q.bloom_level) {
        case 'remember': scoreKnowledge += earned; break;
        case 'understand': scoreComprehension += earned; break;
        case 'apply': scoreApplication += earned; break;
        case 'analyze': scoreAnalysis += earned; break;
        case 'evaluate': scoreEvaluation += earned; break;
        case 'create': scoreCreation += earned; break;
      }

      // Accumulate style signals from questions
      if (q.style_indicators) {
        for (const [style, weight] of Object.entries(q.style_indicators)) {
          styleSignals[style] = (styleSignals[style] || 0) + (weight as number);
        }
      }
    });

    const overallScore = totalPoints > 0
      ? ((scoreKnowledge + scoreComprehension + scoreApplication + scoreAnalysis + scoreEvaluation + scoreCreation) / totalPoints) * 100
      : 0;

    const { data, error } = await supabase
      .from('comprehension_evaluations' as any)
      .update({
        answers,
        score_knowledge: totalPoints > 0 ? (scoreKnowledge / totalPoints) * 100 : 0,
        score_comprehension: totalPoints > 0 ? (scoreComprehension / totalPoints) * 100 : 0,
        score_application: totalPoints > 0 ? (scoreApplication / totalPoints) * 100 : 0,
        score_analysis: totalPoints > 0 ? (scoreAnalysis / totalPoints) * 100 : 0,
        score_evaluation: totalPoints > 0 ? (scoreEvaluation / totalPoints) * 100 : 0,
        score_creation: totalPoints > 0 ? (scoreCreation / totalPoints) * 100 : 0,
        overall_score: overallScore,
        style_signals: styleSignals,
        time_taken_minutes,
        completed_at: new Date().toISOString(),
        status: 'completed',
      })
      .eq('id', evaluation_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      evaluation: data,
      scores: {
        knowledge: scoreKnowledge,
        comprehension: scoreComprehension,
        application: scoreApplication,
        analysis: scoreAnalysis,
        evaluation: scoreEvaluation,
        creation: scoreCreation,
        overall: overallScore,
      },
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
