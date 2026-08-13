-- O'Boyle Acquisition Operating System — Leads/Buyers/Deals CRUD support
-- Migration: 008_leads_buyers_deals_crud
--
-- Safety: additive only (ADD COLUMN IF NOT EXISTS). Nothing here deletes or
-- resets existing data. New columns inherit the existing table-level RLS
-- policies automatically.

-- ─────────────────────────────────────────────────────────────────────────────
-- buyers — status + last contact tracking (requested CRUD fields that didn't
-- already exist)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'do_not_contact'));

ALTER TABLE buyers ADD COLUMN IF NOT EXISTS last_contact_date DATE;

CREATE INDEX IF NOT EXISTS idx_buyers_status ON buyers(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- deals — overall pipeline stage. Distinct from title_status (title work) and
-- closing_status (closing logistics) which already exist and are preserved
-- as-is — this is the higher-level "where is this deal in the funnel" stage.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS deal_stage TEXT NOT NULL DEFAULT 'analyzing'
    CHECK (deal_stage IN (
      'analyzing', 'negotiating', 'under_contract', 'finding_buyer',
      'assigned', 'closing', 'closed', 'dead'
    ));

CREATE INDEX IF NOT EXISTS idx_deals_deal_stage ON deals(deal_stage);
