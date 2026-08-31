-- FinovAI D1 Database Schema

-- =====================
-- LEADS
-- =====================

-- Leads table: stores user signups from chatbot
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  diagnostic_data TEXT,
  stage TEXT DEFAULT 'stage_0',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- =====================
-- IDENTITY
-- =====================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  syncfy_identity_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Syncfy users: one Syncfy user per FinovAI email signup
CREATE TABLE IF NOT EXISTS syncfy_users (
  email TEXT PRIMARY KEY,
  syncfy_user_id TEXT NOT NULL,
  syncfy_external_id TEXT NOT NULL UNIQUE,
  name TEXT,
  mode TEXT DEFAULT 'live',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  last_session_at TEXT,
  user_id TEXT
);

-- Syncfy credentials: credential lifecycle and refresh state from widget/webhooks
CREATE TABLE IF NOT EXISTS syncfy_credentials (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  syncfy_user_id TEXT NOT NULL,
  syncfy_credential_id TEXT NOT NULL,
  syncfy_site_id TEXT,
  site_name TEXT,
  status TEXT,
  last_successful_sync_at TEXT,
  last_pull_at TEXT,
  last_pull_attempt_at TEXT,
  last_rid TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  user_id TEXT,
  UNIQUE(email, syncfy_credential_id)
);

-- Syncfy webhook events: raw event audit log for support and replay
CREATE TABLE IF NOT EXISTS syncfy_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  syncfy_user_id TEXT,
  syncfy_credential_id TEXT,
  rid TEXT,
  payload_json TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL
);

-- Syncfy errors: stores rid and request context for Syncfy support escalation
CREATE TABLE IF NOT EXISTS syncfy_errors (
  id TEXT PRIMARY KEY,
  email TEXT,
  syncfy_user_id TEXT,
  syncfy_credential_id TEXT,
  rid TEXT,
  status_code INTEGER,
  error_code TEXT,
  message TEXT,
  source TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  user_id TEXT
);

-- Dashboard sessions: browser-held client secret for email-scoped dashboard access
CREATE TABLE IF NOT EXISTS dashboard_sessions (
  email TEXT PRIMARY KEY,
  client_secret_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  user_id TEXT
);

-- Email login challenges: passwordless account access through Cloudflare Email
CREATE TABLE IF NOT EXISTS email_login_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  source TEXT,
  redirect_path TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);

-- =====================
-- REAL MVP FINANCE TABLES
-- =====================

CREATE TABLE IF NOT EXISTS financial_profiles (
  email TEXT PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'MXN',
  monthly_income REAL,
  monthly_budget REAL,
  category_budgets_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  user_id TEXT
);

CREATE TABLE IF NOT EXISTS cartola_imports (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'parsed',
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (email) REFERENCES financial_profiles(email)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT,
  notes TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'cartola', 'syncfy')),
  confidence REAL NOT NULL DEFAULT 1,
  category_locked INTEGER NOT NULL DEFAULT 0,
  raw_source TEXT,
  cartola_import_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  user_id TEXT,
  FOREIGN KEY (email) REFERENCES financial_profiles(email),
  FOREIGN KEY (cartola_import_id) REFERENCES cartola_imports(id)
);

CREATE TABLE IF NOT EXISTS household_invites (
  id TEXT PRIMARY KEY,
  inviter_email TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (inviter_email) REFERENCES financial_profiles(email),
  UNIQUE(inviter_email, invitee_email)
);

-- =====================
-- INDEXES
-- =====================

-- Lead indexes
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- Syncfy indexes
CREATE INDEX IF NOT EXISTS idx_syncfy_users_id ON syncfy_users(syncfy_user_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_users_external ON syncfy_users(syncfy_external_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_email ON syncfy_credentials(email);
CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_user ON syncfy_credentials(syncfy_user_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_credential ON syncfy_credentials(syncfy_credential_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_user_id ON syncfy_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_webhooks_event ON syncfy_webhook_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syncfy_webhooks_user ON syncfy_webhook_events(syncfy_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syncfy_webhooks_credential ON syncfy_webhook_events(syncfy_credential_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syncfy_errors_rid ON syncfy_errors(rid);
CREATE INDEX IF NOT EXISTS idx_syncfy_errors_email ON syncfy_errors(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_last_used ON dashboard_sessions(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_login_challenges_email_created ON email_login_challenges(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_login_challenges_expires ON email_login_challenges(expires_at);

-- Finance indexes
CREATE INDEX IF NOT EXISTS idx_financial_profiles_email ON financial_profiles(email);
CREATE INDEX IF NOT EXISTS idx_transactions_email_date ON transactions(email, date DESC);
CREATE INDEX IF NOT EXISTS idx_household_invites_inviter ON household_invites(inviter_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_email_source ON transactions(email, source);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_cartola_imports_email_created ON cartola_imports(email, created_at DESC);
