// ============================================================================
// Learning Style Evaluation Engine
// Generates adaptive evaluation questions to discover a student's learning style
// per subject. Covers all 8 major learning styles with multi-dimensional scoring.
// ============================================================================

import type { StyleEvalQuestionOption, LearningStyleCode, StyleScores, ComprehensionQuestion } from '@/types/learning-teams';

// ============================================================================
// GENERAL LEARNING STYLE DISCOVERY (Subject-independent)
// ============================================================================

interface GeneratedQuestion {
  question_number: number;
  question_type: 'scenario_choice' | 'preference_rank' | 'self_assessment' | 'observation_task';
  question_text: string;
  options: StyleEvalQuestionOption[];
  order_index: number;
}

export function generateGeneralStyleQuestions(): GeneratedQuestion[] {
  return [
    {
      question_number: 1,
      question_type: 'scenario_choice',
      question_text: 'You need to learn how a car engine works. Which approach would help you most?',
      order_index: 1,
      options: [
        { text: 'Watch a detailed animated diagram of the engine', style_code: 'visual_spatial', weight: 3 },
        { text: 'Listen to a mechanic explain it step by step', style_code: 'auditory_musical', weight: 3 },
        { text: 'Read a technical manual with descriptions', style_code: 'reading_writing', weight: 3 },
        { text: 'Take apart an actual engine and explore the parts', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'Study the logical flow: fuel → combustion → motion', style_code: 'logical_mathematical', weight: 3 },
        { text: 'Discuss with friends and have them explain it', style_code: 'social_interpersonal', weight: 3 },
        { text: 'Research it alone at my own pace', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'Visit a factory and observe how real engines are made', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 2,
      question_type: 'scenario_choice',
      question_text: 'When you forget something important, which method helps you remember best?',
      order_index: 2,
      options: [
        { text: 'I visualize where I was when I learned it — the colors, the scene', style_code: 'visual_spatial', weight: 3 },
        { text: 'I try to hear the words again — the voice, the tone', style_code: 'auditory_musical', weight: 3 },
        { text: 'I re-read my notes or the textbook passage', style_code: 'reading_writing', weight: 3 },
        { text: 'I recreate the physical action — writing, moving, or doing', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'I retrace the logic — what came before and after', style_code: 'logical_mathematical', weight: 3 },
        { text: 'I ask someone who was there to remind me', style_code: 'social_interpersonal', weight: 3 },
        { text: 'I sit quietly and reflect until it comes back', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'I connect it to something in my environment — a smell, a place', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 3,
      question_type: 'scenario_choice',
      question_text: 'Your teacher just explained a new concept. What do you do first?',
      order_index: 3,
      options: [
        { text: 'Draw a mind map or diagram to organize the idea', style_code: 'visual_spatial', weight: 3 },
        { text: 'Repeat the key points aloud or discuss with my neighbor', style_code: 'auditory_musical', weight: 3 },
        { text: 'Write down detailed notes in my own words', style_code: 'reading_writing', weight: 3 },
        { text: 'Try to solve a problem using the concept immediately', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'Ask "why does this work?" and try to find the underlying rule', style_code: 'logical_mathematical', weight: 3 },
        { text: 'Turn to my classmates and talk about it together', style_code: 'social_interpersonal', weight: 3 },
        { text: 'Reflect on it quietly and connect it to what I already know', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'Think of real-world examples where this applies', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 4,
      question_type: 'self_assessment',
      question_text: 'When studying for an exam, I prefer to:',
      order_index: 4,
      options: [
        { text: 'Use color-coded flashcards, charts, and visual aids', style_code: 'visual_spatial', weight: 3 },
        { text: 'Record myself reading notes and listen back', style_code: 'auditory_musical', weight: 3 },
        { text: 'Rewrite all notes neatly and make summaries', style_code: 'reading_writing', weight: 3 },
        { text: 'Walk around while studying or use physical models', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'Solve practice problems and work through logic', style_code: 'logical_mathematical', weight: 3 },
        { text: 'Study in a group and quiz each other', style_code: 'social_interpersonal', weight: 3 },
        { text: 'Study alone in a quiet room with my plan', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'Go to a park or nature spot — I focus better outdoors', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 5,
      question_type: 'scenario_choice',
      question_text: 'You\'re learning about the solar system. Which activity excites you most?',
      order_index: 5,
      options: [
        { text: 'A 3D interactive model I can rotate and explore', style_code: 'visual_spatial', weight: 3 },
        { text: 'A podcast episode about how each planet was discovered', style_code: 'auditory_musical', weight: 3 },
        { text: 'A detailed article explaining each planet\'s characteristics', style_code: 'reading_writing', weight: 3 },
        { text: 'Building a scale model of the solar system with clay', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'Calculating distances, gravity, and orbital periods', style_code: 'logical_mathematical', weight: 3 },
        { text: 'A group project where each person presents one planet', style_code: 'social_interpersonal', weight: 3 },
        { text: 'A solo research project where I dive deep into one planet', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'Star-gazing night with a telescope to see the real thing', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 6,
      question_type: 'self_assessment',
      question_text: 'I understand a math concept best when:',
      order_index: 6,
      options: [
        { text: 'I see a graph, chart, or geometric visualization', style_code: 'visual_spatial', weight: 3 },
        { text: 'Someone explains the steps aloud clearly', style_code: 'auditory_musical', weight: 3 },
        { text: 'I read the formula derivation and examples in a book', style_code: 'reading_writing', weight: 3 },
        { text: 'I physically manipulate objects (blocks, counters, etc.)', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'I understand the logical proof behind it', style_code: 'logical_mathematical', weight: 3 },
        { text: 'I teach it to someone else or work in a pair', style_code: 'social_interpersonal', weight: 3 },
        { text: 'I work through it alone with trial and error', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'I see it applied in real-world nature (growth patterns, etc.)', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 7,
      question_type: 'scenario_choice',
      question_text: 'You\'re trying to memorize historical dates and events. You would:',
      order_index: 7,
      options: [
        { text: 'Create a colorful timeline with images and arrows', style_code: 'visual_spatial', weight: 3 },
        { text: 'Create a song or chant with the dates', style_code: 'auditory_musical', weight: 3 },
        { text: 'Write them down repeatedly and make lists', style_code: 'reading_writing', weight: 3 },
        { text: 'Act out the events or visit historical places', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'Create a cause-and-effect chain to understand why things happened', style_code: 'logical_mathematical', weight: 3 },
        { text: 'Quiz friends and create a game out of it', style_code: 'social_interpersonal', weight: 3 },
        { text: 'Use a memory palace technique in my mind', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'Connect events to geography and natural surroundings', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 8,
      question_type: 'self_assessment',
      question_text: 'In a classroom, I am most engaged when:',
      order_index: 8,
      options: [
        { text: 'The teacher uses the whiteboard with diagrams and colors', style_code: 'visual_spatial', weight: 3 },
        { text: 'The teacher tells interesting stories and explains verbally', style_code: 'auditory_musical', weight: 3 },
        { text: 'We read from the textbook and I can take notes', style_code: 'reading_writing', weight: 3 },
        { text: 'We do experiments, activities, or hands-on projects', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'We solve challenging puzzles and brain teasers', style_code: 'logical_mathematical', weight: 3 },
        { text: 'We work in groups or have class discussions', style_code: 'social_interpersonal', weight: 3 },
        { text: 'I can work independently at my own pace', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'We go outside or study things from nature/real life', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 9,
      question_type: 'scenario_choice',
      question_text: 'You need to explain photosynthesis to a younger student. How would you do it?',
      order_index: 9,
      options: [
        { text: 'Draw a picture showing sunlight → leaf → oxygen', style_code: 'visual_spatial', weight: 3 },
        { text: 'Tell them a story about a leaf eating sunlight for lunch', style_code: 'auditory_musical', weight: 3 },
        { text: 'Write a simple step-by-step explanation on paper', style_code: 'reading_writing', weight: 3 },
        { text: 'Use a plant, water, and a lamp to demonstrate', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'Explain the chemical equation: CO2 + H2O + light → glucose + O2', style_code: 'logical_mathematical', weight: 3 },
        { text: 'Have them explain what they already know, then build on it together', style_code: 'social_interpersonal', weight: 3 },
        { text: 'Give them a self-study guide they can explore at their pace', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'Take them to a garden and show it happening in real plants', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 10,
      question_type: 'self_assessment',
      question_text: 'When I\'m bored in class, I tend to:',
      order_index: 10,
      options: [
        { text: 'Doodle, draw, or look around at visual details', style_code: 'visual_spatial', weight: 2 },
        { text: 'Hum, tap a rhythm, or whisper to myself', style_code: 'auditory_musical', weight: 2 },
        { text: 'Read ahead in the textbook or write something', style_code: 'reading_writing', weight: 2 },
        { text: 'Fidget, tap my feet, or play with objects', style_code: 'kinesthetic_tactile', weight: 2 },
        { text: 'Try to find patterns in what the teacher is saying', style_code: 'logical_mathematical', weight: 2 },
        { text: 'Pass notes or whisper to friends', style_code: 'social_interpersonal', weight: 2 },
        { text: 'Daydream or reflect on my own thoughts', style_code: 'solitary_intrapersonal', weight: 2 },
        { text: 'Look out the window at trees, clouds, sky', style_code: 'naturalistic', weight: 2 },
      ],
    },
    {
      question_number: 11,
      question_type: 'scenario_choice',
      question_text: 'Your ideal science project would be:',
      order_index: 11,
      options: [
        { text: 'An infographic poster with visuals and charts', style_code: 'visual_spatial', weight: 3 },
        { text: 'A recorded presentation or podcast episode', style_code: 'auditory_musical', weight: 3 },
        { text: 'A detailed written research report', style_code: 'reading_writing', weight: 3 },
        { text: 'A working model or experiment demonstration', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'A mathematical analysis with data and conclusions', style_code: 'logical_mathematical', weight: 3 },
        { text: 'A group presentation where everyone contributes', style_code: 'social_interpersonal', weight: 3 },
        { text: 'An independent deep-dive into an original question', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'A field study observing something in nature', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 12,
      question_type: 'self_assessment',
      question_text: 'I feel most confident about my understanding when:',
      order_index: 12,
      options: [
        { text: 'I can picture the whole concept in my mind clearly', style_code: 'visual_spatial', weight: 3 },
        { text: 'I can explain it out loud without hesitation', style_code: 'auditory_musical', weight: 3 },
        { text: 'I can write a clear summary from memory', style_code: 'reading_writing', weight: 3 },
        { text: 'I can demonstrate it or apply it physically', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'I can solve new problems using the concept', style_code: 'logical_mathematical', weight: 3 },
        { text: 'I can teach it to someone and they understand', style_code: 'social_interpersonal', weight: 3 },
        { text: 'I feel it deeply and have connected it to my beliefs', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'I can see it working in real life around me', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 13,
      question_type: 'preference_rank',
      question_text: 'You\'re learning a new language. What works best for you?',
      order_index: 13,
      options: [
        { text: 'Flashcards with images and word associations', style_code: 'visual_spatial', weight: 3 },
        { text: 'Listening to native speakers and repeating', style_code: 'auditory_musical', weight: 3 },
        { text: 'Reading bilingual texts and writing translations', style_code: 'reading_writing', weight: 3 },
        { text: 'Role-playing conversations and using gestures', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'Learning grammar rules and sentence structure first', style_code: 'logical_mathematical', weight: 3 },
        { text: 'Practicing with a language partner', style_code: 'social_interpersonal', weight: 3 },
        { text: 'Using a self-paced app alone', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'Immersion — traveling and experiencing the culture', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 14,
      question_type: 'scenario_choice',
      question_text: 'If you could redesign your classroom, what would you add?',
      order_index: 14,
      options: [
        { text: 'More whiteboards, projectors, and colorful wall charts', style_code: 'visual_spatial', weight: 2 },
        { text: 'Music speakers, podcast station, and discussion areas', style_code: 'auditory_musical', weight: 2 },
        { text: 'A library corner with books and writing desks', style_code: 'reading_writing', weight: 2 },
        { text: 'A maker space with tools, materials, and labs', style_code: 'kinesthetic_tactile', weight: 2 },
        { text: 'Puzzle walls, coding stations, and logic games', style_code: 'logical_mathematical', weight: 2 },
        { text: 'Round tables for group work and collaboration boards', style_code: 'social_interpersonal', weight: 2 },
        { text: 'Quiet study pods and meditation corners', style_code: 'solitary_intrapersonal', weight: 2 },
        { text: 'A garden, aquarium, and nature observation deck', style_code: 'naturalistic', weight: 2 },
      ],
    },
    {
      question_number: 15,
      question_type: 'self_assessment',
      question_text: 'When I don\'t understand something, my first instinct is to:',
      order_index: 15,
      options: [
        { text: 'Search for a video or diagram that shows it', style_code: 'visual_spatial', weight: 3 },
        { text: 'Ask someone to explain it to me verbally', style_code: 'auditory_musical', weight: 3 },
        { text: 'Google it and read multiple articles', style_code: 'reading_writing', weight: 3 },
        { text: 'Try to do it myself and learn from mistakes', style_code: 'kinesthetic_tactile', weight: 3 },
        { text: 'Break it down step by step until it makes sense', style_code: 'logical_mathematical', weight: 3 },
        { text: 'Ask a friend or classmate for help', style_code: 'social_interpersonal', weight: 3 },
        { text: 'Think about it deeply on my own before asking anyone', style_code: 'solitary_intrapersonal', weight: 3 },
        { text: 'Find a real-world example that connects to it', style_code: 'naturalistic', weight: 3 },
      ],
    },
    {
      question_number: 16,
      question_type: 'scenario_choice',
      question_text: 'You discovered an amazing fun fact. How do you share it?',
      order_index: 16,
      options: [
        { text: 'Create an eye-catching social media graphic', style_code: 'visual_spatial', weight: 2 },
        { text: 'Tell everyone excitedly in conversation', style_code: 'auditory_musical', weight: 2 },
        { text: 'Write a detailed post or blog about it', style_code: 'reading_writing', weight: 2 },
        { text: 'Demonstrate it with a quick experiment', style_code: 'kinesthetic_tactile', weight: 2 },
        { text: 'Explain the science/logic behind why it works', style_code: 'logical_mathematical', weight: 2 },
        { text: 'Start a group chat discussion about it', style_code: 'social_interpersonal', weight: 2 },
        { text: 'Journal about it and what it means to me', style_code: 'solitary_intrapersonal', weight: 2 },
        { text: 'Go observe it in nature/real life to verify', style_code: 'naturalistic', weight: 2 },
      ],
    },
  ];
}

// ============================================================================
// SUBJECT-SPECIFIC EVALUATION (Generates per-subject style questions)
// ============================================================================

export function generateSubjectStyleQuestions(subjectName: string): GeneratedQuestion[] {
  const subjects: Record<string, GeneratedQuestion[]> = {
    mathematics: [
      {
        question_number: 1, question_type: 'scenario_choice', order_index: 1,
        question_text: 'You\'re learning about fractions. Which approach helps you most?',
        options: [
          { text: 'Pie charts and colored fraction bars', style_code: 'visual_spatial', weight: 3 },
          { text: 'A teacher explaining with verbal examples', style_code: 'auditory_musical', weight: 3 },
          { text: 'Reading the textbook and working through examples', style_code: 'reading_writing', weight: 3 },
          { text: 'Cutting a pizza or chocolate into parts', style_code: 'kinesthetic_tactile', weight: 3 },
          { text: 'Understanding the rules: numerator/denominator logic', style_code: 'logical_mathematical', weight: 3 },
          { text: 'Working fraction problems in pairs', style_code: 'social_interpersonal', weight: 3 },
          { text: 'Practicing alone with a worksheet at my pace', style_code: 'solitary_intrapersonal', weight: 3 },
          { text: 'Measuring real ingredients for a recipe', style_code: 'naturalistic', weight: 3 },
        ],
      },
      {
        question_number: 2, question_type: 'scenario_choice', order_index: 2,
        question_text: 'When solving word problems, you:',
        options: [
          { text: 'Draw a picture or diagram of the problem', style_code: 'visual_spatial', weight: 3 },
          { text: 'Read it aloud to hear what\'s being asked', style_code: 'auditory_musical', weight: 3 },
          { text: 'Underline key words and write equations', style_code: 'reading_writing', weight: 3 },
          { text: 'Act it out with objects on the table', style_code: 'kinesthetic_tactile', weight: 3 },
          { text: 'Identify the pattern and apply the right formula', style_code: 'logical_mathematical', weight: 3 },
          { text: 'Discuss with a partner to understand the question', style_code: 'social_interpersonal', weight: 3 },
          { text: 'Work through it step by step in my head', style_code: 'solitary_intrapersonal', weight: 3 },
          { text: 'Relate it to a real-life situation I\'ve seen', style_code: 'naturalistic', weight: 3 },
        ],
      },
    ],
    science: [
      {
        question_number: 1, question_type: 'scenario_choice', order_index: 1,
        question_text: 'You\'re studying the water cycle. Which approach works best?',
        options: [
          { text: 'An animated diagram showing evaporation → condensation → precipitation', style_code: 'visual_spatial', weight: 3 },
          { text: 'A teacher narrating the journey of a water droplet', style_code: 'auditory_musical', weight: 3 },
          { text: 'Reading a detailed description of each stage', style_code: 'reading_writing', weight: 3 },
          { text: 'Creating a mini water cycle in a jar experiment', style_code: 'kinesthetic_tactile', weight: 3 },
          { text: 'Understanding the physics: temperature, pressure, state changes', style_code: 'logical_mathematical', weight: 3 },
          { text: 'A class debate on why water cycles matter for climate', style_code: 'social_interpersonal', weight: 3 },
          { text: 'A solo research project tracking local rainfall data', style_code: 'solitary_intrapersonal', weight: 3 },
          { text: 'Going outside on a rainy day and observing puddles, clouds, streams', style_code: 'naturalistic', weight: 3 },
        ],
      },
    ],
    english: [
      {
        question_number: 1, question_type: 'scenario_choice', order_index: 1,
        question_text: 'You\'re studying a Shakespeare play. Which approach helps you most?',
        options: [
          { text: 'Watching a film adaptation with beautiful visuals', style_code: 'visual_spatial', weight: 3 },
          { text: 'Listening to a professional audio performance', style_code: 'auditory_musical', weight: 3 },
          { text: 'Reading the original text with annotations', style_code: 'reading_writing', weight: 3 },
          { text: 'Acting out scenes with classmates', style_code: 'kinesthetic_tactile', weight: 3 },
          { text: 'Analyzing the plot structure and character motivations', style_code: 'logical_mathematical', weight: 3 },
          { text: 'Group discussion about themes and interpretations', style_code: 'social_interpersonal', weight: 3 },
          { text: 'Writing my own analysis essay in solitude', style_code: 'solitary_intrapersonal', weight: 3 },
          { text: 'Visiting the historical setting or a theater', style_code: 'naturalistic', weight: 3 },
        ],
      },
    ],
    history: [
      {
        question_number: 1, question_type: 'scenario_choice', order_index: 1,
        question_text: 'You\'re learning about the Indian Independence Movement. What engages you most?',
        options: [
          { text: 'A timeline infographic with key events and images', style_code: 'visual_spatial', weight: 3 },
          { text: 'Listening to speeches of freedom fighters', style_code: 'auditory_musical', weight: 3 },
          { text: 'Reading letters and documents from the era', style_code: 'reading_writing', weight: 3 },
          { text: 'Visiting museums or reenacting events', style_code: 'kinesthetic_tactile', weight: 3 },
          { text: 'Analyzing cause and effect chains of events', style_code: 'logical_mathematical', weight: 3 },
          { text: 'A panel discussion debating different leaders\' strategies', style_code: 'social_interpersonal', weight: 3 },
          { text: 'A personal reflection essay on what freedom means', style_code: 'solitary_intrapersonal', weight: 3 },
          { text: 'Visiting the actual places where events happened', style_code: 'naturalistic', weight: 3 },
        ],
      },
    ],
  };

  const subjectKey = subjectName.toLowerCase().replace(/\s+/g, '_');
  return subjects[subjectKey] || subjects['science'] || [];
}

// ============================================================================
// SCORING ENGINE
// ============================================================================

export function computeStyleScores(
  answers: { selected_option_index: number }[],
  questions: { options: StyleEvalQuestionOption[] }[]
): StyleScores {
  const scores: StyleScores = {
    visual_spatial: 0,
    auditory_musical: 0,
    reading_writing: 0,
    kinesthetic_tactile: 0,
    logical_mathematical: 0,
    social_interpersonal: 0,
    solitary_intrapersonal: 0,
    naturalistic: 0,
  };

  const maxPossible: Record<string, number> = { ...scores };

  answers.forEach((answer, i) => {
    const question = questions[i];
    if (!question) return;

    const selectedOption = question.options[answer.selected_option_index];
    if (!selectedOption) return;

    scores[selectedOption.style_code] += selectedOption.weight;

    // Track max possible per style
    question.options.forEach(opt => {
      if (!maxPossible[opt.style_code]) maxPossible[opt.style_code] = 0;
      maxPossible[opt.style_code] = Math.max(maxPossible[opt.style_code], opt.weight);
    });
  });

  // Normalize to 0-100
  const totalWeight = Object.values(scores).reduce((sum, v) => sum + v, 0);
  if (totalWeight > 0) {
    const styleEntries = Object.entries(scores);
    const maxScore = Math.max(...styleEntries.map(([, v]) => v));

    for (const [style] of styleEntries) {
      scores[style as LearningStyleCode] = Math.round((scores[style as LearningStyleCode] / maxScore) * 100);
    }
  }

  return scores;
}

export function determinePrimaryAndSecondary(scores: StyleScores): {
  primary: LearningStyleCode;
  secondary: LearningStyleCode;
  confidence: number;
} {
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a);

  const primary = sorted[0][0] as LearningStyleCode;
  const secondary = sorted[1][0] as LearningStyleCode;
  const confidence = sorted[0][1]; // Already 0-100 after normalization

  return { primary, secondary, confidence };
}

// ============================================================================
// COMPREHENSION TEST GENERATOR
// ============================================================================

export function generateComprehensionQuestions(
  topic: string,
  subjectName: string,
  level: string,
  styleCode: LearningStyleCode
): ComprehensionQuestion[] {
  // These are templates — in production, AI Guru would generate these dynamically
  const baseQuestions: ComprehensionQuestion[] = [
    {
      id: 'comp_1',
      text: `Define the key concept of "${topic}" in your own words.`,
      type: 'short',
      bloom_level: 'remember',
      correct_answer: '', // Open-ended, AI-evaluated
      points: 10,
    },
    {
      id: 'comp_2',
      text: `Explain why "${topic}" is important in ${subjectName}. Give one real example.`,
      type: 'explain',
      bloom_level: 'understand',
      correct_answer: '',
      points: 15,
    },
    {
      id: 'comp_3',
      text: `Apply the concept of "${topic}" to solve the following problem:`,
      type: 'apply',
      bloom_level: 'apply',
      correct_answer: '',
      points: 20,
    },
    {
      id: 'comp_4',
      text: `Compare and contrast two different aspects of "${topic}". What patterns do you see?`,
      type: 'analyze',
      bloom_level: 'analyze',
      correct_answer: '',
      points: 20,
    },
    {
      id: 'comp_5',
      text: `Is the following statement about "${topic}" correct? Justify your reasoning.`,
      type: 'analyze',
      bloom_level: 'evaluate',
      correct_answer: '',
      points: 15,
    },
    {
      id: 'comp_6',
      text: `Create an original example, analogy, or application of "${topic}" that hasn't been discussed in class.`,
      type: 'create',
      bloom_level: 'create',
      correct_answer: '',
      points: 20,
    },
  ];

  return baseQuestions;
}

// ============================================================================
// STYLE → METHOD MAPPING
// ============================================================================

export const STYLE_METHOD_MAP: Record<LearningStyleCode, string[]> = {
  visual_spatial: ['mind_map', 'dual_coding', 'visualization', 'memory_palace'],
  auditory_musical: ['storytelling', 'socratic', 'gurukul', 'teach_back'],
  reading_writing: ['cornell_notes', 'pq4r', 'sutra_learning', 'elaborative_interrogation'],
  kinesthetic_tactile: ['project_based', 'feynman', 'active_recall', 'chunking'],
  logical_mathematical: ['vedic_math', 'interleaving', 'elaborative_interrogation', 'analogy'],
  social_interpersonal: ['socratic', 'teach_back', 'project_based', 'storytelling'],
  solitary_intrapersonal: ['pomodoro', 'spaced_rep', 'cornell_notes', 'memory_palace'],
  naturalistic: ['project_based', 'storytelling', 'analogy', 'feynman'],
};

export const STYLE_CONTENT_FORMATS: Record<LearningStyleCode, string[]> = {
  visual_spatial: ['video', 'diagram', 'infographic', 'animation', 'mind_map'],
  auditory_musical: ['audio', 'podcast', 'lecture', 'discussion', 'song'],
  reading_writing: ['text', 'article', 'notes', 'essay', 'glossary'],
  kinesthetic_tactile: ['interactive', 'hands_on', 'experiment', 'simulation', 'game'],
  logical_mathematical: ['problem_set', 'proof', 'flowchart', 'data', 'coding'],
  social_interpersonal: ['group_activity', 'discussion', 'debate', 'peer_review', 'presentation'],
  solitary_intrapersonal: ['self_paced', 'journal', 'reflection', 'solo_project', 'meditation'],
  naturalistic: ['field_trip', 'observation', 'real_world', 'nature_study', 'outdoor'],
};
