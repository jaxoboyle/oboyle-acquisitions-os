-- O'Boyle Acquisition Operating System — lead disposition, follow-ups, and
-- Big Stein seller-file import
-- Migration: 009_lead_disposition_and_imports
--
-- Safety: additive only (ADD COLUMN IF NOT EXISTS, CREATE ... IF NOT EXISTS).
-- Nothing here deletes or resets existing data. New columns on `leads`
-- inherit its existing RLS policy automatically — no policy change needed
-- for those. `next_follow_up_date` (existing, already indexed) is reused as
-- the single source of truth for follow-up scheduling rather than adding a
-- duplicate date column.

-- ─────────────────────────────────────────────────────────────────────────────
-- leads — disposition / cross-out tracking
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS disposition TEXT
    CHECK (disposition IN (
      'under_contract', 'follow_up', 'not_interested', 'bad_lead',
      'no_response', 'wrong_information', 'sold', 'other'
    ));

-- Human-readable reason. For the six fixed categories this mirrors the
-- category label; for 'other' it holds the user's free-text reason.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS disposition_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS disposition_notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS disposed_at TIMESTAMPTZ;

-- Which import batch (if any) originated this lead — lets Big Stein answer
-- "how many sellers from yesterday's file became active leads" without
-- guessing from timestamps.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS import_batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_leads_disposition ON leads(disposition);
CREATE INDEX IF NOT EXISTS idx_leads_import_batch_id ON leads(import_batch_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- import_batches — Big Stein seller-file import staging + audit trail
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,

  source_filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'pdf', 'txt')),
  storage_path TEXT,
  file_size_bytes INTEGER,

  status TEXT NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'processing', 'completed', 'failed')),

  -- Detected source-column → CRM-field mapping, for transparency/debugging.
  column_mapping JSONB NOT NULL DEFAULT '{}',
  -- Normalized rows extracted from the file, each shaped like:
  -- { seller_name, address, city, state, zip, phone, email, parcel_number,
  --   asking_price, property_type, motivation, source, notes, raw }
  parsed_rows JSONB NOT NULL DEFAULT '[]',

  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  skipped_reasons JSONB NOT NULL DEFAULT '[]',

  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user_id ON import_batches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_batches_conversation ON import_batches(conversation_id);

-- Now that import_batches exists, wire the FK from leads (added as a bare
-- column above so table creation order never blocks either statement).
-- Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so this is guarded
-- manually — required for the migration to stay safely re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_import_batch_id_fkey'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_import_batch_id_fkey
      FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_batches: own records" ON import_batches;
CREATE POLICY "import_batches: own records" ON import_batches
  FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage — lead-imports bucket (raw uploaded seller files)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-imports', 'lead-imports', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Path convention: lead-imports/{user_id}/{batch_id}/{filename} — same
-- owner-folder-prefix pattern as the task-proof bucket (007).
DROP POLICY IF EXISTS "lead-imports: owner read" ON storage.objects;
CREATE POLICY "lead-imports: owner read" ON storage.objects
  FOR SELECT USING (bucket_id = 'lead-imports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "lead-imports: owner insert" ON storage.objects;
CREATE POLICY "lead-imports: owner insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'lead-imports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "lead-imports: owner delete" ON storage.objects;
CREATE POLICY "lead-imports: owner delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'lead-imports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- mark_lead_under_contract — atomic Lead → Deal transition
--
-- Wrapping both writes in one PL/pgSQL function makes the transition
-- transactional: either the deal is created AND the lead is marked
-- under_contract, or neither happens. SECURITY DEFINER is required because
-- it writes two tables in one call, but every operation is scoped with an
-- explicit `AND user_id = auth.uid()` check (and the lead lookup itself is
-- ownership-scoped), so it cannot act on another user's records even though
-- it runs with elevated privilege.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_lead_under_contract(
  p_lead_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_contract_price NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_lead RECORD;
  v_deal_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_lead FROM leads
    WHERE id = p_lead_id AND user_id = v_user_id AND deleted_at IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  -- Idempotent: if this lead already has a deal (unique lead_id FK), return
  -- the existing deal instead of erroring or creating a second one.
  SELECT id INTO v_deal_id FROM deals WHERE lead_id = p_lead_id;

  IF v_deal_id IS NULL THEN
    -- deals has no "contract price" column of its own — contract_price
    -- already exists on leads for exactly this purpose (see 001_initial_schema),
    -- so it's set below rather than duplicated onto the deal. earnest_money_amount,
    -- title company, closing date etc. are genuinely unknown at this point and
    -- are left null for the user to fill in via the normal Deals workflow.
    INSERT INTO deals (
      user_id, lead_id, deal_stage, deal_notes
    ) VALUES (
      v_user_id, p_lead_id, 'under_contract',
      NULLIF(TRIM(BOTH FROM CONCAT_WS(E'\n', p_notes, v_lead.conversation_notes)), '')
    )
    RETURNING id INTO v_deal_id;
  END IF;

  UPDATE leads SET
    disposition = 'under_contract',
    disposition_reason = COALESCE(p_reason, 'Under Contract'),
    disposition_notes = COALESCE(p_notes, disposition_notes),
    disposed_at = NOW(),
    stage = 'under_contract',
    contract_price = COALESCE(p_contract_price, contract_price, offer_amount, asking_price)
  WHERE id = p_lead_id;

  INSERT INTO activity_log (user_id, lead_id, activity_type, description)
  VALUES (v_user_id, p_lead_id, 'disposition_change', 'Marked Under Contract — deal created');

  RETURN v_deal_id;
END;
$$;

-- Explicit grant — some Supabase projects revoke default PUBLIC execute
-- rights on functions, and this must be callable by any signed-in user.
GRANT EXECUTE ON FUNCTION mark_lead_under_contract(UUID, TEXT, TEXT, NUMERIC) TO authenticated;
