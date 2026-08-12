-- O'Boyle Acquisition Operating System — task pipeline, proof of completion,
-- end-of-day review
-- Migration: 007_task_pipeline_and_eod
--
-- Safety: additive only (ADD COLUMN IF NOT EXISTS, CREATE ... IF NOT EXISTS).
-- Nothing here deletes or resets existing data. New columns on `tasks` and
-- `workdays` inherit those tables' existing RLS policies automatically —
-- no policy changes needed for them.

-- ─────────────────────────────────────────────────────────────────────────────
-- tasks — proof-of-completion + pipeline generation tracking
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS proof_type TEXT
    CHECK (proof_type IN (
      'screenshot','file','url','written','number','call_count','crm_activity','summary','other'
    ));

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS proof_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (proof_status IN ('not_required','pending_review','approved','rejected'));

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS proof_rejection_reason TEXT;

-- Storage paths in the `task-proof` bucket (see below) for screenshot/file proof.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS proof_file_paths JSONB NOT NULL DEFAULT '[]';

-- Who created the task — lets the UI/tools distinguish user-planned work from
-- Big Stein's pipeline-replenishment output without guessing from other fields.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS generated_by TEXT NOT NULL DEFAULT 'user'
    CHECK (generated_by IN ('user','big_stein'));

-- Links a Big-Stein-generated replacement task back to the task it replaced.
-- Doubles as the idempotency key that stops a retried completion request
-- from generating two replacements for the same event.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS replaced_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_replaced_task_id ON tasks(replaced_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_generated_by ON tasks(generated_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- workdays — end-of-day review idempotency
-- ─────────────────────────────────────────────────────────────────────────────

-- Guards against a double clock-out click generating two EOD reviews for the
-- same day. day_score / day_score_explanation already exist (001) and are
-- reused as-is for the Big Stein Daily Score.
ALTER TABLE workdays ADD COLUMN IF NOT EXISTS eod_review_generated_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage — task-proof bucket (screenshots/files submitted as completion proof)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-proof', 'task-proof', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Path convention: task-proof/{user_id}/{task_id}/{filename} — ownership is
-- enforced by matching the first path segment to auth.uid(), the same
-- pattern used for every other per-user table in this system.
DROP POLICY IF EXISTS "task-proof: owner read" ON storage.objects;
CREATE POLICY "task-proof: owner read" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-proof' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "task-proof: owner insert" ON storage.objects;
CREATE POLICY "task-proof: owner insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'task-proof' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "task-proof: owner delete" ON storage.objects;
CREATE POLICY "task-proof: owner delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'task-proof' AND (storage.foldername(name))[1] = auth.uid()::text);
