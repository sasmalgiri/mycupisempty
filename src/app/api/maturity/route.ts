/**
 * Maturity API — returns per-subject maturity profile + adaptation settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState } from '@/lib/student-state';
import { computeMaturity, adaptationForMaturity } from '@/lib/maturity';
import { computeCalibration, type PredictionRecord } from '@/lib/metacognition';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId') || user.id;
    const subjectFilter = url.searchParams.get('subjectId');

    // Parent access check
    if (studentId !== user.id) {
      const { data: link } = await supabase
        .from('parent_student_links')
        .select('*')
        .eq('parent_id', user.id)
        .eq('student_id', studentId)
        .maybeSingle();
      if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const state = await buildStudentState(supabase, studentId);

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
      .eq('id', studentId)
      .single()
      .catch(() => ({ data: null }));
    const classLevel = profile?.current_class || state.classLevel;

    // Metacognition calibration
    const { data: predictionSignals } = await supabase
      .from('learner_signals')
      .select('value, metadata, created_at, subject_id')
      .eq('user_id', studentId)
      .eq('signal_type', 'prediction_record')
      .order('created_at', { ascending: false })
      .limit(200)
      .catch(() => ({ data: [] }));
    const predictions: PredictionRecord[] = (predictionSignals || []).map((s: any) => ({
      userId: studentId,
      topicId: s.metadata?.topic_id,
      subjectId: s.subject_id,
      questionId: s.metadata?.question_id || '',
      predictedConfidence: (s.metadata?.predicted_confidence || 3) as any,
      wasCorrect: s.value === 1,
      timestamp: s.created_at,
    }));
    const calibration = computeCalibration(predictions);
    const metacognitionCalibration = calibration.calibrationScore;

    // Creative score — from writing feedback signals
    const { data: writingSignals } = await supabase
      .from('learner_signals')
      .select('value, metadata, subject_id')
      .eq('user_id', studentId)
      .eq('signal_type', 'writing_feedback')
      .order('created_at', { ascending: false })
      .limit(20)
      .catch(() => ({ data: [] }));

    // Build one profile per subject in subjectStates
    const subjectsToProfile = subjectFilter
      ? Object.entries(state.subjectStates).filter(([id]) => id === subjectFilter)
      : Object.entries(state.subjectStates);

    const profiles = subjectsToProfile.map(([subjectId, subjectState]) => {
      // Subject-specific creative score
      const subjectWritingSignals = (writingSignals || []).filter((s: any) => s.subject_id === subjectId);
      const creativeScore = subjectWritingSignals.length > 0
        ? subjectWritingSignals.reduce((sum: number, s: any) => sum + (s.value || 0), 0) / subjectWritingSignals.length
        : undefined;

      // Subject-specific metacog — fallback to global if no per-subject data
      const subjectPredictions = predictions.filter((p) => p.subjectId === subjectId);
      const subjectCalibration = subjectPredictions.length >= 5
        ? computeCalibration(subjectPredictions).calibrationScore
        : metacognitionCalibration;

      const prof = computeMaturity({
        userId: studentId,
        subjectId,
        subjectName: subjectState.subjectName,
        subjectState,
        studentState: state,
        metacognitionCalibration: subjectCalibration,
        creativeScore,
        classLevel,
      });
      const adaptation = adaptationForMaturity(prof);
      return { ...prof, adaptation };
    });

    // Persist latest snapshot
    try {
      for (const p of profiles) {
        await supabase.from('maturity_profiles').upsert({
          user_id: studentId,
          subject_id: p.subjectId,
          composite_score: p.compositeScore,
          band: p.band,
          dimensions: p.dimensions,
          confidence: p.confidence,
          updated_at: p.lastUpdated,
        }, { onConflict: 'user_id,subject_id' });
      }
    } catch (err) {
      // Table may not exist yet
    }

    return NextResponse.json({ success: true, profiles });
  } catch (error: any) {
    console.error('Maturity error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
