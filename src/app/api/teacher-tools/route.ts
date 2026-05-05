/**
 * Teacher AI tools — MagicSchool-style assistants. Free for teachers; the
 * student funnel is the upside.
 *
 * Tools (POST { tool, params }):
 *
 *   ai_resistant_assignment   → generates a homework prompt designed to be
 *                                hard for ChatGPT to one-shot (forces the
 *                                student to apply context the model can't see)
 *   misconception_radar       → given a topic, list common student
 *                                misconceptions + remediation hooks
 *   lesson_plan               → 40-min lesson plan for a class+topic
 *   group_jam_question        → live whole-class question + 4 distractors
 *                                designed to surface misconceptions
 *
 * The actual generation calls the AI provider you have wired (OpenAI / Anthropic).
 * This commit implements the tool registry + a deterministic fallback so the
 * routes work clean today; swap the fallback for a real call when the key is
 * configured.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const TOOLS = ['ai_resistant_assignment', 'misconception_radar', 'lesson_plan', 'group_jam_question'];

interface ToolResult {
  output: string;
  notes?: string;
}

function fallback(tool: string, params: any): ToolResult {
  const subject = params?.subject || 'the subject';
  const topic = params?.topic || 'today\'s topic';
  const klass = params?.classLevel || '8';

  switch (tool) {
    case 'ai_resistant_assignment':
      return {
        output: [
          `# Assignment — ${topic} (Class ${klass}, AI-resistant)`,
          ``,
          `Each student must:`,
          `1. Bring ONE example from their own life or local environment that maps to ${topic}.`,
          `2. Photograph it (with caption) and explain why it fits.`,
          `3. Solve a numerical sub-problem you draw from the example by hand.`,
          ``,
          `**Why this resists ChatGPT:** the local-context evidence is private to the student and impossible for an LLM to fabricate without inventing facts. Marks are weighted 50% on the explanation of the local example, 50% on the worked solution.`,
        ].join('\n'),
        notes: 'Tune the local-context requirement to your students\' surroundings.',
      };
    case 'misconception_radar':
      return {
        output: [
          `# Common misconceptions — ${topic}`,
          ``,
          `Pick up to 3 to address explicitly in your next class:`,
          ``,
          `1. **Surface confusion:** students often conflate ${topic} with a similar-looking concept. Probe by asking for a counter-example.`,
          `2. **Procedural error:** they execute the steps but don't know *why* a step is needed.`,
          `3. **Intuitive misconception:** an everyday model that contradicts the science (e.g. friction = bad / heavier-falls-faster).`,
          ``,
          `Remediation: predict-then-reveal questions, plus 1-minute pairs explaining to each other.`,
        ].join('\n'),
        notes: 'Replace with subject-specific misconception list once curriculum data is wired.',
      };
    case 'lesson_plan':
      return {
        output: [
          `# 40-min lesson — ${topic} (Class ${klass}, ${subject})`,
          ``,
          `**0-5 min:** prequestion warm-up (2 questions about ${topic} the lesson will answer)`,
          `**5-15 min:** worked example with backward fading`,
          `**15-25 min:** interleaved practice — 6 problems across 3 sub-topics`,
          `**25-35 min:** group jam — 1 question, whole class, real-time misconception check`,
          `**35-40 min:** exit ticket — 1 transfer question`,
          ``,
          `Materials: any concept card; suggested manipulable for ${topic} from /api/manipulables.`,
        ].join('\n'),
      };
    case 'group_jam_question':
      return {
        output: [
          `# Group jam — ${topic}`,
          ``,
          `Project this at the front. Give 90 seconds for silent thought, then poll.`,
          ``,
          `**Q:** [insert MCQ here based on a common misconception in ${topic}]`,
          `(a) [correct option]`,
          `(b) [the misconception students typically reach for]`,
          `(c) [a partial-correct distractor]`,
          `(d) [a 'sounds smart but wrong' distractor]`,
          ``,
          `Misconception revealed by (b): [brief explanation].`,
        ].join('\n'),
        notes: 'Wire to AI provider for full draft generation.',
      };
  }
  return { output: 'Unknown tool.' };
}

export async function POST(req: Request) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Role check: teachers + admins only.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Teacher account required' }, { status: 403 });
    }

    const body = await req.json();
    const tool = body.tool;
    if (!TOOLS.includes(tool)) return NextResponse.json({ error: 'Unknown tool' }, { status: 400 });

    const result = fallback(tool, body.params || {});
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true, tools: TOOLS });
}
