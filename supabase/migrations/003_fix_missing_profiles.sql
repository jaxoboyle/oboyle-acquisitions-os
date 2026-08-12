-- Big Stein — Fix: missing profiles table + auth signup trigger
-- Migration: 003_fix_missing_profiles
-- Date: 2026-08-03
--
-- Root cause: 001_initial_schema.sql runs as a single transaction. If
-- `CREATE EXTENSION pg_cron` (or pg_net) fails — e.g. because pg_cron
-- must be enabled via Supabase Dashboard > Database > Extensions before
-- it can be created from SQL — the whole transaction rolls back,
-- silently undoing every CREATE TABLE that ran after it, including
-- `profiles`. The `on_auth_user_created` trigger still fires on every
-- signup and fails with "relation profiles does not exist" because the
-- table it inserts into was never actually created.
--
-- This migration is fully additive/idempotent:
--   - CREATE TABLE ... IF NOT EXISTS
--   - CREATE OR REPLACE FUNCTION
--   - DROP TRIGGER/POLICY IF EXISTS before recreating
--   - ALTER TABLE ... ENABLE ROW LEVEL SECURITY (no-op if already enabled)
-- Nothing here deletes or resets existing rows. Safe to run multiple times.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Extensions — make pg_cron / pg_net non-fatal so this can never again
--    abort table creation. uuid-ossp is required (uuid_generate_v4() is
--    the default on every table's id column).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_cron";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not enabled (%). Enable it via Supabase Dashboard > Database > Extensions if you need scheduled jobs.', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pg_net";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net not enabled (%). Enable it via Supabase Dashboard > Database > Extensions if you need HTTP from SQL.', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Recreate the two tables the signup trigger writes to
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  daily_work_target_minutes INTEGER NOT NULL DEFAULT 600,
  sunday_work_target_minutes INTEGER NOT NULL DEFAULT 180,
  web_search_mode TEXT NOT NULL DEFAULT 'ask'
    CHECK (web_search_mode IN ('auto','ask','manual','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT 'My Real Estate Company',
  thirty_day_revenue_target NUMERIC(12,2) NOT NULL DEFAULT 10000.00,
  ai_monthly_token_limit INTEGER NOT NULL DEFAULT 1000000,
  ai_tokens_used_this_month INTEGER NOT NULL DEFAULT 0,
  ai_token_month_reset DATE NOT NULL DEFAULT CURRENT_DATE,
  notification_quiet_start TIME NOT NULL DEFAULT '21:00',
  notification_quiet_end TIME NOT NULL DEFAULT '07:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. updated_at trigger (safe to redeclare + reattach)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_company_settings ON public.company_settings;
CREATE TRIGGER set_updated_at_company_settings
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Auth signup trigger — schema-qualified + explicit search_path so a
--    SECURITY DEFINER function invoked from the auth schema can never
--    again fail to resolve `profiles` / `company_settings` unqualified.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.company_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS for these two tables (idempotent — matches 002_row_level_security.sql)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: own record" ON public.profiles;
CREATE POLICY "profiles: own record" ON public.profiles
  FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "company_settings: own record" ON public.company_settings;
CREATE POLICY "company_settings: own record" ON public.company_settings
  FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill — create profiles/company_settings rows for any auth user
--    that already signed up while the table was missing.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.company_settings (user_id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.company_settings cs ON cs.user_id = u.id
WHERE cs.user_id IS NULL
ON CONFLICT DO NOTHING;
