import type { VARKStyle, BloomLevel } from '@/types';

// Grok (xAI) API configuration — OpenAI-compatible
const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

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
 * Call Grok (xAI) chat completions API
 */
async function xaiChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  if (!XAI_API_KEY) {
    throw new Error('XAI_API_KEY is not configured');
  }

  const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`xAI API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Simple generate (prompt → response) using chat completions
 */
async function aiGenerate(prompt: string, options?: { temperature?: number; max_tokens?: number }): Promise<string> {
  return xaiChatCompletion(
    [{ role: 'user', content: prompt }],
    options,
  );
}

/**
 * Chat with conversation history
 */
async function aiChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string
): Promise<string> {
  return xaiChatCompletion([
    { role: 'system', content: systemPrompt },
    ...messages,
  ]);
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

  const messages = [...(context.previousMessages || [])];
  messages.push({ role: 'user', content: userQuestion });

  return await aiChat(messages, systemPrompt);
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

  const response = await aiGenerate(prompt, { temperature: 0.8 });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON found in response');
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

  return await aiGenerate(prompt, { temperature: 0.6, max_tokens: 150 });
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
  const prompt = `A student got this question wrong. Help them understand their mistake.

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

  return await aiGenerate(prompt);
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

  return await aiGenerate(prompt);
}

/**
 * Check if AI service is available
 */
export async function checkOllamaHealth(): Promise<boolean> {
  if (!XAI_API_KEY) return false;
  try {
    const response = await fetch(`${XAI_BASE_URL}/models`, {
      headers: { 'Authorization': `Bearer ${XAI_API_KEY}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get available models
 */
export async function getAvailableModels(): Promise<string[]> {
  if (!XAI_API_KEY) return [];
  try {
    const response = await fetch(`${XAI_BASE_URL}/models`, {
      headers: { 'Authorization': `Bearer ${XAI_API_KEY}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data?.map((m: { id: string }) => m.id) || [];
  } catch {
    return [];
  }
}

// Export all functions (keep same export shape for compatibility)
export const ollamaAI = {
  generate: aiGenerate,
  chat: aiChat,
  getExplanation: getAIExplanation,
  generateQuestion,
  generateHint,
  explainWrongAnswer,
  generateTopicSummary,
  checkHealth: checkOllamaHealth,
  getModels: getAvailableModels,
};

export default ollamaAI;
