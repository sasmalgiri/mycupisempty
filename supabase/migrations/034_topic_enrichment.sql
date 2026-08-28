-- ===========================================================================
-- Migration 034 — Topic enrichment cache
--
-- curriculum_topics holds a syllabus OUTLINE ("Quadratic formula" +
-- ['Discriminant, roots, nature.']) — about six words. The Conversion Engine
-- classifier needs prose to read, so conversion-enrich.ts generates the
-- teaching text once and caches it here.
--
-- Keyed by a hash of (topic id + title + objectives), so editing the syllabus
-- row invalidates the generated lesson automatically.
--
-- Idempotent. Nothing here is destructive.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.topic_enrichment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.curriculum_topics(id) ON DELETE CASCADE,

    -- sha256(topic_id :: title_en :: objectives).slice(0,32)
    enrichment_key TEXT NOT NULL,
    title_en TEXT,

    -- [{ unitId, topicId, heading, body, _modelKind }]
    -- One entry per unit of the topic. Each unit is deliberately ONE kind of
    -- knowledge — that separation is what lets the engine give different parts
    -- of one topic different treatments.
    units JSONB NOT NULL DEFAULT '[]',

    generated_by TEXT DEFAULT 'gemini',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(enrichment_key)
);

CREATE INDEX IF NOT EXISTS idx_topic_enrichment_topic
    ON public.topic_enrichment(topic_id);

ALTER TABLE public.topic_enrichment ENABLE ROW LEVEL SECURITY;

-- Enrichment is generated curriculum content, not student data — no PII.
-- Globally readable so one student's generation warms the cache for everyone.
CREATE POLICY "All users read topic enrichment"
    ON public.topic_enrichment FOR SELECT USING (true);
CREATE POLICY "Authenticated users write topic enrichment"
    ON public.topic_enrichment FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users update topic enrichment"
    ON public.topic_enrichment FOR UPDATE USING (auth.role() = 'authenticated');

-- ===========================================================================
-- retention_probe_queue — the delayed-outcome loop, made concrete
--
-- Without this, conversion_outcomes.retention_score stays NULL forever, every
-- outcome stays provisional, and the engine never learns. The nightly cron
-- (/api/conversion-probe) fills this queue; the student's next session drains
-- it by asking the question and POSTing the answer to /api/conversion.
--
-- notification_log was not reusable here: it has no metadata column, so a
-- probe could not carry the outcome_id it needs to resolve against.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.retention_probe_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    outcome_id UUID NOT NULL REFERENCES public.conversion_outcomes(id) ON DELETE CASCADE,

    unit_id TEXT,
    topic_id UUID REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,
    knowledge_type TEXT NOT NULL,
    representation TEXT NOT NULL,

    -- The question asks the student to PERFORM, never to self-rate. "Do you
    -- still remember?" measures confidence; "do it again now" measures
    -- retention, and those two come apart badly — which is the whole reason
    -- this loop exists.
    question TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'answered', 'expired')),
    due_at TIMESTAMPTZ NOT NULL,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One live probe per outcome.
    UNIQUE(outcome_id)
);

CREATE INDEX IF NOT EXISTS idx_probe_queue_pending
    ON public.retention_probe_queue(user_id, due_at)
    WHERE status = 'pending';

ALTER TABLE public.retention_probe_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own probes"
    ON public.retention_probe_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own probes"
    ON public.retention_probe_queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own probes"
    ON public.retention_probe_queue FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Parents read linked student probes"
    ON public.retention_probe_queue FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parent_student_links psl
            WHERE psl.parent_id = auth.uid()
              AND psl.student_id = public.retention_probe_queue.user_id
        )
    );
