-- ============================================================================
-- Migration 018: Circle member count helper + tighten completions RLS
--
-- Two issues uncovered in deep-dive audit:
--
-- 1. The /api/circles join handler counts existing members to enforce
--    max_members. Under RLS (017), a non-member sees zero rows in
--    circle_members for that circle, so the count is always 0 and the size
--    check is bypassed. A 6-max circle can grow to 7, 8, 9 members.
--    Fix: a SECURITY DEFINER count function the API calls before insert.
--
-- 2. circle_challenge_completions INSERT policy was just `user_id = auth.uid()`,
--    letting any authenticated user insert a completion for any challenge_id —
--    including circles they aren't a member of. Tighten with EXISTS check
--    routed through the existing user_is_circle_member helper.
-- ============================================================================

-- Member-count helper. SECURITY DEFINER bypasses RLS so the API can do the
-- max-members pre-flight check honestly. Stable + read-only — safe to expose.
CREATE OR REPLACE FUNCTION public.get_circle_member_count(p_circle_id UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.circle_members
  WHERE circle_id = p_circle_id;
$$;

REVOKE ALL ON FUNCTION public.get_circle_member_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_circle_member_count(UUID) TO authenticated;

-- Tighten the completions INSERT policy. user_is_circle_member() came from
-- migration 017 and bypasses recursive RLS internally.
DROP POLICY IF EXISTS "self can complete challenge" ON public.circle_challenge_completions;
CREATE POLICY "self can complete challenge" ON public.circle_challenge_completions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.circle_shared_challenges csc
      WHERE csc.id = circle_challenge_completions.challenge_id
        AND public.user_is_circle_member(csc.circle_id)
    )
  );
