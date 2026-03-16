import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Characters for join code (no confusing chars: 0/O/1/I/L)
const JOIN_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_CHARS.charAt(Math.floor(Math.random() * JOIN_CODE_CHARS.length));
  }
  return code;
}

function calculatePoints(isCorrect: boolean, timeTakenMs: number, timeLimitMs: number): number {
  if (!isCorrect) return 0;
  // Max 1000 points, faster = more points. Minimum 100 points if correct.
  const timeRatio = Math.max(0, 1 - timeTakenMs / timeLimitMs);
  return Math.round(100 + 900 * timeRatio);
}

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'get') {
      const quizId = searchParams.get('id');
      if (!quizId) {
        return NextResponse.json({ error: 'Missing quiz id' }, { status: 400 });
      }

      const { data: quiz, error } = await supabase
        .from('live_quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (error) throw error;

      // If host, include participants
      let participants: any[] = [];
      if (quiz.host_id === user.id) {
        const { data: parts } = await supabase
          .from('live_quiz_participants')
          .select('*, profiles(full_name)')
          .eq('quiz_id', quizId)
          .order('total_score', { ascending: false });
        participants = parts || [];
      }

      return NextResponse.json({ success: true, data: { ...quiz, participants } });
    }

    if (action === 'lobby') {
      const joinCode = searchParams.get('join_code');
      if (!joinCode) {
        return NextResponse.json({ error: 'Missing join_code' }, { status: 400 });
      }

      const { data: quiz, error } = await supabase
        .from('live_quizzes')
        .select('id, title, status, current_question, question_started_at, questions, time_per_question, host_id, join_code, allow_late_join')
        .eq('join_code', joinCode.toUpperCase())
        .single();

      if (error) {
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }

      // Get participants
      const { data: participants } = await supabase
        .from('live_quiz_participants')
        .select('id, user_id, display_name, total_score, correct_count, avg_response_time_ms, answers, profiles(full_name)')
        .eq('quiz_id', quiz.id)
        .order('total_score', { ascending: false });

      // Get my participation
      const myParticipation = (participants || []).find((p: any) => p.user_id === user.id);

      return NextResponse.json({
        success: true,
        data: {
          ...quiz,
          participants: participants || [],
          my_participation: myParticipation || null,
        },
      });
    }

    if (action === 'leaderboard') {
      const quizId = searchParams.get('id');
      if (!quizId) {
        return NextResponse.json({ error: 'Missing quiz id' }, { status: 400 });
      }

      const { data: participants, error } = await supabase
        .from('live_quiz_participants')
        .select('*, profiles(full_name)')
        .eq('quiz_id', quizId)
        .order('total_score', { ascending: false });

      if (error) throw error;

      return NextResponse.json({ success: true, data: participants || [] });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { title, classroom_id, subject_id, topic_id, questions, time_per_question, team_mode, shuffle_options, allow_late_join } = body;

      if (!title || !questions || questions.length < 5) {
        return NextResponse.json({ error: 'Title and at least 5 questions required' }, { status: 400 });
      }

      // Generate unique join code (check all quizzes regardless of status)
      let joinCode = generateJoinCode();
      let attempts = 0;
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from('live_quizzes')
          .select('id')
          .eq('join_code', joinCode)
          .single();
        if (!existing) break;
        joinCode = generateJoinCode();
        attempts++;
      }

      const { data: quiz, error } = await supabase
        .from('live_quizzes')
        .insert({
          host_id: user.id,
          title,
          classroom_id: classroom_id || null,
          subject_id: subject_id || null,
          topic_id: topic_id || null,
          questions,
          total_questions: questions.length,
          time_per_question: time_per_question || 20,
          team_mode: team_mode || false,
          shuffle_options: shuffle_options !== undefined ? shuffle_options : true,
          allow_late_join: allow_late_join !== undefined ? allow_late_join : true,
          join_code: joinCode,
          status: 'lobby',
          current_question: 0,
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data: quiz });
    }

    if (action === 'join') {
      const { join_code, display_name } = body;

      if (!join_code) {
        return NextResponse.json({ error: 'Join code required' }, { status: 400 });
      }

      const { data: quiz, error: quizError } = await supabase
        .from('live_quizzes')
        .select('id, status, allow_late_join')
        .eq('join_code', join_code.toUpperCase())
        .single();

      if (quizError || !quiz) {
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }

      // Allow joining if lobby, or if active/question and late join is enabled
      const canJoin =
        quiz.status === 'lobby' ||
        ((quiz.status === 'active' || quiz.status === 'question') && quiz.allow_late_join === true);

      if (!canJoin) {
        return NextResponse.json({ error: 'Quiz is not accepting participants' }, { status: 400 });
      }

      // Check if already joined
      const { data: existing } = await supabase
        .from('live_quiz_participants')
        .select('id')
        .eq('quiz_id', quiz.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        return NextResponse.json({ success: true, data: existing, message: 'Already joined' });
      }

      // Get user profile for display_name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { data: participant, error } = await supabase
        .from('live_quiz_participants')
        .insert({
          quiz_id: quiz.id,
          user_id: user.id,
          display_name: display_name || profile?.full_name || 'Student',
          total_score: 0,
          correct_count: 0,
          avg_response_time_ms: 0,
          answers: [],
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data: participant });
    }

    if (action === 'start') {
      const { quiz_id } = body;

      const { data: quiz, error: fetchError } = await supabase
        .from('live_quizzes')
        .select('*')
        .eq('id', quiz_id)
        .eq('host_id', user.id)
        .single();

      if (fetchError || !quiz) {
        return NextResponse.json({ error: 'Quiz not found or not authorized' }, { status: 404 });
      }

      const { data, error } = await supabase
        .from('live_quizzes')
        .update({
          status: 'question',
          current_question: 0,
          question_started_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
        })
        .eq('id', quiz_id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data });
    }

    if (action === 'next_question') {
      const { quiz_id } = body;

      const { data: quiz, error: fetchError } = await supabase
        .from('live_quizzes')
        .select('*')
        .eq('id', quiz_id)
        .eq('host_id', user.id)
        .single();

      if (fetchError || !quiz) {
        return NextResponse.json({ error: 'Quiz not found or not authorized' }, { status: 404 });
      }

      const nextQ = quiz.current_question + 1;
      const totalQuestions = quiz.questions.length;

      if (nextQ >= totalQuestions) {
        return NextResponse.json({ error: 'No more questions', finished: true }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('live_quizzes')
        .update({
          status: 'question',
          current_question: nextQ,
          question_started_at: new Date().toISOString(),
        })
        .eq('id', quiz_id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data });
    }

    if (action === 'show_results') {
      const { quiz_id } = body;

      const { data, error } = await supabase
        .from('live_quizzes')
        .update({
          status: 'results',
        })
        .eq('id', quiz_id)
        .eq('host_id', user.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data });
    }

    if (action === 'answer') {
      const { quiz_id, question_index, selected_option } = body;

      // Get quiz
      const { data: quiz, error: quizError } = await supabase
        .from('live_quizzes')
        .select('*')
        .eq('id', quiz_id)
        .single();

      if (quizError || !quiz) {
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }

      if (quiz.status !== 'question' || quiz.current_question !== question_index) {
        return NextResponse.json({ error: 'Question is not active' }, { status: 400 });
      }

      // Get participant
      const { data: participant, error: partError } = await supabase
        .from('live_quiz_participants')
        .select('*')
        .eq('quiz_id', quiz_id)
        .eq('user_id', user.id)
        .single();

      if (partError || !participant) {
        return NextResponse.json({ error: 'Not a participant' }, { status: 400 });
      }

      // Check if already answered this question
      const existingAnswers = participant.answers || [];
      if (existingAnswers.some((a: any) => a.question_index === question_index)) {
        return NextResponse.json({ error: 'Already answered this question' }, { status: 400 });
      }

      // Calculate points
      const question = quiz.questions[question_index];
      const isCorrect = selected_option === question.correct_answer;
      const questionStartedAt = new Date(quiz.question_started_at).getTime();
      const now = Date.now();
      const timeTakenMs = now - questionStartedAt;
      const timeLimitMs = (question.time_limit || quiz.time_per_question || 20) * 1000;
      const points = calculatePoints(isCorrect, timeTakenMs, timeLimitMs);

      const newAnswer = {
        question_index,
        selected_option,
        is_correct: isCorrect,
        points,
        time_taken_ms: timeTakenMs,
      };

      const updatedAnswers = [...existingAnswers, newAnswer];
      const newTotalScore = participant.total_score + points;
      const newCorrectCount = (participant.correct_count || 0) + (isCorrect ? 1 : 0);

      // Compute new average response time
      const totalAnswers = updatedAnswers.length;
      const prevTotalTime = (participant.avg_response_time_ms || 0) * (totalAnswers - 1);
      const newAvgResponseTimeMs = Math.round((prevTotalTime + timeTakenMs) / totalAnswers);

      const { data, error } = await supabase
        .from('live_quiz_participants')
        .update({
          answers: updatedAnswers,
          total_score: newTotalScore,
          correct_count: newCorrectCount,
          avg_response_time_ms: newAvgResponseTimeMs,
        })
        .eq('id', participant.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: {
          ...data,
          last_answer: newAnswer,
        },
      });
    }

    if (action === 'finish') {
      const { quiz_id } = body;

      const { data: quiz, error: fetchError } = await supabase
        .from('live_quizzes')
        .select('*')
        .eq('id', quiz_id)
        .eq('host_id', user.id)
        .single();

      if (fetchError || !quiz) {
        return NextResponse.json({ error: 'Quiz not found or not authorized' }, { status: 404 });
      }

      // Get participants sorted by score
      const { data: participants } = await supabase
        .from('live_quiz_participants')
        .select('*, profiles(full_name)')
        .eq('quiz_id', quiz_id)
        .order('total_score', { ascending: false });

      // Assign ranks and award XP
      for (let i = 0; i < (participants || []).length; i++) {
        const p = participants![i];
        const rank = i + 1;

        await supabase
          .from('live_quiz_participants')
          .update({ rank })
          .eq('id', p.id);

        // Award participation XP to everyone
        const participationXp = 20;
        await supabase
          .from('xp_events')
          .insert({
            user_id: p.user_id,
            source_pillar: 'engagement',
            source_action: 'live_quiz_participation',
            source_id: quiz.id,
            xp_amount: participationXp,
            description: `Participated in live quiz: ${quiz.title}`,
          });

        // Award bonus XP for top 3
        if (rank <= 3) {
          const xpBonus = rank === 1 ? 100 : rank === 2 ? 60 : 30;
          await supabase
            .from('xp_events')
            .insert({
              user_id: p.user_id,
              source_pillar: 'engagement',
              source_action: 'live_quiz_top3',
              source_id: quiz.id,
              xp_amount: xpBonus,
              description: `Ranked #${rank} in live quiz: ${quiz.title}`,
            });
        }
      }

      // Update quiz status
      const { data, error } = await supabase
        .from('live_quizzes')
        .update({
          status: 'finished',
          finished_at: new Date().toISOString(),
        })
        .eq('id', quiz_id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: {
          ...data,
          participants: participants || [],
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
