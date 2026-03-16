import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const inviteCode = (body?.inviteCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

    if (inviteCode.length !== 6) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Find classroom by invite code
    const { data: classroom, error: classroomError } = await (admin as any)
      .from('classrooms')
      .select('id, max_students, is_active, invite_code_expires_at')
      .eq('invite_code', inviteCode)
      .single();

    if (classroomError || !classroom) {
      return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 404 });
    }

    if (!classroom.is_active) {
      return NextResponse.json({ error: 'This classroom is no longer active' }, { status: 410 });
    }

    if (classroom.invite_code_expires_at && new Date(classroom.invite_code_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invite code has expired' }, { status: 410 });
    }

    // Check existing enrollment
    const { data: existingEnrollment } = await (admin as any)
      .from('classroom_enrollments')
      .select('id, status')
      .eq('classroom_id', classroom.id)
      .eq('student_id', user.id)
      .maybeSingle();

    if (existingEnrollment) {
      if (existingEnrollment.status === 'active') {
        return NextResponse.json({ error: 'You are already enrolled in this classroom' }, { status: 409 });
      }
      if (existingEnrollment.status === 'removed') {
        return NextResponse.json({ error: 'You were removed from this classroom' }, { status: 403 });
      }

      // Re-enroll
      const { error: updateError } = await (supabase as any)
        .from('classroom_enrollments')
        .update({ status: 'active', joined_at: new Date().toISOString() })
        .eq('id', existingEnrollment.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({ success: true });
    }

    // Check capacity (requires admin due to RLS)
    const { count: currentStudents, error: countError } = await (admin as any)
      .from('classroom_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('classroom_id', classroom.id)
      .eq('status', 'active');

    if (countError) {
      throw countError;
    }

    if (currentStudents && classroom.max_students && currentStudents >= classroom.max_students) {
      return NextResponse.json({ error: 'This classroom is full' }, { status: 409 });
    }

    // Enroll student (use user-scoped client so RLS still applies)
    const { error: enrollError } = await (supabase as any)
      .from('classroom_enrollments')
      .insert({
        classroom_id: classroom.id,
        student_id: user.id,
        status: 'active',
      });

    if (enrollError) {
      throw enrollError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Join classroom error:', error);
    return NextResponse.json({ error: 'Failed to join classroom', details: error.message }, { status: 500 });
  }
}
