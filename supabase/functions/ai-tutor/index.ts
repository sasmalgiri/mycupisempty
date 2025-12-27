// Supabase Edge Function: AI Tutor
// Deploy with: supabase functions deploy ai-tutor

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TutorRequest {
  message: string
  context: {
    subject: string
    chapter: string
    topic?: string
    classLevel: number
  }
  learningStyle: 'visual' | 'auditory' | 'reading' | 'kinesthetic'
  history?: Array<{ role: string; content: string }>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, context, learningStyle, history = [] } = await req.json() as TutorRequest

    const ollamaUrl = Deno.env.get('OLLAMA_BASE_URL') || 'http://localhost:11434'
    const model = Deno.env.get('OLLAMA_MODEL') || 'llama3.2'

    // Build system prompt based on learning style
    const learningStyleInstructions: Record<string, string> = {
      visual: 'Use diagrams, charts, visual metaphors, and spatial descriptions. Break information into visual chunks. Use emojis and formatting to create visual structure.',
      auditory: 'Explain as if speaking aloud. Use conversational tone, rhythmic explanations, mnemonics, and verbal associations. Read content aloud in your explanations.',
      reading: 'Provide detailed written explanations with proper structure. Use lists, definitions, references, and comprehensive text. Include key terms and their meanings.',
      kinesthetic: 'Include hands-on activities, real-world applications, and physical analogies. Suggest experiments, practice problems, and interactive exercises.',
    }

    const systemPrompt = `You are an expert NCERT tutor helping a Class ${context.classLevel} student with ${context.subject}.
Current chapter: ${context.chapter}${context.topic ? `, Topic: ${context.topic}` : ''}

IMPORTANT INSTRUCTIONS:
1. The student's learning style is ${learningStyle}. ${learningStyleInstructions[learningStyle]}
2. Be encouraging, patient, and supportive
3. Use simple language appropriate for Class ${context.classLevel}
4. Give step-by-step explanations
5. Use examples from Indian context when relevant
6. If explaining a concept, break it into digestible parts
7. If solving a problem, show each step clearly
8. End with a quick check question to verify understanding
9. Keep responses focused and not too long

Remember: You are teaching a student, not just providing information.`

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6), // Keep last 6 messages for context
      { role: 'user', content: message }
    ]

    // Call Ollama
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 1024,
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`)
    }

    const data = await response.json()

    return new Response(
      JSON.stringify({
        response: data.message.content,
        model: data.model,
        totalDuration: data.total_duration,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error:', error)
    
    return new Response(
      JSON.stringify({
        error: error.message,
        response: "I'm having trouble connecting right now. Let me give you a helpful response based on what I know!\n\nCould you please try again in a moment? In the meantime, feel free to check the textbook content or try a different question.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
