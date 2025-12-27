import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase';

// GET /api/curriculum - Get curriculum structure
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    
    const classNumber = searchParams.get('class');
    const subjectId = searchParams.get('subject');
    const chapterId = searchParams.get('chapter');

    // Get all classes
    if (!classNumber) {
      const { data: classes, error } = await supabase
        .from('classes')
        .select('*')
        .order('class_number');

      if (error) throw error;
      return NextResponse.json({ classes });
    }

    // Get subjects for a class
    if (classNumber && !subjectId) {
      const { data: classData } = await supabase
        .from('classes')
        .select('id')
        .eq('class_number', parseInt(classNumber))
        .single();

      if (!classData) {
        return NextResponse.json({ error: 'Class not found' }, { status: 404 });
      }

      const { data: subjects, error } = await supabase
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
      const { data: chapters, error } = await supabase
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
      const { data: topics, error } = await supabase
        .from('topics')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('topic_number');

      if (error) throw error;

      // Also get learning content for the topics
      const topicIds = topics?.map(t => t.id) || [];
      const { data: content } = await supabase
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
    const supabase = createAdminClient();
    const body = await request.json();
    const { action } = body;

    if (action !== 'seed') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Seed classes 1-12
    const classes = Array.from({ length: 12 }, (_, i) => ({
      class_number: i + 1,
      display_name: `Class ${i + 1}`,
      display_name_hindi: `कक्षा ${i + 1}`,
    }));

    const { data: insertedClasses, error: classError } = await supabase
      .from('classes')
      .upsert(classes, { onConflict: 'class_number' })
      .select();

    if (classError) throw classError;

    // Sample subjects for Class 6
    const class6 = insertedClasses?.find(c => c.class_number === 6);
    if (class6) {
      const subjects = [
        { name: 'Mathematics', name_hindi: 'गणित', code: 'MATH', icon: '📐', color: '#6366F1', book_title: 'Ganit', book_code: 'femh1' },
        { name: 'Science', name_hindi: 'विज्ञान', code: 'SCI', icon: '🔬', color: '#8B5CF6', book_title: 'Vigyan', book_code: 'fesc1' },
        { name: 'English', name_hindi: 'अंग्रेज़ी', code: 'ENG', icon: '📖', color: '#EC4899', book_title: 'Honeysuckle', book_code: 'fehl1' },
        { name: 'Hindi', name_hindi: 'हिंदी', code: 'HIN', icon: '📝', color: '#F97316', book_title: 'Vasant', book_code: 'fhvs1' },
        { name: 'Social Science', name_hindi: 'सामाजिक विज्ञान', code: 'SST', icon: '🌍', color: '#14B8A6', book_title: 'Social Science', book_code: 'fess1' },
      ];

      for (const subject of subjects) {
        const { data: insertedSubject, error: subjectError } = await supabase
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
            await supabase
              .from('chapters')
              .upsert({
                subject_id: insertedSubject.id,
                ...chapter,
                pdf_url: `https://ncert.nic.in/textbook/pdf/${subject.book_code}${String(chapter.chapter_number).padStart(2, '0')}.pdf`,
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
