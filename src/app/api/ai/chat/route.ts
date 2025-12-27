import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ollamaAI } from '@/lib/ollama';
import type { VARKStyle } from '@/types';

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

    // Get user's learning style
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: learningStyle } = await (supabase.from('learning_styles') as any)
      .select('primary_style')
      .eq('user_id', user.id)
      .single();

    const userLearningStyle: VARKStyle = learningStyle?.primary_style || 'visual';

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

    // Get AI response
    const aiResponse = await ollamaAI.getExplanation(
      {
        learningStyle: userLearningStyle,
        classLevel: classLevel || 6,
        subject: subject || 'General',
        topic: topic || topicContext || 'General Knowledge',
        previousMessages,
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

    return NextResponse.json({
      success: true,
      response: aiResponse,
      learningStyle: userLearningStyle,
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    
    // Fallback response if Ollama is unavailable
    if (error.message?.includes('fetch') || error.message?.includes('connect')) {
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
      ollamaUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 500 });
  }
}
