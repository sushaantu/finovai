import {
  DEFAULT_FINANCE_CURRENCY,
} from '../../shared/finance-core'
import {
  ensureDashboardSessionTable,
} from './shared'
import type {
  Env,
} from './shared'

export async function ensureSyncfyTables(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS syncfy_users (
      email TEXT PRIMARY KEY,
      syncfy_user_id TEXT NOT NULL,
      syncfy_external_id TEXT NOT NULL UNIQUE,
      name TEXT,
      mode TEXT DEFAULT 'live',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      last_session_at TEXT
    )`
  ).run()

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS syncfy_credentials (
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
      UNIQUE(email, syncfy_credential_id)
    )`
  ).run()

  // Self-migrate older databases created before last_pull_attempt_at existed.
  await env.DB.prepare(`ALTER TABLE syncfy_credentials ADD COLUMN last_pull_attempt_at TEXT`)
    .run()
    .catch(() => {})

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS syncfy_webhook_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      syncfy_user_id TEXT,
      syncfy_credential_id TEXT,
      rid TEXT,
      payload_json TEXT NOT NULL,
      processed_at TEXT,
      created_at TEXT NOT NULL
    )`
  ).run()

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS syncfy_errors (
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
    )`
  ).run()

  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_email ON syncfy_credentials(email)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_user ON syncfy_credentials(syncfy_user_id)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_credential ON syncfy_credentials(syncfy_credential_id)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_syncfy_webhooks_event ON syncfy_webhook_events(event_type, created_at DESC)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_syncfy_webhooks_user ON syncfy_webhook_events(syncfy_user_id, created_at DESC)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_syncfy_webhooks_credential ON syncfy_webhook_events(syncfy_credential_id, created_at DESC)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_syncfy_errors_rid ON syncfy_errors(rid)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_syncfy_errors_email ON syncfy_errors(email, created_at DESC)`).run()
}

export async function ensureEmailAuthTables(env: Env): Promise<void> {
  await ensureDashboardSessionTable(env)
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS email_login_challenges (
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
    )`
  ).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_email_login_challenges_email_created ON email_login_challenges(email, created_at DESC)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_email_login_challenges_expires ON email_login_challenges(expires_at)`).run()
}

export async function storeSyncfyError(
  env: Env,
  input: {
    email?: string | null
    syncfyUserId?: string | null
    syncfyCredentialId?: string | null
    rid?: string | null
    statusCode?: number | null
    errorCode?: string | null
    message?: string | null
    source: string
    payload?: unknown
  }
): Promise<void> {
  await ensureSyncfyTables(env)

  await env.DB.prepare(
    `INSERT INTO syncfy_errors (
      id, email, syncfy_user_id, syncfy_credential_id, rid, status_code, error_code, message, source, payload_json, created_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))`
  )
    .bind(
      crypto.randomUUID(),
      input.email || null,
      input.syncfyUserId || null,
      input.syncfyCredentialId || null,
      input.rid || null,
      input.statusCode || null,
      input.errorCode || null,
      input.message || null,
      input.source,
      input.payload === undefined ? null : JSON.stringify(input.payload)
    )
    .run()
}

export async function ensureFinanceTables(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS financial_profiles (
      email TEXT PRIMARY KEY,
      currency TEXT NOT NULL DEFAULT 'MXN',
      monthly_income REAL,
      monthly_budget REAL,
      category_budgets_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  ).run()

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS cartola_imports (
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
    )`
  ).run()

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS transactions (
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
      FOREIGN KEY (email) REFERENCES financial_profiles(email),
      FOREIGN KEY (cartola_import_id) REFERENCES cartola_imports(id)
    )`
  ).run()

  await ensureFinancialProfileBudgetColumns(env)
  await migrateTransactionsSourceConstraint(env)
  await ensureTransactionCategoryLockColumn(env)
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_transactions_email_date ON transactions(email, date DESC)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_transactions_email_source ON transactions(email, source)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cartola_imports_email_created ON cartola_imports(email, created_at DESC)`).run()
}

async function ensureFinancialProfileBudgetColumns(env: Env): Promise<void> {
  let existingColumns: Set<string> | null = null
  try {
    const columns = await env.DB.prepare(`PRAGMA table_info(financial_profiles)`).all<{ name: string }>()
    existingColumns = new Set(columns.results.map((column) => column.name))
  } catch {
    existingColumns = null
  }

  const additions = [
    ['monthly_income', 'ALTER TABLE financial_profiles ADD COLUMN monthly_income REAL'],
    ['monthly_budget', 'ALTER TABLE financial_profiles ADD COLUMN monthly_budget REAL'],
    ['category_budgets_json', 'ALTER TABLE financial_profiles ADD COLUMN category_budgets_json TEXT'],
  ] as const

  for (const [column, statement] of additions) {
    if (existingColumns?.has(column)) continue
    try {
      await env.DB.prepare(statement).run()
    } catch {
      // Existing databases may already have the column; D1 reports duplicate columns as errors.
    }
  }
}

async function ensureTransactionCategoryLockColumn(env: Env): Promise<void> {
  try {
    const columns = await env.DB.prepare(`PRAGMA table_info(transactions)`).all<{ name: string }>()
    if (columns.results.some((column) => column.name === 'category_locked')) return
  } catch {
    // Some test doubles do not implement PRAGMA; the ALTER path below is still safe.
  }

  try {
    await env.DB.prepare(
      `ALTER TABLE transactions ADD COLUMN category_locked INTEGER NOT NULL DEFAULT 0`
    ).run()
  } catch {
    // Existing databases already have the column. D1 exposes duplicate-column as an error.
  }
}

async function migrateTransactionsSourceConstraint(env: Env): Promise<void> {
  const schema = await env.DB.prepare(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'transactions'`
  ).first<{ sql: string }>()

  if (!schema?.sql || schema.sql.includes("'syncfy'")) return

  await env.DB.prepare(`DROP INDEX IF EXISTS idx_transactions_email_date`).run()
  await env.DB.prepare(`DROP INDEX IF EXISTS idx_transactions_email_source`).run()
  await env.DB.prepare(`ALTER TABLE transactions RENAME TO transactions_legacy_source_constraint`).run()
  await env.DB.prepare(
    `CREATE TABLE transactions (
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
      FOREIGN KEY (email) REFERENCES financial_profiles(email),
      FOREIGN KEY (cartola_import_id) REFERENCES cartola_imports(id)
    )`
  ).run()
  await env.DB.prepare(
    `INSERT INTO transactions (
      id, email, date, type, amount, currency, category, description, merchant, notes,
      source, confidence, category_locked, raw_source, cartola_import_id, created_at, updated_at
    )
     SELECT id, email, date, type, amount, currency, category, description, merchant, notes,
      source, confidence, COALESCE(category_locked, 0), raw_source, cartola_import_id, created_at, updated_at
     FROM transactions_legacy_source_constraint`
  ).run()
  await env.DB.prepare(`DROP TABLE transactions_legacy_source_constraint`).run()
}

export async function ensureHouseholdTables(env: Env): Promise<void> {
  await ensureFinanceTables(env)

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS household_invites (
      id TEXT PRIMARY KEY,
      inviter_email TEXT NOT NULL,
      invitee_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (inviter_email) REFERENCES financial_profiles(email),
      UNIQUE(inviter_email, invitee_email)
    )`
  ).run()

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_household_invites_inviter ON household_invites(inviter_email, created_at DESC)`
  ).run()
}

export async function upsertFinancialProfile(env: Env, email: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO financial_profiles (email, currency, created_at)
     VALUES (?, ?, datetime("now"))
     ON CONFLICT(email) DO UPDATE SET updated_at = datetime("now")`
  )
    .bind(email, DEFAULT_FINANCE_CURRENCY)
    .run()
}
