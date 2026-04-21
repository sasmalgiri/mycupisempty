/**
 * Metacognition API
 *
 * POST — record a predict-then-answer event
 * GET  — returns the student's calibration stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { computeCalibration, pickWhyProbe, type ConfidenceLevel, type PredictionRecord } from '@/lib/metacognition';

export async function GET() {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Pull prediction records from learner_signals
    const { data: signals } = await supabase
      .from('learner_signals')
      .select('value, metadata, created_at, subject_id')
      .eq('user_id', user.id)
      .eq('signal_type', 'prediction_record')
      .order('created_at', { ascending: false })
      .limit(500)
      .catch(() => ({ data: [] }));

    const records: PredictionRecord[] = (signals || []).map((s: any) => ({
      userId: user.id,
      topicId: s.metadata?.topic_id,
      subjectId: s.subject_id,
      questionId: s.metadata?.question_id || '',
      predictedConfidence: (s.metadata?.predicted_confidence || 3) as ConfidenceLevel,
      wasCorrect: s.value === 1,
      timestamp: s.created_at,
    }));

    const stats = computeCalibration(records);
    return NextResponse.json({ success: true, stats, recentCount: records.length });
  } catch (error: any) {
    console.error('Metacognition GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { questionId, topicId, subjectId, predictedConfidence, wasCorrect } = body;

    if (predictedConfidence == null || wasCorrect == null) {
      return NextResponse.json({ error: 'predictedConfidence and wasCorrect required' }, { status: 400 });
    }
    const confidence = Number(predictedConfidence);
    if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) {
      return NextResponse.json({ error: 'predictedConfidence must be integer 1..5' }, { status: 400 });
    }

    // Persist as a learner_signal
    try {
      await supabase.from('learner_signals').insert({
        user_id: user.id,
        signal_type: 'prediction_record',
        category: 'metacognition',
        source: 'predict_then_answer',
        subject_id: subjectId || null,
        value: wasCorrect ? 1 : 0,
        metadata: {
          question_id: questionId,
          topic_id: topicId,
          predicted_confidence: confidence,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // ignore — table may not exist yet
    }

    const probe = pickWhyProbe(wasCorrect, confidence as ConfidenceLevel);

    return NextResponse.json({
      success: true,
      whyProbe: probe,
      // Hint back: was this a calibrated answer?
      calibrationFeedback: wasCorrect && confidence >= 4
        ? 'Well predicted ✓'
        : !wasCorrect && confidence <= 2
        ? 'Honest prediction ✓'
        : wasCorrect && confidence <= 2
        ? 'You knew more than you thought!'
        : !wasCorrect && confidence >= 4
        ? 'Check what happened — confidence mismatch helps you learn faster than a wrong answer alone.'
        : null,
    });
  } catch (error: any) {
    console.error('Metacognition POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
