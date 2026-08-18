-- O'Boyle Acquisition Operating System — ARV / Cash Offer Calculator
-- Migration: 011_arv_calculator
--
-- Safety: additive only (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT
-- EXISTS). Nothing here touches leads/buyers/deals/file_attachments data.
-- Each "Run ARV" produces a NEW arv_analyses row rather than overwriting a
-- prior one, so per-property history is preserved automatically. The
-- legacy single-value leads.arv / leads.estimated_repair_costs / leads.mao /
-- leads.offer_amount columns are updated as a "latest snapshot" convenience
-- when an analysis is explicitly saved to a lead — the full history always
-- lives here.

-- ─────────────────────────────────────────────────────────────────────────────
-- arv_analyses — one row per "Analyze Property" run
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arv_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Property snapshot as of this analysis
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  parcel_number TEXT,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC(4,1),
  square_footage INTEGER,
  lot_size_sqft INTEGER,
  year_built INTEGER,
  last_sale_date DATE,
  last_sale_price NUMERIC(12,2),
  assessed_value NUMERIC(12,2),
  tax_annual_amount NUMERIC(12,2),

  property_data_source TEXT,
  property_data_source_id TEXT,
  property_data_retrieved_at TIMESTAMPTZ,
  property_data_raw JSONB,

  -- ARV
  arv_low NUMERIC(12,2),
  arv_likely NUMERIC(12,2),
  arv_high NUMERIC(12,2),
  arv_confidence TEXT CHECK (arv_confidence IN ('high', 'medium', 'low')),
  arv_method TEXT,

  -- Repairs
  repairs_ai_estimate NUMERIC(12,2),
  repairs_manual_override NUMERIC(12,2),
  repairs_final NUMERIC(12,2),
  repair_confidence TEXT CHECK (repair_confidence IN ('high', 'medium', 'low')),
  repair_breakdown JSONB,
  repair_photo_source TEXT,
  repair_photos_analyzed_count INTEGER NOT NULL DEFAULT 0,

  -- Offer inputs/outputs (the shared calc module in src/lib/arv is the only
  -- place that derives mao/offer_range_* — these columns just persist its
  -- output at save time)
  buyer_pct NUMERIC(5,2) NOT NULL DEFAULT 75,
  wholesale_fee NUMERIC(12,2) NOT NULL DEFAULT 15000,
  mao NUMERIC(12,2),
  offer_range_low NUMERIC(12,2),
  offer_range_high NUMERIC(12,2),

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arv_analyses_user_id ON arv_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arv_analyses_lead_id ON arv_analyses(lead_id, created_at DESC);

ALTER TABLE arv_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arv_analyses: own records" ON arv_analyses;
CREATE POLICY "arv_analyses: own records" ON arv_analyses
  FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- arv_comps — sold comps considered for one analysis (automatic + manual)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arv_comps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES arv_analyses(id) ON DELETE CASCADE,

  address TEXT NOT NULL,
  sold_price NUMERIC(12,2),
  sold_date DATE,
  distance_miles NUMERIC(6,2),
  square_footage INTEGER,
  bedrooms INTEGER,
  bathrooms NUMERIC(4,1),
  property_type TEXT,
  year_built INTEGER,
  lot_size_sqft INTEGER,
  price_per_sqft NUMERIC(10,2),

  similarity_score NUMERIC(5,2),
  included BOOLEAN NOT NULL DEFAULT TRUE,
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,

  source TEXT,
  source_id TEXT,
  source_url TEXT,
  retrieved_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arv_comps_analysis_id ON arv_comps(analysis_id);

ALTER TABLE arv_comps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arv_comps: own records" ON arv_comps;
CREATE POLICY "arv_comps: own records" ON arv_comps
  FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- file_attachments — let a photo (provider or user-uploaded) link to the ARV
-- analysis its repair estimate was based on. Reuses the existing general
-- file-intelligence layer/bucket (010_general_file_attachments) instead of a
-- new storage bucket.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE file_attachments
  ADD COLUMN IF NOT EXISTS arv_analysis_id UUID REFERENCES arv_analyses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_file_attachments_arv_analysis ON file_attachments(arv_analysis_id);
