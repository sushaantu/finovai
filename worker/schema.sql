-- FinovAI D1 Database Schema

-- =====================
-- LEGACY TABLES (keep for backwards compatibility)
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

-- Legacy chat sessions (deprecated, use new conversations/messages)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  session_id TEXT NOT NULL UNIQUE,
  messages TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- =====================
-- NEW CHAT SYSTEM TABLES
-- =====================

-- Users: authenticated users with phone verification
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  phone_verified INTEGER DEFAULT 0,
  display_name TEXT,
  avatar_url TEXT,
  couple_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  last_seen_at TEXT,
  FOREIGN KEY (couple_id) REFERENCES couples(id)
);

-- Couples: links two users as partners
CREATE TABLE IF NOT EXISTS couples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id INTEGER NOT NULL,
  user2_id INTEGER,
  invite_phone TEXT,
  invite_token TEXT UNIQUE,
  invite_expires_at TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (user1_id) REFERENCES users(id),
  FOREIGN KEY (user2_id) REFERENCES users(id)
);

-- Conversations: chat threads
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_type TEXT NOT NULL,
  owner_id INTEGER,
  couple_id INTEGER,
  title TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  last_message_at TEXT,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (couple_id) REFERENCES couples(id)
);

-- Migration: Add metadata column to conversations if it doesn't exist
-- ALTER TABLE conversations ADD COLUMN metadata TEXT;

-- Conversation participants: access control
CREATE TABLE IF NOT EXISTS conversation_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TEXT NOT NULL,
  last_read_at TEXT,
  UNIQUE(conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Messages: all chat messages
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER,
  sender_type TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  metadata TEXT,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- OTP verifications: phone verification codes
CREATE TABLE IF NOT EXISTS otp_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose TEXT DEFAULT 'login',
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Sessions: user authentication sessions
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  device_info TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
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
  last_session_at TEXT
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
  last_rid TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
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
  created_at TEXT NOT NULL
);

-- =====================
-- REAL MVP FINANCE TABLES
-- =====================

CREATE TABLE IF NOT EXISTS financial_profiles (
  email TEXT PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'MXN',
  created_at TEXT NOT NULL,
  updated_at TEXT
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
  raw_source TEXT,
  cartola_import_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
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

-- Legacy indexes
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_lead_id ON chat_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_couple_id ON users(couple_id);

-- Couple indexes
CREATE INDEX IF NOT EXISTS idx_couples_invite_token ON couples(invite_token);
CREATE INDEX IF NOT EXISTS idx_couples_user1 ON couples(user1_id);
CREATE INDEX IF NOT EXISTS idx_couples_user2 ON couples(user2_id);

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_id);
CREATE INDEX IF NOT EXISTS idx_conversations_couple ON conversations(couple_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(conversation_type);

-- Participant indexes
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- OTP indexes
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Syncfy indexes
CREATE INDEX IF NOT EXISTS idx_syncfy_users_id ON syncfy_users(syncfy_user_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_users_external ON syncfy_users(syncfy_external_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_email ON syncfy_credentials(email);
CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_user ON syncfy_credentials(syncfy_user_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_credential ON syncfy_credentials(syncfy_credential_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_webhooks_event ON syncfy_webhook_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syncfy_webhooks_user ON syncfy_webhook_events(syncfy_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syncfy_webhooks_credential ON syncfy_webhook_events(syncfy_credential_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syncfy_errors_rid ON syncfy_errors(rid);
CREATE INDEX IF NOT EXISTS idx_syncfy_errors_email ON syncfy_errors(email, created_at DESC);

-- Finance indexes
CREATE INDEX IF NOT EXISTS idx_financial_profiles_email ON financial_profiles(email);
CREATE INDEX IF NOT EXISTS idx_transactions_email_date ON transactions(email, date DESC);
CREATE INDEX IF NOT EXISTS idx_household_invites_inviter ON household_invites(inviter_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_email_source ON transactions(email, source);
CREATE INDEX IF NOT EXISTS idx_cartola_imports_email_created ON cartola_imports(email, created_at DESC);
