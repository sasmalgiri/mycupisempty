-- =====================================================
-- MyCupIsEmpty - Security Fixes
-- =====================================================

-- Remove overly-broad policy that exposes all active classrooms.
-- Invite-code join/lookup should be done via server-side API routes.
DROP POLICY IF EXISTS "Anyone can lookup classroom by invite code" ON public.classrooms;
