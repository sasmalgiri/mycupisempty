/**
 * Exam Mode API
 *
 * POST action=start     — generates a timed exam from a blueprint
 * POST action=submit    — submits answers, returns deep analysis
 * GET                   — returns past exam attempts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  generateExamFromBlueprint,
  analyzeExam,
  EXAM_BLUEPRINTS,
  type ExamAttempt,
  type ExamType,
  type ExamAnalysis,
} from '@/lib/exam-mode';
import { detectInterventions, type Intervention } from '@/lib/intervention-engine';
import { buildStudentState } from '@/lib/student-state';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: attempts } = await supabase
      .from('exam_attempts')
      .select('id, exam_type, score, max_score, percentage, started_at, ended_at, analysis')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      blueprints: EXAM_BLUEPRINTS,
      attempts: attempts || [],
    });
  } catch (error: any) {
    console.error('Exam GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    // ==========================================================
    // START — generate a new exam from a blueprint
    // ==========================================================
    if (action === 'start') {
      const { examType, subjectIds } = body as { examType: ExamType; subjectIds?: string[] };
      const blueprint = EXAM_BLUEPRINTS[examType];
      if (!blueprint) {
        return NextResponse.json({ error: 'Unknown exam type' }, { status: 400 });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('current_class')
        .eq('id', user.id)
        .single();
      const classLevel = profile?.current_class || 10;

      const questions = await generateExamFromBlueprint(supabase, blueprint, classLevel, subjectIds);

      if (questions.length === 0) {
        return NextResponse.json({
          error: 'Not enough questions available for this blueprint. Try a different exam or add more content.',
        }, { status: 422 });
      }

      // Create attempt record
      const { data: attempt } = await supabase
        .from('exam_attempts')
        .insert({
          user_id: user.id,
          exam_type: examType,
          blueprint,
          questions: questions.map((q) => ({ id: q.id, subject_id: q.subject_id, difficulty: q.difficulty, marks: q.marks })),
          duration_seconds: blueprint.durationMinutes * 60,
          started_at: new Date().toISOString(),
          status: 'in_progress',
        })
        .select()
        .maybeSingle();

      return NextResponse.json({
        success: true,
        examId: attempt?.id,
        blueprint,
        questions,  // full questions sent to client; answers validated server-side
        durationSeconds: blueprint.durationMinutes * 60,
      });
    }

    // ==========================================================
    // SUBMIT — score + analyze
    // ==========================================================
    if (action === 'submit') {
      const { examId, answers, durationSeconds } = body;
      if (!examId) return NextResponse.json({ error: 'examId required' }, { status: 400 });

      // Fetch attempt + questions
      const { data: attempt } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', examId)
        .eq('user_id', user.id)
        .single();
      if (!attempt) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

      // Re-fetch questions with correct answers for scoring
      const questionIds = (attempt.questions || []).map((q: any) => q.id);
      if (questionIds.length === 0) {
        return NextResponse.json({ error: 'Exam has no questions — cannot submit.' }, { status: 400 });
      }
      const { data: fullQuestions } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_answer, explanation, subject_id, topic_id, difficulty, subjects(title)')
        .in('id', questionIds);

      const examAttempt: ExamAttempt = {
        examId,
        userId: user.id,
        examType: attempt.exam_type,
        startedAt: attempt.started_at,
        endedAt: new Date().toISOString(),
        durationSeconds: durationSeconds || 0,
        questions: (fullQuestions || []).map((q: any) => {
          const stub = (attempt.questions || []).find((s: any) => s.id === q.id);
          return {
            id: q.id,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            subject_id: q.subject_id,
            subject_name: q.subjects?.title,
            topic_id: q.topic_id,
            difficulty: q.difficulty,
            marks: stub?.marks ?? 1,
            negative_marks: stub?.negative_marks,
          };
        }),
        answers: answers || {},
      };

      // Get previous attempt of same type for comparison
      const { data: prev } = await supabase
        .from('exam_attempts')
        .select('analysis')
        .eq('user_id', user.id)
        .eq('exam_type', attempt.exam_type)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const previousAnalysis: ExamAnalysis | undefined =
        prev?.analysis && typeof prev.analysis === 'object' && Array.isArray((prev.analysis as any).subjectBreakdown)
          ? (prev.analysis as ExamAnalysis)
          : undefined;

      const analysis = analyzeExam(examAttempt, previousAnalysis);

      // Persist
      const { error: updateError } = await supabase
        .from('exam_attempts')
        .update({
          ended_at: examAttempt.endedAt,
          status: 'completed',
          score: analysis.score,
          max_score: analysis.maxScore,
          percentage: analysis.percentage,
          analysis,
          answers,
        })
        .eq('id', examId)
        .eq('user_id', user.id);
      if (updateError) {
        console.error('Failed to persist exam result:', updateError);
        // Still return analysis to the user so their effort isn't lost
      }

      // Record per-question answer signals for calibration + mastery
      try {
        const signals = examAttempt.questions.map((q) => {
          const a = (answers || {})[q.id];
          return {
            user_id: user.id,
            signal_type: 'answer_result',
            category: 'performance',
            source: 'exam_mode',
            subject_id: q.subject_id,
            value: a?.selected === q.correct_answer ? 1 : 0,
            metadata: {
              topic_id: q.topic_id,
              difficulty: q.difficulty,
              time_to_answer: a?.timeSpentSeconds || 0,
              exam_type: attempt.exam_type,
              error_type: !a?.selected ? 'skipped' :
                          a.selected !== q.correct_answer && (a.timeSpentSeconds || 0) < 20 ? 'careless_arithmetic' :
                          a.selected !== q.correct_answer && (a.timeSpentSeconds || 0) > 90 ? 'concept_gap' :
                          undefined,
            },
            created_at: new Date().toISOString(),
          };
        });
        if (signals.length > 0) {
          await supabase.from('learner_signals').insert(signals);
        }
      } catch {
        // ignore — table may not exist
      }

      // Detect new interventions from exam performance
      let newInterventions: Intervention[] = [];
      try {
        const state = await buildStudentState(supabase, user.id);
        newInterventions = detectInterventions(state).slice(0, 3);
      } catch {}

      return NextResponse.json({
        success: true,
        examId,
        analysis,
        interventions: newInterventions,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Exam POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
