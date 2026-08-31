import { expect, test } from 'bun:test'

import {
  DASHBOARD_CHAT_BENCHMARK_CASES,
  type DashboardBenchmarkStage,
} from './dashboard-chat-benchmark'

import worker from './index'
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
  classifySyncfyConnectionIssue,
  classifySyncfyCredentialBlocker,
  getSyncfyCredentialBlockerMessage,
  parseSyncfyCredentialHealth,
} from './lib/syncfy'
import {
  buildDashboardChatContext,
  classifyDashboardQuestionStage,
} from './routes/finance'

type BoundParams = Array<string | number | null>

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
    connectionState?: 'ready' | 'verifying' | 'action_required' | 'provider_unavailable' | 'support_required'
    connectionIssue?: {
      kind: 'action_required' | 'provider_unavailable' | 'rate_limited' | 'unknown'
      supportCode: string | null
      message: string
    } | null
  }>
}

class MockD1 {
  leads = new Map<string, Record<string, unknown>>()
  profiles = new Map<string, {
    email: string
    currency: string
    monthly_income?: number | null
    monthly_budget?: number | null
    category_budgets_json?: string | null
  }>()
  dashboardSessions = new Map<string, { email: string; client_secret_hash: string }>()
  loginChallenges: Record<string, unknown>[] = []
  transactions: Record<string, unknown>[] = []
  syncfyUsers: Record<string, unknown>[] = []
  syncfyCredentials: Record<string, unknown>[] = []
  syncfyWebhookEvents: Record<string, unknown>[] = []
  syncfyErrors: Record<string, unknown>[] = []
  invites: Record<string, unknown>[] = []

  prepare(sql: string) {
    const db = this

    return {
      bind(...params: BoundParams) {
        return {
          async run() {
            return db.run(sql, params)
          },
          async first<T>() {
            return db.first<T>(sql, params)
          },
          async all<T>() {
            return db.all<T>(sql, params)
          },
        }
      },
      async run() {
        return db.run(sql, [])
      },
      async first<T>() {
        return db.first<T>(sql, [])
      },
      async all<T>() {
        return db.all<T>(sql, [])
      },
    }
  }

  async run(sql: string, params: BoundParams) {
    if (sql.includes('INSERT INTO financial_profiles')) {
      const [email, currency] = params
      const current = this.profiles.get(String(email))
      this.profiles.set(String(email), {
        email: String(email),
        currency: String(currency),
        monthly_income: current?.monthly_income ?? null,
        monthly_budget: current?.monthly_budget ?? null,
        category_budgets_json: current?.category_budgets_json ?? null,
      })
    }

    if (sql.includes('UPDATE financial_profiles')) {
      const [currency, monthlyIncome, monthlyBudget, categoryBudgetsJson, email] = params
      const current = this.profiles.get(String(email)) || {
        email: String(email),
        currency: 'MXN',
      }
      this.profiles.set(String(email), {
        ...current,
        currency: String(currency),
        monthly_income: monthlyIncome === null ? null : Number(monthlyIncome),
        monthly_budget: monthlyBudget === null ? null : Number(monthlyBudget),
        category_budgets_json: categoryBudgetsJson === null ? null : String(categoryBudgetsJson),
      })
    }

    if (sql.includes('INSERT INTO leads')) {
      const [email, name, diagnosticData] = params
      this.leads.set(String(email), {
        id: 1,
        email,
        name,
        diagnostic_data: diagnosticData,
        stage: 'stage_0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    if (sql.includes('INSERT INTO dashboard_sessions')) {
      const [email, clientSecretHash] = params
      this.dashboardSessions.set(String(email), {
        email: String(email),
        client_secret_hash: String(clientSecretHash),
      })
    }

    if (sql.includes('UPDATE dashboard_sessions')) {
      return { success: true, meta: { last_row_id: 1 } }
    }

    if (sql.includes('INSERT INTO email_login_challenges')) {
      const [id, email, tokenHash, codeHash, source, redirectPath, createdAt, expiresAt] = params
      this.loginChallenges.push({
        id,
        email,
        token_hash: tokenHash,
        code_hash: codeHash,
        source,
        redirect_path: redirectPath,
        attempts: 0,
        created_at: createdAt,
        expires_at: expiresAt,
        consumed_at: null,
      })
    }

    if (sql.includes('UPDATE email_login_challenges SET attempts = attempts + 1')) {
      const [id] = params
      const challenge = this.loginChallenges.find((item) => item.id === id)
      if (challenge) challenge.attempts = Number(challenge.attempts || 0) + 1
    }

    if (sql.includes('UPDATE email_login_challenges SET consumed_at = ?')) {
      const [consumedAt, id] = params
      const challenge = this.loginChallenges.find((item) => item.id === id)
      if (challenge) challenge.consumed_at = consumedAt
    }

    if (sql.includes('UPDATE transactions') && sql.includes('AND merchant = ?')) {
      const [category, email, type, merchant, excludedId, previousCategory] = params
      let changes = 0
      for (const transaction of this.transactions) {
        if (
          transaction.email === email &&
          transaction.type === type &&
          transaction.merchant === merchant &&
          transaction.id !== excludedId &&
          (Number(transaction.category_locked || 0) === 0 || transaction.category === previousCategory)
        ) {
          transaction.category = category
          transaction.category_locked = 1
          transaction.updated_at = new Date().toISOString()
          changes += 1
        }
      }
      return { success: true, meta: { changes } }
    }

    if (sql.includes('UPDATE transactions') && sql.includes('SET category = ?')) {
      const [category, id, email] = params
      const transaction = this.transactions.find((item) => item.id === id && item.email === email)
      if (transaction) {
        transaction.category = category
        transaction.category_locked = 1
        transaction.updated_at = new Date().toISOString()
        return { success: true, meta: { changes: 1 } }
      }
      return { success: true, meta: { changes: 0 } }
    }

    if (sql.includes('INSERT INTO transactions') && sql.includes("'syncfy'")) {
      const [
        id,
        email,
        date,
        type,
        amount,
        currency,
        category,
        description,
        merchant,
        rawSource,
      ] = params

      const existing = this.transactions.find((item) => item.id === id)
      if (existing) {
        existing.email = email
        existing.date = date
        existing.type = type
        existing.amount = amount
        existing.currency = currency
        existing.category = category
        existing.description = description
        existing.merchant = merchant
        existing.raw_source = rawSource
        existing.updated_at = new Date().toISOString()
        return { success: true, meta: { last_row_id: 1 } }
      }

      this.transactions.push({
        id,
        email,
        date,
        type,
        amount,
        currency,
        category,
        description,
        merchant,
        notes: null,
        source: 'syncfy',
        confidence: 0.9,
        category_locked: 0,
        raw_source: rawSource,
        cartola_import_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      return { success: true, meta: { last_row_id: 1 } }
    }

    if (sql.includes('DELETE FROM transactions') && sql.includes("source = 'syncfy'")) {
      if (params.length === 1) {
        const [email] = params
        const before = this.transactions.length
        this.transactions = this.transactions.filter((item) => item.email !== email || item.source !== 'syncfy')
        return { success: true, meta: { changes: before - this.transactions.length } }
      }

      const [email, rawPattern, idPattern] = params
      const rawNeedle = String(rawPattern).replaceAll('%', '')
      const idNeedle = String(idPattern).replaceAll('%', '')
      const before = this.transactions.length
      this.transactions = this.transactions.filter((item) => {
        if (item.email !== email || item.source !== 'syncfy') return true

        const rawSource = String(item.raw_source || item.rawSource || '')
        const id = String(item.id || '')
        return !rawSource.includes(rawNeedle) && !id.includes(idNeedle)
      })
      return { success: true, meta: { changes: before - this.transactions.length } }
    }

    if (sql.includes('DELETE FROM syncfy_credentials') && !sql.includes('syncfy_credential_id')) {
      const [email] = params
      const before = this.syncfyCredentials.length
      this.syncfyCredentials = this.syncfyCredentials.filter((item) => item.email !== email)
      return { success: true, meta: { changes: before - this.syncfyCredentials.length } }
    }

    if (sql.includes('DELETE FROM syncfy_credentials')) {
      const [email, credentialId] = params
      const before = this.syncfyCredentials.length
      this.syncfyCredentials = this.syncfyCredentials.filter(
        (item) => !(item.email === email && item.syncfy_credential_id === credentialId)
      )
      return { success: true, meta: { changes: before - this.syncfyCredentials.length } }
    }

    if (sql.includes('INSERT INTO syncfy_users')) {
      const [email, syncfyUserId, externalId, name] = params
      const existing = this.syncfyUsers.find((item) => item.email === email)
      const next = {
        email,
        syncfy_user_id: syncfyUserId,
        syncfy_external_id: externalId,
        name,
        mode: 'live',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_session_at: existing?.last_session_at || null,
      }
      if (existing) {
        Object.assign(existing, next)
      } else {
        this.syncfyUsers.push(next)
      }
      return { success: true, meta: { last_row_id: 1, changes: 1 } }
    }

    if (sql.includes('INSERT INTO syncfy_credentials')) {
      const [
        id,
        email,
        syncfyUserId,
        syncfyCredentialId,
        syncfySiteId,
        siteName,
        status,
        lastSuccessfulSyncAt,
        lastPullAt,
        lastRid,
        rawJson,
      ] = params
      const existing = this.syncfyCredentials.find(
        (item) => item.email === email && item.syncfy_credential_id === syncfyCredentialId
      )
      const next = {
        id,
        email,
        syncfy_user_id: syncfyUserId,
        syncfy_credential_id: syncfyCredentialId,
        syncfy_site_id: syncfySiteId,
        site_name: siteName,
        status,
        last_successful_sync_at: lastSuccessfulSyncAt,
        last_pull_at: lastPullAt,
        last_rid: lastRid,
        raw_json: rawJson,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (existing) {
        Object.assign(existing, next)
      } else {
        this.syncfyCredentials.push(next)
      }
      return { success: true, meta: { last_row_id: 1 } }
    }

    if (sql.includes('UPDATE syncfy_credentials')) {
      const credentialId = String(params.at(-1))
      const email = String(params.at(-2))
      const credential = this.syncfyCredentials.find(
        (item) => item.email === email && item.syncfy_credential_id === credentialId
      )
      if (credential) {
        if (sql.includes('raw_json = ?')) {
          credential.raw_json = params[0]
        }
        if (sql.includes('site_name = COALESCE') || sql.includes('site_name = CASE')) {
          const nextSiteId = params[0]
          const nextSiteName = params[1]
          if (nextSiteId != null) credential.syncfy_site_id = nextSiteId
          if (nextSiteName != null) credential.site_name = nextSiteName
        }
        if (sql.includes("status = 'synced'") || sql.includes("status = COALESCE(NULLIF(status, ''), 'synced')")) {
          credential.status = 'synced'
          credential.last_pull_at = new Date().toISOString()
          credential.last_successful_sync_at = new Date().toISOString()
        } else if (sql.includes("status = 'pending_transactions'")) {
          credential.status = 'pending_transactions'
          if (sql.includes('last_pull_at')) {
            credential.last_pull_at = new Date().toISOString()
          }
        }
        credential.updated_at = new Date().toISOString()
      }
      return { success: true, meta: { changes: credential ? 1 : 0 } }
    }

    if (sql.includes('INSERT INTO syncfy_webhook_events')) {
      const [id, eventType, syncfyUserId, syncfyCredentialId, rid, payloadJson] = params
      this.syncfyWebhookEvents.push({
        id,
        event_type: eventType,
        syncfy_user_id: syncfyUserId,
        syncfy_credential_id: syncfyCredentialId,
        rid,
        payload_json: payloadJson,
        processed_at: null,
        created_at: new Date().toISOString(),
      })
      return { success: true, meta: { last_row_id: 1 } }
    }

    if (sql.includes('UPDATE syncfy_webhook_events')) {
      const [eventId] = params
      const event = this.syncfyWebhookEvents.find((item) => item.id === eventId)
      if (event) event.processed_at = new Date().toISOString()
      return { success: true, meta: { changes: event ? 1 : 0 } }
    }

    if (sql.includes('INSERT INTO syncfy_errors')) {
      const [id, email, syncfyUserId, syncfyCredentialId, rid, statusCode, errorCode, message, source, payloadJson] = params
      this.syncfyErrors.push({
        id,
        email,
        syncfy_user_id: syncfyUserId,
        syncfy_credential_id: syncfyCredentialId,
        rid,
        status_code: statusCode,
        error_code: errorCode,
        message,
        source,
        payload_json: payloadJson,
        created_at: new Date().toISOString(),
      })
      return { success: true, meta: { last_row_id: 1 } }
    }

    if (sql.includes('INSERT INTO transactions')) {
      const [
        id,
        email,
        date,
        type,
        amount,
        currency,
        category,
        description,
        merchant,
        notes,
        source,
        confidence,
        categoryLocked,
        rawSource,
        cartolaImportId,
      ] = params

      const existing = this.transactions.find((item) => item.id === id)
      if (existing && sql.includes('ON CONFLICT(id)')) {
        const previousType = existing.type
        existing.email = email
        existing.date = date
        existing.type = type
        existing.amount = amount
        existing.currency = currency
        if (!existing.category_locked || previousType !== type) {
          existing.category = category
          existing.category_locked = previousType === type ? existing.category_locked : 0
        }
        existing.description = description
        existing.merchant = merchant
        existing.raw_source = rawSource
        existing.updated_at = new Date().toISOString()
        return { success: true, meta: { last_row_id: 1 } }
      }

      this.transactions.push({
        id,
        email,
        date,
        type,
        amount,
        currency,
        category,
        description,
        merchant,
        notes,
        source,
        confidence,
        category_locked: categoryLocked,
        raw_source: rawSource,
        cartola_import_id: cartolaImportId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    if (sql.includes('INSERT INTO household_invites')) {
      const [id, inviterEmail, inviteeEmail] = params
      const existing = this.invites.find(
        (item) => item.inviter_email === inviterEmail && item.invitee_email === inviteeEmail
      )

      if (existing) {
        existing.status = 'pending'
        existing.updated_at = new Date().toISOString()
      } else {
        this.invites.push({
          id,
          inviter_email: inviterEmail,
          invitee_email: inviteeEmail,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    }

    return { success: true, meta: { last_row_id: 1 } }
  }

  async first<T>(sql: string, params: BoundParams): Promise<T | null> {
    if (sql.includes('SELECT * FROM financial_profiles WHERE email = ?')) {
      const [email] = params
      return (this.profiles.get(String(email)) || null) as T | null
    }

    if (sql.includes('SELECT COUNT(*) AS count') && sql.includes('FROM transactions') && sql.includes("source = 'syncfy'")) {
      const [email, rawNeedle] = params
      const count = this.transactions.filter((item) => (
        item.email === email &&
        item.source === 'syncfy' &&
        String(item.raw_source || item.rawSource || '').includes(rawNeedle)
      )).length
      return ({ count } as T)
    }

    if (sql.includes('SELECT * FROM transactions WHERE id = ? AND email = ?')) {
      const [id, email] = params
      return (this.transactions.find((item) => item.id === id && item.email === email) || null) as T | null
    }

    if (sql.includes('SELECT * FROM leads WHERE email = ?')) {
      const [email] = params
      return (this.leads.get(String(email)) || null) as T | null
    }

    if (sql.includes('SELECT email FROM syncfy_users WHERE syncfy_user_id = ?')) {
      const [syncfyUserId] = params
      const user = this.syncfyUsers.find((item) => item.syncfy_user_id === syncfyUserId)
      return (user ? { email: user.email } : null) as T | null
    }

    if (sql.includes('SELECT * FROM syncfy_users WHERE email = ?')) {
      const [email] = params
      return (this.syncfyUsers.find((item) => item.email === email) || null) as T | null
    }

    if (sql.includes('SELECT * FROM syncfy_credentials WHERE email = ? AND syncfy_credential_id = ?')) {
      const [email, credentialId] = params
      return (this.syncfyCredentials.find(
        (item) => item.email === email && item.syncfy_credential_id === credentialId
      ) || null) as T | null
    }

    if (sql.includes('SELECT id, event_type, syncfy_user_id, syncfy_credential_id, rid, processed_at, created_at FROM syncfy_webhook_events WHERE id = ?')) {
      const [id] = params
      return (this.syncfyWebhookEvents.find((item) => item.id === id) || null) as T | null
    }

    if (sql.includes('SELECT client_secret_hash FROM dashboard_sessions WHERE email = ?')) {
      const [email] = params
      return (this.dashboardSessions.get(String(email)) || null) as T | null
    }

    if (sql.includes('SELECT * FROM email_login_challenges') && sql.includes('token_hash = ?')) {
      const [email, tokenHash, now] = params
      return (this.loginChallenges.find(
        (item) =>
          item.email === email &&
          item.token_hash === tokenHash &&
          item.consumed_at === null &&
          Number(item.expires_at) > Number(now)
      ) || null) as T | null
    }

    if (sql.includes('SELECT * FROM email_login_challenges')) {
      const [email, now] = params
      const challenges = this.loginChallenges
        .filter(
          (item) =>
            item.email === email &&
            item.consumed_at === null &&
            Number(item.expires_at) > Number(now)
        )
        .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      return (challenges[0] || null) as T | null
    }

    if (sql.includes('SELECT * FROM household_invites') && sql.includes('invitee_email = ?')) {
      const [inviterEmail, inviteeEmail] = params
      return (this.invites.find(
        (item) => item.inviter_email === inviterEmail && item.invitee_email === inviteeEmail
      ) || null) as T | null
    }

    return null
  }

  async all<T>(sql: string, params: BoundParams): Promise<{ results: T[] }> {
    if (sql.includes('SELECT * FROM syncfy_credentials')) {
      const [email] = params
      const results = this.syncfyCredentials
        .filter((item) => item.email === email)
        .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at))) as T[]
      return { results }
    }

    if (sql.includes('FROM syncfy_errors')) {
      const [email, syncfyUserId] = params
      const results = this.syncfyErrors
        .filter((item) => item.email === email || item.syncfy_user_id === syncfyUserId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) as T[]
      return { results }
    }

    if (sql.includes('FROM syncfy_webhook_events') && sql.includes('WHERE syncfy_user_id = ?')) {
      const [syncfyUserId] = params
      const results = this.syncfyWebhookEvents
        .filter((item) => item.syncfy_user_id === syncfyUserId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) as T[]
      return { results }
    }

    if (sql.includes('SELECT * FROM transactions')) {
      const [email] = params
      const results = this.transactions
        .filter((item) => item.email === email)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))) as T[]
      return { results }
    }

    if (sql.includes('SELECT * FROM household_invites')) {
      const [email] = params
      const results = this.invites.filter((item) => item.inviter_email === email) as T[]
      return { results }
    }

    return { results: [] }
  }
}

function createEnv(environment = 'test', overrides: Record<string, unknown> = {}) {
  return {
    DB: new MockD1(),
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
  env.DB.transactions.push(
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
  env.DB.transactions.push(
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
  env.DB.syncfyCredentials.push({
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: 'unknown-site-id',
    site_name: 'BBVA México',
    status: 'needs_reconnect',
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
  env.DB.syncfyCredentials.push({
    id: 'credential-row-1',
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_credential_id: 'credential-1',
    syncfy_site_id: 'amex-site',
    site_name: 'American Express',
    status: 'pending_transactions',
    last_successful_sync_at: null,
    last_pull_at: '2026-07-29T04:00:51Z',
    last_rid: 'password-rid',
    raw_json: null,
    created_at: '2026-07-28T03:18:10Z',
    updated_at: '2026-07-29T04:00:51Z',
  })
  env.DB.syncfyErrors.push({
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
      supportCode: 'password-rid',
    },
  })
  expect(data.credentials[0].connectionIssue?.message).toContain('contraseña')
})

test('syncfy credentials endpoint replaces auth-channel labels with organization catalogue names', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  env.DB.syncfyCredentials.push({
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
    expect(env.DB.syncfyCredentials[0].site_name).toBe('BBVA México')
    expect(calls.some((url) => url.includes('/catalogues/site_organizations'))).toBe(true)
    expect(calls.some((url) => url.includes('/catalogues/organizations/sites'))).toBe(false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy credentials endpoint keeps channel labels when catalogue enrichment fails', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  env.DB.syncfyCredentials.push({
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
    expect(env.DB.syncfyCredentials[0].site_name).toBe('Personal')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy credential delete removes one connection and its imported transactions', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  env.DB.syncfyCredentials.push(
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
  env.DB.transactions.push(
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
    expect(env.DB.syncfyCredentials.map((credential) => credential.syncfy_credential_id)).toEqual(['credential-2'])
    expect(env.DB.transactions.map((transaction) => transaction.id)).toEqual([
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
  env.DB.syncfyCredentials.push({
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
  env.DB.transactions.push({
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
    expect(env.DB.syncfyCredentials.map((credential) => credential.syncfy_credential_id)).toEqual(['credential-1'])
    expect(env.DB.transactions.map((transaction) => transaction.id)).toEqual(['syncfy:credential-1:restaurant'])
    expect(env.DB.syncfyErrors).toHaveLength(1)
    expect(env.DB.syncfyErrors[0]).toMatchObject({
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
  env.DB.syncfyCredentials.push({
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
  env.DB.transactions.push({
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
    expect(env.DB.syncfyCredentials).toEqual([])
    expect(env.DB.transactions).toEqual([])
    expect(env.DB.syncfyErrors).toHaveLength(1)
    expect(env.DB.syncfyErrors[0]).toMatchObject({
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
  env.DB.syncfyCredentials.push({
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
    expect(env.DB.syncfyCredentials).toEqual([])
    expect(env.DB.syncfyErrors[0]).toMatchObject({
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
  expect(env.DB.syncfyCredentials).toEqual([])
  expect(env.DB.syncfyErrors).toHaveLength(1)
  expect(env.DB.syncfyErrors[0]).toMatchObject({
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
  env.DB.syncfyCredentials.push({
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
    expect(env.DB.syncfyCredentials[0].status).toBe('synced')
    expect(env.DB.syncfyCredentials[0].last_successful_sync_at).toBeTruthy()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy pending refresh polls job status during pull cooldown without starting another pull', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  env.DB.syncfyCredentials.push({
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
    expect(env.DB.syncfyCredentials[0].status).toBe('synced')
    expect(env.DB.syncfyCredentials[0].last_successful_sync_at).toBeTruthy()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy synced refresh still respects provider pull cooldown', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  env.DB.syncfyCredentials.push({
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
  env.DB.syncfyCredentials.push({
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
    expect(env.DB.syncfyCredentials[0].status).toBe('synced')
    expect(env.DB.syncfyCredentials[0].last_successful_sync_at).toBeTruthy()
    expect(String(env.DB.syncfyCredentials[0].raw_json)).toContain('job-from-pull')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh imports direct transactions when a new pull is rate-limited', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  env.DB.syncfyCredentials.push({
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
    expect(env.DB.syncfyErrors[0]).toMatchObject({
      rid: 'pull-rate-limit-rid',
      status_code: 429,
      source: 'syncfy-pull',
    })
    expect(env.DB.syncfyCredentials[0].status).toBe('synced')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh recovers stale needs_reconnect when transactions are readable', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  env.DB.syncfyCredentials.push({
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
    expect(env.DB.syncfyCredentials[0].status).toBe('synced')
    expect(env.DB.syncfyCredentials[0].last_successful_sync_at).toBeTruthy()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh allows support admin to recover a production credential without browser session', async () => {
  const env = createEnv('production', {
    SUPPORT_ADMIN_SECRET: 'admin-secret',
    SYNCFY_API_KEY: 'test-key',
  })
  env.DB.syncfyCredentials.push({
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
    expect(env.DB.syncfyCredentials[0].status).toBe('synced')
    expect(env.DB.syncfyCredentials[0].last_successful_sync_at).toBeTruthy()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh records pending pull attempts when Syncfy returns no transactions', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  env.DB.syncfyCredentials.push({
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
    created_at: '2026-06-10T02:49:34Z',
    updated_at: '2026-06-10T02:49:34Z',
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
    expect(env.DB.syncfyCredentials[0].status).toBe('pending_transactions')
    expect(env.DB.syncfyCredentials[0].last_pull_at).toBeTruthy()
    expect(env.DB.syncfyCredentials[0].last_successful_sync_at).toBeNull()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy refresh treats webhook-imported transactions as complete when polling is empty', async () => {
  const env = createEnv('test', { SYNCFY_API_KEY: 'test-key' })
  env.DB.syncfyCredentials.push({
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
  env.DB.transactions.push({
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
    expect(env.DB.syncfyCredentials[0].status).toBe('synced')
    expect(env.DB.syncfyCredentials[0].last_successful_sync_at).toBeTruthy()
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
  env.DB.syncfyUsers.push({
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
    expect(env.DB.syncfyWebhookEvents).toHaveLength(1)
    expect(env.DB.syncfyWebhookEvents[0].processed_at).toBeNull()
    expect(env.DB.transactions).toHaveLength(0)

    releaseTransactions()
    await waitUntilPromises[0]

    expect(env.DB.syncfyWebhookEvents[0].processed_at).toBeTruthy()
    expect(env.DB.transactions).toHaveLength(1)
    expect(env.DB.syncfyCredentials[0].status).toBe('synced')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy deleted webhook removes local credential instead of recreating it', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
    SYNCFY_WEBHOOK_SECRET: 'webhook-secret',
  })
  env.DB.syncfyUsers.push({
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: null,
    mode: 'live',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: null,
    last_session_at: null,
  })
  env.DB.syncfyCredentials.push({
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
  env.DB.transactions.push({
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
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
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
  expect(env.DB.syncfyCredentials).toHaveLength(1)

  await waitUntilPromises[0]

  expect(env.DB.syncfyCredentials).toEqual([])
  expect(env.DB.transactions).toEqual([])
  expect(env.DB.syncfyWebhookEvents[0].processed_at).toBeTruthy()
})

test('syncfy status probe is protected and returns sanitized upstream checks', async () => {
  const env = createEnv('production', {
    SUPPORT_ADMIN_SECRET: 'admin-secret',
    SYNCFY_API_KEY: 'test-key',
  })
  env.DB.syncfyUsers.push({
    email: 'user@example.com',
    syncfy_user_id: 'syncfy-user-1',
    syncfy_external_id: 'finovai:user@example.com',
    name: 'User',
    mode: 'live',
    created_at: '2026-06-10T02:49:34Z',
    updated_at: null,
    last_session_at: null,
  })
  env.DB.syncfyCredentials.push({
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
  env.DB.syncfyUsers.push({
    email: 'user@example.com',
    syncfy_user_id: 'stale-user',
    syncfy_external_id: 'finovai:user@example.com:reset:old',
    name: 'User',
    mode: 'live',
    created_at: '2026-06-10T02:49:34Z',
    updated_at: null,
    last_session_at: null,
  })
  env.DB.syncfyCredentials.push({
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
  env.DB.transactions.push(
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
    expect(env.DB.syncfyCredentials).toEqual([])
    expect(env.DB.transactions.map((item) => item.id)).toEqual(['manual:rent'])
    expect(env.DB.syncfyUsers.find((item) => item.email === 'user@example.com')?.syncfy_user_id)
      .toBe('fresh-user')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('syncfy session stale-user recovery clears old local syncfy state', async () => {
  const env = createEnv('test', {
    SYNCFY_API_KEY: 'test-key',
  })
  env.DB.syncfyUsers.push({
    email: 'user@example.com',
    syncfy_user_id: 'stale-user',
    syncfy_external_id: 'finovai:user@example.com',
    name: 'User',
    mode: 'live',
    created_at: '2026-06-10T02:49:34Z',
    updated_at: null,
    last_session_at: null,
  })
  env.DB.syncfyCredentials.push({
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
  env.DB.transactions.push(
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
    expect(env.DB.syncfyCredentials).toEqual([])
    expect(env.DB.transactions.map((item) => item.id)).toEqual(['manual:rent'])
    expect(env.DB.syncfyErrors[0]).toMatchObject({
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

test('classifySyncfyConnectionIssue separates user action from provider incidents', () => {
  expect(classifySyncfyConnectionIssue({
    rid: 'password-rid',
    status_code: 400,
    message: 'Credential error, please consider updating credential password',
    source: 'syncfy-pull',
    created_at: '2026-07-29T04:00:51Z',
  })).toMatchObject({
    kind: 'action_required',
    owner: 'user',
    action: 'update_access',
    supportCode: 'password-rid',
  })

  expect(classifySyncfyConnectionIssue({
    rid: 'provider-rid',
    status_code: 400,
    message: "Credential can't be sync at this moment",
    source: 'syncfy-pull',
    created_at: '2026-07-29T04:00:50Z',
  })).toMatchObject({
    kind: 'provider_unavailable',
    owner: 'provider',
    action: 'retry_later',
    supportCode: 'provider-rid',
  })

  expect(classifySyncfyConnectionIssue({
    rid: 'rate-rid',
    status_code: 429,
    message: 'Credential Rate Limit exceeded. Try again in 58 s',
    source: 'syncfy-pull',
    created_at: '2026-07-28T03:18:12Z',
  })).toMatchObject({
    kind: 'rate_limited',
    owner: 'provider',
  })
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
