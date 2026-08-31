-- Legacy users/sessions are empty in production; safe to rebuild.
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS sessions;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  syncfy_identity_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE transactions ADD COLUMN user_id TEXT;
ALTER TABLE syncfy_credentials ADD COLUMN user_id TEXT;
ALTER TABLE syncfy_errors ADD COLUMN user_id TEXT;
ALTER TABLE syncfy_users ADD COLUMN user_id TEXT;
ALTER TABLE financial_profiles ADD COLUMN user_id TEXT;
ALTER TABLE dashboard_sessions ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_user ON syncfy_credentials(user_id);
