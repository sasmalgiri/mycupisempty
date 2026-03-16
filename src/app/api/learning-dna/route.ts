import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all assessment data in parallel
    const [vark, gardner, kolb, aptitudes, dna] = await Promise.all([
      supabase.from('learning_styles').select('*').eq('user_id', user.id).single(),
      supabase.from('multiple_intelligences').select('*').eq('user_id', user.id).single(),
      supabase.from('kolb_styles').select('*').eq('user_id', user.id).single(),
      supabase.from('subject_aptitude').select('*').eq('user_id', user.id),
      supabase.from('learning_dna').select('*').eq('user_id', user.id).single(),
    ]);

    // Compute profile completeness
    let completeness = 0;
    if (vark.data) completeness += 25;
    if (gardner.data) completeness += 25;
    if (kolb.data) completeness += 25;
    if (aptitudes.data && aptitudes.data.length > 0) completeness += 25;

    // Compute top 3 Gardner intelligences
    let gardnerTop3: string[] = [];
    if (gardner.data) {
      const scores = Object.entries(gardner.data)
        .filter(([k]) => !['id', 'user_id', 'assessed_at', 'created_at', 'updated_at'].includes(k))
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3);
      gardnerTop3 = scores.map(([k]) => k);
    }

    // Build full profile
    const fullDNA = {
      ...(dna.data || {}),
      user_id: user.id,
      vark_primary: vark.data?.primary_style || null,
      gardner_top_3: gardnerTop3,
      kolb_type: kolb.data?.kolb_type || null,
      profile_completeness: completeness,
      vark_scores: vark.data ? {
        visual: vark.data.visual,
        auditory: vark.data.auditory,
        reading: vark.data.reading,
        kinesthetic: vark.data.kinesthetic,
      } : undefined,
      kolb_scores: kolb.data ? {
        ce: kolb.data.concrete_experience,
        ro: kolb.data.reflective_observation,
        ac: kolb.data.abstract_conceptualization,
        ae: kolb.data.active_experimentation,
      } : undefined,
      gardner_scores: gardner.data ? {
        logical_mathematical: gardner.data.logical_mathematical,
        linguistic: gardner.data.linguistic,
        spatial: gardner.data.spatial,
        musical: gardner.data.musical,
        bodily_kinesthetic: gardner.data.bodily_kinesthetic,
        interpersonal: gardner.data.interpersonal,
        intrapersonal: gardner.data.intrapersonal,
        naturalistic: gardner.data.naturalistic,
      } : undefined,
      subject_aptitudes: aptitudes.data || [],
    };

    // Upsert the computed DNA
    await supabase.from('learning_dna').upsert({
      user_id: user.id,
      vark_primary: fullDNA.vark_primary,
      gardner_top_3: gardnerTop3,
      kolb_type: fullDNA.kolb_type,
      profile_completeness: completeness,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true, data: fullDNA });
  } catch (error: any) {
    console.error('Learning DNA error:', error);
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient() as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();

    const { error } = await supabase
      .from('learning_dna')
      .upsert({
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
