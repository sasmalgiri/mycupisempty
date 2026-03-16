import type { VARKStyle, BloomLevel } from '@/types';
import type { GuruSessionType, LearningDNA } from '@/types/upgrade';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// ============================================================================
// 20+ Teaching Method Prompt Templates
// ============================================================================

export const TEACHING_METHOD_PROMPTS: Record<string, string> = {
  feynman: `Use the Feynman Technique. Explain this concept as if teaching a 5-year-old child. Use the SIMPLEST possible language. Avoid jargon entirely. If you must use a technical term, immediately define it in plain words. Use everyday analogies. If something is hard to explain simply, break it into smaller pieces.`,

  mind_map: `Teach using Mind Mapping. Structure your explanation as a mental map:
- Start with the CENTRAL CONCEPT in the middle
- Branch out to 3-5 main sub-topics
- Each sub-topic branches to specific details
- Show connections between branches
- Use descriptive labels on each connection
Format as a visual hierarchy the student can draw out.`,

  cornell_notes: `Structure your explanation using the Cornell Notes method:
📝 MAIN NOTES (right side): Full explanation with details
❓ CUE COLUMN (left side): Key questions and terms to review
📋 SUMMARY (bottom): 2-3 sentence summary of the whole concept
Present this in a clear, note-taking friendly format.`,

  pomodoro: `Break this explanation into focused chunks (like Pomodoro intervals).
🍅 CHUNK 1: Core concept (focus for 5 min)
🍅 CHUNK 2: Details and examples (focus for 5 min)
🍅 CHUNK 3: Practice and application (focus for 5 min)
Each chunk should be self-contained and digestible.`,

  teach_back: `Use the Teach-Back method. After explaining, ask the student to explain it back in their own words. Structure:
1. Explain the concept clearly
2. Then say "Now, can you explain this back to me in your own words?"
3. Provide guiding prompts if they struggle
The goal is for the student to become the teacher.`,

  project_based: `Frame this concept as a PROJECT the student can build:
🏗️ PROJECT IDEA: A real-world project using this concept
📋 WHAT YOU NEED TO KNOW: The concepts needed
🔧 STEPS TO BUILD: Step-by-step project guide
🎯 WHAT YOU'LL LEARN: Learning outcomes
Make it practical and exciting!`,

  pq4r: `Use the PQ4R method to teach this:
👁️ PREVIEW: Quick overview of what we'll learn
❓ QUESTION: Key questions this topic answers
📖 READ: Detailed explanation
🤔 REFLECT: Deeper connections and implications
🗣️ RECITE: Key points to remember
🔄 REVIEW: Summary and review questions`,

  analogy: `Teach using ANALOGIES and CONNECTIONS. For every concept:
🔗 Find something the student already knows that works similarly
🎯 Map the new concept onto the familiar one
⚠️ Point out where the analogy breaks down
Use at least 2-3 different analogies from everyday Indian life.`,

  gurukul: `Embody the Gurukul tradition of teaching. You are a wise Guru speaking with your shishya (student).
🙏 Begin with context and respect for the knowledge
💬 Use dialogue - ask the student about their existing understanding
📖 Share wisdom progressively, from simple to profound
🌟 Connect the knowledge to dharma and daily life
Use a warm, mentoring tone. Include relevant Sanskrit/Hindi shlokas if applicable.`,

  vedic_math: `Use Vedic Mathematics approaches. Apply relevant Vedic sutras:
🕉️ Identify the applicable sutra (formula)
📐 Show the Vedic shortcut or technique
✨ Demonstrate with examples, comparing with standard method
⚡ Show how it's faster and more elegant
Reference specific Vedic Math sutras by name when applicable (Nikhilam, Urdhva-tiryak, etc.)`,

  memory_palace: `Guide the student to build a MEMORY PALACE:
🏰 Choose a familiar place (their home, school)
🚶 Walk through rooms in order
🖼️ Place each piece of information in a specific location
🎭 Make the images VIVID, UNUSUAL, and MEMORABLE
Walk them through creating mental images for each concept in specific locations.`,

  socratic: `Use PURE Socratic Dialogue. Do NOT give the answer directly. Instead:
❓ Ask a question that leads the student toward discovery
🤔 When they respond, ask a follow-up that goes deeper
💡 Guide them to the "aha!" moment through questioning alone
⚠️ Only if they're truly stuck, give a small nudge (not the answer)
Your goal is to make them DISCOVER the knowledge, not receive it.`,

  storytelling: `Teach through STORYTELLING (Kathasaritsagara tradition):
📚 Create an engaging narrative or parable
👤 Make concepts into CHARACTERS with personality
🎭 The "problem" in the story IS the concept to learn
✨ The "solution" reveals the understanding
Use Indian storytelling traditions when possible. Make it memorable and emotional.`,

  visualization: `Guide MENTAL VISUALIZATION (Dhyana method):
🧘 First, have the student close their eyes and relax
🎨 Paint a vivid mental picture of the concept
🌈 Add colors, textures, movement, and sound
🔍 Zoom in on important details
🎬 Create a "mental movie" they can replay
Describe everything as a visual scene they can see in their mind.`,

  sutra_learning: `Use SUTRA LEARNING — the art of compression:
📿 After explaining the concept, compress it into a SHORT MEMORABLE PHRASE (sutra)
🎵 Make it rhythmic or rhyming if possible
🔑 The sutra should unlock the full concept when recalled
📝 Then show how the sutra expands back into the full understanding
Like how "VIBGYOR" unlocks all rainbow colors.`,

  active_recall: `Structure this for ACTIVE RECALL practice:
📖 First, present the information clearly
🧠 Then IMMEDIATELY test the student:
  - "Without looking back, what are the key points?"
  - "Can you list the steps?"
  - "What's the formula?"
✅ Reveal what they missed
🔄 Repeat until they can recall everything`,

  spaced_rep: `Design this for SPACED REPETITION:
📅 Present the core facts/concepts clearly
🃏 Create 3-5 flashcard-style Q&A pairs from this topic
📊 Tag each as: Easy / Medium / Hard
🔄 Suggest a review schedule:
  - Review today
  - Review tomorrow
  - Review in 3 days
  - Review in 1 week`,

  interleaving: `Use INTERLEAVING — mix this concept with related ones:
🔀 Start with the main concept
↔️ Then switch to a related concept briefly
🔀 Come back to the main concept from a new angle
↔️ Compare and contrast with another related topic
🎯 Show how they connect and differ
This builds flexible understanding!`,

  elaborative_interrogation: `Use ELABORATIVE INTERROGATION:
For EVERY fact or statement, immediately ask:
❓ "WHY is this true?"
❓ "HOW does this work?"
❓ "WHAT would happen if this were different?"
❓ "HOW does this connect to what you already know?"
Force the student to think deeply about each piece.`,

  dual_coding: `Use DUAL CODING — combine words and visuals:
📝 VERBAL: Written explanation in clear text
📊 VISUAL: Describe a diagram/chart/image for each point
🔗 Link each visual to its verbal explanation
🎯 Key point: Two memory pathways are better than one
Describe what the diagram would look like in detail.`,

  chunking: `Use CHUNKING to break this into digestible pieces:
🧩 CHUNK 1: [First small group of related info]
🧩 CHUNK 2: [Second small group]
🧩 CHUNK 3: [Third small group]
🔗 Then show how the chunks connect
Remember: Brain holds 4-7 chunks at a time. Keep each chunk small!`,
};

// ============================================================================
// Difficulty Level Mapping
// ============================================================================

const DIFFICULTY_PROMPTS: Record<number, string> = {
  1: 'Explain like I am 5 years old. Use only the simplest words. No technical terms at all.',
  2: 'Explain for a young child (age 7-8). Very simple language, lots of examples from daily life.',
  3: 'Explain for a Class 3-4 student. Simple but can use basic subject terms.',
  4: 'Explain for a Class 5-6 student. Can use standard textbook language.',
  5: 'Explain at the standard NCERT level appropriate for the student\'s class.',
  6: 'Explain with slightly more depth than NCERT. Include extra context and connections.',
  7: 'Explain at an advanced level. Include deeper analysis and cross-topic connections.',
  8: 'Explain at a competitive exam level (Olympiad/NTSE). Rigorous and detailed.',
  9: 'Explain at an undergraduate introductory level. Formal and comprehensive.',
  10: 'Explain at an expert/graduate level. No simplification, full technical depth.',
};

// ============================================================================
// Core Guru Functions
// ============================================================================

interface UnstuckContext {
  topicId: string;
  subjectName: string;
  masteryBand: string;
  scaffoldLevel: number;
  recentMistakes: string[];
  misconceptions: string[];
}

interface GuruContext {
  classLevel: number;
  subject: string;
  topic: string;
  learningStyle?: VARKStyle;
  teachingMethod?: string;
  difficultyLevel?: number;
  isSocratic?: boolean;
  isBeyondCurriculum?: boolean;
  previousMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  unstuckContext?: UnstuckContext;
}

async function ollamaChat(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: false,
        options: { temperature: 0.7, top_p: 0.9 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || data.response || '';
  } catch (error) {
    console.error('Ollama Guru API Error:', error);
    throw error;
  }
}

async function ollamaGenerate(prompt: string, temperature = 0.7): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature, top_p: 0.9, num_predict: 1024 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (error) {
    console.error('Ollama Generate Error:', error);
    throw error;
  }
}

/**
 * Enhanced AI Guru explanation with method + difficulty + Socratic mode
 */
export async function getGuruExplanation(
  context: GuruContext,
  userMessage: string
): Promise<string> {
  const difficulty = context.difficultyLevel || 5;
  const method = context.teachingMethod || 'feynman';

  let systemPrompt = `You are an expert AI Guru and mentor. `;

  if (context.isBeyondCurriculum) {
    systemPrompt += `The student is exploring beyond their curriculum — encourage their curiosity! You can discuss any topic at any depth. `;
  } else {
    systemPrompt += `You are teaching Class ${context.classLevel} ${context.subject}, topic: "${context.topic}". `;
  }

  // Difficulty
  systemPrompt += `\n\nDIFFICULTY LEVEL (${difficulty}/10): ${DIFFICULTY_PROMPTS[difficulty]}\n`;

  // Teaching method
  if (TEACHING_METHOD_PROMPTS[method]) {
    systemPrompt += `\nTEACHING METHOD — ${method.toUpperCase()}:\n${TEACHING_METHOD_PROMPTS[method]}\n`;
  }

  // Unstuck context (enhanced Socratic support)
  if (context.unstuckContext) {
    const uc = context.unstuckContext;
    systemPrompt += `\nSTUDENT CONTEXT (from Unstuck button):
- Currently studying: ${uc.subjectName} > ${context.topic}
- Mastery level: ${uc.masteryBand}
- Scaffold level: ${uc.scaffoldLevel}/5
- Recent struggles: ${uc.misconceptions.length > 0 ? uc.misconceptions.join(', ') : 'None recorded'}
- Recent mistakes: ${uc.recentMistakes.length > 0 ? uc.recentMistakes.join(', ') : 'None recorded'}

The student pressed the "I'm Stuck" button. They need help RIGHT NOW.
Use the Socratic method — don't give answers directly. Ask guiding questions.
Start by acknowledging they're stuck, then ask what specific part is confusing.
Be extra patient and encouraging.\n`;
  }

  // Socratic override
  if (context.isSocratic) {
    systemPrompt += `\n🔴 SOCRATIC MODE ACTIVE: Do NOT give direct answers. Only ask guiding questions. Lead the student to discover the answer through dialogue. If they ask "just tell me", gently redirect with another question.\n`;
  }

  // Learning style
  if (context.learningStyle) {
    const styleHints: Record<VARKStyle, string> = {
      visual: 'This student learns best through images, diagrams, and visual patterns.',
      auditory: 'This student learns best through listening, discussion, and verbal explanations.',
      reading: 'This student learns best through reading, writing, and text-based content.',
      kinesthetic: 'This student learns best through hands-on activities and real-world applications.',
    };
    systemPrompt += `\nSTUDENT'S LEARNING STYLE: ${context.learningStyle} — ${styleHints[context.learningStyle]}\n`;
  }

  systemPrompt += `\nGUIDELINES:
- Be warm, patient, and encouraging
- Use Indian context and examples when relevant
- Include Hindi terms when they add clarity
- Every 4-5 exchanges, check the student's understanding
- If the student seems confused, try a different approach automatically`;

  const messages = [...(context.previousMessages || [])];
  messages.push({ role: 'user', content: userMessage });

  return await ollamaChat(messages, systemPrompt);
}

/**
 * Generate AI-powered method recommendations for a student + topic
 */
export async function generateMethodRecommendation(
  learningDNA: Partial<LearningDNA>,
  topic: string,
  subject: string,
  classLevel: number
): Promise<Array<{ method_code: string; reason: string; match_score: number }>> {
  const prompt = `You are an educational psychologist. Given a student's learning profile and a topic, recommend the 3 best teaching methods.

STUDENT PROFILE:
- Primary VARK style: ${learningDNA.vark_primary || 'unknown'}
- Kolb type: ${learningDNA.kolb_type || 'unknown'}
- Learning speed: ${learningDNA.learning_speed || 'medium'}
- Attention span: ${learningDNA.attention_span_minutes || 25} minutes
- Preferred methods: ${learningDNA.preferred_methods?.join(', ') || 'none yet'}

TOPIC: ${topic}
SUBJECT: ${subject}
CLASS: ${classLevel}

Available methods: feynman, mind_map, cornell_notes, pomodoro, teach_back, project_based, pq4r, analogy, gurukul, vedic_math, memory_palace, socratic, storytelling, visualization, sutra_learning, active_recall, spaced_rep, interleaving, elaborative_interrogation, dual_coding, chunking

Respond in JSON format only:
[
  {"method_code": "method1", "reason": "Why this method fits", "match_score": 95},
  {"method_code": "method2", "reason": "Why this method fits", "match_score": 85},
  {"method_code": "method3", "reason": "Why this method fits", "match_score": 75}
]`;

  const response = await ollamaGenerate(prompt, 0.6);

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    return JSON.parse(jsonMatch[0]);
  } catch {
    // Fallback: return default recommendations based on VARK
    const defaults: Record<string, string[]> = {
      visual: ['mind_map', 'dual_coding', 'visualization'],
      auditory: ['socratic', 'storytelling', 'gurukul'],
      reading: ['cornell_notes', 'pq4r', 'elaborative_interrogation'],
      kinesthetic: ['project_based', 'vedic_math', 'active_recall'],
    };
    const methods = defaults[learningDNA.vark_primary || 'visual'];
    return methods.map((code, i) => ({
      method_code: code,
      reason: `Recommended for ${learningDNA.vark_primary || 'visual'} learners`,
      match_score: 90 - i * 10,
    }));
  }
}

/**
 * Assess student understanding with a quick comprehension check
 */
export async function assessUnderstanding(
  topic: string,
  recentExplanation: string,
  classLevel: number
): Promise<{ question: string; expected_concepts: string[] }> {
  const prompt = `You just explained this to a Class ${classLevel} student:

"${recentExplanation.slice(0, 500)}"

Topic: ${topic}

Generate ONE quick comprehension check question to see if they understood. Also list the key concepts you expect in their answer.

Respond in JSON:
{
  "question": "Your question here?",
  "expected_concepts": ["concept1", "concept2", "concept3"]
}`;

  const response = await ollamaGenerate(prompt, 0.5);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      question: `Can you explain what you just learned about ${topic} in your own words?`,
      expected_concepts: [topic],
    };
  }
}

/**
 * Generate the same topic explanation using multiple methods for comparison
 */
export async function generateMultiMethodExplanation(
  topic: string,
  subject: string,
  classLevel: number,
  methods: string[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Generate explanations in parallel (max 3)
  const selectedMethods = methods.slice(0, 3);

  const promises = selectedMethods.map(async (method) => {
    const prompt = `Briefly explain "${topic}" (Class ${classLevel} ${subject}) using the following teaching method.

METHOD: ${method.toUpperCase()}
${TEACHING_METHOD_PROMPTS[method] || 'Explain clearly and concisely.'}

Keep your explanation to 150-200 words. Be clear and engaging.`;

    const response = await ollamaGenerate(prompt, 0.7);
    return { method, response };
  });

  const responses = await Promise.all(promises);
  for (const { method, response } of responses) {
    results[method] = response;
  }

  return results;
}

/**
 * Generate an activity/game config for a topic using AI
 */
export async function generateActivityConfig(
  topic: string,
  subject: string,
  classLevel: number,
  activityType: string
): Promise<Record<string, any>> {
  const typePrompts: Record<string, string> = {
    word_puzzle: `Create a word puzzle about "${topic}". Generate 6-8 words with clues related to the topic.
JSON: {"type":"word_puzzle","puzzle_type":"scramble","words":[{"word":"PHOTOSYNTHESIS","clue":"Process plants use to make food"},...]}`,

    number_game: `Create 5 mental math or number pattern problems related to "${topic}".
JSON: {"type":"number_game","game_type":"mental_math","problems":[{"question":"What is...","answer":42,"hint":"Think about..."},...]}`,

    concept_match: `Create 6 concept-match pairs for "${topic}". Include 2 distractors.
JSON: {"type":"concept_match","pairs":[{"concept":"Term1","match":"Definition1"},...], "instruction":"Match each concept to its definition","distractor_matches":["Wrong1","Wrong2"]}`,

    sequence_arrange: `Create a sequence of 5-7 steps/events related to "${topic}" that students need to arrange in order.
JSON: {"type":"sequence_arrange","items":[{"id":"1","text":"First step"},...], "correct_order":["1","2","3",...], "instruction":"Arrange these in the correct order"}`,
  };

  const prompt = `You are creating an interactive learning activity for Class ${classLevel} ${subject}, topic: "${topic}".

${typePrompts[activityType] || `Create a ${activityType} activity. Return appropriate JSON config.`}

Only output valid JSON.`;

  const response = await ollamaGenerate(prompt, 0.8);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { type: activityType, error: 'Failed to generate activity' };
  }
}

/**
 * Generate a warm, narrative growth story for a student's progress report
 */
export async function generateGrowthStoryNarrative(
  studentName: string,
  data: {
    periodStart: string;
    periodEnd: string;
    academicSnapshot: any;
    developmentSnapshot: any;
    engagementSnapshot: any;
    archetypes: string[];
    strengths: string[];
    growthAreas: string[];
    milestones: any[];
  }
): Promise<string> {
  const prompt = `You are a warm, encouraging educational storyteller. Write a growth narrative (200-400 words) for a student's progress report.

STUDENT: ${studentName}
PERIOD: ${data.periodStart} to ${data.periodEnd}

ACADEMIC SNAPSHOT:
${JSON.stringify(data.academicSnapshot, null, 2)}

DEVELOPMENT SNAPSHOT:
${JSON.stringify(data.developmentSnapshot, null, 2)}

ENGAGEMENT SNAPSHOT:
${JSON.stringify(data.engagementSnapshot, null, 2)}

LEARNER ARCHETYPES: ${data.archetypes.join(', ')}
KEY STRENGTHS: ${data.strengths.join(', ')}
GROWTH AREAS: ${data.growthAreas.join(', ')}
MILESTONES ACHIEVED: ${data.milestones.map((m: any) => m.title || m.name || JSON.stringify(m)).join(', ')}

GUIDELINES:
- Write in a warm, personal tone as if speaking to the student and their family
- Celebrate specific achievements and growth moments
- Frame challenges positively as growth opportunities
- Use the student's name naturally throughout
- Include specific details from the data (don't be generic)
- End with encouragement and a forward-looking note
- Keep Indian educational context in mind
- 200-400 words, no more

Write the narrative now:`;

  try {
    const narrative = await ollamaGenerate(prompt, 0.8);
    return narrative.trim();
  } catch (error) {
    console.error('Error generating growth narrative:', error);
    // Fallback narrative
    return `${studentName} has been making progress during this period. They have shown strengths in ${data.strengths.join(' and ')}${data.growthAreas.length > 0 ? `, while continuing to develop in ${data.growthAreas.join(' and ')}` : ''}. ${data.milestones.length > 0 ? `Notable milestones include reaching new achievements in their learning journey.` : ''} Keep up the great work!`;
  }
}

// Export all guru functions
export const guruAI = {
  getExplanation: getGuruExplanation,
  recommendMethods: generateMethodRecommendation,
  assessUnderstanding,
  multiMethodExplanation: generateMultiMethodExplanation,
  generateActivity: generateActivityConfig,
  generateGrowthStory: generateGrowthStoryNarrative,
  TEACHING_METHOD_PROMPTS,
  DIFFICULTY_PROMPTS,
};

export default guruAI;
