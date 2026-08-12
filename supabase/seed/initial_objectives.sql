-- Big Stein — Initial Objectives Seed
-- Run AFTER creating the first user account.
-- Replace 'YOUR_USER_UUID_HERE' with the actual Supabase auth.users id.
--
-- This seed file creates the first 30-day objective with the $10,000 target
-- and a starter weekly objective. Edit dates and descriptions as needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- Usage:
--   psql -d YOUR_DB_URL -v user_id="'YOUR_USER_UUID_HERE'" -f initial_objectives.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 30-day objective (level 6 = monthly)
INSERT INTO objectives (
  id, user_id, parent_id, level, title, description, why_it_matters,
  success_criteria, status, progress_pct, start_date, end_date,
  revenue_target, notes
) VALUES (
  gen_random_uuid(),
  :user_id::UUID,
  NULL,
  6,
  'Generate $10,000 in Gross Wholesale Assignment Revenue',
  'Close or collect $10,000 in assignment fees while building a repeatable seller-acquisition, deal-analysis, buyer, and follow-up system.',
  'Proves the wholesaling model is executable, generates capital, and funds the next phase of the company.',
  '1. At least $10,000 collected OR under signed assignment contract by end of period. 2. Repeatable follow-up and offer system documented. 3. At least 1 qualified buyer relationship established.',
  'in_progress',
  0,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  10000.00,
  'First 30-day main target. Fixed unless manually changed. Track collected, contracted, and pipeline revenue separately. Do not count projected pipeline as earned.'
);

-- Initial revenue target record
INSERT INTO revenue_targets (
  user_id, period_type, period_start, period_end,
  target_main, target_minimum, target_stretch,
  collected, closed_awaiting_collection, contracted_awaiting_closing,
  projected_pipeline, total_expenses, notes
) VALUES (
  :user_id::UUID,
  'thirty_day',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  10000.00,
  5000.00,
  15000.00,
  0.00, 0.00, 0.00, 0.00, 0.00,
  'First 30-day goal. Minimum = any collected revenue. Target = $10K. Stretch = $15K.'
);
