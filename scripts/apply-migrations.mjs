/**
 * Apply every migration in supabase/migrations, in order, via psql.
 *
 * Why not `supabase db push`: that needs `supabase link`, which prompts for the
 * database password interactively and cannot be driven from a script. This
 * reads the password from .env.local instead and reports exactly which file
 * and which statement failed — which matters when 34 migrations have never
 * been applied end to end before.
 *
 * Connection: uses the SESSION POOLER, not db.<ref>.supabase.co. New free-tier
 * projects resolve the direct host to IPv6 only, which fails on most Indian
 * ISPs. The pooler has IPv4 records. Port 5432 is session mode, which allows
 * DDL; 6543 is transaction mode and does not.
 *
 * Applied migrations are recorded in public._migrations_applied so re-running
 * is safe and resumable after a failure.
 *
 *   node scripts/apply-migrations.mjs            apply pending
 *   node scripts/apply-migrations.mjs --dry-run  list what would be applied
 *   node scripts/apply-migrations.mjs --force    re-apply everything
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = process.cwd();
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');
const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// ---------------------------------------------------------------------------

function readEnvLocal() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) fail('.env.local not found');
  const env = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function projectRef(url) {
  const m = (url || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

/**
 * Supabase does not publish which pooler shard a project sits on, and it
 * differs between projects in the same region — so we try each in turn.
 */
function poolerHosts(region) {
  return [`aws-0-${region}.pooler.supabase.com`, `aws-1-${region}.pooler.supabase.com`];
}

function psql(conn, args, input) {
  return execFileSync('psql', [conn, '-v', 'ON_ERROR_STOP=1', ...args], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

// ---------------------------------------------------------------------------

const env = readEnvLocal();
const ref = projectRef(env.NEXT_PUBLIC_SUPABASE_URL);
if (!ref) fail('Could not read the project ref from NEXT_PUBLIC_SUPABASE_URL in .env.local');

const password = env.SUPABASE_DB_PASSWORD;
if (!password) {
  fail(
    'SUPABASE_DB_PASSWORD is empty in .env.local.\n' +
    '  It is the database password you set when creating the project.\n' +
    '  Forgotten? Supabase dashboard → Settings → Database → Reset database password.',
  );
}

const region = env.SUPABASE_REGION || 'ap-south-1';
const encoded = encodeURIComponent(password);

// Find a pooler host that actually accepts the connection.
let conn = null;
for (const host of poolerHosts(region)) {
  const candidate = `postgresql://postgres.${ref}:${encoded}@${host}:5432/postgres`;
  try {
    psql(candidate, ['-t', '-A', '-c', 'select 1']);
    conn = candidate;
    console.log(`✓ Connected via ${host}`);
    break;
  } catch (e) {
    const err = (e.stderr || e.message || '').trim().split('\n')[0];
    console.log(`  ${host}: ${err}`);
  }
}
if (!conn) {
  fail(
    'Could not connect on any pooler host.\n' +
    '  If the error mentions authentication, the password is wrong.\n' +
    '  If it mentions the host, set SUPABASE_REGION in .env.local to your project region.',
  );
}

// Ledger so a failed run can be resumed rather than restarted.
psql(conn, ['-q', '-c',
  'CREATE TABLE IF NOT EXISTS public._migrations_applied (' +
  'filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())']);

const applied = new Set(
  FORCE ? [] :
  psql(conn, ['-t', '-A', '-c', 'SELECT filename FROM public._migrations_applied'])
    .split('\n').map((s) => s.trim()).filter(Boolean),
);

const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const pending = files.filter((f) => !applied.has(f));

console.log(`\n${files.length} migrations, ${applied.size} already applied, ${pending.length} pending.\n`);
if (pending.length === 0) { console.log('Nothing to do.'); process.exit(0); }
if (DRY) { pending.forEach((f) => console.log(`  would apply ${f}`)); process.exit(0); }

// ---------------------------------------------------------------------------
// Applying onto a database that is already partly populated.
//
// This schema was not built from these migrations in order — 157 tables were
// already present. That breaks a common pattern in the files:
//
//     CREATE TABLE IF NOT EXISTS public.flashcards ( ... user_id ... );
//     CREATE INDEX ... ON public.flashcards(user_id, next_review_at);
//
// When the table already exists in an OLDER shape, IF NOT EXISTS silently
// skips it, the new columns are never added, and the index below dies with
// "column user_id does not exist". The migration is not wrong about what it
// wants — it is wrong to assume it is the one creating the table.
//
// So before each file we diff what it declares against what is actually there
// and emit the missing columns. Constraints that cannot be added to a table
// with existing rows (NOT NULL, PRIMARY KEY, UNIQUE, REFERENCES, CHECK) are
// stripped: the goal is to let the migration run, not to retro-fit integrity
// rules onto data that predates them.
// ---------------------------------------------------------------------------

function liveColumns() {
  const rows = psql(conn, ['-t', '-A', '-F', '|', '-c',
    "select table_name,column_name from information_schema.columns where table_schema='public'"]);
  const map = new Map();
  for (const line of rows.split('\n')) {
    const [t, c] = line.split('|');
    if (!t || !c) continue;
    if (!map.has(t)) map.set(t, new Set());
    map.get(t).add(c.trim());
  }
  return map;
}

function reconcile(sql, live) {
  const blocks = [];
  const re = /CREATE TABLE IF NOT EXISTS public\.(\w+)\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = re.exec(sql))) {
    const table = m[1];
    if (!live.has(table)) continue;              // the migration really is creating it
    const have = live.get(table);
    const cols = [];
    for (let raw of m[2].split('\n')) {
      raw = raw.replace(/--.*$/, '').trim().replace(/,$/, '');
      if (!raw || /^(PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY|CONSTRAINT)\b/i.test(raw)) continue;
      const cm = raw.match(/^(\w+)\s+(.+)$/);
      if (!cm || have.has(cm[1])) continue;
      const def = cm[2]
        .replace(/\bNOT NULL\b/gi, '')
        .replace(/\bPRIMARY KEY\b/gi, '')
        .replace(/\bUNIQUE\b/gi, '')
        .replace(/\bREFERENCES\b[\s\S]*$/i, '')
        .replace(/\bCHECK\s*\([^)]*\)/gi, '')
        .trim().replace(/,$/, '');
      if (def) cols.push(`  ADD COLUMN IF NOT EXISTS ${cm[1]} ${def}`);
    }
    if (cols.length) blocks.push(`ALTER TABLE public.${table}\n${cols.join(',\n')};`);
  }
  return blocks;
}

/**
 * CREATE POLICY and CREATE TRIGGER have no IF NOT EXISTS. On a database where
 * an earlier run already created them, they abort the whole transaction — so
 * make each one drop-then-create. Same end state, re-runnable.
 */
function makeIdempotent(sql) {
  return sql
    .replace(
      /CREATE POLICY\s+("(?:[^"]+)"|\w+)\s+ON\s+((?:public\.)?\w+)/gi,
      (_all, name, table) => `DROP POLICY IF EXISTS ${name} ON ${table};\nCREATE POLICY ${name} ON ${table}`,
    )
    .replace(
      /CREATE TRIGGER\s+(\w+)([\s\S]*?)\sON\s+((?:public\.)?\w+)/gi,
      (_all, name, mid, table) => `DROP TRIGGER IF EXISTS ${name} ON ${table};\nCREATE TRIGGER ${name}${mid} ON ${table}`,
    );
}

let ok = 0;
for (const f of pending) {
  let sql = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8');
  process.stdout.write(`  ${f} … `);
  try {
    const live = liveColumns();
    const fixes = reconcile(sql, live);
    sql = makeIdempotent(sql);
    if (fixes.length) {
      sql = `-- reconciled against the live schema by apply-migrations.mjs\n${fixes.join('\n\n')}\n\n${sql}`;
      process.stdout.write(`(reconciled ${fixes.length} table${fixes.length === 1 ? '' : 's'}) `);
    }
    // Each migration runs in one transaction, so a failure leaves no partial
    // schema behind for the next attempt to trip over.
    psql(conn, ['-q', '--single-transaction', '-f', '-'], sql);
    psql(conn, ['-q', '-c',
      `INSERT INTO public._migrations_applied(filename) VALUES ('${f.replace(/'/g, "''")}') ON CONFLICT DO NOTHING`]);
    console.log('ok');
    ok++;
  } catch (e) {
    console.log('FAILED');
    const detail = (e.stderr || e.stdout || e.message || '').trim();
    console.error(`\n──────── ${f} ────────\n${detail}\n`);
    console.error(`Applied ${ok} of ${pending.length}. Fix the file above and re-run — ` +
                  `completed migrations are recorded and will be skipped.`);
    process.exit(1);
  }
}

console.log(`\n✓ All ${ok} migrations applied.`);
