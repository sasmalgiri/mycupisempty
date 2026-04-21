/**
 * Microsoft Teams for Education integration (OAuth scaffold).
 *
 * Same shape as google-classroom/route.ts. Graph API endpoints differ.
 * Requires: MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI, MS_TENANT_ID
 * (or 'common' for multi-tenant).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const MS_CLIENT_ID = process.env.MS_CLIENT_ID || '';
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || '';
const MS_REDIRECT_URI = process.env.MS_REDIRECT_URI || '';
const MS_TENANT_ID = process.env.MS_TENANT_ID || 'common';

const SCOPES = [
  'offline_access',
  'User.Read',
  'EduRoster.ReadBasic',
  'EduAssignments.ReadBasic',
];

function isConfigured(): boolean {
  return Boolean(MS_CLIENT_ID && MS_CLIENT_SECRET && MS_REDIRECT_URI);
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
        message: 'Microsoft Teams integration is not configured. Add MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REDIRECT_URI, MS_TENANT_ID.',
      }, { status: 503 });
    }

    if (action === 'start') {
      const authUrl = new URL(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize`);
      authUrl.searchParams.set('client_id', MS_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', MS_REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES.join(' '));
      authUrl.searchParams.set('response_mode', 'query');
      authUrl.searchParams.set('state', user.id);
      return NextResponse.json({ authUrl: authUrl.toString() });
    }

    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
      if (state !== user.id) return NextResponse.json({ error: 'State mismatch' }, { status: 403 });

      const tokenRes = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MS_CLIENT_ID,
          client_secret: MS_CLIENT_SECRET,
          redirect_uri: MS_REDIRECT_URI,
          grant_type: 'authorization_code',
          code,
          scope: SCOPES.join(' '),
        }),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text().catch(() => '');
        return NextResponse.json({ error: `Token exchange failed: ${err}` }, { status: 502 });
      }
      const tokens = await tokenRes.json();

      try {
        await supabase.from('integration_tokens').upsert({
          user_id: user.id,
          provider: 'microsoft_teams',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
          scopes: SCOPES,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider' });
      } catch (err) {
        console.error('MS token persist failed:', err);
      }

      return NextResponse.redirect(new URL('/settings?connected=microsoft_teams', request.url));
    }

    if (action === 'status') {
      const { data: token } = await supabase
        .from('integration_tokens')
        .select('expires_at, scopes, updated_at')
        .eq('user_id', user.id)
        .eq('provider', 'microsoft_teams')
        .maybeSingle();
      return NextResponse.json({ connected: !!token, expiresAt: token?.expires_at, updatedAt: token?.updated_at });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('MS Teams error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase: any = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isConfigured()) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const body = await request.json();
    if (body.action !== 'sync') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    const { data: token } = await supabase
      .from('integration_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft_teams')
      .maybeSingle();
    if (!token?.access_token) {
      return NextResponse.json({ error: 'Not connected to Microsoft Teams' }, { status: 401 });
    }

    const res = await fetch('https://graph.microsoft.com/v1.0/education/me/classes', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return NextResponse.json({ error: `Graph error: ${err}` }, { status: 502 });
    }
    const data = await res.json();
    const classes = data.value || [];

    let imported = 0;
    for (const c of classes) {
      try {
        await supabase.from('classrooms').upsert({
          external_id: `msteams:${c.id}`,
          external_provider: 'microsoft_teams',
          name: c.displayName || 'Untitled',
          owner_id: user.id,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'external_id' });
        imported++;
      } catch (err) {
        console.error('Class mirror failed:', err);
      }
    }

    return NextResponse.json({ success: true, imported, total: classes.length });
  } catch (error: any) {
    console.error('MS Teams POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
