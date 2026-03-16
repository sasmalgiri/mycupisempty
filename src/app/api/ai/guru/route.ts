import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getGuruExplanation, assessUnderstanding } from '@/lib/ollama-guru';
import type { VARKStyle } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      message,
      session_id,
      topic_id,
      teaching_method = 'feynman',
      difficulty_level = 5,
      is_socratic = false,
      is_beyond_curriculum = false,
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get user's learning style
    const { data: learningStyle } = await supabase
      .from('learning_styles')
      .select('primary_style')
      .eq('user_id', user.id)
      .single();

    // Get user profile for class level
    const { data: profile } = await supabase
      .from('profiles')
      .select('class_level')
      .eq('id', user.id)
      .single();

    // Get or create session
    let sessionId = session_id;
    if (!sessionId) {
      const { data: session } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          topic_id: topic_id || null,
          title: message.slice(0, 50),
          session_type: is_socratic ? 'socratic' : is_beyond_curriculum ? 'exploration' : 'guru',
          teaching_method,
          difficulty_level,
          is_beyond_curriculum,
        })
        .select('id')
        .single();

      sessionId = session?.id;
    }

    // Get previous messages for context
    let previousMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (sessionId) {
      const { data: history } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(20);

      if (history) {
        previousMessages = history.map((m: any) => ({ role: m.role, content: m.content }));
      }
    }

    // Get topic info if available
    let topicName = 'General';
    let subjectName = 'General';
    if (topic_id) {
      const { data: topic } = await supabase
        .from('topics')
        .select('title, chapter:chapters(subject:subjects(name))')
        .eq('id', topic_id)
        .single();

      if (topic) {
        topicName = topic.title || 'General';
        subjectName = (topic as any).chapter?.subject?.name || 'General';
      }
    }

    // Get AI response
    const reply = await getGuruExplanation(
      {
        classLevel: profile?.class_level || 8,
        subject: subjectName,
        topic: topicName,
        learningStyle: (learningStyle?.primary_style as VARKStyle) || 'visual',
        teachingMethod: teaching_method,
        difficultyLevel: difficulty_level,
        isSocratic: is_socratic,
        isBeyondCurriculum: is_beyond_curriculum,
        previousMessages,
      },
      message
    );

    // Save messages to DB
    if (sessionId) {
      await supabase.from('chat_messages').insert([
        { session_id: sessionId, role: 'user', content: message, metadata: { teaching_method, difficulty_level } },
        { session_id: sessionId, role: 'assistant', content: reply, metadata: { teaching_method, difficulty_level } },
      ]);
    }

    // Check understanding every 4 messages
    let checkpoint = null;
    if (previousMessages.length > 0 && previousMessages.length % 4 === 0) {
      try {
        const check = await assessUnderstanding(topicName, reply, profile?.class_level || 8);
        checkpoint = {
          question: check.question,
          expected_concepts: check.expected_concepts,
        };

        if (sessionId) {
          await supabase.from('understanding_checkpoints').insert({
            session_id: sessionId,
            user_id: user.id,
            checkpoint_number: Math.floor(previousMessages.length / 4),
          });
        }
      } catch {
        // Checkpoint generation is optional
      }
    }

    return NextResponse.json({
      success: true,
      reply,
      session_id: sessionId,
      checkpoint,
    });
  } catch (error: any) {
    console.error('Guru API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get response', success: false },
      { status: 500 }
    );
  }
}
