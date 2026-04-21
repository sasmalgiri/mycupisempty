import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { IP_AFFILIATION_RULES } from '@/lib/legal-prompts';

// Grok (xAI) API configuration
const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

interface QuestionCriteria {
  subject_id: string;
  chapter_ids: string[];
  total_marks: number;
  duration_minutes: number;
  difficulty_distribution: { easy: number; medium: number; hard: number };
  bloom_distribution: Record<string, number>;
  question_type_mix: { mcq: number; short_answer: number; long_answer: number; true_false: number };
  class_level: number;
  title: string;
}

function scoreQuestion(question: any, criteria: QuestionCriteria): number {
  let score = 0;
  const { difficulty_distribution, bloom_distribution, question_type_mix } = criteria;

  // Score based on difficulty match
  const difficultyWeight = difficulty_distribution[question.difficulty as keyof typeof difficulty_distribution] || 0;
  score += difficultyWeight * 2;

  // Score based on bloom level match
  const bloomWeight = bloom_distribution[question.bloom_level] || 0;
  score += bloomWeight * 1.5;

  // Score based on question type match
  const typeWeight = question_type_mix[question.question_type as keyof typeof question_type_mix] || 0;
  score += typeWeight;

  return score;
}

async function generateQuestionsWithAI(
  neededCount: number,
  criteria: QuestionCriteria,
  existingTopics: string[]
): Promise<any[]> {
  try {
    const prompt = `${IP_AFFILIATION_RULES}

Generate ${neededCount} ORIGINAL exam questions (never reproduce questions from any existing textbook, question paper, or board exam — write fresh questions using general educational knowledge) in JSON format for a Class ${criteria.class_level} student.
Topics: ${existingTopics.join(', ')}
Total marks needed: ${criteria.total_marks}
Difficulty distribution: Easy ${criteria.difficulty_distribution.easy}%, Medium ${criteria.difficulty_distribution.medium}%, Hard ${criteria.difficulty_distribution.hard}%
Question types needed: ${Object.entries(criteria.question_type_mix).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}%`).join(', ')}

Return ONLY a JSON array where each object has:
- "question_text": the question string
- "question_type": one of "mcq", "short_answer", "long_answer", "true_false"
- "marks": number (1-5)
- "difficulty": "easy", "medium", or "hard"
- "bloom_level": one of "remember", "understand", "apply", "analyze", "evaluate", "create"
- "options": array of 4 strings (for mcq only, null otherwise)
- "correct_answer": the correct answer string
- "explanation": brief explanation

Return ONLY the JSON array, no other text.`;

    if (!XAI_API_KEY) return [];

    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Please generate the exam questions now.' },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const questions = JSON.parse(jsonMatch[0]);
    return Array.isArray(questions) ? questions : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // List teacher's generated papers
    const { data: papers, error } = await supabase
      .from('generated_papers')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: papers || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'delete') {
      const { paper_id } = body;
      const { error } = await supabase
        .from('generated_papers')
        .delete()
        .eq('id', paper_id)
        .eq('teacher_id', user.id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Default action: generate paper
    const criteria: QuestionCriteria = {
      subject_id: body.subject_id,
      chapter_ids: body.chapter_ids || [],
      total_marks: body.total_marks || 100,
      duration_minutes: body.duration_minutes || 180,
      difficulty_distribution: body.difficulty_distribution || { easy: 30, medium: 50, hard: 20 },
      bloom_distribution: body.bloom_distribution || { remember: 20, understand: 25, apply: 25, analyze: 15, evaluate: 10, create: 5 },
      question_type_mix: body.question_type_mix || { mcq: 30, short_answer: 30, long_answer: 30, true_false: 10 },
      class_level: body.class_level || 6,
      title: body.title || 'Question Paper',
    };

    // Step 1: Query questions from DB filtered by topic_ids
    let topicIds: string[] = [];
    if (criteria.chapter_ids.length > 0) {
      const { data: topics } = await supabase
        .from('topics')
        .select('id, title')
        .in('chapter_id', criteria.chapter_ids);
      topicIds = (topics || []).map((t: any) => t.id);
    }

    let dbQuestions: any[] = [];
    if (topicIds.length > 0) {
      const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .in('topic_id', topicIds)
        .eq('is_active', true);
      dbQuestions = questions || [];
    }

    // Step 2: Score each question
    const scoredQuestions = dbQuestions.map((q: any) => ({
      ...q,
      fit_score: scoreQuestion(q, criteria),
    }));
    scoredQuestions.sort((a: any, b: any) => b.fit_score - a.fit_score);

    // Step 3: Select questions to match total_marks
    const selectedQuestions: any[] = [];
    let currentMarks = 0;

    for (const q of scoredQuestions) {
      if (currentMarks >= criteria.total_marks) break;
      const qMarks = q.marks || 1;
      if (currentMarks + qMarks <= criteria.total_marks) {
        selectedQuestions.push(q);
        currentMarks += qMarks;
      }
    }

    // Step 4: If not enough, generate with AI
    if (currentMarks < criteria.total_marks) {
      const neededMarks = criteria.total_marks - currentMarks;
      const estimatedCount = Math.ceil(neededMarks / 2); // avg 2 marks per question

      const { data: topicNames } = await supabase
        .from('topics')
        .select('title')
        .in('id', topicIds.length > 0 ? topicIds : ['']);

      const topicList = (topicNames || []).map((t: any) => t.title);

      const aiQuestions = await generateQuestionsWithAI(estimatedCount, criteria, topicList);

      for (const q of aiQuestions) {
        if (currentMarks >= criteria.total_marks) break;
        const qMarks = q.marks || 2;
        if (currentMarks + qMarks <= criteria.total_marks + 2) {
          selectedQuestions.push({ ...q, ai_generated: true });
          currentMarks += qMarks;
        }
      }
    }

    // Step 5: Build answer key
    const answerKey = selectedQuestions.map((q: any, i: number) => ({
      question_number: i + 1,
      correct_answer: q.correct_answer || q.answer,
      explanation: q.explanation || '',
      marks: q.marks || 1,
    }));

    // Step 6: Organize questions into sections
    const sections: any[] = [];
    const mcqs = selectedQuestions.filter((q: any) => q.question_type === 'mcq' || q.type === 'mcq');
    const trueFalse = selectedQuestions.filter((q: any) => q.question_type === 'true_false' || q.type === 'true_false');
    const shortAnswer = selectedQuestions.filter((q: any) => q.question_type === 'short_answer' || q.type === 'short_answer');
    const longAnswer = selectedQuestions.filter((q: any) => q.question_type === 'long_answer' || q.type === 'long_answer');
    const other = selectedQuestions.filter(
      (q: any) => !['mcq', 'true_false', 'short_answer', 'long_answer'].includes(q.question_type || q.type)
    );

    if (mcqs.length > 0) sections.push({ title: 'Section A: Multiple Choice Questions', questions: mcqs });
    if (trueFalse.length > 0) sections.push({ title: 'Section B: True/False', questions: trueFalse });
    if (shortAnswer.length > 0) sections.push({ title: 'Section C: Short Answer Questions', questions: shortAnswer });
    if (longAnswer.length > 0) sections.push({ title: 'Section D: Long Answer Questions', questions: longAnswer });
    if (other.length > 0) sections.push({ title: 'Section E: Other Questions', questions: other });

    const paper = {
      title: criteria.title,
      total_marks: currentMarks,
      duration_minutes: criteria.duration_minutes,
      class_level: criteria.class_level,
      sections,
      answer_key: answerKey,
      question_count: selectedQuestions.length,
    };

    // Step 7: Save to generated_papers table
    const { data: savedPaper, error } = await supabase
      .from('generated_papers')
      .insert({
        teacher_id: user.id,
        title: criteria.title,
        subject_id: criteria.subject_id || null,
        chapter_ids: criteria.chapter_ids || [],
        total_marks: currentMarks,
        duration_minutes: criteria.duration_minutes,
        difficulty_distribution: criteria.difficulty_distribution,
        bloom_distribution: criteria.bloom_distribution,
        question_type_mix: criteria.question_type_mix,
        questions: selectedQuestions,
        answer_key: answerKey,
        class_level: criteria.class_level,
        classroom_id: body.classroom_id || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        ...savedPaper,
        paper,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
