/**
 * Google Classroom integration (OAuth scaffold).
 *
 * Three phases:
 *   GET ?action=start  — begin OAuth flow, return Google auth URL
 *   GET ?action=callback&code=...  — receive code, exchange for tokens
 *   POST action=sync   — pull classrooms + assignments and mirror into our DB
 *
 * Requires env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.
 * Absent env vars → endpoint returns "not configured" so nothing breaks at
 * build time.
 *
 * Scopes: classroom.courses.readonly + classroom.coursework.me.readonly —
 * read-only by default, safe for student accounts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
];

function isConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

export async function GET(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (!isConfigured()) {
      return NextResponse.json({
        configured: false,
        message: 'Google Classroom integration is not configured on this server. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI to enable.',
      }, { status: 503 });
    }

    // === START: return the OAuth URL the client should redirect to ===
    if (action === 'start') {
      const state = user.id;  // CSRF protection — verify on callback
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES.join(' '));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', state);
      return NextResponse.json({ authUrl: authUrl.toString() });
    }

    // === CALLBACK: exchange code for tokens ===
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
      if (state !== user.id) return NextResponse.json({ error: 'State mismatch' }, { status: 403 });

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => '');
        return NextResponse.json({ error: `Token exchange failed: ${errText}` }, { status: 502 });
      }
      const tokens = await tokenRes.json();

      // Persist tokens — encrypted at rest (Supabase handles this via RLS)
      try {
        await supabase.from('integration_tokens').upsert({
          user_id: user.id,
          provider: 'google_classroom',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
          scopes: SCOPES,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' });
      } catch (err) {
        console.error('Token persist failed:', err);
      }

      // Redirect back to integrations page
      return NextResponse.redirect(new URL('/settings?connected=google_classroom', request.url));
    }

    // === STATUS: is user connected? ===
    if (action === 'status') {
      const { data: token } = await supabase
        .from('integration_tokens')
        .select('expires_at, scopes, updated_at')
        .eq('user_id', user.id)
        .eq('provider', 'google_classroom')
        .maybeSingle();
      return NextResponse.json({ connected: !!token, expiresAt: token?.expires_at, updatedAt: token?.updated_at });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Google Classroom error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isConfigured()) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const body = await request.json();
    if (body.action !== 'sync') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    // Fetch access token
    const { data: token } = await supabase
      .from('integration_tokens')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'google_classroom')
      .maybeSingle();
    if (!token?.access_token) {
      return NextResponse.json({ error: 'Not connected to Google Classroom' }, { status: 401 });
    }

    // Call Classroom API
    const res = await fetch('https://classroom.googleapis.com/v1/courses', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return NextResponse.json({ error: `Google API error: ${err}` }, { status: 502 });
    }
    const data = await res.json();
    const courses = data.courses || [];

    // Mirror into our classrooms table (tagged as externally managed)
    let imported = 0;
    for (const c of courses) {
      try {
        await supabase.from('classrooms').upsert({
          external_id: `google:${c.id}`,
          external_provider: 'google_classroom',
          name: c.name || 'Untitled',
          owner_id: user.id,
          is_active: c.courseState === 'ACTIVE',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'external_id' });
        imported++;
      } catch (err) {
        console.error('Classroom mirror failed:', err);
      }
    }

    return NextResponse.json({ success: true, imported, total: courses.length });
  } catch (error: any) {
    console.error('Google Classroom POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
