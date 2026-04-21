import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getGuruExplanation, assessUnderstanding } from '@/lib/ollama-guru';
import { buildStudentState } from '@/lib/student-state';
import type { VARKStyle } from '@/types';

// Server-side content filter — blocks obviously non-educational queries
const BLOCKED_PATTERNS = [
  /\b(porn|sex|nude|xxx|nsfw|hentai|onlyfans)\b/i,
  /\b(kill|murder|suicide|self.?harm|how\s+to\s+die)\b/i,
  /\b(bomb|explosive|weapon|gun|how\s+to\s+make\s+a)\b/i,
  /\b(hack|crack|exploit|ddos|phish|malware|ransomware)\b/i,
  /\b(drug|weed|cocaine|meth|heroin|mdma|lsd)\b/i,
  /\b(gambling|betting|casino|crypto\s+trading)\b/i,
  /\b(cheat\s+in\s+exam|leak\s+paper|answer\s+key\s+leak)\b/i,
];

function isBlockedContent(message: string): boolean {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(message));
}

const BLOCKED_RESPONSE = "I'm your study buddy and I can only help with school subjects and learning! 📚 Let's focus on your studies. What topic would you like to learn about?";

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
      mode,                    // 'direct' | 'socratic' | 'teach_back'
      inject_intervention = false,  // attack a misconception this turn
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Server-side content filter — block non-educational queries before they reach AI
    if (isBlockedContent(message)) {
      return NextResponse.json({
        success: true,
        reply: BLOCKED_RESPONSE,
        session_id: session_id || null,
        checkpoint: null,
      });
    }

    // Get user's learning style
    const { data: learningStyle } = await supabase
      .from('learning_styles')
      .select('dominant_style')
      .eq('user_id', user.id)
      .single();

    // Get user profile for class level
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_class')
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

    // Build live student state — the AI will see the REAL student
    let studentState;
    try {
      studentState = await buildStudentState(supabase, user.id);
    } catch {
      // If state building fails, continue without it
      studentState = undefined;
    }

    // Get subject ID from topic
    let subject_id: string | undefined;
    if (topic_id) {
      const { data: topicData } = await supabase
        .from('topics')
        .select('chapter:chapters(subject_id)')
        .eq('id', topic_id)
        .single();
      subject_id = (topicData as any)?.chapter?.subject_id;
    }

    // Get AI response — now informed by real student state
    const reply = await getGuruExplanation(
      {
        classLevel: profile?.current_class || 8,
        subject: subjectName,
        topic: topicName,
        subjectId: subject_id,
        learningStyle: (learningStyle?.dominant_style as VARKStyle) || 'visual',
        teachingMethod: teaching_method,
        difficultyLevel: difficulty_level,
        isSocratic: is_socratic,
        mode,
        injectIntervention: inject_intervention,
        isBeyondCurriculum: is_beyond_curriculum,
        previousMessages,
        studentState,
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
        const check = await assessUnderstanding(topicName, reply, profile?.current_class || 8);
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

    // Silently collect learner signal — every guru interaction
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('learner_signals') as any).insert({
        user_id: user.id,
        signal_type: 'ai_guru_interaction',
        category: 'engagement',
        source: 'ai_guru',
        subject_id: subject_id || null,
        value: message.length / 200,
        metadata: {
          subject: subjectName,
          topic: topicName,
          teaching_method,
          difficulty_level,
          is_socratic,
          is_beyond_curriculum,
          message_count: previousMessages.length,
          has_checkpoint: !!checkpoint,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Table might not exist yet — silently ignore
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
