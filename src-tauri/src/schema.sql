-- Wholesale Real Estate CRM schema (SQLite)

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,

  -- Pipeline
  stage TEXT NOT NULL DEFAULT 'new_lead',
  stage_order REAL NOT NULL DEFAULT 0,

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
  bathrooms REAL,
  square_footage INTEGER,
  year_built INTEGER,
  occupancy TEXT,

  -- Seller situation
  reason_for_selling TEXT,
  desired_timeline TEXT,
  asking_price REAL,
  mortgage_balance REAL,
  known_liens TEXT,
  unpaid_taxes REAL,
  property_condition TEXT,
  repairs_needed TEXT,
  conversation_notes TEXT,

  -- Deal numbers
  arv REAL,
  estimated_repair_costs REAL,
  mao REAL,
  offer_amount REAL,
  contract_price REAL,
  buyer_price REAL,
  estimated_assignment_fee REAL,

  -- Follow-up information
  lead_source TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  last_contact_date TEXT,
  next_follow_up_date TEXT,
  assigned_user TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buyers (
  id TEXT PRIMARY KEY,
  buyer_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  areas TEXT,
  property_types TEXT,
  max_purchase_price REAL,
  max_repair_level TEXT,
  funding_type TEXT NOT NULL DEFAULT 'cash',
  proof_of_funds_status TEXT,
  typical_closing_speed TEXT,
  preferred_title_company TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buyer_previous_deals (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  property_address TEXT,
  deal_date TEXT,
  price REAL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  contract_date TEXT,
  earnest_money_amount REAL,
  earnest_money_due_date TEXT,
  inspection_period_end_date TEXT,
  closing_date TEXT,
  title_company_name TEXT,
  title_company_phone TEXT,
  title_company_email TEXT,
  end_buyer_id TEXT REFERENCES buyers(id) ON DELETE SET NULL,
  end_buyer_name TEXT,
  buyer_deposit REAL,
  assignment_fee REAL,
  title_status TEXT NOT NULL DEFAULT 'not_started',
  closing_status TEXT NOT NULL DEFAULT 'pending',
  deal_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  due_date TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_lead_id ON activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_documents_lead_id ON documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_buyer_previous_deals_buyer_id ON buyer_previous_deals(buyer_id);
