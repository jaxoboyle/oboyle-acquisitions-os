-- O'Boyle Acquisition Operating System — general-purpose Big Stein file
-- intelligence layer (read / analyze / summarize / attach-as-proof / compare
-- — not just Leads import)
-- Migration: 010_general_file_attachments
--
-- Safety: additive only (ADD COLUMN IF NOT EXISTS, CREATE ... IF NOT EXISTS).
-- Nothing here touches the existing leads/buyers import pipeline, the
-- import_batches parsing flow, or the task-proof storage/verification flow —
-- those keep working exactly as before. `target_kind` defaults to 'leads' so
-- every existing (and any future default) import_batches row behaves
-- identically to today unless explicitly staged otherwise.

-- ─────────────────────────────────────────────────────────────────────────────
-- import_batches — allow a staged batch to target Buyers, not just Leads
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE import_batches
  ADD COLUMN IF NOT EXISTS target_kind TEXT NOT NULL DEFAULT 'leads'
    CHECK (target_kind IN ('leads', 'buyers'));

-- ─────────────────────────────────────────────────────────────────────────────
-- file_attachments — general Big Stein file intelligence layer. Distinct
-- from the pre-existing `chat_attachments` table (which links a chat message
-- to an already-created CRM record for display purposes, e.g. "this message
-- mentions Lead #123") — file_attachments is the raw uploaded file + its
-- extracted content, independent of what (if anything) is ever done with it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,

  filename TEXT NOT NULL,
  mime_type TEXT,
  file_kind TEXT NOT NULL
    CHECK (file_kind IN ('pdf', 'csv', 'xlsx', 'docx', 'txt', 'json', 'image', 'pptx', 'rtf', 'other')),
  storage_path TEXT,
  size_bytes INTEGER,

  -- What normalized content extraction produced. `needs_vision` means text
  -- density was too low (scanned PDF) or the file is an image — vision
  -- extraction runs lazily on first read (see lib/files/vision.ts) and the
  -- result is cached back into extracted_text so it only runs once.
  extraction_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'ready', 'needs_vision', 'failed', 'unsupported')),
  extraction_method TEXT,
  extracted_text TEXT,
  extracted_summary TEXT,
  page_count INTEGER,
  sheet_names JSONB,
  warnings JSONB NOT NULL DEFAULT '[]',

  -- Set when this same file also parsed as a structured seller/buyer list
  -- (see /api/files/upload) — lets Big Stein or the UI offer the existing
  -- deterministic import flow without that being the only thing the file can
  -- be used for.
  linked_import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_attachments_user_id ON file_attachments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_attachments_conversation ON file_attachments(conversation_id);

ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_attachments: own records" ON file_attachments;
CREATE POLICY "file_attachments: own records" ON file_attachments
  FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage — big-stein-files bucket (general-purpose private attachments,
-- separate from `lead-imports` and `task-proof` so neither existing bucket's
-- policies or contents are touched)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('big-stein-files', 'big-stein-files', FALSE, 26214400) -- 25MB
ON CONFLICT (id) DO NOTHING;

-- Path convention: big-stein-files/{user_id}/{conversation_id}/{file_id}/{filename}
DROP POLICY IF EXISTS "big-stein-files: owner read" ON storage.objects;
CREATE POLICY "big-stein-files: owner read" ON storage.objects
  FOR SELECT USING (bucket_id = 'big-stein-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "big-stein-files: owner insert" ON storage.objects;
CREATE POLICY "big-stein-files: owner insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'big-stein-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "big-stein-files: owner delete" ON storage.objects;
CREATE POLICY "big-stein-files: owner delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'big-stein-files' AND (storage.foldername(name))[1] = auth.uid()::text);
