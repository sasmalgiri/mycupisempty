import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ollamaAI } from '@/lib/ollama';
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
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      message, 
      sessionId, 
      topicContext,
      classLevel,
      subject,
      topic,
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Server-side content filter — block non-educational queries before they reach AI
    if (isBlockedContent(message)) {
      return NextResponse.json({
        success: true,
        response: BLOCKED_RESPONSE,
        learningStyle: 'visual',
      });
    }

    // Get user's learning style
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: learningStyle } = await (supabase.from('learning_styles') as any)
      .select('dominant_style')
      .eq('user_id', user.id)
      .single();

    const userLearningStyle: VARKStyle = learningStyle?.dominant_style || 'visual';

    // Get previous messages for context (if session exists)
    let previousMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    if (sessionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: messages } = await (supabase.from('chat_messages') as any)
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(10);

      if (messages) {
        previousMessages = messages as Array<{ role: 'user' | 'assistant'; content: string }>;
      }
    }

    // Build live student state — AI sees the REAL student
    let studentState;
    try {
      studentState = await buildStudentState(supabase, user.id);
    } catch {
      studentState = undefined;
    }

    // Get AI response — now informed by real student state
    const aiResponse = await ollamaAI.getExplanation(
      {
        learningStyle: userLearningStyle,
        classLevel: classLevel || 6,
        subject: subject || 'General',
        topic: topic || topicContext || 'General Knowledge',
        previousMessages,
        studentState,
      },
      message
    );

    // Save messages to database (if session exists)
    if (sessionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('chat_messages') as any).insert([
        {
          session_id: sessionId,
          role: 'user',
          content: message,
        },
        {
          session_id: sessionId,
          role: 'assistant',
          content: aiResponse,
        },
      ]);
    }

    // Silently collect learner signal — tracks every AI interaction
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('learner_signals') as any).insert({
        user_id: user.id,
        signal_type: 'ai_chat_interaction',
        category: 'engagement',
        source: 'ai_chat',
        subject_id: subject || null,
        value: message.length / 200,  // normalize by typical message length
        metadata: {
          subject,
          topic: topic || topicContext,
          class_level: classLevel,
          message_length: message.length,
          response_length: aiResponse.length,
          was_blocked: false,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Table might not exist yet — silently ignore
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      learningStyle: userLearningStyle,
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    
    // Fallback response if AI service is unavailable
    if (error.message?.includes('fetch') || error.message?.includes('connect') || error.message?.includes('XAI_API_KEY')) {
      return NextResponse.json({
        success: true,
        response: `I apologize, but I'm having trouble connecting to my brain right now. 🧠

In the meantime, here are some general study tips:
• Break down complex topics into smaller parts
• Practice with examples
• Review regularly using spaced repetition
• Don't hesitate to ask your teacher for help!

Please try again in a moment.`,
        learningStyle: 'visual',
        fallback: true,
      });
    }

    return NextResponse.json(
      { error: 'Failed to get AI response', details: error.message },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    const isHealthy = await ollamaAI.checkHealth();
    const models = await ollamaAI.getModels();

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      models,
      provider: 'xai-grok',
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 500 });
  }
}
