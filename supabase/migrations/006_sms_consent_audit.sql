-- O'Boyle Acquisition Operating System — SMS consent audit trail
-- Migration: 006_sms_consent_audit
--
-- Safety: additive only. New table + new nullable column on an existing
-- table. Nothing here deletes or resets existing data.

-- Which version of the consent wording the user last agreed to — lets the
-- exact language shown be reconstructed even if the copy changes later.
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS sms_consent_version TEXT;

-- Append-only audit trail of every consent grant/withdrawal: who, when,
-- which wording version, and a snapshot of the exact text shown at the
-- time. Required for SMS carrier registration compliance.
CREATE TABLE IF NOT EXISTS sms_consent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('given', 'withdrawn')),
  consent_version TEXT NOT NULL,
  consent_text TEXT NOT NULL,
  phone_e164_last4 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_consent_events_user ON sms_consent_events(user_id, created_at DESC);

ALTER TABLE sms_consent_events ENABLE ROW LEVEL SECURITY;

-- Own records: users can read their own consent history and insert new
-- events for themselves (given/withdrawn), but the log is never editable
-- or deletable by the client — it's an audit trail, not a mutable setting.
DROP POLICY IF EXISTS "sms_consent_events: read own" ON sms_consent_events;
CREATE POLICY "sms_consent_events: read own" ON sms_consent_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sms_consent_events: insert own" ON sms_consent_events;
CREATE POLICY "sms_consent_events: insert own" ON sms_consent_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
