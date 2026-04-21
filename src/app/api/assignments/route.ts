/**
 * Assignment Generator API — per student × chapter × subject × style × profile.
 *
 * GET                       — list current assignments for student
 * POST action=generate      — AI generates a new assignment tied to specific chapter
 * POST action=submit        — student submits work, get AI grading + next-step feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildStudentState, generateAIContext } from '@/lib/student-state';
import { computeMaturity, adaptationForMaturity, BAND_INFO } from '@/lib/maturity';
import { getCompanionForSubject } from '@/lib/companion';
import { IP_AFFILIATION_RULES } from '@/lib/legal-prompts';
import { loadActiveDirectives, adaptationDelta, deltaToPromptBlock } from '@/lib/directive-adapter';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-3-mini';

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // pending | submitted | graded | all
    const subjectId = url.searchParams.get('subjectId');

    let query = supabase
      .from('assignments')
      .select('id, subject_id, chapter_id, title, assignment_data, status, grade, feedback, created_at, due_at, subjects(title), chapters(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (status && status !== 'all') query = query.eq('status', status);
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data } = await query;
    return NextResponse.json({ success: true, assignments: data || [] });
  } catch (error: any) {
    console.error('Assignments GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    // ============================================================
    // GENERATE — produce a personalized assignment for a chapter
    // ============================================================
    if (action === 'generate') {
      const { subjectId, chapterId, preferredTool } = body as {
        subjectId: string;
        chapterId?: string;
        preferredTool?: string;
      };
      if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 });
      if (!XAI_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

      // Gather context
      const [{ data: subject }, { data: chapter }, { data: profile }, { data: learningStyle }] = await Promise.all([
        supabase.from('subjects').select('id, title').eq('id', subjectId).maybeSingle(),
        chapterId
          ? supabase.from('chapters').select('id, title, description').eq('id', chapterId).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('profiles').select('current_class, board_code, full_name').eq('id', user.id).single().catch(() => ({ data: null })),
        supabase.from('learning_styles').select('dominant_style, style_scores').eq('user_id', user.id).maybeSingle(),
      ]);
      if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

      const state = await buildStudentState(supabase, user.id);
      const subjectState = state.subjectStates[subjectId];
      const classLevel = profile?.current_class || state.classLevel;
      const companion = getCompanionForSubject(subject.title);

      // Maturity
      let maturityContext = '';
      let maturityBand = 2;
      if (subjectState) {
        const mp = computeMaturity({
          userId: user.id,
          subjectId,
          subjectName: subject.title,
          subjectState,
          studentState: state,
          classLevel,
        });
        maturityBand = mp.band;
        const adapt = adaptationForMaturity(mp);
        const info = BAND_INFO[mp.band];
        maturityContext = `
MATURITY BAND: ${mp.band}/5 (${info.label})
- ${info.description}
- Task scope: ${adapt.taskScopeInstruction}
- Max steps: ${adapt.maxTaskSteps}
- Preferred question styles: ${adapt.questionStyles.join(', ')}
- Target difficulty: ${adapt.targetDifficulty}/10
- Scaffold: ${Math.round(adapt.scaffoldLevel * 100)}%`;
      }

      // Learning style context
      const dominantStyle = learningStyle?.dominant_style || 'visual';
      const styleHints: Record<string, string> = {
        visual: 'Include 1-2 visual cues (describe diagrams, ask for sketches, or use a graph plotter tool).',
        auditory: 'Include 1 "read aloud" or "explain in your own words" step.',
        reading: 'Include careful reading of a text passage or note-taking prompts.',
        kinesthetic: 'Include a hands-on lab or real-world experiment step.',
      };

      // Student intelligence context
      const studentIntel = generateAIContext(state, subjectId);

      // Main-brain directives — may cap task count, adjust difficulty, surface breakthroughs
      const directives = await loadActiveDirectives(supabase, user.id);
      const delta = adaptationDelta(directives, { forCompanionId: companion.id });
      const directiveBlock = deltaToPromptBlock(delta);

      const prompt = `${IP_AFFILIATION_RULES}
${directiveBlock ? '\n' + directiveBlock + '\n' : ''}
You are ${companion.name}, a teacher designing a personalized assignment using general educational knowledge only.

STUDENT:
- Name: ${profile?.full_name?.split(' ')[0] || 'student'}
- Class: ${classLevel}
- Board: ${profile?.board_code || 'CBSE'}
- Dominant learning style: ${dominantStyle}

SUBJECT: ${subject.title}
${chapter ? `CHAPTER: ${chapter.title}\n${chapter.description ? `Description: ${chapter.description}` : ''}` : 'CHAPTER: general'}

${maturityContext}

STYLE HINT: ${styleHints[dominantStyle] || styleHints.visual}

${studentIntel}

TASK:
Design ONE assignment with 3-5 tasks, scaled to the maturity band. Each task should:
- Build on the previous one
- Use the student's style preference
- Target a known misconception (if listed above) at least once
- Use Indian context (₹, Indian names, daily-life examples)

Return ONLY JSON, no prose:
{
  "title": "assignment title (max 60 chars)",
  "description": "one-paragraph overview",
  "estimatedMinutes": <number>,
  "tasks": [
    {
      "order": 1,
      "prompt": "the task the student does",
      "kind": "short_answer" | "numeric" | "equation" | "writing" | "lab" | "code" | "reflection",
      "hint": "optional hint",
      "rubric": "how success is judged",
      "tool": "optional — one of: graph_plotter, calculator, geometry, physics_pendulum, physics_projectile, physics_wave, physics_circuit, unit_converter, periodic_table, molecule_viewer, reaction_balancer, diagram_explorer, taxonomy_tree, writing, pronunciation, dictionary, reading_comprehension, timeline, india_map, chart_builder, code_sandbox, algorithm_viz"
    }
  ],
  "learningObjectives": ["1-2 clear objectives"],
  "stretchTask": "optional extra challenge for students who finish quickly (only for bands 3-5)"
}

${preferredTool ? `Preference: use the "${preferredTool}" tool in at least one task.` : ''}`;

      const aiResponse = await fetch(`${XAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}` },
        body: JSON.stringify({
          model: XAI_MODEL,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'Please generate the assignment now.' },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });
      if (!aiResponse.ok) {
        const err = await aiResponse.text().catch(() => '');
        return NextResponse.json({ error: `AI ${aiResponse.status}: ${err.slice(0, 200)}` }, { status: 502 });
      }
      const data = await aiResponse.json();
      const raw = data.choices?.[0]?.message?.content;
      const text = typeof raw === 'string' ? raw : '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: 'AI response unparseable' }, { status: 502 });
      let assignmentData: any;
      try { assignmentData = JSON.parse(match[0]); }
      catch { return NextResponse.json({ error: 'Invalid JSON in AI response' }, { status: 502 }); }

      // Persist
      let assignmentId: string | null = null;
      try {
        const { data: inserted } = await supabase.from('assignments').insert({
          user_id: user.id,
          subject_id: subjectId,
          chapter_id: chapterId || null,
          title: assignmentData.title?.slice(0, 100) || 'Assignment',
          assignment_data: assignmentData,
          maturity_band: maturityBand,
          learning_style: dominantStyle,
          status: 'pending',
          created_at: new Date().toISOString(),
        }).select('id').maybeSingle();
        assignmentId = inserted?.id || null;
      } catch (err) {
        console.error('Assignment persist failed:', err);
      }

      return NextResponse.json({ success: true, assignmentId, assignment: assignmentData, maturityBand });
    }

    // ============================================================
    // SUBMIT — submit work, AI grades
    // ============================================================
    if (action === 'submit') {
      const { assignmentId, submissions } = body as { assignmentId: string; submissions: Record<string, any> };
      if (!assignmentId || !submissions) {
        return NextResponse.json({ error: 'assignmentId and submissions required' }, { status: 400 });
      }
      if (!XAI_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

      const { data: assignment } = await supabase
        .from('assignments')
        .select('assignment_data, subject_id, subjects(title)')
        .eq('id', assignmentId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

      const tasks = assignment.assignment_data?.tasks || [];
      const subjectName = assignment.subjects?.title || 'this subject';

      const gradingPrompt = `${IP_AFFILIATION_RULES}

You are grading an assignment in ${subjectName} using general educational knowledge only.

ORIGINAL TASKS:
${JSON.stringify(tasks, null, 2)}

STUDENT SUBMISSIONS:
${JSON.stringify(submissions, null, 2)}

Grade each task and return ONLY JSON:
{
  "overallGrade": 0-100,
  "taskFeedback": [
    { "order": 1, "score": 0-100, "feedback": "specific, kind, honest", "suggestion": "one concrete thing to try next time" }
  ],
  "overallFeedback": "one paragraph: what they did well, what to grow next",
  "misconceptionDetected": "misconception name or null"
}

Be honest — don't inflate scores. But always end with encouragement. Respect the student's effort.`;

      const aiResponse = await fetch(`${XAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}` },
        body: JSON.stringify({
          model: XAI_MODEL,
          messages: [
            { role: 'system', content: gradingPrompt },
            { role: 'user', content: 'Please grade the submission now.' },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });
      if (!aiResponse.ok) {
        return NextResponse.json({ error: 'Grading AI failed' }, { status: 502 });
      }
      const data = await aiResponse.json();
      const raw = data.choices?.[0]?.message?.content;
      const text = typeof raw === 'string' ? raw : '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: 'AI grading response unparseable' }, { status: 502 });
      let grading: any;
      try { grading = JSON.parse(match[0]); }
      catch { return NextResponse.json({ error: 'Invalid grading JSON' }, { status: 502 }); }

      // Persist
      try {
        await supabase.from('assignments').update({
          status: 'graded',
          grade: grading.overallGrade,
          feedback: grading,
          submissions,
          graded_at: new Date().toISOString(),
        }).eq('id', assignmentId).eq('user_id', user.id);

        await supabase.from('xp_events').insert({
          user_id: user.id,
          source_pillar: 'academic',
          source_action: 'assignment_graded',
          source_id: assignmentId,
          xp_amount: Math.round((grading.overallGrade || 0) / 2),
          description: `Assignment graded: ${grading.overallGrade}%`,
        });

        // Feed misconception back as a signal
        if (grading.misconceptionDetected) {
          await supabase.from('learner_signals').insert({
            user_id: user.id,
            signal_type: 'error_pattern',
            category: 'performance',
            source: 'assignment_grader',
            subject_id: assignment.subject_id,
            value: 0,
            metadata: { misconception: grading.misconceptionDetected, via: 'assignment_grading' },
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Assignment grade persist failed:', err);
      }

      return NextResponse.json({ success: true, grading });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Assignments POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
