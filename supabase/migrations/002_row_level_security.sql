-- Big Stein — Row Level Security Policies
-- Migration: 002_row_level_security
-- Date: 2026-08-02
--
-- Every table with user data gets RLS enabled.
-- The fundamental rule: a user can only see and modify their own records.
-- The service role key bypasses RLS (used only in migrations and Edge Functions).

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS on all user tables
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_previous_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE objective_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clockout_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: check if authenticated user owns a record
-- ─────────────────────────────────────────────────────────────────────────────

-- profiles — own profile only
CREATE POLICY "profiles: own record" ON profiles
  FOR ALL USING (auth.uid() = id);

-- company_settings
CREATE POLICY "company_settings: own record" ON company_settings
  FOR ALL USING (auth.uid() = user_id);

-- leads
CREATE POLICY "leads: own records" ON leads
  FOR ALL USING (auth.uid() = user_id);

-- buyers
CREATE POLICY "buyers: own records" ON buyers
  FOR ALL USING (auth.uid() = user_id);

-- buyer_previous_deals: accessible if the user owns the parent buyer
CREATE POLICY "buyer_previous_deals: via buyer ownership" ON buyer_previous_deals
  FOR ALL USING (
    buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid())
  );

-- deals
CREATE POLICY "deals: own records" ON deals
  FOR ALL USING (auth.uid() = user_id);

-- documents
CREATE POLICY "documents: own records" ON documents
  FOR ALL USING (auth.uid() = user_id);

-- activity_log
CREATE POLICY "activity_log: own records" ON activity_log
  FOR ALL USING (auth.uid() = user_id);

-- objectives
CREATE POLICY "objectives: own records" ON objectives
  FOR ALL USING (auth.uid() = user_id);

-- objective_metrics: accessible if user owns the parent objective
CREATE POLICY "objective_metrics: via objective ownership" ON objective_metrics
  FOR ALL USING (
    objective_id IN (SELECT id FROM objectives WHERE user_id = auth.uid())
  );

-- revenue_targets
CREATE POLICY "revenue_targets: own records" ON revenue_targets
  FOR ALL USING (auth.uid() = user_id);

-- financial_entries
CREATE POLICY "financial_entries: own records" ON financial_entries
  FOR ALL USING (auth.uid() = user_id);

-- tasks
CREATE POLICY "tasks: own records" ON tasks
  FOR ALL USING (auth.uid() = user_id);

-- task_dependencies: accessible if user owns the task
CREATE POLICY "task_dependencies: via task ownership" ON task_dependencies
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks WHERE user_id = auth.uid())
  );

-- workdays
CREATE POLICY "workdays: own records" ON workdays
  FOR ALL USING (auth.uid() = user_id);

-- time_entries
CREATE POLICY "time_entries: own records" ON time_entries
  FOR ALL USING (auth.uid() = user_id);

-- clockout_reasons
CREATE POLICY "clockout_reasons: own records" ON clockout_reasons
  FOR ALL USING (auth.uid() = user_id);

-- chat_conversations
CREATE POLICY "chat_conversations: own records" ON chat_conversations
  FOR ALL USING (auth.uid() = user_id);

-- chat_messages
CREATE POLICY "chat_messages: own records" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);

-- chat_attachments: accessible if user owns the parent message
CREATE POLICY "chat_attachments: via message ownership" ON chat_attachments
  FOR ALL USING (
    message_id IN (SELECT id FROM chat_messages WHERE user_id = auth.uid())
  );

-- ai_tool_logs
CREATE POLICY "ai_tool_logs: own records" ON ai_tool_logs
  FOR ALL USING (auth.uid() = user_id);

-- decisions
CREATE POLICY "decisions: own records" ON decisions
  FOR ALL USING (auth.uid() = user_id);

-- blockers
CREATE POLICY "blockers: own records" ON blockers
  FOR ALL USING (auth.uid() = user_id);

-- reports
CREATE POLICY "reports: own records" ON reports
  FOR ALL USING (auth.uid() = user_id);

-- push_subscriptions
CREATE POLICY "push_subscriptions: own records" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- notifications
CREATE POLICY "notifications: own records" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- web_sources
CREATE POLICY "web_sources: own records" ON web_sources
  FOR ALL USING (auth.uid() = user_id);

-- audit_logs: read own, insert own, no update/delete
CREATE POLICY "audit_logs: read own" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "audit_logs: insert own" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
