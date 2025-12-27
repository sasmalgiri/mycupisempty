import type { OllamaRequest, OllamaResponse, VARKStyle, BloomLevel } from '@/types';

// Ollama server configuration (hosted on Oracle Cloud)
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

interface AITutorContext {
  learningStyle: VARKStyle;
  classLevel: number;
  subject: string;
  topic: string;
  previousMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface GenerateQuestionOptions {
  topic: string;
  bloomLevel: BloomLevel;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'mcq' | 'short_answer' | 'true_false';
  classLevel: number;
  subject: string;
}

// Learning style specific prompts
const LEARNING_STYLE_PROMPTS: Record<VARKStyle, string> = {
  visual: `Use diagrams, charts, flowcharts, and visual metaphors. Describe things in terms of colors, shapes, and spatial relationships. Use bullet points and organize information visually. Create mental images and visual analogies.`,
  
  auditory: `Explain as if you're speaking to the student. Use a conversational, rhythmic tone. Include mnemonics, rhymes, and patterns. Encourage the student to say things out loud. Use verbal associations and sound-based memory techniques.`,
  
  reading: `Provide detailed written explanations with clear structure. Use headings, definitions, and references. Include comprehensive text-based content. Emphasize reading and note-taking. Use precise vocabulary and formal language.`,
  
  kinesthetic: `Focus on hands-on activities and real-world applications. Include experiments, simulations, and practical examples. Encourage learning by doing. Use physical analogies and movement-based concepts. Connect concepts to tangible experiences.`,
};

// Bloom's taxonomy level prompts
const BLOOM_LEVEL_PROMPTS: Record<BloomLevel, string> = {
  remember: 'Focus on recall and recognition of facts, terms, and basic concepts.',
  understand: 'Focus on explaining ideas, summarizing, and interpreting information.',
  apply: 'Focus on using information in new situations and solving problems.',
  analyze: 'Focus on breaking down information, comparing, and identifying patterns.',
  evaluate: 'Focus on making judgments, critiquing, and justifying decisions.',
  create: 'Focus on producing new ideas, designing solutions, and synthesizing information.',
};

/**
 * Send a request to Ollama API
 */
async function ollamaGenerate(prompt: string, options?: Partial<OllamaRequest>): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 1024,
          ...options?.options,
        },
        ...options,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data: OllamaResponse = await response.json();
    return data.response;
  } catch (error) {
    console.error('Ollama API Error:', error);
    throw error;
  }
}

/**
 * Chat with the AI tutor using conversation history
 */
async function ollamaChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string
): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama Chat API error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || data.response;
  } catch (error) {
    console.error('Ollama Chat API Error:', error);
    throw error;
  }
}

/**
 * AI Tutor - Get personalized explanation based on learning style
 */
export async function getAIExplanation(
  context: AITutorContext,
  userQuestion: string
): Promise<string> {
  const systemPrompt = `You are an expert NCERT tutor for Class ${context.classLevel} ${context.subject}. 
You are currently teaching the topic: "${context.topic}".

LEARNING STYLE ADAPTATION:
${LEARNING_STYLE_PROMPTS[context.learningStyle]}

GUIDELINES:
- Be encouraging, patient, and supportive
- Use simple language appropriate for Class ${context.classLevel} students
- Give step-by-step explanations
- Include examples from Indian context when relevant
- Use Hindi terms when helpful (with English translations)
- Keep responses focused and not too long
- Celebrate correct answers and gently guide through mistakes

Respond in a way that's engaging and easy to understand for a ${context.classLevel}th grade student.`;

  const messages = context.previousMessages || [];
  messages.push({ role: 'user', content: userQuestion });

  return await ollamaChat(messages, systemPrompt);
}

/**
 * Generate a question based on topic and difficulty
 */
export async function generateQuestion(options: GenerateQuestionOptions): Promise<{
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}> {
  const prompt = `Generate a ${options.difficulty} difficulty ${options.questionType} question for Class ${options.classLevel} ${options.subject} on the topic "${options.topic}".

Bloom's Taxonomy Level: ${options.bloomLevel.toUpperCase()}
${BLOOM_LEVEL_PROMPTS[options.bloomLevel]}

Requirements:
${options.questionType === 'mcq' ? `
- Provide exactly 4 options (A, B, C, D)
- Only one correct answer
- Make distractors plausible but clearly wrong` : ''}
${options.questionType === 'true_false' ? `
- Statement should be clearly true or false
- Avoid ambiguous wording` : ''}
${options.questionType === 'short_answer' ? `
- Question should require 1-2 sentence answer
- Be specific about what you're asking` : ''}

Format your response as JSON:
{
  "question": "The question text",
  ${options.questionType === 'mcq' ? '"options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],' : ''}
  "correctAnswer": "The correct answer",
  "explanation": "Brief explanation of why this is correct"
}

Only output valid JSON, no additional text.`;

  const response = await ollamaGenerate(prompt, {
    options: { temperature: 0.8 },
  });

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to parse question JSON:', error);
    throw new Error('Failed to generate question');
  }
}

/**
 * Generate hints for a question
 */
export async function generateHint(
  question: string,
  correctAnswer: string,
  topic: string,
  hintNumber: number
): Promise<string> {
  const hintLevel = hintNumber === 1 ? 'subtle' : hintNumber === 2 ? 'moderate' : 'direct';
  
  const prompt = `Generate a ${hintLevel} hint for the following question.

Question: ${question}
Topic: ${topic}
Correct Answer: ${correctAnswer}

Hint Level: ${hintNumber}/3
${hintLevel === 'subtle' ? '- Give a general direction without revealing the answer' : ''}
${hintLevel === 'moderate' ? '- Point towards the concept needed without stating the answer' : ''}
${hintLevel === 'direct' ? '- Provide a strong hint that almost gives away the answer' : ''}

Provide only the hint text, no additional formatting.`;

  return await ollamaGenerate(prompt, {
    options: { temperature: 0.6, num_predict: 100 },
  });
}

/**
 * Explain why an answer is wrong
 */
export async function explainWrongAnswer(
  question: string,
  userAnswer: string,
  correctAnswer: string,
  topic: string,
  learningStyle: VARKStyle
): Promise<string> {
  const prompt = `A Class student got this question wrong. Help them understand their mistake.

Question: ${question}
Student's Answer: ${userAnswer}
Correct Answer: ${correctAnswer}
Topic: ${topic}

LEARNING STYLE: ${learningStyle.toUpperCase()}
${LEARNING_STYLE_PROMPTS[learningStyle]}

Provide a supportive explanation that:
1. Acknowledges their effort
2. Explains why their answer was incorrect
3. Shows why the correct answer is right
4. Gives a tip to remember for next time

Keep it encouraging and helpful!`;

  return await ollamaGenerate(prompt);
}

/**
 * Generate a summary of a topic
 */
export async function generateTopicSummary(
  topic: string,
  subject: string,
  classLevel: number,
  learningStyle: VARKStyle
): Promise<string> {
  const prompt = `Create a concise summary of the topic "${topic}" for Class ${classLevel} ${subject}.

LEARNING STYLE: ${learningStyle.toUpperCase()}
${LEARNING_STYLE_PROMPTS[learningStyle]}

Include:
- Key concepts (3-5 points)
- Important formulas or definitions (if applicable)
- One practical example
- One memory tip

Keep it suitable for a ${classLevel}th grade student.`;

  return await ollamaGenerate(prompt);
}

/**
 * Check if Ollama server is available
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get available models from Ollama
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  } catch {
    return [];
  }
}

// Export all functions
export const ollamaAI = {
  generate: ollamaGenerate,
  chat: ollamaChat,
  getExplanation: getAIExplanation,
  generateQuestion,
  generateHint,
  explainWrongAnswer,
  generateTopicSummary,
  checkHealth: checkOllamaHealth,
  getModels: getAvailableModels,
};

export default ollamaAI;
