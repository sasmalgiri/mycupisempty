-- ============================================================================
-- Migration 021: Master redesign — every table the 15-phase plan needs.
--
-- One file so the schema is consistent and reversible. Each section is
-- self-contained — drop one without touching the others.
--
-- Tables added (with one-line purpose each):
--
--   Behavioral assessment (Arena) ---------------------------------------------
--   minigame_results           Raw per-play signals from the 5 Arena minigames
--   session_evaluations        Append-only exit-eval scores (the honest measure)
--
--   Adaptive companions -------------------------------------------------------
--   companion_mode_history     Per-subject mode change log + evidence trail
--   companion_facts            Persistent facts the student told the companion
--                              (Lily/Duo Max-style memory across sessions)
--
--   Curiosity + content -------------------------------------------------------
--   wonder_facts               Live, DB-backed Wonder Hub items
--   subject_blogs              Class-tagged short digests per subject
--   tricks                     Mnemonics, math tricks, exam-cracking hacks
--   external_videos            Curated YouTube allowlist with channel + license
--   content_sources            Trusted-source registry (every external feed)
--   content_freshness_log      Daily cron audit of refresh runs
--   content_flags              Student-flagged stale/wrong content
--
--   Engagement loop -----------------------------------------------------------
--   streaks                    Per-user streak + freezes (Duolingo pattern)
--   weekly_leagues             10-tier cohort system (Bronze..Diamond)
--   weekly_league_standings    Per-user weekly XP within a league
--
--   Mastery + prereqs ---------------------------------------------------------
--   mastery_scores             IXL SmartScore 0-100 per skill (replaces dots)
--
--   Parent + rank -------------------------------------------------------------
--   parent_artifacts           Generated session PDFs, ready for WhatsApp
--   rank_predictions           Calibrated board % / JEE / NEET projection cache
--
--   Power features ------------------------------------------------------------
--   notes_uploads              Magic-Notes photo → flashcards + practice flow
--   manipulables_registry      Concept → which interactive (graph, sim, slider)
--   interests                  Student-stated interests for problem injection
--
--   Honesty layer -------------------------------------------------------------
--   honesty_xp_events          Append-only honesty XP earnings/losses
-- ============================================================================

-- ============================================================================
-- 1. Behavioral assessment (Arena)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.minigame_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game TEXT NOT NULL CHECK (game IN ('pattern_trace', 'word_sprint', 'number_snap', 'memory_match', 'story_choice')),
  -- Raw signals — interpretation lives in lib/arena-signals.ts so we can
  -- iterate the model without schema migrations.
  signals JSONB NOT NULL DEFAULT '{}',
  -- Composite scores derived from raw signals (cached for fast reads).
  accuracy NUMERIC,
  rt_p50_ms INTEGER,         -- median reaction time
  difficulty_reached INTEGER, -- highest level the student got to
  duration_seconds INTEGER,
  trigger TEXT NOT NULL DEFAULT 'session_start' CHECK (trigger IN ('first_session', 'session_start', 'weekly', 'recalibration', 'manual')),
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minigame_user_recent
  ON public.minigame_results(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_minigame_game_played
  ON public.minigame_results(game, played_at DESC);

ALTER TABLE public.minigame_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read minigame" ON public.minigame_results;
CREATE POLICY "self read minigame" ON public.minigame_results
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "self insert minigame" ON public.minigame_results;
CREATE POLICY "self insert minigame" ON public.minigame_results
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- session_evaluations — APPEND-ONLY audit trail of every exit eval.
-- No UPDATE / DELETE policies on purpose: past honesty data must be immutable.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.session_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID,                         -- daily_mix_sessions(id) or NULL
  subject_id UUID,
  topic_id UUID,
  companion_id TEXT,                       -- which companion the lesson used
  mode_used TEXT,                          -- visual | story | step_by_step | ...
  question_text TEXT NOT NULL,
  question_kind TEXT NOT NULL CHECK (question_kind IN ('transfer', 'recall', 'application', 'synthesis')),
  expected_answer TEXT,
  student_answer TEXT,
  correct BOOLEAN,
  -- Score on [0,1]. Composite: correctness, partial credit, time, anti-cheat penalties.
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 1),
  confidence_before TEXT,                  -- 'guess' | 'unsure' | 'sure'
  -- Anti-cheat signals
  time_to_first_keystroke_ms INTEGER,      -- instant typing flagged
  paste_detected BOOLEAN DEFAULT FALSE,
  tab_blur_count INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_eval_user_recent
  ON public.session_evaluations(user_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_eval_subject
  ON public.session_evaluations(user_id, subject_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_eval_companion
  ON public.session_evaluations(user_id, companion_id, evaluated_at DESC);

ALTER TABLE public.session_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read session eval" ON public.session_evaluations;
CREATE POLICY "self read session eval" ON public.session_evaluations
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "self insert session eval" ON public.session_evaluations;
CREATE POLICY "self insert session eval" ON public.session_evaluations
  FOR INSERT WITH CHECK (user_id = auth.uid());
-- Deliberately NO update or delete policy — append-only.

-- ============================================================================
-- 2. Adaptive companions
-- ============================================================================

-- Per-subject mode change log. Companion writes a row whenever it switches the
-- student's recommended explanation mode, including the evidence that triggered
-- the switch. Parent / teacher can inspect this to understand the system's
-- decisions.
CREATE TABLE IF NOT EXISTS public.companion_mode_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id TEXT NOT NULL,
  subject_id UUID,
  prev_mode TEXT,
  new_mode TEXT NOT NULL,
  reason TEXT NOT NULL,              -- one-line human-readable justification
  evidence JSONB,                    -- { sessionsTried, avgScore, alternatives }
  decision TEXT NOT NULL CHECK (decision IN ('proposed', 'accepted', 'declined', 'auto_applied')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companion_mode_history_user
  ON public.companion_mode_history(user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_mode_history_companion
  ON public.companion_mode_history(user_id, companion_id, changed_at DESC);

ALTER TABLE public.companion_mode_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read mode history" ON public.companion_mode_history;
CREATE POLICY "self read mode history" ON public.companion_mode_history
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "self insert mode history" ON public.companion_mode_history;
CREATE POLICY "self insert mode history" ON public.companion_mode_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- companion_facts — persistent facts each companion remembers about the student.
-- Distinct from companion_memory (which is the rolling state). These are
-- explicit "Lily remembers you said you want to be a cricketer" entries that
-- show up in chat scaffolding and word-problem personalization.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.companion_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id TEXT NOT NULL,
  fact TEXT NOT NULL,                -- "wants to be a cricketer", "dad is a farmer"
  category TEXT,                     -- 'aspiration' | 'family' | 'interest' | 'struggle' | 'celebration'
  source TEXT,                       -- 'chat' | 'onboarding' | 'inferred'
  confidence NUMERIC DEFAULT 0.7,    -- how sure are we the student really said this
  is_active BOOLEAN DEFAULT TRUE,    -- student can ask companion to forget
  remembered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_referenced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_companion_facts_user_companion
  ON public.companion_facts(user_id, companion_id) WHERE is_active = TRUE;

ALTER TABLE public.companion_facts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all companion facts" ON public.companion_facts;
CREATE POLICY "self all companion facts" ON public.companion_facts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 3. Curiosity + content (live, DB-backed; replaces planned static catalogs)
-- ============================================================================

-- Trusted source registry. Every external feed/channel/site is listed here.
-- The freshness pipeline (Phase 8) refuses to ingest from sources not on this
-- list, so we always know provenance.
CREATE TABLE IF NOT EXISTS public.content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- name is unique so the seed insert at the end can ON CONFLICT DO NOTHING
  -- safely on re-run.
  name TEXT NOT NULL UNIQUE,                       -- 'NASA News', '3Blue1Brown', 'NCERT'
  kind TEXT NOT NULL CHECK (kind IN ('news_feed', 'youtube_channel', 'rss', 'api', 'curated_human')),
  url TEXT,
  license TEXT,                                    -- 'public_domain' | 'CC-BY' | 'CC-BY-NC-SA' | 'standard_youtube' | 'custom'
  trust_score NUMERIC DEFAULT 0.8 CHECK (trust_score BETWEEN 0 AND 1),
  trust_reason TEXT,                               -- why we trust this source
  subjects TEXT[] DEFAULT '{}',                    -- which school subjects it covers
  language TEXT DEFAULT 'en',
  added_by TEXT,                                   -- admin email or 'system'
  is_active BOOLEAN DEFAULT TRUE,
  last_pulled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_sources_active
  ON public.content_sources(kind, is_active);

-- Wonder Hub: gateway-drug curiosity facts. Live, refreshable.
CREATE TABLE IF NOT EXISTS public.wonder_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'deep_sea', 'outer_space', 'tiny_worlds', 'history_weird',
    'body_mysteries', 'math_magic', 'tech_hacks', 'nature_engineers'
  )),
  hook TEXT NOT NULL,                              -- 1-sentence grab
  body TEXT NOT NULL,                              -- 2-3 paragraphs
  related_subject_id UUID,
  related_topic_id UUID,
  source_id UUID REFERENCES public.content_sources(id) ON DELETE SET NULL,
  source_url TEXT,
  language TEXT DEFAULT 'en',
  class_min INTEGER DEFAULT 1,                     -- youngest grade appropriate
  class_max INTEGER DEFAULT 12,
  is_evergreen BOOLEAN DEFAULT FALSE,              -- "gravity exists" stays; "Mars rover landed last week" archives
  is_archived BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  flag_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wonder_facts_active
  ON public.wonder_facts(category, language, is_archived);
CREATE INDEX IF NOT EXISTS idx_wonder_facts_freshness
  ON public.wonder_facts(last_verified_at) WHERE is_archived = FALSE;

ALTER TABLE public.wonder_facts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read wonder" ON public.wonder_facts;
CREATE POLICY "anyone read wonder" ON public.wonder_facts
  FOR SELECT USING (is_archived = FALSE);
-- Inserts/updates restricted to service role (cron + admin) — no policy means
-- only the service_role bypasses RLS.

-- Wonder Wall: per-user saved facts.
CREATE TABLE IF NOT EXISTS public.wonder_saves (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fact_id UUID NOT NULL REFERENCES public.wonder_facts(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, fact_id)
);

ALTER TABLE public.wonder_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all wonder saves" ON public.wonder_saves;
CREATE POLICY "self all wonder saves" ON public.wonder_saves
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Subject blogs: short class-tagged digests, one stream per subject.
CREATE TABLE IF NOT EXISTS public.subject_blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID,
  subject_slug TEXT NOT NULL,                      -- 'math' | 'science' | 'english' | ...
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  body_md TEXT NOT NULL,
  word_count INTEGER,
  reading_minutes INTEGER,
  source_id UUID REFERENCES public.content_sources(id) ON DELETE SET NULL,
  source_url TEXT,
  language TEXT DEFAULT 'en',
  class_min INTEGER DEFAULT 1,
  class_max INTEGER DEFAULT 12,
  related_topic_id UUID,
  is_evergreen BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  flag_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subject_blogs_subject
  ON public.subject_blogs(subject_slug, language, is_archived, published_at DESC);

ALTER TABLE public.subject_blogs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read blogs" ON public.subject_blogs;
CREATE POLICY "anyone read blogs" ON public.subject_blogs
  FOR SELECT USING (is_archived = FALSE);

-- External videos: curated YouTube allowlist.
-- Defined BEFORE tricks because tricks.example_video_id FKs into it.
CREATE TABLE IF NOT EXISTS public.external_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'youtube' CHECK (provider IN ('youtube', 'vimeo', 'self_hosted')),
  external_id TEXT NOT NULL,                       -- YouTube video ID
  title TEXT NOT NULL,
  channel_name TEXT NOT NULL,                      -- '3Blue1Brown', 'Veritasium'
  source_id UUID REFERENCES public.content_sources(id) ON DELETE SET NULL,
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  description TEXT,
  language TEXT DEFAULT 'en',
  subject_slug TEXT,
  topic_id UUID,
  class_min INTEGER DEFAULT 1,
  class_max INTEGER DEFAULT 12,
  -- Distraction guardrails enforced by the player frame
  watch_goal_seconds INTEGER,                      -- "set a watch goal" pre-roll
  retrieval_questions JSONB DEFAULT '[]',          -- 2 post-watch questions, gates XP
  license TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_videos_subject
  ON public.external_videos(subject_slug, language, is_archived);

ALTER TABLE public.external_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read videos" ON public.external_videos;
CREATE POLICY "anyone read videos" ON public.external_videos
  FOR SELECT USING (is_archived = FALSE);

-- Per-user video watches: enforces the "1/session 2/day" hard cap and
-- gates retrieval-question completion for XP.
CREATE TABLE IF NOT EXISTS public.video_watch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.external_videos(id) ON DELETE CASCADE,
  watched_seconds INTEGER DEFAULT 0,
  completed_retrieval BOOLEAN DEFAULT FALSE,
  retrieval_score NUMERIC,
  blur_count INTEGER DEFAULT 0,                    -- tab-switch detection
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_watch_user_recent
  ON public.video_watch_log(user_id, watched_at DESC);

ALTER TABLE public.video_watch_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all video watch" ON public.video_watch_log;
CREATE POLICY "self all video watch" ON public.video_watch_log
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Tricks library: mnemonics, math tricks, exam-cracking hacks.
-- Defined here (after external_videos) so example_video_id FK resolves.
CREATE TABLE IF NOT EXISTS public.tricks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'mnemonic', 'memory_palace', 'math_trick', 'english_grammar',
    'physics_shortcut', 'bio_mnemonic', 'exam_strategy', 'study_hack'
  )),
  subject_slug TEXT,
  title TEXT NOT NULL,
  one_liner TEXT NOT NULL,
  walkthrough_md TEXT NOT NULL,
  when_it_works TEXT,
  when_it_fails TEXT,
  example_video_id UUID REFERENCES public.external_videos(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.content_sources(id) ON DELETE SET NULL,
  language TEXT DEFAULT 'en',
  class_min INTEGER DEFAULT 1,
  class_max INTEGER DEFAULT 12,
  related_topic_ids UUID[] DEFAULT '{}',
  is_evergreen BOOLEAN DEFAULT TRUE,
  is_archived BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  helpful_count INTEGER DEFAULT 0,
  flag_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tricks_category
  ON public.tricks(category, language, is_archived);
CREATE INDEX IF NOT EXISTS idx_tricks_topics
  ON public.tricks USING GIN (related_topic_ids);

ALTER TABLE public.tricks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone read tricks" ON public.tricks;
CREATE POLICY "anyone read tricks" ON public.tricks
  FOR SELECT USING (is_archived = FALSE);

-- Daily cron audit: every freshness run logs what it pulled, what it inserted,
-- what it failed on. Lets us debug the pipeline without scraping logs.
CREATE TABLE IF NOT EXISTS public.content_freshness_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.content_sources(id) ON DELETE CASCADE,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items_fetched INTEGER DEFAULT 0,
  items_inserted INTEGER DEFAULT 0,
  items_archived INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  duration_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('ok', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_freshness_log_recent
  ON public.content_freshness_log(ran_at DESC);

-- Audience flags: students/teachers can flag content as stale, wrong, or
-- inappropriate. Earns Honesty XP if validated by a reviewer.
CREATE TABLE IF NOT EXISTS public.content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_kind TEXT NOT NULL CHECK (content_kind IN ('wonder_fact', 'subject_blog', 'trick', 'external_video')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,                            -- 'stale' | 'wrong' | 'inappropriate' | 'other'
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected', 'addressed')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_flags_pending
  ON public.content_flags(content_kind, content_id) WHERE status = 'pending';

ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read own flags" ON public.content_flags;
CREATE POLICY "self read own flags" ON public.content_flags
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "self insert flag" ON public.content_flags;
CREATE POLICY "self insert flag" ON public.content_flags
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 4. Engagement loop (Phase 9: streak + freeze + weekly league)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.streaks (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  freezes_available INTEGER DEFAULT 0,             -- earned, never bought
  freezes_used_total INTEGER DEFAULT 0,
  -- Honesty XP lives here too — single row per user keeps it cheap.
  honesty_xp INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all streaks" ON public.streaks;
CREATE POLICY "self all streaks" ON public.streaks
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Weekly leagues: 10-tier ladder. Cohort of ~30 students per league_group,
-- matched by class+board+language. Demotion only on inactivity (not low score).
CREATE TABLE IF NOT EXISTS public.weekly_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 10),  -- 1=Bronze, 10=Diamond
  week_start_date DATE NOT NULL,                   -- Monday of the league week
  cohort_key TEXT NOT NULL,                        -- e.g. 'cbse-class-8-en'
  member_count INTEGER DEFAULT 0,
  promotion_cutoff INTEGER DEFAULT 5,              -- top N promote
  demotion_cutoff INTEGER DEFAULT 5,               -- bottom N demote (inactivity-based)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tier, week_start_date, cohort_key)
);

CREATE INDEX IF NOT EXISTS idx_leagues_week
  ON public.weekly_leagues(week_start_date DESC, tier);

CREATE TABLE IF NOT EXISTS public.weekly_league_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.weekly_leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekly_xp INTEGER DEFAULT 0,
  -- Anonymous handle: never expose real names in leaderboards. Generated once
  -- per cohort entry so the same student's handle is stable for the week.
  anon_handle TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_league_standings_league
  ON public.weekly_league_standings(league_id, weekly_xp DESC);
CREATE INDEX IF NOT EXISTS idx_league_standings_user
  ON public.weekly_league_standings(user_id);

-- SECURITY DEFINER helper to break a self-referential RLS recursion.
-- Without this, "is the current user in this league?" inside a policy on
-- weekly_league_standings would trigger the same policy on the inner SELECT,
-- and Postgres throws "infinite recursion detected in policy". Same trap I
-- already hit on circle_members; same fix.
CREATE OR REPLACE FUNCTION public.user_is_in_league(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.weekly_league_standings
    WHERE league_id = p_league_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_in_league(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_in_league(UUID) TO authenticated;

ALTER TABLE public.weekly_league_standings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "co-cohort read standings" ON public.weekly_league_standings;
CREATE POLICY "co-cohort read standings" ON public.weekly_league_standings
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.user_is_in_league(league_id)
  );
DROP POLICY IF EXISTS "self insert standing" ON public.weekly_league_standings;
CREATE POLICY "self insert standing" ON public.weekly_league_standings
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "self update standing" ON public.weekly_league_standings;
CREATE POLICY "self update standing" ON public.weekly_league_standings
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- 5. Mastery (Phase 10: SmartScore 0-100 per skill)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mastery_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL,                          -- topic_id in current schema
  subject_slug TEXT,
  -- 0-100 SmartScore. 0-70 practicing (big gains, small penalties),
  -- 71-90 mid-rigor, 90+ Challenge Zone (must consistently nail hard items).
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  band TEXT NOT NULL DEFAULT 'practicing'          -- 'practicing' | 'mid' | 'challenge_zone' | 'mastered'
    CHECK (band IN ('practicing', 'mid', 'challenge_zone', 'mastered')),
  consecutive_correct INTEGER DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  mastered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_mastery_user
  ON public.mastery_scores(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_mastery_subject
  ON public.mastery_scores(user_id, subject_slug, band);

ALTER TABLE public.mastery_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all mastery" ON public.mastery_scores;
CREATE POLICY "self all mastery" ON public.mastery_scores
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 6. Parent + rank (Phase 12)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.parent_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('session_summary', 'weekly_digest', 'monthly_report', 'rank_forecast')),
  title TEXT NOT NULL,
  body_md TEXT,
  pdf_url TEXT,                                    -- Supabase storage path
  share_token TEXT UNIQUE,                         -- WhatsApp-shareable opaque link
  language TEXT DEFAULT 'en',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_parent_artifacts_user
  ON public.parent_artifacts(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_artifacts_token
  ON public.parent_artifacts(share_token) WHERE share_token IS NOT NULL;

ALTER TABLE public.parent_artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read parent artifacts" ON public.parent_artifacts;
CREATE POLICY "self read parent artifacts" ON public.parent_artifacts
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "self insert parent artifact" ON public.parent_artifacts;
CREATE POLICY "self insert parent artifact" ON public.parent_artifacts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Rank predictions: calibrated forecasts with confidence intervals.
-- Honest by design — must show uncertainty, never single-point claims.
CREATE TABLE IF NOT EXISTS public.rank_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prediction_kind TEXT NOT NULL CHECK (prediction_kind IN ('board_percentage', 'jee_main_rank', 'jee_advanced_rank', 'neet_rank', 'school_topper')),
  point_estimate NUMERIC NOT NULL,
  ci_low NUMERIC NOT NULL,                         -- 80% CI lower bound
  ci_high NUMERIC NOT NULL,                        -- 80% CI upper bound
  confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  inputs JSONB NOT NULL,                           -- what we fed the model
  -- Methodology so we can explain to parents:
  method TEXT NOT NULL,                            -- 'historical_quantile' | 'mock_test_regression' | ...
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ                           -- forecasts go stale fast
);

CREATE INDEX IF NOT EXISTS idx_rank_predictions_user_recent
  ON public.rank_predictions(user_id, prediction_kind, generated_at DESC);

ALTER TABLE public.rank_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all rank predictions" ON public.rank_predictions;
CREATE POLICY "self all rank predictions" ON public.rank_predictions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 7. Power features (Phases 13, 14, 15)
-- ============================================================================

-- Magic Notes — student photographs notes; AI extracts → flashcards + practice.
CREATE TABLE IF NOT EXISTS public.notes_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,                      -- Supabase Storage key
  ocr_text TEXT,
  extracted_concepts TEXT[] DEFAULT '{}',
  generated_card_ids UUID[] DEFAULT '{}',
  generated_practice_ids UUID[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ready_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notes_uploads_user_recent
  ON public.notes_uploads(user_id, created_at DESC);

ALTER TABLE public.notes_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all notes uploads" ON public.notes_uploads;
CREATE POLICY "self all notes uploads" ON public.notes_uploads
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Manipulables registry: which interactive (graph plotter, physics sim,
-- molecule viewer, slider) is the default for each topic. Phase 14 reads this
-- so concept cards render an interactive by default rather than a static image.
CREATE TABLE IF NOT EXISTS public.manipulables_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID,                                   -- nullable so a row can apply to a whole subject
  subject_slug TEXT,
  manipulable TEXT NOT NULL,                       -- 'graph_plotter' | 'physics_sim' | 'molecule_viewer' | ...
  config JSONB DEFAULT '{}',                       -- props passed to the component
  is_default BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manipulables_topic
  ON public.manipulables_registry(topic_id) WHERE topic_id IS NOT NULL;

-- Student interests — feeds Khan-style personalized word problems.
CREATE TABLE IF NOT EXISTS public.interests (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interest TEXT NOT NULL,                          -- 'cricket', 'BTS', 'space', 'cooking'
  weight NUMERIC DEFAULT 1.0,                      -- decays over time / boosts on engagement
  source TEXT,                                     -- 'declared' | 'inferred_from_chat' | 'inferred_from_clicks'
  added_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, interest)
);

ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self all interests" ON public.interests;
CREATE POLICY "self all interests" ON public.interests
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 8. Honesty XP audit log (cross-cutting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.honesty_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_kind TEXT NOT NULL CHECK (event_kind IN (
    'exit_eval_completed_correct', 'exit_eval_completed_wrong',
    'exit_eval_skipped',
    'flag_validated', 'flag_rejected',
    'arena_completed', 'arena_skipped',
    'session_completed', 'break_taken', 'break_skipped'
  )),
  delta INTEGER NOT NULL,
  reference_id UUID,                               -- session_eval id, flag id, etc.
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_honesty_xp_user
  ON public.honesty_xp_events(user_id, created_at DESC);

ALTER TABLE public.honesty_xp_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self read honesty xp" ON public.honesty_xp_events;
CREATE POLICY "self read honesty xp" ON public.honesty_xp_events
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "self insert honesty xp" ON public.honesty_xp_events;
CREATE POLICY "self insert honesty xp" ON public.honesty_xp_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 9. Seed: trusted content sources (the registry the freshness pipeline reads)
-- ============================================================================

INSERT INTO public.content_sources (name, kind, url, license, trust_score, trust_reason, subjects, language, added_by)
VALUES
  ('NASA News',                'news_feed',     'https://www.nasa.gov/news/all/feed/',                        'public_domain', 0.95, 'US federal government — public domain',                                ARRAY['science', 'astronomy'],         'en', 'system'),
  ('ISRO',                     'news_feed',     'https://www.isro.gov.in/rss/news.xml',                       'standard',      0.95, 'Indian Space Research Organisation — official',                        ARRAY['science', 'astronomy'],         'en', 'system'),
  ('NOAA',                     'news_feed',     'https://www.noaa.gov/news/feed.xml',                         'public_domain', 0.9,  'US ocean / atmospheric agency — public domain',                        ARRAY['science', 'environmental'],     'en', 'system'),
  ('Nature Highlights',        'rss',           'https://www.nature.com/nature.rss',                          'standard',      0.92, 'Top-tier peer-reviewed journal',                                       ARRAY['science', 'biology'],           'en', 'system'),
  ('arXiv math.HO',            'rss',           'https://export.arxiv.org/rss/math.HO',                       'CC-BY',         0.85, 'Math history & overview preprints',                                    ARRAY['math'],                         'en', 'system'),
  ('3Blue1Brown',              'youtube_channel', 'https://www.youtube.com/@3blue1brown',                     'standard_youtube', 0.95, 'Grant Sanderson — best-in-class math visual explanations',          ARRAY['math'],                         'en', 'system'),
  ('Veritasium',               'youtube_channel', 'https://www.youtube.com/@veritasium',                       'standard_youtube', 0.92, 'Derek Muller — physics/science with strong evidence base',           ARRAY['science', 'physics'],           'en', 'system'),
  ('Khan Academy India',       'youtube_channel', 'https://www.youtube.com/@khanacademyindia',                 'standard_youtube', 0.95, 'Khan Academy India — NCERT-aligned',                                  ARRAY['math', 'science'],              'en', 'system'),
  ('CrashCourse Kids',         'youtube_channel', 'https://www.youtube.com/@crashcoursekids',                  'standard_youtube', 0.9,  'PBS-Hank Green production for K-5',                                   ARRAY['science', 'history'],           'en', 'system'),
  ('NPTEL',                    'youtube_channel', 'https://www.youtube.com/@iit',                              'standard_youtube', 0.92, 'IIT/IISc-led course content — government-backed',                     ARRAY['math', 'science', 'engineering'], 'en', 'system'),
  ('MIT OpenCourseWare',       'youtube_channel', 'https://www.youtube.com/@mitocw',                           'CC-BY-NC-SA',   0.95, 'MIT Open CourseWare — formal license',                                ARRAY['math', 'science', 'engineering'], 'en', 'system'),
  ('TED-Ed',                   'youtube_channel', 'https://www.youtube.com/@TEDEd',                            'standard_youtube', 0.85, 'TED-Ed — heavily edited, fact-checked animations',                    ARRAY['science', 'history', 'english'], 'en', 'system'),
  ('CCSS / NCERT',             'curated_human', NULL,                                                          'standard',      0.95, 'Authored by us from official curriculum docs',                         ARRAY['math', 'science', 'english', 'social'], 'en', 'system'),
  ('CERN News',                'rss',           'https://home.cern/api/news/news/feed.rss',                   'CC-BY',         0.92, 'European particle physics — peer-reviewed body',                       ARRAY['science', 'physics'],           'en', 'system'),
  ('Khan Academy (English)',   'youtube_channel', 'https://www.youtube.com/@khanacademy',                      'standard_youtube', 0.95, 'Khan Academy main channel',                                            ARRAY['math', 'science', 'english', 'social'], 'en', 'system')
ON CONFLICT DO NOTHING;
