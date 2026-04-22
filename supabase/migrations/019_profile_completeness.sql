-- ============================================================================
-- Migration 019: Profile completeness — parental consent + smarter signup trigger
--
-- Two real problems found auditing the signup → profile pipeline:
--
-- 1. Parental consent is captured at signup (parent_email, parent_consent_given,
--    parent_consent_date) and placed in auth.users.raw_user_meta_data, but
--    the profiles table never had columns to receive it. So for every minor
--    student whose parent consented via the signup form, that consent is lost
--    the moment the form submits. That's a real compliance hole for a K-12
--    product — COPPA / India DPDP / EU-GDPR all require documented consent
--    for processing minors' data.
--
-- 2. The handle_new_user trigger only copied `full_name` from metadata, even
--    though signup also writes `current_class`, `role`, `parent_*` fields.
--    Signup's explicit .update() patched class/role/board for students who go
--    through the form — but any non-form path (Google OAuth, programmatic
--    account creation, password reset flows that re-insert) ended up with a
--    hollow profile. Now the trigger pulls everything it can from metadata.
-- ============================================================================

-- === Columns for parental consent ===
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_email TEXT,
  ADD COLUMN IF NOT EXISTS parent_consent_given BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_consent_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_consent_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Index so admin / compliance queries (e.g., "which minor accounts don't have
-- consent on file?") aren't table scans once the user base grows.
CREATE INDEX IF NOT EXISTS idx_profiles_parent_consent
  ON public.profiles(parent_consent_given)
  WHERE parent_consent_given = FALSE;

-- === Smarter handle_new_user trigger ===
-- Idempotent: CREATE OR REPLACE works even if the function was already live,
-- and each INSERT uses ON CONFLICT DO NOTHING so a stray duplicate insert
-- from the trigger doesn't crash the auth.users insert transaction.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Core profile row — pull everything signup stuffed into user_metadata.
  -- Falls back gracefully when fields are missing (e.g., Google OAuth signup
  -- will only have full_name / email; class/role default to column defaults).
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    current_class,
    board_code,
    parent_email,
    parent_consent_given,
    parent_consent_date
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NULLIF(NEW.raw_user_meta_data->>'current_class', '')::INTEGER,
    NEW.raw_user_meta_data->>'board_code',
    NEW.raw_user_meta_data->>'parent_email',
    COALESCE((NEW.raw_user_meta_data->>'parent_consent_given')::BOOLEAN, FALSE),
    NULLIF(NEW.raw_user_meta_data->>'parent_consent_date', '')::TIMESTAMPTZ
  ) ON CONFLICT (id) DO NOTHING;

  -- Companion tables — unchanged from the original trigger. Wrapped in
  -- ON CONFLICT so re-running the trigger (via a test or a superuser
  -- re-insert) doesn't blow up.
  INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.learning_styles (user_id)
    VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.multiple_intelligences (user_id)
    VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.daily_goals (user_id, goal_date)
    VALUES (NEW.id, CURRENT_DATE) ON CONFLICT (user_id, goal_date) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger itself is idempotent (CREATE OR REPLACE).
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- === Backfill: existing minor accounts whose parent_email was in metadata ===
-- For users created before this migration, pull the consent fields from
-- auth.users.raw_user_meta_data into the new columns. One-time; safe to
-- run multiple times because UPDATE is keyed on parent_consent_given being
-- missing on the profile.
UPDATE public.profiles p
SET
  parent_email = au.raw_user_meta_data->>'parent_email',
  parent_consent_given = COALESCE((au.raw_user_meta_data->>'parent_consent_given')::BOOLEAN, FALSE),
  parent_consent_date = NULLIF(au.raw_user_meta_data->>'parent_consent_date', '')::TIMESTAMPTZ
FROM auth.users au
WHERE au.id = p.id
  AND p.parent_email IS NULL
  AND au.raw_user_meta_data->>'parent_email' IS NOT NULL;
