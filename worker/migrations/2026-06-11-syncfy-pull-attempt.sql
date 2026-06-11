-- Track the last provider pull attempt separately from last_pull_at so that
-- provider-side scrape failures (Syncfy credential code 5xx) can be retried on a
-- 30-minute backoff instead of every cron cycle (or never).
ALTER TABLE syncfy_credentials ADD COLUMN last_pull_attempt_at TEXT;
