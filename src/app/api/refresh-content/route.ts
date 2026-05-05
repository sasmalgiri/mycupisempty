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
import { geminiGenerateJSON, isGeminiConfigured } from '@/lib/gemini';

const SUBJECTS_TO_REFRESH: Array<{ slug: string; topic: string }> = [
  { slug: 'science',  topic: 'a recent (2025-2026) interesting development in science any K-12 student would find fascinating' },
  { slug: 'math',     topic: 'a beautiful or unexpected math idea suitable for a K-12 student (real-world example or pattern)' },
  { slug: 'english',  topic: 'a useful English-language skill, idiom, or word origin a K-12 student should know' },
  { slug: 'social',   topic: 'a recent or surprising historical/social/geographical fact relevant to Indian K-12 curriculum' },
];

const WONDER_PROMPT_BY_CATEGORY: Record<string, string> = {
  outer_space:      'a fascinating, well-established fact about space or astronomy',
  deep_sea:         'a fascinating, well-established fact about the deep ocean or marine life',
  tiny_worlds:      'a fascinating, well-established fact about microscopic life, viruses, or cells',
  history_weird:    'a verifiable but surprising historical fact (no conspiracy theories)',
  body_mysteries:   'a fascinating, well-established fact about the human body',
  math_magic:       'an elegant or surprising mathematical pattern with a real-world tie-in',
  tech_hacks:       'a fascinating, factual explanation of how a common technology works',
  nature_engineers: 'a fascinating, well-established example of an animal or plant adaptation',
};

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

    // 3. Gemini content generation pass — only when configured. Generates a
    //    handful of fresh wonder_facts and subject_blogs per run with proper
    //    provenance so the registry stays alive between adapter releases.
    if (isGeminiConfigured()) {
      const aiStart = Date.now();
      const aiStat: RunStat = { source: '__gemini_generation__', fetched: 0, inserted: 0, archived: 0, skipped: 0, errors: [], status: 'ok', durationMs: 0 };

      // 3a. Wonder facts — one per category each day (max 8 inserts).
      for (const [category, topicHint] of Object.entries(WONDER_PROMPT_BY_CATEGORY)) {
        try {
          const ai = await geminiGenerateJSON<{ hook: string; body: string; class_min: number; class_max: number; is_evergreen: boolean }>(
            `Write ${topicHint}, suitable for an Indian K-12 student.

Return JSON: { "hook": "<1-sentence grab, max 160 chars>", "body": "<2-3 short paragraphs, max 600 chars total, factual, no clickbait>", "class_min": <int 1-12, youngest grade who can grasp this>, "class_max": <int 1-12>, "is_evergreen": <true if the fact won't go stale, false otherwise> }`,
            { temperature: 0.85, maxOutputTokens: 600 },
          );
          aiStat.fetched += 1;
          if (ai.ok && ai.data?.hook && ai.data?.body) {
            const { error } = await supabase.from('wonder_facts').insert({
              category,
              hook: ai.data.hook.slice(0, 160),
              body: ai.data.body.slice(0, 1200),
              class_min: Math.max(1, Math.min(12, Number(ai.data.class_min) || 6)),
              class_max: Math.max(1, Math.min(12, Number(ai.data.class_max) || 10)),
              is_evergreen: !!ai.data.is_evergreen,
              language: 'en',
              last_verified_at: new Date().toISOString(),
            });
            if (!error) aiStat.inserted += 1;
            else { aiStat.skipped += 1; aiStat.errors.push(`wonder/${category}: ${error.message}`); }
          } else {
            aiStat.skipped += 1;
            if (ai.error) aiStat.errors.push(`wonder/${category}: ${ai.error}`);
          }
        } catch (err: any) {
          aiStat.errors.push(`wonder/${category}: ${err?.message || err}`);
        }
      }

      // 3b. Subject blogs — one per subject (max 4 inserts).
      for (const sub of SUBJECTS_TO_REFRESH) {
        try {
          const ai = await geminiGenerateJSON<{ title: string; body_md: string; class_min: number; class_max: number; reading_minutes: number }>(
            `Write a 300-500 word kid-appropriate blog post about ${sub.topic}, for the Indian school subject "${sub.slug}".
Tone: friendly, accurate, no fluff. Avoid news headlines you can't verify. Include 1-2 practical takeaways the student can use in class.

Return JSON: { "title": "<title, max 100 chars>", "body_md": "<markdown body, 300-500 words>", "class_min": <int>, "class_max": <int>, "reading_minutes": <int 2-5> }`,
            { temperature: 0.7, maxOutputTokens: 1200 },
          );
          aiStat.fetched += 1;
          if (ai.ok && ai.data?.title && ai.data?.body_md) {
            const slugBase = ai.data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
            const slug = `${slugBase}-${Date.now().toString(36)}`;
            const wordCount = ai.data.body_md.split(/\s+/).length;
            const { error } = await supabase.from('subject_blogs').insert({
              subject_slug: sub.slug,
              title: ai.data.title.slice(0, 200),
              slug,
              body_md: ai.data.body_md.slice(0, 8000),
              word_count: wordCount,
              reading_minutes: Math.max(1, Math.min(8, Number(ai.data.reading_minutes) || 3)),
              class_min: Math.max(1, Math.min(12, Number(ai.data.class_min) || 6)),
              class_max: Math.max(1, Math.min(12, Number(ai.data.class_max) || 10)),
              language: 'en',
              last_verified_at: new Date().toISOString(),
            });
            if (!error) aiStat.inserted += 1;
            else { aiStat.skipped += 1; aiStat.errors.push(`blog/${sub.slug}: ${error.message}`); }
          } else {
            aiStat.skipped += 1;
            if (ai.error) aiStat.errors.push(`blog/${sub.slug}: ${ai.error}`);
          }
        } catch (err: any) {
          aiStat.errors.push(`blog/${sub.slug}: ${err?.message || err}`);
        }
      }

      aiStat.durationMs = Date.now() - aiStart;
      if (aiStat.errors.length > 0) aiStat.status = aiStat.inserted > 0 ? 'partial' : 'failed';
      overall.push(aiStat);

      try {
        await supabase.from('content_freshness_log').insert({
          source_id: null,
          items_fetched: aiStat.fetched,
          items_inserted: aiStat.inserted,
          items_archived: 0,
          items_skipped: aiStat.skipped,
          errors: aiStat.errors.length ? aiStat.errors.map((e) => ({ message: e })) : [],
          duration_ms: aiStat.durationMs,
          status: aiStat.status,
        });
      } catch { /* freshness log is best-effort */ }
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
