-- ============================================================================
-- Migration 017: Fix Study Circles RLS recursion
--
-- Migration 016 wrote policies on circle_members that self-referenced
-- circle_members inside EXISTS(...). Postgres detects this as infinite
-- recursion at query time. The migration applied cleanly, but every cross-
-- member SELECT (e.g., "how many members in this circle?") failed at runtime
-- with: "infinite recursion detected in policy for relation circle_members".
--
-- Fix: a SECURITY DEFINER helper that bypasses RLS internally. All cross-
-- referencing policies now route through it, breaking the recursion.
-- ============================================================================

-- Helper: is the current user a member of this circle?
-- SECURITY DEFINER means the body runs with the function owner's privileges
-- (postgres), which bypasses the row-level policy on circle_members inside
-- the function — this is the standard Supabase pattern for recursive checks.
CREATE OR REPLACE FUNCTION public.user_is_circle_member(p_circle_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = p_circle_id AND user_id = auth.uid()
  );
$$;

-- Lock the function down: only authenticated roles may call it.
REVOKE ALL ON FUNCTION public.user_is_circle_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_circle_member(UUID) TO authenticated;

-- =====  study_circles — no longer queries circle_members directly =====
DROP POLICY IF EXISTS "members can view their circles" ON public.study_circles;
CREATE POLICY "members can view their circles" ON public.study_circles
  FOR SELECT USING (
    created_by = auth.uid()
    OR public.user_is_circle_member(id)
  );

-- =====  circle_members — self-read + definer function for co-members =====
DROP POLICY IF EXISTS "members can view co-members" ON public.circle_members;
CREATE POLICY "members can view co-members" ON public.circle_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.user_is_circle_member(circle_id)
  );

-- =====  shared_challenges — route membership check through definer =====
DROP POLICY IF EXISTS "members can see shared challenges" ON public.circle_shared_challenges;
CREATE POLICY "members can see shared challenges" ON public.circle_shared_challenges
  FOR SELECT USING (
    public.user_is_circle_member(circle_id)
  );

DROP POLICY IF EXISTS "members can create shared challenges" ON public.circle_shared_challenges;
CREATE POLICY "members can create shared challenges" ON public.circle_shared_challenges
  FOR INSERT WITH CHECK (
    public.user_is_circle_member(circle_id)
  );

DROP POLICY IF EXISTS "founder can update shared challenge" ON public.circle_shared_challenges;
CREATE POLICY "founder can update shared challenge" ON public.circle_shared_challenges
  FOR UPDATE USING (
    public.user_is_circle_member(circle_id)
  );

-- =====  challenge_completions — also route through definer =====
DROP POLICY IF EXISTS "co-members can see completions" ON public.circle_challenge_completions;
CREATE POLICY "co-members can see completions" ON public.circle_challenge_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.circle_shared_challenges csc
      WHERE csc.id = circle_challenge_completions.challenge_id
        AND public.user_is_circle_member(csc.circle_id)
    )
  );
