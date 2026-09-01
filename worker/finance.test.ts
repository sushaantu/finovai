import { expect, test } from 'bun:test'

import {
  DASHBOARD_CHAT_BENCHMARK_CASES,
  type DashboardBenchmarkStage,
} from './dashboard-chat-benchmark'

import worker from './index'
import { createTestDb, loadSchema } from './lib/test-d1'
import {
  buildActionPlan,
  buildCategoryAnalysis,
  buildFinancialInsights,
  buildFinancialSummary,
  finalizeDashboardChatAnswer,
  type FinanceTransaction,
} from '../shared/finance-core'
import {
  getSyncfyWebhookEndpointPaths,
  isSyncfyBackgroundRefreshDue,
  isSyncfyProviderPullRetryDue,
} from './lib/ingest'
import {
  extractSyncfyEventType,
  extractSyncfySiteMetadata,
  inferFinanceCategory,
  normalizeFinancialAmount,
  normalizeFinancialDate,
} from './lib/shared'
import {
  getOrCreateUserByEmail,
  storeSyncfyError,
  upsertFinancialProfile,
} from './lib/db'
import {
  buildSyncfyExternalId,
  buildSyncfyTransactionWindow,
  classifySyncfyCredentialBlocker,
  getOrCreateSyncfyUser,
  getSyncfyCredentialBlockerMessage,
  getSyncfyTransactionLookbackMonths,
  parseSyncfyCredentialHealth,
} from './lib/syncfy'
import {
  buildDashboardChatContext,
  classifyDashboardQuestionStage,
} from './routes/finance'

interface DashboardResponse {
  email: string
  transactions: FinanceTransaction[]
  profile?: {
    monthlyIncome: number | null
    monthlyBudget: number | null
    categoryBudgets: Record<string, number>
  }
  summary: {
    month: string
    monthlyIncome: number
    monthlySpending: number
  }
  categoryAnalysis?: {
    period: string
    periodLabel: string
    spendingTotal: number
    budgetTotal: number | null
    budgetSource: 'user' | 'income_rule' | 'missing'
    summaryAdvice: string
    categories: Array<{
      category: string
      amount: number
      previousAmount: number
      deltaFromPrevious: number
      budget: number | null
      budgetStatus: 'under' | 'near' | 'over' | 'unset'
      advice: string
    }>
    monthRows: Array<{
      month: string
      spendingTotal: number
      topCategory: string
      deltaFromPrevious: number | null
      budgetTotal: number | null
    }>
  }
  actionPlan?: {
    monthlySavingsTarget: number
    topOpportunities: Array<{ kind: string; title: string; estimatedMonthlySavings: number }>
    investmentProjection: { tenYearValue: number }
    nextActions: Array<{ id: string; label: string }>
  }
}

interface SyncfyCredentialsApiResponse {
  success?: boolean
  deletedTransactions?: number
  credentials: Array<{
    syncfyCredentialId: string
    siteName: string | null
    ready: boolean
    needsReconnect?: boolean
    connectionState?: 'ready' | 'verifying' | 'action_required' | 'provider_unavailable' | 'support_required' | 'broken' | 'abandoned'
    connectionIssue?: {
      kind: 'action_required' | 'provider_unavailable' | 'rate_limited' | 'unknown' | 'broken' | 'abandoned' | 'connecting'
      supportCode: string | null
      message: string
    } | null
  }>
}

// Tests run against real in-memory SQLite loaded from worker/schema.sql, through the same D1
// interface the Worker uses in production (see worker/lib/test-d1.ts). Seed helpers write rows
// with real INSERTs; read helpers assert with real SELECTs.
const SCHEMA_SQL = await loadSchema()

type TestD1 = ReturnType<typeof createTestDb>['db']
type TestSqlite = ReturnType<typeof createTestDb>['sqlite']
type SeedRow = Record<string, unknown>

const sqliteByTestDb = new WeakMap<TestD1, TestSqlite>()

function createTestD1(): TestD1 {
  const { db, sqlite } = createTestDb(SCHEMA_SQL)
  sqliteByTestDb.set(db, sqlite)
  return db
}

function toSqlValue(value: unknown): string | number | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  return JSON.stringify(value)
}

// Test fixtures were written against the old in-memory mock, so some rows carry the camelCase
// shape of `sampleTransaction` (`rawSource`) and some the column shape (`raw_source`).
function seedField(row: SeedRow, keys: string[], fallback: unknown = null): string | number | null {
  for (const key of keys) {
    if (row[key] !== undefined) return toSqlValue(row[key])
  }
  return toSqlValue(fallback)
}

async function readTable(db: TestD1, table: string): Promise<SeedRow[]> {
  // rowid order == insertion order, which is what the replaced mock's arrays gave us.
  const { results } = await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all<SeedRow>()
  return results
}

// Synchronous SELECT against the same SQLite handle the adapter writes to. Only for assertions
// that must observe state at an exact point in the microtask queue — e.g. right after a webhook
// responds but before its ctx.waitUntil() task has run. An `await` there would itself yield and
// let the background task finish first, which is precisely what the assertion is checking has not
// happened yet.
function readTableSync(db: TestD1, table: string): SeedRow[] {
  const sqlite = sqliteByTestDb.get(db)
  if (!sqlite) throw new Error(`No SQLite handle registered for this test D1 instance`)
  return sqlite.query(`SELECT * FROM ${table} ORDER BY rowid`).all() as SeedRow[]
}

async function seedTransactions(db: TestD1, ...rows: SeedRow[]): Promise<void> {
  for (const row of rows) {
    const createdAt = seedField(row, ['created_at'], '2026-05-01T00:00:00Z')
    const email = seedField(row, ['email'], 'user@example.com')
    // transactions.email is a real foreign key to financial_profiles(email), and the adapter
    // enforces it the way D1 does. Production always upserts the profile first; fixtures must too.
    await db
      .prepare(
        `INSERT INTO financial_profiles (email, currency, created_at)
         VALUES (?, 'MXN', ?)
         ON CONFLICT(email) DO NOTHING`
      )
      .bind(email, createdAt)
      .run()
    await db
      .prepare(
        `INSERT INTO transactions (
          id, email, date, type, amount, currency, category, description, merchant, notes,
          source, confidence, category_locked, raw_source, cartola_import_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        seedField(row, ['id'], crypto.randomUUID()),
        email,
        seedField(row, ['date'], '2026-05-01'),
        seedField(row, ['type'], 'expense'),
        seedField(row, ['amount'], 1000),
        seedField(row, ['currency'], 'MXN'),
        seedField(row, ['category'], 'Otro'),
        seedField(row, ['description'], 'Movimiento'),
        seedField(row, ['merchant']),
        seedField(row, ['notes']),
        seedField(row, ['source'], 'manual'),
        seedField(row, ['confidence'], 1),
        seedField(row, ['category_locked', 'categoryLocked'], 0),
        seedField(row, ['raw_source', 'rawSource']),
        seedField(row, ['cartola_import_id', 'cartolaImportId']),
        createdAt,
        seedField(row, ['updated_at'], createdAt)
      )
      .run()
  }
}

async function seedSyncfyCredentials(db: TestD1, ...rows: SeedRow[]): Promise<void> {
  for (const row of rows) {
    const createdAt = seedField(row, ['created_at'], '2026-06-01T00:00:00Z')
    await db
      .prepare(
        `INSERT INTO syncfy_credentials (
          id, email, syncfy_user_id, syncfy_credential_id, syncfy_site_id, site_name, status,
          state, attempt_count, last_successful_sync_at, last_pull_at, last_pull_attempt_at, last_rid, raw_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        seedField(row, ['id'], crypto.randomUUID()),
        seedField(row, ['email'], 'user@example.com'),
        seedField(row, ['syncfy_user_id'], 'syncfy-user-1'),
        seedField(row, ['syncfy_credential_id'], 'credential-1'),
        seedField(row, ['syncfy_site_id']),
        seedField(row, ['site_name']),
        seedField(row, ['status']),
        seedField(row, ['state'], 'pending'),
        seedField(row, ['attempt_count'], 0),
        seedField(row, ['last_successful_sync_at']),
        seedField(row, ['last_pull_at']),
        seedField(row, ['last_pull_attempt_at']),
        seedField(row, ['last_rid']),
        seedField(row, ['raw_json']),
        createdAt,
        seedField(row, ['updated_at'], createdAt)
      )
      .run()
  }
}

async function seedSyncfyUsers(db: TestD1, ...rows: SeedRow[]): Promise<void> {
  for (const row of rows) {
    await db
      .prepare(
        `INSERT INTO syncfy_users (
          email, syncfy_user_id, syncfy_external_id, name, mode, created_at, updated_at, last_session_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        seedField(row, ['email'], 'user@example.com'),
        seedField(row, ['syncfy_user_id'], 'syncfy-user-1'),
        seedField(row, ['syncfy_external_id'], 'finovai:user@example.com'),
        seedField(row, ['name']),
        seedField(row, ['mode'], 'live'),
        seedField(row, ['created_at'], '2026-06-01T00:00:00Z'),
        seedField(row, ['updated_at']),
        seedField(row, ['last_session_at'])
      )
      .run()
  }
}

async function seedSyncfyErrors(db: TestD1, ...rows: SeedRow[]): Promise<void> {
  for (const row of rows) {
    await db
      .prepare(
        `INSERT INTO syncfy_errors (
          id, email, syncfy_user_id, syncfy_credential_id, rid, status_code, error_code, message,
          source, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        seedField(row, ['id'], crypto.randomUUID()),
        seedField(row, ['email']),
        seedField(row, ['syncfy_user_id']),
        seedField(row, ['syncfy_credential_id']),
        seedField(row, ['rid']),
        seedField(row, ['status_code']),
        seedField(row, ['error_code']),
        seedField(row, ['message']),
        seedField(row, ['source'], 'test'),
        seedField(row, ['payload_json']),
        seedField(row, ['created_at'], new Date().toISOString())
      )
      .run()
  }
}

const readTransactions = (db: TestD1) => readTable(db, 'transactions')
const readSyncfyCredentials = (db: TestD1) => readTable(db, 'syncfy_credentials')
const readSyncfyUsers = (db: TestD1) => readTable(db, 'syncfy_users')
const readSyncfyErrors = (db: TestD1) => readTable(db, 'syncfy_errors')
const readSyncfyWebhookEvents = (db: TestD1) => readTable(db, 'syncfy_webhook_events')

test('getOrCreateUserByEmail is idempotent and normalizes email', async () => {
  const { db } = createTestDb(await loadSchema())
  const a = await getOrCreateUserByEmail(db, 'Foo@Bar.com ')
  const b = await getOrCreateUserByEmail(db, 'foo@bar.com')
  expect(a.id).toBe(b.id)
  expect(a.syncfy_identity_version).toBe(1)
})

test('buildSyncfyExternalId encodes user id and version', () => {
  expect(buildSyncfyExternalId('u-123', 3)).toBe('finovai:user:u-123:v3')
})

test('storeSyncfyError and upsertFinancialProfile stamp user_id without rewriting Syncfy external ids', async () => {
  const env = createEnv()
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: 'User',
    mode: 'live',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: null,
    last_session_at: null,
  })

  await upsertFinancialProfile(env as never, 'user@example.com')
  await storeSyncfyError(env as never, {
    email: 'user@example.com',
    syncfyUserId: 'syncfy-user-1',
    syncfyCredentialId: 'credential-1',
    message: 'test error',
    source: 'identity-stamp',
  })

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind('user@example.com')
    .first<{ id: string }>()
  expect(user?.id).toBeTruthy()
  const profile = await env.DB.prepare('SELECT user_id FROM financial_profiles WHERE email = ?')
    .bind('user@example.com')
    .first<{ user_id: string | null }>()
  expect(profile?.user_id).toBe(user?.id)
  const errorRow = await env.DB.prepare('SELECT user_id FROM syncfy_errors WHERE email = ?')
    .bind('user@example.com')
    .first<{ user_id: string | null }>()
  expect(errorRow?.user_id).toBe(user?.id)
  const syncfyUser = await env.DB.prepare('SELECT syncfy_external_id FROM syncfy_users WHERE email = ?')
    .bind('user@example.com')
    .first<{ syncfy_external_id: string }>()
  expect(syncfyUser?.syncfy_external_id).toBe('finovai:user@example.com')
})

test('getOrCreateSyncfyUser stamps user_id on existing rows without rewriting external id', async () => {
  const env = createEnv()
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: 'User',
    mode: 'live',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: null,
    last_session_at: null,
  })

  const row = await getOrCreateSyncfyUser(env as never, 'user@example.com')

  expect(row.user_id).toBeTruthy()
  expect(row.syncfy_external_id).toBe('finovai:user@example.com')
  const stored = await env.DB.prepare('SELECT user_id, syncfy_external_id FROM syncfy_users WHERE email = ?')
    .bind('user@example.com')
    .first<{ user_id: string | null; syncfy_external_id: string }>()
  expect(stored?.user_id).toBe(row.user_id)
  expect(stored?.syncfy_external_id).toBe('finovai:user@example.com')
  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind('user@example.com')
    .first<{ id: string }>()
  expect(user?.id).toBe(row.user_id)
})

test('test-d1 adapter runs real schema and round-trips a row', async () => {
  const { db } = createTestDb(await loadSchema())
  await db.prepare(`INSERT INTO leads (email, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))`)
    .bind('a@b.co').run()
  const row = await db.prepare('SELECT email FROM leads WHERE email = ?').bind('a@b.co').first<{ email: string }>()
  expect(row?.email).toBe('a@b.co')
})

test('test-d1 adapter accepts D1 double-quoted string literals and reports meta.changes', async () => {
  const { db } = createTestDb(await loadSchema())
  // Production code writes `datetime("now")` (double quotes) in several places; D1 accepts it and
  // the adapter has to as well, otherwise those statements would only fail in production.
  await db.prepare(`INSERT INTO leads (email, created_at) VALUES (?, datetime("now"))`).bind('dq@b.co').run()
  const row = await db.prepare('SELECT created_at FROM leads WHERE email = ?').bind('dq@b.co').first<{ created_at: string }>()
  expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2} /)

  const update = await db.prepare(`UPDATE leads SET name = ? WHERE email = ?`).bind('dq', 'dq@b.co').run()
  expect(update.meta.changes).toBe(1)
  const noop = await db.prepare(`UPDATE leads SET name = ? WHERE email = ?`).bind('dq', 'missing@b.co').run()
  expect(noop.meta.changes).toBe(0)
})

function createEnv(environment = 'test', overrides: Record<string, unknown> = {}) {
  return {
    DB: createTestD1(),
    AI: { run: async () => ({ response: '' }) },
    ENVIRONMENT: environment,
    ...overrides,
  }
}

function sampleTransaction(overrides: Partial<FinanceTransaction>): FinanceTransaction {
  return {
    id: crypto.randomUUID(),
    email: 'user@example.com',
    date: '2026-05-01',
    type: 'expense',
    amount: 1000,
    currency: 'CLP',
    category: 'Otro',
    description: 'Movimiento',
    merchant: 'Movimiento',
    notes: null,
    source: 'manual',
    confidence: 1,
    rawSource: null,
    cartolaImportId: null,
    created_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

test('normalizeFinancialAmount handles Chilean and Mexican formats', () => {
  expect(normalizeFinancialAmount('$1.234,56')).toBe(1234.56)
  expect(normalizeFinancialAmount('1,234.56')).toBe(1234.56)
  expect(normalizeFinancialAmount('-2.650')).toBe(-2650)
  expect(normalizeFinancialAmount('123,45')).toBe(123.45)
})

test('normalizeFinancialDate accepts ISO, day-first, and bank-style dates', () => {
  expect(normalizeFinancialDate('2026-05-20')).toBe('2026-05-20')
  expect(normalizeFinancialDate('20/05/2026')).toBe('2026-05-20')
  expect(normalizeFinancialDate('20-may-26')).toBe('2026-05-20')
  expect(normalizeFinancialDate('31/02/2026')).toBeNull()
})

test('inferFinanceCategory recognizes common Mexico cartola merchants', () => {
  expect(inferFinanceCategory('DLO*UBER EATS', 'expense')).toBe('Comida fuera')
  expect(inferFinanceCategory('REST BALBOA LERMA', 'expense')).toBe('Comida fuera')
  expect(inferFinanceCategory('WM EXPRESS HOMERO', 'expense')).toBe('Supermercado')
  expect(inferFinanceCategory('AMERICAN EXPRESS 01429', 'expense')).toBe('Deuda')
  expect(inferFinanceCategory('SPEI ENVIADO STP', 'expense')).toBe('Transferencias')
  expect(inferFinanceCategory('RETIRO CAJERO AUTOMATICO', 'expense')).toBe('Retiros')
  expect(inferFinanceCategory('ONLYFANS.COM*A', 'expense')).toBe('Ocio')
  expect(inferFinanceCategory('ZOOM.COM 888-799-9666', 'expense')).toBe('Suscripciones')
  expect(inferFinanceCategory('GYMPASS CIUDAD DE MEXIC', 'expense')).toBe('Salud')
  expect(inferFinanceCategory('BILLPOCKET*SIGNORA MARI MIGUEL HIDALG', 'expense')).toBe('Comida fuera')
  expect(inferFinanceCategory('SAMS POLANCO CD MEXICO', 'expense')).toBe('Supermercado')
  expect(inferFinanceCategory('WAL MART SATELITE', 'expense')).toBe('Supermercado')
  expect(inferFinanceCategory('INTERESES DEL PERIODO', 'expense')).toBe('Deuda')
  expect(inferFinanceCategory('COMISION POR DISPOSICION', 'expense')).toBe('Deuda')
  expect(inferFinanceCategory('DISPOS.EFECTIVO', 'expense')).toBe('Retiros')
  expect(inferFinanceCategory('RETIRO RETIRO', 'expense')).toBe('Retiros')
  expect(inferFinanceCategory('BITSO COMPRA BTC', 'expense')).toBe('Inversión')
  expect(inferFinanceCategory('CETESDIRECTO AHORRO', 'expense')).toBe('Inversión')
  expect(inferFinanceCategory('CLIP MX', 'expense')).toBe('Compras')
  expect(inferFinanceCategory('GRACIAS POR SU PAGO EN LINEA', 'expense')).toBe('Deuda')
  expect(inferFinanceCategory('FIGMA SAN FRANCISCO', 'expense')).toBe('Suscripciones')
})

test('syncfy rows without provider categories are reclassified from raw transaction text on read', async () => {
  const env = createEnv()
  await seedTransactions(env.DB, 
    {
      ...sampleTransaction({
        id: 'syncfy:walmart',
        type: 'expense',
        category: 'Impuestos',
        description: 'WAL MART SATELITE',
        merchant: 'WAL MART SATELITE',
        source: 'syncfy',
      }),
      category_locked: 0,
      raw_source: JSON.stringify({ description: 'WAL MART SATELITE', amount: -2485.5 }),
    },
    {
      ...sampleTransaction({
        id: 'syncfy:interest',
        type: 'expense',
        category: 'Otro',
        description: 'INTERES',
        merchant: 'INTERES',
        source: 'syncfy',
      }),
      category_locked: 0,
      raw_source: JSON.stringify({ description: 'INTERES', amount: 2479.5 }),
    },
    {
      ...sampleTransaction({
        id: 'syncfy:locked',
        type: 'expense',
        category: 'Impuestos',
        description: 'WAL MART SATELITE',
        merchant: 'WAL MART SATELITE',
        source: 'syncfy',
      }),
      category_locked: 1,
      raw_source: JSON.stringify({ description: 'WAL MART SATELITE', amount: -2485.5 }),
    }
  )

  const response = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com'), env)
  const dashboard = await response.json() as DashboardResponse

  expect(response.status).toBe(200)
  expect(dashboard.transactions.find((transaction) => transaction.id === 'syncfy:walmart')).toMatchObject({
    type: 'expense',
    category: 'Supermercado',
  })
  expect(dashboard.transactions.find((transaction) => transaction.id === 'syncfy:interest')).toMatchObject({
    type: 'income',
    category: 'Inversión',
  })
  expect(dashboard.transactions.find((transaction) => transaction.id === 'syncfy:locked')).toMatchObject({
    category: 'Impuestos',
  })
})

test('buildFinancialSummary and insights are deterministic from persisted transactions', () => {
  const transactions = [
    sampleTransaction({ date: '2026-05-01', type: 'income', amount: 1_200_000, category: 'Sueldo', description: 'Sueldo' }),
    sampleTransaction({ date: '2026-05-02', type: 'expense', amount: 35_000, category: 'Supermercado', description: 'Jumbo' }),
    sampleTransaction({ date: '2026-05-03', type: 'expense', amount: 120_000, category: 'Comida fuera', description: 'Restaurantes' }),
    sampleTransaction({ date: '2026-04-20', type: 'expense', amount: 6_990, category: 'Suscripciones', description: 'Netflix', merchant: 'Netflix' }),
    sampleTransaction({ date: '2026-05-20', type: 'expense', amount: 6_990, category: 'Suscripciones', description: 'Netflix', merchant: 'Netflix' }),
  ]

  const summary = buildFinancialSummary(transactions)
  const insights = buildFinancialInsights(summary, transactions)

  expect(summary.month).toBe('2026-05')
  expect(summary.monthlyIncome).toBe(1_200_000)
  expect(summary.monthlySpending).toBe(161_990)
  expect(summary.transactionCount).toBe(5)
  expect(summary.dataCoverage).toMatchObject({
    firstMonth: '2026-04',
    lastMonth: '2026-05',
    monthCount: 2,
    transactionCount: 5,
    preliminary: true,
  })
  expect(summary.topSpendingCategory).toBe('Comida fuera')
  expect(summary.recurringExpenses[0].description).toBe('Netflix')
  expect(summary.estimatedSavingsOpportunity).toBeGreaterThan(0)
  expect(insights.map((insight) => insight.id)).toContain('net-balance')
})

test('dashboard chat context includes all-history category totals when latest month is generic', () => {
  const transactions = [
    sampleTransaction({ date: '2026-05-01', type: 'expense', amount: 1200, category: 'Comida fuera', description: 'Restaurante' }),
    sampleTransaction({ date: '2026-05-02', type: 'expense', amount: 800, category: 'Supermercado', description: 'Super' }),
    sampleTransaction({ date: '2026-06-01', type: 'expense', amount: 100, category: 'Otro', description: 'Movimiento sin clasificar' }),
  ]
  const summary = buildFinancialSummary(transactions)
  const context = JSON.parse(buildDashboardChatContext({
    success: true,
    email: 'user@example.com',
    transactions,
    summary,
    insights: buildFinancialInsights(summary, transactions),
    actionPlan: buildActionPlan(summary, transactions),
  }))

  expect(summary.month).toBe('2026-06')
  expect(summary.topSpendingCategory).toBe('Otro')
  expect(context.categoryBreakdown.currentMonth[0]).toMatchObject({ category: 'Otro', amount: 100 })
  expect(context.categoryBreakdown.allExpenses[0]).toMatchObject({ category: 'Comida fuera', amount: 1200 })
  expect(context.categoryBreakdown.rule).toContain('allExpenses')
  expect(context.analysisWindow).toMatchObject({
    firstMonth: '2026-05',
    lastMonth: '2026-06',
    monthCount: 2,
    transactionCount: 3,
    preliminary: true,
  })
})

test('dashboard question classifier maps FinovAI benchmark questions to stages', () => {
  for (const { question, expectedStage } of DASHBOARD_CHAT_BENCHMARK_CASES) {
    const stage: DashboardBenchmarkStage = expectedStage
    expect(classifyDashboardQuestionStage(question).stage).toBe(stage)
  }
})

test('dashboard chat context gates investment when expensive debt is active', () => {
  const transactions = [
    sampleTransaction({ date: '2026-05-01', type: 'income', amount: 100000, category: 'Sueldo', description: 'Nomina' }),
    sampleTransaction({ date: '2026-05-03', type: 'expense', amount: 30000, category: 'Deuda', description: 'AMERICAN EXPRESS 01429', merchant: 'American Express' }),
    sampleTransaction({ date: '2026-05-04', type: 'expense', amount: 8000, category: 'Deuda', description: 'INTERESES DEL PERIODO', merchant: 'American Express' }),
    sampleTransaction({ date: '2026-05-08', type: 'expense', amount: 6000, category: 'Comida fuera', description: 'DLO*UBER EATS', merchant: 'Uber Eats' }),
    sampleTransaction({ date: '2026-05-15', type: 'expense', amount: 6200, category: 'Comida fuera', description: 'DLO*UBER EATS', merchant: 'Uber Eats' }),
  ]
  const summary = buildFinancialSummary(transactions)
  const actionPlan = buildActionPlan(summary, transactions)
  const context = JSON.parse(buildDashboardChatContext({
    success: true,
    email: 'user@example.com',
    transactions,
    summary,
    insights: buildFinancialInsights(summary, transactions),
    actionPlan,
  }, 'Puedo invertir si todavia tengo deudas?'))

  expect(context.questionBenchmark).toMatchObject({
    stage: 'liquidacion_de_deuda',
    category: 'Deudas',
  })
  expect(context.financialStage).toMatchObject({
    stage: 'liquidacion_de_deuda',
    debtGate: {
      active: true,
      monthlyDebtPayments: 38000,
      debtShareOfIncome: 38,
    },
  })
  expect(context.responseRules).toContain('incluye numeros reales')
  expect(actionPlan.nextActions.map((action) => action.id)).toContain('debt-first')
  expect(actionPlan.nextActions.map((action) => action.id)).not.toContain('route-investment')
})

test('dashboard chat context scales advice from the user income instead of generic amounts', () => {
  const transactions = [
    sampleTransaction({ date: '2026-05-01', type: 'income', amount: 52000, category: 'Sueldo', description: 'Nomina' }),
    sampleTransaction({ date: '2026-05-03', type: 'expense', amount: 14000, category: 'Renta', description: 'Renta' }),
    sampleTransaction({ date: '2026-05-05', type: 'expense', amount: 8800, category: 'Comida fuera', description: 'Restaurantes' }),
    sampleTransaction({ date: '2026-05-08', type: 'expense', amount: 4200, category: 'Transporte', description: 'Uber' }),
  ]
  const summary = buildFinancialSummary(transactions)
  const context = JSON.parse(buildDashboardChatContext({
    success: true,
    email: 'user@example.com',
    profile: {
      email: 'user@example.com',
      currency: 'MXN',
      monthlyIncome: null,
      monthlyBudget: null,
      categoryBudgets: {},
    },
    transactions,
    summary,
    categoryAnalysis: buildCategoryAnalysis(transactions, summary, {
      email: 'user@example.com',
      currency: 'MXN',
      monthlyIncome: null,
      monthlyBudget: null,
      categoryBudgets: {},
    }),
    insights: buildFinancialInsights(summary, transactions),
    actionPlan: buildActionPlan(summary, transactions),
  }, 'Cuanto puedo ahorrar realista al mes?'))

  expect(context.incomeGuidance).toMatchObject({
    effectiveMonthlyIncome: 52000,
    incomeSource: 'transactions',
    currentSpendingShareOfIncome: 52,
    currentSavingsRate: 48,
    recommendedMonthlyBudget: 41600,
    starterSavingsTarget: 2600,
    strongSavingsTarget: 10400,
  })
  expect(context.responseRules).toContain('calcula recomendaciones como porcentaje del ingreso real')
  expect(context.responseRules).toContain('No uses montos fijos genericos')
})

test('dashboard chat answer finalizer uses visible destinations and removes trailing fragments', () => {
  expect(
    finalizeDashboardChatAnswer('Ve a Revisar recurrentes y confirma los cargos repetidos.')
  ).toBe('Ve a Movimientos y confirma los cargos repetidos.')

  expect(
    finalizeDashboardChatAnswer('1. Corta retiros nuevos.\n2. Revisa comisiones antes de')
  ).toBe('1. Corta retiros nuevos.')

  expect(
    finalizeDashboardChatAnswer('Gastos en restaurantes por mes.\n\nCHART\n```json\n{\"type\":\"line\",\"labels\":[\"2026-05\"],\"datasets\":[]}\n```')
  ).toBe('Gastos en restaurantes por mes.')

  expect(
    finalizeDashboardChatAnswer('Puedes invertir MXN 2.400 al mes en una ruta conservadora.')
  ).toContain('Información general')
})

test('dashboard chat reports missing model configuration instead of local fallback', async () => {
  const env = createEnv()
  const response = await worker.fetch(new Request('http://local.test/api/dashboard/chat', {
    method: 'POST',
    body: JSON.stringify({
      email: 'user@example.com',
      question: '¿Dónde estoy gastando más?',
    }),
  }), env)
  const data = await response.json() as { error?: string }

  expect(response.status).toBe(502)
  expect(data.error).toContain('CLOUDFLARE_AI_GATEWAY_ID')
})

test('dashboard chat uses Cloudflare AI Gateway with financial context', async () => {
  const env = createEnv('test', {
    CLOUDFLARE_AI_GATEWAY_ID: 'finovai',
    CLOUDFLARE_AI_GATEWAY_TOKEN: 'gateway-token',
    CLOUDFLARE_AI_GATEWAY_BYOK_ALIAS: 'production',
  })
  const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch

  await worker.fetch(new Request('http://local.test/api/transactions/manual', {
    method: 'POST',
    body: JSON.stringify({
      email: 'user@example.com',
      date: '2026-05-01',
      type: 'income',
      amount: 60000,
      currency: 'MXN',
      category: 'Sueldo',
      description: 'Nomina',
    }),
  }), env)
  await worker.fetch(new Request('http://local.test/api/transactions/manual', {
    method: 'POST',
    body: JSON.stringify({
      email: 'user@example.com',
      date: '2026-05-16',
      type: 'expense',
      amount: 2900,
      currency: 'MXN',
      category: 'Comida fuera',
      description: 'DLO*UBER EATS',
      merchant: 'Uber Eats',
    }),
  }), env)

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
    })

    return new Response(JSON.stringify({
      content: [{ type: 'text', text: 'Tu mayor fuga está en Comida fuera.' }],
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/dashboard/chat', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        question: '¿Dónde estoy gastando más?',
      }),
    }), env)
    const data = await response.json() as { answer?: string; model?: string }

    expect(response.status).toBe(200)
    expect(data.answer).toBe('Tu mayor fuga está en Comida fuera.')
    expect(data.model).toBe('claude-opus-4-8')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://gateway.ai.cloudflare.com/v1/711cb78717605db93e601e6a06e7eeec/finovai/anthropic/v1/messages')
    expect(calls[0].headers.get('cf-aig-authorization')).toBe('Bearer gateway-token')
    expect(calls[0].headers.get('cf-aig-byok-alias')).toBe('production')

    const message = ((calls[0].body.messages as Array<{ content: string }>)[0]).content
    expect(String(calls[0].body.system)).toContain('categoryBreakdown.allExpenses')
    expect(message).toContain('Pregunta del usuario: ¿Dónde estoy gastando más?')
    expect(message).toContain('DLO*UBER EATS')
    expect(message).toContain('Comida fuera')
    expect(message).toContain('categoryBreakdown')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('dashboard chat can use Cloudflare AI Gateway compat chat completions endpoint', async () => {
  const endpoint = 'https://gateway.ai.cloudflare.com/v1/711cb78717605db93e601e6a06e7eeec/default/compat/chat/completions'
  const model = 'workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast'
  const env = createEnv('test', {
    CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT: endpoint,
    CLOUDFLARE_AI_GATEWAY_TOKEN: 'gateway-token',
    CLOUDFLARE_AI_GATEWAY_COMPAT_MODEL: model,
  })
  const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
    })

    return new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'Compat Gateway ok.' } }],
      model,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/dashboard/chat', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        question: '¿Dónde estoy gastando más?',
      }),
    }), env)
    const data = await response.json() as { answer?: string; model?: string }

    expect(response.status).toBe(200)
    expect(data.answer).toBe('Compat Gateway ok.')
    expect(data.model).toBe(model)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(endpoint)
    expect(calls[0].headers.get('cf-aig-authorization')).toBe('Bearer gateway-token')
    expect(calls[0].body.model).toBe(model)
    expect(JSON.stringify(calls[0].body.messages)).toContain('Datos financieros disponibles')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('buildActionPlan turns repeated leaks into investment-ready next actions', () => {
  const transactions = [
    sampleTransaction({ date: '2026-05-01', type: 'income', amount: 60000, category: 'Sueldo', description: 'Nomina' }),
    sampleTransaction({ date: '2026-05-02', type: 'expense', amount: 2800, category: 'Comida fuera', description: 'DLO*UBER EATS', merchant: 'Uber Eats' }),
    sampleTransaction({ date: '2026-05-09', type: 'expense', amount: 3100, category: 'Comida fuera', description: 'DLO*UBER EATS', merchant: 'Uber Eats' }),
    sampleTransaction({ date: '2026-05-16', type: 'expense', amount: 2900, category: 'Comida fuera', description: 'DLO*UBER EATS', merchant: 'Uber Eats' }),
    sampleTransaction({ date: '2026-04-20', type: 'expense', amount: 299, category: 'Suscripciones', description: 'Spotify', merchant: 'Spotify' }),
    sampleTransaction({ date: '2026-05-20', type: 'expense', amount: 299, category: 'Suscripciones', description: 'Spotify', merchant: 'Spotify' }),
  ]
  const summary = buildFinancialSummary(transactions)
  const plan = buildActionPlan(summary, transactions)

  expect(plan.topOpportunities.map((opportunity) => opportunity.kind)).toContain('recurring')
  expect(plan.topOpportunities.map((opportunity) => opportunity.kind)).toContain('merchant_leak')
  expect(plan.monthlySavingsTarget).toBeGreaterThan(0)
  expect(plan.investmentProjection.tenYearValue).toBeGreaterThan(plan.monthlySavingsTarget * 12)
  expect(plan.nextActions.map((action) => action.id)).toContain('review-recurring')
  expect(plan.nextActions.find((action) => action.id === 'review-recurring')?.label).toBe('Ver movimientos')
  expect(plan.nextActions.map((action) => action.id)).toContain('route-investment')
})

test('manual transaction endpoint persists and reloads by email', async () => {
  const env = createEnv()
  const response = await worker.fetch(new Request('http://local.test/api/transactions/manual', {
    method: 'POST',
    body: JSON.stringify({
      email: 'USER@Example.com',
      date: '20/05/2026',
      type: 'expense',
      amount: '12.500',
      category: 'Comida fuera',
      description: 'Almuerzo',
    }),
  }), env)

  expect(response.status).toBe(201)
  const created = await response.json() as DashboardResponse
  expect(created.email).toBe('user@example.com')
  expect(created.transactions).toHaveLength(1)
  expect(created.transactions[0].source).toBe('manual')

  const reload = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com'), env)
  const dashboard = await reload.json() as DashboardResponse
  expect(dashboard.transactions).toHaveLength(1)
  expect(dashboard.summary.monthlySpending).toBe(12500)

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind('user@example.com')
    .first<{ id: string }>()
  const stored = await env.DB.prepare('SELECT user_id FROM transactions WHERE email = ?')
    .bind('user@example.com')
    .first<{ user_id: string | null }>()
  expect(user?.id).toBeTruthy()
  expect(stored?.user_id).toBe(user?.id)
})

test('profile endpoint stores income, budget, and category budgets', async () => {
  const env = createEnv()
  const response = await worker.fetch(new Request('http://local.test/api/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      email: 'USER@Example.com',
      monthlyIncome: 100000,
      monthlyBudget: 65000,
      categoryBudgets: {
        Deuda: 30000,
        'Comida fuera': 8000,
      },
    }),
  }), env)
  const data = await response.json() as DashboardResponse

  expect(response.status).toBe(200)
  expect(data.email).toBe('user@example.com')
  expect(data.profile).toMatchObject({
    monthlyIncome: 100000,
    monthlyBudget: 65000,
    categoryBudgets: {
      Deuda: 30000,
      'Comida fuera': 8000,
    },
  })
})

test('dashboard category analysis compares current month to budget and previous month', async () => {
  const env = createEnv()
  await worker.fetch(new Request('http://local.test/api/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      email: 'user@example.com',
      monthlyIncome: 100000,
      monthlyBudget: 65000,
      categoryBudgets: {
        Deuda: 30000,
        'Comida fuera': 8000,
      },
    }),
  }), env)
  await seedTransactions(env.DB, 
    sampleTransaction({ date: '2026-04-02', type: 'income', amount: 100000, category: 'Sueldo', description: 'Nomina' }),
    sampleTransaction({ date: '2026-04-08', type: 'expense', amount: 20000, category: 'Deuda', description: 'Pago credito' }),
    sampleTransaction({ date: '2026-04-12', type: 'expense', amount: 5000, category: 'Comida fuera', description: 'Restaurante' }),
    sampleTransaction({ date: '2026-05-02', type: 'income', amount: 100000, category: 'Sueldo', description: 'Nomina' }),
    sampleTransaction({ date: '2026-05-08', type: 'expense', amount: 43000, category: 'Deuda', description: 'Pago credito' }),
    sampleTransaction({ date: '2026-05-12', type: 'expense', amount: 12000, category: 'Comida fuera', description: 'Restaurante' })
  )

  const response = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com'), env)
  const dashboard = await response.json() as DashboardResponse

  expect(response.status).toBe(200)
  expect(dashboard.categoryAnalysis?.period).toBe('2026-05')
  expect(dashboard.categoryAnalysis?.budgetTotal).toBe(65000)
  expect(dashboard.categoryAnalysis?.budgetSource).toBe('user')
  expect(dashboard.categoryAnalysis?.summaryAdvice).toContain('presupuesto')
  expect(dashboard.categoryAnalysis?.categories[0]).toMatchObject({
    category: 'Deuda',
    amount: 43000,
    previousAmount: 20000,
    deltaFromPrevious: 23000,
    budget: 30000,
    budgetStatus: 'over',
  })
  expect(dashboard.categoryAnalysis?.categories[0].advice).toContain('sobre presupuesto')
  expect(dashboard.categoryAnalysis?.monthRows.map((row) => row.month)).toEqual(['2026-05', '2026-04'])
})

test('syncfy credentials endpoint skips catalogue lookup when a useful site name is cached', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: 'unknown-site-id',
    site_name: 'BBVA México',
    status: 'needs_reconnect',
    state: 'needs_user',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-02T00:00:00Z',
    updated_at: '2026-06-02T00:00:00Z',
  })

  const originalFetch = globalThis.fetch
  let externalFetches = 0
  globalThis.fetch = (async () => {
    externalFetches += 1
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/credentials?email=user@example.com'), env)
    const data = await response.json() as SyncfyCredentialsApiResponse

    expect(response.status).toBe(200)
    expect(data.credentials).toHaveLength(1)
    expect(data.credentials[0]).toMatchObject({
      syncfyCredentialId: 'credential-1',
      siteName: 'BBVA México',
      ready: true,
      needsReconnect: true,
    })
    expect(externalFetches).toBe(0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy credentials endpoint exposes actionable institution errors instead of indefinite pending', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: 'amex-site',
    site_name: 'American Express',
    status: 'needs_reconnect',
    state: 'needs_user',
    last_successful_sync_at: null,
    last_pull_at: '2026-07-29T04:00:51Z',
    last_rid: 'password-rid',
    raw_json: null,
    created_at: '2026-07-28T03:18:10Z',
    updated_at: '2026-07-29T04:00:51Z',
  })
  await seedSyncfyErrors(env.DB, {
    id: 'error-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    rid: 'password-rid',
    status_code: 400,
    error_code: '400',
    message: 'Credential error, please consider updating credential password',
    source: 'syncfy-pull',
    created_at: new Date().toISOString(),
  })

  const response = await worker.fetch(
    new Request('http://local.test/api/syncfy/credentials?email=user@example.com'),
    env
  )
  const data = await response.json() as SyncfyCredentialsApiResponse

  expect(response.status).toBe(200)
  expect(data.credentials[0]).toMatchObject({
    connectionState: 'action_required',
    needsReconnect: true,
    connectionIssue: {
      kind: 'action_required',
    },
  })
  expect(data.credentials[0].connectionIssue?.message).toContain('Vuelve a conectar')
})

test('syncfy credentials endpoint replaces auth-channel labels with organization catalogue names', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: 'mx-site-1',
    site_name: 'Personal',
    status: 'synced',
    last_successful_sync_at: '2026-06-02T00:00:00Z',
    last_pull_at: '2026-06-02T00:00:00Z',
    last_rid: null,
    raw_json: JSON.stringify({
      id_credential: 'credential-1',
      id_site: 'mx-site-1',
      id_site_organization: 'mx-org-1',
      site: { name: 'Personal' },
    }),
    created_at: '2026-06-02T00:00:00Z',
    updated_at: '2026-06-02T00:00:00Z',
  })

  const originalFetch = globalThis.fetch
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)

    if (url.includes('/catalogues/site_organizations')) {
      return new Response(JSON.stringify({
        response: {
          id_site_organization: 'mx-org-1',
          name: 'BBVA México',
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('/catalogues/organizations/sites') || url.includes('/catalogues/sites')) {
      return new Response(JSON.stringify({
        response: {
          id_site: 'mx-site-1',
          id_site_organization: 'mx-org-1',
          name: 'Personal',
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ response: {} }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/credentials?email=user@example.com'), env)
    const data = await response.json() as SyncfyCredentialsApiResponse

    expect(response.status).toBe(200)
    expect(data.credentials[0]).toMatchObject({
      syncfyCredentialId: 'credential-1',
      siteName: 'BBVA México',
    })
    expect((await readSyncfyCredentials(env.DB))[0].site_name).toBe('BBVA México')
    expect(calls.some((url) => url.includes('/catalogues/site_organizations'))).toBe(true)
    expect(calls.some((url) => url.includes('/catalogues/organizations/sites'))).toBe(false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy credentials endpoint keeps channel labels when catalogue enrichment fails', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: 'mx-site-1',
    site_name: 'Personal',
    status: 'synced',
    last_successful_sync_at: '2026-06-02T00:00:00Z',
    last_pull_at: '2026-06-02T00:00:00Z',
    last_rid: null,
    raw_json: JSON.stringify({
      id_credential: 'credential-1',
      id_site: 'mx-site-1',
      id_site_organization: 'mx-org-1',
      site: { name: 'Personal' },
    }),
    created_at: '2026-06-02T00:00:00Z',
    updated_at: '2026-06-02T00:00:00Z',
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('{}', {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/credentials?email=user@example.com'), env)
    const data = await response.json() as SyncfyCredentialsApiResponse

    expect(response.status).toBe(200)
    expect(data.credentials[0]).toMatchObject({
      syncfyCredentialId: 'credential-1',
      siteName: 'Personal',
    })
    expect((await readSyncfyCredentials(env.DB))[0].site_name).toBe('Personal')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy credential delete removes one connection and its imported transactions', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, 
    {
      id: 'credential-row-1',
      email: 'user@example.com',
      syncfy_user_id: 'syncfy-user-1',
      syncfy_credential_id: 'credential-1',
      syncfy_site_id: 'bank-1',
      site_name: 'BBVA México',
      status: 'synced',
      last_successful_sync_at: '2026-06-02T00:00:00Z',
      last_pull_at: '2026-06-02T00:00:00Z',
      last_rid: null,
      raw_json: null,
      created_at: '2026-06-02T00:00:00Z',
      updated_at: '2026-06-02T00:00:00Z',
    },
    {
      id: 'credential-row-2',
      email: 'user@example.com',
      syncfy_user_id: 'syncfy-user-1',
      syncfy_credential_id: 'credential-2',
      syncfy_site_id: 'bank-2',
      site_name: 'American Express',
      status: 'synced',
      last_successful_sync_at: '2026-06-02T00:00:00Z',
      last_pull_at: '2026-06-02T00:00:00Z',
      last_rid: null,
      raw_json: null,
      created_at: '2026-06-02T00:00:00Z',
      updated_at: '2026-06-02T00:00:00Z',
    }
  )
  await seedTransactions(env.DB, 
    {
      ...sampleTransaction({
        id: 'syncfy:credential-1:restaurant',
        source: 'syncfy',
        description: 'RESTAURANTE UNO',
        merchant: 'RESTAURANTE UNO',
      }),
      raw_source: JSON.stringify({ _finovaiCredentialId: 'credential-1', description: 'RESTAURANTE UNO' }),
    },
    {
      ...sampleTransaction({
        id: 'syncfy:credential-2:grocery',
        source: 'syncfy',
        description: 'SUPER DOS',
        merchant: 'SUPER DOS',
      }),
      raw_source: JSON.stringify({ _finovaiCredentialId: 'credential-2', description: 'SUPER DOS' }),
    },
    sampleTransaction({ id: 'manual:rent', source: 'manual', description: 'Renta' })
  )

  const calls: Array<{ url: string; method?: string }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method })
    return new Response(JSON.stringify({ status: true, response: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/credential', {
      method: 'DELETE',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as SyncfyCredentialsApiResponse & DashboardResponse & {
      syncfyCredentialDeleteAttempted?: boolean
      syncfyCredentialDeleted?: boolean
    }

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.deletedTransactions).toBe(1)
    expect(data.syncfyCredentialDeleteAttempted).toBe(true)
    expect(data.syncfyCredentialDeleted).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('DELETE')
    expect(calls[0].url).toContain('/credentials/credential-1?id_user=syncfy-user-1')
    expect(data.credentials.map((credential) => credential.syncfyCredentialId)).toEqual(['credential-2'])
    expect((await readSyncfyCredentials(env.DB)).filter((credential) => !credential.deleted_at).map((credential) => credential.syncfy_credential_id)).toEqual(['credential-2'])
    expect((await readSyncfyCredentials(env.DB)).find((credential) => credential.syncfy_credential_id === 'credential-1')?.deleted_at).toBeTruthy()
    expect((await readTransactions(env.DB)).map((transaction) => transaction.id)).toEqual([
      'syncfy:credential-2:grocery',
      'manual:rent',
    ])
    expect(data.transactions.map((transaction) => transaction.id).sort()).toEqual([
      'manual:rent',
      'syncfy:credential-2:grocery',
    ].sort())
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy credential delete preserves local state when upstream delete has retryable failure', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: 'bank-1',
    site_name: 'BBVA México',
    status: 'synced',
    last_successful_sync_at: '2026-06-02T00:00:00Z',
    last_pull_at: '2026-06-02T00:00:00Z',
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-02T00:00:00Z',
    updated_at: '2026-06-02T00:00:00Z',
  })
  await seedTransactions(env.DB, {
    ...sampleTransaction({
      id: 'syncfy:credential-1:restaurant',
      source: 'syncfy',
      description: 'RESTAURANTE UNO',
      merchant: 'RESTAURANTE UNO',
    }),
    raw_source: JSON.stringify({ _finovaiCredentialId: 'credential-1', description: 'RESTAURANTE UNO' }),
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    status: false,
    rid: 'delete-rid-1',
    code: 503,
    message: 'Syncfy unavailable',
    response: null,
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/credential', {
      method: 'DELETE',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as { success?: boolean; localStateDeleted?: boolean; rid?: string }

    expect(response.status).toBe(502)
    expect(data.success).toBe(false)
    expect(data.localStateDeleted).toBe(false)
    expect(data.rid).toBe('delete-rid-1')
    expect((await readSyncfyCredentials(env.DB)).map((credential) => credential.syncfy_credential_id)).toEqual(['credential-1'])
    expect((await readTransactions(env.DB)).map((transaction) => transaction.id)).toEqual(['syncfy:credential-1:restaurant'])
    expect(await readSyncfyErrors(env.DB)).toHaveLength(1)
    expect((await readSyncfyErrors(env.DB))[0]).toMatchObject({
      email: 'user@example.com',
      syncfy_credential_id: 'credential-1',
      rid: 'delete-rid-1',
      status_code: 503,
      source: 'syncfy-delete-credential',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy credential delete cleans local stale rows when upstream credential is already gone', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: 'bank-1',
    site_name: 'BBVA México',
    status: 'needs_reconnect',
    last_successful_sync_at: null,
    last_pull_at: '2026-06-02T00:00:00Z',
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-02T00:00:00Z',
    updated_at: '2026-06-02T00:00:00Z',
  })
  await seedTransactions(env.DB, {
    ...sampleTransaction({
      id: 'syncfy:credential-1:restaurant',
      source: 'syncfy',
      description: 'RESTAURANTE UNO',
      merchant: 'RESTAURANTE UNO',
    }),
    raw_source: JSON.stringify({ _finovaiCredentialId: 'credential-1', description: 'RESTAURANTE UNO' }),
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    status: false,
    rid: 'delete-rid-2',
    code: 404,
    message: 'Credential not found',
    response: null,
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/credential', {
      method: 'DELETE',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as SyncfyCredentialsApiResponse & DashboardResponse & {
      syncfyCredentialDeleteAttempted?: boolean
      syncfyCredentialDeleted?: boolean
    }

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.syncfyCredentialDeleteAttempted).toBe(true)
    expect(data.syncfyCredentialDeleted).toBe(false)
    expect(data.credentials).toEqual([])
    expect((await readSyncfyCredentials(env.DB))[0]?.deleted_at).toBeTruthy()
    expect(await readTransactions(env.DB)).toEqual([])
    expect(await readSyncfyErrors(env.DB)).toHaveLength(1)
    expect((await readSyncfyErrors(env.DB))[0]).toMatchObject({
      rid: 'delete-rid-2',
      status_code: 404,
      source: 'syncfy-delete-credential',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy credential delete cleans local stale rows for Syncfy status-false 200 response', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '572930c4784806060f8b456b',
    site_name: 'American Express',
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-10T02:48:14Z',
    updated_at: '2026-06-10T02:48:14Z',
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    status: false,
    rid: 'delete-rid-3',
    code: 200,
    message: 'Connection request failed',
    response: null,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/credential', {
      method: 'DELETE',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as SyncfyCredentialsApiResponse & DashboardResponse & {
      syncfyCredentialDeleteAttempted?: boolean
      syncfyCredentialDeleted?: boolean
    }

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.syncfyCredentialDeleteAttempted).toBe(true)
    expect(data.syncfyCredentialDeleted).toBe(false)
    expect(data.credentials).toEqual([])
    expect((await readSyncfyCredentials(env.DB))[0]?.deleted_at).toBeTruthy()
    expect((await readSyncfyErrors(env.DB))[0]).toMatchObject({
      rid: 'delete-rid-3',
      status_code: 200,
      source: 'syncfy-delete-credential',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy widget error without credential is logged without creating a local connection', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })

  const response = await worker.fetch(new Request('http://local.test/api/syncfy/credential', {
    method: 'POST',
    body: JSON.stringify({
      email: 'user@example.com',
      eventType: 'widget.error',
      payload: {
        rid: 'rid-widget-error',
        code: 402,
        message: 'Payment Required',
      },
    }),
  }), env)
  const data = await response.json() as {
    success?: boolean
    rid?: string
    credentials?: unknown[]
  }

  expect(response.status).toBe(409)
  expect(data.success).toBe(false)
  expect(data.rid).toBe('rid-widget-error')
  expect(data.credentials).toEqual([])
  expect(await readSyncfyCredentials(env.DB)).toEqual([])
  expect(await readSyncfyErrors(env.DB)).toHaveLength(1)
  expect((await readSyncfyErrors(env.DB))[0]).toMatchObject({
    email: 'user@example.com',
    rid: 'rid-widget-error',
    status_code: 402,
    error_code: '402',
    source: 'syncfy-widget-error',
  })
})

test('syncfy widget credential callback polls the existing job without starting a duplicate pull', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  const calls: Array<{ url: string; method: string }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, method: init?.method || 'GET' })

    if (url.includes('/jobs/widget-job-1/status')) {
      return new Response(JSON.stringify({
        status: true,
        response: {},
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('/transactions')) {
      return new Response(JSON.stringify({
        status: true,
        response: [],
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      status: false,
      message: 'Unexpected provider request',
      response: null,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/credential', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        eventType: 'widget.success',
        payload: {
          rid: 'widget-rid-1',
          id_user: 'syncfy-user-1',
          id_credential: 'credential-1',
          id_site: 'amex-site',
          institution_name: 'American Express',
          id_job: 'widget-job-1',
          is_executing: 1,
        },
      }),
    }), env)
    const data = await response.json() as SyncfyCredentialsApiResponse & {
      pendingTransactions?: boolean
    }

    expect(response.status).toBe(200)
    expect(data.pendingTransactions).toBe(true)
    expect(data.credentials[0]?.connectionState).toBe('verifying')
    expect(calls.some((call) => call.url.includes('/jobs/widget-job-1/status'))).toBe(true)
    expect(calls.some((call) => call.url.includes('/credentials/credential-1/pulls'))).toBe(false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy sandbox sessions enable Syncfy widget test mode', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
    SYNCFY_ENV: 'sandbox',
  })
  const calls: Array<{ url: string; body?: string }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: String(init?.body || '') })
    if (String(input).includes('/users')) {
      return new Response(JSON.stringify({
        status: true,
        response: { id_user: 'syncfy-user-1' },
      }), { headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({
      status: true,
      response: { token: 'widget-token-1' },
    }), { headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/session', {
      method: 'POST',
      body: JSON.stringify({
        email: 'sandbox-user@example.com',
        name: 'Sandbox User',
        mode: 'create',
      }),
    }), env)
    const data = await response.json() as {
      success?: boolean
      widgetEnabled?: boolean
      widgetEnableTestMode?: boolean
      token?: string
    }

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.widgetEnabled).toBe(true)
    expect(data.widgetEnableTestMode).toBe(true)
    expect(data.token).toBe('widget-token-1')
    expect(calls.map((call) => call.url)).toEqual([
      'https://sync.paybook.com/v1/users',
      'https://sync.paybook.com/v1/sessions',
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy production sessions do not enable Syncfy widget test mode', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
    SYNCFY_ENV: 'production',
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes('/users')) {
      return new Response(JSON.stringify({
        status: true,
        response: { id_user: 'syncfy-user-1' },
      }), { headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({
      status: true,
      response: { token: 'widget-token-1' },
    }), { headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/session', {
      method: 'POST',
      body: JSON.stringify({
        email: 'prod-user@example.com',
        name: 'Prod User',
        mode: 'create',
      }),
    }), env)
    const data = await response.json() as {
      success?: boolean
      widgetEnableTestMode?: boolean
    }

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.widgetEnableTestMode).toBe(false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh follows saved job status when direct transactions are still empty', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: null,
    site_name: null,
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: null,
    raw_json: JSON.stringify({
      id_job: 'job-1',
      id_credential: 'credential-1',
      status: 'https://sync.paybook.com/v1/jobs/job-1/status',
    }),
    created_at: '2026-06-07T03:11:19Z',
    updated_at: '2026-06-07T03:11:19Z',
  })
  const calls: string[] = []
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)

    if (url.includes('/jobs/job-1/status')) {
      return new Response(JSON.stringify({
        response: {
          endpoints: {
            transactions: ['/transactions?from_job=1&id_credential=credential-1&limit=500&skip=0'],
          },
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('from_job=1')) {
      return new Response(JSON.stringify({
        response: {
          transactions: [{
            id_transaction: 'txn-from-job',
            dt_transaction: 1772150400,
            description: 'Uber',
            amount: '251.81',
            currency: 'MXN',
            type: 'debit',
          }],
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('/transactions')) {
      return new Response(JSON.stringify({
        status: false,
        code: 401,
        message: 'Invalid user',
        response: null,
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ response: {} }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as DashboardResponse & { syncfy?: { imported: number; endpoints: string[] } }

    expect(response.status).toBe(200)
    expect(data.syncfy?.imported).toBe(1)
    expect(data.transactions).toHaveLength(1)
    expect(calls.some((url) => url.includes('/jobs/job-1/status') && url.includes('id_user=syncfy-user-1'))).toBe(true)
    expect(calls.find((url) => url.includes('from_job=1'))).not.toContain('id_user=')
    expect(data.syncfy?.endpoints).toContain('/jobs/job-1/status?id_user=syncfy-user-1')
    expect((await readSyncfyCredentials(env.DB))[0].status).toBe('synced')
    expect((await readSyncfyCredentials(env.DB))[0].last_successful_sync_at).toBeTruthy()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh waitUntil failure applies a lifecycle event', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '56cf5728784806f72b8b4568',
    site_name: 'Acme Bank',
    status: 'pending_transactions',
    state: 'pending',
    last_successful_sync_at: null,
    last_pull_at: new Date().toISOString(),
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-07T03:11:19Z',
    updated_at: '2026-06-07T03:11:19Z',
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/credentials?') || (url.includes('/credentials') && !url.includes('/pulls') && !url.includes('/transactions'))) {
      return new Response(JSON.stringify({
        status: true,
        response: [{ id_credential: 'credential-1', is_authorized: 1 }],
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      status: false,
      code: 401,
      message: 'login rejected',
      response: null,
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  const waitUntilPromises: Promise<unknown>[] = []
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      waitUntilPromises.push(promise)
    },
  } as unknown as ExecutionContext

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env, ctx)
    expect(response.status).toBe(202)
    expect(waitUntilPromises).toHaveLength(1)
    await waitUntilPromises[0]

    const row = (await readSyncfyCredentials(env.DB))[0]
    expect(row.state).toBe('needs_user')
    expect(row.status).toBe('needs_reconnect')
    const errors = await readSyncfyErrors(env.DB)
    expect(errors).toHaveLength(2)
    expect(errors.find((error) => error.source === 'syncfy-credential-state')).toMatchObject({
      email: 'user@example.com',
      syncfy_credential_id: 'credential-1',
      status_code: 401,
      error_code: '401',
      source: 'syncfy-credential-state',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy pending refresh polls job status during pull cooldown without starting another pull', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '56cf5728784806f72b8b4568',
    site_name: 'Acme Bank',
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: new Date().toISOString(),
    last_rid: null,
    raw_json: JSON.stringify({
      id_job: 'job-during-cooldown',
      id_credential: 'credential-1',
      status: 'https://sync.paybook.com/v1/jobs/job-during-cooldown/status',
    }),
    created_at: '2026-06-07T03:11:19Z',
    updated_at: '2026-06-07T03:11:19Z',
  })

  const calls: Array<{ url: string; method: string }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || 'GET'
    calls.push({ url, method })

    if (url.includes('/credentials/credential-1/pulls')) {
      return new Response(JSON.stringify({
        status: false,
        code: 429,
        message: 'Pull should not be called during cooldown polling',
        response: null,
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.includes('/jobs/job-during-cooldown/status')) {
      return new Response(JSON.stringify({
        response: {
          endpoints: {
            transactions: ['/transactions?from_cooldown_job=1&id_credential=credential-1&limit=500&skip=0'],
          },
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('from_cooldown_job=1')) {
      return new Response(JSON.stringify({
        response: {
          transactions: [{
            id_transaction: 'txn-from-cooldown-job',
            dt_transaction: 1772150400,
            description: 'ACME Grocery',
            amount: '512.45',
            currency: 'MXN',
            type: 'debit',
          }],
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('/transactions')) {
      return new Response(JSON.stringify({ response: { transactions: [] } }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ response: {} }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as DashboardResponse & { syncfy?: { imported: number; endpoints: string[] } }

    expect(response.status).toBe(200)
    expect(data.syncfy?.imported).toBe(1)
    expect(data.transactions).toHaveLength(1)
    expect(calls.some((call) => call.url.includes('/credentials/credential-1/pulls'))).toBe(false)
    expect(calls.some((call) => call.url.includes('/jobs/job-during-cooldown/status'))).toBe(true)
    expect((await readSyncfyCredentials(env.DB))[0].status).toBe('synced')
    expect((await readSyncfyCredentials(env.DB))[0].last_successful_sync_at).toBeTruthy()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy synced refresh still respects provider pull cooldown', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '56cf5728784806f72b8b4568',
    site_name: 'Acme Bank',
    status: 'synced',
    last_successful_sync_at: new Date().toISOString(),
    last_pull_at: new Date().toISOString(),
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-07T03:11:19Z',
    updated_at: '2026-06-07T03:11:19Z',
  })

  const originalFetch = globalThis.fetch
  let externalFetches = 0
  globalThis.fetch = (async () => {
    externalFetches += 1
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as { retryAfterSeconds?: number; error?: string }

    expect(response.status).toBe(429)
    expect(data.retryAfterSeconds).toBeGreaterThan(25 * 60)
    expect(data.error).toContain('30 minutos')
    expect(externalFetches).toBe(0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh starts credential pull and imports transactions from returned job', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: null,
    site_name: null,
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-07T03:11:19Z',
    updated_at: '2026-06-07T03:11:19Z',
  })
  const calls: Array<{ url: string; method: string }> = []
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || 'GET'
    calls.push({ url, method })

    if (url.includes('/credentials/credential-1/pulls')) {
      return new Response(JSON.stringify({
        response: {
          id_job: 'job-from-pull',
          status: '/v1/jobs/job-from-pull/status',
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('/jobs/job-from-pull/status')) {
      return new Response(JSON.stringify({
        response: {
          endpoints: {
            transactions: ['/transactions?from_pull_job=1&id_credential=credential-1&limit=500&skip=0'],
          },
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('from_pull_job=1')) {
      return new Response(JSON.stringify({
        response: {
          transactions: [{
            id_transaction: 'txn-from-pull-job',
            id_credential: 'credential-1',
            id_user: 'syncfy-user-1',
            dt_transaction: 1772150400,
            description: 'AMEX PAYMENT',
            amount: '-1100.50',
            currency: 'MXN',
          }],
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('/transactions')) {
      return new Response(JSON.stringify({ response: { transactions: [] } }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ response: {} }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as DashboardResponse & { syncfy?: { imported: number; endpoints: string[] } }

    expect(response.status).toBe(200)
    expect(data.syncfy?.imported).toBe(1)
    expect(data.transactions).toHaveLength(1)
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: expect.stringContaining('/credentials/credential-1/pulls?id_user=syncfy-user-1'),
        method: 'PUT',
      }),
      expect.objectContaining({
        url: expect.stringContaining('/jobs/job-from-pull/status?id_user=syncfy-user-1'),
        method: 'GET',
      }),
    ]))
    expect(data.syncfy?.endpoints).toContain('/credentials/credential-1/pulls?id_user=syncfy-user-1')
    expect((await readSyncfyCredentials(env.DB))[0].status).toBe('synced')
    expect((await readSyncfyCredentials(env.DB))[0].state).toBe('healthy')
    expect((await readSyncfyCredentials(env.DB))[0].last_successful_sync_at).toBeTruthy()
    expect(String((await readSyncfyCredentials(env.DB))[0].raw_json)).toContain('job-from-pull')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh imports direct transactions when a new pull is rate-limited', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: null,
    site_name: null,
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-07T03:11:19Z',
    updated_at: '2026-06-07T03:11:19Z',
  })
  const calls: Array<{ url: string; method: string }> = []
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || 'GET'
    calls.push({ url, method })

    if (url.includes('/credentials/credential-1/pulls')) {
      return new Response(JSON.stringify({
        status: false,
        code: 429,
        rid: 'pull-rate-limit-rid',
        message: 'Too many pull requests',
        response: null,
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.includes('/transactions')) {
      return new Response(JSON.stringify({
        response: {
          transactions: [{
            id_transaction: 'txn-readable-after-rate-limit',
            id_credential: 'credential-1',
            id_user: 'syncfy-user-1',
            dt_transaction: 1772150400,
            description: 'ACME SUPERMERCADO',
            amount: '-450.25',
            currency: 'MXN',
          }],
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ response: {} }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as DashboardResponse & { syncfy?: { imported: number; endpoints: string[] } }

    expect(response.status).toBe(200)
    expect(data.syncfy?.imported).toBe(1)
    expect(data.transactions).toHaveLength(1)
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: expect.stringContaining('/credentials/credential-1/pulls?id_user=syncfy-user-1'),
        method: 'PUT',
      }),
      expect.objectContaining({
        url: expect.stringContaining('/transactions?'),
        method: 'GET',
      }),
    ]))
    expect((await readSyncfyErrors(env.DB))[0]).toMatchObject({
      rid: 'pull-rate-limit-rid',
      status_code: 429,
      source: 'syncfy-pull',
    })
    expect((await readSyncfyCredentials(env.DB))[0].status).toBe('synced')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh recovers stale needs_reconnect when transactions are readable', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '572930c4784806060f8b456b',
    site_name: 'American Express',
    status: 'needs_reconnect',
    last_successful_sync_at: '2026-06-08T01:01:54Z',
    last_pull_at: null,
    last_rid: 'stale-rid',
    raw_json: null,
    created_at: '2026-06-02T03:09:33Z',
    updated_at: '2026-06-10T03:25:53Z',
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    response: {
      transactions: [{
        id_transaction: 'txn-readable-after-reconnect-error',
        id_credential: 'credential-1',
        id_user: 'syncfy-user-1',
        dt_transaction: 1772150400,
        description: 'AMEX SUPERMERCADO',
        amount: '-251.81',
        currency: 'MXN',
      }],
    },
  }), { headers: { 'Content-Type': 'application/json' } })) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as DashboardResponse & { pendingTransactions?: boolean }

    expect(response.status).toBe(200)
    expect(data.pendingTransactions).toBe(false)
    expect(data.transactions).toHaveLength(1)
    expect((await readSyncfyCredentials(env.DB))[0].status).toBe('synced')
    expect((await readSyncfyCredentials(env.DB))[0].last_successful_sync_at).toBeTruthy()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh logs a credential health 2FA rejection', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    site_name: 'BBVA México',
    status: 'pending_transactions',
    state: 'pending',
    created_at: '2026-08-31T16:00:00Z',
    updated_at: '2026-08-31T16:00:00Z',
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    status: true,
    response: [{
      id_credential: 'credential-1',
      code: 401,
      is_authorized: false,
      is_twofa: true,
    }],
  }), { headers: { 'Content-Type': 'application/json' } })) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)

    expect(response.status).toBe(409)
    expect((await response.json()).needsReconnect).toBe(true)
    expect(await readSyncfyErrors(env.DB)).toHaveLength(1)
    expect((await readSyncfyErrors(env.DB))[0]).toMatchObject({
      email: 'user@example.com',
      syncfy_credential_id: 'credential-1',
      status_code: 401,
      error_code: '401',
      message: 'Syncfy credential requires user 2FA; waiting for reconnect.',
      source: 'syncfy-credential-state',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh allows support admin to recover a production credential without browser session', async () => {
  const env = createEnv('production', {
    SUPPORT_ADMIN_SECRET: 'admin-secret',
    SYNCFY_API_KEY: 'test-key',
  })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '572930c4784806060f8b456b',
    site_name: 'American Express',
    status: 'needs_reconnect',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: 'stale-rid',
    raw_json: null,
    created_at: '2026-06-02T03:09:33Z',
    updated_at: '2026-06-10T03:25:53Z',
  })

  const blocked = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
    method: 'POST',
    body: JSON.stringify({
      email: 'user@example.com',
      credentialId: 'credential-1',
    }),
  }), env)
  expect(blocked.status).toBe(401)

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    response: {
      transactions: [{
        id_transaction: 'txn-readable-with-support-admin',
        id_credential: 'credential-1',
        id_user: 'syncfy-user-1',
        dt_transaction: 1772150400,
        description: 'AMEX GASOLINA',
        amount: '-801.35',
        currency: 'MXN',
      }],
    },
  }), { headers: { 'Content-Type': 'application/json' } })) as typeof fetch

  try {
    const allowed = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      headers: { 'x-finovai-admin-secret': 'admin-secret' },
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await allowed.json() as DashboardResponse & { pendingTransactions?: boolean }

    expect(allowed.status).toBe(200)
    expect(data.pendingTransactions).toBe(false)
    expect(data.transactions).toHaveLength(1)
    expect((await readSyncfyCredentials(env.DB))[0].status).toBe('synced')
    expect((await readSyncfyCredentials(env.DB))[0].last_successful_sync_at).toBeTruthy()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh records pending pull attempts when Syncfy returns no transactions', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '572930c4784806060f8b456b',
    site_name: 'American Express',
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: 'rid-1',
    raw_json: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    response: { transactions: [] },
  }), {
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as DashboardResponse & {
      pendingTransactions?: boolean
      message?: string
    }

    expect(response.status).toBe(202)
    expect(data.pendingTransactions).toBe(true)
    expect(data.message).toContain('movimientos todavía se están preparando')
    expect((await readSyncfyCredentials(env.DB))[0].status).toBe('pending_transactions')
    expect((await readSyncfyCredentials(env.DB))[0].state).toBe('pending')
    expect((await readSyncfyCredentials(env.DB))[0].last_pull_at).toBeTruthy()
    expect((await readSyncfyCredentials(env.DB))[0].last_successful_sync_at).toBeNull()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh treats webhook-imported transactions as complete when polling is empty', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '56cf5728784806f72b8b4568',
    site_name: 'Acme Bank',
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-07T03:11:19Z',
    updated_at: '2026-06-07T03:11:19Z',
  })
  await seedTransactions(env.DB, {
    ...sampleTransaction({
      id: 'syncfy:txn-from-webhook',
      email: 'user@example.com',
      source: 'syncfy',
      description: 'ACME Checking Expense Transaction',
      merchant: 'ACME Checking Expense Transaction',
    }),
    raw_source: JSON.stringify({ _finovaiCredentialId: 'credential-1' }),
  })

  let upstreamCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    upstreamCalls += 1
    throw new Error('Syncfy upstream should not be called when credential transactions are already stored.')
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/refresh', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        credentialId: 'credential-1',
      }),
    }), env)
    const data = await response.json() as DashboardResponse & {
      pendingTransactions?: boolean
      message?: string
    }

    expect(response.status).toBe(200)
    expect(data.pendingTransactions).toBe(false)
    expect(data.message).toBe('1 movimientos sincronizados.')
    expect((await readSyncfyCredentials(env.DB))[0].status).toBe('synced')
    expect((await readSyncfyCredentials(env.DB))[0].last_successful_sync_at).toBeTruthy()
    expect(upstreamCalls).toBe(0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy webhook helpers read nested Syncfy event envelopes', () => {
  const payload = {
    rid: 'request-1',
    events: [{
      header: {
        event: {
          name: 'credentials.refreshed',
        },
        user: {
          id_user: 'syncfy-user-1',
        },
      },
      payload: {
        event: 'refresh',
        id_credential: 'credential-1',
        id_user: 'syncfy-user-1',
        id_site: '56cf5728784806f72b8b4568',
        id_site_organization: '56cf4ff5784806152c8b4567',
        endpoints: {
          transactions: [
            '/v1/transactions?id_credential=credential-1&limit=5000&skip=0&wbhk=1',
          ],
        },
      },
    }],
  }

  expect(extractSyncfyEventType(payload)).toBe('credentials.refreshed')
  expect(getSyncfyWebhookEndpointPaths(payload, 'transactions')).toEqual([
    '/v1/transactions?id_credential=credential-1&limit=5000&skip=0&wbhk=1',
  ])
  expect(extractSyncfySiteMetadata(payload).siteName).toBe('Acme Bank')
})

test('syncfy webhook acknowledges before importing transactions in the background', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
    SYNCFY_WEBHOOK_SECRET: 'webhook-secret',
  })
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: null,
    mode: 'live',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: null,
    last_session_at: null,
  })
  const payload = {
    rid: 'request-1',
    events: [{
      header: {
        event: { name: 'credentials.refreshed' },
        user: { id_user: 'syncfy-user-1' },
      },
      payload: {
        status: 'SUCCESS',
        id_credential: 'credential-1',
        id_user: 'syncfy-user-1',
        id_site: '56cf5728784806f72b8b4568',
        endpoints: {
          transactions: ['/v1/transactions?id_credential=credential-1&limit=5000&skip=0&wbhk=1'],
        },
      },
    }],
  }
  const waitUntilPromises: Promise<unknown>[] = []
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      waitUntilPromises.push(promise)
    },
  } as unknown as ExecutionContext
  let releaseTransactions!: () => void
  const transactionsResponse = new Promise<Response>((resolve) => {
    releaseTransactions = () => resolve(new Response(JSON.stringify({
      response: {
        transactions: [{
          id_transaction: 'txn-from-webhook',
          id_credential: 'credential-1',
          id_user: 'syncfy-user-1',
          dt_transaction: 1772150400,
          description: 'ACME Checking Expense Transaction',
          amount: -251.81,
          currency: 'MXN',
        }],
      },
    }), { headers: { 'Content-Type': 'application/json' } }))
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/transactions')) return transactionsResponse

    return new Response(JSON.stringify({ response: {} }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-finovai-webhook-secret': 'webhook-secret',
      },
      body: JSON.stringify(payload),
    }), env, ctx)
    const data = await response.json() as { processingQueued?: boolean }

    expect(response.status).toBe(202)
    expect(data.processingQueued).toBe(true)
    expect(waitUntilPromises).toHaveLength(1)
    expect(await readSyncfyWebhookEvents(env.DB)).toHaveLength(1)
    expect((await readSyncfyWebhookEvents(env.DB))[0].processed_at).toBeNull()
    expect(await readTransactions(env.DB)).toHaveLength(0)

    releaseTransactions()
    await waitUntilPromises[0]

    expect((await readSyncfyWebhookEvents(env.DB))[0].processed_at).toBeTruthy()
    expect(await readTransactions(env.DB)).toHaveLength(1)
    expect((await readSyncfyCredentials(env.DB))[0].status).toBe('synced')
    expect((await readSyncfyCredentials(env.DB))[0].state).toBe('healthy')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('webhook-triggered refresh never starts a pull', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
    SYNCFY_WEBHOOK_SECRET: 'webhook-secret',
  })
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: null,
    mode: 'live',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: null,
    last_session_at: null,
  })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '56cf5728784806f72b8b4568',
    site_name: 'Acme Bank',
    status: 'synced',
    state: 'healthy',
    last_successful_sync_at: '2026-06-01T00:00:00Z',
    last_pull_at: '2026-06-01T00:00:00Z',
    last_pull_attempt_at: '2026-06-01T00:00:00Z',
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  })

  const payload = {
    rid: 'webhook-no-pull-rid',
    events: [{
      header: {
        event: { name: 'credentials.refreshed' },
        user: { id_user: 'syncfy-user-1' },
      },
      payload: {
        status: 'SUCCESS',
        id_credential: 'credential-1',
        id_user: 'syncfy-user-1',
        id_site: '56cf5728784806f72b8b4568',
        endpoints: {
          transactions: ['/v1/transactions?id_credential=credential-1&limit=5000&skip=0&wbhk=1'],
        },
      },
    }],
  }

  const waitUntilPromises: Promise<unknown>[] = []
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      waitUntilPromises.push(promise)
    },
  } as unknown as ExecutionContext

  const calls: Array<{ url: string; method: string }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || 'GET'
    calls.push({ url, method })

    if (url.includes('/transactions')) {
      return new Response(JSON.stringify({
        response: {
          transactions: [{
            id_transaction: 'txn-from-webhook-no-pull',
            id_credential: 'credential-1',
            id_user: 'syncfy-user-1',
            dt_transaction: 1772150400,
            description: 'Webhook Expense',
            amount: -150.0,
            currency: 'MXN',
          }],
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ response: [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-finovai-webhook-secret': 'webhook-secret',
      },
      body: JSON.stringify(payload),
    }), env, ctx)

    expect(response.status).toBe(202)
    expect(waitUntilPromises).toHaveLength(1)

    await waitUntilPromises[0]

    expect(calls.some((call) => call.url.includes('/pulls') || call.method === 'PUT')).toBe(false)
    expect(await readTransactions(env.DB)).toHaveLength(1)
    expect((await readSyncfyWebhookEvents(env.DB))[0].processed_at).toBeTruthy()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy deleted webhook removes local credential instead of recreating it', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
    SYNCFY_WEBHOOK_SECRET: 'webhook-secret',
  })
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: null,
    mode: 'live',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: null,
    last_session_at: null,
  })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '572930c4784806060f8b456b',
    site_name: 'American Express',
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-10T02:48:14Z',
    updated_at: '2026-06-10T02:48:14Z',
  })
  await seedTransactions(env.DB, {
    ...sampleTransaction({
      id: 'syncfy:credential-1:expense',
      email: 'user@example.com',
      source: 'syncfy',
      description: 'AMEX EXPENSE',
      merchant: 'AMEX EXPENSE',
    }),
    raw_source: JSON.stringify({ _finovaiCredentialId: 'credential-1' }),
  })

  const payload = {
    rid: 'delete-webhook-rid-1',
    events: [{
      header: {
        event: { name: 'credentials.deleted' },
        user: { id_user: 'syncfy-user-1' },
      },
      payload: {
        id_credential: 'credential-1',
      },
    }],
  }
  const waitUntilPromises: Promise<unknown>[] = []
  const credentialsWhenDeferred: SeedRow[][] = []
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      // Captured synchronously at the moment the handler hands work to waitUntil, which is the
      // deterministic proof that the deletion is deferred rather than done inline before the ack.
      // (Reading after `await response.json()` is not: awaiting yields the microtask queue to the
      // background task, so what it observes depends on the promise plumbing, not on behaviour.)
      credentialsWhenDeferred.push(readTableSync(env.DB, 'syncfy_credentials'))
      waitUntilPromises.push(promise)
    },
  } as unknown as ExecutionContext

  const response = await worker.fetch(new Request('http://local.test/api/syncfy/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-finovai-webhook-secret': 'webhook-secret',
    },
    body: JSON.stringify(payload),
  }), env, ctx)
  const data = await response.json() as {
    credentialStored?: boolean
    eventType?: string
  }

  expect(response.status).toBe(202)
  expect(data.eventType).toBe('credentials.deleted')
  expect(data.credentialStored).toBe(false)
  expect(waitUntilPromises).toHaveLength(1)
  expect(credentialsWhenDeferred[0]).toHaveLength(1)

  await waitUntilPromises[0]

  const remaining = await readSyncfyCredentials(env.DB)
  expect(remaining).toHaveLength(1)
  expect(remaining[0].deleted_at).toBeTruthy()
  expect(await readTransactions(env.DB)).toEqual([])
  expect((await readSyncfyWebhookEvents(env.DB))[0].processed_at).toBeTruthy()
})

test('syncfy webhook does not undelete a user-soft-deleted credential', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
    SYNCFY_WEBHOOK_SECRET: 'webhook-secret',
  })
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: null,
    mode: 'live',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: null,
    last_session_at: null,
  })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    site_name: 'BBVA México',
    status: 'synced',
    state: 'healthy',
    last_successful_sync_at: '2026-08-01T00:00:00Z',
    last_pull_at: '2026-08-01T00:00:00Z',
    last_rid: null,
    raw_json: null,
    created_at: '2026-06-02T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  })
  await env.DB.prepare(`UPDATE syncfy_credentials SET deleted_at = datetime('now') WHERE syncfy_credential_id = ?`)
    .bind('credential-1')
    .run()

  let vendorCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    vendorCalls += 1
    return new Response(JSON.stringify({ response: {} }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  const waitUntilPromises: Promise<unknown>[] = []
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      waitUntilPromises.push(promise)
    },
  } as unknown as ExecutionContext

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-finovai-webhook-secret': 'webhook-secret',
      },
      body: JSON.stringify({
        rid: 'resurrect-rid',
        events: [{
          header: {
            event: { name: 'credentials.refreshed' },
            user: { id_user: 'syncfy-user-1' },
          },
          payload: {
            status: 'SUCCESS',
            id_credential: 'credential-1',
            id_user: 'syncfy-user-1',
          },
        }],
      }),
    }), env, ctx)

    expect(response.status).toBe(202)
    if (waitUntilPromises[0]) await waitUntilPromises[0]

    const row = (await readSyncfyCredentials(env.DB))[0]
    expect(row.deleted_at).toBeTruthy()
    expect(row.state).toBe('healthy')
    expect(vendorCalls).toBe(0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy webhook does not poll needs_user or abandoned credentials', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
    SYNCFY_WEBHOOK_SECRET: 'webhook-secret',
  })
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: null,
    mode: 'live',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: null,
    last_session_at: null,
  })
  await seedSyncfyCredentials(env.DB,
    {
      id: 'credential-row-nu',
      email: 'user@example.com',
      syncfy_user_id: 'syncfy-user-1',
      syncfy_credential_id: 'cred-needs-user',
      site_name: 'BBVA México',
      status: 'needs_reconnect',
      state: 'needs_user',
      last_successful_sync_at: null,
      last_pull_at: null,
      last_rid: null,
      raw_json: null,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
    {
      id: 'credential-row-ab',
      email: 'user@example.com',
      syncfy_user_id: 'syncfy-user-1',
      syncfy_credential_id: 'cred-abandoned',
      site_name: 'American Express',
      status: 'sync_error',
      state: 'abandoned',
      last_successful_sync_at: null,
      last_pull_at: null,
      last_rid: null,
      raw_json: null,
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    }
  )

  let vendorCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    vendorCalls += 1
    return new Response(JSON.stringify({ response: {} }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  const waitUntilPromises: Promise<unknown>[] = []
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      waitUntilPromises.push(promise)
    },
  } as unknown as ExecutionContext

  try {
    for (const credentialId of ['cred-needs-user', 'cred-abandoned']) {
      const response = await worker.fetch(new Request('http://local.test/api/syncfy/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-finovai-webhook-secret': 'webhook-secret',
        },
        body: JSON.stringify({
          events: [{
            header: {
              event: { name: 'credentials.refreshed' },
              user: { id_user: 'syncfy-user-1' },
            },
            payload: {
              status: 'SUCCESS',
              id_credential: credentialId,
              id_user: 'syncfy-user-1',
            },
          }],
        }),
      }), env, ctx)
      expect(response.status).toBe(202)
    }
    await Promise.all(waitUntilPromises)

    expect(vendorCalls).toBe(0)
    const rows = await readSyncfyCredentials(env.DB)
    expect(rows.find((row) => row.syncfy_credential_id === 'cred-needs-user')?.state).toBe('needs_user')
    expect(rows.find((row) => row.syncfy_credential_id === 'cred-abandoned')?.state).toBe('abandoned')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy SUCCESS webhook does not rewrite parked credential lifecycle fields', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
    SYNCFY_WEBHOOK_SECRET: 'webhook-secret',
  })
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: null,
    mode: 'live',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: null,
    last_session_at: null,
  })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-parked',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'cred-parked',
    site_name: 'BBVA México',
    status: 'needs_reconnect',
    state: 'needs_user',
    last_successful_sync_at: '2026-07-01T00:00:00Z',
    last_pull_at: '2026-07-01T00:00:00Z',
    last_rid: 'parked-rid',
    raw_json: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ response: {} }), {
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch

  const waitUntilPromises: Promise<unknown>[] = []
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      waitUntilPromises.push(promise)
    },
  } as unknown as ExecutionContext

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-finovai-webhook-secret': 'webhook-secret',
      },
      body: JSON.stringify({
        events: [{
          header: {
            event: { name: 'credentials.refreshed' },
            user: { id_user: 'syncfy-user-1' },
          },
          payload: {
            status: 'SUCCESS',
            id_credential: 'cred-parked',
            id_user: 'syncfy-user-1',
          },
        }],
      }),
    }), env, ctx)
    expect(response.status).toBe(202)
    if (waitUntilPromises[0]) await waitUntilPromises[0]

    const row = (await readSyncfyCredentials(env.DB))[0]
    expect(row.status).toBe('needs_reconnect')
    expect(row.state).toBe('needs_user')
    expect(row.last_successful_sync_at).toBe('2026-07-01T00:00:00Z')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy status probe is protected and returns sanitized upstream checks', async () => {
  const env = createEnv('production', {
    SUPPORT_ADMIN_SECRET: 'admin-secret',
    SYNCFY_API_KEY: 'test-key',
  })
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: 'User',
    mode: 'live',
    created_at: '2026-06-10T02:49:34Z',
    updated_at: null,
    last_session_at: null,
  })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '572930c4784806060f8b456b',
    site_name: 'American Express',
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: 'rid-1',
    raw_json: JSON.stringify({ id_job: 'job-1' }),
    created_at: '2026-06-10T02:49:34Z',
    updated_at: '2026-06-10T02:49:34Z',
  })

  const blocked = await worker.fetch(new Request(
    'http://local.test/api/syncfy/status?email=user@example.com&probe=1'
  ), env)
  expect(blocked.status).toBe(404)

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/jobs/job-1/status')) {
      return new Response(JSON.stringify({
        status: true,
        rid: 'job-rid',
        response: {
          is_executing: 0,
          endpoints: { credential: ['/credentials/credential-1'] },
        },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.includes('/transactions')) {
      return new Response(JSON.stringify({
        status: true,
        rid: 'transactions-rid',
        response: { transactions: [] },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      status: true,
      rid: 'credential-rid',
      response: { id_credential: 'credential-1', status: 'active' },
    }), { headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const allowed = await worker.fetch(new Request(
      'http://local.test/api/syncfy/status?email=user@example.com&probe=1',
      { headers: { 'x-finovai-admin-secret': 'admin-secret' } }
    ), env)
    const data = await allowed.json() as {
      probes?: Array<{ target: string; ok: boolean; response?: Record<string, unknown> }>
    }

    expect(allowed.status).toBe(200)
    expect(data.probes?.map((probe) => probe.target)).toEqual(['credential', 'job_status', 'transactions'])
    expect(data.probes?.every((probe) => probe.ok)).toBe(true)
    expect(data.probes?.find((probe) => probe.target === 'transactions')?.response)
      .toMatchObject({ type: 'object', transactionsCount: 0 })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy reset allows support admin to recreate a stale user without browser session', async () => {
  const env = createEnv('production', {
    SUPPORT_ADMIN_SECRET: 'admin-secret',
    SYNCFY_API_KEY: 'test-key',
  })
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'stale-user',
    syncfy_external_id: 'finovai:user@example.com:reset:old',
    name: 'User',
    mode: 'live',
    created_at: '2026-06-10T02:49:34Z',
    updated_at: null,
    last_session_at: null,
  })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'stale-user',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '572930c4784806060f8b456b',
    site_name: 'American Express',
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: 'rid-1',
    raw_json: null,
    created_at: '2026-06-10T02:49:34Z',
    updated_at: '2026-06-10T02:49:34Z',
  })
  await seedTransactions(env.DB, 
    sampleTransaction({
      id: 'syncfy:credential-1:txn-1',
      email: 'user@example.com',
      source: 'syncfy',
      rawSource: '{"_finovaiCredentialId":"credential-1"}',
      description: 'American Express charge',
    }),
    sampleTransaction({
      id: 'syncfy:old-key:txn-2',
      email: 'user@example.com',
      source: 'syncfy',
      rawSource: '{"_finovaiCredentialId":"old-key-credential"}',
      description: 'Old key transaction',
    }),
    sampleTransaction({
      id: 'manual:rent',
      email: 'user@example.com',
      source: 'manual',
      description: 'Renta',
    })
  )

  const blocked = await worker.fetch(new Request('http://local.test/api/syncfy/reset', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com' }),
  }), env)
  expect(blocked.status).toBe(401)

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    status: true,
    response: { id_user: 'fresh-user' },
  }), {
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch

  try {
    const allowed = await worker.fetch(new Request('http://local.test/api/syncfy/reset', {
      method: 'POST',
      headers: { 'x-finovai-admin-secret': 'admin-secret' },
      body: JSON.stringify({ email: 'user@example.com', name: 'User' }),
    }), env)
    const data = await allowed.json() as {
      success?: boolean
      syncfyUserId?: string
      recreated?: boolean
      deletedTransactions?: number
      deletedCredentials?: number
      credentials?: unknown[]
    }

    expect(allowed.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.recreated).toBe(true)
    expect(data.syncfyUserId).toBe('fresh-user')
    expect(data.deletedTransactions).toBe(2)
    expect(data.deletedCredentials).toBe(1)
    expect(data.credentials).toEqual([])
    expect(await readSyncfyCredentials(env.DB)).toEqual([])
    expect((await readTransactions(env.DB)).map((item) => item.id)).toEqual(['manual:rent'])
    expect((await readSyncfyUsers(env.DB)).find((item) => item.email === 'user@example.com')?.syncfy_user_id)
      .toBe('fresh-user')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy session stale-user recovery clears old local syncfy state', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
  })
  await seedSyncfyUsers(env.DB, {
    email: 'user@example.com',
    syncfy_user_id: 'stale-user',
    syncfy_external_id: 'finovai:user@example.com',
    name: 'User',
    mode: 'live',
    created_at: '2026-06-10T02:49:34Z',
    updated_at: null,
    last_session_at: null,
  })
  await seedSyncfyCredentials(env.DB, {
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'stale-user',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: '572930c4784806060f8b456b',
    site_name: 'American Express',
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: null,
    last_rid: 'rid-1',
    raw_json: null,
    created_at: '2026-06-10T02:49:34Z',
    updated_at: '2026-06-10T02:49:34Z',
  })
  await seedTransactions(env.DB, 
    sampleTransaction({
      id: 'syncfy:credential-1:txn-1',
      email: 'user@example.com',
      source: 'syncfy',
      rawSource: '{"_finovaiCredentialId":"credential-1"}',
    }),
    sampleTransaction({
      id: 'manual:rent',
      email: 'user@example.com',
      source: 'manual',
      description: 'Renta',
    })
  )

  let sessionAttempts = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/sessions')) {
      sessionAttempts += 1
      if (sessionAttempts === 1) {
        return new Response(JSON.stringify({
          rid: 'stale-rid',
          status: false,
          code: 401,
          message: 'Invalid user',
          response: null,
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        status: true,
        response: { token: 'fresh-token' },
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      status: true,
      response: { id_user: 'fresh-user' },
    }), { headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const response = await worker.fetch(new Request('http://local.test/api/syncfy/session', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        name: 'User',
        mode: 'create',
      }),
    }), env)
    const data = await response.json() as {
      success?: boolean
      syncfyUserId?: string
      token?: string
    }

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.syncfyUserId).toBe('fresh-user')
    expect(data.token).toBe('fresh-token')
    expect(sessionAttempts).toBe(2)
    expect(await readSyncfyCredentials(env.DB)).toEqual([])
    expect((await readTransactions(env.DB)).map((item) => item.id)).toEqual(['manual:rent'])
    expect((await readSyncfyErrors(env.DB))[0]).toMatchObject({
      rid: 'stale-rid',
      source: 'syncfy-session-stale-user',
      syncfy_user_id: 'stale-user',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('transaction category endpoint persists user category overrides', async () => {
  const env = createEnv()
  const createdResponse = await worker.fetch(new Request('http://local.test/api/transactions/manual', {
    method: 'POST',
    body: JSON.stringify({
      email: 'user@example.com',
      date: '2026-05-20',
      type: 'expense',
      amount: 4500,
      currency: 'MXN',
      category: 'Comida fuera',
      description: 'DLO*UBER EATS',
      merchant: 'Uber Eats',
    }),
  }), env)
  const created = await createdResponse.json() as DashboardResponse & { transaction: FinanceTransaction }

  const response = await worker.fetch(new Request('http://local.test/api/transactions/category', {
    method: 'PATCH',
    body: JSON.stringify({
      email: 'user@example.com',
      transactionId: created.transaction.id,
      category: 'Otro',
    }),
  }), env)
  const data = await response.json() as DashboardResponse & { transaction: FinanceTransaction }

  expect(response.status).toBe(200)
  expect(data.transaction.category).toBe('Otro')
  expect(data.transactions.find((transaction) => transaction.id === created.transaction.id)?.category).toBe('Otro')
  expect(data.summary.topSpendingCategory).toBe('Otro')
})

test('transaction category endpoint applies the category to matching unlocked merchant transactions', async () => {
  const env = createEnv()
  const firstResponse = await worker.fetch(new Request('http://local.test/api/transactions/manual', {
    method: 'POST',
    body: JSON.stringify({
      email: 'user@example.com',
      date: '2026-05-20',
      type: 'expense',
      amount: 4500,
      currency: 'MXN',
      category: 'Comida fuera',
      description: 'DLO*UBER EATS',
      merchant: 'Uber Eats',
    }),
  }), env)
  const secondResponse = await worker.fetch(new Request('http://local.test/api/transactions/manual', {
    method: 'POST',
    body: JSON.stringify({
      email: 'user@example.com',
      date: '2026-05-21',
      type: 'expense',
      amount: 3200,
      currency: 'MXN',
      category: 'Comida fuera',
      description: 'DLO*UBER EATS',
      merchant: 'Uber Eats',
    }),
  }), env)
  const first = await firstResponse.json() as DashboardResponse & { transaction: FinanceTransaction }
  await secondResponse.json()

  const response = await worker.fetch(new Request('http://local.test/api/transactions/category', {
    method: 'PATCH',
    body: JSON.stringify({
      email: 'user@example.com',
      transactionId: first.transaction.id,
      category: 'Transporte',
    }),
  }), env)
  const data = await response.json() as DashboardResponse & { transaction: FinanceTransaction }

  expect(response.status).toBe(200)
  expect(data.transactions.filter((transaction) => transaction.merchant === 'Uber Eats')).toHaveLength(2)
  expect(data.transactions.filter((transaction) => transaction.merchant === 'Uber Eats').map((transaction) => transaction.category))
    .toEqual(['Transporte', 'Transporte'])
  expect(data.message).toContain('2 movimientos')
})

test('GET /api/health is admin-gated', async () => {
  const env = createEnv('production', {
    SUPPORT_ADMIN_SECRET: 'admin-secret',
    SYNCFY_ENV: 'sandbox',
  })

  const unauthenticated = await worker.fetch(new Request('http://local.test/api/health'), env)
  expect(unauthenticated.status).toBe(404)

  const wrongSecret = await worker.fetch(new Request('http://local.test/api/health', {
    headers: { 'x-finovai-admin-secret': 'wrong' },
  }), env)
  expect(wrongSecret.status).toBe(404)

  const allowed = await worker.fetch(new Request('http://local.test/api/health', {
    headers: { 'x-finovai-admin-secret': 'admin-secret' },
  }), env)
  const data = await allowed.json() as {
    transactionsLast24h?: number
    credentialsNoSuccess48h?: number
    enteredBrokenLast24h?: number
    unmappedVendorCodesLast24h?: number
    environment?: string
    syncfyEnvironment?: string
  }

  expect(allowed.status).toBe(200)
  expect(data).toMatchObject({
    transactionsLast24h: expect.any(Number),
    credentialsNoSuccess48h: expect.any(Number),
    enteredBrokenLast24h: expect.any(Number),
    unmappedVendorCodesLast24h: expect.any(Number),
    environment: 'production',
    syncfyEnvironment: 'sandbox',
  })
})

test('production dashboard APIs require the browser session secret', async () => {
  const env = createEnv('production')

  const signupResponse = await worker.fetch(new Request('http://local.test/api/signup', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com' }),
  }), env)
  expect(signupResponse.status).toBe(200)
  const signup = await signupResponse.json() as { clientSecret?: string }
  expect(signup.clientSecret).toBeTruthy()

  const blocked = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com'), env)
  expect(blocked.status).toBe(401)

  const wrongSecret = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com', {
    headers: { 'x-finovai-dashboard-secret': 'wrong' },
  }), env)
  expect(wrongSecret.status).toBe(401)

  const allowed = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com', {
    headers: { 'x-finovai-dashboard-secret': signup.clientSecret || '' },
  }), env)
  expect(allowed.status).toBe(200)
})

test('email auth sends a Cloudflare challenge before issuing dashboard session', async () => {
  const sentEmails: Array<{ to: string; subject: string; text: string }> = []
  const env = createEnv('production', {
    EMAIL_AUTH_REQUIRED: 'true',
    EMAIL: {
      send: async (message: { to: string; subject: string; text: string }) => {
        sentEmails.push(message)
        return { messageId: 'test-message' }
      },
    },
  })

  const signupResponse = await worker.fetch(new Request('http://local.test/api/signup', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com', source: 'test-auth' }),
  }), env)
  const signup = await signupResponse.json() as {
    verificationRequired?: boolean
    clientSecret?: string
  }

  expect(signupResponse.status).toBe(200)
  expect(signup.verificationRequired).toBe(true)
  expect(signup.clientSecret).toBeUndefined()
  expect(sentEmails).toHaveLength(1)

  const code = sentEmails[0].text.match(/\b\d{6}\b/)?.[0]
  expect(code).toBeTruthy()

  const blocked = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com'), env)
  expect(blocked.status).toBe(401)

  const verifiedResponse = await worker.fetch(new Request('http://local.test/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com', code }),
  }), env)
  const verified = await verifiedResponse.json() as { clientSecret?: string }

  expect(verifiedResponse.status).toBe(200)
  expect(verified.clientSecret).toBeTruthy()

  const allowed = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com', {
    headers: { 'x-finovai-dashboard-secret': verified.clientSecret || '' },
  }), env)
  expect(allowed.status).toBe(200)
})

test('household invite endpoint persists spouse email by financial profile', async () => {
  const env = createEnv()
  const response = await worker.fetch(new Request('http://local.test/api/household/invite', {
    method: 'POST',
    body: JSON.stringify({
      email: 'USER@Example.com',
      spouseEmail: 'SPOUSE@Example.com',
    }),
  }), env)

  expect(response.status).toBe(201)
  const invited = await response.json() as {
    email: string
    invite: { inviteeEmail: string; status: string }
    invites: Array<{ inviteeEmail: string }>
  }
  expect(invited.email).toBe('user@example.com')
  expect(invited.invite.inviteeEmail).toBe('spouse@example.com')
  expect(invited.invite.status).toBe('pending')

  const reload = await worker.fetch(new Request('http://local.test/api/household?email=user@example.com'), env)
  const household = await reload.json() as { invites: Array<{ inviteeEmail: string }> }
  expect(household.invites).toHaveLength(1)
  expect(household.invites[0].inviteeEmail).toBe('spouse@example.com')
})

test('household invite endpoint sends partner email when email binding is configured', async () => {
  const sentEmails: Array<{ to: string; subject: string; text: string; html?: string }> = []
  const env = createEnv('production', {
    APP_ORIGIN: 'https://finov.ai',
    EMAIL: {
      send: async (message: { to: string; subject: string; text: string; html?: string }) => {
        sentEmails.push(message)
        return { messageId: 'invite-message' }
      },
    },
  })

  const signupResponse = await worker.fetch(new Request('http://local.test/api/signup', {
    method: 'POST',
    body: JSON.stringify({ email: 'owner@example.com' }),
  }), env)
  const signup = await signupResponse.json() as { clientSecret?: string }
  expect(signup.clientSecret).toBeTruthy()

  const response = await worker.fetch(new Request('http://local.test/api/household/invite', {
    method: 'POST',
    headers: { 'x-finovai-dashboard-secret': signup.clientSecret || '' },
    body: JSON.stringify({
      email: 'OWNER@Example.com',
      spouseEmail: 'PARTNER@Example.com',
    }),
  }), env)

  expect(response.status).toBe(201)
  const invited = await response.json() as {
    emailSent?: boolean
    invite: { inviterEmail: string; inviteeEmail: string }
    message: string
  }
  expect(invited.emailSent).toBe(true)
  expect(invited.invite.inviterEmail).toBe('owner@example.com')
  expect(invited.invite.inviteeEmail).toBe('partner@example.com')
  expect(sentEmails).toHaveLength(1)
  expect(sentEmails[0].to).toBe('partner@example.com')
  expect(sentEmails[0].subject).toContain('FinovAI')
  expect(sentEmails[0].text).toContain('owner@example.com')
  expect(sentEmails[0].text).toContain('https://finov.ai/settings?')
  expect(sentEmails[0].text).toContain('household_invite=')
})

test('parseSyncfyCredentialHealth normalizes numeric and boolean provider flags', () => {
  expect(parseSyncfyCredentialHealth({ code: 401, is_authorized: 0, is_twofa: 0 })).toEqual({
    found: true,
    code: 401,
    isAuthorized: false,
    isTwofa: false,
  })
  expect(parseSyncfyCredentialHealth({ code: 200, is_authorized: true, is_twofa: true })).toEqual({
    found: true,
    code: 200,
    isAuthorized: true,
    isTwofa: true,
  })
  expect(parseSyncfyCredentialHealth({})).toEqual({
    found: true,
    code: null,
    isAuthorized: null,
    isTwofa: false,
  })
})

test('classifySyncfyCredentialBlocker flags rejected bank logins as needs_reconnect', () => {
  expect(classifySyncfyCredentialBlocker({ found: true, code: 401, isAuthorized: false, isTwofa: false }))
    .toBe('needs_reconnect')
  expect(classifySyncfyCredentialBlocker({ found: true, code: 405, isAuthorized: false, isTwofa: false }))
    .toBe('needs_reconnect')
  expect(classifySyncfyCredentialBlocker({ found: true, code: 410, isAuthorized: false, isTwofa: false }))
    .toBe('needs_reconnect')
})

test('classifySyncfyCredentialBlocker flags unauthorized 2FA credentials as needs_reconnect', () => {
  expect(classifySyncfyCredentialBlocker({ found: true, code: 501, isAuthorized: false, isTwofa: true }))
    .toBe('needs_reconnect')
})

test('classifySyncfyCredentialBlocker treats unauthorized provider failures as provider_pending', () => {
  expect(classifySyncfyCredentialBlocker({ found: true, code: 501, isAuthorized: false, isTwofa: false }))
    .toBe('provider_pending')
  expect(classifySyncfyCredentialBlocker({ found: true, code: 500, isAuthorized: false, isTwofa: false }))
    .toBe('provider_pending')
})

test('classifySyncfyCredentialBlocker does not block healthy or in-progress credentials', () => {
  expect(classifySyncfyCredentialBlocker({ found: true, code: 200, isAuthorized: true, isTwofa: false }))
    .toBe(null)
  // 102 = sync in progress; the institution has not accepted or rejected the login yet.
  expect(classifySyncfyCredentialBlocker({ found: true, code: 102, isAuthorized: false, isTwofa: false }))
    .toBe(null)
  expect(classifySyncfyCredentialBlocker({ found: false, code: null, isAuthorized: null, isTwofa: false }))
    .toBe(null)
  expect(classifySyncfyCredentialBlocker(null)).toBe(null)
})

test('isSyncfyProviderPullRetryDue backs off provider retries to 24 hours', () => {
  const now = Date.parse('2026-06-11T03:00:00Z')
  expect(isSyncfyProviderPullRetryDue(null, now)).toBe(true)
  expect(isSyncfyProviderPullRetryDue('not-a-date', now)).toBe(true)
  expect(isSyncfyProviderPullRetryDue('2026-06-11T02:50:00Z', now)).toBe(false)
  expect(isSyncfyProviderPullRetryDue('2026-06-10T03:01:00Z', now)).toBe(false)
  expect(isSyncfyProviderPullRetryDue('2026-06-10T02:59:00Z', now)).toBe(true)
})

test('isSyncfyBackgroundRefreshDue keeps scheduled refreshes daily', () => {
  const now = Date.parse('2026-06-11T03:00:00Z')
  expect(isSyncfyBackgroundRefreshDue(null, now)).toBe(true)
  expect(isSyncfyBackgroundRefreshDue('not-a-date', now)).toBe(true)
  expect(isSyncfyBackgroundRefreshDue('2026-06-11T02:50:00Z', now)).toBe(false)
  expect(isSyncfyBackgroundRefreshDue('2026-06-10T03:01:00Z', now)).toBe(false)
  expect(isSyncfyBackgroundRefreshDue('2026-06-10T02:59:00Z', now)).toBe(true)
})

test('getSyncfyCredentialBlockerMessage points users at the reconnect flow', () => {
  expect(getSyncfyCredentialBlockerMessage('needs_reconnect', { found: true, code: 401, isAuthorized: false, isTwofa: false }))
    .toContain('Actualizar acceso')
  expect(getSyncfyCredentialBlockerMessage('needs_reconnect', { found: true, code: 501, isAuthorized: false, isTwofa: true }))
    .toContain('código de seguridad')
  expect(getSyncfyCredentialBlockerMessage('provider_pending', null))
    .toContain('reintentando')
})

test('getSyncfyTransactionLookbackMonths defaults to 1 month and validates bounds', () => {
  expect(getSyncfyTransactionLookbackMonths({})).toBe(1)
  expect(getSyncfyTransactionLookbackMonths({ SYNCFY_TRANSACTION_LOOKBACK_MONTHS: '1' })).toBe(1)
  expect(getSyncfyTransactionLookbackMonths({ SYNCFY_TRANSACTION_LOOKBACK_MONTHS: '6' })).toBe(6)
  expect(getSyncfyTransactionLookbackMonths({ SYNCFY_TRANSACTION_LOOKBACK_MONTHS: '24' })).toBe(24)
  expect(getSyncfyTransactionLookbackMonths({ SYNCFY_TRANSACTION_LOOKBACK_MONTHS: '0' })).toBe(1)
  expect(getSyncfyTransactionLookbackMonths({ SYNCFY_TRANSACTION_LOOKBACK_MONTHS: '25' })).toBe(1)
  expect(getSyncfyTransactionLookbackMonths({ SYNCFY_TRANSACTION_LOOKBACK_MONTHS: 'invalid' })).toBe(1)
})

test('buildSyncfyTransactionWindow defaults to 1 month lookback', () => {
  const ref = new Date('2026-08-31T15:00:00Z')
  const defaultWindow = buildSyncfyTransactionWindow(ref)
  expect(defaultWindow.to).toBe(Math.floor(Date.parse('2026-08-31T15:00:00Z') / 1000))
  expect(defaultWindow.from).toBe(Math.floor(Date.parse('2026-07-31T00:00:00Z') / 1000))

  const customWindow = buildSyncfyTransactionWindow(ref, 3)
  expect(customWindow.from).toBe(Math.floor(Date.parse('2026-05-31T00:00:00Z') / 1000))
})
