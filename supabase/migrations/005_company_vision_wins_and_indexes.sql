-- O'Boyle Acquisition Operating System — Company Vision wins + hot-path indexes
-- Migration: 005_company_vision_wins_and_indexes
--
-- Safety: additive only. Widens an existing CHECK constraint (drop + recreate
-- with a superset of allowed values — no rows are touched) and adds indexes
-- (CREATE INDEX IF NOT EXISTS). Nothing here deletes or resets existing data.

-- ─────────────────────────────────────────────────────────────────────────────
-- "Record a major win" reuses company_story_entries as a running log (unlike
-- ceo_review/company_story/next_milestone, wins are never superseded — every
-- entry stays is_current so they display as a list).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE company_story_entries DROP CONSTRAINT IF EXISTS company_story_entries_entry_type_check;
ALTER TABLE company_story_entries ADD CONSTRAINT company_story_entries_entry_type_check
  CHECK (entry_type IN ('ceo_review','company_story','obstacle','next_milestone','stage_explainer','major_win'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Composite indexes for query patterns introduced in this pass — the single-
-- column indexes already in place don't cover (user_id + range/order) as
-- efficiently as these do.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_time_entries_user_started ON time_entries(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_blockers_user_status ON blockers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_created ON activity_log(user_id, created_at DESC);