/**
 * Peer Q&A API — moderated student question/answer feed.
 *
 * GET                      — feed of approved questions, optionally filtered by subject
 * POST action=ask          — student posts a question (fast-moderated, AI-verified)
 * POST action=answer       — peer submits an answer (fast-moderated + AI-correctness checked)
 * POST action=upvote       — upvote an answer
 * POST action=mark_helpful — question author marks an answer as helpful
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { fastModerate, aiModerate } from '@/lib/peer-moderation';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const subjectId = url.searchParams.get('subjectId');
    const status = url.searchParams.get('status') || 'approved';
    const onlyMine = url.searchParams.get('mine') === '1';

    let query = supabase
      .from('peer_questions')
      .select(`
        id, user_id, subject_id, topic_id, title, body, status,
        upvotes, answer_count, helpful_answer_id, created_at,
        subjects(title),
        profiles:profiles!peer_questions_user_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (status !== 'all') query = query.eq('status', status);
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (onlyMine) query = query.eq('user_id', user.id);

    const { data: questions, error } = await query;
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = empty result, not an error. Any other Supabase error we surface.
      console.error('Peer QA GET failed:', error);
    }

    return NextResponse.json({ success: true, questions: questions || [] });
  } catch (error: any) {
    console.error('Peer QA GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    // === ASK ===
    if (action === 'ask') {
      const { title, body: questionBody, subjectId, topicId } = body;
      if (!title || !questionBody) {
        return NextResponse.json({ error: 'title and body required' }, { status: 400 });
      }

      // Fast safety check on both title + body
      const fastTitle = fastModerate(String(title));
      if (fastTitle?.status === 'blocked') {
        return NextResponse.json({ error: fastTitle.reason || 'Title rejected' }, { status: 422 });
      }
      const fastBody = fastModerate(String(questionBody));
      if (fastBody?.status === 'blocked') {
        return NextResponse.json({ error: fastBody.reason || 'Body rejected' }, { status: 422 });
      }

      // AI moderates the question itself (treats question as the 'answer' to moderate — same safety bar)
      const moderated = await aiModerate({
        question: 'Is this an appropriate educational question from a K-12 student?',
        answer: `${title}\n\n${questionBody}`,
      });

      const { data: inserted, error } = await supabase
        .from('peer_questions')
        .insert({
          user_id: user.id,
          subject_id: subjectId || null,
          topic_id: topicId || null,
          title: String(title).slice(0, 200),
          body: String(questionBody).slice(0, 5000),
          status: moderated.status,
          moderation_reason: moderated.reason || null,
        })
        .select()
        .maybeSingle();
      if (error) {
        console.error('peer_questions insert failed:', error);
        return NextResponse.json({ error: 'Failed to save question' }, { status: 500 });
      }
      return NextResponse.json({ success: true, question: inserted, moderated });
    }

    // === ANSWER ===
    if (action === 'answer') {
      const { questionId, answerBody } = body;
      if (!questionId || !answerBody) {
        return NextResponse.json({ error: 'questionId and answerBody required' }, { status: 400 });
      }

      const fast = fastModerate(String(answerBody));
      if (fast?.status === 'blocked') {
        return NextResponse.json({ error: fast.reason || 'Answer rejected' }, { status: 422 });
      }

      // Fetch the question for context
      const { data: question } = await supabase
        .from('peer_questions')
        .select('id, title, body, subject_id, subjects(title)')
        .eq('id', questionId)
        .maybeSingle();
      if (!question) {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('current_class')
        .eq('id', user.id)
        .single()
        .catch(() => ({ data: null }));

      const moderated = await aiModerate({
        question: `${question.title}\n\n${question.body}`,
        answer: String(answerBody),
        subject: question.subjects?.title,
        classLevel: profile?.current_class,
      });

      const { data: inserted, error } = await supabase
        .from('peer_answers')
        .insert({
          question_id: questionId,
          user_id: user.id,
          body: String(answerBody).slice(0, 8000),
          status: moderated.status,
          moderation_reason: moderated.reason || null,
          moderation_confidence: moderated.confidence || null,
        })
        .select()
        .maybeSingle();
      if (error) {
        console.error('peer_answers insert failed:', error);
        return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 });
      }

      // Bump answer_count on the question if approved
      if (moderated.status === 'approved') {
        try {
          await supabase.rpc('increment_peer_answer_count', { q_id: questionId });
        } catch {
          // Fallback: manual update
          const { data: q } = await supabase
            .from('peer_questions')
            .select('answer_count')
            .eq('id', questionId)
            .maybeSingle();
          if (q) {
            await supabase
              .from('peer_questions')
              .update({ answer_count: (q.answer_count || 0) + 1 })
              .eq('id', questionId);
          }
        }
      }

      return NextResponse.json({
        success: true,
        answer: inserted,
        moderated,
        userMessage: moderated.status === 'approved'
          ? 'Your answer is live! Thanks for helping a classmate.'
          : moderated.status === 'flagged'
          ? 'Your answer is submitted and will appear after a teacher reviews it.'
          : 'Your answer could not be posted: ' + (moderated.reason || 'safety policy'),
      });
    }

    // === UPVOTE ===
    if (action === 'upvote') {
      const { answerId } = body;
      if (!answerId) return NextResponse.json({ error: 'answerId required' }, { status: 400 });
      try {
        await supabase.from('peer_votes').upsert({
          user_id: user.id,
          answer_id: answerId,
          created_at: new Date().toISOString(),
        }, { onConflict: 'user_id,answer_id' });
        // Update vote count
        const { count } = await supabase
          .from('peer_votes')
          .select('*', { count: 'exact', head: true })
          .eq('answer_id', answerId);
        await supabase.from('peer_answers').update({ upvotes: count ?? 0 }).eq('id', answerId);
      } catch (err) {
        console.error('upvote failed:', err);
      }
      return NextResponse.json({ success: true });
    }

    // === MARK HELPFUL ===
    if (action === 'mark_helpful') {
      const { questionId, answerId } = body;
      if (!questionId || !answerId) {
        return NextResponse.json({ error: 'questionId and answerId required' }, { status: 400 });
      }
      // Only question author can mark helpful
      const { data: q } = await supabase
        .from('peer_questions')
        .select('user_id')
        .eq('id', questionId)
        .maybeSingle();
      if (!q || q.user_id !== user.id) {
        return NextResponse.json({ error: 'Only the question author can mark helpful' }, { status: 403 });
      }
      await supabase.from('peer_questions').update({ helpful_answer_id: answerId }).eq('id', questionId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Peer QA POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
