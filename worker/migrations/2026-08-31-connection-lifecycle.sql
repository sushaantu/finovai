ALTER TABLE syncfy_credentials ADD COLUMN state TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE syncfy_credentials ADD COLUMN state_changed_at TEXT;
ALTER TABLE syncfy_credentials ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE syncfy_credentials ADD COLUMN first_failed_at TEXT;
ALTER TABLE syncfy_credentials ADD COLUMN deleted_at TEXT;
-- backfill states from history:
UPDATE syncfy_credentials SET state = 'healthy' WHERE last_successful_sync_at IS NOT NULL;
UPDATE syncfy_credentials SET state = 'broken'
  WHERE last_successful_sync_at IS NULL AND created_at < datetime('now', '-48 hours');
UPDATE syncfy_credentials SET state = 'needs_user' WHERE status = 'needs_reconnect';
-- long-dead never-succeeded credentials go straight to abandoned (BBVA, 81 days):
UPDATE syncfy_credentials SET state = 'abandoned', first_failed_at = created_at
  WHERE last_successful_sync_at IS NULL AND created_at < datetime('now', '-14 days');
