-- ===========================================================================
-- Migration 033 — Conversion Engine
--
-- Adds the two tables the conversion engine needs. It deliberately does NOT
-- add a priors table: learned_priors (migration 013) is already generic over
-- (context_key, action_key), so conversionContextKey() slots straight in with
-- action_key = the representation code. Existing aggregation picks it up.
--
-- Nothing here is destructive. No existing table is altered.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. content_classifications — cache of "what kind of knowledge is this unit"
--
-- Classification is deterministic for a given text, so we key on a hash of the
-- unit text. Re-running the classifier on an unchanged chapter is free.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES public.curriculum_chapters(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.curriculum_topics(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL,                  -- unit index within the chapter ('u1', 'u2', …)
    unit_hash TEXT NOT NULL,                -- hash of unit text; invalidates on edit
    unit_preview TEXT,                      -- first ~200 chars, for the audit panel

    knowledge_type TEXT NOT NULL,           -- arbitrary_fact | causal_sequence | concept |
                                            -- procedure | relational_structure | judgment
    confidence NUMERIC DEFAULT 0,           -- 0..1, margin over the runner-up
    ambiguous BOOLEAN DEFAULT FALSE,        -- true = SAFETY_ORDER broke the tie upward
    runner_up TEXT,
    distribution JSONB DEFAULT '{}',        -- full normalised distribution over all 6 types
    cues JSONB DEFAULT '[]',                -- which cues fired — a teacher must be able to audit this

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(unit_hash)
);

CREATE INDEX IF NOT EXISTS idx_content_class_chapter
    ON public.content_classifications(chapter_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_content_class_type
    ON public.content_classifications(knowledge_type);

ALTER TABLE public.content_classifications ENABLE ROW LEVEL SECURITY;

-- Classifications describe curriculum content, not students — no PII, globally readable.
CREATE POLICY "All users read content classifications"
    ON public.content_classifications FOR SELECT USING (true);
CREATE POLICY "Authenticated users write content classifications"
    ON public.content_classifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users update content classifications"
    ON public.content_classifications FOR UPDATE USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 2. conversion_outcomes — did this representation actually work, for this
--    student, on THIS KIND of knowledge?
--
-- This is the table that answers the founder's objection that a couple of
-- questions cannot decide a learning method. Every row is one observation.
-- The engine will not claim a pattern below 5 rows, nor claim confidence
-- below 15 (see EVIDENCE_BANDS in conversion-engine.ts).
--
-- retention_score is NULL until the probe fires. Rows with a null retention
-- score are explicitly weak evidence — rewardFor() pulls them toward neutral
-- so one enjoyable session cannot move the recommendation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversion_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.curriculum_subjects_by_class(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,
    chapter_id UUID REFERENCES public.curriculum_chapters(id) ON DELETE SET NULL,
    unit_id TEXT,

    knowledge_type TEXT NOT NULL,
    representation TEXT NOT NULL,

    -- Lorayne's finding, made measurable: a mnemonic the student BUILT beats
    -- one they were handed. rewardFor() halves the credit when this is false.
    constructed_own BOOLEAN DEFAULT FALSE,

    immediate_score NUMERIC,                -- 0..1, the post-check
    retention_score NUMERIC,                -- 0..1, NULL until the probe fires
    engagement_score NUMERIC,               -- 0..1
    completed BOOLEAN DEFAULT FALSE,
    time_spent_seconds INTEGER DEFAULT 0,

    reward NUMERIC,                         -- computed by rewardFor()
    provisional BOOLEAN DEFAULT TRUE,       -- true while retention_score IS NULL

    -- The delayed-outcome loop. A cron sweeps rows where this has passed and
    -- retention_score is still null, and schedules the probe question.
    retention_probe_at TIMESTAMPTZ,
    experience_id UUID,                     -- link back to experiences(id)

    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- The hot path: "give me this student's stats for this subject × knowledge type".
CREATE INDEX IF NOT EXISTS idx_conv_outcomes_lookup
    ON public.conversion_outcomes(user_id, subject_id, knowledge_type, representation);

-- The cron path: which probes are due?
CREATE INDEX IF NOT EXISTS idx_conv_outcomes_probe_due
    ON public.conversion_outcomes(retention_probe_at)
    WHERE retention_score IS NULL;

ALTER TABLE public.conversion_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own conversion outcomes"
    ON public.conversion_outcomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own conversion outcomes"
    ON public.conversion_outcomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own conversion outcomes"
    ON public.conversion_outcomes FOR UPDATE USING (auth.uid() = user_id);

-- Parents may read their linked child's outcomes (mirrors the pattern used by
-- parent_student_links elsewhere in the schema).
CREATE POLICY "Parents read linked student conversion outcomes"
    ON public.conversion_outcomes FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parent_student_links psl
            WHERE psl.parent_id = auth.uid()
              AND psl.student_id = public.conversion_outcomes.user_id
        )
    );
