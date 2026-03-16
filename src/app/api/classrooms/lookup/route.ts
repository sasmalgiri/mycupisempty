import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

    if (code.length !== 6) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const admin = createAdminClient();
    // Use admin so we don't need a public SELECT policy on classrooms.
    const { data: classroom, error } = await (admin as any)
      .from('classrooms')
      .select('name, class_level, is_active, invite_code_expires_at')
      .eq('invite_code', code)
      .single();

    if (error || !classroom) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    if (!classroom.is_active) {
      return NextResponse.json({ error: 'This classroom is no longer active' }, { status: 410 });
    }

    if (classroom.invite_code_expires_at && new Date(classroom.invite_code_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invite code has expired' }, { status: 410 });
    }

    return NextResponse.json({
      name: classroom.name,
      class_level: classroom.class_level,
    });
  } catch (error: any) {
    console.error('Classroom lookup error:', error);
    return NextResponse.json({ error: 'Failed to lookup classroom' }, { status: 500 });
  }
}
