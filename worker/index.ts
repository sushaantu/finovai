import * as XLSX from 'xlsx'
import { extractText, getDocumentProxy } from 'unpdf'

interface Env {
  DB: D1Database
  AI: Ai
  ENVIRONMENT: string
  KAPSO_API_KEY?: string
  KAPSO_PHONE_NUMBER_ID?: string
  SESSION_SECRET?: string
  SYNCFY_API_KEY?: string
  SYNCFY_API_BASE_URL?: string
  SYNCFY_AUTH_HEADER_NAME?: string
  SYNCFY_AUTH_HEADER_PREFIX?: string
  SYNCFY_AUTH_HEADER_VALUE?: string
  SYNCFY_TRANSACTIONS_PATH?: string
  SYNCFY_WEBHOOK_SECRET?: string
  PROMETEO_API_KEY?: string
  PROMETEO_API_BASE_URL?: string
  PROMETEO_PROXY_URL?: string
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface User {
  id: number
  phone: string
  phone_verified: number
  display_name: string | null
  couple_id: number | null
  created_at: string
}

interface Session {
  id: number
  user_id: number
  token: string
  expires_at: string
}

interface ButtonOption {
  label: string
  value: string
  variant?: 'primary' | 'secondary'
}

interface QuizQuestion {
  id: string
  text: string
  options: { value: number; label: string }[]
}

interface Lead {
  id: number
  email: string
  name: string | null
  diagnostic_data: string | null
  stage: string | null
  created_at: string
  updated_at: string | null
}

interface SyncfyUserRow {
  email: string
  syncfy_user_id: string
  syncfy_external_id: string
  name: string | null
  mode: 'live' | 'local'
  created_at: string
  updated_at: string | null
  last_session_at: string | null
}

interface SyncfyCredentialRow {
  id: string
  email: string
  syncfy_user_id: string
  syncfy_credential_id: string
  syncfy_site_id: string | null
  site_name: string | null
  status: string | null
  last_successful_sync_at: string | null
  last_pull_at: string | null
  last_rid: string | null
  raw_json: string | null
  created_at: string
  updated_at: string | null
}

interface SyncfyWebhookEventRow {
  id: string
  event_type: string
  syncfy_user_id: string | null
  syncfy_credential_id: string | null
  rid: string | null
  processed_at: string | null
  created_at: string
}

interface SyncfyErrorRow {
  id: string
  email: string | null
  syncfy_user_id: string | null
  syncfy_credential_id: string | null
  rid: string | null
  status_code: number | null
  error_code: string | null
  message: string | null
  source: string
  created_at: string
}

interface SyncfyCredentialPayload {
  syncfyUserId: string | null
  syncfyCredentialId: string | null
  syncfySiteId: string | null
  siteName: string | null
  status: string | null
  rid: string | null
}

interface SyncfyTransactionImportResult {
  credentialId: string | null
  fetched: number
  imported: number
  skipped: number
  endpoints: string[]
}

interface NormalizedSyncfyTransaction {
  id: string
  date: string
  type: FinanceTransactionType
  amount: number
  currency: string
  category: string
  description: string
  merchant: string
  raw: unknown
}

interface SyncfyCredentialsResponse {
  success: true
  email: string
  credentials: Array<{
    id: string
    syncfyCredentialId: string
    siteName: string | null
    status: string | null
    lastSuccessfulSyncAt: string | null
    lastPullAt: string | null
    cooldownSeconds: number
    ready: boolean
  }>
}

interface Expense {
  id: string
  date: string
  description: string
  amount: number
  category: string
  merchant: string
  accountName?: string
  accountNumber?: string
  accountCurrency?: string
  type?: 'debit' | 'credit'
}

interface ExpenseSummary {
  totalSpent: number
  transactionCount: number
  topCategory: string
  topMerchant: string
  savingsOpportunity: number
}

type FinanceTransactionType = 'income' | 'expense'
type FinanceTransactionSource = 'manual' | 'cartola' | 'syncfy'

interface FinanceTransactionRow {
  id: string
  email: string
  date: string
  type: FinanceTransactionType
  amount: number
  currency: string
  category: string
  description: string
  merchant: string | null
  notes: string | null
  source: FinanceTransactionSource
  confidence: number
  raw_source: string | null
  cartola_import_id: string | null
  created_at: string
  updated_at: string | null
}

export interface FinanceTransaction {
  id: string
  email: string
  date: string
  type: FinanceTransactionType
  amount: number
  currency: string
  category: string
  description: string
  merchant: string | null
  notes: string | null
  source: FinanceTransactionSource
  confidence: number
  rawSource: string | null
  cartolaImportId: string | null
  created_at: string
}

export interface CartolaDraftRow {
  id: string
  date: string
  type: FinanceTransactionType
  amount: number
  currency: string
  category: string
  description: string
  merchant: string
  confidence: number
  rawSource: string
}

export interface FinanceSummary {
  month: string
  monthlyIncome: number
  monthlySpending: number
  netBalance: number
  transactionCount: number
  topSpendingCategory: string
  topSpendingCategoryAmount: number
  unusualHighSpendDay: { date: string; amount: number } | null
  recurringExpenses: Array<{ key: string; description: string; amount: number; count: number }>
  estimatedSavingsOpportunity: number
}

export interface FinanceInsight {
  id: string
  title: string
  value: string
  body: string
  tone: 'good' | 'watch' | 'urgent'
}

interface HouseholdInviteRow {
  id: string
  inviter_email: string
  invitee_email: string
  status: 'pending' | 'accepted' | 'cancelled'
  created_at: string
  updated_at: string | null
}

export interface HouseholdInvite {
  id: string
  inviterEmail: string
  inviteeEmail: string
  status: 'pending' | 'accepted' | 'cancelled'
  created_at: string
}

interface PrometeoAccount {
  id?: string
  name?: string
  number?: string
  currency?: string
  balance?: number | string
}

interface PrometeoMovement {
  id?: string
  reference?: string
  date?: string
  detail?: string
  debit?: number | string
  credit?: number | string
  extra_data?: unknown
}

interface PrometeoLoginResponse {
  status?: string
  key?: string
  body?: {
    status?: string
    key?: string
  }
  message?: string
}

interface PrometeoListResponse<T> {
  status?: string
  accounts?: T[]
  movements?: T[]
  data?: T[]
  body?: {
    accounts?: T[]
    movements?: T[]
    data?: T[]
  }
  message?: string
}

const CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct' as keyof AiModels
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOCAL_AI_FALLBACK =
  'Estoy corriendo en modo local. La IA real necesita Cloudflare auth para ejecutarse, pero puedes probar la interfaz, el registro por email y el flujo del producto.'
const DEFAULT_SYNCFY_BASE_URL = 'https://sync.paybook.com/v1'
const DEFAULT_PROMETEO_BASE_URL = 'https://banking.sandbox.prometeoapi.com'
const PROMETEO_DEFAULT_DATE_START = '01/02/2019'
const PROMETEO_DEFAULT_DATE_END = '02/02/2019'
const SYNCFY_REFRESH_COOLDOWN_SECONDS = 5 * 60
const SYNCFY_DEFAULT_TRANSACTION_LIMIT = 5000
const SYNCFY_WIDGET_CONFIG = {
  locale: 'es',
  entrypoint: {
    country: 'MX',
    siteOrganizationType: '56cf4f5b784806cf028b4568',
  },
  navigation: {
    displayErrorsInToast: true,
    displayPrivacyScreen: true,
    displayStatusInToast: true,
    hideSelectCountry: true,
    socketTimeout: 600_000,
    toastDuration: 7000,
  },
}
const DEFAULT_FINANCE_CURRENCY = 'MXN'
const MAX_CARTOLA_UPLOAD_BYTES = 5 * 1024 * 1024
const MAX_CARTOLA_ROWS = 500
const LOW_CONFIDENCE_THRESHOLD = 0.75
const INCOME_CATEGORIES = ['Sueldo', 'Freelance', 'Inversión', 'Reembolso', 'Venta', 'Otro ingreso']
const EXPENSE_CATEGORIES = [
  'Comida fuera',
  'Supermercado',
  'Transporte',
  'Suscripciones',
  'Hogar',
  'Salud',
  'Educación',
  'Ocio',
  'Compras',
  'Transferencias',
  'Retiros',
  'Deuda',
  'Impuestos',
  'Otro',
]
const DISCRETIONARY_CATEGORIES = new Set(['Comida fuera', 'Suscripciones', 'Ocio', 'Transporte'])
const MONTH_NAMES: Record<string, string> = {
  ene: '01',
  enero: '01',
  jan: '01',
  january: '01',
  feb: '02',
  febrero: '02',
  february: '02',
  mar: '03',
  marzo: '03',
  march: '03',
  abr: '04',
  abril: '04',
  apr: '04',
  april: '04',
  may: '05',
  mayo: '05',
  jun: '06',
  junio: '06',
  june: '06',
  jul: '07',
  julio: '07',
  july: '07',
  ago: '08',
  agosto: '08',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  septiembre: '09',
  september: '09',
  oct: '10',
  octubre: '10',
  october: '10',
  nov: '11',
  noviembre: '11',
  november: '11',
  dic: '12',
  diciembre: '12',
  dec: '12',
  december: '12',
}

const SAMPLE_EXPENSES: Expense[] = [
  {
    id: 'sample-1',
    date: '2026-04-28',
    description: 'Supermercado La Comer',
    amount: 1340,
    category: 'Supermercado',
    merchant: 'La Comer',
  },
  {
    id: 'sample-2',
    date: '2026-04-27',
    description: 'Uber trip',
    amount: 188,
    category: 'Transporte',
    merchant: 'Uber',
  },
  {
    id: 'sample-3',
    date: '2026-04-25',
    description: 'Netflix',
    amount: 219,
    category: 'Suscripciones',
    merchant: 'Netflix',
  },
  {
    id: 'sample-4',
    date: '2026-04-23',
    description: 'Restaurante',
    amount: 720,
    category: 'Comida fuera',
    merchant: 'Restaurante',
  },
  {
    id: 'sample-5',
    date: '2026-04-21',
    description: 'Farmacia',
    amount: 315,
    category: 'Salud',
    merchant: 'Farmacia',
  },
]

export function normalizeSignupEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null

  const normalizedEmail = email.trim().toLowerCase()
  return EMAIL_PATTERN.test(normalizedEmail) ? normalizedEmail : null
}

export function buildSyncfyExternalId(email: string): string {
  return `finovai:${email}`
}

export function summarizeExpenses(expenses: Expense[]): ExpenseSummary {
  const categoryTotals = new Map<string, number>()
  const merchantTotals = new Map<string, number>()
  const totalSpent = expenses.reduce((sum, expense) => {
    const amount = Math.max(expense.amount, 0)
    if (amount === 0) return sum

    categoryTotals.set(expense.category, (categoryTotals.get(expense.category) || 0) + amount)
    merchantTotals.set(expense.merchant, (merchantTotals.get(expense.merchant) || 0) + amount)
    return sum + amount
  }, 0)

  const topCategory = maxByTotal(categoryTotals) || 'Sin datos'
  const topMerchant = maxByTotal(merchantTotals) || 'Sin datos'
  const subscriptions = categoryTotals.get('Suscripciones') || 0

  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    transactionCount: expenses.length,
    topCategory,
    topMerchant,
    savingsOpportunity: Math.round(subscriptions * 0.5),
  }
}

function maxByTotal(totals: Map<string, number>): string | null {
  let winner: string | null = null
  let max = 0

  for (const [key, value] of totals.entries()) {
    if (value > max) {
      winner = key
      max = value
    }
  }

  return winner
}

function isLocalRequest(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
}

async function runAIResponse(env: Env, messages: Message[], allowLocalFallback: boolean): Promise<string> {
  try {
    const response = await env.AI.run(CHAT_MODEL, {
      messages,
      max_tokens: 500,
    })

    return (response as { response: string }).response
  } catch (err) {
    if (allowLocalFallback && String(err).includes('Binding AI needs to be run remotely')) {
      return LOCAL_AI_FALLBACK
    }

    throw err
  }
}

async function ensureSyncfyTables(env: Env): Promise<void> {
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
      last_rid TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      UNIQUE(email, syncfy_credential_id)
    )`
  ).run()

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

async function upsertLead(env: Env, email: string, name?: string, diagnosticData?: string): Promise<Lead> {
  await env.DB.prepare(
    `INSERT INTO leads (email, name, diagnostic_data, created_at)
     VALUES (?, ?, ?, datetime("now"))
     ON CONFLICT(email) DO UPDATE SET
       name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE leads.name END,
       diagnostic_data = CASE WHEN excluded.diagnostic_data <> '' THEN excluded.diagnostic_data ELSE leads.diagnostic_data END,
       updated_at = datetime("now")`
  )
    .bind(email, name?.trim() || '', diagnosticData || '')
    .run()

  const lead = await env.DB.prepare(`SELECT * FROM leads WHERE email = ?`)
    .bind(email)
    .first<Lead>()

  if (!lead) {
    throw new Error('Unable to load signup')
  }

  return lead
}

class SyncfyRequestError extends Error {
  status: number
  rid: string | null
  code: string | null
  responseBody: unknown

  constructor(
    message: string,
    options: { status: number; rid?: string | null; code?: string | null; responseBody?: unknown }
  ) {
    super(message)
    this.name = 'SyncfyRequestError'
    this.status = options.status
    this.rid = options.rid || null
    this.code = options.code || null
    this.responseBody = options.responseBody
  }
}

async function syncfyRequest<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  if (!env.SYNCFY_API_KEY) {
    throw new Error('SYNCFY_API_KEY is not configured')
  }

  const baseUrl = (env.SYNCFY_API_BASE_URL || DEFAULT_SYNCFY_BASE_URL).replace(/\/+$/, '')
  const requestPath = normalizeSyncfyRequestPath(path)
  const headers = new Headers(init.headers)
  const headerName = env.SYNCFY_AUTH_HEADER_NAME || 'Authorization'
  headers.set('Content-Type', 'application/json')
  headers.set(headerName, buildSyncfyAuthHeaderValue(env))

  const response = await fetch(`${baseUrl}${requestPath}`, {
    ...init,
    headers,
  })

  const text = await response.text()
  const data = parseJsonUnknown(text)
  const responseRecord = asRecord(data)

  if (!response.ok) {
    throw new SyncfyRequestError(`Syncfy ${response.status}: ${text || response.statusText}`, {
      status: response.status,
      rid: extractSyncfyRid(data),
      code: extractSyncfyCode(data),
      responseBody: data,
    })
  }

  if (responseRecord && 'status' in responseRecord && 'response' in responseRecord) {
    const wrapped = responseRecord as { status: boolean; message?: string | null; response: T }
    if (!wrapped.status) {
      throw new SyncfyRequestError(wrapped.message || 'Syncfy request failed', {
        status: response.status,
        rid: extractSyncfyRid(data),
        code: extractSyncfyCode(data),
        responseBody: data,
      })
    }

    return wrapped.response
  }

  return data as T
}

function buildSyncfyAuthHeaderValue(env: Env): string {
  const key = env.SYNCFY_API_KEY || ''

  if (env.SYNCFY_AUTH_HEADER_VALUE) {
    return env.SYNCFY_AUTH_HEADER_VALUE.replace('{api_key}', key)
  }

  if (env.SYNCFY_AUTH_HEADER_PREFIX !== undefined) {
    return env.SYNCFY_AUTH_HEADER_PREFIX ? `${env.SYNCFY_AUTH_HEADER_PREFIX} ${key}` : key
  }

  return `api_key api_key=${key}`
}

export function normalizeSyncfyRequestPath(path: string): string {
  let requestPath = path.trim()

  if (/^https?:\/\//i.test(requestPath)) {
    try {
      const endpointUrl = new URL(requestPath)
      requestPath = `${endpointUrl.pathname}${endpointUrl.search}`
    } catch {
      requestPath = path.trim()
    }
  }

  requestPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`
  return requestPath.startsWith('/v1/') ? requestPath.slice(3) : requestPath
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function parseJsonUnknown(text: string): unknown {
  if (!text) return {}

  try {
    return JSON.parse(text) as unknown
  } catch {
    return { raw: text }
  }
}

function stringFromUnknown(value: unknown, maxLength = 4096): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed.slice(0, maxLength) : null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).slice(0, maxLength)
  }

  return null
}

function collectSyncfyRecords(value: unknown, maxDepth = 4): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = []
  const seen = new Set<unknown>()

  const visit = (item: unknown, depth: number) => {
    if (depth > maxDepth || seen.has(item)) return
    seen.add(item)

    if (Array.isArray(item)) {
      for (const entry of item.slice(0, 10)) visit(entry, depth + 1)
      return
    }

    const record = asRecord(item)
    if (!record) return

    records.push(record)
    for (const key of ['response', 'data', 'payload', 'credential', 'credentials', 'user', 'site', 'extra']) {
      if (key in record) visit(record[key], depth + 1)
    }
  }

  visit(value, 0)
  return records
}

function firstSyncfyString(payload: unknown, keys: string[]): string | null {
  for (const record of collectSyncfyRecords(payload)) {
    for (const key of keys) {
      const value = stringFromUnknown(record[key])
      if (value) return value
    }
  }

  return null
}

function extractSyncfyEventType(payload: unknown): string {
  const direct = firstSyncfyString(payload, ['event_type', 'event', 'webhook_event', 'type'])
  return direct || 'syncfy.webhook'
}

function extractSyncfyRid(payload: unknown): string | null {
  return firstSyncfyString(payload, ['rid', 'request_id', 'requestId', 'id_request'])
}

function extractSyncfyCode(payload: unknown): string | null {
  return firstSyncfyString(payload, ['code', 'error_code', 'errorCode', 'status_code', 'statusCode'])
}

function extractSyncfyCredentialPayload(payload: unknown): SyncfyCredentialPayload {
  return {
    syncfyUserId: firstSyncfyString(payload, ['id_user', 'user_id', 'idUser', 'syncfy_user_id']),
    syncfyCredentialId: firstSyncfyString(payload, [
      'id_credential',
      'credential_id',
      'idCredential',
      'syncfy_credential_id',
    ]),
    syncfySiteId: firstSyncfyString(payload, ['id_site', 'site_id', 'idSite', 'syncfy_site_id']),
    siteName: firstSyncfyString(payload, ['site_name', 'siteName', 'name_site', 'siteNameDisplay']),
    status: firstSyncfyString(payload, ['status', 'credential_status', 'status_code', 'statusCode']),
    rid: extractSyncfyRid(payload),
  }
}

function isSyncfyRefreshEvent(eventType: string): boolean {
  const normalized = eventType.toLowerCase()
  return normalized === 'refresh' || normalized.includes('credentials.refresh') || normalized.includes('credential.refresh')
}

function isSyncfySuccessfulStatus(status: string | null): boolean {
  if (!status) return true
  return /success|successful|active|ok|valid|synced|refreshed/i.test(status)
}

async function findEmailBySyncfyUserId(env: Env, syncfyUserId: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT email FROM syncfy_users WHERE syncfy_user_id = ?`)
    .bind(syncfyUserId)
    .first<{ email: string }>()

  return row?.email || null
}

async function storeSyncfyCredential(
  env: Env,
  payload: unknown,
  eventType: string,
  fallbackEmail?: string | null
): Promise<SyncfyCredentialRow | null> {
  const credential = extractSyncfyCredentialPayload(payload)
  if (!credential.syncfyUserId || !credential.syncfyCredentialId) return null

  const email = fallbackEmail || await findEmailBySyncfyUserId(env, credential.syncfyUserId)
  if (!email) return null

  const now = new Date().toISOString()
  const successfulSyncAt = isSyncfyRefreshEvent(eventType) && isSyncfySuccessfulStatus(credential.status) ? now : null

  await env.DB.prepare(
    `INSERT INTO syncfy_credentials (
      id, email, syncfy_user_id, syncfy_credential_id, syncfy_site_id, site_name, status,
      last_successful_sync_at, last_pull_at, last_rid, raw_json, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))
     ON CONFLICT(email, syncfy_credential_id) DO UPDATE SET
       syncfy_user_id = excluded.syncfy_user_id,
       syncfy_site_id = COALESCE(excluded.syncfy_site_id, syncfy_credentials.syncfy_site_id),
       site_name = COALESCE(excluded.site_name, syncfy_credentials.site_name),
       status = COALESCE(excluded.status, syncfy_credentials.status),
       last_successful_sync_at = COALESCE(excluded.last_successful_sync_at, syncfy_credentials.last_successful_sync_at),
       last_pull_at = COALESCE(excluded.last_pull_at, syncfy_credentials.last_pull_at),
       last_rid = COALESCE(excluded.last_rid, syncfy_credentials.last_rid),
       raw_json = excluded.raw_json,
       updated_at = datetime("now")`
  )
    .bind(
      crypto.randomUUID(),
      email,
      credential.syncfyUserId,
      credential.syncfyCredentialId,
      credential.syncfySiteId,
      credential.siteName,
      credential.status,
      successfulSyncAt,
      isSyncfyRefreshEvent(eventType) ? now : null,
      credential.rid,
      JSON.stringify(payload)
    )
    .run()

  return env.DB.prepare(`SELECT * FROM syncfy_credentials WHERE email = ? AND syncfy_credential_id = ?`)
    .bind(email, credential.syncfyCredentialId)
    .first<SyncfyCredentialRow>()
}

function getSyncfyWebhookEndpointPaths(payload: unknown, key: 'accounts' | 'credential' | 'transactions'): string[] {
  for (const record of collectSyncfyRecords(payload, 2)) {
    const endpoints = asRecord(record.endpoints)
    const values = endpoints?.[key]
    if (Array.isArray(values)) {
      return values
        .map((value) => stringFromUnknown(value, 2048))
        .filter((value): value is string => Boolean(value))
        .slice(0, 20)
    }
  }

  return []
}

function buildSyncfyTransactionsPath(credentialId: string, skip = 0): string {
  const params = new URLSearchParams({
    id_credential: credentialId,
    limit: String(SYNCFY_DEFAULT_TRANSACTION_LIMIT),
    skip: String(skip),
  })
  return `/transactions?${params.toString()}`
}

function getSyncfyCredentialCooldownSeconds(credential: SyncfyCredentialRow): number {
  if (!credential.last_pull_at) return 0

  const lastPullMs = Date.parse(credential.last_pull_at)
  if (!Number.isFinite(lastPullMs)) return 0

  const elapsedSeconds = Math.floor((Date.now() - lastPullMs) / 1000)
  return Math.max(SYNCFY_REFRESH_COOLDOWN_SECONDS - elapsedSeconds, 0)
}

function syncfyCredentialToApi(credential: SyncfyCredentialRow): SyncfyCredentialsResponse['credentials'][number] {
  const cooldownSeconds = getSyncfyCredentialCooldownSeconds(credential)

  return {
    id: credential.id,
    syncfyCredentialId: credential.syncfy_credential_id,
    siteName: credential.site_name,
    status: credential.status,
    lastSuccessfulSyncAt: credential.last_successful_sync_at,
    lastPullAt: credential.last_pull_at,
    cooldownSeconds,
    ready: cooldownSeconds === 0,
  }
}

async function loadSyncfyCredentialsForEmail(env: Env, email: string): Promise<SyncfyCredentialRow[]> {
  await ensureSyncfyTables(env)

  const result = await env.DB.prepare(
    `SELECT * FROM syncfy_credentials
     WHERE email = ?
     ORDER BY updated_at DESC, created_at DESC`
  )
    .bind(email)
    .all<SyncfyCredentialRow>()

  return result.results
}

async function storeSyncfyWebhookEvent(env: Env, payload: unknown): Promise<SyncfyWebhookEventRow> {
  const eventType = extractSyncfyEventType(payload)
  const credential = extractSyncfyCredentialPayload(payload)
  const id = crypto.randomUUID()

  await env.DB.prepare(
    `INSERT INTO syncfy_webhook_events (
      id, event_type, syncfy_user_id, syncfy_credential_id, rid, payload_json, processed_at, created_at
    )
     VALUES (?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`
  )
    .bind(
      id,
      eventType,
      credential.syncfyUserId,
      credential.syncfyCredentialId,
      credential.rid,
      JSON.stringify(payload)
    )
    .run()

  const event = await env.DB.prepare(`SELECT id, event_type, syncfy_user_id, syncfy_credential_id, rid, processed_at, created_at FROM syncfy_webhook_events WHERE id = ?`)
    .bind(id)
    .first<SyncfyWebhookEventRow>()

  if (!event) {
    throw new Error('Unable to store Syncfy webhook event')
  }

  return event
}

async function storeSyncfyError(
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

function buildSyncfyUserMessage(error: SyncfyRequestError): string {
  if (error.status === 429) {
    return 'Syncfy esta limitando nuevas sincronizaciones. Intenta de nuevo en unos minutos.'
  }

  if (error.status === 401 || error.status === 403) {
    return 'No pudimos autenticar la conexion con Syncfy. El equipo debe revisar la configuracion.'
  }

  if (error.status >= 500) {
    return 'Syncfy no respondio correctamente. Intenta de nuevo mas tarde.'
  }

  return 'No pudimos completar la conexion bancaria. Revisa los datos o intenta otra vez.'
}

function getSyncfySecretFromRequest(request: Request): string | null {
  const headerSecret = request.headers.get('x-finovai-webhook-secret') || request.headers.get('x-syncfy-webhook-secret')
  if (headerSecret) return headerSecret

  const auth = request.headers.get('authorization')
  const match = auth?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

async function timingSafeStringEqual(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const left = new Uint8Array(actualHash)
  const right = new Uint8Array(expectedHash)
  let mismatch = 0

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index]
  }

  return mismatch === 0
}

async function verifySyncfySecret(request: Request, env: Env): Promise<boolean> {
  if (!env.SYNCFY_WEBHOOK_SECRET) return false

  const suppliedSecret = getSyncfySecretFromRequest(request)
  if (!suppliedSecret) return false

  return timingSafeStringEqual(suppliedSecret, env.SYNCFY_WEBHOOK_SECRET)
}

async function getOrCreateSyncfyUser(env: Env, email: string, name?: string): Promise<SyncfyUserRow> {
  await ensureSyncfyTables(env)

  const existing = await env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
    .bind(email)
    .first<SyncfyUserRow>()

  if (existing) return existing

  const syncfyExternalId = buildSyncfyExternalId(email)
  let syncfyUserId = `local_${email.replace(/[^a-z0-9]/gi, '_')}`
  let mode: 'live' | 'local' = 'local'

  if (env.SYNCFY_API_KEY) {
    const createdUser = await syncfyRequest<{ id_user: string }>(env, '/users', {
      method: 'POST',
      body: JSON.stringify({
        name: name?.trim() || email,
        id_external: syncfyExternalId,
      }),
    })

    syncfyUserId = createdUser.id_user
    mode = 'live'
  }

  await env.DB.prepare(
    `INSERT INTO syncfy_users (email, syncfy_user_id, syncfy_external_id, name, mode, created_at)
     VALUES (?, ?, ?, ?, ?, datetime("now"))`
  )
    .bind(email, syncfyUserId, syncfyExternalId, name?.trim() || '', mode)
    .run()

  const created = await env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
    .bind(email)
    .first<SyncfyUserRow>()

  if (!created) {
    throw new Error('Unable to create Syncfy user')
  }

  return created
}

async function createSyncfyWidgetSession(env: Env, syncfyUser: SyncfyUserRow): Promise<{ token: string | null; mode: 'live' | 'local' }> {
  if (!env.SYNCFY_API_KEY || syncfyUser.mode === 'local') {
    return { token: null, mode: 'local' }
  }

  const session = await syncfyRequest<{ token: string }>(env, '/sessions', {
    method: 'POST',
    body: JSON.stringify({ id_user: syncfyUser.syncfy_user_id }),
  })

  await env.DB.prepare(
    `UPDATE syncfy_users SET last_session_at = datetime("now"), updated_at = datetime("now") WHERE email = ?`
  )
    .bind(syncfyUser.email)
    .run()

  return { token: session.token, mode: 'live' }
}

export function getPrometeoMode(baseUrl = DEFAULT_PROMETEO_BASE_URL): 'sandbox' | 'live' {
  return baseUrl.includes('sandbox') ? 'sandbox' : 'live'
}

async function prometeoRequest<T>(env: Env, path: string, init: RequestInit = {}, sessionKey?: string): Promise<T> {
  if (!env.PROMETEO_API_KEY && !env.PROMETEO_PROXY_URL) {
    throw new Error('PROMETEO_API_KEY is not configured')
  }

  const baseUrl = (env.PROMETEO_API_BASE_URL || DEFAULT_PROMETEO_BASE_URL).replace(/\/+$/, '')
  const requestPath = path.startsWith('/') ? path : `/${path}`
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('Accept-Language', 'es-MX,es;q=0.9,en;q=0.8')
  headers.set('User-Agent', 'FinovAI/1.0')
  if (sessionKey) {
    headers.set('X-Session-Key', sessionKey)
  }

  let response: Response
  if (env.PROMETEO_PROXY_URL) {
    response = await fetch(env.PROMETEO_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: requestPath,
        method: init.method || 'GET',
        headers: Object.fromEntries(headers.entries()),
        body: typeof init.body === 'string' ? init.body : undefined,
      }),
    })
  } else {
    headers.set('X-API-Key', env.PROMETEO_API_KEY || '')
    response = await fetch(`${baseUrl}${requestPath}`, {
      ...init,
      headers,
    })
  }
  const text = await response.text()
  const data = parseJsonObject(text)
  const status = typeof data.status === 'string' ? data.status : undefined

  if (!response.ok || status === 'error' || status === 'invalid_params' || status === 'invalid_key') {
    const message = typeof data.message === 'string' ? data.message : text
    throw new Error(`Prometeo ${response.status}: ${message || 'request failed'}`)
  }

  return data as T
}

async function loginToPrometeo(env: Env, provider: string, username: string, password: string): Promise<string> {
  const body = new URLSearchParams({
    provider,
    username,
    password,
  })

  const response = await prometeoRequest<PrometeoLoginResponse>(env, '/login/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  const token = response.key || response.body?.key

  if (!token) {
    throw new Error(response.message || 'Prometeo did not return a session key')
  }

  return token
}

async function getPrometeoAccounts(env: Env, sessionKey: string): Promise<PrometeoAccount[]> {
  const response = await prometeoRequest<PrometeoListResponse<PrometeoAccount>>(env, '/account/', {
    method: 'GET',
  }, sessionKey)

  return extractPrometeoList(response, 'accounts')
}

async function getPrometeoMovements(
  env: Env,
  sessionKey: string,
  account: PrometeoAccount,
  dateStart: string,
  dateEnd: string
): Promise<PrometeoMovement[]> {
  if (!account.number || !account.currency) {
    return []
  }

  const params = new URLSearchParams({
    account: account.number,
    currency: account.currency,
    date_start: dateStart,
    date_end: dateEnd,
  })
  const response = await prometeoRequest<PrometeoListResponse<PrometeoMovement>>(env, `/movement/?${params.toString()}`, {
    method: 'GET',
  }, sessionKey)

  return extractPrometeoList(response, 'movements')
}

function extractPrometeoList<T>(response: PrometeoListResponse<T>, key: 'accounts' | 'movements'): T[] {
  return response[key] || response.body?.[key] || response.data || response.body?.data || []
}

function parseJsonObject(text: string): Record<string, unknown> {
  if (!text) return {}

  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string' || !value.trim()) return 0

  const normalized = value.replace(/,/g, '').trim()
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : 0
}

export function normalizePrometeoDate(date: unknown): string {
  if (typeof date !== 'string') return new Date().toISOString().slice(0, 10)

  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return date

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

export function normalizePrometeoQueryDate(date: unknown, fallback: string): string {
  if (typeof date !== 'string' || !date.trim()) return fallback

  const trimmed = date.trim()
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${day}/${month}/${year}`
  }

  return /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed) ? trimmed : fallback
}

export function inferExpenseCategory(description: string): string {
  const value = description.toUpperCase()

  if (/(NETFLIX|SPOTIFY|APPLE|GOOGLE|PRIME|DISNEY|HBO)/.test(value)) return 'Suscripciones'
  if (/(UBER|DIDI|TAXI|CABIFY|METRO|TRANSPORTE|GASOLINA|PEMEX)/.test(value)) return 'Transporte'
  if (/(SUPERMERCADO|WALMART|CHEDRAUI|COMER|COSTCO|SORIAN|OXXO|MERCADO)/.test(value)) return 'Supermercado'
  if (/(RESTAUR|CAFE|STARBUCKS|COMIDA|RAPPI|UBER EATS)/.test(value)) return 'Comida fuera'
  if (/(FARMACIA|HOSPITAL|MEDIC|SALUD)/.test(value)) return 'Salud'
  if (/(RENTA|ARREND|HIPOTECA|LUZ|CFE|AGUA|TELCEL|INTERNET)/.test(value)) return 'Hogar'

  return 'Sin categoría'
}

function inferMerchant(description: string): string {
  const cleaned = description
    .replace(/\s+/g, ' ')
    .replace(/[.*_#-]+/g, ' ')
    .trim()

  if (!cleaned) return 'Prometeo'

  return cleaned.split(' ').slice(0, 3).join(' ')
}

export function normalizePrometeoMovement(movement: PrometeoMovement, account: PrometeoAccount = {}): Expense {
  const description = movement.detail || movement.reference || 'Movimiento Prometeo'
  const debit = parseAmount(movement.debit)
  const credit = parseAmount(movement.credit)
  const isDebit = debit > 0

  return {
    id: movement.id || movement.reference || `${account.number || 'account'}-${description}-${movement.date || Date.now()}`,
    date: normalizePrometeoDate(movement.date),
    description,
    amount: isDebit ? debit : -credit,
    category: isDebit ? inferExpenseCategory(description) : 'Ingreso',
    merchant: inferMerchant(description),
    accountName: account.name,
    accountNumber: account.number,
    accountCurrency: account.currency,
    type: isDebit ? 'debit' : 'credit',
  }
}

function expensesResponse(source: 'sample' | 'syncfy' | 'prometeo', email: string, expenses: Expense[]) {
  return {
    success: true,
    email,
    source,
    summary: summarizeExpenses(expenses),
    expenses,
    message:
      source === 'sample'
        ? 'Sample data shown until Syncfy transaction endpoint details are configured.'
        : source === 'prometeo'
          ? 'Transactions loaded from Prometeo.'
        : 'Transactions loaded from Syncfy.',
  }
}

function financeTransactionToExpense(transaction: FinanceTransaction): Expense {
  return {
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    amount: transaction.type === 'income' ? -transaction.amount : transaction.amount,
    category: transaction.category,
    merchant: transaction.merchant || transaction.description,
    accountCurrency: transaction.currency,
    type: transaction.type === 'income' ? 'credit' : 'debit',
  }
}

export function extractSyncfyTransactions(response: unknown): unknown[] {
  const directArray = Array.isArray(response) ? response : null
  if (directArray) return directArray.filter((item) => asRecord(item))

  for (const record of collectSyncfyRecords(response)) {
    for (const key of ['transactions', 'items', 'results', 'data', 'response']) {
      const value = record[key]
      if (Array.isArray(value)) {
        const transactions = value.filter((item) => asRecord(item))
        if (transactions.length > 0) return transactions
      }
    }
  }

  const record = asRecord(response)
  return record && firstSyncfyString(record, ['id_transaction', 'transaction_id', 'id']) ? [record] : []
}

function firstSyncfyNumber(payload: unknown, keys: string[]): number | null {
  for (const record of collectSyncfyRecords(payload, 1)) {
    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string' && value.trim()) {
        const parsed = normalizeFinancialAmount(value)
        if (parsed !== 0) return parsed
      }
    }
  }

  return null
}

function normalizeSyncfyDate(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000
    return new Date(milliseconds).toISOString().slice(0, 10)
  }

  if (typeof value === 'string' && /^\d{10,13}$/.test(value.trim())) {
    const numeric = Number(value.trim())
    if (Number.isFinite(numeric)) return normalizeSyncfyDate(numeric)
  }

  return normalizeFinancialDate(value)
}

export function normalizeSyncfyTransaction(raw: unknown, credentialId: string | null, index: number): NormalizedSyncfyTransaction | null {
  const record = asRecord(raw)
  if (!record) return null

  const externalId = firstSyncfyString(record, ['id_transaction', 'transaction_id', 'id_movement', 'id'])
  const date = normalizeSyncfyDate(
    record.dt_transaction ||
    record.dt_posted ||
    record.dt_refresh ||
    record.date ||
    record.datetime ||
    record.created_at
  )
  const description = cleanText(
    firstSyncfyString(record, ['description', 'name', 'reference', 'concept', 'memo', 'details']) ||
    'Movimiento Syncfy'
  )
  const merchant = cleanText(
    firstSyncfyString(record, ['merchant', 'merchant_name', 'commerce', 'counterparty', 'description']) ||
    inferFinanceMerchant(description)
  )
  const charge = firstSyncfyNumber(record, ['charge', 'debit', 'withdrawal', 'expense'])
  const deposit = firstSyncfyNumber(record, ['deposit', 'credit', 'income'])
  const rawAmount = firstSyncfyNumber(record, ['amount', 'amount_original', 'transaction_amount', 'total'])
  const amountSource = charge !== null ? charge : deposit !== null ? deposit : rawAmount
  if (!date || amountSource === null || amountSource === 0) return null

  const typeText = normalizeCategoryInput(firstSyncfyString(record, ['type', 'transaction_type', 'movement_type']) || '')
  const type: FinanceTransactionType =
    deposit !== null || /CREDIT|DEPOSIT|INCOME|ABONO|INGRESO/.test(typeText)
      ? 'income'
      : 'expense'
  const currency = (firstSyncfyString(record, ['currency', 'currency_code', 'id_currency']) || DEFAULT_FINANCE_CURRENCY).toUpperCase().slice(0, 8)
  const category = resolveFinanceCategory(
    cleanText(firstSyncfyString(record, ['category', 'category_name', 'subcategory'])) || (type === 'income' ? 'Otro ingreso' : 'Otro'),
    description,
    merchant,
    type,
    'syncfy'
  )
  const stableId = externalId || `${credentialId || 'credential'}-${date}-${amountSource}-${description}-${index}`

  return {
    id: `syncfy:${stableId}`.slice(0, 512),
    date,
    type,
    amount: Math.abs(roundMoney(amountSource)),
    currency,
    category,
    description: description || 'Movimiento Syncfy',
    merchant: merchant || 'Syncfy',
    raw,
  }
}

async function upsertSyncfyFinanceTransaction(
  env: Env,
  email: string,
  transaction: NormalizedSyncfyTransaction
): Promise<boolean> {
  await upsertFinancialProfile(env, email)

  await env.DB.prepare(
    `INSERT INTO transactions (
      id, email, date, type, amount, currency, category, description, merchant, notes,
      source, confidence, raw_source, cartola_import_id, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'syncfy', 0.9, ?, NULL, datetime("now"), datetime("now"))
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       date = excluded.date,
       type = excluded.type,
       amount = excluded.amount,
       currency = excluded.currency,
       category = excluded.category,
       description = excluded.description,
       merchant = excluded.merchant,
       raw_source = excluded.raw_source,
       updated_at = datetime("now")`
  )
    .bind(
      transaction.id,
      email,
      transaction.date,
      transaction.type,
      transaction.amount,
      transaction.currency,
      transaction.category,
      transaction.description,
      transaction.merchant,
      JSON.stringify(transaction.raw)
    )
    .run()

  return true
}

async function importSyncfyTransactionsFromEndpoints(
  env: Env,
  email: string,
  credentialId: string | null,
  endpoints: string[]
): Promise<SyncfyTransactionImportResult> {
  await ensureSyncfyTables(env)
  await ensureFinanceTables(env)

  let fetched = 0
  let imported = 0
  let skipped = 0

  for (const endpoint of endpoints.slice(0, 20)) {
    const response = await syncfyRequest<unknown>(env, endpoint, { method: 'GET' })
    const transactions = extractSyncfyTransactions(response)
    fetched += transactions.length

    for (const [index, rawTransaction] of transactions.entries()) {
      const normalized = normalizeSyncfyTransaction(rawTransaction, credentialId, index)
      if (!normalized) {
        skipped += 1
        continue
      }

      await upsertSyncfyFinanceTransaction(env, email, normalized)
      imported += 1
    }
  }

  return { credentialId, fetched, imported, skipped, endpoints }
}

async function importSyncfyTransactionsForCredential(
  env: Env,
  email: string,
  credentialId: string
): Promise<SyncfyTransactionImportResult> {
  return importSyncfyTransactionsFromEndpoints(env, email, credentialId, [buildSyncfyTransactionsPath(credentialId)])
}

async function ensureFinanceTables(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS financial_profiles (
      email TEXT PRIMARY KEY,
      currency TEXT NOT NULL DEFAULT 'CLP',
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
      currency TEXT NOT NULL DEFAULT 'CLP',
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
    )`
  ).run()

  await migrateTransactionsSourceConstraint(env)
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_transactions_email_date ON transactions(email, date DESC)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_transactions_email_source ON transactions(email, source)`).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cartola_imports_email_created ON cartola_imports(email, created_at DESC)`).run()
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
      source, confidence, raw_source, cartola_import_id, created_at, updated_at
    )
     SELECT id, email, date, type, amount, currency, category, description, merchant, notes,
      source, confidence, raw_source, cartola_import_id, created_at, updated_at
     FROM transactions_legacy_source_constraint`
  ).run()
  await env.DB.prepare(`DROP TABLE transactions_legacy_source_constraint`).run()
}

async function ensureHouseholdTables(env: Env): Promise<void> {
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

async function upsertFinancialProfile(env: Env, email: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO financial_profiles (email, currency, created_at)
     VALUES (?, ?, datetime("now"))
     ON CONFLICT(email) DO UPDATE SET updated_at = datetime("now")`
  )
    .bind(email, DEFAULT_FINANCE_CURRENCY)
    .run()
}

function householdInviteRowToApi(row: HouseholdInviteRow): HouseholdInvite {
  return {
    id: row.id,
    inviterEmail: row.inviter_email,
    inviteeEmail: row.invitee_email,
    status: row.status,
    created_at: row.created_at,
  }
}

async function loadHouseholdInvites(env: Env, email: string): Promise<HouseholdInvite[]> {
  await ensureHouseholdTables(env)
  await upsertFinancialProfile(env, email)

  const result = await env.DB.prepare(
    `SELECT * FROM household_invites
     WHERE inviter_email = ?
     ORDER BY created_at DESC`
  )
    .bind(email)
    .all<HouseholdInviteRow>()

  return result.results.map(householdInviteRowToApi)
}

async function upsertHouseholdInvite(env: Env, inviterEmail: string, inviteeEmail: string): Promise<HouseholdInvite> {
  await ensureHouseholdTables(env)
  await upsertFinancialProfile(env, inviterEmail)

  await env.DB.prepare(
    `INSERT INTO household_invites (id, inviter_email, invitee_email, status, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', datetime("now"), datetime("now"))
     ON CONFLICT(inviter_email, invitee_email) DO UPDATE SET
       status = 'pending',
       updated_at = datetime("now")`
  )
    .bind(crypto.randomUUID(), inviterEmail, inviteeEmail)
    .run()

  const row = await env.DB.prepare(
    `SELECT * FROM household_invites
     WHERE inviter_email = ? AND invitee_email = ?`
  )
    .bind(inviterEmail, inviteeEmail)
    .first<HouseholdInviteRow>()

  if (!row) {
    throw new Error('Unable to load household invite')
  }

  return householdInviteRowToApi(row)
}

function transactionRowToApi(row: FinanceTransactionRow): FinanceTransaction {
  return {
    id: row.id,
    email: row.email,
    date: row.date,
    type: row.type,
    amount: Number(row.amount),
    currency: row.currency,
    category: resolveFinanceCategory(row.category, row.description, row.merchant, row.type, row.source),
    description: row.description,
    merchant: row.merchant,
    notes: row.notes,
    source: row.source,
    confidence: Number(row.confidence),
    rawSource: row.raw_source,
    cartolaImportId: row.cartola_import_id,
    created_at: row.created_at,
  }
}

async function loadFinanceTransactions(env: Env, email: string): Promise<FinanceTransaction[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM transactions
     WHERE email = ?
     ORDER BY date DESC, created_at DESC`
  )
    .bind(email)
    .all<FinanceTransactionRow>()

  return result.results.map(transactionRowToApi)
}

async function getFinanceDashboard(env: Env, email: string) {
  await ensureFinanceTables(env)
  await upsertFinancialProfile(env, email)

  const transactions = await loadFinanceTransactions(env, email)
  const summary = buildFinancialSummary(transactions)
  const insights = buildFinancialInsights(summary, transactions)

  return {
    success: true,
    email,
    transactions,
    summary,
    insights,
  }
}

async function insertFinanceTransaction(
  env: Env,
  email: string,
  input: {
    date?: unknown
    type?: unknown
    amount?: unknown
    currency?: unknown
    category?: unknown
    description?: unknown
    merchant?: unknown
    notes?: unknown
  },
  source: FinanceTransactionSource,
  confidence = 1,
  rawSource: string | null = null,
  cartolaImportId: string | null = null
): Promise<FinanceTransaction> {
  const date = normalizeFinancialDate(input.date)
  const type = input.type === 'income' ? 'income' : 'expense'
  const amount = Math.abs(normalizeFinancialAmount(input.amount))
  const currency = typeof input.currency === 'string' && input.currency.trim()
    ? input.currency.trim().toUpperCase().slice(0, 8)
    : DEFAULT_FINANCE_CURRENCY
  const description = cleanText(input.description) || (type === 'income' ? 'Ingreso manual' : 'Gasto manual')
  const merchant = cleanText(input.merchant) || inferFinanceMerchant(description)
  const category = resolveFinanceCategory(cleanText(input.category), description, merchant, type, source)
  const notes = cleanText(input.notes)

  if (!date) {
    throw new Error('Fecha invalida')
  }
  if (amount <= 0) {
    throw new Error('Monto invalido')
  }
  if (!category) {
    throw new Error('Categoria invalida')
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO transactions (
      id, email, date, type, amount, currency, category, description, merchant, notes,
      source, confidence, raw_source, cartola_import_id, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`
  )
    .bind(
      id,
      email,
      date,
      type,
      roundMoney(amount),
      currency,
      category,
      description,
      merchant || null,
      notes || null,
      source,
      clampConfidence(confidence),
      rawSource,
      cartolaImportId
    )
    .run()

  const created = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND email = ?`)
    .bind(id, email)
    .first<FinanceTransactionRow>()

  if (!created) {
    throw new Error('Unable to load transaction')
  }

  return transactionRowToApi(created)
}

export function normalizeFinancialAmount(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? roundMoney(value) : 0
  }
  if (typeof value !== 'string') return 0

  let text = value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .trim()

  if (!text) return 0

  const isNegative = text.includes('-') || /^\(.*\)$/.test(text)
  text = text
    .replace(/[()]/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(/-/g, '')

  if (!text) return 0

  const hasComma = text.includes(',')
  const hasDot = text.includes('.')

  if (hasComma && hasDot) {
    const lastComma = text.lastIndexOf(',')
    const lastDot = text.lastIndexOf('.')
    text = lastComma > lastDot
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '')
  } else if (hasComma) {
    text = normalizeSingleSeparatorAmount(text, ',')
  } else if (hasDot) {
    text = normalizeSingleSeparatorAmount(text, '.')
  }

  const amount = Number(text)
  if (!Number.isFinite(amount)) return 0

  return roundMoney(isNegative ? -amount : amount)
}

function normalizeSingleSeparatorAmount(value: string, separator: ',' | '.') {
  const parts = value.split(separator)
  if (parts.length === 1) return value

  const fraction = parts.at(-1) || ''
  if (parts.length === 2 && fraction.length > 0 && fraction.length <= 2) {
    return value.replace(separator, '.')
  }

  return parts.join('')
}

export function normalizeFinancialDate(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null

  const trimmed = String(value).trim().replace(/\s+/g, ' ')
  if (!trimmed) return null

  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (isoMatch) {
    return buildIsoDate(isoMatch[1], isoMatch[2], isoMatch[3])
  }

  const dayFirstMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (dayFirstMatch) {
    const year = normalizeYear(dayFirstMatch[3])
    return buildIsoDate(year, dayFirstMatch[2], dayFirstMatch[1])
  }

  const namedMonthMatch = normalizeHeader(trimmed).match(/^(\d{1,2})_([a-z]+)_(\d{2,4})$/)
  if (namedMonthMatch) {
    const month = MONTH_NAMES[namedMonthMatch[2]]
    if (month) {
      return buildIsoDate(normalizeYear(namedMonthMatch[3]), month, namedMonthMatch[1])
    }
  }

  return null
}

function normalizeYear(value: string) {
  return value.length === 2 ? `20${value}` : value
}

function buildIsoDate(year: string, month: string, day: string): string | null {
  const normalized = `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  const date = new Date(`${normalized}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  if (date.toISOString().slice(0, 10) !== normalized) return null
  return normalized
}

export function parseCsvCartola(content: string): CartolaDraftRow[] {
  return mapCartolaTableRows(parseDelimitedRows(content))
}

export function parseXlsxCartola(buffer: ArrayBuffer): CartolaDraftRow[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  })

  return mapCartolaTableRows(rows)
}

export async function parsePdfCartola(buffer: ArrayBuffer): Promise<CartolaDraftRow[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return parsePdfCartolaText(text)
}

export function parsePdfCartolaText(text: string): CartolaDraftRow[] {
  const bbvaMexicoRows = parseBbvaMexicoCartolaText(text)
  if (bbvaMexicoRows.length > 0) return bbvaMexicoRows

  const rows: CartolaDraftRow[] = []
  const lines = text
    .replace(/\u00a0/g, ' ')
    .replace(/(\s+)(\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b|\d{1,2}\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,12}\s+\d{2,4}\b)/g, '\n$2')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 10)

  for (const line of lines) {
    if (rows.length >= MAX_CARTOLA_ROWS) break

    const dateMatch = line.match(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b|\b\d{1,2}\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,12}\s+\d{2,4}\b/)
    if (!dateMatch) continue

    const date = normalizeFinancialDate(dateMatch[0])
    if (!date) continue

    const withoutDate = `${line.slice(0, dateMatch.index)} ${line.slice((dateMatch.index || 0) + dateMatch[0].length)}`.trim()
    const amountMatches = [...withoutDate.matchAll(/(?:[-(]?\$?\s*\d[\d.,]*\)?)/g)]
      .filter((match) => Math.abs(normalizeFinancialAmount(match[0])) > 0)
    if (amountMatches.length === 0) continue

    const signedMatch = amountMatches.find((match) => /[-()]/.test(match[0]))
    const amountMatch = signedMatch || amountMatches.at(-1)
    if (!amountMatch) continue

    const rawAmount = amountMatch[0]
    const amount = Math.abs(normalizeFinancialAmount(rawAmount))
    if (amount <= 0) continue

    const amountIndex = amountMatch.index || 0
    const description = withoutDate
      .slice(0, amountIndex)
      .replace(/^\d+\s*/, '')
      .trim() || withoutDate.replace(rawAmount, '').trim() || 'Movimiento importado'
    const type = inferCartolaType('', rawAmount, line)
    const confidence = amountMatches.length > 1 ? 0.55 : 0.68

    rows.push({
      id: crypto.randomUUID(),
      date,
      type,
      amount: roundMoney(amount),
      currency: DEFAULT_FINANCE_CURRENCY,
      category: inferFinanceCategory(description, type),
      description,
      merchant: inferFinanceMerchant(description),
      confidence,
      rawSource: line,
    })
  }

  return rows
}

interface BbvaStatementPeriod {
  startYear: string
  startMonth: string
  endYear: string
  endMonth: string
}

function parseBbvaMexicoCartolaText(text: string): CartolaDraftRow[] {
  const normalizedText = text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!/BBVA MEXICO/i.test(normalizedText) || !/Detalle de Movimientos Realizados/i.test(normalizedText)) {
    return []
  }

  const movementsStart = normalizedText.indexOf('Detalle de Movimientos Realizados')
  const movementsEnd = normalizedText.indexOf('Total de Movimientos', movementsStart)
  if (movementsStart < 0 || movementsEnd <= movementsStart) return []

  const period = parseBbvaStatementPeriod(normalizedText)
  const movementText = normalizedText.slice(movementsStart, movementsEnd)
  const datePairPattern = /\b(\d{1,2}\/[A-ZÁÉÍÓÚ]{3})\s+(\d{1,2}\/[A-ZÁÉÍÓÚ]{3})\s+/gi
  const datePairs = [...movementText.matchAll(datePairPattern)]
  const rows: CartolaDraftRow[] = []

  for (let index = 0; index < datePairs.length && rows.length < MAX_CARTOLA_ROWS; index += 1) {
    const match = datePairs[index]
    const nextIndex = datePairs[index + 1]?.index ?? movementText.length
    const chunk = movementText.slice(match.index ?? 0, nextIndex).trim()
    const operationDate = normalizeBbvaShortDate(match[1], period)
    if (!operationDate) continue

    const body = chunk.slice(match[0].length).trim()
    const amountMatches = [...body.matchAll(/\b\d{1,3}(?:,\d{3})*\.\d{2}\b|\b\d+\.\d{2}\b/g)]
      .filter((amountMatch) => normalizeFinancialAmount(amountMatch[0]) > 0)
    const amountMatch = amountMatches[0]
    if (!amountMatch) continue

    const rawAmount = amountMatch[0]
    const amount = normalizeFinancialAmount(rawAmount)
    if (amount <= 0) continue

    const description = body.slice(0, amountMatch.index).trim() || 'Movimiento BBVA'
    const type = inferBbvaMovementType(description, amountMatches)

    rows.push({
      id: crypto.randomUUID(),
      date: operationDate,
      type,
      amount: roundMoney(amount),
      currency: 'MXN',
      category: inferFinanceCategory(description, type),
      description,
      merchant: inferFinanceMerchant(description),
      confidence: 0.9,
      rawSource: chunk,
    })
  }

  return rows
}

function parseBbvaStatementPeriod(text: string): BbvaStatementPeriod | null {
  const match = text.match(/Periodo\s+DEL\s+\d{1,2}\/(\d{1,2})\/(\d{4})\s+AL\s+\d{1,2}\/(\d{1,2})\/(\d{4})/i)
  if (!match) return null

  return {
    startMonth: match[1].padStart(2, '0'),
    startYear: match[2],
    endMonth: match[3].padStart(2, '0'),
    endYear: match[4],
  }
}

function normalizeBbvaShortDate(value: string, period: BbvaStatementPeriod | null): string | null {
  const match = value.match(/^(\d{1,2})\/([A-ZÁÉÍÓÚ]{3})$/i)
  if (!match) return null

  const month = MONTH_NAMES[normalizeHeader(match[2])]
  if (!month) return null

  let year = period?.endYear || new Date().getUTCFullYear().toString()
  if (period && period.startYear !== period.endYear) {
    year = Number(month) >= Number(period.startMonth) ? period.startYear : period.endYear
  }

  return buildIsoDate(year, month, match[1])
}

function inferBbvaMovementType(description: string, amountMatches: RegExpMatchArray[]): FinanceTransactionType {
  const value = description.toUpperCase()

  if (/(RECIBIDO|DEVUELTO|COMPENSACION|COMPENSACIÓN|ABONO|DEPOSITO|DEPÓSITO)/.test(value)) {
    return 'income'
  }

  if (/^PAGO CUENTA DE TERCERO\b/.test(value) && amountMatches.length >= 3) {
    return 'income'
  }

  return inferCartolaType('', '', description)
}

function parseDelimitedRows(content: string): string[][] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  const delimiter = detectDelimiter(lines)
  return lines.map((line) => splitDelimitedLine(line, delimiter))
}

function detectDelimiter(lines: string[]) {
  const sample = lines.slice(0, 8).join('\n')
  const candidates = [',', ';', '\t', '|']

  return candidates
    .map((delimiter) => ({
      delimiter,
      count: (sample.match(new RegExp(delimiter === '\t' ? '\t' : `\\${delimiter}`, 'g')) || []).length,
    }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ','
}

function splitDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"' && nextChar === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function mapCartolaTableRows(rows: string[][]): CartolaDraftRow[] {
  const headerIndex = rows.findIndex((row) => looksLikeCartolaHeader(row))
  if (headerIndex < 0) return []

  const headers = rows[headerIndex].map(normalizeHeader)
  const dataRows = rows.slice(headerIndex + 1)
  const drafts: CartolaDraftRow[] = []

  for (const row of dataRows) {
    if (drafts.length >= MAX_CARTOLA_ROWS) break
    const draft = cartolaDraftFromRow(headers, row)
    if (draft) drafts.push(draft)
  }

  return drafts
}

function looksLikeCartolaHeader(row: string[]) {
  const headers = row.map(normalizeHeader)
  const hasDate = headers.some((header) => ['fecha', 'date', 'fec_movimiento', 'fecha_movimiento'].some((key) => header.includes(key)))
  const hasAmount = headers.some((header) => [
    'monto',
    'amount',
    'importe',
    'valor',
    'cargo',
    'abono',
    'debe',
    'haber',
    'debito',
    'credito',
  ].some((key) => header.includes(key)))

  return hasDate && hasAmount
}

function cartolaDraftFromRow(headers: string[], row: string[]): CartolaDraftRow | null {
  const record = new Map<string, string>()
  headers.forEach((header, index) => record.set(header, row[index] || ''))

  const date = normalizeFinancialDate(findCartolaValue(record, ['fecha', 'date', 'fec_movimiento', 'fecha_movimiento']))
  const description = cleanText(findCartolaValue(record, [
    'descripcion',
    'description',
    'detalle',
    'glosa',
    'comercio',
    'merchant',
    'movimiento',
    'concepto',
  ]))
  const debit = Math.abs(normalizeFinancialAmount(findCartolaValue(record, ['cargo', 'cargos', 'debe', 'debito', 'debit', 'retiro', 'egreso'])))
  const credit = Math.abs(normalizeFinancialAmount(findCartolaValue(record, ['abono', 'abonos', 'haber', 'credito', 'credit', 'deposito', 'ingreso'])))
  const rawAmount = findCartolaValue(record, ['monto', 'amount', 'importe', 'valor'])
  const signedAmount = normalizeFinancialAmount(rawAmount)
  const rawType = findCartolaValue(record, ['tipo', 'type', 'movimiento_tipo']).toLowerCase()
  const categoryValue = cleanText(findCartolaValue(record, ['categoria', 'category', 'rubro']))

  let type: FinanceTransactionType = 'expense'
  let amount = debit

  if (credit > 0) {
    type = 'income'
    amount = credit
  } else if (debit > 0) {
    type = 'expense'
    amount = debit
  } else if (rawAmount) {
    type = inferCartolaType(rawType, rawAmount, description)
    amount = Math.abs(signedAmount)
  }

  if (!date || amount <= 0) return null

  const safeDescription = description || (type === 'income' ? 'Ingreso importado' : 'Gasto importado')
  const confidence = clampConfidence(
    0.9
      - (description ? 0 : 0.12)
      - (categoryValue ? 0 : 0.05)
      - (rawAmount && !rawType && debit === 0 && credit === 0 ? 0.08 : 0)
  )

  return {
    id: crypto.randomUUID(),
    date,
    type,
    amount: roundMoney(amount),
    currency: DEFAULT_FINANCE_CURRENCY,
    category: categoryValue || inferFinanceCategory(safeDescription, type),
    description: safeDescription,
    merchant: inferFinanceMerchant(safeDescription),
    confidence,
    rawSource: row.join(' | '),
  }
}

function findCartolaValue(record: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const directValue = record.get(key)
    if (directValue) return directValue

    const fuzzyKey = [...record.keys()].find((recordKey) => recordKey.includes(key))
    if (fuzzyKey && record.get(fuzzyKey)) return record.get(fuzzyKey) || ''
  }

  return ''
}

function inferCartolaType(rawType: string, rawAmount: string, description: string): FinanceTransactionType {
  const amount = normalizeFinancialAmount(rawAmount)
  if (amount < 0) return 'expense'

  const text = `${rawType} ${description}`.toUpperCase()
  if (/(ABONO|HABER|CREDITO|CRÉDITO|DEPOSITO|DEPÓSITO|SUELDO|NOMINA|NÓMINA|TRANSFERENCIA RECIBIDA|INGRESO)/.test(text)) {
    return 'income'
  }

  return 'expense'
}

function normalizeCategoryInput(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function isGenericFinanceCategory(category: string, type: FinanceTransactionType) {
  const normalized = normalizeCategoryInput(category).trim()
  if (!normalized) return true

  return type === 'income'
    ? normalized === 'OTRO INGRESO' || normalized === 'SIN CATEGORIA'
    : normalized === 'OTRO' || normalized === 'OTROS' || normalized === 'SIN CATEGORIA'
}

export function inferFinanceCategory(description: string, type: FinanceTransactionType) {
  if (type === 'income') {
    const incomeText = normalizeCategoryInput(description)
    if (/(SUELDO|NOMINA|REMUNERACION)/.test(incomeText)) return 'Sueldo'
    if (/(FREELANCE|HONORARIO|PROYECTO)/.test(incomeText)) return 'Freelance'
    if (/(REEMBOLSO|DEVOLUCION)/.test(incomeText)) return 'Reembolso'
    return 'Otro ingreso'
  }

  const value = normalizeCategoryInput(description)

  if (/(UBER EATS|DLO\*?UBER EATS|RAPPI|PEDIDOSYA|DELIVERY|RESTAUR|RESTA|REST |RESTMONARCH|PASTA|SUSHI|PESCAD|TAQU|CAFE|COFFEE|STARBUCKS|COMIDA|BAR )/.test(value)) return 'Comida fuera'
  if (/(NETFLIX|SPOTIFY|YOUTUBE|APPLE|GOOGLE|PRIME|DISNEY|HBO|OPENAI|MICROSOFT|ADOBE|ZOOM|SUBSCRIP|SUSCRIP)/.test(value)) return 'Suscripciones'
  if (/(AMERICAN EXPRESS|AMEX|PAGO TARJETA|TARJETA DE CREDITO|TDC|CREDITO 0*\d{3,})/.test(value)) return 'Deuda'
  if (/(SPEI ENVIADO|TRANSFERENCIA ENVIADA|PAGO CUENTA DE TERCERO|TRASPASO|STP|PAGO TERCERO)/.test(value)) return 'Transferencias'
  if (/(RETIRO CAJERO|RET CAJ|CAJERO AUTOMATICO|ATM)/.test(value)) return 'Retiros'
  if (/(UBER RIDE|UBER RIDES|DLO\*?TDA UBER RIDES|DLO\*?UBER RIDES|DIDI|TAXI|CABIFY|METRO|BENCINA|GASOLINA|COPEC|SHELL|PETROBRAS|TRANSPORTE|PEMEX)/.test(value)) return 'Transporte'
  if (/(SUPERMERCADO|JUMBO|LIDER|SANTA ISABEL|UNIMARC|TOTTUS|WALMART|WM EXPRESS|COSTCO|CHEDRAUI|OXXO|MERCADO)/.test(value)) return 'Supermercado'
  if (/(FARMACIA|HOSPITAL|CLINICA|MEDIC|SALUD|SOFIA)/.test(value)) return 'Salud'
  if (/(ARRIENDO|RENTA|DIVIDENDO|HIPOTECA|LUZ|AGUA|GAS|INTERNET|TELCO|HOGAR|CFE|TELCEL)/.test(value)) return 'Hogar'
  if (/(COLEGIO|UNIVERSIDAD|EDUCACION|CURSO)/.test(value)) return 'Educación'
  if (/(IMPUESTO|SAT|SII|TESORERIA)/.test(value)) return 'Impuestos'
  if (/(ONLYFANS|CINE|CINEMEX|CINEPOLIS|TICKETMASTER|PALACIO DEPORTES|AUDITORIO|TEATRO|CONCIERTO|EVENTO|JUEGO|GAMING)/.test(value)) return 'Ocio'
  if (/(AMAZON|MERCADOPAGO|MERPAGO|LIVERPOOL|PALACIO|SEARS|SHOP|STORE|TIENDA|STRIPE)/.test(value)) return 'Compras'

  return 'Otro'
}

function resolveFinanceCategory(
  storedCategory: string,
  description: string,
  merchant: string | null,
  type: FinanceTransactionType,
  source: FinanceTransactionSource
) {
  const category = cleanText(storedCategory)
  const inferredCategory = inferFinanceCategory(`${description} ${merchant || ''}`.trim(), type)

  if (!category) return inferredCategory
  if (source === 'cartola' && inferredCategory !== 'Otro' && inferredCategory !== 'Otro ingreso') return inferredCategory
  if (isGenericFinanceCategory(category, type)) return inferredCategory

  return category
}

function inferFinanceMerchant(description: string) {
  const cleaned = description
    .replace(/\s+/g, ' ')
    .replace(/[.*_#-]+/g, ' ')
    .trim()

  if (!cleaned) return ''
  return cleaned.split(' ').slice(0, 4).join(' ')
}

export function buildFinancialSummary(transactions: FinanceTransaction[]): FinanceSummary {
  const latestMonth = transactions
    .map((transaction) => transaction.date.slice(0, 7))
    .sort()
    .at(-1) || new Date().toISOString().slice(0, 7)
  const monthlyTransactions = transactions.filter((transaction) => transaction.date.startsWith(latestMonth))
  const categoryTotals = new Map<string, number>()
  const dailySpending = new Map<string, number>()
  let monthlyIncome = 0
  let monthlySpending = 0

  for (const transaction of monthlyTransactions) {
    if (transaction.type === 'income') {
      monthlyIncome += transaction.amount
      continue
    }

    monthlySpending += transaction.amount
    categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) || 0) + transaction.amount)
    dailySpending.set(transaction.date, (dailySpending.get(transaction.date) || 0) + transaction.amount)
  }

  const [topSpendingCategory = 'Sin datos', topSpendingCategoryAmount = 0] = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .at(0) || []
  const unusualHighSpendDay = getUnusualHighSpendDay(dailySpending)
  const recurringExpenses = getRecurringExpenses(transactions)
  const discretionaryTotal = [...categoryTotals.entries()].reduce((sum, [category, amount]) => {
    return DISCRETIONARY_CATEGORIES.has(category) ? sum + amount : sum
  }, 0)
  const recurringTotal = recurringExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  return {
    month: latestMonth,
    monthlyIncome: roundMoney(monthlyIncome),
    monthlySpending: roundMoney(monthlySpending),
    netBalance: roundMoney(monthlyIncome - monthlySpending),
    transactionCount: transactions.length,
    topSpendingCategory,
    topSpendingCategoryAmount: roundMoney(topSpendingCategoryAmount),
    unusualHighSpendDay,
    recurringExpenses,
    estimatedSavingsOpportunity: Math.round(discretionaryTotal * 0.1 + recurringTotal * 0.25),
  }
}

export function buildFinancialInsights(summary: FinanceSummary, transactions: FinanceTransaction[]): FinanceInsight[] {
  if (transactions.length === 0) {
    return [
      {
        id: 'empty',
        title: 'Sin señal todavía',
        value: '0 movimientos',
        body: 'Conecta una cuenta con Syncfy para generar insights reales.',
        tone: 'watch',
      },
    ]
  }

  const insights: FinanceInsight[] = [
    {
      id: 'net-balance',
      title: 'Balance mensual',
      value: formatFinanceCurrency(summary.netBalance),
      body: `Ingresos ${formatFinanceCurrency(summary.monthlyIncome)} menos gastos ${formatFinanceCurrency(summary.monthlySpending)}.`,
      tone: summary.netBalance >= 0 ? 'good' : 'urgent',
    },
  ]

  if (summary.topSpendingCategoryAmount > 0) {
    const share = summary.monthlySpending > 0
      ? Math.round((summary.topSpendingCategoryAmount / summary.monthlySpending) * 100)
      : 0
    insights.push({
      id: 'top-category',
      title: 'Mayor categoría',
      value: summary.topSpendingCategory,
      body: `${formatFinanceCurrency(summary.topSpendingCategoryAmount)} concentrados aquí (${share}% del gasto mensual).`,
      tone: share >= 35 ? 'urgent' : 'watch',
    })
  }

  if (summary.unusualHighSpendDay) {
    insights.push({
      id: 'unusual-day',
      title: 'Día atípico',
      value: summary.unusualHighSpendDay.date,
      body: `Ese día salieron ${formatFinanceCurrency(summary.unusualHighSpendDay.amount)}. Revisa si fue gasto puntual.`,
      tone: 'watch',
    })
  }

  if (summary.recurringExpenses.length > 0) {
    const topRecurring = summary.recurringExpenses[0]
    insights.push({
      id: 'recurring',
      title: 'Gasto recurrente',
      value: topRecurring.description,
      body: `${topRecurring.count} cargos similares, aprox. ${formatFinanceCurrency(topRecurring.amount)} cada vez.`,
      tone: 'watch',
    })
  }

  if (summary.estimatedSavingsOpportunity > 0) {
    insights.push({
      id: 'savings',
      title: 'Ahorro estimado',
      value: formatFinanceCurrency(summary.estimatedSavingsOpportunity),
      body: 'Estimado reduciendo 10% de gastos flexibles y 25% de cargos recurrentes revisables.',
      tone: 'good',
    })
  }

  return insights.slice(0, 5)
}

function getUnusualHighSpendDay(dailySpending: Map<string, number>) {
  const entries = [...dailySpending.entries()]
  if (entries.length === 0) return null

  const total = entries.reduce((sum, [, amount]) => sum + amount, 0)
  const average = total / entries.length
  const highest = entries.sort((a, b) => b[1] - a[1])[0]

  if (!highest || highest[1] <= 0) return null
  if (entries.length < 3) return { date: highest[0], amount: roundMoney(highest[1]) }

  return highest[1] >= average * 1.5
    ? { date: highest[0], amount: roundMoney(highest[1]) }
    : null
}

function getRecurringExpenses(transactions: FinanceTransaction[]) {
  const groups = new Map<string, FinanceTransaction[]>()

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    const key = normalizeRecurringKey(transaction.merchant || transaction.description)
    if (!key) continue
    groups.set(key, [...(groups.get(key) || []), transaction])
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      if (group.length < 2) return null

      const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))
      const amounts = sorted.map((transaction) => transaction.amount)
      const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
      const maxDelta = Math.max(...amounts.map((amount) => Math.abs(amount - average)))
      const stableAmounts = average > 0 && maxDelta / average <= 0.35
      const spansDays = daysBetween(sorted[0].date, sorted.at(-1)?.date || sorted[0].date) >= 15

      if (!stableAmounts || !spansDays) return null

      return {
        key,
        description: sorted[0].merchant || sorted[0].description,
        amount: roundMoney(average),
        count: sorted.length,
      }
    })
    .filter((expense): expense is { key: string; description: string; amount: number; count: number } => Boolean(expense))
    .sort((a, b) => b.amount * b.count - a.amount * a.count)
}

function normalizeRecurringKey(value: string) {
  return normalizeHeader(value)
    .replace(/\b\d+\b/g, '')
    .split('_')
    .filter(Boolean)
    .slice(0, 3)
    .join('_')
}

function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round(Math.abs(end - start) / 86_400_000)
}

function formatFinanceCurrency(value: number, currency = DEFAULT_FINANCE_CURRENCY) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(value)
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, roundMoney(value)))
}

function getCartolaFileType(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const mime = file.type.toLowerCase()

  if (extension === 'pdf' || mime.includes('pdf')) return 'pdf'
  if (extension === 'xlsx' || extension === 'xls' || mime.includes('spreadsheet') || mime.includes('excel')) return 'xlsx'
  if (extension === 'csv' || extension === 'tsv' || extension === 'txt' || mime.includes('csv') || mime.includes('text')) return 'csv'
  return ''
}

async function parseCartolaUpload(file: File): Promise<{ fileType: string; rows: CartolaDraftRow[] }> {
  if (file.size > MAX_CARTOLA_UPLOAD_BYTES) {
    throw new Error('Archivo demasiado grande. Usa un archivo de hasta 5 MB.')
  }

  const fileType = getCartolaFileType(file)
  if (!fileType) {
    throw new Error('Formato no soportado. Sube PDF, CSV o XLSX.')
  }

  const buffer = await file.arrayBuffer()
  let rows: CartolaDraftRow[]

  if (fileType === 'pdf') {
    rows = await parsePdfCartola(buffer)
  } else if (fileType === 'xlsx') {
    rows = parseXlsxCartola(buffer)
  } else {
    rows = parseCsvCartola(new TextDecoder().decode(buffer))
  }

  return {
    fileType,
    rows: rows.slice(0, MAX_CARTOLA_ROWS),
  }
}

// =====================
// QUIZ CONFIGURATION
// =====================

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'income_tracking',
    text: '¿Sabes exactamente cuánto dinero entra cada mes?',
    options: [
      { value: 3, label: 'Sí, al centavo' },
      { value: 2, label: 'Más o menos' },
      { value: 1, label: 'No realmente' },
      { value: 0, label: 'No tengo idea' },
    ],
  },
  {
    id: 'expense_tracking',
    text: '¿Sabes en qué se va tu dinero cada mes?',
    options: [
      { value: 3, label: 'Sí, tengo todo categorizado' },
      { value: 2, label: 'Tengo una idea general' },
      { value: 1, label: 'Solo las cosas grandes' },
      { value: 0, label: 'El dinero desaparece' },
    ],
  },
  {
    id: 'savings',
    text: '¿Logras ahorrar algo cada mes?',
    options: [
      { value: 3, label: 'Sí, automáticamente' },
      { value: 2, label: 'A veces, cuando puedo' },
      { value: 1, label: 'Rara vez' },
      { value: 0, label: 'No me queda nada' },
    ],
  },
  {
    id: 'emergency_fund',
    text: '¿Tienes un fondo de emergencia?',
    options: [
      { value: 3, label: 'Sí, más de 3 meses de gastos' },
      { value: 2, label: 'Algo, pero no suficiente' },
      { value: 1, label: 'Muy poco' },
      { value: 0, label: 'No tengo nada guardado' },
    ],
  },
  {
    id: 'debt',
    text: '¿Cómo está tu situación de deudas?',
    options: [
      { value: 3, label: 'No tengo deudas / solo hipoteca' },
      { value: 2, label: 'Deudas controladas, pago a tiempo' },
      { value: 1, label: 'Tengo deudas que me cuestan' },
      { value: 0, label: 'Las deudas me abruman' },
    ],
  },
]

function getScoreResult(score: number): { stage: string; message: string; color: string } {
  if (score >= 70) {
    return {
      stage: 'Etapa 2',
      message: 'Estás listo para invertir con sistema. Tu base financiera es sólida.',
      color: 'emerald',
    }
  }
  if (score >= 40) {
    return {
      stage: 'Etapa 1',
      message: 'Tienes base, pero necesitas crear más margen antes de invertir.',
      color: 'amber',
    }
  }
  return {
    stage: 'Etapa 0',
    message: 'Empecemos ordenando tu casa financiera. Es el primer paso hacia la libertad.',
    color: 'violet',
  }
}

function questionToButtons(question: QuizQuestion): ButtonOption[] {
  return question.options.map((opt, idx) => ({
    label: opt.label,
    value: `quiz_answer_${question.id}_${opt.value}`,
    variant: idx === 0 ? 'primary' : 'secondary' as 'primary' | 'secondary',
  }))
}

// =====================
// HELPER FUNCTIONS
// =====================

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[^\d+]/g, '')
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized
  }
  return normalized
}

async function sendWhatsAppOTP(env: Env, phone: string, code: string): Promise<{ success: boolean; error?: string }> {
  if (!env.KAPSO_API_KEY || !env.KAPSO_PHONE_NUMBER_ID) {
    console.log('Kapso not configured, OTP code:', code)
    return { success: true }
  }

  const whatsappNumber = phone.startsWith('+') ? phone.slice(1) : phone

  try {
    const apiUrl = `https://api.kapso.ai/meta/whatsapp/v24.0/${env.KAPSO_PHONE_NUMBER_ID}/messages`
    console.log('Kapso request:', apiUrl, 'to:', whatsappNumber)

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-API-Key': env.KAPSO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: whatsappNumber,
          type: 'template',
          template: {
            name: 'finovai_otp',
            language: { code: 'es_MX' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: code },
                ],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  { type: 'text', text: code },
                ],
              },
            ],
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Kapso API error:', response.status, errorText)
      return { success: false, error: `Kapso ${response.status}: ${errorText}` }
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to send WhatsApp OTP:', error)
    return { success: false, error: String(error) }
  }
}

async function getSessionUser(env: Env, token: string): Promise<User | null> {
  if (!token) return null

  const session = await env.DB.prepare(
    `SELECT s.*, u.* FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  )
    .bind(token)
    .first<Session & User>()

  if (!session) return null

  await env.DB.prepare(`UPDATE sessions SET last_used_at = datetime('now') WHERE token = ?`)
    .bind(token)
    .run()

  return {
    id: session.user_id,
    phone: session.phone,
    phone_verified: session.phone_verified,
    display_name: session.display_name,
    couple_id: session.couple_id,
    created_at: session.created_at,
  }
}

function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return null
}

// =====================
// QUIZ STATE MANAGEMENT
// =====================

interface QuizState {
  active: boolean
  currentQuestion: number
  answers: Record<string, number>
}

async function getQuizState(env: Env, conversationId: number): Promise<QuizState> {
  const result = await env.DB.prepare(
    `SELECT metadata FROM conversations WHERE id = ?`
  )
    .bind(conversationId)
    .first<{ metadata: string | null }>()

  if (result?.metadata) {
    try {
      const data = JSON.parse(result.metadata)
      return data.quiz || { active: false, currentQuestion: 0, answers: {} }
    } catch {
      return { active: false, currentQuestion: 0, answers: {} }
    }
  }
  return { active: false, currentQuestion: 0, answers: {} }
}

async function updateQuizState(env: Env, conversationId: number, quizState: QuizState): Promise<void> {
  const result = await env.DB.prepare(
    `SELECT metadata FROM conversations WHERE id = ?`
  )
    .bind(conversationId)
    .first<{ metadata: string | null }>()

  let metadata: Record<string, unknown> = {}
  if (result?.metadata) {
    try {
      metadata = JSON.parse(result.metadata)
    } catch {
      metadata = {}
    }
  }

  metadata.quiz = quizState

  await env.DB.prepare(
    `UPDATE conversations SET metadata = ? WHERE id = ?`
  )
    .bind(JSON.stringify(metadata), conversationId)
    .run()
}

// =====================
// SYSTEM PROMPT
// =====================

const SYSTEM_PROMPT = `Eres FinovAI, un copiloto financiero para Mexico y Latinoamerica.

TU MISIÓN:
Analizar transacciones autorizadas, encontrar fugas de dinero, explicar patrones de gasto y mostrar oportunidades de ahorro que puedan convertirse en aportaciones de inversión.

FILOSOFÍA CORE:
- Primero detectas la fuga, luego decides que hacer con ese margen.
- FinovAI trabaja con lectura transaccional; no inicia pagos, retiros ni inversiones.
- Syncfy es la fuente principal de conexión bancaria y fiscal.
- Las proyecciones de inversión son ilustrativas, no garantías.

TU ROL EN ESTA CONVERSACIÓN:
1. Explicar que patrones aparecen en los movimientos del usuario.
2. Priorizar fugas accionables: comercios repetidos, días de gasto, suscripciones y picos inusuales.
3. Estimar ahorro posible de forma conservadora.
4. Explicar como ese ahorro podria convertirse en aportacion hacia una plataforma de inversion aliada.
5. Ser claro cuando faltan transacciones conectadas y pedir conectar banco con Syncfy.

TONO:
- Cercano pero profesional
- Sin tecnicismos innecesarios
- Directo pero empático
- Como un amigo que sabe de finanzas

IMPORTANTE:
- NO des consejos de inversión específicos
- NO prometas rendimientos
- NO uses jerga financiera compleja
- NO digas que FinovAI mueve dinero
- SÍ valida sus preocupaciones
- SÍ menciona supuestos cuando hables de proyecciones
- SÍ enfoca la respuesta en ahorro, patrones y siguientes pasos

Responde siempre en español. Mantén las respuestas concisas (2-4 párrafos máximo).`

// =====================
// MAIN HANDLER
// =====================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url)
    }

    return new Response('Not Found', { status: 404 })
  },
}

// =====================
// API HANDLER
// =====================

async function handleAPI(request: Request, env: Env, url: URL): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: corsHeaders })

  const error = (message: string, status = 400) => json({ error: message }, status)

  try {
    // =====================
    // TRANSACTION FALLBACKS
    // =====================

    if (url.pathname === '/api/transactions' && request.method === 'GET') {
      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Email invalido')
      }

      return json(await getFinanceDashboard(env, normalizedEmail))
    }

    if (url.pathname === '/api/transactions/manual' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        date?: unknown
        type?: unknown
        amount?: unknown
        currency?: unknown
        category?: unknown
        description?: unknown
        merchant?: unknown
        notes?: unknown
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      if (!normalizedEmail) {
        return error('Email invalido')
      }

      await ensureFinanceTables(env)
      await upsertFinancialProfile(env, normalizedEmail)
      const transaction = await insertFinanceTransaction(env, normalizedEmail, body, 'manual', 1)
      const dashboard = await getFinanceDashboard(env, normalizedEmail)

      return json({
        ...dashboard,
        transaction,
        message: 'Movimiento guardado.',
      }, 201)
    }

    if (url.pathname === '/api/cartola/import' && request.method === 'POST') {
      const formData = await request.formData()
      const normalizedEmail = normalizeSignupEmail(formData.get('email'))
      const file = formData.get('file')

      if (!normalizedEmail) {
        return error('Email invalido')
      }
      if (!(file instanceof File)) {
        return error('Archivo requerido')
      }

      await ensureFinanceTables(env)
      await upsertFinancialProfile(env, normalizedEmail)

      const parsed = await parseCartolaUpload(file)
      const importId = crypto.randomUUID()
      await env.DB.prepare(
        `INSERT INTO cartola_imports (
          id, email, file_name, file_type, row_count, accepted_count, status, metadata_json, created_at, updated_at
        )
         VALUES (?, ?, ?, ?, ?, 0, 'parsed', ?, datetime("now"), datetime("now"))`
      )
        .bind(
          importId,
          normalizedEmail,
          file.name,
          parsed.fileType,
          parsed.rows.length,
          JSON.stringify({
            lowConfidenceRows: parsed.rows.filter((row) => row.confidence < LOW_CONFIDENCE_THRESHOLD).length,
            rawFileStored: false,
          })
        )
        .run()

      return json({
        success: true,
        email: normalizedEmail,
        importId,
        fileName: file.name,
        fileType: parsed.fileType,
        rows: parsed.rows,
        message: parsed.rows.length
          ? `${parsed.rows.length} movimientos detectados. Revisa antes de confirmar.`
          : 'No detectamos movimientos claros. Puedes intentar otra exportación.',
      })
    }

    if (url.pathname === '/api/cartola/confirm' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        importId?: string
        rows?: Array<CartolaDraftRow & { selected?: boolean }>
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      const importId = typeof body.importId === 'string' ? body.importId : ''
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_CARTOLA_ROWS) : []

      if (!normalizedEmail) {
        return error('Email invalido')
      }
      if (!importId) {
        return error('Importacion requerida')
      }
      if (rows.length === 0) {
        return error('Selecciona al menos un movimiento')
      }

      await ensureFinanceTables(env)
      await upsertFinancialProfile(env, normalizedEmail)

      const cartolaImport = await env.DB.prepare(
        `SELECT id FROM cartola_imports WHERE id = ? AND email = ?`
      )
        .bind(importId, normalizedEmail)
        .first<{ id: string }>()

      if (!cartolaImport) {
        return error('Importacion no encontrada', 404)
      }

      const selectedRows = rows.filter((row) => row.selected !== false)
      if (selectedRows.length === 0) {
        return error('Selecciona al menos un movimiento')
      }

      const transactions: FinanceTransaction[] = []
      for (const row of selectedRows) {
        const transaction = await insertFinanceTransaction(
          env,
          normalizedEmail,
          {
            date: row.date,
            type: row.type,
            amount: row.amount,
            currency: row.currency,
            category: row.category,
            description: row.description,
            merchant: row.merchant,
          },
          'cartola',
          row.confidence,
          row.rawSource,
          importId
        )
        transactions.push(transaction)
      }

      await env.DB.prepare(
        `UPDATE cartola_imports
         SET accepted_count = ?, status = 'confirmed', updated_at = datetime("now")
         WHERE id = ? AND email = ?`
      )
        .bind(transactions.length, importId, normalizedEmail)
        .run()

      const dashboard = await getFinanceDashboard(env, normalizedEmail)
      return json({
        ...dashboard,
        imported: transactions.length,
        message: `${transactions.length} movimientos confirmados.`,
      })
    }

    if (url.pathname === '/api/household' && request.method === 'GET') {
      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Email invalido')
      }

      return json({
        success: true,
        email: normalizedEmail,
        invites: await loadHouseholdInvites(env, normalizedEmail),
      })
    }

    if (url.pathname === '/api/household/invite' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        spouseEmail?: string
        inviteeEmail?: string
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      const inviteeEmail = normalizeSignupEmail(body.spouseEmail || body.inviteeEmail)

      if (!normalizedEmail) {
        return error('Email invalido')
      }
      if (!inviteeEmail) {
        return error('Email de pareja invalido')
      }
      if (normalizedEmail === inviteeEmail) {
        return error('Usa un email distinto para invitar a tu pareja')
      }

      const invite = await upsertHouseholdInvite(env, normalizedEmail, inviteeEmail)

      return json({
        success: true,
        email: normalizedEmail,
        invite,
        invites: await loadHouseholdInvites(env, normalizedEmail),
        message: 'Invitacion guardada.',
      }, 201)
    }

    // =====================
    // AUTH ENDPOINTS
    // =====================

    if (url.pathname === '/api/auth/send-otp' && request.method === 'POST') {
      const body = (await request.json()) as { phone: string }
      const phone = normalizePhone(body.phone)

      if (!phone || phone.length < 10) {
        return error('Numero de telefono invalido')
      }

      const recentOTP = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM otp_verifications
         WHERE phone = ? AND created_at > datetime('now', '-1 minute')`
      )
        .bind(phone)
        .first<{ count: number }>()

      if (recentOTP && recentOTP.count >= 1) {
        return error('Espera un minuto antes de solicitar otro codigo', 429)
      }

      const otpCode = generateOTP()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      await env.DB.prepare(
        `INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at, created_at)
         VALUES (?, ?, 'login', ?, datetime('now'))`
      )
        .bind(phone, otpCode, expiresAt)
        .run()

      const result = await sendWhatsAppOTP(env, phone, otpCode)
      if (!result.success) {
        console.error('OTP send failed:', result.error)
        return error(`Error enviando codigo: ${result.error}`, 500)
      }

      return json({ success: true, expiresIn: 300 })
    }

    if (url.pathname === '/api/auth/verify-otp' && request.method === 'POST') {
      const body = (await request.json()) as { phone: string; code: string }
      const phone = normalizePhone(body.phone)
      const code = body.code?.trim()

      if (!phone || !code) {
        return error('Telefono y codigo son requeridos')
      }

      const otp = await env.DB.prepare(
        `SELECT * FROM otp_verifications
         WHERE phone = ? AND otp_code = ? AND expires_at > datetime('now') AND verified_at IS NULL
         ORDER BY created_at DESC LIMIT 1`
      )
        .bind(phone, code)
        .first<{ id: number; attempts: number }>()

      if (!otp) {
        await env.DB.prepare(
          `UPDATE otp_verifications SET attempts = attempts + 1
           WHERE phone = ? AND expires_at > datetime('now') AND verified_at IS NULL`
        )
          .bind(phone)
          .run()

        return error('Codigo invalido o expirado', 401)
      }

      if (otp.attempts >= 3) {
        return error('Demasiados intentos. Solicita un nuevo codigo.', 429)
      }

      await env.DB.prepare(`UPDATE otp_verifications SET verified_at = datetime('now') WHERE id = ?`)
        .bind(otp.id)
        .run()

      let user = await env.DB.prepare(`SELECT * FROM users WHERE phone = ?`).bind(phone).first<User>()

      let isNewUser = false
      if (!user) {
        isNewUser = true
        await env.DB.prepare(
          `INSERT INTO users (phone, phone_verified, created_at, updated_at) VALUES (?, 1, datetime('now'), datetime('now'))`
        )
          .bind(phone)
          .run()

        user = await env.DB.prepare(`SELECT * FROM users WHERE phone = ?`).bind(phone).first<User>()
      } else {
        await env.DB.prepare(
          `UPDATE users SET phone_verified = 1, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(user.id)
          .run()
      }

      const sessionToken = generateSessionToken()
      const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      await env.DB.prepare(
        `INSERT INTO sessions (user_id, token, expires_at, created_at, last_used_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`
      )
        .bind(user!.id, sessionToken, sessionExpires)
        .run()

      return json({
        success: true,
        token: sessionToken,
        user: {
          id: user!.id,
          phone: user!.phone,
          displayName: user!.display_name,
          coupleId: user!.couple_id,
        },
        isNewUser,
      })
    }

    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      let partner = null
      if (user.couple_id) {
        partner = await env.DB.prepare(
          `SELECT id, phone, display_name FROM users WHERE couple_id = ? AND id != ?`
        )
          .bind(user.couple_id, user.id)
          .first()
      }

      return json({
        user: {
          id: user.id,
          phone: user.phone,
          displayName: user.display_name,
          coupleId: user.couple_id,
        },
        partner,
      })
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const token = getAuthToken(request)
      if (token) {
        await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run()
      }
      return json({ success: true })
    }

    // =====================
    // USER ENDPOINTS
    // =====================

    if (url.pathname === '/api/users/me' && request.method === 'PATCH') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      const body = (await request.json()) as { displayName?: string }

      if (body.displayName !== undefined) {
        await env.DB.prepare(
          `UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(body.displayName, user.id)
          .run()
      }

      return json({ success: true })
    }

    // =====================
    // CONVERSATION ENDPOINTS
    // =====================

    if (url.pathname === '/api/conversations' && request.method === 'GET') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      const conversations = await env.DB.prepare(
        `SELECT DISTINCT c.*,
          (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.created_at > COALESCE((SELECT last_read_at FROM conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = ?), '1970-01-01')) as unread_count
         FROM conversations c
         LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE c.owner_id = ? OR cp.user_id = ?
         ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`
      )
        .bind(user.id, user.id, user.id)
        .all()

      return json({ conversations: conversations.results })
    }

    if (url.pathname === '/api/conversations' && request.method === 'POST') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      const body = (await request.json()) as {
        type?: 'private_ai' | 'couple_ai' | 'couple_direct'
        title?: string
      }

      const conversationType = body.type || 'private_ai'
      const title = body.title || null

      if ((conversationType === 'couple_ai' || conversationType === 'couple_direct') && !user.couple_id) {
        return error('Necesitas estar en pareja para crear esta conversacion', 400)
      }

      const result = await env.DB.prepare(
        `INSERT INTO conversations (conversation_type, owner_id, couple_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
        .bind(conversationType, user.id, user.couple_id || null, title)
        .run()

      const conversationId = result.meta.last_row_id

      await env.DB.prepare(
        `INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at)
         VALUES (?, ?, 'owner', datetime('now'))`
      )
        .bind(conversationId, user.id)
        .run()

      if (user.couple_id && conversationType !== 'private_ai') {
        const partner = await env.DB.prepare(
          `SELECT id FROM users WHERE couple_id = ? AND id != ?`
        )
          .bind(user.couple_id, user.id)
          .first<{ id: number }>()

        if (partner) {
          await env.DB.prepare(
            `INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at)
             VALUES (?, ?, 'member', datetime('now'))`
          )
            .bind(conversationId, partner.id)
            .run()
        }
      }

      return json({
        id: conversationId,
        type: conversationType,
        title,
        created_at: new Date().toISOString(),
      })
    }

    const messagesMatch = url.pathname.match(/^\/api\/conversations\/(\d+)\/messages$/)
    
    if (messagesMatch && request.method === 'GET') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      const conversationId = parseInt(messagesMatch[1])
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const before = url.searchParams.get('before')

      const hasAccess = await env.DB.prepare(
        `SELECT 1 FROM conversations c
         LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE c.id = ? AND (c.owner_id = ? OR cp.user_id = ?)`
      )
        .bind(conversationId, user.id, user.id)
        .first()

      if (!hasAccess) {
        return error('No tienes acceso a esta conversacion', 403)
      }

      let query = `SELECT m.*, u.display_name as sender_name, u.phone as sender_phone
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ? AND m.deleted_at IS NULL`

      const params: (string | number)[] = [conversationId]

      if (before) {
        query += ` AND m.id < ?`
        params.push(parseInt(before))
      }

      query += ` ORDER BY m.created_at DESC LIMIT ?`
      params.push(limit)

      const messages = await env.DB.prepare(query).bind(...params).all()

      await env.DB.prepare(
        `UPDATE conversation_participants SET last_read_at = datetime('now')
         WHERE conversation_id = ? AND user_id = ?`
      )
        .bind(conversationId, user.id)
        .run()

      return json({
        messages: messages.results.reverse(),
        hasMore: messages.results.length === limit,
      })
    }

    // Send message to a conversation (with quiz support)
    if (messagesMatch && request.method === 'POST') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      const conversationId = parseInt(messagesMatch[1])
      const body = (await request.json()) as { content: string }

      if (!body.content?.trim()) {
        return error('El mensaje no puede estar vacio')
      }

      const conversation = await env.DB.prepare(
        `SELECT c.* FROM conversations c
         LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE c.id = ? AND (c.owner_id = ? OR cp.user_id = ?)`
      )
        .bind(conversationId, user.id, user.id)
        .first<{ id: number; conversation_type: string; couple_id: number | null }>()

      if (!conversation) {
        return error('No tienes acceso a esta conversacion', 403)
      }

      const messageContent = body.content.trim()

      // Insert user message
      const userMsgResult = await env.DB.prepare(
        `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, created_at)
         VALUES (?, ?, 'user', ?, 'text', datetime('now'))`
      )
        .bind(conversationId, user.id, messageContent)
        .run()

      const userMessageId = userMsgResult.meta.last_row_id

      await env.DB.prepare(
        `UPDATE conversations SET last_message_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(conversationId)
        .run()

      // Handle AI response for AI conversations
      let aiMessage = null
      if (conversation.conversation_type === 'private_ai' || conversation.conversation_type === 'couple_ai') {
        
        // Check for quiz commands
        if (messageContent === 'start_quiz') {
          // Start the quiz
          const quizState: QuizState = { active: true, currentQuestion: 0, answers: {} }
          await updateQuizState(env, conversationId, quizState)

          const firstQuestion = QUIZ_QUESTIONS[0]
          const buttons = questionToButtons(firstQuestion)

          const aiMsgResult = await env.DB.prepare(
            `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata, created_at)
             VALUES (?, NULL, 'ai', ?, 'buttons', ?, datetime('now'))`
          )
            .bind(
              conversationId,
              `¡Perfecto! Empecemos con tu diagnóstico financiero.\n\nPregunta 1 de ${QUIZ_QUESTIONS.length}:\n${firstQuestion.text}`,
              JSON.stringify({ buttons })
            )
            .run()

          aiMessage = {
            id: aiMsgResult.meta.last_row_id,
            sender_type: 'ai',
            content: `¡Perfecto! Empecemos con tu diagnóstico financiero.\n\nPregunta 1 de ${QUIZ_QUESTIONS.length}:\n${firstQuestion.text}`,
            message_type: 'buttons',
            metadata: JSON.stringify({ buttons }),
            created_at: new Date().toISOString(),
          }

        } else if (messageContent === 'skip_quiz') {
          // User skipped the quiz, continue with normal chat
          const aiContent = '¡Sin problema! Cuando quieras conocer tu índice financiero, solo dímelo.\n\n¿En qué puedo ayudarte hoy?'
          
          const aiMsgResult = await env.DB.prepare(
            `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, created_at)
             VALUES (?, NULL, 'ai', ?, 'text', datetime('now'))`
          )
            .bind(conversationId, aiContent)
            .run()

          aiMessage = {
            id: aiMsgResult.meta.last_row_id,
            sender_type: 'ai',
            content: aiContent,
            message_type: 'text',
            created_at: new Date().toISOString(),
          }

        } else if (messageContent.startsWith('quiz_answer_')) {
          // Handle quiz answer
          const quizState = await getQuizState(env, conversationId)
          
          if (quizState.active) {
            // Parse the answer: quiz_answer_{questionId}_{value}
            const parts = messageContent.replace('quiz_answer_', '').split('_')
            const answerValue = parseInt(parts[parts.length - 1])
            const questionId = parts.slice(0, -1).join('_')

            // Store answer
            quizState.answers[questionId] = answerValue
            quizState.currentQuestion++

            if (quizState.currentQuestion < QUIZ_QUESTIONS.length) {
              // Next question
              const nextQuestion = QUIZ_QUESTIONS[quizState.currentQuestion]
              const buttons = questionToButtons(nextQuestion)

              await updateQuizState(env, conversationId, quizState)

              const aiMsgResult = await env.DB.prepare(
                `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata, created_at)
                 VALUES (?, NULL, 'ai', ?, 'buttons', ?, datetime('now'))`
              )
                .bind(
                  conversationId,
                  `Pregunta ${quizState.currentQuestion + 1} de ${QUIZ_QUESTIONS.length}:\n${nextQuestion.text}`,
                  JSON.stringify({ buttons })
                )
                .run()

              aiMessage = {
                id: aiMsgResult.meta.last_row_id,
                sender_type: 'ai',
                content: `Pregunta ${quizState.currentQuestion + 1} de ${QUIZ_QUESTIONS.length}:\n${nextQuestion.text}`,
                message_type: 'buttons',
                metadata: JSON.stringify({ buttons }),
                created_at: new Date().toISOString(),
              }

            } else {
              // Quiz complete - calculate score
              const total = Object.values(quizState.answers).reduce((sum, val) => sum + val, 0)
              const maxPossible = QUIZ_QUESTIONS.length * 3
              const score = Math.round((total / maxPossible) * 100)
              const { stage, message, color } = getScoreResult(score)

              // Reset quiz state
              quizState.active = false
              await updateQuizState(env, conversationId, quizState)

              // Insert score result message
              const scoreResult = await env.DB.prepare(
                `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata, created_at)
                 VALUES (?, NULL, 'ai', ?, 'score_result', ?, datetime('now'))`
              )
                .bind(
                  conversationId,
                  `Tu Índice Financiero: ${score}/100`,
                  JSON.stringify({ score, stage, stageMessage: message, color })
                )
                .run()

              // Insert follow-up message with CTAs
              const ctaButtons: ButtonOption[] = [
                { label: '📋 Ver mi plan personalizado', value: 'view_plan', variant: 'primary' },
                { label: '💬 Hablar con un asesor', value: 'talk_advisor', variant: 'secondary' },
                { label: '🔄 Volver a hacer el test', value: 'start_quiz', variant: 'secondary' },
              ]

              const followUpResult = await env.DB.prepare(
                `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata, created_at)
                 VALUES (?, NULL, 'ai', ?, 'buttons', ?, datetime('now'))`
              )
                .bind(
                  conversationId,
                  '¿Qué te gustaría hacer ahora?',
                  JSON.stringify({ buttons: ctaButtons })
                )
                .run()

              aiMessage = {
                id: followUpResult.meta.last_row_id,
                sender_type: 'ai',
                content: '¿Qué te gustaría hacer ahora?',
                message_type: 'buttons',
                metadata: JSON.stringify({ buttons: ctaButtons }),
                created_at: new Date().toISOString(),
                // Include score result as a previous message
                _scoreResult: {
                  id: scoreResult.meta.last_row_id,
                  sender_type: 'ai',
                  content: `Tu Índice Financiero: ${score}/100`,
                  message_type: 'score_result',
                  metadata: JSON.stringify({ score, stage, stageMessage: message, color }),
                  created_at: new Date().toISOString(),
                },
              }
            }
          }

        } else if (messageContent === 'view_plan' || messageContent === 'talk_advisor') {
          // Handle CTA clicks
          const ctaResponse = messageContent === 'view_plan'
            ? 'Excelente decisión. Con tus transacciones conectadas, FinovAI puede ayudarte a priorizar fugas, estimar ahorro y convertir ese margen en una ruta hacia inversión.\n\nPronto recibirás información sobre los siguientes pasos.\n\n¿Tienes alguna pregunta mientras tanto?'
            : 'Perfecto. Un asesor de FinovAI se pondrá en contacto contigo pronto.\n\nMientras tanto, ¿hay algo específico que quieras preparar para la llamada?'

          const aiMsgResult = await env.DB.prepare(
            `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, created_at)
             VALUES (?, NULL, 'ai', ?, 'text', datetime('now'))`
          )
            .bind(conversationId, ctaResponse)
            .run()

          aiMessage = {
            id: aiMsgResult.meta.last_row_id,
            sender_type: 'ai',
            content: ctaResponse,
            message_type: 'text',
            created_at: new Date().toISOString(),
          }

        } else {
          // Regular AI conversation
          const history = await env.DB.prepare(
            `SELECT sender_type, content FROM messages
             WHERE conversation_id = ? AND deleted_at IS NULL
             ORDER BY created_at DESC LIMIT 20`
          )
            .bind(conversationId)
            .all<{ sender_type: string; content: string }>()

          const messagesForAI = [
            { role: 'system' as const, content: SYSTEM_PROMPT },
            ...history.results.reverse().map((m) => ({
              role: (m.sender_type === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
              content: m.content,
            })),
          ]

          const aiContent = await runAIResponse(env, messagesForAI, isLocalRequest(url))

          const aiMsgResult = await env.DB.prepare(
            `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, created_at)
             VALUES (?, NULL, 'ai', ?, 'text', datetime('now'))`
          )
            .bind(conversationId, aiContent)
            .run()

          aiMessage = {
            id: aiMsgResult.meta.last_row_id,
            sender_type: 'ai',
            content: aiContent,
            message_type: 'text',
            created_at: new Date().toISOString(),
          }
        }

        await env.DB.prepare(
          `UPDATE conversations SET last_message_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ?`
        )
          .bind(conversationId)
          .run()
      }

      return json({
        userMessage: {
          id: userMessageId,
          sender_type: 'user',
          sender_id: user.id,
          content: messageContent,
          message_type: 'text',
          created_at: new Date().toISOString(),
        },
        aiMessage,
      })
    }

    if (url.pathname === '/api/syncfy/session' && request.method === 'POST') {
      const { email, name, credentialId, mode } = (await request.json()) as {
        email: string
        name?: string
        credentialId?: string
        mode?: 'create' | 'update'
      }

      const normalizedEmail = normalizeSignupEmail(email)
      if (!normalizedEmail) {
        return error('Email invalido')
      }

      await upsertLead(env, normalizedEmail, name, JSON.stringify({ source: 'syncfy-session' }))
      let syncfyUser: SyncfyUserRow
      let session: { token: string | null; mode: 'live' | 'local' }

      try {
        syncfyUser = await getOrCreateSyncfyUser(env, normalizedEmail, name)
        session = await createSyncfyWidgetSession(env, syncfyUser)
      } catch (err) {
        if (err instanceof SyncfyRequestError) {
          await storeSyncfyError(env, {
            email: normalizedEmail,
            rid: err.rid,
            statusCode: err.status,
            errorCode: err.code,
            message: err.message,
            source: 'syncfy-session',
            payload: err.responseBody,
          })

          return json({
            success: false,
            email: normalizedEmail,
            error: buildSyncfyUserMessage(err),
            rid: err.rid,
          }, err.status >= 500 ? 502 : 409)
        }

        throw err
      }

      return json({
        success: true,
        email: normalizedEmail,
        syncfyUserId: syncfyUser.syncfy_user_id,
        syncfyExternalId: syncfyUser.syncfy_external_id,
        mode: session.mode,
        widgetEnabled: session.mode === 'live' && Boolean(session.token),
        token: session.token,
        widgetConfig: {
          ...SYNCFY_WIDGET_CONFIG,
          entrypoint: {
            ...SYNCFY_WIDGET_CONFIG.entrypoint,
            updateCredential: mode === 'update' ? credentialId : undefined,
          },
        },
        credentialId: credentialId || null,
      })
    }

    if (url.pathname === '/api/syncfy/credentials' && request.method === 'GET') {
      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Email invalido')
      }

      const credentials = await loadSyncfyCredentialsForEmail(env, normalizedEmail)
      return json({
        success: true,
        email: normalizedEmail,
        credentials: credentials.map(syncfyCredentialToApi),
      } satisfies SyncfyCredentialsResponse)
    }

    if (url.pathname === '/api/syncfy/refresh' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        credentialId?: string
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      if (!normalizedEmail) {
        return error('Email invalido')
      }

      const credentials = await loadSyncfyCredentialsForEmail(env, normalizedEmail)
      const credential = body.credentialId
        ? credentials.find((item) => item.syncfy_credential_id === body.credentialId)
        : credentials[0]

      if (!credential) {
        return error('Primero conecta una institucion con Syncfy.', 404)
      }

      const cooldownSeconds = getSyncfyCredentialCooldownSeconds(credential)
      if (cooldownSeconds > 0) {
        return json({
          success: false,
          error: 'Syncfy permite un pull exitoso por credencial cada 5 minutos.',
          retryAfterSeconds: cooldownSeconds,
          credential: syncfyCredentialToApi(credential),
        }, 429)
      }

      try {
        const importResult = await importSyncfyTransactionsForCredential(
          env,
          normalizedEmail,
          credential.syncfy_credential_id
        )
        await env.DB.prepare(
          `UPDATE syncfy_credentials
           SET last_pull_at = datetime("now"), last_successful_sync_at = datetime("now"), updated_at = datetime("now")
           WHERE email = ? AND syncfy_credential_id = ?`
        )
          .bind(normalizedEmail, credential.syncfy_credential_id)
          .run()
        const dashboard = await getFinanceDashboard(env, normalizedEmail)

        return json({
          ...dashboard,
          source: 'syncfy',
          syncfy: importResult,
          message: `${importResult.imported} movimientos sincronizados desde Syncfy.`,
        })
      } catch (err) {
        if (err instanceof SyncfyRequestError) {
          await storeSyncfyError(env, {
            email: normalizedEmail,
            syncfyUserId: credential.syncfy_user_id,
            syncfyCredentialId: credential.syncfy_credential_id,
            rid: err.rid,
            statusCode: err.status,
            errorCode: err.code,
            message: err.message,
            source: 'syncfy-refresh',
            payload: err.responseBody,
          })

          return json({
            success: false,
            error: buildSyncfyUserMessage(err),
            rid: err.rid,
          }, err.status >= 500 ? 502 : 409)
        }

        throw err
      }
    }

    if (url.pathname === '/api/syncfy/webhook' && request.method === 'POST') {
      await ensureSyncfyTables(env)

      const verified = await verifySyncfySecret(request, env)
      if (env.SYNCFY_WEBHOOK_SECRET && !verified) {
        return error('Invalid Syncfy webhook secret', 401)
      }

      const payload = await request.json() as unknown
      const event = await storeSyncfyWebhookEvent(env, payload)
      const credential = await storeSyncfyCredential(env, payload, event.event_type)
      let importResult: SyncfyTransactionImportResult | null = null

      if (isSyncfyRefreshEvent(event.event_type) || event.event_type.toLowerCase() === 'refresh') {
        const transactionEndpoints = getSyncfyWebhookEndpointPaths(payload, 'transactions')
        const email = event.syncfy_user_id ? await findEmailBySyncfyUserId(env, event.syncfy_user_id) : credential?.email

        if (email && transactionEndpoints.length > 0) {
          try {
            importResult = await importSyncfyTransactionsFromEndpoints(
              env,
              email,
              event.syncfy_credential_id || credential?.syncfy_credential_id || null,
              transactionEndpoints
            )
          } catch (err) {
            if (err instanceof SyncfyRequestError) {
              await storeSyncfyError(env, {
                email,
                syncfyUserId: event.syncfy_user_id,
                syncfyCredentialId: event.syncfy_credential_id,
                rid: err.rid || event.rid,
                statusCode: err.status,
                errorCode: err.code,
                message: err.message,
                source: 'syncfy-webhook-import',
                payload: err.responseBody,
              })
            } else {
              throw err
            }
          }
        }
      }

      return json({
        success: true,
        verified,
        eventId: event.id,
        eventType: event.event_type,
        syncfyUserId: event.syncfy_user_id,
        syncfyCredentialId: event.syncfy_credential_id,
        credentialStored: Boolean(credential),
        refreshEvent: isSyncfyRefreshEvent(event.event_type),
        transactionsImported: importResult?.imported || 0,
        transactionsFetched: importResult?.fetched || 0,
      }, 202)
    }

    if (url.pathname === '/api/syncfy/status' && request.method === 'GET') {
      if (env.ENVIRONMENT === 'production' && !(await verifySyncfySecret(request, env))) {
        return error('Not found', 404)
      }

      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Email invalido')
      }

      await ensureSyncfyTables(env)

      const syncfyUser = await env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
        .bind(normalizedEmail)
        .first<SyncfyUserRow>()
      const credentials = await env.DB.prepare(
        `SELECT * FROM syncfy_credentials WHERE email = ? ORDER BY updated_at DESC, created_at DESC LIMIT 20`
      )
        .bind(normalizedEmail)
        .all<SyncfyCredentialRow>()
      const errors = await env.DB.prepare(
        `SELECT id, email, syncfy_user_id, syncfy_credential_id, rid, status_code, error_code, message, source, created_at
         FROM syncfy_errors
         WHERE email = ? OR syncfy_user_id = ?
         ORDER BY created_at DESC
         LIMIT 20`
      )
        .bind(normalizedEmail, syncfyUser?.syncfy_user_id || '')
        .all<SyncfyErrorRow>()
      const webhooks = await env.DB.prepare(
        `SELECT id, event_type, syncfy_user_id, syncfy_credential_id, rid, processed_at, created_at
         FROM syncfy_webhook_events
         WHERE syncfy_user_id = ?
         ORDER BY created_at DESC
         LIMIT 20`
      )
        .bind(syncfyUser?.syncfy_user_id || '')
        .all<SyncfyWebhookEventRow>()

      return json({
        success: true,
        email: normalizedEmail,
        syncfyUser,
        credentials: credentials.results,
        recentErrors: errors.results,
        recentWebhooks: webhooks.results,
      })
    }

    if (url.pathname === '/api/prometeo/transactions' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        provider?: string
        username?: string
        password?: string
        dateStart?: string
        dateEnd?: string
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      const provider = (body.provider || 'test').trim()
      const username = (body.username || '').trim()
      const password = body.password || ''
      const dateStart = normalizePrometeoQueryDate(body.dateStart, PROMETEO_DEFAULT_DATE_START)
      const dateEnd = normalizePrometeoQueryDate(body.dateEnd, PROMETEO_DEFAULT_DATE_END)
      const prometeoMode = getPrometeoMode(env.PROMETEO_API_BASE_URL || DEFAULT_PROMETEO_BASE_URL)

      if (!normalizedEmail) {
        return error('Email invalido')
      }
      if (!provider || !username || !password) {
        return error('Proveedor, usuario y contraseña son requeridos')
      }
      if (!env.PROMETEO_API_KEY && !env.PROMETEO_PROXY_URL) {
        return error('PROMETEO_API_KEY is not configured for this environment', 500)
      }
      if (prometeoMode === 'sandbox' && provider !== 'test') {
        return error('Real bank connections require Prometeo Trial/Production access. The current API key is sandbox-only.', 409)
      }

      await upsertLead(env, normalizedEmail, '', JSON.stringify({
        source: 'prometeo-connect',
        provider,
        connectedAt: new Date().toISOString(),
      }))

      const sessionKey = await loginToPrometeo(env, provider, username, password)
      const accounts = await getPrometeoAccounts(env, sessionKey)
      const movementsByAccount = await Promise.all(
        accounts.map(async (account) => {
          const movements = await getPrometeoMovements(env, sessionKey, account, dateStart, dateEnd)
          return movements.map((movement) => normalizePrometeoMovement(movement, account))
        })
      )
      const expenses = movementsByAccount.flat().sort((a, b) => b.date.localeCompare(a.date))

      return json({
        success: true,
        email: normalizedEmail,
        provider,
        source: 'prometeo',
        mode: prometeoMode,
        dateRange: { dateStart, dateEnd },
        accounts: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          number: account.number,
          currency: account.currency,
          balance: account.balance,
        })),
        summary: summarizeExpenses(expenses),
        expenses,
        message: `${expenses.length} movimientos cargados desde Prometeo.`,
      })
    }

    if (url.pathname === '/api/expenses' && request.method === 'GET') {
      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Email invalido')
      }

      await ensureSyncfyTables(env)

      const syncfyUser = await env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
        .bind(normalizedEmail)
        .first<SyncfyUserRow>()

      if (!syncfyUser || !env.SYNCFY_API_KEY) {
        return json(expensesResponse('sample', normalizedEmail, SAMPLE_EXPENSES))
      }

      let rawTransactions: unknown
      let importResult: SyncfyTransactionImportResult | null = null

      try {
        if (env.SYNCFY_TRANSACTIONS_PATH) {
          const transactionsPath = env.SYNCFY_TRANSACTIONS_PATH.replace('{id_user}', syncfyUser.syncfy_user_id)
          rawTransactions = await syncfyRequest<unknown>(env, transactionsPath, { method: 'GET' })
        } else {
          const credentials = await loadSyncfyCredentialsForEmail(env, normalizedEmail)
          const credential = credentials[0]
          if (!credential) {
            return json(expensesResponse('sample', normalizedEmail, SAMPLE_EXPENSES))
          }

          if (getSyncfyCredentialCooldownSeconds(credential) === 0) {
            importResult = await importSyncfyTransactionsForCredential(env, normalizedEmail, credential.syncfy_credential_id)
            await env.DB.prepare(
              `UPDATE syncfy_credentials
               SET last_pull_at = datetime("now"), last_successful_sync_at = datetime("now"), updated_at = datetime("now")
               WHERE email = ? AND syncfy_credential_id = ?`
            )
              .bind(normalizedEmail, credential.syncfy_credential_id)
              .run()
          }

          const persisted = await loadFinanceTransactions(env, normalizedEmail)
          const expenses = persisted.map(financeTransactionToExpense)
          return json({
            ...expensesResponse('syncfy', normalizedEmail, expenses),
            syncfy: importResult,
          })
        }
      } catch (err) {
        if (err instanceof SyncfyRequestError) {
          await storeSyncfyError(env, {
            email: normalizedEmail,
            syncfyUserId: syncfyUser.syncfy_user_id,
            rid: err.rid,
            statusCode: err.status,
            errorCode: err.code,
            message: err.message,
            source: 'syncfy-expenses',
            payload: err.responseBody,
          })

          return json({
            success: false,
            email: normalizedEmail,
            source: 'syncfy',
            summary: summarizeExpenses([]),
            expenses: [],
            error: buildSyncfyUserMessage(err),
            rid: err.rid,
          }, err.status >= 500 ? 502 : 409)
        }

        throw err
      }

      const syncfyTransactions = extractSyncfyTransactions(rawTransactions)
      const expenses = syncfyTransactions
        .map((transaction, index) => normalizeSyncfyTransaction(transaction, null, index))
        .filter((transaction): transaction is NormalizedSyncfyTransaction => Boolean(transaction))
        .map((transaction) => ({
          id: transaction.id,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.type === 'income' ? -transaction.amount : transaction.amount,
          category: transaction.category,
          merchant: transaction.merchant,
          accountCurrency: transaction.currency,
          type: transaction.type === 'income' ? 'credit' as const : 'debit' as const,
        }))

      return json({
        success: true,
        email: normalizedEmail,
        source: 'syncfy',
        summary: summarizeExpenses(expenses),
        expenses,
        raw: rawTransactions,
        message: `${expenses.length} movimientos cargados desde Syncfy.`,
      })
    }

    // =====================
    // LEGACY ENDPOINTS
    // =====================

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const { messages } = (await request.json()) as { messages: Message[] }

      const messagesWithSystem = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ]

      const aiMessage = await runAIResponse(env, messagesWithSystem, isLocalRequest(url))

      return json({ message: aiMessage })
    }

    if (url.pathname === '/api/signup' && request.method === 'POST') {
      const { email, name, diagnosticData } = (await request.json()) as {
        email: string
        name: string
        diagnosticData?: string
      }

      const normalizedEmail = normalizeSignupEmail(email)
      if (!normalizedEmail) {
        return error('Email invalido')
      }

      await upsertLead(env, normalizedEmail, name, diagnosticData)

      return json({ success: true, email: normalizedEmail })
    }

    if (url.pathname === '/api/health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() })
    }

    return error('Not found', 404)
  } catch (err) {
    console.error('API Error:', err)
    return json({ error: 'Internal server error', details: String(err) }, 500)
  }
}
