/**
 * Database Seeding Script for MyCupIsEmpty
 * 
 * This script populates the Supabase database with:
 * 1. NCERT curriculum structure (Classes 1-12)
 * 2. Subjects and chapters
 * 3. Sample topics and content
 * 4. Question bank with Bloom's taxonomy levels
 * 5. Achievements and gamification data
 * 
 * Usage: npm run seed
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// CURRICULUM DATA
// ============================================

const classes = [
  { class_number: 1, name: 'Class 1', board: 'CBSE' },
  { class_number: 2, name: 'Class 2', board: 'CBSE' },
  { class_number: 3, name: 'Class 3', board: 'CBSE' },
  { class_number: 4, name: 'Class 4', board: 'CBSE' },
  { class_number: 5, name: 'Class 5', board: 'CBSE' },
  { class_number: 6, name: 'Class 6', board: 'CBSE' },
  { class_number: 7, name: 'Class 7', board: 'CBSE' },
  { class_number: 8, name: 'Class 8', board: 'CBSE' },
  { class_number: 9, name: 'Class 9', board: 'CBSE' },
  { class_number: 10, name: 'Class 10', board: 'CBSE' },
  { class_number: 11, name: 'Class 11', board: 'CBSE' },
  { class_number: 12, name: 'Class 12', board: 'CBSE' },
];

const subjectsData: Record<number, { name: string; icon: string; color: string }[]> = {
  1: [
    { name: 'Mathematics', icon: '📐', color: '#6366F1' },
    { name: 'English', icon: '📖', color: '#EC4899' },
    { name: 'Hindi', icon: '📝', color: '#F97316' },
    { name: 'EVS', icon: '🌿', color: '#22C55E' },
  ],
  6: [
    { name: 'Mathematics', icon: '📐', color: '#6366F1' },
    { name: 'Science', icon: '🔬', color: '#8B5CF6' },
    { name: 'English', icon: '📖', color: '#EC4899' },
    { name: 'Hindi', icon: '📝', color: '#F97316' },
    { name: 'Social Science', icon: '🌍', color: '#14B8A6' },
  ],
  10: [
    { name: 'Mathematics', icon: '📐', color: '#6366F1' },
    { name: 'Science', icon: '🔬', color: '#8B5CF6' },
    { name: 'English', icon: '📖', color: '#EC4899' },
    { name: 'Hindi', icon: '📝', color: '#F97316' },
    { name: 'Social Science', icon: '🌍', color: '#14B8A6' },
  ],
};

// Class 6 Mathematics Chapters (Complete)
const class6MathChapters = [
  {
    chapter_number: 1,
    name: 'Patterns in Mathematics',
    description: 'Explore number patterns, shape patterns, and sequences',
    topics: [
      { name: 'What are Patterns?', order_index: 1, content: 'A pattern is something that repeats in a predictable way...' },
      { name: 'Number Patterns', order_index: 2, content: 'Number patterns follow rules. Look at this: 1, 4, 7, 10, 13...' },
      { name: 'Visual Patterns', order_index: 3, content: 'Patterns can also be visual. Think of a chessboard...' },
      { name: 'Sequences', order_index: 4, content: 'A sequence is an ordered list of numbers following a pattern...' },
    ],
  },
  {
    chapter_number: 2,
    name: 'Lines and Angles',
    description: 'Understanding lines, rays, segments, and measuring angles',
    topics: [
      { name: 'Understanding Lines', order_index: 1, content: 'A line extends forever in both directions...' },
      { name: 'Types of Angles', order_index: 2, content: 'Angles are measured in degrees...' },
      { name: 'Measuring Angles', order_index: 3, content: 'We use a protractor to measure angles...' },
    ],
  },
  {
    chapter_number: 3,
    name: 'Number Play',
    description: 'Explore place value, comparing numbers, and number tricks',
    topics: [
      { name: 'Place Value Magic', order_index: 1, content: 'In our number system, the position of a digit determines its value...' },
      { name: 'Number Tricks', order_index: 2, content: 'Did you know that any number multiplied by 9...' },
    ],
  },
  {
    chapter_number: 4,
    name: 'Data Handling and Presentation',
    description: 'Collecting, organizing, and representing data',
    topics: [
      { name: 'Collecting Data', order_index: 1, content: 'Data is information collected for a purpose...' },
      { name: 'Bar Graphs', order_index: 2, content: 'A bar graph uses rectangular bars to represent data...' },
      { name: 'Pictographs', order_index: 3, content: 'A pictograph uses pictures or symbols to represent data...' },
    ],
  },
  {
    chapter_number: 5,
    name: 'Prime Time',
    description: 'Prime numbers, composite numbers, factors, and multiples',
    topics: [
      { name: 'Prime Numbers', order_index: 1, content: 'A prime number has exactly two factors: 1 and itself...' },
      { name: 'Composite Numbers', order_index: 2, content: 'A composite number has more than two factors...' },
      { name: 'Factors and Multiples', order_index: 3, content: 'Factors divide a number exactly...' },
    ],
  },
  {
    chapter_number: 6,
    name: 'Perimeter and Area',
    description: 'Measuring the boundary and space covered by shapes',
    topics: [
      { name: 'Perimeter of Shapes', order_index: 1, content: 'Perimeter is the total length of the boundary...' },
      { name: 'Area of Rectangles', order_index: 2, content: 'Area of a rectangle = length × breadth...' },
      { name: 'Area of Squares', order_index: 3, content: 'Area of a square = side × side...' },
    ],
  },
  {
    chapter_number: 7,
    name: 'Fractions',
    description: 'Understanding, comparing, and operating with fractions',
    topics: [
      { name: 'What is a Fraction?', order_index: 1, content: 'A fraction represents a part of a whole...' },
      { name: 'Types of Fractions', order_index: 2, content: 'Proper fractions have numerator smaller than denominator...' },
      { name: 'Equivalent Fractions', order_index: 3, content: 'Equivalent fractions represent the same value...' },
      { name: 'Adding Fractions', order_index: 4, content: 'To add fractions with the same denominator...' },
      { name: 'Subtracting Fractions', order_index: 5, content: 'Subtraction of fractions follows similar rules...' },
      { name: 'Word Problems', order_index: 6, content: 'Apply fraction concepts to real-world scenarios...' },
    ],
  },
  {
    chapter_number: 8,
    name: 'Playing with Constructions',
    description: 'Using compass and ruler to construct shapes and angles',
    topics: [
      { name: 'Using Compass', order_index: 1, content: 'A compass is used to draw circles and arcs...' },
      { name: 'Drawing Circles', order_index: 2, content: 'To draw a circle, fix one point as center...' },
      { name: 'Constructing Angles', order_index: 3, content: 'We can construct specific angles using compass...' },
    ],
  },
  {
    chapter_number: 9,
    name: 'Symmetry',
    description: 'Understanding line symmetry and rotational symmetry',
    topics: [
      { name: 'Line Symmetry', order_index: 1, content: 'A figure has line symmetry if it can be folded...' },
      { name: 'Rotational Symmetry', order_index: 2, content: 'A figure has rotational symmetry if it looks the same...' },
    ],
  },
  {
    chapter_number: 10,
    name: 'The Other Side of Zero',
    description: 'Introduction to negative numbers and integers',
    topics: [
      { name: 'Negative Numbers', order_index: 1, content: 'Negative numbers are less than zero...' },
      { name: 'The Number Line', order_index: 2, content: 'Negative numbers are on the left of zero...' },
      { name: 'Adding Integers', order_index: 3, content: 'When adding integers with different signs...' },
    ],
  },
];

// Sample Questions for Class 6 Mathematics
const sampleQuestions = [
  {
    chapter_name: 'Fractions',
    questions: [
      {
        question_text: 'Ram has ½ of a pizza. If Shyam gives him ¼ more, how much pizza does Ram have now?',
        question_type: 'mcq',
        bloom_level: 'apply',
        difficulty: 'medium',
        options: ['½', '¾', '⅔', '1'],
        correct_answer: '¾',
        explanation: 'To add fractions with different denominators, find the LCM. LCM of 2 and 4 is 4. Convert ½ to 2/4. Now add: 2/4 + 1/4 = 3/4.',
        xp_value: 25,
      },
      {
        question_text: 'What happens when we multiply a fraction by 1?',
        question_type: 'mcq',
        bloom_level: 'understand',
        difficulty: 'easy',
        options: ['It becomes 0', 'It stays the same', 'It becomes 1', 'It doubles'],
        correct_answer: 'It stays the same',
        explanation: 'Any number multiplied by 1 remains unchanged. This is called the identity property of multiplication.',
        xp_value: 15,
      },
      {
        question_text: 'Compare: Which is greater - ⅔ or ¾?',
        question_type: 'mcq',
        bloom_level: 'analyze',
        difficulty: 'medium',
        options: ['⅔ is greater', '¾ is greater', 'They are equal', 'Cannot compare'],
        correct_answer: '¾ is greater',
        explanation: 'Convert to common denominator (12): ⅔ = 8/12, ¾ = 9/12. Since 9/12 > 8/12, therefore ¾ is greater.',
        xp_value: 30,
      },
      {
        question_text: 'In the fraction ⅝, what is the denominator?',
        question_type: 'mcq',
        bloom_level: 'remember',
        difficulty: 'easy',
        options: ['5', '8', '3', '13'],
        correct_answer: '8',
        explanation: 'The denominator is the bottom number in a fraction. It tells us how many equal parts the whole is divided into.',
        xp_value: 10,
      },
      {
        question_text: 'A recipe needs ¾ cup of sugar. You only have ½ cup. Is this enough?',
        question_type: 'mcq',
        bloom_level: 'evaluate',
        difficulty: 'hard',
        options: ['Yes, it is enough', 'No, need ¼ more', 'No, need ½ more', 'Cannot determine'],
        correct_answer: 'No, need ¼ more',
        explanation: '¾ - ½ = ¾ - 2/4 = 3/4 - 2/4 = ¼. You need ¼ cup more sugar to complete the recipe.',
        xp_value: 40,
      },
    ],
  },
];

// Achievements Data
const achievements = [
  // Learning
  { name: 'First Steps', description: 'Complete your first lesson', icon: '🎯', category: 'learning', xp_reward: 50, rarity: 'common', requirement: { type: 'lessons_completed', value: 1 } },
  { name: 'Scholar', description: 'Complete 10 lessons', icon: '📚', category: 'learning', xp_reward: 100, rarity: 'common', requirement: { type: 'lessons_completed', value: 10 } },
  { name: 'Bookworm', description: 'Complete 50 lessons', icon: '🐛', category: 'learning', xp_reward: 250, rarity: 'rare', requirement: { type: 'lessons_completed', value: 50 } },
  { name: 'Wisdom Master', description: 'Complete 100 lessons', icon: '🧙', category: 'learning', xp_reward: 500, rarity: 'epic', requirement: { type: 'lessons_completed', value: 100 } },
  
  // Streaks
  { name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', category: 'streak', xp_reward: 150, rarity: 'rare', requirement: { type: 'streak_days', value: 7 } },
  { name: 'Month Master', description: 'Maintain a 30-day streak', icon: '💪', category: 'streak', xp_reward: 500, rarity: 'epic', requirement: { type: 'streak_days', value: 30 } },
  { name: 'Year Legend', description: 'Maintain a 365-day streak', icon: '🏆', category: 'streak', xp_reward: 2000, rarity: 'legendary', requirement: { type: 'streak_days', value: 365 } },
  
  // Mastery
  { name: 'Perfectionist', description: 'Score 100% on any quiz', icon: '💯', category: 'mastery', xp_reward: 100, rarity: 'rare', requirement: { type: 'perfect_score', value: 1 } },
  { name: 'Chapter Champion', description: 'Master a complete chapter', icon: '🏅', category: 'mastery', xp_reward: 200, rarity: 'rare', requirement: { type: 'chapters_mastered', value: 1 } },
  { name: 'Subject Genius', description: 'Master all chapters in a subject', icon: '🎓', category: 'mastery', xp_reward: 1000, rarity: 'epic', requirement: { type: 'subjects_mastered', value: 1 } },
  
  // Questions
  { name: 'Question Starter', description: 'Answer 10 questions correctly', icon: '✅', category: 'questions', xp_reward: 50, rarity: 'common', requirement: { type: 'correct_answers', value: 10 } },
  { name: 'Quiz Master', description: 'Answer 100 questions correctly', icon: '🎯', category: 'questions', xp_reward: 200, rarity: 'rare', requirement: { type: 'correct_answers', value: 100 } },
  { name: 'Knowledge King', description: 'Answer 1000 questions correctly', icon: '👑', category: 'questions', xp_reward: 1000, rarity: 'legendary', requirement: { type: 'correct_answers', value: 1000 } },
  
  // Special
  { name: 'Early Bird', description: 'Study before 6 AM', icon: '🌅', category: 'special', xp_reward: 75, rarity: 'rare', requirement: { type: 'study_time', value: 'early' } },
  { name: 'Night Owl', description: 'Study after 10 PM', icon: '🦉', category: 'special', xp_reward: 75, rarity: 'rare', requirement: { type: 'study_time', value: 'late' } },
  { name: 'Speed Demon', description: 'Complete a quiz in under 2 minutes', icon: '⚡', category: 'special', xp_reward: 100, rarity: 'rare', requirement: { type: 'quiz_speed', value: 120 } },
];

// ============================================
// SEEDING FUNCTIONS
// ============================================

async function seedClasses() {
  console.log('📚 Seeding classes...');
  
  const { data, error } = await supabase
    .from('classes')
    .upsert(classes, { onConflict: 'class_number' })
    .select();
  
  if (error) {
    console.error('❌ Error seeding classes:', error);
    return null;
  }
  
  console.log(`✅ Seeded ${data.length} classes`);
  return data;
}

async function seedSubjects(classesData: any[]) {
  console.log('📖 Seeding subjects...');
  
  const subjects: any[] = [];
  
  for (const cls of classesData) {
    const classSubjects = subjectsData[cls.class_number] || subjectsData[6]; // Default to class 6 subjects
    
    for (const subject of classSubjects) {
      subjects.push({
        class_id: cls.id,
        name: subject.name,
        icon: subject.icon,
        color: subject.color,
      });
    }
  }
  
  const { data, error } = await supabase
    .from('subjects')
    .upsert(subjects, { onConflict: 'class_id,name' })
    .select();
  
  if (error) {
    console.error('❌ Error seeding subjects:', error);
    return null;
  }
  
  console.log(`✅ Seeded ${data.length} subjects`);
  return data;
}

async function seedChapters(subjectsData: any[]) {
  console.log('📑 Seeding chapters...');
  
  // Find Class 6 Mathematics
  const mathSubject = subjectsData.find(
    s => s.name === 'Mathematics' && s.class_id
  );
  
  if (!mathSubject) {
    console.log('⚠️ Class 6 Mathematics not found, skipping chapter seeding');
    return null;
  }
  
  const chapters = class6MathChapters.map(ch => ({
    subject_id: mathSubject.id,
    chapter_number: ch.chapter_number,
    name: ch.name,
    description: ch.description,
  }));
  
  const { data, error } = await supabase
    .from('chapters')
    .upsert(chapters, { onConflict: 'subject_id,chapter_number' })
    .select();
  
  if (error) {
    console.error('❌ Error seeding chapters:', error);
    return null;
  }
  
  console.log(`✅ Seeded ${data.length} chapters`);
  return data;
}

async function seedTopics(chaptersData: any[]) {
  console.log('📝 Seeding topics...');
  
  const topics: any[] = [];
  
  for (const chapter of chaptersData) {
    const chapterInfo = class6MathChapters.find(c => c.chapter_number === chapter.chapter_number);
    
    if (chapterInfo && chapterInfo.topics) {
      for (const topic of chapterInfo.topics) {
        topics.push({
          chapter_id: chapter.id,
          name: topic.name,
          order_index: topic.order_index,
          content: topic.content,
        });
      }
    }
  }
  
  if (topics.length === 0) {
    console.log('⚠️ No topics to seed');
    return null;
  }
  
  const { data, error } = await supabase
    .from('topics')
    .upsert(topics, { onConflict: 'chapter_id,order_index' })
    .select();
  
  if (error) {
    console.error('❌ Error seeding topics:', error);
    return null;
  }
  
  console.log(`✅ Seeded ${data.length} topics`);
  return data;
}

async function seedQuestions(chaptersData: any[]) {
  console.log('❓ Seeding questions...');
  
  const fractionsChapter = chaptersData.find(c => c.name === 'Fractions');
  
  if (!fractionsChapter) {
    console.log('⚠️ Fractions chapter not found, skipping question seeding');
    return null;
  }
  
  const questionsToSeed = sampleQuestions[0].questions.map(q => ({
    chapter_id: fractionsChapter.id,
    question_text: q.question_text,
    question_type: q.question_type,
    bloom_level: q.bloom_level,
    difficulty: q.difficulty,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    xp_value: q.xp_value,
  }));
  
  const { data, error } = await supabase
    .from('questions')
    .upsert(questionsToSeed)
    .select();
  
  if (error) {
    console.error('❌ Error seeding questions:', error);
    return null;
  }
  
  console.log(`✅ Seeded ${data.length} questions`);
  return data;
}

async function seedAchievements() {
  console.log('🏆 Seeding achievements...');
  
  const { data, error } = await supabase
    .from('achievements')
    .upsert(achievements, { onConflict: 'name' })
    .select();
  
  if (error) {
    console.error('❌ Error seeding achievements:', error);
    return null;
  }
  
  console.log(`✅ Seeded ${data.length} achievements`);
  return data;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('🚀 Starting database seeding...\n');
  
  try {
    // 1. Seed classes
    const classesData = await seedClasses();
    if (!classesData) throw new Error('Failed to seed classes');
    
    // 2. Seed subjects
    const subjects = await seedSubjects(classesData);
    if (!subjects) throw new Error('Failed to seed subjects');
    
    // 3. Seed chapters (Class 6 Math only for now)
    const chapters = await seedChapters(subjects);
    if (!chapters) throw new Error('Failed to seed chapters');
    
    // 4. Seed topics
    const topics = await seedTopics(chapters);
    
    // 5. Seed questions
    const questions = await seedQuestions(chapters);
    
    // 6. Seed achievements
    const achievementsData = await seedAchievements();
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Classes: ${classesData.length}`);
    console.log(`   - Subjects: ${subjects.length}`);
    console.log(`   - Chapters: ${chapters.length}`);
    console.log(`   - Topics: ${topics?.length || 0}`);
    console.log(`   - Questions: ${questions?.length || 0}`);
    console.log(`   - Achievements: ${achievementsData?.length || 0}`);
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
