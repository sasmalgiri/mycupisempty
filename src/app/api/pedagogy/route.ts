import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  scoreDiagnostic, sm2, computeMetacognition, adjustScaffoldLevel,
  scoreMasteryCheckpoint, extractSignals, routeStudent, determineTier,
  computeRetrievalStrength, computeHintDependence,
} from '@/lib/pedagogy-engine';
import { DEFAULT_THRESHOLDS } from '@/types/pedagogy-engine';

// ============================================================================
// GET: Fetch learner state, due retrieval items, engine route
// ============================================================================

export async function GET(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'state';

  // --- Get or create learner state ---
  if (action === 'state') {
    const subjectId = searchParams.get('subject_id');
    const topicId = searchParams.get('topic_id');

    let query = supabase.from('learner_state').select('*').eq('user_id', user.id);
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (topicId) query = query.eq('topic_id', topicId);

    const { data: state } = await query.order('updated_at', { ascending: false }).limit(1).single();

    if (!state) {
      return NextResponse.json({ state: null, message: 'No learner state found. POST with action=init to create one.' });
    }

    // Count due retrieval items
    const { count: dueCount } = await supabase
      .from('retrieval_queue')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lte('next_review_at', new Date().toISOString());

    // Compute current route
    const signals = extractSignals(state, dueCount || 0);
    const currentRoute = routeStudent(state, signals);

    return NextResponse.json({
      state,
      current_route: currentRoute,
      due_retrieval_count: dueCount || 0,
      active_misconception_count: (state.active_misconceptions || []).filter((m: any) => !m.resolved).length,
    });
  }

  // --- Diagnostic items for a topic ---
  if (action === 'diagnostic_items') {
    const topicId = searchParams.get('topic_id');
    const subjectId = searchParams.get('subject_id');

    let query = supabase.from('diagnostic_items').select('*').eq('is_active', true);
    if (topicId) query = query.eq('topic_id', topicId);
    else if (subjectId) query = query.eq('subject_id', subjectId);

    const { data: items } = await query.order('difficulty');
    return NextResponse.json({ items: items || [] });
  }

  // --- Scaffold steps for a topic/level ---
  if (action === 'scaffold_steps') {
    const topicId = searchParams.get('topic_id');
    const level = parseInt(searchParams.get('level') || '3');

    const { data: steps } = await supabase
      .from('scaffold_steps')
      .select('*')
      .eq('topic_id', topicId)
      .eq('scaffold_level', level)
      .eq('is_active', true)
      .order('created_at');

    return NextResponse.json({ steps: steps || [] });
  }

  // --- Due retrieval items ---
  if (action === 'retrieval_due') {
    const { data: items } = await supabase
      .from('retrieval_queue')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at')
      .limit(20);

    return NextResponse.json({ items: items || [] });
  }

  // --- Misconceptions for student ---
  if (action === 'my_misconceptions') {
    const { data: misconceptions } = await supabase
      .from('student_misconceptions')
      .select('*, misconception_bank!student_misconceptions_misconception_code_fkey(*)')
      .eq('user_id', user.id)
      .eq('is_resolved', false)
      .order('last_seen_at', { ascending: false });

    return NextResponse.json({ misconceptions: misconceptions || [] });
  }

  // --- Mastery checkpoints ---
  if (action === 'checkpoints') {
    const topicId = searchParams.get('topic_id');
    const subjectId = searchParams.get('subject_id');

    let query = supabase.from('mastery_checkpoints').select('*').eq('user_id', user.id);
    if (topicId) query = query.eq('topic_id', topicId);
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data: checkpoints } = await query.order('created_at', { ascending: false }).limit(20);
    return NextResponse.json({ checkpoints: checkpoints || [] });
  }

  // --- Module event history ---
  if (action === 'events') {
    const stateId = searchParams.get('state_id');
    let query = supabase.from('module_events').select('*').eq('user_id', user.id);
    if (stateId) query = query.eq('learner_state_id', stateId);

    const { data: events } = await query.order('created_at', { ascending: false }).limit(50);
    return NextResponse.json({ events: events || [] });
  }

  // --- Engine decision log ---
  if (action === 'decisions') {
    const stateId = searchParams.get('state_id');
    let query = supabase.from('engine_decisions').select('*').eq('user_id', user.id);
    if (stateId) query = query.eq('learner_state_id', stateId);

    const { data: decisions } = await query.order('created_at', { ascending: false }).limit(50);
    return NextResponse.json({ decisions: decisions || [] });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// ============================================================================
// POST: All module interactions
// ============================================================================

export async function POST(request: NextRequest) {
  const supabase: any = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  // ──────────────────────────────────────────────
  // INIT: Create a new learner state for topic
  // ──────────────────────────────────────────────
  if (action === 'init') {
    const { subject_id, chapter_id, topic_id, education_level_code, preferred_format, language_level, pacing } = body;

    const { data: state, error } = await supabase
      .from('learner_state')
      .upsert({
        user_id: user.id,
        subject_id,
        chapter_id: chapter_id || null,
        topic_id: topic_id || null,
        education_level_code,
        current_module: 'access_fit',
        preferred_format: preferred_format || 'text',
        language_level: language_level || 'standard',
        pacing: pacing || 'normal',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,subject_id,chapter_id,topic_id' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log engine decision
    await logDecision(supabase, user.id, state.id, subject_id, topic_id, null, 'access_fit', 'New topic initialized', {});

    return NextResponse.json({ state });
  }

  // ──────────────────────────────────────────────
  // PREFERENCES: Update Module 1 access preferences
  // ──────────────────────────────────────────────
  if (action === 'preferences') {
    const { learner_state_id, preferred_format, language_level, pacing, chunk_size, accessibility_needs } = body;

    const updates: any = { updated_at: new Date().toISOString() };
    if (preferred_format) updates.preferred_format = preferred_format;
    if (language_level) updates.language_level = language_level;
    if (pacing) updates.pacing = pacing;
    if (chunk_size) updates.chunk_size = chunk_size;
    if (accessibility_needs) updates.accessibility_needs = accessibility_needs;

    const { data: state, error } = await supabase
      .from('learner_state')
      .update(updates)
      .eq('id', learner_state_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Move to diagnostic
    await supabase.from('learner_state')
      .update({ current_module: 'diagnostic' })
      .eq('id', learner_state_id);

    await logDecision(supabase, user.id, learner_state_id, state.subject_id, state.topic_id, 'access_fit', 'diagnostic', 'Preferences set, starting diagnostic', {});

    return NextResponse.json({ state: { ...state, current_module: 'diagnostic' } });
  }

  // ──────────────────────────────────────────────
  // DIAGNOSTIC: Submit diagnostic responses
  // ──────────────────────────────────────────────
  if (action === 'diagnostic_submit') {
    const { learner_state_id, responses } = body;
    if (!learner_state_id || !responses?.length) {
      return NextResponse.json({ error: 'learner_state_id and responses required' }, { status: 400 });
    }

    // Save individual responses
    const responseRecords = responses.map((r: any) => ({
      user_id: user.id,
      learner_state_id,
      diagnostic_item_id: r.diagnostic_item_id,
      answer: r.answer,
      is_correct: r.is_correct,
      confidence_rating: r.confidence_rating,
      time_taken_seconds: r.time_taken_seconds,
      misconception_detected: r.misconception_detected || null,
    }));

    await supabase.from('diagnostic_responses').insert(responseRecords);

    // Score the diagnostic
    const result = scoreDiagnostic(responseRecords);

    // Update learner state
    const { data: state } = await supabase
      .from('learner_state')
      .update({
        prior_knowledge_score: result.prior_knowledge_score,
        readiness_level: result.readiness_level,
        misconception_tags: result.misconceptions_detected,
        confidence_accuracy_gap: result.confidence_accuracy_gap,
        current_module: 'diagnostic',
        updated_at: new Date().toISOString(),
      })
      .eq('id', learner_state_id)
      .eq('user_id', user.id)
      .select()
      .single();

    // Route to next module
    const signals = extractSignals(state, 0);
    const route = routeStudent(state, signals);

    await supabase.from('learner_state')
      .update({ current_module: route.next_module })
      .eq('id', learner_state_id);

    // Log event + decision
    await logEvent(supabase, user.id, learner_state_id, state.subject_id, state.topic_id, 'diagnostic', 'placement_test', { responses_count: responses.length }, 'completed', result, null, result.prior_knowledge_score);
    await logDecision(supabase, user.id, learner_state_id, state.subject_id, state.topic_id, 'diagnostic', route.next_module, route.reason, route.signals_used);

    return NextResponse.json({
      ...result,
      next_route: route,
      state: { ...state, current_module: route.next_module },
    });
  }

  // ──────────────────────────────────────────────
  // SCAFFOLD: Record scaffold interaction
  // ──────────────────────────────────────────────
  if (action === 'scaffold_interact') {
    const { learner_state_id, scaffold_step_id, answer, is_correct, used_hint, time_taken_seconds } = body;

    const { data: state } = await supabase
      .from('learner_state')
      .select('*')
      .eq('id', learner_state_id)
      .eq('user_id', user.id)
      .single();

    if (!state) return NextResponse.json({ error: 'State not found' }, { status: 404 });

    // Adjust scaffold level
    const scaffoldResult = adjustScaffoldLevel(
      state.scaffold_level,
      is_correct,
      used_hint,
      state.consecutive_correct,
      state.consecutive_wrong,
    );

    // Update hint dependence
    const totalAttempts = state.sessions_count + 1;
    const hintsUsed = used_hint ? (state.hint_dependence_rate * state.sessions_count / 100) + 1 : state.hint_dependence_rate * state.sessions_count / 100;
    const hintDependence = computeHintDependence(totalAttempts, Math.round(hintsUsed));

    await supabase.from('learner_state')
      .update({
        scaffold_level: scaffoldResult.newLevel,
        consecutive_correct: scaffoldResult.consecutiveCorrect,
        consecutive_wrong: scaffoldResult.consecutiveWrong,
        hint_dependence_rate: hintDependence,
        sessions_count: totalAttempts,
        updated_at: new Date().toISOString(),
      })
      .eq('id', learner_state_id);

    // Check if should route out of scaffold
    const updatedState = { ...state, scaffold_level: scaffoldResult.newLevel, consecutive_correct: scaffoldResult.consecutiveCorrect, consecutive_wrong: scaffoldResult.consecutiveWrong, hint_dependence_rate: hintDependence };
    const signals = extractSignals(updatedState, 0);
    const route = routeStudent(updatedState, signals);

    if (route.next_module !== 'teach_scaffold') {
      await supabase.from('learner_state')
        .update({ current_module: route.next_module })
        .eq('id', learner_state_id);
      await logDecision(supabase, user.id, learner_state_id, state.subject_id, state.topic_id, 'teach_scaffold', route.next_module, route.reason, route.signals_used);
    }

    return NextResponse.json({
      is_correct,
      new_scaffold_level: scaffoldResult.newLevel,
      hint_dependence_rate: hintDependence,
      next_route: route,
    });
  }

  // ──────────────────────────────────────────────
  // RETRIEVAL: Submit spaced repetition answer
  // ──────────────────────────────────────────────
  if (action === 'retrieval_submit') {
    const { learner_state_id, retrieval_item_id, quality, time_taken_seconds } = body;

    const { data: item } = await supabase
      .from('retrieval_queue')
      .select('*')
      .eq('id', retrieval_item_id)
      .eq('user_id', user.id)
      .single();

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    // Run SM-2
    const sm2Result = sm2({
      quality,
      ease_factor: item.ease_factor,
      interval_days: item.interval_days,
      repetitions: item.repetitions,
    });

    // Update the item
    await supabase.from('retrieval_queue')
      .update({
        ease_factor: sm2Result.ease_factor,
        interval_days: sm2Result.interval_days,
        repetitions: sm2Result.repetitions,
        next_review_at: sm2Result.next_review_at,
        last_reviewed_at: new Date().toISOString(),
        last_quality: quality,
        times_correct: quality >= 3 ? item.times_correct + 1 : item.times_correct,
        times_wrong: quality < 3 ? item.times_wrong + 1 : item.times_wrong,
      })
      .eq('id', retrieval_item_id);

    // Update learner state retrieval metrics
    const { data: allItems } = await supabase
      .from('retrieval_queue')
      .select('times_correct, times_wrong, ease_factor')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const strength = computeRetrievalStrength(allItems || []);
    const totalCorrect = (allItems || []).reduce((s: number, i: any) => s + i.times_correct, 0);
    const totalWrong = (allItems || []).reduce((s: number, i: any) => s + i.times_wrong, 0);
    const successRate = totalCorrect + totalWrong > 0 ? (totalCorrect / (totalCorrect + totalWrong)) * 100 : 0;

    await supabase.from('learner_state')
      .update({
        retrieval_strength: strength,
        retrieval_success_rate: successRate,
        last_retrieval_at: new Date().toISOString(),
        spaced_interval_days: sm2Result.interval_days,
        updated_at: new Date().toISOString(),
      })
      .eq('id', learner_state_id)
      .eq('user_id', user.id);

    // Route check
    const { data: state } = await supabase.from('learner_state').select('*').eq('id', learner_state_id).single();
    const { count: dueCount } = await supabase
      .from('retrieval_queue')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lte('next_review_at', new Date().toISOString());

    const signals = extractSignals(state, dueCount || 0);
    const route = routeStudent(state, signals);

    if (route.next_module !== state.current_module) {
      await supabase.from('learner_state').update({ current_module: route.next_module }).eq('id', learner_state_id);
      await logDecision(supabase, user.id, learner_state_id, state.subject_id, state.topic_id, 'retrieve_retain', route.next_module, route.reason, route.signals_used);
    }

    return NextResponse.json({
      is_correct: quality >= 3,
      sm2_result: sm2Result,
      retrieval_strength: strength,
      next_route: route,
    });
  }

  // ──────────────────────────────────────────────
  // MASTERY CHECK: Submit checkpoint answers
  // ──────────────────────────────────────────────
  if (action === 'mastery_submit') {
    const { learner_state_id, checkpoint_type, question_scores, questions_json, answers_json, time_taken_minutes } = body;

    const { data: state } = await supabase
      .from('learner_state')
      .select('*')
      .eq('id', learner_state_id)
      .eq('user_id', user.id)
      .single();

    if (!state) return NextResponse.json({ error: 'State not found' }, { status: 404 });

    // Score the checkpoint
    const result = scoreMasteryCheckpoint(question_scores);

    // Create checkpoint record
    const { data: checkpoint } = await supabase
      .from('mastery_checkpoints')
      .insert({
        user_id: user.id,
        subject_id: state.subject_id,
        chapter_id: state.chapter_id,
        topic_id: state.topic_id,
        checkpoint_type: checkpoint_type || 'topic_end',
        score_recall: result.scores.recall,
        score_comprehension: result.scores.comprehension,
        score_application: result.scores.application,
        score_transfer: result.scores.transfer,
        score_retention: result.scores.retention,
        score_metacognition: result.scores.metacognition,
        score_independence: result.scores.independence,
        promoted: result.promoted,
        promotion_blocked_by: result.blocked_by,
        weak_subskills: result.weak_subskills,
        delayed_check_scheduled_at: result.promoted ? new Date(Date.now() + DEFAULT_THRESHOLDS.delayed_check_days * 86400000).toISOString() : null,
        questions_json: questions_json || [],
        answers_json: answers_json || [],
        time_taken_minutes,
      })
      .select()
      .single();

    // Update mastery scores in learner state
    const stateUpdate: any = {
      mastery_score_recall: result.scores.recall,
      mastery_score_comprehension: result.scores.comprehension,
      mastery_score_application: result.scores.application,
      mastery_score_transfer: result.scores.transfer,
      mastery_score_retention: result.scores.retention,
      mastery_score_metacognition: result.scores.metacognition,
      mastery_score_independence: result.scores.independence,
      current_band: result.band,
      updated_at: new Date().toISOString(),
    };

    if (!result.promoted) {
      stateUpdate.stalled_cycles = (state.stalled_cycles || 0) + 1;
    } else {
      stateUpdate.stalled_cycles = 0;
    }

    await supabase.from('learner_state').update(stateUpdate).eq('id', learner_state_id);

    // Route
    const updatedState = { ...state, ...stateUpdate, mastery_total: result.total };
    const signals = extractSignals(updatedState, 0);
    const route = routeStudent(updatedState, signals);

    await supabase.from('learner_state').update({ current_module: route.next_module }).eq('id', learner_state_id);
    await logEvent(supabase, user.id, learner_state_id, state.subject_id, state.topic_id, 'mastery_check', checkpoint_type || 'topic_end', { promoted: result.promoted }, result.promoted ? 'promoted' : 'stayed', {}, state.mastery_total, result.total);
    await logDecision(supabase, user.id, learner_state_id, state.subject_id, state.topic_id, 'mastery_check', route.next_module, route.reason, route.signals_used);

    return NextResponse.json({
      checkpoint,
      promoted: result.promoted,
      scores: result.scores,
      total: result.total,
      band: result.band,
      weak_subskills: result.weak_subskills,
      blocked_by: result.blocked_by,
      next_route: route,
    });
  }

  // ──────────────────────────────────────────────
  // METACOGNITION: Submit self-assessment
  // ──────────────────────────────────────────────
  if (action === 'metacognition_submit') {
    const { learner_state_id, confidence_before, actual_score, used_planning, used_monitoring, used_evaluation, total_attempts, careless_errors } = body;

    const result = computeMetacognition(
      confidence_before, actual_score,
      used_planning, used_monitoring, used_evaluation,
      total_attempts || 1, careless_errors || 0,
    );

    const { data: state } = await supabase
      .from('learner_state')
      .update({
        confidence_calibration: result.confidence_calibration,
        self_regulation_score: result.self_regulation_score,
        careless_error_rate: result.careless_error_rate,
        uses_planning: used_planning,
        uses_monitoring: used_monitoring,
        uses_evaluation: used_evaluation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', learner_state_id)
      .eq('user_id', user.id)
      .select()
      .single();

    // Route
    const signals = extractSignals(state, 0);
    const route = routeStudent(state, signals);

    if (route.next_module !== 'metacognition') {
      await supabase.from('learner_state').update({ current_module: route.next_module }).eq('id', learner_state_id);
      await logDecision(supabase, user.id, learner_state_id, state.subject_id, state.topic_id, 'metacognition', route.next_module, route.reason, route.signals_used);
    }

    return NextResponse.json({
      ...result,
      next_route: route,
    });
  }

  // ──────────────────────────────────────────────
  // MISCONCEPTION: Resolve a misconception
  // ──────────────────────────────────────────────
  if (action === 'resolve_misconception') {
    const { learner_state_id, misconception_code, resolution_method } = body;

    await supabase.from('student_misconceptions')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_method,
      })
      .eq('user_id', user.id)
      .eq('misconception_code', misconception_code);

    // Update active_misconceptions in learner state
    const { data: state } = await supabase.from('learner_state').select('active_misconceptions').eq('id', learner_state_id).single();
    const updated = (state?.active_misconceptions || []).map((m: any) =>
      m.code === misconception_code ? { ...m, resolved: true } : m
    );

    await supabase.from('learner_state')
      .update({ active_misconceptions: updated, updated_at: new Date().toISOString() })
      .eq('id', learner_state_id);

    return NextResponse.json({ success: true });
  }

  // ──────────────────────────────────────────────
  // ENGAGEMENT: Log disengagement signal
  // ──────────────────────────────────────────────
  if (action === 'log_engagement') {
    const { learner_state_id, signal_type } = body;
    // signal_type: 'abandoned_session', 'format_change_request', 'frustration', 'long_pause'

    const { data: state } = await supabase.from('learner_state').select('*').eq('id', learner_state_id).single();
    if (!state) return NextResponse.json({ error: 'State not found' }, { status: 404 });

    const updates: any = { updated_at: new Date().toISOString() };
    if (signal_type === 'abandoned_session') updates.session_abandonment_count = (state.session_abandonment_count || 0) + 1;
    if (signal_type === 'format_change_request') updates.format_change_requests = (state.format_change_requests || 0) + 1;
    if (signal_type === 'frustration') updates.frustration_signals = (state.frustration_signals || 0) + 1;

    await supabase.from('learner_state').update(updates).eq('id', learner_state_id);

    // Check if tier escalation needed
    const updatedState = { ...state, ...updates };
    const tier = determineTier(updatedState.stalled_cycles, updatedState.frustration_signals, updatedState.fallback_loop_count);

    if (tier > state.support_tier) {
      await supabase.from('learner_state').update({ support_tier: tier, current_module: 'tiered_support' }).eq('id', learner_state_id);
      await supabase.from('tier_assignments').insert({
        user_id: user.id,
        subject_id: state.subject_id,
        topic_id: state.topic_id,
        tier,
        reason: `Engagement signal: ${signal_type}`,
        assigned_by: 'engine',
      });
    }

    return NextResponse.json({ success: true, new_tier: tier });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// ============================================================================
// Helper: Log module event
// ============================================================================
async function logEvent(
  supabase: any, userId: string, stateId: string,
  subjectId: string | null, topicId: string | null,
  module: string, triggerReason: string, inputSignals: any,
  outcome: string, outcomeData: any,
  scoreBefore: number | null, scoreAfter: number | null,
) {
  await supabase.from('module_events').insert({
    user_id: userId,
    learner_state_id: stateId,
    subject_id: subjectId,
    topic_id: topicId,
    module,
    trigger_reason: triggerReason,
    input_signals: inputSignals,
    outcome,
    outcome_data: outcomeData,
    score_before: scoreBefore,
    score_after: scoreAfter,
  });
}

// ============================================================================
// Helper: Log engine decision
// ============================================================================
async function logDecision(
  supabase: any, userId: string, stateId: string,
  subjectId: string | null, topicId: string | null,
  fromModule: string | null, toModule: string,
  reason: string, signals: any,
) {
  await supabase.from('engine_decisions').insert({
    user_id: userId,
    learner_state_id: stateId,
    subject_id: subjectId,
    topic_id: topicId,
    from_module: fromModule,
    to_module: toModule,
    decision_reason: reason,
    decision_signals: signals,
  });
}
