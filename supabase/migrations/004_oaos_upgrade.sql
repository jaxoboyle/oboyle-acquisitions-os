-- O'Boyle Acquisition Operating System — upgrade migration
-- Migration: 004_oaos_upgrade
-- Date: 2026-08-04
--
-- Adds: Company Vision tracking (15-year / $100M plan), notification
-- preferences, phone verification, and push/SMS delivery audit logs.
--
-- Safety: every statement is additive (CREATE TABLE IF NOT EXISTS,
-- CREATE INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS before
-- recreate). Nothing here deletes or resets existing data. Reuses
-- profiles.timezone and company_settings.notification_quiet_start/end
-- rather than duplicating them.

-- ─────────────────────────────────────────────────────────────────────────────
-- Company Vision — $100M / 15-year tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- Time-series log of verified company metrics. The most recent row per user
-- is "current." Historical rows are the audit trail — nothing is overwritten.
CREATE TABLE IF NOT EXISTS company_vision_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Tracked SEPARATELY — never conflate asset value, equity, and revenue.
  owned_asset_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  estimated_equity NUMERIC(14,2) NOT NULL DEFAULT 0,
  annual_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  cash_reserves NUMERIC(14,2) NOT NULL DEFAULT 0,

  acquisitions_completed INTEGER NOT NULL DEFAULT 0,
  shopping_centers_owned INTEGER NOT NULL DEFAULT 0,
  strip_centers_owned INTEGER NOT NULL DEFAULT 0,
  multifamily_units_owned INTEGER NOT NULL DEFAULT 0,
  commercial_sqft_controlled NUMERIC(14,2) NOT NULL DEFAULT 0,

  current_stage INTEGER NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 6),
  notes TEXT,
  entered_by TEXT NOT NULL DEFAULT 'user' CHECK (entered_by IN ('user','big_stein')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvm_user_date ON company_vision_metrics(user_id, recorded_date DESC);

-- Planned vs. actual asset value per year of the 15-year plan.
CREATE TABLE IF NOT EXISTS annual_company_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  target_year INTEGER NOT NULL,
  planned_asset_value NUMERIC(14,2) NOT NULL,
  actual_asset_value NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, target_year)
);

CREATE INDEX IF NOT EXISTS idx_act_user_year ON annual_company_targets(user_id, target_year);

-- Stage milestones, future targets, and major wins/turning points.
CREATE TABLE IF NOT EXISTS company_vision_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  stage INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 6),
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','completed','missed')),
  completed_at TIMESTAMPTZ,
  is_turning_point BOOLEAN NOT NULL DEFAULT FALSE,
  display_order NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvmile_user_stage ON company_vision_milestones(user_id, stage);

-- Narrative content: Big Stein's CEO review, the company story, obstacles,
-- next-milestone framing, and stage explainers. Historical entries are kept
-- (is_current marks the latest of each type) so the review has a paper trail.
CREATE TABLE IF NOT EXISTS company_story_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('ceo_review','company_story','obstacle','next_milestone','stage_explainer')),
  title TEXT,
  content TEXT NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'big_stein' CHECK (generated_by IN ('big_stein','user')),
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cse_user_type ON company_story_entries(user_id, entry_type, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications — push + SMS
-- ─────────────────────────────────────────────────────────────────────────────

-- One row per user. Quiet hours and timezone live on company_settings /
-- profiles already — not duplicated here.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,

  phone_e164 TEXT,
  phone_country_code TEXT NOT NULL DEFAULT '+1',
  phone_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (phone_status IN ('unverified','pending','verified')),
  phone_consent_given_at TIMESTAMPTZ,

  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  morning_plan BOOLEAN NOT NULL DEFAULT TRUE,
  task_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  overdue_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  evening_review BOOLEAN NOT NULL DEFAULT TRUE,
  sunday_report BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phone verification codes — never stored as plain text, only their hash.
CREATE TABLE IF NOT EXISTS phone_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verif_user ON phone_verifications(user_id, created_at DESC);

-- Generic outbound-notification audit trail (push + SMS), used for both the
-- Settings "notification history" list and rate-limiting test sends.
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('push','sms')),
  notification_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed','rate_limited','not_configured')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_deliv_user ON notification_deliveries(user_id, created_at DESC);

-- Twilio-specific send log. Only the last 4 digits of the destination
-- number are stored, and never the account auth token or full message body.
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  to_phone_last4 TEXT,
  provider TEXT NOT NULL DEFAULT 'twilio',
  provider_message_id TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('sent','failed','rate_limited','not_configured','invalid_number')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_user ON sms_logs(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers (reuses set_updated_at() from 001_initial_schema.sql)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'annual_company_targets', 'company_vision_milestones', 'notification_preferences'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at_%I ON %I;
      CREATE TRIGGER set_updated_at_%I
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — every table, own-records-only
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE company_vision_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_company_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_vision_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_story_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_vision_metrics: own records" ON company_vision_metrics;
CREATE POLICY "company_vision_metrics: own records" ON company_vision_metrics
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "annual_company_targets: own records" ON annual_company_targets;
CREATE POLICY "annual_company_targets: own records" ON annual_company_targets
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "company_vision_milestones: own records" ON company_vision_milestones;
CREATE POLICY "company_vision_milestones: own records" ON company_vision_milestones
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "company_story_entries: own records" ON company_story_entries;
CREATE POLICY "company_story_entries: own records" ON company_story_entries
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_preferences: own record" ON notification_preferences;
CREATE POLICY "notification_preferences: own record" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- phone_verifications: no client-side access at all — codes are only ever
-- read/written by server-side API routes using the service-role key.
DROP POLICY IF EXISTS "phone_verifications: no client access" ON phone_verifications;
CREATE POLICY "phone_verifications: no client access" ON phone_verifications
  FOR ALL USING (false);

DROP POLICY IF EXISTS "notification_deliveries: read own" ON notification_deliveries;
CREATE POLICY "notification_deliveries: read own" ON notification_deliveries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sms_logs: read own" ON sms_logs;
CREATE POLICY "sms_logs: read own" ON sms_logs
  FOR SELECT USING (auth.uid() = user_id);
