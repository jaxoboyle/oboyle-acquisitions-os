-- Big Stein Operating System — Initial Supabase Schema
-- Migration: 001_initial_schema
-- Date: 2026-08-02
--
-- Migrates all existing SQLite CRM tables into Postgres and adds
-- new Big Stein tables. Run with: supabase db push
--
-- Safety: All new columns on existing-equivalent tables are nullable
-- so that records imported from SQLite without those columns are valid.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";     -- for scheduled jobs (available in Supabase)
CREATE EXTENSION IF NOT EXISTS "pg_net";      -- for HTTP from SQL (Supabase)

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles (one per Supabase auth user)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  daily_work_target_minutes INTEGER NOT NULL DEFAULT 600,  -- 10 hours
  sunday_work_target_minutes INTEGER NOT NULL DEFAULT 180, -- 3 hours
  web_search_mode TEXT NOT NULL DEFAULT 'ask'
    CHECK (web_search_mode IN ('auto','ask','manual','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Company settings
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
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
-- Leads (migrated from SQLite)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  -- Pipeline
  stage TEXT NOT NULL DEFAULT 'new_lead',
  stage_order NUMERIC NOT NULL DEFAULT 0,

  -- Seller information
  seller_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  preferred_contact_method TEXT,
  best_time_to_call TEXT,

  -- Property information
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  parcel_number TEXT,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC(4,1),
  square_footage INTEGER,
  year_built INTEGER,
  occupancy TEXT,

  -- Seller situation
  reason_for_selling TEXT,
  desired_timeline TEXT,
  asking_price NUMERIC(12,2),
  mortgage_balance NUMERIC(12,2),
  known_liens TEXT,
  unpaid_taxes NUMERIC(12,2),
  property_condition TEXT,
  repairs_needed TEXT,
  conversation_notes TEXT,

  -- Deal numbers
  arv NUMERIC(12,2),
  estimated_repair_costs NUMERIC(12,2),
  mao NUMERIC(12,2),
  offer_amount NUMERIC(12,2),
  contract_price NUMERIC(12,2),
  buyer_price NUMERIC(12,2),
  estimated_assignment_fee NUMERIC(12,2),

  -- Follow-up information
  lead_source TEXT,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high')),
  last_contact_date DATE,
  next_follow_up_date DATE,
  assigned_user TEXT,

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads(deleted_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Buyers (migrated from SQLite)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  areas TEXT,
  property_types TEXT,
  max_purchase_price NUMERIC(12,2),
  max_repair_level TEXT,
  funding_type TEXT NOT NULL DEFAULT 'cash'
    CHECK (funding_type IN ('cash','financing','both')),
  proof_of_funds_status TEXT,
  typical_closing_speed TEXT,
  preferred_title_company TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyers_user_id ON buyers(user_id);

CREATE TABLE IF NOT EXISTS buyer_previous_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  property_address TEXT,
  deal_date DATE,
  price NUMERIC(12,2),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_buyer_deals_buyer_id ON buyer_previous_deals(buyer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Deals (migrated from SQLite)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lead_id UUID NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  contract_date DATE,
  earnest_money_amount NUMERIC(12,2),
  earnest_money_due_date DATE,
  inspection_period_end_date DATE,
  closing_date DATE,
  title_company_name TEXT,
  title_company_phone TEXT,
  title_company_email TEXT,
  end_buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL,
  end_buyer_name TEXT,
  buyer_deposit NUMERIC(12,2),
  assignment_fee NUMERIC(12,2),
  title_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (title_status IN ('not_started','search_in_progress','clear','issue_found','resolved')),
  closing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (closing_status IN ('pending','scheduled','delayed','closed','fell_through')),
  deal_notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_closing_date ON deals(closing_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- Documents (migrated from SQLite, now stored in Supabase Storage)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Allow attachment to any CRM entity
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES buyers(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  task_id UUID,  -- FK added after tasks table created below
  category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,       -- Supabase Storage path: documents/{user_id}/{uuid}/{filename}
  original_local_path TEXT,         -- preserved from SQLite migration for reference
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON documents(lead_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Activity log (migrated from SQLite)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_lead_id ON activity_log(lead_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Objectives (9-level hierarchy)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  parent_id UUID REFERENCES objectives(id) ON DELETE SET NULL,

  level INTEGER NOT NULL
    CHECK (level BETWEEN 1 AND 9),
  -- 1=15yr vision, 2=5yr, 3=3yr, 4=annual, 5=90day, 6=monthly,
  -- 7=weekly, 8=daily, 9=task

  title TEXT NOT NULL,
  description TEXT,
  why_it_matters TEXT,
  success_criteria TEXT,

  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','completed','paused','cancelled')),
  progress_pct INTEGER NOT NULL DEFAULT 0
    CHECK (progress_pct BETWEEN 0 AND 100),

  start_date DATE,
  end_date DATE,

  revenue_target NUMERIC(12,2),
  revenue_actual NUMERIC(12,2),
  big_stein_evaluation TEXT,
  notes TEXT,

  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objectives_user_id ON objectives(user_id);
CREATE INDEX IF NOT EXISTS idx_objectives_parent_id ON objectives(parent_id);
CREATE INDEX IF NOT EXISTS idx_objectives_level ON objectives(level);
CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(status);

CREATE TABLE IF NOT EXISTS objective_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  target_value NUMERIC,
  actual_value NUMERIC,
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Revenue targets (30-day, monthly, 90-day)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  period_type TEXT NOT NULL
    CHECK (period_type IN ('thirty_day','monthly','quarterly','annual')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_minimum NUMERIC(12,2),
  target_main NUMERIC(12,2) NOT NULL,
  target_stretch NUMERIC(12,2),
  -- Revenue breakdown (updated as deals progress)
  collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  closed_awaiting_collection NUMERIC(12,2) NOT NULL DEFAULT 0,
  contracted_awaiting_closing NUMERIC(12,2) NOT NULL DEFAULT 0,
  projected_pipeline NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_targets_user_id ON revenue_targets(user_id);

CREATE TABLE IF NOT EXISTS financial_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  revenue_target_id UUID REFERENCES revenue_targets(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('collected','closed','contracted','projected','expense','refund')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_entries_user_id ON financial_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_type ON financial_entries(entry_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Tasks (upgraded from SQLite — new fields are nullable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  -- Existing SQLite fields
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  notes TEXT,
  due_date TIMESTAMPTZ,

  -- New Big Stein fields (all nullable for migration safety)
  objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  category TEXT,
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  is_revenue_producing BOOLEAN NOT NULL DEFAULT FALSE,
  is_non_negotiable BOOLEAN NOT NULL DEFAULT FALSE,

  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN (
      'not_started','ready','in_progress','paused','blocked',
      'completed','missed','rescheduled','cancelled'
    )),

  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  completion_pct INTEGER DEFAULT 0
    CHECK (completion_pct BETWEEN 0 AND 100),

  -- Proof of completion
  proof_required TEXT,
  proof_submitted TEXT,
  proof_submitted_at TIMESTAMPTZ,

  -- Blockers
  blocker_description TEXT,
  blocker_type TEXT,

  big_stein_notes TEXT,

  -- Rescheduling history stored as JSONB array
  reschedule_history JSONB NOT NULL DEFAULT '[]',

  -- Legacy fields from SQLite (kept for migration compatibility)
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_objective_id ON tasks(objective_id);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_start ON tasks(scheduled_start);

-- Now add the FK from documents to tasks
ALTER TABLE documents ADD COLUMN IF NOT EXISTS
  task_id_fk UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_task_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Work days and time tracking
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workdays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clocked_in_at TIMESTAMPTZ,
  clocked_out_at TIMESTAMPTZ,
  target_minutes INTEGER NOT NULL DEFAULT 600,
  actual_minutes INTEGER NOT NULL DEFAULT 0,
  day_score INTEGER CHECK (day_score BETWEEN 0 AND 100),
  day_score_explanation TEXT,
  daily_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_workdays_user_date ON workdays(user_id, work_date);

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  workday_id UUID NOT NULL REFERENCES workdays(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,

  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'seller_activity','follow_up','deal_advancement','buyer_activity',
      'property_analysis','offers','negotiation','admin','education',
      'fieldwork','travel','inspection','meeting','break','personal',
      'other'
    )),
  is_productive BOOLEAN NOT NULL DEFAULT TRUE,
  is_revenue_producing BOOLEAN NOT NULL DEFAULT FALSE,

  notes TEXT,
  device TEXT,

  -- Audit for manual edits
  edited_at TIMESTAMPTZ,
  edit_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_workday ON time_entries(workday_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries(started_at);

CREATE TABLE IF NOT EXISTS clockout_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE CASCADE,
  workday_id UUID REFERENCES workdays(id) ON DELETE CASCADE,
  reason_type TEXT NOT NULL,
  explanation TEXT,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clockout_reasons_user_id ON clockout_reasons(user_id);
CREATE INDEX IF NOT EXISTS idx_clockout_reasons_workday ON clockout_reasons(workday_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- AI Chat
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  -- Tool use metadata
  tool_calls JSONB,
  tool_results JSONB,
  -- Web research metadata
  web_sources JSONB,
  contains_assumptions BOOLEAN NOT NULL DEFAULT FALSE,
  -- Token tracking
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

CREATE TABLE IF NOT EXISTS chat_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  attachment_type TEXT NOT NULL
    CHECK (attachment_type IN ('lead','buyer','property','deal','task','document')),
  record_id UUID NOT NULL,
  display_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AI tool logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tool_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  input_params JSONB,
  result_summary TEXT,
  required_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
  confirmation_received BOOLEAN,
  confirmed_at TIMESTAMPTZ,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_logs_user_id ON ai_tool_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_logs_tool_name ON ai_tool_logs(tool_name);

-- ─────────────────────────────────────────────────────────────────────────────
-- Decisions, blockers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  decision_text TEXT NOT NULL,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blockers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  blocker_type TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','accepted')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Reports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  report_type TEXT NOT NULL
    CHECK (report_type IN ('daily','weekly','monthly','ninety_day','custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_period ON reports(period_start, period_end);

-- ─────────────────────────────────────────────────────────────────────────────
-- Push notifications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_label TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','clicked','dismissed','failed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  delivery_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Web research sources
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS web_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT,
  domain TEXT,
  url TEXT NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snippet TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Audit log (important changes)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('insert','update','delete','restore')),
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Updated_at trigger function (reusable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply trigger to tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','company_settings','leads','buyers','deals',
    'objectives','objective_metrics','revenue_targets','tasks',
    'workdays','time_entries','chat_conversations','push_subscriptions','blockers'
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
-- Auto-create profile on signup
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO company_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
