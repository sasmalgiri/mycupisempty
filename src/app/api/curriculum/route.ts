import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase';

// GET /api/curriculum - Get curriculum structure
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);

    // ---------------------------------------------------------------------
    // action=* — the CURRICULUM schema (curriculum_subjects_by_class →
    // curriculum_chapters → curriculum_topics), which is where the seeded
    // syllabus actually lives. The legacy branches below read
    // classes/subjects/chapters/topics from migration 001; no migration ever
    // inserts a row into those, so they return empty.
    //
    // Kept as a separate `action` branch so the existing ?class= / ?subjectId=
    // / ?chapterId= callers are untouched.
    // ---------------------------------------------------------------------
    const action = searchParams.get('action');

    if (action === 'subjects') {
      const classLevel = parseInt(searchParams.get('classLevel') || '0', 10);
      if (!classLevel) {
        return NextResponse.json({ error: 'classLevel required' }, { status: 400 });
      }
      const { data, error } = await (supabase as any)
        .from('curriculum_subjects_by_class')
        .select('id, subject_slug, board_code, class_level, language, textbook_title_en, textbook_title_native, total_chapters')
        .eq('class_level', classLevel)
        .order('subject_slug');
      if (error) throw error;

      const subjects = (data || []).map((s: any) => ({
        ...s,
        // One label a teacher can pick from unambiguously — the same subject
        // often exists under several boards and languages.
        label: [
          s.subject_slug.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          s.board_code ? `· ${s.board_code.toUpperCase()}` : '',
          s.language && s.language !== 'en' ? `(${s.language})` : '',
        ].filter(Boolean).join(' '),
      }));
      return NextResponse.json({ subjects });
    }

    if (action === 'chapters') {
      const subjectClassId = searchParams.get('subjectClassId');
      if (!subjectClassId) {
        return NextResponse.json({ error: 'subjectClassId required' }, { status: 400 });
      }
      const { data, error } = await (supabase as any)
        .from('curriculum_chapters')
        .select('id, chapter_no, title_en, title_native, maturity_band, exam_weight_pct')
        .eq('subject_class_id', subjectClassId)
        .order('chapter_no');
      if (error) throw error;
      return NextResponse.json({ chapters: data || [] });
    }

    const classNumber = searchParams.get('class');
    const subjectId = searchParams.get('subject');
    const chapterId = searchParams.get('chapter');

    // Get all classes
    if (!classNumber) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: classes, error } = await (supabase as any)
        .from('classes')
        .select('*')
        .order('class_number');

      if (error) throw error;
      return NextResponse.json({ classes });
    }

    // Get subjects for a class
    if (classNumber && !subjectId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: classData } = await (supabase as any)
        .from('classes')
        .select('id')
        .eq('class_number', parseInt(classNumber))
        .single();

      if (!classData) {
        return NextResponse.json({ error: 'Class not found' }, { status: 404 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: subjects, error } = await (supabase as any)
        .from('subjects')
        .select(`
          *,
          chapters:chapters(count)
        `)
        .eq('class_id', classData.id);

      if (error) throw error;
      return NextResponse.json({ subjects });
    }

    // Get chapters for a subject
    if (subjectId && !chapterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: chapters, error } = await (supabase as any)
        .from('chapters')
        .select(`
          *,
          topics:topics(count)
        `)
        .eq('subject_id', subjectId)
        .order('chapter_number');

      if (error) throw error;
      return NextResponse.json({ chapters });
    }

    // Get topics for a chapter
    if (chapterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: topics, error } = await (supabase as any)
        .from('topics')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('topic_number');

      if (error) throw error;

      // Also get learning content for the topics
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topicIds = topics?.map((t: any) => t.id) || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: content } = await (supabase as any)
        .from('learning_content')
        .select('*')
        .in('topic_id', topicIds);

      return NextResponse.json({
        topics,
        content: content || [],
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch (error: any) {
    console.error('Curriculum API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch curriculum', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/curriculum/seed - Seed curriculum data (admin only)
export async function POST(request: NextRequest) {
  try {
    // Protect this endpoint: it uses the service-role key (bypasses RLS)
    const authHeader = request.headers.get('authorization') || '';
    const seedToken = process.env.SEED_ADMIN_TOKEN;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Prefer a dedicated token, but allow service-role key for backward-compat with docs.
    const allowedTokens = [seedToken, serviceRoleKey].filter(Boolean) as string[];
    const isAuthorized = allowedTokens.some((token) => authHeader === `Bearer ${token}`);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const body = await request.json();
    const { action } = body;

    if (action !== 'seed') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Seed classes 1-12
    const classes = Array.from({ length: 12 }, (_, i) => ({
      class_number: i + 1,
      name: `Class ${i + 1}`,
      description: `कक्षा ${i + 1}`,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedClasses, error: classError } = await (supabase as any)
      .from('classes')
      .upsert(classes, { onConflict: 'class_number' })
      .select();

    if (classError) throw classError;

    // Sample subjects for Class 6
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const class6 = insertedClasses?.find((c: any) => c.class_number === 6);
    if (class6) {
      const subjects = [
        { name: 'Mathematics', name_hindi: 'गणित', code: 'MATH', icon: '📐', color: '#6366F1', book_title: 'Ganit', book_code: 'femh1' },
        { name: 'Science', name_hindi: 'विज्ञान', code: 'SCI', icon: '🔬', color: '#8B5CF6', book_title: 'Vigyan', book_code: 'fesc1' },
        { name: 'English', name_hindi: 'अंग्रेज़ी', code: 'ENG', icon: '📖', color: '#EC4899', book_title: 'Honeysuckle', book_code: 'fehl1' },
        { name: 'Hindi', name_hindi: 'हिंदी', code: 'HIN', icon: '📝', color: '#F97316', book_title: 'Vasant', book_code: 'fhvs1' },
        { name: 'Social Science', name_hindi: 'सामाजिक विज्ञान', code: 'SST', icon: '🌍', color: '#14B8A6', book_title: 'Social Science', book_code: 'fess1' },
      ];

      for (const subject of subjects) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: insertedSubject, error: subjectError } = await (supabase as any)
          .from('subjects')
          .upsert({
            class_id: class6.id,
            ...subject,
          }, { onConflict: 'class_id,code' })
          .select()
          .single();

        if (subjectError) {
          console.error('Subject error:', subjectError);
          continue;
        }

        // Add sample chapters for Mathematics
        if (subject.code === 'MATH' && insertedSubject) {
          const chapters = [
            { chapter_number: 1, title: 'Patterns in Mathematics', title_hindi: 'गणित में पैटर्न' },
            { chapter_number: 2, title: 'Lines and Angles', title_hindi: 'रेखाएं और कोण' },
            { chapter_number: 3, title: 'Number Play', title_hindi: 'संख्या खेल' },
            { chapter_number: 4, title: 'Data Handling and Presentation', title_hindi: 'आंकड़ों का प्रबंधन' },
            { chapter_number: 5, title: 'Prime Time', title_hindi: 'अभाज्य समय' },
            { chapter_number: 6, title: 'Perimeter and Area', title_hindi: 'परिमाप और क्षेत्रफल' },
            { chapter_number: 7, title: 'Fractions', title_hindi: 'भिन्न' },
            { chapter_number: 8, title: 'Playing with Constructions', title_hindi: 'रचनाओं के साथ खेलना' },
            { chapter_number: 9, title: 'Symmetry', title_hindi: 'समरूपता' },
            { chapter_number: 10, title: 'The Other Side of Zero', title_hindi: 'शून्य का दूसरा पक्ष' },
          ];

          for (const chapter of chapters) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('chapters')
              .upsert({
                subject_id: insertedSubject.id,
                ...chapter,
                ncert_pdf_url: `https://ncert.nic.in/textbook.php?${subject.book_code}=${String(chapter.chapter_number).padStart(2, '0')}`,
              }, { onConflict: 'subject_id,chapter_number' });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Curriculum seeded successfully',
      classesCreated: insertedClasses?.length || 0,
    });

  } catch (error: any) {
    console.error('Seed Error:', error);
    return NextResponse.json(
      { error: 'Failed to seed curriculum', details: error.message },
      { status: 500 }
    );
  }
}
