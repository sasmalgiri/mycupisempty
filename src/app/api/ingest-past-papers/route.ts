/**
 * PYQ ingestion — pulls public past-paper indexes (gov + curated archives)
 * and adds new papers to public.past_papers. Run nightly by Vercel cron.
 *
 * For each curated source we fetch the index page, extract candidate paper
 * links, dedupe against past_papers (board_code+class+subject+year+language),
 * and insert metadata rows. The actual question bank import still runs
 * through /api/past-papers POST (admin) — this job is only the discovery
 * pipeline so admins know what new papers to import.
 *
 * Authorization: Bearer ${CRON_SECRET}.
 *
 * GET ?dry=1   → returns the discovered paper list without inserting
 *                (useful for admins to preview before letting the cron run)
 * GET          → inserts new metadata rows + writes a pyq_ingestion_log row
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

interface DiscoveredPaper {
  board_code: string;
  class_level: number;
  subject_slug: string;
  year: number;
  language: string;
  exam_label: string;
  source_url: string;
  source_name: string;
}

const SOURCES: Array<{ name: string; index_url: string; board: string; classes: number[] }> = [
  // Curated index pages we know are public + parseable. The crawler is
  // intentionally conservative — it only enumerates board/class/year combos
  // we already cover and lets the admin paste the actual questions.
  { name: 'wbbse_archive',     index_url: 'https://wbbse.wb.gov.in/madhyamik-question-papers',  board: 'wbbse', classes: [10] },
  { name: 'wbxpress_class5',   index_url: 'https://wbxpress.com/?s=class+5+question+paper',     board: 'wbbse', classes: [5] },
  { name: 'wbxpress_primary',  index_url: 'https://wbxpress.com/?s=primary+question+paper',     board: 'wbbse', classes: [3, 4, 5] },
  { name: 'cbse_archive',      index_url: 'https://cbse.gov.in/cbsenew/question-paper.html',    board: 'cbse',  classes: [10, 12] },
];

const SUBJECT_SYNONYMS: Record<string, string> = {
  math: 'math', mathematics: 'math', ganit: 'math',
  science: 'science', bigyan: 'science',
  physics: 'physics', physical: 'physical_science',
  chemistry: 'chemistry',
  biology: 'biology', life: 'life_science',
  english: 'english', hindi: 'hindi', bengali: 'bengali', bangla: 'bengali',
  history: 'history', geography: 'geography', evs: 'evs',
};

function isAuthorizedCron(req: Request): boolean {
  const auth = req.headers.get('authorization') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected) return false;
  if (auth === `Bearer ${expected}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === expected) return true;
  return false;
}

async function fetchIndex(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MyCupIsEmpty/1.0 PYQ-discovery' } });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Heuristic extractor for index pages — looks for href + visible text that
 * mentions a year (2018-2025), a class number, and a subject keyword.
 * Conservative on purpose: false positives are way worse than false negatives
 * (admin still has to import questions manually).
 */
function extractPapers(html: string, source: typeof SOURCES[0]): DiscoveredPaper[] {
  const out: DiscoveredPaper[] = [];
  const aRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  let m;
  while ((m = aRe.exec(html))) {
    const href = m[1];
    const text = m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!text || text.length < 10) continue;
    const yearMatch = text.match(/\b(20\d{2})\b/);
    if (!yearMatch) continue;
    const year = Number(yearMatch[1]);
    if (year < 2015 || year > new Date().getFullYear() + 1) continue;
    let classLevel: number | null = null;
    const classMatch = text.match(/class[ -]?(\d{1,2})|\bcls[ -]?(\d{1,2})|\bmadhyamik\b/);
    if (classMatch) {
      classLevel = classMatch[1] ? Number(classMatch[1]) : classMatch[2] ? Number(classMatch[2]) : 10;
    }
    if (!classLevel || !source.classes.includes(classLevel)) continue;
    let subjectSlug: string | null = null;
    for (const [k, v] of Object.entries(SUBJECT_SYNONYMS)) {
      if (text.includes(k)) { subjectSlug = v; break; }
    }
    if (!subjectSlug) continue;
    const language = subjectSlug === 'bengali' || /bengali|bangla/.test(text) ? 'bn' : 'en';
    const fullUrl = href.startsWith('http') ? href : new URL(href, source.index_url).toString();
    const dedupeKey = `${source.board}|${classLevel}|${subjectSlug}|${year}|${language}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      board_code: source.board,
      class_level: classLevel,
      subject_slug: subjectSlug,
      year,
      language,
      exam_label: `${source.board.toUpperCase()} Class ${classLevel} ${subjectSlug.replace('_', ' ')} ${year}`,
      source_url: fullUrl,
      source_name: source.name,
    });
  }
  return out;
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry') === '1';
  const admin: any = createAdminClient();

  const allDiscovered: DiscoveredPaper[] = [];
  for (const source of SOURCES) {
    const html = await fetchIndex(source.index_url);
    if (!html) continue;
    allDiscovered.push(...extractPapers(html, source));
  }

  if (dryRun) {
    return NextResponse.json({ success: true, dryRun: true, discovered: allDiscovered });
  }

  // Insert with ON CONFLICT DO NOTHING — past_papers is unique on
  // (board, class, subject, year, language) per migration 029.
  let imported = 0;
  const errors: string[] = [];
  for (const p of allDiscovered) {
    const { error } = await admin.from('past_papers').insert({
      board_code: p.board_code,
      class_level: p.class_level,
      subject_slug: p.subject_slug,
      language: p.language,
      year: p.year,
      exam_label: p.exam_label,
      source_url: p.source_url,
      notes: `Auto-discovered via ${p.source_name}. Questions still need admin import.`,
    });
    if (error && !error.message.includes('duplicate')) errors.push(error.message);
    else if (!error) imported++;
  }

  await admin.from('pyq_ingestion_log').insert({
    source_name: 'cron_discovery',
    papers_imported: imported,
    questions_imported: 0,
    status: errors.length === 0 ? 'success' : 'partial',
    error_message: errors.slice(0, 3).join('; ') || null,
  });

  return NextResponse.json({
    success: true,
    discovered: allDiscovered.length,
    imported,
    errors: errors.slice(0, 5),
  });
}
