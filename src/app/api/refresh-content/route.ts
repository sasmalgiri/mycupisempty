/**
 * Freshness pipeline — daily cron entrypoint.
 *
 * Wired up as a Vercel cron via vercel.json (added in this phase). Hits
 * GET /api/refresh-content; runs through every active content_source,
 * pulls candidate items, drops anything from sources NOT on the registry,
 * and writes vetted items into wonder_facts / subject_blogs / external_videos.
 *
 * Every run logs to content_freshness_log with status (ok/partial/failed) so
 * we can debug without scraping platform logs.
 *
 * IMPORTANT design decisions:
 *   - Service-role required (we read content_sources + write to public
 *     tables that block normal-user inserts via RLS). Authenticated by
 *     Vercel cron header CRON_SECRET, set in env.
 *   - We DO NOT run heavy AI translations inline here; we stage candidate
 *     summaries in subject_blogs as drafts (is_archived=true initially)
 *     so a human reviewer or a separate worker can promote them.
 *   - Auto-archive items older than 90 days that aren't evergreen.
 *   - Each provenance is recorded — every inserted row carries source_id.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface RunStat {
  source: string;
  fetched: number;
  inserted: number;
  archived: number;
  skipped: number;
  errors: string[];
  status: 'ok' | 'partial' | 'failed';
  durationMs: number;
}

const ARCHIVE_AFTER_DAYS = 90;

function isAuthorizedCron(req: Request): boolean {
  // Vercel cron sets the auth header to `Bearer ${CRON_SECRET}`. Local devs
  // can pass ?secret=... for testing. Don't run unauthenticated — the cron
  // mutates content for every user.
  const auth = req.headers.get('authorization') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected) return false;
  if (auth === `Bearer ${expected}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === expected) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase: any = await createServerClient();
  const overall: RunStat[] = [];
  const totalStart = Date.now();

  try {
    // 1. Auto-archive: anything past ARCHIVE_AFTER_DAYS that isn't evergreen.
    const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 86400000).toISOString();
    let archived = 0;
    for (const table of ['wonder_facts', 'subject_blogs']) {
      const { count } = await supabase
        .from(table)
        .update({ is_archived: true })
        .eq('is_evergreen', false)
        .eq('is_archived', false)
        .lt('last_verified_at', cutoff)
        .select('id', { count: 'exact', head: true });
      archived += count || 0;
    }
    overall.push({ source: '__archive_pass__', fetched: 0, inserted: 0, archived, skipped: 0, errors: [], status: 'ok', durationMs: 0 });

    // 2. Per-source: read the registry, skip inactive, fetch candidate items.
    //    The actual fetch is lightweight here — just reads the source row, marks
    //    last_pulled_at, logs the run. Adapter wiring (RSS, YouTube API, etc.)
    //    is a follow-up — this pass installs the pipeline scaffold so the
    //    daily cron is real, with an audit log, even before adapters land.
    const { data: sources } = await supabase
      .from('content_sources')
      .select('id, name, kind, url, language, subjects, is_active')
      .eq('is_active', true);

    for (const src of (sources || []) as any[]) {
      const start = Date.now();
      const stat: RunStat = { source: src.name, fetched: 0, inserted: 0, archived: 0, skipped: 0, errors: [], status: 'ok', durationMs: 0 };

      try {
        // Adapter dispatch hook — for now, log a 'no-op probe' so we have a
        // real heartbeat per source even without live ingestion. Replace with
        // RSS / YouTube Data API / NASA News API calls in a follow-up commit.
        await supabase
          .from('content_sources')
          .update({ last_pulled_at: new Date().toISOString() })
          .eq('id', src.id);
      } catch (err: any) {
        stat.errors.push(err?.message || String(err));
        stat.status = 'failed';
      }

      stat.durationMs = Date.now() - start;
      overall.push(stat);

      // Per-source freshness log entry
      try {
        await supabase.from('content_freshness_log').insert({
          source_id: src.id,
          items_fetched: stat.fetched,
          items_inserted: stat.inserted,
          items_archived: stat.archived,
          items_skipped: stat.skipped,
          errors: stat.errors.length ? stat.errors.map((e) => ({ message: e })) : [],
          duration_ms: stat.durationMs,
          status: stat.status,
        });
      } catch { /* freshness_log optional */ }
    }

    return NextResponse.json({
      success: true,
      total_duration_ms: Date.now() - totalStart,
      runs: overall,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, runs: overall }, { status: 500 });
  }
}
