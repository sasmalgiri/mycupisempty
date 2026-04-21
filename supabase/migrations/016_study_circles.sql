-- ============================================================================
-- Migration 016: Study Circles
-- Small peer groups (2-6 students) who share a join code and see a daily
-- shared challenge. First pass at collaborative learning — no chat, no feed,
-- just visibility and a shared goal.
-- ============================================================================

-- A circle is created by a student and gets a short invite code.
CREATE TABLE IF NOT EXISTS public.study_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,  -- 6-char uppercase code students share
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  max_members INTEGER NOT NULL DEFAULT 6,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_study_circles_invite_code ON public.study_circles(invite_code);
CREATE INDEX IF NOT EXISTS idx_study_circles_created_by ON public.study_circles(created_by);

-- Membership. A student can be in multiple circles (e.g., class circle + friend circle).
CREATE TABLE IF NOT EXISTS public.circle_members (
  circle_id UUID NOT NULL REFERENCES public.study_circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT NOT NULL DEFAULT 'member',  -- 'founder' | 'member'
  PRIMARY KEY (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_members_user_id ON public.circle_members(user_id);

-- Each day, each circle surfaces one shared challenge that everyone sees.
-- Populated lazily on first view of the day.
CREATE TABLE IF NOT EXISTS public.circle_shared_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.study_circles(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL,
  prompt TEXT NOT NULL,
  subject_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, challenge_date)
);

-- Who completed today's shared challenge
CREATE TABLE IF NOT EXISTS public.circle_challenge_completions (
  challenge_id UUID NOT NULL REFERENCES public.circle_shared_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response TEXT,
  PRIMARY KEY (challenge_id, user_id)
);

-- ============================================================================
-- RLS: students can only see circles they are members of
-- ============================================================================

ALTER TABLE public.study_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_shared_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_challenge_completions ENABLE ROW LEVEL SECURITY;

-- study_circles: creator can always read, members can read, anyone can read by invite_code
DROP POLICY IF EXISTS "members can view their circles" ON public.study_circles;
CREATE POLICY "members can view their circles" ON public.study_circles
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.circle_members cm
      WHERE cm.circle_id = study_circles.id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "creator can insert circle" ON public.study_circles;
CREATE POLICY "creator can insert circle" ON public.study_circles
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "creator can update circle" ON public.study_circles;
CREATE POLICY "creator can update circle" ON public.study_circles
  FOR UPDATE USING (created_by = auth.uid());

-- circle_members: members can see other members of their circles
DROP POLICY IF EXISTS "members can view co-members" ON public.circle_members;
CREATE POLICY "members can view co-members" ON public.circle_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.circle_members me
      WHERE me.circle_id = circle_members.circle_id AND me.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "self can insert own membership" ON public.circle_members;
CREATE POLICY "self can insert own membership" ON public.circle_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "self can leave circle" ON public.circle_members;
CREATE POLICY "self can leave circle" ON public.circle_members
  FOR DELETE USING (user_id = auth.uid());

-- circle_shared_challenges: visible to members
DROP POLICY IF EXISTS "members can see shared challenges" ON public.circle_shared_challenges;
CREATE POLICY "members can see shared challenges" ON public.circle_shared_challenges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.circle_members cm
      WHERE cm.circle_id = circle_shared_challenges.circle_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members can create shared challenges" ON public.circle_shared_challenges;
CREATE POLICY "members can create shared challenges" ON public.circle_shared_challenges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.circle_members cm
      WHERE cm.circle_id = circle_shared_challenges.circle_id AND cm.user_id = auth.uid()
    )
  );

-- circle_challenge_completions: self-write, visible to co-members
DROP POLICY IF EXISTS "co-members can see completions" ON public.circle_challenge_completions;
CREATE POLICY "co-members can see completions" ON public.circle_challenge_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.circle_shared_challenges csc
      JOIN public.circle_members cm ON cm.circle_id = csc.circle_id
      WHERE csc.id = circle_challenge_completions.challenge_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "self can complete challenge" ON public.circle_challenge_completions;
CREATE POLICY "self can complete challenge" ON public.circle_challenge_completions
  FOR INSERT WITH CHECK (user_id = auth.uid());
