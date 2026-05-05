/**
 * Google Drive OAuth callback.
 *
 * The frontend Drive backup helper at lib/storage.ts redirects the user to
 * Google with redirect_uri=/api/auth/google-drive-callback. Google bounces
 * back here with ?code=... ; we exchange it for an access_token + refresh_token
 * and forward the tokens to a small client page that closes the popup and
 * messages window.opener.postMessage so the parent can store them.
 *
 * We deliberately do NOT persist tokens server-side — Drive backup is a
 * client-only feature; tokens live in localStorage (encrypted via the
 * existing key-derivation flow in lib/storage.ts) and never touch our DB.
 */

import { NextResponse } from 'next/server';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return htmlResponse(`<p style="font-family:sans-serif">Drive authorisation failed: ${escape(error)}.</p>`);
  }
  if (!code) {
    return htmlResponse('<p style="font-family:sans-serif">Missing OAuth code.</p>');
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return htmlResponse('<p style="font-family:sans-serif">Drive integration is not configured on the server (NEXT_PUBLIC_GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET).</p>');
  }

  const redirectUri = `${url.origin}/api/auth/google-drive-callback`;

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const json = await res.json();
    if (!res.ok || !json?.access_token) {
      return htmlResponse(`<p style="font-family:sans-serif">Token exchange failed: ${escape(json?.error_description || 'unknown')}.</p>`);
    }
    // Hand the tokens to window.opener and close. The parent listens for
    // 'mycup:google-drive-token' and stashes them.
    const safeJson = JSON.stringify({
      access_token: json.access_token,
      refresh_token: json.refresh_token || null,
      expires_in: json.expires_in || 3600,
      scope: json.scope || '',
    }).replace(/</g, '\\u003c');
    return htmlResponse(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
<p>✓ Drive connected. You can close this window.</p>
<script>
  try {
    window.opener && window.opener.postMessage({ type: 'mycup:google-drive-token', payload: ${safeJson} }, window.location.origin);
  } catch (e) {}
  window.close();
</script>
</body></html>`);
  } catch (err: any) {
    return htmlResponse(`<p style="font-family:sans-serif">Network error: ${escape(err?.message || 'unknown')}.</p>`);
  }
}

function htmlResponse(html: string) {
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escape(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
