import { extractText, getDocumentProxy } from 'unpdf'

interface Env {
  DB: D1Database
  ENVIRONMENT: string
  ENABLE_BACKUP_IMPORT?: string
  ENABLE_LEGACY_CHAT?: string
  EMAIL?: SendEmail
  EMAIL_AUTH_REQUIRED?: string
  EMAIL_FROM?: string
  APP_ORIGIN?: string
  KAPSO_API_KEY?: string
  KAPSO_PHONE_NUMBER_ID?: string
  SESSION_SECRET?: string
  SYNCFY_API_KEY?: string
  SYNCFY_API_BASE_URL?: string
  SYNCFY_AUTH_HEADER_NAME?: string
  SYNCFY_AUTH_HEADER_PREFIX?: string
  SYNCFY_AUTH_HEADER_VALUE?: string
  SYNCFY_ENV?: string
  SYNCFY_TRANSACTION_LOOKBACK_MONTHS?: string
  SYNCFY_TRANSACTIONS_PATH?: string
  SYNCFY_WEBHOOK_SECRET?: string
  SUPPORT_ADMIN_SECRET?: string
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_CHAT_MODEL?: string
  ANTHROPIC_MODEL?: string
  CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID?: string
  CLOUDFLARE_AI_GATEWAY_ID?: string
  CLOUDFLARE_AI_GATEWAY_TOKEN?: string
  CLOUDFLARE_AI_GATEWAY_BYOK_ALIAS?: string
  CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT?: string
  CLOUDFLARE_AI_GATEWAY_COMPAT_MODEL?: string
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
  syncfySiteOrganizationId: string | null
  siteName: string | null
  status: string | null
  rid: string | null
}

interface SyncfySiteMetadata {
  syncfySiteId: string | null
  syncfySiteOrganizationId: string | null
  siteName: string | null
}

interface SyncfyTransactionImportResult {
  credentialId: string | null
  fetched: number
  imported: number
  skipped: number
  endpoints: string[]
}

export interface FinanceDataCoverage {
  firstDate: string | null
  lastDate: string | null
  firstMonth: string | null
  lastMonth: string | null
  monthCount: number
  transactionCount: number
  preliminary: boolean
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
    needsReconnect: boolean
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
  category_locked?: number | null
  raw_source: string | null
  cartola_import_id: string | null
  created_at: string
  updated_at: string | null
}

interface FinancialProfileRow {
  email: string
  currency: string
  monthly_income?: number | null
  monthly_budget?: number | null
  category_budgets_json?: string | null
  created_at?: string
  updated_at?: string | null
}

export interface FinancialProfile {
  email: string
  currency: string
  monthlyIncome: number | null
  monthlyBudget: number | null
  categoryBudgets: Record<string, number>
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
  dataCoverage: FinanceDataCoverage
  topSpendingCategory: string
  topSpendingCategoryAmount: number
  unusualHighSpendDay: { date: string; amount: number } | null
  recurringExpenses: Array<{ key: string; description: string; amount: number; count: number }>
  estimatedSavingsOpportunity: number
}

type BudgetSource = 'user' | 'income_rule' | 'missing'
type CategoryBudgetStatus = 'under' | 'near' | 'over' | 'unset'

export interface CategoryBudgetComparison {
  category: string
  amount: number
  share: number
  previousAmount: number
  deltaFromPrevious: number
  budget: number | null
  budgetUsage: number | null
  budgetStatus: CategoryBudgetStatus
  advice: string
}

export interface CategoryMonthRow {
  month: string
  spendingTotal: number
  incomeTotal: number
  topCategory: string
  deltaFromPrevious: number | null
  budgetTotal: number | null
  status: CategoryBudgetStatus
}

export interface CategoryAnalysis {
  period: string
  periodLabel: string
  previousPeriod: string | null
  spendingTotal: number
  incomeTotal: number
  budgetTotal: number | null
  budgetSource: BudgetSource
  fixedExpenseShare: number | null
  fixedExpenseLimit: number | null
  summaryAdvice: string
  categories: CategoryBudgetComparison[]
  monthRows: CategoryMonthRow[]
}

export interface FinanceInsight {
  id: string
  title: string
  value: string
  body: string
  tone: 'good' | 'watch' | 'urgent'
}

type FinanceOpportunityKind = 'recurring' | 'merchant_leak' | 'category_leak' | 'unusual_day'

export interface FinanceOpportunity {
  id: string
  kind: FinanceOpportunityKind
  title: string
  body: string
  sourceLabel: string
  estimatedMonthlySavings: number
}

export interface FinanceActionPlan {
  monthlySavingsTarget: number
  topOpportunities: FinanceOpportunity[]
  investmentProjection: {
    monthlyContribution: number
    years: number
    annualReturn: number
    totalContributed: number
    tenYearValue: number
    potentialGrowth: number
  }
  nextActions: Array<{
    id: string
    label: string
    body: string
    target: 'movements' | 'categories' | 'chat' | 'connect' | 'partner'
  }>
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

interface EmailLoginChallengeRow {
  id: string
  email: string
  token_hash: string
  code_hash: string
  source: string | null
  redirect_path: string | null
  attempts: number
  created_at: number
  expires_at: number
  consumed_at: number | null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DASHBOARD_SECRET_HEADER = 'x-finovai-dashboard-secret'
const SUPPORT_ADMIN_SECRET_HEADER = 'x-finovai-admin-secret'
const DASHBOARD_SECRET_BYTES = 32
const EMAIL_LOGIN_TOKEN_BYTES = 32
const EMAIL_LOGIN_TTL_SECONDS = 15 * 60
const EMAIL_LOGIN_MAX_ATTEMPTS = 5
const LOCAL_AI_FALLBACK =
  'Estoy corriendo en modo local. La IA real necesita Cloudflare AI Gateway o ANTHROPIC_API_KEY para ejecutarse, pero puedes probar la interfaz, el registro por correo y el flujo del producto.'
const DEFAULT_SYNCFY_BASE_URL = 'https://sync.paybook.com/v1'
const DEFAULT_PRODUCT_CHAT_MODEL = 'claude-opus-4-8'
const DEFAULT_COMPAT_CHAT_MODEL = 'anthropic/claude-opus-4-7'
const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '711cb78717605db93e601e6a06e7eeec'
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_API_VERSION = '2023-06-01'
const SYNCFY_REFRESH_COOLDOWN_SECONDS = 5 * 60
const SYNCFY_BACKGROUND_REFRESH_INTERVAL_SECONDS = 60 * 60
const SYNCFY_BACKGROUND_REFRESH_LIMIT = 25
const SYNCFY_DEFAULT_TRANSACTION_LIMIT = 500
const SYNCFY_DEFAULT_TRANSACTION_LOOKBACK_MONTHS = 6
const SYNCFY_MAX_TRANSACTION_IMPORT_COUNT = 5000
const SYNCFY_MAX_TRANSACTION_IMPORT_PAGES = 10
const SYNCFY_INSTITUTION_NAME_KEYS = [
  'institution_name',
  'institutionName',
  'bank_name',
  'bankName',
  'organization_name',
  'organizationName',
  'site_organization_name',
  'siteOrganizationName',
  'id_site_organization_name',
  'display_name',
  'displayName',
  'site_name',
  'siteName',
  'name_site',
  'siteNameDisplay',
  'name',
]
const SYNCFY_GENERIC_INSTITUTION_NAMES = new Set([
  'ACCOUNT',
  'BANK',
  'CREDENTIAL',
  'CREDENTIALS',
  'CREDENCIAL',
  'CUENTA',
  'LOGIN',
  'MOVIMIENTO',
  'NORMAL',
  'PASSWORD',
  'SITE',
  'SITIO',
  'SYNCFY',
  'TOKEN',
  'TRANSACTION',
  'USERNAME',
  'USUARIO',
])
const KNOWN_SYNCFY_INSTITUTION_NAMES = new Map<string, string>([
  ['572930c4784806060f8b456a', 'American Express'],
  ['572930c4784806060f8b456b', 'American Express'],
])
const SYNCFY_WIDGET_CONFIG = {
  locale: 'es',
  entrypoint: {
    country: 'MX',
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

export function getProductChatModel(env: Pick<Env, 'ANTHROPIC_CHAT_MODEL' | 'ANTHROPIC_MODEL'>): string {
  return env.ANTHROPIC_CHAT_MODEL?.trim() || env.ANTHROPIC_MODEL?.trim() || DEFAULT_PRODUCT_CHAT_MODEL
}

export function getGatewayCompatChatModel(env: Pick<Env, 'CLOUDFLARE_AI_GATEWAY_COMPAT_MODEL'>): string {
  return env.CLOUDFLARE_AI_GATEWAY_COMPAT_MODEL?.trim() || DEFAULT_COMPAT_CHAT_MODEL
}

export function getDashboardChatModel(
  env: Pick<
    Env,
    | 'ANTHROPIC_CHAT_MODEL'
    | 'ANTHROPIC_MODEL'
    | 'CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT'
    | 'CLOUDFLARE_AI_GATEWAY_COMPAT_MODEL'
  >
): string {
  if (env.CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT?.trim()) return getGatewayCompatChatModel(env)
  return getProductChatModel(env)
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

function buildSyncfyRecoveryExternalId(email: string): string {
  return `${buildSyncfyExternalId(email)}:reset:${Date.now()}`
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

function buildAnthropicMessagePayload(messages: Message[]) {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n')
  const chatMessages = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))

  return { system, messages: chatMessages }
}

function buildCompatChatCompletionMessages(messages: Message[]) {
  return messages
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
    .filter((message) => message.content.trim())
}

function extractAnthropicResponseText(data: unknown): string | null {
  const record = asRecord(data)
  if (!record) return null

  const content = Array.isArray(record.content) ? record.content : []
  const parts = content
    .map((part) => {
      const partRecord = asRecord(part)
      return typeof partRecord?.text === 'string' ? partRecord.text : ''
    })
    .filter(Boolean)

  return parts.join('\n').trim() || null
}

function extractCompatContentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (typeof part === 'string') return part
      const partRecord = asRecord(part)
      return typeof partRecord?.text === 'string' ? partRecord.text : ''
    })
    .filter(Boolean)
    .join('\n')
}

function extractCompatChatCompletionText(data: unknown): string | null {
  const record = asRecord(data)
  if (!record) return null

  const choices = Array.isArray(record.choices) ? record.choices : []
  for (const choice of choices) {
    const choiceRecord = asRecord(choice)
    const message = asRecord(choiceRecord?.message)
    const delta = asRecord(choiceRecord?.delta)
    const text = extractCompatContentText(message?.content || delta?.content).trim()
    if (text) return text
  }

  return null
}

function getCloudflareAIGatewayUrl(env: Env): string | null {
  const gatewayId = env.CLOUDFLARE_AI_GATEWAY_ID?.trim()
  if (!gatewayId) return null

  const accountId = env.CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID?.trim() || DEFAULT_CLOUDFLARE_ACCOUNT_ID
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/anthropic/v1/messages`
}

function getCloudflareAIGatewayCompatEndpoint(env: Env): string | null {
  return env.CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT?.trim() || null
}

function getGatewayCompatRequestConfig(env: Env): { url: string; headers: Record<string, string> } | null {
  const url = getCloudflareAIGatewayCompatEndpoint(env)
  if (!url) return null

  const gatewayToken = env.CLOUDFLARE_AI_GATEWAY_TOKEN?.trim()
  const providerApiKey = env.ANTHROPIC_API_KEY?.trim()
  if (!gatewayToken && !providerApiKey) return null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const byokAlias = env.CLOUDFLARE_AI_GATEWAY_BYOK_ALIAS?.trim()
  if (gatewayToken) headers['cf-aig-authorization'] = `Bearer ${gatewayToken}`
  if (byokAlias) headers['cf-aig-byok-alias'] = byokAlias
  if (!gatewayToken && providerApiKey) headers.Authorization = `Bearer ${providerApiKey}`

  return { url, headers }
}

function getAnthropicRequestConfig(env: Env): { url: string; headers: Record<string, string> } | null {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': ANTHROPIC_API_VERSION,
  }
  const gatewayUrl = getCloudflareAIGatewayUrl(env)

  if (gatewayUrl) {
    const gatewayToken = env.CLOUDFLARE_AI_GATEWAY_TOKEN?.trim()
    const byokAlias = env.CLOUDFLARE_AI_GATEWAY_BYOK_ALIAS?.trim()
    if (!gatewayToken && !env.ANTHROPIC_API_KEY) return null
    if (gatewayToken) headers['cf-aig-authorization'] = `Bearer ${gatewayToken}`
    if (byokAlias) headers['cf-aig-byok-alias'] = byokAlias
    if (!gatewayToken && env.ANTHROPIC_API_KEY) headers['x-api-key'] = env.ANTHROPIC_API_KEY
    return { url: gatewayUrl, headers }
  }

  if (!env.ANTHROPIC_API_KEY) return null
  headers['x-api-key'] = env.ANTHROPIC_API_KEY
  return { url: ANTHROPIC_MESSAGES_URL, headers }
}

async function runCompatAIResponse(
  env: Env,
  messages: Message[],
  requestConfig: { url: string; headers: Record<string, string> }
): Promise<string> {
  const response = await fetch(requestConfig.url, {
    method: 'POST',
    headers: requestConfig.headers,
    body: JSON.stringify({
      model: getGatewayCompatChatModel(env),
      max_tokens: 700,
      messages: buildCompatChatCompletionMessages(messages),
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = asRecord(asRecord(data)?.error)
    const message = typeof error?.message === 'string' ? error.message : 'Cloudflare AI Gateway no respondió correctamente.'
    throw new Error(message)
  }

  const answer = extractCompatChatCompletionText(data)
  if (!answer) {
    throw new Error('Cloudflare AI Gateway respondió sin texto.')
  }

  return answer
}

async function runAIResponse(env: Env, messages: Message[], allowLocalFallback: boolean): Promise<string> {
  const compatEndpoint = getCloudflareAIGatewayCompatEndpoint(env)
  if (compatEndpoint) {
    const requestConfig = getGatewayCompatRequestConfig(env)
    if (!requestConfig) {
      if (allowLocalFallback) return LOCAL_AI_FALLBACK
      throw new Error('CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT needs CLOUDFLARE_AI_GATEWAY_TOKEN or ANTHROPIC_API_KEY')
    }
    return runCompatAIResponse(env, messages, requestConfig)
  }

  const requestConfig = getAnthropicRequestConfig(env)
  if (!requestConfig) {
    if (allowLocalFallback) return LOCAL_AI_FALLBACK
    throw new Error('CLOUDFLARE_AI_GATEWAY_ID with CLOUDFLARE_AI_GATEWAY_TOKEN, or ANTHROPIC_API_KEY, is not configured')
  }

  const { system, messages: anthropicMessages } = buildAnthropicMessagePayload(messages)
  const response = await fetch(requestConfig.url, {
    method: 'POST',
    headers: requestConfig.headers,
    body: JSON.stringify({
      model: getProductChatModel(env),
      max_tokens: 700,
      ...(system ? { system } : {}),
      messages: anthropicMessages,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const errorRecord = asRecord(asRecord(data)?.error)
    const message = typeof errorRecord?.message === 'string' ? errorRecord.message : 'Anthropic no respondió correctamente.'
    throw new Error(message)
  }

  const answer = extractAnthropicResponseText(data)
  if (!answer) {
    throw new Error('Anthropic respondió sin texto.')
  }

  return answer
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

function isProductionEnv(env: Env): boolean {
  return env.ENVIRONMENT === 'production'
}

function isFeatureEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

function createDashboardClientSecret(): string {
  const bytes = new Uint8Array(DASHBOARD_SECRET_BYTES)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function getDashboardClientSecret(request: Request): string | null {
  const secret = request.headers.get(DASHBOARD_SECRET_HEADER)
  return secret && secret.length <= 256 ? secret : null
}

async function ensureDashboardSessionTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS dashboard_sessions (
      email TEXT PRIMARY KEY,
      client_secret_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT
    )`
  ).run()
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_last_used ON dashboard_sessions(last_used_at DESC)`).run()
}

async function ensureEmailAuthTables(env: Env): Promise<void> {
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

async function verifyDashboardEmailAccess(
  env: Env,
  request: Request,
  email: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (!isProductionEnv(env)) return { ok: true }

  await ensureDashboardSessionTable(env)
  const row = await env.DB.prepare(`SELECT client_secret_hash FROM dashboard_sessions WHERE email = ?`)
    .bind(email)
    .first<{ client_secret_hash: string }>()
  if (!row) return { ok: false, status: 401, message: 'Primero inicia sesión con este correo.' }

  const suppliedSecret = getDashboardClientSecret(request)
  if (!suppliedSecret) return { ok: false, status: 401, message: 'Sesión requerida. Vuelve a entrar con tu correo.' }

  const suppliedHash = await sha256Hex(suppliedSecret)
  if (!(await timingSafeStringEqual(suppliedHash, row.client_secret_hash))) {
    return { ok: false, status: 401, message: 'Sesión inválida. Vuelve a entrar con tu correo.' }
  }

  await env.DB.prepare(`UPDATE dashboard_sessions SET last_used_at = datetime("now") WHERE email = ?`)
    .bind(email)
    .run()
  return { ok: true }
}

async function issueDashboardEmailSession(env: Env, email: string): Promise<{ clientSecret: string }> {
  await ensureDashboardSessionTable(env)
  const clientSecret = createDashboardClientSecret()
  const clientSecretHash = await sha256Hex(clientSecret)
  await env.DB.prepare(
    `INSERT INTO dashboard_sessions (email, client_secret_hash, created_at, last_used_at)
     VALUES (?, ?, datetime("now"), datetime("now"))
     ON CONFLICT(email) DO UPDATE SET
       client_secret_hash = excluded.client_secret_hash,
       last_used_at = datetime("now")`
  )
    .bind(email, clientSecretHash)
    .run()

  return { clientSecret }
}

async function createOrVerifyDashboardEmailSession(
  env: Env,
  request: Request,
  email: string
): Promise<{ ok: true; clientSecret?: string } | { ok: false; status: number; message: string }> {
  if (!isProductionEnv(env)) return { ok: true }

  const suppliedSecret = getDashboardClientSecret(request)
  if (suppliedSecret) {
    const verified = await verifyDashboardEmailAccess(env, request, email)
    if (verified.ok) return { ok: true }
  }

  return { ok: true, ...(await issueDashboardEmailSession(env, email)) }
}

function isEmailAuthRequired(env: Env): boolean {
  return isProductionEnv(env) && isFeatureEnabled(env.EMAIL_AUTH_REQUIRED)
}

function createEmailLoginCode(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const value = new DataView(bytes.buffer).getUint32(0)
  return String(value % 1_000_000).padStart(6, '0')
}

function normalizeRedirectPath(value: unknown): string {
  if (typeof value !== 'string') return '/dashboard'
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/dashboard'
  return trimmed.slice(0, 120)
}

function getAppOrigin(env: Env, request: Request): string {
  return (env.APP_ORIGIN || new URL(request.url).origin).replace(/\/+$/, '')
}

function buildLoginLink(env: Env, request: Request, email: string, token: string, redirectPath: string): string {
  const loginUrl = new URL(redirectPath, getAppOrigin(env, request))
  loginUrl.searchParams.set('email', email)
  loginUrl.searchParams.set('login_token', token)
  return loginUrl.toString()
}

async function sendDashboardLoginEmail(env: Env, email: string, code: string, loginLink: string): Promise<void> {
  if (!env.EMAIL) {
    throw new Error('Cloudflare Email Sending is not configured')
  }

  const fromEmail = env.EMAIL_FROM || 'noreply@mail.finov.ai'
  const text = [
    'Tu acceso a FinovAI',
    '',
    `Código: ${code}`,
    '',
    `También puedes entrar con este enlace: ${loginLink}`,
    '',
    'Este acceso vence en 15 minutos. Si no lo pediste, ignora este correo.',
  ].join('\n')

  await env.EMAIL.send({
    to: email,
    from: { email: fromEmail, name: 'FinovAI' },
    replyTo: fromEmail,
    subject: 'Tu acceso a FinovAI',
    text,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#071326">
        <h1 style="font-size:20px">Tu acceso a FinovAI</h1>
        <p>Usa este código para entrar:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
        <p><a href="${loginLink}">Entrar a FinovAI</a></p>
        <p style="color:#536275">Este acceso vence en 15 minutos. Si no lo pediste, ignora este correo.</p>
      </div>
    `,
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildHouseholdInviteLink(env: Env, request: Request, invite: HouseholdInvite): string {
  const inviteUrl = new URL('/settings', getAppOrigin(env, request))
  inviteUrl.searchParams.set('household_invite', invite.id)
  inviteUrl.searchParams.set('email', invite.inviteeEmail)
  return inviteUrl.toString()
}

async function sendHouseholdInviteEmail(
  env: Env,
  request: Request,
  invite: HouseholdInvite
): Promise<{ emailSent: boolean; inviteUrl: string }> {
  const inviteUrl = buildHouseholdInviteLink(env, request, invite)

  if (!env.EMAIL) {
    if (isProductionEnv(env)) {
      throw new Error('Cloudflare Email Sending is not configured')
    }

    return { emailSent: false, inviteUrl }
  }

  const fromEmail = env.EMAIL_FROM || 'noreply@mail.finov.ai'
  const text = [
    'Te invitaron a FinovAI',
    '',
    `${invite.inviterEmail} quiere preparar contigo un espacio financiero compartido en FinovAI.`,
    '',
    `Abre este enlace con ${invite.inviteeEmail}: ${inviteUrl}`,
    '',
    'Si no esperabas esta invitación, puedes ignorar este correo.',
  ].join('\n')

  await env.EMAIL.send({
    to: invite.inviteeEmail,
    from: { email: fromEmail, name: 'FinovAI' },
    replyTo: fromEmail,
    subject: 'Invitación a FinovAI',
    text,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#071326">
        <h1 style="font-size:20px">Te invitaron a FinovAI</h1>
        <p><strong>${escapeHtml(invite.inviterEmail)}</strong> quiere preparar contigo un espacio financiero compartido en FinovAI.</p>
        <p><a href="${escapeHtml(inviteUrl)}">Abrir invitación</a></p>
        <p style="color:#536275">Entra con ${escapeHtml(invite.inviteeEmail)}. Si no esperabas esta invitación, puedes ignorar este correo.</p>
      </div>
    `,
  })

  return { emailSent: true, inviteUrl }
}

async function createEmailLoginChallenge(
  env: Env,
  request: Request,
  email: string,
  source: string,
  redirectPath: string
): Promise<{ id: string; debugCode?: string; debugToken?: string }> {
  await ensureEmailAuthTables(env)
  const id = crypto.randomUUID()
  const token = createDashboardClientSecret()
  const code = createEmailLoginCode()
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + EMAIL_LOGIN_TTL_SECONDS
  const tokenHash = await sha256Hex(token)
  const codeHash = await sha256Hex(code)
  const normalizedRedirectPath = normalizeRedirectPath(redirectPath)

  await env.DB.prepare(
    `INSERT INTO email_login_challenges (
      id, email, token_hash, code_hash, source, redirect_path, attempts, created_at, expires_at, consumed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`
  )
    .bind(id, email, tokenHash, codeHash, source, normalizedRedirectPath, now, expiresAt)
    .run()

  if (env.EMAIL) {
    await sendDashboardLoginEmail(env, email, code, buildLoginLink(env, request, email, token, normalizedRedirectPath))
    return { id }
  }

  if (new URL(request.url).hostname === 'localhost' || new URL(request.url).hostname === '127.0.0.1') {
    return { id, debugCode: code, debugToken: token }
  }

  throw new Error('Cloudflare Email Sending is not configured')
}

async function findEmailLoginChallenge(
  env: Env,
  email: string,
  input: { code?: string; token?: string }
): Promise<{ ok: true; challenge: EmailLoginChallengeRow } | { ok: false; status: number; message: string }> {
  await ensureEmailAuthTables(env)
  const now = Math.floor(Date.now() / 1000)

  if (input.token) {
    const tokenHash = await sha256Hex(input.token)
    const challenge = await env.DB.prepare(
      `SELECT * FROM email_login_challenges
       WHERE email = ? AND token_hash = ? AND consumed_at IS NULL AND expires_at > ?
       LIMIT 1`
    )
      .bind(email, tokenHash, now)
      .first<EmailLoginChallengeRow>()

    return challenge
      ? { ok: true, challenge }
      : { ok: false, status: 401, message: 'El enlace de acceso expiró o no es válido.' }
  }

  if (!input.code) {
    return { ok: false, status: 400, message: 'Código o enlace requerido.' }
  }

  const challenge = await env.DB.prepare(
    `SELECT * FROM email_login_challenges
     WHERE email = ? AND consumed_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(email, now)
    .first<EmailLoginChallengeRow>()

  if (!challenge) {
    return { ok: false, status: 401, message: 'El código expiró o no es válido.' }
  }
  if (challenge.attempts >= EMAIL_LOGIN_MAX_ATTEMPTS) {
    return { ok: false, status: 429, message: 'Demasiados intentos. Pide un nuevo código.' }
  }

  const suppliedHash = await sha256Hex(input.code)
  if (!(await timingSafeStringEqual(suppliedHash, challenge.code_hash))) {
    await env.DB.prepare(`UPDATE email_login_challenges SET attempts = attempts + 1 WHERE id = ?`)
      .bind(challenge.id)
      .run()
    return { ok: false, status: 401, message: 'Código incorrecto.' }
  }

  return { ok: true, challenge }
}

async function verifyEmailLoginChallenge(
  env: Env,
  email: string,
  input: { code?: string; token?: string }
): Promise<{ ok: true; clientSecret: string } | { ok: false; status: number; message: string }> {
  const result = await findEmailLoginChallenge(env, email, input)
  if (!result.ok) return result

  await env.DB.prepare(`UPDATE email_login_challenges SET consumed_at = ? WHERE id = ?`)
    .bind(Math.floor(Date.now() / 1000), result.challenge.id)
    .run()

  return { ok: true, ...(await issueDashboardEmailSession(env, email)) }
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
    for (const key of [
      'response',
      'data',
      'payload',
      'credential',
      'credentials',
      'user',
      'site',
      'sites',
      'site_organization',
      'site_organizations',
      'organization',
      'organizations',
      'institution',
      'institutions',
      'bank',
      'banks',
      'extra',
    ]) {
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

function firstSyncfyStatusString(payload: unknown, keys: string[]): string | null {
  const value = firstSyncfyString(payload, keys)
  if (!value || /^https?:\/\//i.test(value) || value.length > 80) return null
  return value
}

function lookupKnownSyncfyInstitutionName(...ids: Array<string | null | undefined>): string | null {
  for (const id of ids) {
    if (!id) continue
    const knownName = KNOWN_SYNCFY_INSTITUTION_NAMES.get(id)
    if (knownName) return knownName
  }

  return null
}

function isUsefulSyncfyInstitutionName(value: string): boolean {
  const label = cleanText(value)
  if (!label || label.length < 2 || label.length > 120) return false
  if (/^[a-f0-9]{16,}$/i.test(label) || /^\d+$/.test(label)) return false

  const normalized = normalizeCategoryInput(label).replace(/[^A-Z0-9]+/g, ' ').trim()
  if (!normalized || SYNCFY_GENERIC_INSTITUTION_NAMES.has(normalized)) return false

  return true
}

function firstSyncfyInstitutionName(payload: unknown): string | null {
  for (const record of collectSyncfyRecords(payload)) {
    for (const key of SYNCFY_INSTITUTION_NAME_KEYS) {
      const value = stringFromUnknown(record[key], 160)
      if (value && isUsefulSyncfyInstitutionName(value)) return cleanText(value)
    }
  }

  return null
}

export function extractSyncfySiteMetadata(payload: unknown): SyncfySiteMetadata {
  const syncfySiteId = firstSyncfyString(payload, ['id_site', 'site_id', 'idSite', 'syncfy_site_id'])
  const syncfySiteOrganizationId = firstSyncfyString(payload, [
    'id_site_organization',
    'site_organization_id',
    'idSiteOrganization',
    'syncfy_site_organization_id',
  ])

  return {
    syncfySiteId,
    syncfySiteOrganizationId,
    siteName: firstSyncfyInstitutionName(payload) ||
      lookupKnownSyncfyInstitutionName(syncfySiteId, syncfySiteOrganizationId),
  }
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
  const site = extractSyncfySiteMetadata(payload)

  return {
    syncfyUserId: firstSyncfyString(payload, ['id_user', 'user_id', 'idUser', 'syncfy_user_id']),
    syncfyCredentialId: firstSyncfyString(payload, [
      'id_credential',
      'credential_id',
      'idCredential',
      'syncfy_credential_id',
    ]),
    syncfySiteId: site.syncfySiteId,
    syncfySiteOrganizationId: site.syncfySiteOrganizationId,
    siteName: site.siteName,
    status: firstSyncfyStatusString(payload, ['credential_status', 'status', 'status_code', 'statusCode']),
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

function isSyncfyReconnectRequiredStatus(status: string | null): boolean {
  if (!status) return false
  return /needs[_ -]?reconnect|invalid[_ -]?user|reconnect/i.test(status)
}

async function findEmailBySyncfyUserId(env: Env, syncfyUserId: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT email FROM syncfy_users WHERE syncfy_user_id = ?`)
    .bind(syncfyUserId)
    .first<{ email: string }>()

  return row?.email || null
}

async function findSyncfyUserByEmail(env: Env, email: string): Promise<SyncfyUserRow | null> {
  await ensureSyncfyTables(env)

  return env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
    .bind(email)
    .first<SyncfyUserRow>()
}

async function storeSyncfyCredential(
  env: Env,
  payload: unknown,
  eventType: string,
  fallbackEmail?: string | null
): Promise<SyncfyCredentialRow | null> {
  const credential = extractSyncfyCredentialPayload(payload)
  if (!credential.syncfyCredentialId) return null

  const email = fallbackEmail || (credential.syncfyUserId ? await findEmailBySyncfyUserId(env, credential.syncfyUserId) : null)
  if (!email) return null

  const syncfyUser = credential.syncfyUserId
    ? null
    : await findSyncfyUserByEmail(env, email)
  const syncfyUserId = credential.syncfyUserId || syncfyUser?.syncfy_user_id
  if (!syncfyUserId) return null

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
      syncfyUserId,
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

function addUniqueSyncfyPath(paths: string[], seen: Set<string>, path: string): void {
  const normalizedPath = normalizeSyncfyRequestPath(path)
  if (seen.has(normalizedPath)) return
  seen.add(normalizedPath)
  paths.push(normalizedPath)
}

function normalizeSyncfyJobStatusPath(value: string): string | null {
  const normalizedPath = normalizeSyncfyRequestPath(value)
  return /^\/jobs\/[^/?#]+\/status(?:[?#].*)?$/.test(normalizedPath) ? normalizedPath : null
}

export function getSyncfyJobStatusPaths(payload: unknown): string[] {
  const paths: string[] = []
  const seen = new Set<string>()

  for (const record of collectSyncfyRecords(payload)) {
    for (const key of [
      'status',
      'status_url',
      'statusUrl',
      'job_status',
      'jobStatus',
      'job_status_url',
      'jobStatusUrl',
      'url_status',
      'endpoint_status',
    ]) {
      const value = stringFromUnknown(record[key], 2048)
      if (!value) continue
      const path = normalizeSyncfyJobStatusPath(value)
      if (path) addUniqueSyncfyPath(paths, seen, path)
    }

    for (const key of ['id_job', 'job_id', 'idJob', 'syncfy_job_id']) {
      const jobId = stringFromUnknown(record[key], 256)
      if (!jobId || !/^[a-z0-9_-]+$/i.test(jobId)) continue
      addUniqueSyncfyPath(paths, seen, `/jobs/${jobId}/status`)
    }
  }

  return paths
}

function getSyncfyCredentialJobStatusPaths(credential: SyncfyCredentialRow): string[] {
  if (!credential.raw_json) return []
  return getSyncfyJobStatusPaths(parseJsonUnknown(credential.raw_json))
}

function getSyncfyTransactionLookbackMonths(env: Pick<Env, 'SYNCFY_TRANSACTION_LOOKBACK_MONTHS'>): number {
  const configured = Number(env.SYNCFY_TRANSACTION_LOOKBACK_MONTHS)
  if (Number.isFinite(configured) && configured >= 1 && configured <= 24) {
    return Math.floor(configured)
  }

  return SYNCFY_DEFAULT_TRANSACTION_LOOKBACK_MONTHS
}

export function buildSyncfyTransactionWindow(
  referenceDate = new Date(),
  lookbackMonths = SYNCFY_DEFAULT_TRANSACTION_LOOKBACK_MONTHS
): { from: number; to: number } {
  const to = Number.isFinite(referenceDate.getTime()) ? referenceDate : new Date()
  const from = new Date(to.getTime())
  from.setUTCMonth(from.getUTCMonth() - Math.max(1, Math.floor(lookbackMonths)))
  from.setUTCHours(0, 0, 0, 0)

  return {
    from: Math.floor(from.getTime() / 1000),
    to: Math.floor(to.getTime() / 1000),
  }
}

export function buildSyncfyTransactionsPath(
  credentialId: string,
  syncfyUserId: string,
  skip = 0,
  options: { referenceDate?: Date; lookbackMonths?: number } = {}
): string {
  const window = buildSyncfyTransactionWindow(options.referenceDate, options.lookbackMonths)
  const params = new URLSearchParams({
    id_user: syncfyUserId,
    id_credential: credentialId,
    dt_transaction_from: String(window.from),
    dt_transaction_to: String(window.to),
    limit: String(SYNCFY_DEFAULT_TRANSACTION_LIMIT),
    skip: String(skip),
    order: '-dt_transaction',
  })
  return `/transactions?${params.toString()}`
}

export function buildNextSyncfyTransactionsPageEndpoint(endpoint: string, fetchedCount: number): string | null {
  const normalizedEndpoint = normalizeSyncfyRequestPath(endpoint)
  const [path, query = ''] = normalizedEndpoint.split('?')
  const params = new URLSearchParams(query)
  const limit = Number(params.get('limit') || 0)
  const skip = Number(params.get('skip') || 0)

  if (!Number.isFinite(limit) || limit <= 0 || fetchedCount < limit) return null
  if (!Number.isFinite(skip) || skip < 0) return null

  const nextSkip = skip + limit
  if (nextSkip >= SYNCFY_MAX_TRANSACTION_IMPORT_COUNT) return null

  params.set('skip', String(nextSkip))
  return `${path}?${params.toString()}`
}

export function addSyncfyUserParamToEndpoint(endpoint: string, syncfyUserId: string | null): string {
  if (!syncfyUserId) return endpoint

  const normalizedEndpoint = normalizeSyncfyRequestPath(endpoint)
  const [path, query = ''] = normalizedEndpoint.split('?')
  const params = new URLSearchParams(query)
  if (!params.has('id_user')) {
    params.set('id_user', syncfyUserId)
  }

  const nextQuery = params.toString()
  return nextQuery ? `${path}?${nextQuery}` : path
}

export function isSyncfyTransactionImportComplete(
  result: Pick<SyncfyTransactionImportResult, 'fetched' | 'imported' | 'skipped'>
): boolean {
  return result.imported > 0
}

function getSyncfyTransactionImportMessage(result: SyncfyTransactionImportResult): string {
  if (isSyncfyTransactionImportComplete(result)) {
    return `${result.imported} movimientos sincronizados desde Syncfy.`
  }

  if (result.fetched > 0 && result.skipped >= result.fetched) {
    return 'Syncfy devolvió movimientos, pero FinovAI todavía no pudo leer el formato de esa institución. El equipo debe revisar esa respuesta.'
  }

  return 'La institución quedó conectada. Syncfy todavía está preparando los movimientos; FinovAI reintentará en unos segundos.'
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
  const needsReconnect = isSyncfyReconnectRequiredStatus(credential.status)

  return {
    id: credential.id,
    syncfyCredentialId: credential.syncfy_credential_id,
    siteName: credential.site_name || lookupKnownSyncfyInstitutionName(credential.syncfy_site_id, null),
    status: credential.status,
    lastSuccessfulSyncAt: credential.last_successful_sync_at,
    lastPullAt: credential.last_pull_at,
    cooldownSeconds,
    ready: !needsReconnect && cooldownSeconds === 0,
    needsReconnect,
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

function buildSyncfyCataloguePath(path: string, metadata: SyncfySiteMetadata): string {
  const params = new URLSearchParams()
  if (metadata.syncfySiteId) params.set('id_site', metadata.syncfySiteId)
  if (metadata.syncfySiteOrganizationId) params.set('id_site_organization', metadata.syncfySiteOrganizationId)

  const query = params.toString()
  return query ? `${path}?${query}` : path
}

async function fetchSyncfyInstitutionName(env: Env, metadata: SyncfySiteMetadata): Promise<string | null> {
  const knownName = lookupKnownSyncfyInstitutionName(metadata.syncfySiteId, metadata.syncfySiteOrganizationId)
  if (!env.SYNCFY_API_KEY) return knownName

  const cataloguePaths = [
    buildSyncfyCataloguePath('/catalogues/organizations/sites', metadata),
    metadata.syncfySiteOrganizationId
      ? buildSyncfyCataloguePath('/catalogues/site_organizations', metadata)
      : null,
    buildSyncfyCataloguePath('/catalogues/sites', metadata),
  ].filter((path): path is string => Boolean(path))

  for (const path of cataloguePaths) {
    try {
      const response = await syncfyRequest<unknown>(env, path, { method: 'GET' })
      const siteName = firstSyncfyInstitutionName(response)
      if (siteName) return siteName
    } catch {
      // Institution names are presentational; transaction imports must not fail on catalogue lookup.
    }
  }

  return knownName
}

function mergeSyncfySiteMetadata(
  primary: SyncfySiteMetadata,
  fallback: SyncfySiteMetadata | null
): SyncfySiteMetadata {
  const syncfySiteId = primary.syncfySiteId || fallback?.syncfySiteId || null
  const syncfySiteOrganizationId = primary.syncfySiteOrganizationId || fallback?.syncfySiteOrganizationId || null

  return {
    syncfySiteId,
    syncfySiteOrganizationId,
    siteName: primary.siteName ||
      fallback?.siteName ||
      lookupKnownSyncfyInstitutionName(syncfySiteId, syncfySiteOrganizationId),
  }
}

function getSyncfyCredentialStoredMetadata(credential: SyncfyCredentialRow): SyncfySiteMetadata {
  const rawMetadata = credential.raw_json
    ? extractSyncfySiteMetadata(parseJsonUnknown(credential.raw_json))
    : { syncfySiteId: null, syncfySiteOrganizationId: null, siteName: null }
  const siteName = credential.site_name && isUsefulSyncfyInstitutionName(credential.site_name)
    ? credential.site_name
    : rawMetadata.siteName

  return mergeSyncfySiteMetadata({
    syncfySiteId: credential.syncfy_site_id || rawMetadata.syncfySiteId,
    syncfySiteOrganizationId: rawMetadata.syncfySiteOrganizationId,
    siteName,
  }, rawMetadata)
}

async function findSyncfySiteMetadataFromTransactions(
  env: Env,
  email: string,
  credentialId?: string | null
): Promise<SyncfySiteMetadata | null> {
  const credentialClause = credentialId ? `AND raw_source LIKE ?` : ''
  const statement = env.DB.prepare(
    `SELECT raw_source
     FROM transactions
     WHERE email = ?
       AND source = 'syncfy'
       AND raw_source IS NOT NULL
       ${credentialClause}
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 25`
  )
  const result = credentialId
    ? await statement.bind(email, `%${credentialId}%`).all<{ raw_source: string }>()
    : await statement.bind(email).all<{ raw_source: string }>()

  for (const row of result.results) {
    const metadata = extractSyncfySiteMetadata(parseJsonUnknown(row.raw_source))
    if (metadata.siteName || metadata.syncfySiteId || metadata.syncfySiteOrganizationId) return metadata
  }

  return null
}

async function enrichSyncfyCredentialInstitution(
  env: Env,
  credential: SyncfyCredentialRow,
  metadata: SyncfySiteMetadata
): Promise<boolean> {
  const currentNameIsUseful = credential.site_name ? isUsefulSyncfyInstitutionName(credential.site_name) : false
  const siteName = currentNameIsUseful
    ? null
    : metadata.siteName || await fetchSyncfyInstitutionName(env, metadata)
  const nextSiteId = !credential.syncfy_site_id ? metadata.syncfySiteId : null
  const nextSiteName = siteName && isUsefulSyncfyInstitutionName(siteName) ? siteName : null

  if (!nextSiteId && !nextSiteName) return false

  await env.DB.prepare(
    `UPDATE syncfy_credentials
     SET syncfy_site_id = COALESCE(?, syncfy_site_id),
         site_name = COALESCE(?, site_name),
         updated_at = datetime("now")
     WHERE email = ?
       AND syncfy_credential_id = ?`
  )
    .bind(nextSiteId, nextSiteName, credential.email, credential.syncfy_credential_id)
    .run()

  return true
}

async function enrichSyncfyCredentialInstitutionById(
  env: Env,
  email: string,
  credentialId: string,
  metadata: SyncfySiteMetadata
): Promise<boolean> {
  const credential = await env.DB.prepare(
    `SELECT * FROM syncfy_credentials WHERE email = ? AND syncfy_credential_id = ?`
  )
    .bind(email, credentialId)
    .first<SyncfyCredentialRow>()

  if (!credential) return false
  return enrichSyncfyCredentialInstitution(env, credential, metadata)
}

async function loadDisplaySyncfyCredentialsForEmail(env: Env, email: string): Promise<SyncfyCredentialRow[]> {
  const credentials = await loadSyncfyCredentialsForEmail(env, email)
  const missingLabels = credentials.filter((credential) => (
    !credential.site_name || !isUsefulSyncfyInstitutionName(credential.site_name)
  ))
  if (missingLabels.length === 0) return credentials

  const sharedTransactionMetadata = missingLabels.length === 1
    ? await findSyncfySiteMetadataFromTransactions(env, email)
    : null
  let changed = false

  for (const credential of missingLabels) {
    const credentialTransactionMetadata = await findSyncfySiteMetadataFromTransactions(
      env,
      email,
      credential.syncfy_credential_id
    )
    const metadata = mergeSyncfySiteMetadata(
      getSyncfyCredentialStoredMetadata(credential),
      credentialTransactionMetadata || sharedTransactionMetadata
    )

    if (!metadata.siteName && !metadata.syncfySiteId && !metadata.syncfySiteOrganizationId) continue
    changed = await enrichSyncfyCredentialInstitution(env, credential, metadata) || changed
  }

  return changed ? loadSyncfyCredentialsForEmail(env, email) : credentials
}

async function loadDueSyncfyCredentials(env: Env): Promise<SyncfyCredentialRow[]> {
  await ensureSyncfyTables(env)

  const result = await env.DB.prepare(
    `SELECT * FROM syncfy_credentials
     WHERE COALESCE(status, '') <> 'needs_reconnect'
       AND (
         last_pull_at IS NULL
         OR unixepoch(last_pull_at) <= unixepoch('now') - ?
       )
     ORDER BY COALESCE(last_pull_at, created_at) ASC
     LIMIT ?`
  )
    .bind(SYNCFY_BACKGROUND_REFRESH_INTERVAL_SECONDS, SYNCFY_BACKGROUND_REFRESH_LIMIT)
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
    return 'Syncfy está limitando nuevas sincronizaciones. Intenta de nuevo en unos minutos.'
  }

  if (error.status === 401 || error.status === 403) {
    return 'No pudimos autenticar la conexión con Syncfy. El equipo debe revisar la configuración.'
  }

  if (error.status >= 500) {
    return 'Syncfy no respondió correctamente. Intenta de nuevo más tarde.'
  }

  return 'No pudimos completar la conexión con la institución. Revisa los datos o intenta otra vez.'
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

async function verifySupportAdminAccess(request: Request, env: Env): Promise<boolean> {
  if (!env.SUPPORT_ADMIN_SECRET) {
    return !isProductionEnv(env)
  }

  const suppliedSecret = request.headers.get(SUPPORT_ADMIN_SECRET_HEADER)
  if (!suppliedSecret) return false

  return timingSafeStringEqual(suppliedSecret, env.SUPPORT_ADMIN_SECRET)
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

function isSyncfyInvalidUserError(error: SyncfyRequestError): boolean {
  if (error.status !== 401) return false
  const body = asRecord(error.responseBody)
  const bodyMessage = stringFromUnknown(body?.message)
  return /invalid user/i.test(`${error.message} ${bodyMessage || ''}`)
}

async function recreateSyncfyUser(
  env: Env,
  email: string,
  name?: string,
  externalId = buildSyncfyExternalId(email)
): Promise<SyncfyUserRow> {
  await ensureSyncfyTables(env)

  if (!env.SYNCFY_API_KEY) {
    throw new Error('SYNCFY_API_KEY is not configured')
  }

  const createdUser = await syncfyRequest<{ id_user: string }>(env, '/users', {
    method: 'POST',
    body: JSON.stringify({
      name: name?.trim() || email,
      id_external: externalId,
    }),
  })

  await env.DB.prepare(
    `INSERT INTO syncfy_users (email, syncfy_user_id, syncfy_external_id, name, mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'live', datetime("now"), datetime("now"))
     ON CONFLICT(email) DO UPDATE SET
       syncfy_user_id = excluded.syncfy_user_id,
       syncfy_external_id = excluded.syncfy_external_id,
       name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE syncfy_users.name END,
       mode = 'live',
       updated_at = datetime("now")`
  )
    .bind(email, createdUser.id_user, externalId, name?.trim() || '')
    .run()

  const recreated = await env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
    .bind(email)
    .first<SyncfyUserRow>()

  if (!recreated) {
    throw new Error('Unable to recreate Syncfy user')
  }

  return recreated
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

async function resetSyncfyConnectionForEmail(
  env: Env,
  email: string,
  name?: string
): Promise<{ syncfyUser: SyncfyUserRow | null; recreated: boolean }> {
  await ensureSyncfyTables(env)

  await env.DB.prepare(`DELETE FROM syncfy_credentials WHERE email = ?`)
    .bind(email)
    .run()

  if (!env.SYNCFY_API_KEY) {
    return { syncfyUser: await findSyncfyUserByEmail(env, email), recreated: false }
  }

  try {
    return {
      syncfyUser: await recreateSyncfyUser(env, email, name),
      recreated: true,
    }
  } catch (err) {
    if (err instanceof SyncfyRequestError) {
      await storeSyncfyError(env, {
        email,
        rid: err.rid,
        statusCode: err.status,
        errorCode: err.code,
        message: err.message,
        source: 'syncfy-reset',
        payload: err.responseBody,
      })

      if (err.status === 400) {
        try {
          return {
            syncfyUser: await recreateSyncfyUser(env, email, name, buildSyncfyRecoveryExternalId(email)),
            recreated: true,
          }
        } catch (fallbackErr) {
          if (fallbackErr instanceof SyncfyRequestError) {
            await storeSyncfyError(env, {
              email,
              rid: fallbackErr.rid,
              statusCode: fallbackErr.status,
              errorCode: fallbackErr.code,
              message: fallbackErr.message,
              source: 'syncfy-reset-recovery',
              payload: fallbackErr.responseBody,
            })
            return { syncfyUser: await findSyncfyUserByEmail(env, email), recreated: false }
          }
          throw fallbackErr
        }
      }

      return { syncfyUser: await findSyncfyUserByEmail(env, email), recreated: false }
    }
    throw err
  }
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

function expensesResponse(source: 'sample' | 'syncfy', email: string, expenses: Expense[]) {
  return {
    success: true,
    email,
    source,
    summary: summarizeExpenses(expenses),
    expenses,
    message:
      source === 'sample'
        ? 'Datos de muestra hasta configurar los detalles del endpoint de transacciones de Syncfy.'
        : 'Transacciones cargadas desde Syncfy.',
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
      source, confidence, category_locked, raw_source, cartola_import_id, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'syncfy', 0.9, 0, ?, NULL, datetime("now"), datetime("now"))
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       date = excluded.date,
       type = excluded.type,
       amount = excluded.amount,
       currency = excluded.currency,
       category = CASE
         WHEN transactions.category_locked = 1 AND transactions.type = excluded.type THEN transactions.category
         ELSE excluded.category
       END,
       category_locked = CASE
         WHEN transactions.type = excluded.type THEN transactions.category_locked
         ELSE 0
       END,
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
  syncfyUserId: string | null,
  credentialId: string | null,
  endpoints: string[],
  options: { addSyncfyUserId?: boolean } = {}
): Promise<SyncfyTransactionImportResult> {
  await ensureSyncfyTables(env)
  await ensureFinanceTables(env)

  let fetched = 0
  let imported = 0
  let skipped = 0
  let siteMetadata: SyncfySiteMetadata | null = null
  const fetchedEndpoints: string[] = []

  for (const endpoint of endpoints.slice(0, 20)) {
    let endpointPage: string | null = endpoint

    for (let page = 0; endpointPage && page < SYNCFY_MAX_TRANSACTION_IMPORT_PAGES; page += 1) {
      const requestEndpoint = options.addSyncfyUserId === false
        ? normalizeSyncfyRequestPath(endpointPage)
        : addSyncfyUserParamToEndpoint(endpointPage, syncfyUserId)
      fetchedEndpoints.push(requestEndpoint)

      const response = await syncfyRequest<unknown>(
        env,
        requestEndpoint,
        { method: 'GET' }
      )
      const transactions = extractSyncfyTransactions(response)
      fetched += transactions.length

      for (const [index, rawTransaction] of transactions.entries()) {
        if (!siteMetadata) {
          const metadata = extractSyncfySiteMetadata(rawTransaction)
          if (metadata.siteName || metadata.syncfySiteId || metadata.syncfySiteOrganizationId) {
            siteMetadata = metadata
          }
        }

        const normalized = normalizeSyncfyTransaction(rawTransaction, credentialId, fetched - transactions.length + index)
        if (!normalized) {
          skipped += 1
          continue
        }

        await upsertSyncfyFinanceTransaction(env, email, normalized)
        imported += 1
      }

      endpointPage = buildNextSyncfyTransactionsPageEndpoint(endpointPage, transactions.length)
    }
  }

  if (credentialId && siteMetadata) {
    await enrichSyncfyCredentialInstitutionById(env, email, credentialId, siteMetadata)
  }

  return { credentialId, fetched, imported, skipped, endpoints: fetchedEndpoints }
}

function mergeSyncfyTransactionImportResults(
  left: SyncfyTransactionImportResult,
  right: SyncfyTransactionImportResult
): SyncfyTransactionImportResult {
  return {
    credentialId: left.credentialId || right.credentialId,
    fetched: left.fetched + right.fetched,
    imported: left.imported + right.imported,
    skipped: left.skipped + right.skipped,
    endpoints: [...left.endpoints, ...right.endpoints],
  }
}

async function importSyncfyTransactionsFromJobStatuses(
  env: Env,
  email: string,
  syncfyUserId: string | null,
  credentialId: string | null,
  jobStatusPaths: string[]
): Promise<SyncfyTransactionImportResult> {
  let result: SyncfyTransactionImportResult = {
    credentialId,
    fetched: 0,
    imported: 0,
    skipped: 0,
    endpoints: [],
  }

  for (const jobStatusPath of jobStatusPaths.slice(0, 10)) {
    const normalizedPath = normalizeSyncfyRequestPath(jobStatusPath)
    const jobStatus = await syncfyRequest<unknown>(env, normalizedPath, { method: 'GET' })
    result = {
      ...result,
      endpoints: [...result.endpoints, normalizedPath],
    }

    const transactionEndpoints = getSyncfyWebhookEndpointPaths(jobStatus, 'transactions')
    if (transactionEndpoints.length === 0) continue

    const endpointResult = await importSyncfyTransactionsFromEndpoints(
      env,
      email,
      syncfyUserId,
      credentialId,
      transactionEndpoints,
      { addSyncfyUserId: false }
    )
    result = mergeSyncfyTransactionImportResults(result, endpointResult)
  }

  return result
}

async function importSyncfyTransactionsForCredential(
  env: Env,
  email: string,
  syncfyUserId: string,
  credentialId: string,
  options: { jobStatusPaths?: string[] } = {}
): Promise<SyncfyTransactionImportResult> {
  let jobStatusResult: SyncfyTransactionImportResult | null = null

  if (options.jobStatusPaths?.length) {
    jobStatusResult = await importSyncfyTransactionsFromJobStatuses(
      env,
      email,
      syncfyUserId,
      credentialId,
      options.jobStatusPaths
    )

    if (isSyncfyTransactionImportComplete(jobStatusResult)) {
      return jobStatusResult
    }
  }

  const directResult = await importSyncfyTransactionsFromEndpoints(
    env,
    email,
    syncfyUserId,
    credentialId,
    [buildSyncfyTransactionsPath(credentialId, syncfyUserId, 0, {
      lookbackMonths: getSyncfyTransactionLookbackMonths(env),
    })]
  )

  return jobStatusResult ? mergeSyncfyTransactionImportResults(jobStatusResult, directResult) : directResult
}

async function markSyncfyCredentialSyncSuccess(
  env: Env,
  email: string,
  credentialId: string
): Promise<void> {
  await env.DB.prepare(
    `UPDATE syncfy_credentials
     SET last_pull_at = datetime("now"),
         last_successful_sync_at = datetime("now"),
         status = COALESCE(NULLIF(status, ''), 'synced'),
         updated_at = datetime("now")
     WHERE email = ? AND syncfy_credential_id = ?`
  )
    .bind(email, credentialId)
    .run()
}

async function markSyncfyCredentialSyncPending(
  env: Env,
  email: string,
  credentialId: string
): Promise<void> {
  await env.DB.prepare(
    `UPDATE syncfy_credentials
     SET status = 'pending_transactions',
         updated_at = datetime("now")
     WHERE email = ? AND syncfy_credential_id = ?`
  )
    .bind(email, credentialId)
    .run()
}

async function markSyncfyCredentialSyncError(
  env: Env,
  email: string,
  credentialId: string,
  status: string
): Promise<void> {
  await env.DB.prepare(
    `UPDATE syncfy_credentials
     SET last_pull_at = datetime("now"),
         status = ?,
         updated_at = datetime("now")
     WHERE email = ? AND syncfy_credential_id = ?`
  )
    .bind(status, email, credentialId)
    .run()
}

async function refreshDueSyncfyCredentials(env: Env): Promise<{
  checked: number
  imported: number
  failed: number
}> {
  if (!env.SYNCFY_API_KEY) return { checked: 0, imported: 0, failed: 0 }

  const dueCredentials = await loadDueSyncfyCredentials(env)
  let imported = 0
  let failed = 0

  for (const credential of dueCredentials) {
    try {
      const result = await importSyncfyTransactionsForCredential(
        env,
        credential.email,
        credential.syncfy_user_id,
        credential.syncfy_credential_id,
        { jobStatusPaths: getSyncfyCredentialJobStatusPaths(credential) }
      )
      imported += result.imported
      if (isSyncfyTransactionImportComplete(result)) {
        await markSyncfyCredentialSyncSuccess(env, credential.email, credential.syncfy_credential_id)
      } else {
        await markSyncfyCredentialSyncPending(env, credential.email, credential.syncfy_credential_id)
      }
    } catch (err) {
      failed += 1
      if (err instanceof SyncfyRequestError) {
        await storeSyncfyError(env, {
          email: credential.email,
          syncfyUserId: credential.syncfy_user_id,
          syncfyCredentialId: credential.syncfy_credential_id,
          rid: err.rid,
          statusCode: err.status,
          errorCode: err.code,
          message: err.message,
          source: 'syncfy-scheduled-refresh',
          payload: err.responseBody,
        })
        await markSyncfyCredentialSyncError(
          env,
          credential.email,
          credential.syncfy_credential_id,
          err.status === 401 ? 'needs_reconnect' : 'sync_error'
        )
      } else {
        throw err
      }
    }
  }

  return { checked: dueCredentials.length, imported, failed }
}

async function ensureFinanceTables(env: Env): Promise<void> {
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
      currency TEXT NOT NULL DEFAULT 'CLP',
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

function normalizeProfileMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : normalizeFinancialAmount(value)
  if (!Number.isFinite(number) || number < 0) return null
  return roundMoney(number)
}

function normalizeCategoryBudgets(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const normalized: Record<string, number> = {}
  for (const [key, rawAmount] of Object.entries(value as Record<string, unknown>)) {
    const category = normalizeRequestedFinanceCategory(key, 'expense')
    const amount = normalizeProfileMoney(rawAmount)
    if (!category || !amount || amount <= 0) continue
    normalized[category] = amount
  }

  return normalized
}

function parseCategoryBudgets(jsonValue: string | null | undefined): Record<string, number> {
  if (!jsonValue) return {}
  try {
    return normalizeCategoryBudgets(JSON.parse(jsonValue))
  } catch {
    return {}
  }
}

function financialProfileRowToApi(row: FinancialProfileRow | null, email: string): FinancialProfile {
  return {
    email,
    currency: row?.currency || DEFAULT_FINANCE_CURRENCY,
    monthlyIncome: normalizeProfileMoney(row?.monthly_income),
    monthlyBudget: normalizeProfileMoney(row?.monthly_budget),
    categoryBudgets: parseCategoryBudgets(row?.category_budgets_json),
  }
}

async function loadFinancialProfile(env: Env, email: string): Promise<FinancialProfile> {
  await ensureFinanceTables(env)
  await upsertFinancialProfile(env, email)

  const row = await env.DB.prepare(
    `SELECT * FROM financial_profiles WHERE email = ?`
  )
    .bind(email)
    .first<FinancialProfileRow>()

  return financialProfileRowToApi(row, email)
}

async function updateFinancialProfile(
  env: Env,
  email: string,
  input: {
    currency?: unknown
    monthlyIncome?: unknown
    monthlyBudget?: unknown
    categoryBudgets?: unknown
  }
): Promise<FinancialProfile> {
  await ensureFinanceTables(env)
  await upsertFinancialProfile(env, email)

  const current = await loadFinancialProfile(env, email)
  const currency = typeof input.currency === 'string' && input.currency.trim()
    ? input.currency.trim().toUpperCase().slice(0, 8)
    : current.currency
  const monthlyIncome = Object.prototype.hasOwnProperty.call(input, 'monthlyIncome')
    ? normalizeProfileMoney(input.monthlyIncome)
    : current.monthlyIncome
  const monthlyBudget = Object.prototype.hasOwnProperty.call(input, 'monthlyBudget')
    ? normalizeProfileMoney(input.monthlyBudget)
    : current.monthlyBudget
  const categoryBudgets = Object.prototype.hasOwnProperty.call(input, 'categoryBudgets')
    ? normalizeCategoryBudgets(input.categoryBudgets)
    : current.categoryBudgets

  await env.DB.prepare(
    `UPDATE financial_profiles
     SET currency = ?,
         monthly_income = ?,
         monthly_budget = ?,
         category_budgets_json = ?,
         updated_at = datetime("now")
     WHERE email = ?`
  )
    .bind(
      currency,
      monthlyIncome,
      monthlyBudget,
      JSON.stringify(categoryBudgets),
      email
    )
    .run()

  return {
    email,
    currency,
    monthlyIncome,
    monthlyBudget,
    categoryBudgets,
  }
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
  const category = row.category_locked
    ? row.category
    : resolveFinanceCategory(row.category, row.description, row.merchant, row.type, row.source)

  return {
    id: row.id,
    email: row.email,
    date: row.date,
    type: row.type,
    amount: Number(row.amount),
    currency: row.currency,
    category,
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

const FIXED_EXPENSE_CATEGORIES = new Set(['Deuda', 'Hogar', 'Suscripciones', 'Impuestos', 'Salud'])

function getTransactionMonths(transactions: FinanceTransaction[]): string[] {
  return [...new Set(transactions.map((transaction) => transaction.date.slice(0, 7)).filter(Boolean))]
    .sort()
    .reverse()
}

export function buildFinanceDataCoverage(transactions: Array<Pick<FinanceTransaction, 'date'>>): FinanceDataCoverage {
  const dates = transactions
    .map((transaction) => transaction.date)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
  const months = [...new Set(dates.map((date) => date.slice(0, 7)))]

  return {
    firstDate: dates[0] || null,
    lastDate: dates.at(-1) || null,
    firstMonth: months[0] || null,
    lastMonth: months.at(-1) || null,
    monthCount: months.length,
    transactionCount: transactions.length,
    preliminary: months.length < 3 || transactions.length < 30,
  }
}

function formatAnalysisMonth(month: string) {
  const [year, monthNumber] = month.split('-')
  const monthIndex = Number(monthNumber) - 1
  if (!year || !Number.isFinite(monthIndex)) return month
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
    .format(new Date(Number(year), monthIndex, 1))
}

function getMonthTotals(transactions: FinanceTransaction[], month: string) {
  const categoryTotals = new Map<string, number>()
  let spendingTotal = 0
  let incomeTotal = 0
  let fixedExpenseTotal = 0

  for (const transaction of transactions) {
    if (!transaction.date.startsWith(month)) continue
    if (transaction.type === 'income') {
      incomeTotal += transaction.amount
      continue
    }

    spendingTotal += transaction.amount
    categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) || 0) + transaction.amount)
    if (FIXED_EXPENSE_CATEGORIES.has(transaction.category)) {
      fixedExpenseTotal += transaction.amount
    }
  }

  const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin datos'

  return {
    categoryTotals,
    spendingTotal: roundMoney(spendingTotal),
    incomeTotal: roundMoney(incomeTotal),
    fixedExpenseTotal: roundMoney(fixedExpenseTotal),
    topCategory,
  }
}

function resolveBudgetTotal(profile: FinancialProfile, incomeTotal: number): { value: number | null; source: BudgetSource } {
  if (profile.monthlyBudget && profile.monthlyBudget > 0) return { value: profile.monthlyBudget, source: 'user' }

  const income = profile.monthlyIncome || incomeTotal
  if (income > 0) return { value: roundMoney(income * 0.8), source: 'income_rule' }

  return { value: null, source: 'missing' }
}

function getBudgetStatus(amount: number, budget: number | null): CategoryBudgetStatus {
  if (!budget || budget <= 0) return 'unset'
  if (amount > budget) return 'over'
  if (amount / budget >= 0.85) return 'near'
  return 'under'
}

function buildCategoryAdvice(
  category: string,
  amount: number,
  previousAmount: number,
  budget: number | null,
  budgetStatus: CategoryBudgetStatus,
  currency: string
) {
  if (budgetStatus === 'over' && budget) {
    return `${category} está ${formatFinanceCurrency(amount - budget, currency)} sobre presupuesto. Revisa los movimientos principales antes de cerrar el mes.`
  }
  if (budgetStatus === 'near') {
    return `${category} está cerca del tope. Define una pausa o límite semanal para no pasarte.`
  }
  if (previousAmount > 0 && amount > previousAmount) {
    return `${category} subió ${formatFinanceCurrency(amount - previousAmount, currency)} frente al mes anterior. Revisa si fue puntual o nuevo patrón.`
  }
  if (!budget) {
    return `Sin presupuesto asignado para ${category}. Agrega un tope para comparar este gasto con una meta real.`
  }
  return `${category} sigue dentro del presupuesto. Mantén el seguimiento durante el mes.`
}

export function buildCategoryAnalysis(
  transactions: FinanceTransaction[],
  summary: FinanceSummary,
  profile: FinancialProfile
): CategoryAnalysis {
  const months = getTransactionMonths(transactions)
  const period = summary.month || months[0] || new Date().toISOString().slice(0, 7)
  const previousPeriod = months.find((month) => month < period) || null
  const current = getMonthTotals(transactions, period)
  const previous = previousPeriod ? getMonthTotals(transactions, previousPeriod) : null
  const budget = resolveBudgetTotal(profile, current.incomeTotal)
  const incomeForGuidance = profile.monthlyIncome || current.incomeTotal
  const fixedExpenseShare = incomeForGuidance > 0
    ? Math.round((current.fixedExpenseTotal / incomeForGuidance) * 100)
    : null
  const fixedExpenseLimit = incomeForGuidance > 0 ? roundMoney(incomeForGuidance * 0.5) : null
  const currency = profile.currency || transactions[0]?.currency || DEFAULT_FINANCE_CURRENCY
  const spendingShareDenominator = current.spendingTotal || 1
  const categoryBudgets = profile.categoryBudgets

  const categories = [...current.categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => {
      const roundedAmount = roundMoney(amount)
      const previousAmount = roundMoney(previous?.categoryTotals.get(category) || 0)
      const categoryBudget = categoryBudgets[category] || null
      const budgetStatus = getBudgetStatus(roundedAmount, categoryBudget)

      return {
        category,
        amount: roundedAmount,
        share: Math.round((roundedAmount / spendingShareDenominator) * 100),
        previousAmount,
        deltaFromPrevious: roundMoney(roundedAmount - previousAmount),
        budget: categoryBudget,
        budgetUsage: categoryBudget ? Math.round((roundedAmount / categoryBudget) * 100) : null,
        budgetStatus,
        advice: buildCategoryAdvice(category, roundedAmount, previousAmount, categoryBudget, budgetStatus, currency),
      }
    })

  const summaryAdvice = (() => {
    if (budget.source === 'missing') {
      return 'Falta tu ingreso y presupuesto mensual. Agrega esos datos para comparar el gasto contra una meta real.'
    }
    if (fixedExpenseShare !== null && fixedExpenseShare > 50) {
      return `Tus gastos fijos son ${fixedExpenseShare}% de tus ingresos. Intenta mantenerlos bajo 50%.`
    }
    if (budget.value && current.spendingTotal > budget.value) {
      return `Este mes estás ${formatFinanceCurrency(current.spendingTotal - budget.value, currency)} sobre presupuesto. Prioriza las categorías excedidas.`
    }
    if (budget.source === 'income_rule') {
      return `Aún no tienes presupuesto guardado. FinovAI propone partir con ${formatFinanceCurrency(budget.value || 0, currency)} como tope mensual.`
    }
    return `Vas dentro del presupuesto mensual. Revisa las categorías que crecieron frente al mes anterior.`
  })()

  const monthRows = months.map((month, index) => {
    const totals = getMonthTotals(transactions, month)
    const nextMonth = months[index + 1]
    const previousTotals = nextMonth ? getMonthTotals(transactions, nextMonth) : null
    const monthBudget = resolveBudgetTotal(profile, totals.incomeTotal).value

    return {
      month,
      spendingTotal: totals.spendingTotal,
      incomeTotal: totals.incomeTotal,
      topCategory: totals.topCategory,
      deltaFromPrevious: previousTotals ? roundMoney(totals.spendingTotal - previousTotals.spendingTotal) : null,
      budgetTotal: monthBudget,
      status: getBudgetStatus(totals.spendingTotal, monthBudget),
    }
  })

  return {
    period,
    periodLabel: formatAnalysisMonth(period),
    previousPeriod,
    spendingTotal: current.spendingTotal,
    incomeTotal: current.incomeTotal,
    budgetTotal: budget.value,
    budgetSource: budget.source,
    fixedExpenseShare,
    fixedExpenseLimit,
    summaryAdvice,
    categories,
    monthRows,
  }
}

async function getFinanceDashboard(env: Env, email: string) {
  await ensureFinanceTables(env)
  await upsertFinancialProfile(env, email)

  const profile = await loadFinancialProfile(env, email)
  const transactions = await loadFinanceTransactions(env, email)
  const summary = buildFinancialSummary(transactions)
  const categoryAnalysis = buildCategoryAnalysis(transactions, summary, profile)
  const insights = buildFinancialInsights(summary, transactions, profile)
  const actionPlan = buildActionPlan(summary, transactions)

  return {
    success: true,
    email,
    transactions,
    profile,
    summary,
    categoryAnalysis,
    insights,
    actionPlan,
  }
}

export function buildExpenseCategoryBreakdown(
  transactions: Array<Pick<FinanceTransaction, 'type' | 'date' | 'category' | 'amount'>>,
  month?: string | null
) {
  const totals = new Map<string, { category: string; amount: number; count: number }>()

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    if (month && !transaction.date.startsWith(month)) continue

    const current = totals.get(transaction.category) || {
      category: transaction.category,
      amount: 0,
      count: 0,
    }
    current.amount += transaction.amount
    current.count += 1
    totals.set(transaction.category, current)
  }

  const totalAmount = [...totals.values()].reduce((sum, item) => sum + item.amount, 0)

  return [...totals.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      category: item.category,
      amount: roundMoney(item.amount),
      count: item.count,
      share: totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0,
    }))
}

export function buildDashboardChatContext(dashboard: Awaited<ReturnType<typeof getFinanceDashboard>>): string {
  const transactions = dashboard.transactions.slice(0, 80).map((transaction) => (
    `${transaction.date} | ${transaction.type} | ${transaction.currency} ${transaction.amount} | ${transaction.category} | ${transaction.description}`
  ))

  return JSON.stringify({
    email: dashboard.email,
    profile: dashboard.profile,
    summary: dashboard.summary,
    categoryAnalysis: dashboard.categoryAnalysis,
    insights: dashboard.insights,
    actionPlan: dashboard.actionPlan,
    analysisWindow: {
      ...dashboard.summary.dataCoverage,
      rule: 'Menciona esta cobertura cuando respondas preguntas amplias sobre patrones. Si el historial es preliminar, aclara que la lectura es direccional y pide sincronizar más historial.',
    },
    categoryBreakdown: {
      allExpenses: buildExpenseCategoryBreakdown(dashboard.transactions),
      currentMonth: buildExpenseCategoryBreakdown(dashboard.transactions, dashboard.summary.month),
      rule: 'Use allExpenses for category/rubro questions unless the user explicitly asks about the current month.',
    },
    transactions,
    transactionCount: dashboard.transactions.length,
  })
}

async function answerDashboardChatWithAnthropic(
  env: Env,
  question: string,
  dashboard: Awaited<ReturnType<typeof getFinanceDashboard>>,
  allowLocalFallback: boolean
): Promise<{ answer: string; model: string }> {
  const model = getDashboardChatModel(env)
  const answer = await runAIResponse(env, [
    { role: 'system', content: DASHBOARD_CHAT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Pregunta del usuario: ${question}\n\nDatos financieros disponibles:\n${buildDashboardChatContext(dashboard)}`,
    },
  ], allowLocalFallback)

  return { answer, model }
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
  const requestedCategory = normalizeRequestedFinanceCategory(input.category, type)
  const inferredCategory = resolveFinanceCategory(cleanText(input.category), description, merchant, type, source)
  const category = source === 'manual'
    ? requestedCategory || inferredCategory
    : inferredCategory
  const categoryLocked = source === 'manual' && requestedCategory ? 1 : 0
  const notes = cleanText(input.notes)

  if (!date) {
    throw new Error('Fecha inválida')
  }
  if (amount <= 0) {
    throw new Error('Monto inválido')
  }
  if (!category) {
    throw new Error('Categoría inválida')
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO transactions (
      id, email, date, type, amount, currency, category, description, merchant, notes,
      source, confidence, category_locked, raw_source, cartola_import_id, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`
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
      categoryLocked,
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

function getFinanceCategoriesForType(type: FinanceTransactionType): string[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

function normalizeRequestedFinanceCategory(value: unknown, type: FinanceTransactionType): string | null {
  const requested = cleanText(value)
  if (!requested) return null

  const normalizedRequested = normalizeCategoryInput(requested)
  return getFinanceCategoriesForType(type).find((category) => (
    normalizeCategoryInput(category) === normalizedRequested
  )) || null
}

async function updateFinanceTransactionCategory(
  env: Env,
  email: string,
  transactionId: string,
  category: unknown
): Promise<{ transaction: FinanceTransaction; updatedCount: number } | null> {
  const existing = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND email = ?`)
    .bind(transactionId, email)
    .first<FinanceTransactionRow>()

  if (!existing) return null

  const nextCategory = normalizeRequestedFinanceCategory(category, existing.type)
  if (!nextCategory) {
    throw new Error('Categoría inválida')
  }
  const previousCategory = existing.category

  const primaryUpdate = await env.DB.prepare(
    `UPDATE transactions
     SET category = ?,
         category_locked = 1,
         updated_at = datetime("now")
     WHERE id = ?
       AND email = ?`
  )
    .bind(nextCategory, transactionId, email)
    .run()

  let updatedCount = Number(primaryUpdate.meta?.changes || 1)
  const merchant = cleanText(existing.merchant)

  if (merchant) {
    const merchantUpdate = await env.DB.prepare(
      `UPDATE transactions
       SET category = ?,
           category_locked = 1,
           updated_at = datetime("now")
       WHERE email = ?
         AND type = ?
         AND merchant = ?
         AND id <> ?
         AND (COALESCE(category_locked, 0) = 0 OR category = ?)`
    )
      .bind(nextCategory, email, existing.type, merchant, transactionId, previousCategory)
      .run()
    updatedCount += Number(merchantUpdate.meta?.changes || 0)
  }

  const updated = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND email = ?`)
    .bind(transactionId, email)
    .first<FinanceTransactionRow>()

  return updated ? { transaction: transactionRowToApi(updated), updatedCount } : null
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

  if (/(UBER EATS|DLO\*?UBER EATS|RAPPI|PEDIDOSYA|DELIVERY|RESTAUR|RESTA|REST |RESTMONARCH|PASTA|SUSHI|PESCAD|TAQU|TACO|ASADO|PIZZA|DOMINO|KFC|CAFE|COFFEE|STARBUCKS|COMIDA|BAR |CERVECER|FISHER|DOCENA|AROMI|SAPORI|BALCON DEL ZOCALO|PASTELERIA|HELADOS|LE PAIN|VINATA|SIGNORA|SONORA GRILL|JAPANTOWN|SIEMBRA)/.test(value)) return 'Comida fuera'
  if (/(NETFLIX|SPOTIFY|YOUTUBE|APPLE|GOOGLE|PRIME|DISNEY|HBO|OPENAI|MICROSOFT|ADOBE|ZOOM|FIGMA|SUBSCRIP|SUSCRIP)/.test(value)) return 'Suscripciones'
  if (/(AMERICAN EXPRESS|AMEX|PAGO TARJETA|TARJETA DE CREDITO|TDC|CREDITO 0*\d{3,}|GRACIAS POR SU PAGO|PLAN DE PAGOS DIFERIDOS|COMISION POR PLAN DE PAGOS DIFERIDOS|COMISION POR PLAN|IVA APLICABLE|SERVICIO DE FACTURACION|REVERSION CARGO)/.test(value)) return 'Deuda'
  if (/(SPEI ENVIADO|TRANSFERENCIA ENVIADA|PAGO CUENTA DE TERCERO|TRASPASO|STP|PAGO TERCERO)/.test(value)) return 'Transferencias'
  if (/(RETIRO CAJERO|RET CAJ|CAJERO AUTOMATICO|ATM)/.test(value)) return 'Retiros'
  if (/(UBER RIDE|UBER RIDES|DLO\*?TDA UBER RIDES|DLO\*?UBER RIDES|DIDI|TAXI|CABIFY|METRO|BENCINA|GASOLINA|COPEC|SHELL|PETROBRAS|TRANSPORTE|PEMEX)/.test(value)) return 'Transporte'
  if (/(SUPERMERCADO|JUMBO|LIDER|SANTA ISABEL|UNIMARC|TOTTUS|WALMART|WM EXPRESS|SUPERAMA|SAMS|COSTCO|CHEDRAUI|OXXO|MERCADO|ESTADO NATURAL)/.test(value)) return 'Supermercado'
  if (/(FARMACIA|HOSPITAL|CLINICA|MEDIC|SALUD|SOFIA|GYMPASS|GIMNASIO|FITNESS|PEDIATR|CLUB DEPORTIVO|CUICACALLI)/.test(value)) return 'Salud'
  if (/(ARRIENDO|RENTA|DIVIDENDO|HIPOTECA|LUZ|AGUA|GAS|INTERNET|TELCO|HOGAR|CFE|TELCEL)/.test(value)) return 'Hogar'
  if (/(COLEGIO|UNIVERSIDAD|EDUCACION|CURSO)/.test(value)) return 'Educación'
  if (/(IMPUESTO|SAT|SII|TESORERIA)/.test(value)) return 'Impuestos'
  if (/(ONLYFANS|CINE|CINEMEX|CINEPOLIS|TICKETMASTER|PALACIO DEPORTES|AUDITORIO|TEATRO|CONCIERTO|EVENTO|JUEGO|GAMING)/.test(value)) return 'Ocio'
  if (/(AMAZON|MERCADOPAGO|MERPAGO|LIVERPOOL|PALACIO|SEARS|SHOP|STORE|TIENDA|STRIPE|ADIDAS|LEVIS|HM MX|H M |FLORERIA|BOUT )/.test(value)) return 'Compras'

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
    dataCoverage: buildFinanceDataCoverage(transactions),
    topSpendingCategory,
    topSpendingCategoryAmount: roundMoney(topSpendingCategoryAmount),
    unusualHighSpendDay,
    recurringExpenses,
    estimatedSavingsOpportunity: Math.round(discretionaryTotal * 0.1 + recurringTotal * 0.25),
  }
}

export function buildFinancialInsights(
  summary: FinanceSummary,
  transactions: FinanceTransaction[],
  profile?: FinancialProfile
): FinanceInsight[] {
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

  const effectiveIncome = summary.monthlyIncome || profile?.monthlyIncome || 0
  const effectiveNetBalance = roundMoney(effectiveIncome - summary.monthlySpending)
  const insights: FinanceInsight[] = effectiveIncome > 0
    ? [{
      id: 'net-balance',
      title: 'Balance mensual',
      value: formatFinanceCurrency(effectiveNetBalance, profile?.currency),
      body: `Ingresos ${formatFinanceCurrency(effectiveIncome, profile?.currency)} menos gastos ${formatFinanceCurrency(summary.monthlySpending, profile?.currency)}.`,
      tone: effectiveNetBalance >= 0 ? 'good' : 'urgent',
    }]
    : [{
      id: 'income-missing',
      title: 'Falta ingreso',
      value: 'Completa perfil',
      body: 'Agrega tu ingreso mensual y presupuesto para comparar este gasto contra una meta real.',
      tone: 'watch',
    }]

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
      body: `Ese día salieron ${formatFinanceCurrency(summary.unusualHighSpendDay.amount, profile?.currency)}. Analiza si fue un gasto extraño o un patrón nuevo.`,
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

export function buildActionPlan(summary: FinanceSummary, transactions: FinanceTransaction[]): FinanceActionPlan {
  const opportunities = buildFinanceOpportunities(summary, transactions)
  const monthlySavingsTarget = roundMoney(
    opportunities.slice(0, 3).reduce((sum, opportunity) => sum + opportunity.estimatedMonthlySavings, 0)
  )
  const investmentProjection = projectInvestmentContribution(monthlySavingsTarget)

  return {
    monthlySavingsTarget,
    topOpportunities: opportunities.slice(0, 4),
    investmentProjection,
    nextActions: buildFinanceNextActions(monthlySavingsTarget, opportunities, transactions.length),
  }
}

function buildFinanceOpportunities(
  summary: FinanceSummary,
  transactions: FinanceTransaction[]
): FinanceOpportunity[] {
  if (transactions.length === 0) return []

  const latestMonth = summary.month
  const currentMonthExpenses = transactions.filter((transaction) => (
    transaction.type === 'expense' && transaction.date.startsWith(latestMonth)
  ))
  const opportunities: FinanceOpportunity[] = []

  for (const recurring of summary.recurringExpenses.slice(0, 3)) {
    const estimatedMonthlySavings = roundMoney(Math.max(recurring.amount * 0.5, 0))
    if (estimatedMonthlySavings <= 0) continue
    opportunities.push({
      id: `recurring:${recurring.key}`,
      kind: 'recurring',
      title: `Revisar ${recurring.description}`,
      body: `${recurring.count} cargos similares detectados. Cancela, baja plan o confirma que sigue siendo necesario.`,
      sourceLabel: recurring.description,
      estimatedMonthlySavings,
    })
  }

  const merchantTotals = new Map<string, { merchant: string; amount: number; count: number; category: string }>()
  const categoryTotals = new Map<string, number>()
  const monthlySpending = Math.max(summary.monthlySpending, 1)

  for (const transaction of currentMonthExpenses) {
    categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) || 0) + transaction.amount)

    if (!DISCRETIONARY_CATEGORIES.has(transaction.category)) continue
    const merchant = cleanText(transaction.merchant) || cleanText(transaction.description)
    const merchantKey = normalizeRecurringKey(merchant)
    if (!merchantKey) continue

    const current = merchantTotals.get(merchantKey) || {
      merchant,
      amount: 0,
      count: 0,
      category: transaction.category,
    }
    current.amount += transaction.amount
    current.count += 1
    merchantTotals.set(merchantKey, current)
  }

  for (const [merchantKey, merchant] of merchantTotals.entries()) {
    if (merchant.count < 2 || merchant.amount / monthlySpending < 0.04) continue
    const estimatedMonthlySavings = roundMoney(merchant.amount * 0.2)
    opportunities.push({
      id: `merchant:${merchantKey}`,
      kind: 'merchant_leak',
      title: `Bajar frecuencia en ${merchant.merchant}`,
      body: `${merchant.count} cargos este mes en ${merchant.category}. Reducir una parte crea margen sin cambiar todo el presupuesto.`,
      sourceLabel: merchant.merchant,
      estimatedMonthlySavings,
    })
  }

  for (const [category, amount] of [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    if (!DISCRETIONARY_CATEGORIES.has(category) || amount / monthlySpending < 0.15) continue
    const estimatedMonthlySavings = roundMoney(amount * 0.1)
    opportunities.push({
      id: `category:${normalizeRecurringKey(category)}`,
      kind: 'category_leak',
      title: `Tope suave para ${category}`,
      body: `${formatFinanceCurrency(amount)} concentrados en ${category} durante ${summary.month}. Empieza con una reducción conservadora del 10%.`,
      sourceLabel: category,
      estimatedMonthlySavings,
    })
  }

  if (summary.unusualHighSpendDay && summary.unusualHighSpendDay.amount / monthlySpending >= 0.25) {
    opportunities.push({
      id: `unusual-day:${summary.unusualHighSpendDay.date}`,
      kind: 'unusual_day',
      title: 'Revisar día atípico',
      body: `El ${summary.unusualHighSpendDay.date} salió ${formatFinanceCurrency(summary.unusualHighSpendDay.amount)}. Si no fue puntual, conviértelo en regla.`,
      sourceLabel: summary.unusualHighSpendDay.date,
      estimatedMonthlySavings: roundMoney(summary.unusualHighSpendDay.amount * 0.1),
    })
  }

  return dedupeFinanceOpportunities(opportunities)
    .sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings)
}

function dedupeFinanceOpportunities(opportunities: FinanceOpportunity[]): FinanceOpportunity[] {
  const seen = new Set<string>()
  const result: FinanceOpportunity[] = []

  for (const opportunity of opportunities) {
    if (opportunity.estimatedMonthlySavings <= 0 || seen.has(opportunity.id)) continue
    seen.add(opportunity.id)
    result.push(opportunity)
  }

  return result
}

function projectInvestmentContribution(
  monthlyContribution: number,
  years = 10,
  annualReturn = 0.08
): FinanceActionPlan['investmentProjection'] {
  const roundedContribution = roundMoney(monthlyContribution)
  const months = years * 12
  const monthlyReturn = annualReturn / 12
  let value = 0

  for (let month = 0; month < months; month += 1) {
    value = (value + roundedContribution) * (1 + monthlyReturn)
  }

  const totalContributed = roundMoney(roundedContribution * months)
  const tenYearValue = roundMoney(value)

  return {
    monthlyContribution: roundedContribution,
    years,
    annualReturn,
    totalContributed,
    tenYearValue,
    potentialGrowth: roundMoney(tenYearValue - totalContributed),
  }
}

function buildFinanceNextActions(
  monthlySavingsTarget: number,
  opportunities: FinanceOpportunity[],
  transactionCount: number
): FinanceActionPlan['nextActions'] {
  if (transactionCount === 0) {
    return [
      {
        id: 'connect',
        label: 'Conectar institución',
        body: 'Trae movimientos reales con Syncfy para que FinovAI pueda detectar fugas.',
        target: 'connect',
      },
    ]
  }

  const actions: FinanceActionPlan['nextActions'] = []
  if (opportunities.some((opportunity) => opportunity.kind === 'recurring')) {
    actions.push({
      id: 'review-recurring',
      label: 'Revisar recurrentes',
      body: 'Confirma qué cargos siguen siendo necesarios y elimina los que ya no uses.',
      target: 'movements',
    })
  }

  if (opportunities.some((opportunity) => opportunity.kind === 'merchant_leak' || opportunity.kind === 'category_leak')) {
    actions.push({
      id: 'fix-categories',
      label: 'Afinar categorías',
      body: 'Corrige comercios repetidos para que FinovAI aprenda tus reglas y calcule mejor el margen.',
      target: 'categories',
    })
  }

  actions.push({
    id: 'ask-plan',
    label: 'Preguntar a FinovAI',
    body: 'Pide un plan semanal basado en estas fugas y movimientos.',
    target: 'chat',
  })

  if (monthlySavingsTarget > 0) {
    actions.push({
      id: 'route-investment',
      label: 'Preparar inversión',
      body: 'Convierte el margen mensual en una ruta ilustrativa hacia una plataforma aliada.',
      target: 'partner',
    })
  }

  return actions.slice(0, 4)
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
  if (extension === 'csv' || extension === 'tsv' || extension === 'txt' || mime.includes('csv') || mime.includes('text')) return 'csv'
  return ''
}

async function parseCartolaUpload(file: File): Promise<{ fileType: string; rows: CartolaDraftRow[] }> {
  if (file.size > MAX_CARTOLA_UPLOAD_BYTES) {
    throw new Error('Archivo demasiado grande. Usa un archivo de hasta 5 MB.')
  }

  const fileType = getCartolaFileType(file)
  if (!fileType) {
    throw new Error('Formato no soportado. Sube PDF o CSV.')
  }

  const buffer = await file.arrayBuffer()
  let rows: CartolaDraftRow[]

  if (fileType === 'pdf') {
    rows = await parsePdfCartola(buffer)
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

const SYSTEM_PROMPT = `Eres FinovAI, un copiloto financiero para México y Latinoamérica.

TU MISIÓN:
Analizar transacciones autorizadas, encontrar fugas de dinero, explicar patrones de gasto y mostrar oportunidades de ahorro que puedan convertirse en aportaciones de inversión.

FILOSOFÍA CORE:
- Primero detectas la fuga, luego decides qué hacer con ese margen.
- FinovAI trabaja con lectura transaccional; no inicia pagos, retiros ni inversiones.
- Syncfy es la fuente principal de conexión transaccional, bancaria, fiscal y de fuentes compatibles.
- Las proyecciones de inversión son ilustrativas, no garantías.

TU ROL EN ESTA CONVERSACIÓN:
1. Explicar qué patrones aparecen en los movimientos del usuario.
2. Priorizar fugas accionables: comercios repetidos, días de gasto, suscripciones y picos inusuales.
3. Estimar ahorro posible de forma conservadora.
4. Explicar cómo ese ahorro podría convertirse en aportación hacia una plataforma de inversión aliada.
5. Ser claro cuando faltan transacciones conectadas y pedir conectar una cuenta con Syncfy.

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

const DASHBOARD_CHAT_SYSTEM_PROMPT = `Eres FinovAI, un copiloto financiero para México y Latinoamérica.

Responde siempre en español. Usa solo los datos financieros incluidos en el mensaje del usuario. Si faltan movimientos, dilo con claridad y pide conectar o sincronizar la institución.

Tu trabajo:
- detectar fugas de gasto, patrones, recurrencias y oportunidades de ahorro;
- explicar los hallazgos con montos y categorías concretas;
- mencionar la ventana de datos analizada cuando respondas preguntas amplias de patrones, ahorro o plan;
- tratar conjuntos de datos marcados como preliminares como lecturas direccionales, no conclusiones definitivas;
- usar categoryBreakdown.allExpenses cuando la pregunta sea sobre categorías/rubros en general, salvo que el usuario pida el mes actual;
- evitar consejos de inversión específicos, promesas de rendimiento o jerga innecesaria;
- mantener respuestas breves, accionables y orientadas a próximos pasos.`

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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-FinovAI-Dashboard-Secret, X-FinovAI-Admin-Secret',
        },
      })
    }

    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url)
    }

    return new Response('Not Found', { status: 404 })
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      refreshDueSyncfyCredentials(env).then((result) => {
        console.log('Syncfy scheduled refresh complete', result)
      })
    )
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
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      return json(await getFinanceDashboard(env, normalizedEmail))
    }

    if (url.pathname === '/api/profile' && request.method === 'GET') {
      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      return json({
        success: true,
        email: normalizedEmail,
        profile: await loadFinancialProfile(env, normalizedEmail),
      })
    }

    if (url.pathname === '/api/profile' && request.method === 'PATCH') {
      const body = (await request.json()) as {
        email?: string
        currency?: unknown
        monthlyIncome?: unknown
        monthlyBudget?: unknown
        categoryBudgets?: unknown
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      const profile = await updateFinancialProfile(env, normalizedEmail, body)
      const dashboard = await getFinanceDashboard(env, normalizedEmail)

      return json({
        ...dashboard,
        profile,
        message: 'Perfil financiero actualizado.',
      })
    }

    if (url.pathname === '/api/dashboard/chat' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        question?: string
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      const question = typeof body.question === 'string' ? body.question.trim() : ''

      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)
      if (!question) {
        return error('Pregunta requerida')
      }

      const dashboard = await getFinanceDashboard(env, normalizedEmail)
      let answer: { answer: string; model: string }
      try {
        answer = await answerDashboardChatWithAnthropic(env, question, dashboard, false)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No pudimos conectar con el modelo financiero.'
        return error(message, 502)
      }

      return json({
        success: true,
        email: normalizedEmail,
        source: 'anthropic',
        model: answer.model,
        answer: answer.answer,
      })
    }

    if (url.pathname === '/api/transactions/category' && request.method === 'PATCH') {
      const body = (await request.json()) as {
        email?: string
        transactionId?: string
        category?: unknown
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : ''

      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)
      if (!transactionId) {
        return error('Movimiento requerido')
      }

      await ensureFinanceTables(env)
      const categoryUpdate = await updateFinanceTransactionCategory(env, normalizedEmail, transactionId, body.category)
      if (!categoryUpdate) {
        return error('Movimiento no encontrado', 404)
      }
      const dashboard = await getFinanceDashboard(env, normalizedEmail)
      const updateMessage = categoryUpdate.updatedCount > 1
        ? `Categoría actualizada en ${categoryUpdate.updatedCount} movimientos similares.`
        : 'Categoría actualizada.'

      return json({
        ...dashboard,
        transaction: categoryUpdate.transaction,
        message: updateMessage,
      })
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
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)
      if (isProductionEnv(env) && !isFeatureEnabled(env.ENABLE_BACKUP_IMPORT)) {
        return error('Not found', 404)
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
      if (isProductionEnv(env) && !isFeatureEnabled(env.ENABLE_BACKUP_IMPORT)) {
        return error('Not found', 404)
      }

      const formData = await request.formData()
      const normalizedEmail = normalizeSignupEmail(formData.get('email'))
      const file = formData.get('file')

      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)
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
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)
      if (isProductionEnv(env) && !isFeatureEnabled(env.ENABLE_BACKUP_IMPORT)) {
        return error('Not found', 404)
      }
      if (!importId) {
        return error('Importación requerida')
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
        return error('Importación no encontrada', 404)
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
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

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
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)
      if (!inviteeEmail) {
        return error('Correo de pareja inválido')
      }
      if (normalizedEmail === inviteeEmail) {
        return error('Usa un correo distinto para invitar a tu pareja')
      }

      const invite = await upsertHouseholdInvite(env, normalizedEmail, inviteeEmail)
      const delivery = await sendHouseholdInviteEmail(env, request, invite)

      return json({
        success: true,
        email: normalizedEmail,
        invite,
        invites: await loadHouseholdInvites(env, normalizedEmail),
        emailSent: delivery.emailSent,
        inviteUrl: delivery.inviteUrl,
        message: delivery.emailSent ? 'Invitación enviada.' : 'Invitación guardada. Correo no configurado en local.',
      }, 201)
    }

    // =====================
    // AUTH ENDPOINTS
    // =====================

    if (url.pathname === '/api/auth/send-otp' && request.method === 'POST') {
      const body = (await request.json()) as { phone: string }
      const phone = normalizePhone(body.phone)

      if (!phone || phone.length < 10) {
        return error('Número de teléfono inválido')
      }

      const recentOTP = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM otp_verifications
         WHERE phone = ? AND created_at > datetime('now', '-1 minute')`
      )
        .bind(phone)
        .first<{ count: number }>()

      if (recentOTP && recentOTP.count >= 1) {
        return error('Espera un minuto antes de solicitar otro código', 429)
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
        return error(`Error enviando código: ${result.error}`, 500)
      }

      return json({ success: true, expiresIn: 300 })
    }

    if (url.pathname === '/api/auth/verify-otp' && request.method === 'POST') {
      const body = (await request.json()) as { phone: string; code: string }
      const phone = normalizePhone(body.phone)
      const code = body.code?.trim()

      if (!phone || !code) {
        return error('Teléfono y código son requeridos')
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

        return error('Código inválido o expirado', 401)
      }

      if (otp.attempts >= 3) {
        return error('Demasiados intentos. Solicita un nuevo código.', 429)
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
      if (!user) return error('Sesión inválida', 401)

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
      if (!user) return error('Sesión inválida', 401)

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
      if (!user) return error('Sesión inválida', 401)

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
      if (!user) return error('Sesión inválida', 401)

      const body = (await request.json()) as {
        type?: 'private_ai' | 'couple_ai' | 'couple_direct'
        title?: string
      }

      const conversationType = body.type || 'private_ai'
      const title = body.title || null

      if ((conversationType === 'couple_ai' || conversationType === 'couple_direct') && !user.couple_id) {
        return error('Necesitas estar en pareja para crear esta conversación', 400)
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
      if (!user) return error('Sesión inválida', 401)

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
        return error('No tienes acceso a esta conversación', 403)
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
      if (!user) return error('Sesión inválida', 401)

      const conversationId = parseInt(messagesMatch[1])
      const body = (await request.json()) as { content: string }

      if (!body.content?.trim()) {
        return error('El mensaje no puede estar vacío')
      }

      const conversation = await env.DB.prepare(
        `SELECT c.* FROM conversations c
         LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE c.id = ? AND (c.owner_id = ? OR cp.user_id = ?)`
      )
        .bind(conversationId, user.id, user.id)
        .first<{ id: number; conversation_type: string; couple_id: number | null }>()

      if (!conversation) {
        return error('No tienes acceso a esta conversación', 403)
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

    if (url.pathname === '/api/admin/syncfy' && request.method === 'GET') {
      const requestOrigin = request.headers.get('origin')
      if (isProductionEnv(env) && requestOrigin && requestOrigin !== getAppOrigin(env, request)) {
        return error('Not found', 404)
      }
      if (!(await verifySupportAdminAccess(request, env))) {
        return error('Not found', 404)
      }

      await ensureSyncfyTables(env)

      const emailParam = url.searchParams.get('email')
      const normalizedEmail = emailParam ? normalizeSignupEmail(emailParam) : null
      if (emailParam && !normalizedEmail) {
        return error('Correo inválido')
      }

      const requestedLimit = Number(url.searchParams.get('limit') || 50)
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) : 50
      const syncfyUser = normalizedEmail
        ? await env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
          .bind(normalizedEmail)
          .first<SyncfyUserRow>()
        : null
      const syncfyUserId = syncfyUser?.syncfy_user_id || ''

      const users = normalizedEmail
        ? await env.DB.prepare(
          `SELECT email, syncfy_user_id, syncfy_external_id, name, mode, created_at, updated_at, last_session_at
           FROM syncfy_users
           WHERE email = ?
           LIMIT ?`
        )
          .bind(normalizedEmail, limit)
          .all<SyncfyUserRow>()
        : await env.DB.prepare(
          `SELECT email, syncfy_user_id, syncfy_external_id, name, mode, created_at, updated_at, last_session_at
           FROM syncfy_users
           ORDER BY COALESCE(last_session_at, updated_at, created_at) DESC
           LIMIT ?`
        )
          .bind(limit)
          .all<SyncfyUserRow>()

      const credentials = normalizedEmail
        ? await env.DB.prepare(
          `SELECT email, syncfy_user_id, syncfy_credential_id, syncfy_site_id, site_name, status,
             last_successful_sync_at, last_pull_at, last_rid, created_at, updated_at
           FROM syncfy_credentials
           WHERE email = ? OR syncfy_user_id = ?
           ORDER BY COALESCE(updated_at, created_at) DESC
           LIMIT ?`
        )
          .bind(normalizedEmail, syncfyUserId, limit)
          .all()
        : await env.DB.prepare(
          `SELECT email, syncfy_user_id, syncfy_credential_id, syncfy_site_id, site_name, status,
             last_successful_sync_at, last_pull_at, last_rid, created_at, updated_at
           FROM syncfy_credentials
           ORDER BY COALESCE(updated_at, created_at) DESC
           LIMIT ?`
        )
          .bind(limit)
          .all()

      const errors = normalizedEmail
        ? await env.DB.prepare(
          `SELECT e.id, e.email, e.syncfy_user_id, e.syncfy_credential_id, e.rid, e.status_code,
             e.error_code, e.message, e.source, e.created_at,
             COALESCE(
               (SELECT c.site_name FROM syncfy_credentials c WHERE c.syncfy_credential_id = e.syncfy_credential_id LIMIT 1),
               (SELECT c.site_name FROM syncfy_credentials c WHERE c.email = e.email ORDER BY COALESCE(c.updated_at, c.created_at) DESC LIMIT 1)
             ) AS institution
           FROM syncfy_errors e
           WHERE e.email = ? OR e.syncfy_user_id = ?
           ORDER BY e.created_at DESC
           LIMIT ?`
        )
          .bind(normalizedEmail, syncfyUserId, limit)
          .all()
        : await env.DB.prepare(
          `SELECT e.id, e.email, e.syncfy_user_id, e.syncfy_credential_id, e.rid, e.status_code,
             e.error_code, e.message, e.source, e.created_at,
             COALESCE(
               (SELECT c.site_name FROM syncfy_credentials c WHERE c.syncfy_credential_id = e.syncfy_credential_id LIMIT 1),
               (SELECT c.site_name FROM syncfy_credentials c WHERE c.email = e.email ORDER BY COALESCE(c.updated_at, c.created_at) DESC LIMIT 1)
             ) AS institution
           FROM syncfy_errors e
           ORDER BY e.created_at DESC
           LIMIT ?`
        )
          .bind(limit)
          .all()

      const webhooks = normalizedEmail
        ? await env.DB.prepare(
          `SELECT id, event_type, syncfy_user_id, syncfy_credential_id, rid, processed_at, created_at
           FROM syncfy_webhook_events
           WHERE syncfy_user_id = ?
           ORDER BY created_at DESC
           LIMIT ?`
        )
          .bind(syncfyUserId, limit)
          .all<SyncfyWebhookEventRow>()
        : await env.DB.prepare(
          `SELECT id, event_type, syncfy_user_id, syncfy_credential_id, rid, processed_at, created_at
           FROM syncfy_webhook_events
           ORDER BY created_at DESC
           LIMIT ?`
        )
          .bind(limit)
          .all<SyncfyWebhookEventRow>()

      const lastWebhook = webhooks.results[0]
      const lastError = errors.results[0] as { created_at?: string } | undefined

      return json({
        success: true,
        environment: env.ENVIRONMENT,
        email: normalizedEmail,
        summary: {
          webhookSecretConfigured: Boolean(env.SYNCFY_WEBHOOK_SECRET),
          emailSendingConfigured: Boolean(env.EMAIL),
          supportAdminSecretConfigured: Boolean(env.SUPPORT_ADMIN_SECRET),
          lastWebhookAt: lastWebhook?.created_at || null,
          lastWebhookEvent: lastWebhook?.event_type || null,
          webhookStatus: lastWebhook ? (lastWebhook.processed_at ? 'processed' : 'received') : 'none',
          lastErrorAt: lastError?.created_at || null,
          recentErrorCount: errors.results.length,
        },
        users: users.results,
        credentials: credentials.results,
        errors: errors.results,
        webhooks: webhooks.results,
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
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      await upsertLead(env, normalizedEmail, name, JSON.stringify({ source: 'syncfy-session' }))
      let syncfyUser: SyncfyUserRow
      let session: { token: string | null; mode: 'live' | 'local' }

      try {
        syncfyUser = await getOrCreateSyncfyUser(env, normalizedEmail, name)
        try {
          session = await createSyncfyWidgetSession(env, syncfyUser)
        } catch (err) {
          if (!(err instanceof SyncfyRequestError) || !isSyncfyInvalidUserError(err)) {
            throw err
          }

          await storeSyncfyError(env, {
            email: normalizedEmail,
            syncfyUserId: syncfyUser.syncfy_user_id,
            rid: err.rid,
            statusCode: err.status,
            errorCode: err.code,
            message: err.message,
            source: 'syncfy-session-stale-user',
            payload: err.responseBody,
          })

          syncfyUser = await recreateSyncfyUser(env, normalizedEmail, name)
          session = await createSyncfyWidgetSession(env, syncfyUser)
        }
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
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      const credentials = await loadSyncfyCredentialsForEmail(env, normalizedEmail)
      return json({
        success: true,
        email: normalizedEmail,
        credentials: credentials.map(syncfyCredentialToApi),
      } satisfies SyncfyCredentialsResponse)
    }

    if (url.pathname === '/api/syncfy/reset' && request.method === 'POST') {
      const { email, name } = (await request.json()) as {
        email?: string
        name?: string
      }
      const normalizedEmail = normalizeSignupEmail(email)
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      const reset = await resetSyncfyConnectionForEmail(env, normalizedEmail, name)
      const credentials = await loadDisplaySyncfyCredentialsForEmail(env, normalizedEmail)

      return json({
        success: true,
        email: normalizedEmail,
        syncfyUserId: reset.syncfyUser?.syncfy_user_id || null,
        recreated: reset.recreated,
        credentials: credentials.map(syncfyCredentialToApi),
        message: reset.recreated
          ? 'Conexión anterior limpiada. Puedes elegir institución de nuevo.'
          : 'Conexión local limpiada. Puedes intentar elegir institución de nuevo.',
      })
    }

    if (url.pathname === '/api/syncfy/credential' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        eventType?: string
        payload?: unknown
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      await ensureSyncfyTables(env)

      const eventType = body.eventType || 'widget.success'
      const payload = body.payload ?? body
      const credential = await storeSyncfyCredential(env, payload, eventType, normalizedEmail)
      if (!credential) {
        return error('Syncfy aún no regresó una credencial lista. Esperando webhook de refresh.', 422)
      }

      const transactionEndpoints = getSyncfyWebhookEndpointPaths(payload, 'transactions')
      let importResult: SyncfyTransactionImportResult | null = null

      const jobStatusPaths = getSyncfyJobStatusPaths(payload)

      if (transactionEndpoints.length > 0) {
        try {
          importResult = await importSyncfyTransactionsFromEndpoints(
            env,
            normalizedEmail,
            credential.syncfy_user_id,
            credential.syncfy_credential_id,
            transactionEndpoints
          )
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
              source: 'syncfy-widget-import',
              payload: err.responseBody,
            })
          } else {
            throw err
          }
        }
      } else if (jobStatusPaths.length > 0) {
        try {
          importResult = await importSyncfyTransactionsFromJobStatuses(
            env,
            normalizedEmail,
            credential.syncfy_user_id,
            credential.syncfy_credential_id,
            jobStatusPaths
          )
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
              source: 'syncfy-widget-job-status',
              payload: err.responseBody,
            })
          } else {
            throw err
          }
        }
      }

      const credentials = await loadDisplaySyncfyCredentialsForEmail(env, normalizedEmail)
      const displayCredential = credentials.find((item) => item.syncfy_credential_id === credential.syncfy_credential_id) || credential
      const dashboard = importResult ? await getFinanceDashboard(env, normalizedEmail) : null
      return json({
        ...(dashboard || {}),
        success: true,
        email: normalizedEmail,
        credential: syncfyCredentialToApi(displayCredential),
        credentials: credentials.map(syncfyCredentialToApi),
        syncfy: importResult,
        pendingTransactions: importResult ? !isSyncfyTransactionImportComplete(importResult) : true,
        message: importResult
          ? getSyncfyTransactionImportMessage(importResult)
          : 'Credencial Syncfy guardada. Ya puedes sincronizar transacciones.',
      })
    }

    if (url.pathname === '/api/syncfy/refresh' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        credentialId?: string
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      const credentials = await loadSyncfyCredentialsForEmail(env, normalizedEmail)
      const credential = body.credentialId
        ? credentials.find((item) => item.syncfy_credential_id === body.credentialId)
        : credentials[0]

      if (!credential) {
        return error('Primero conecta una institución con Syncfy.', 404)
      }

      if (isSyncfyReconnectRequiredStatus(credential.status)) {
        return json({
          success: false,
          error: 'Syncfy requiere reconectar esta institución antes de volver a sincronizar.',
          credential: syncfyCredentialToApi(credential),
        }, 409)
      }

      const cooldownSeconds = getSyncfyCredentialCooldownSeconds(credential)
      if (cooldownSeconds > 0) {
        return json({
          success: false,
          error: 'Syncfy permite una sincronización exitosa por credencial cada 5 minutos.',
          retryAfterSeconds: cooldownSeconds,
          credential: syncfyCredentialToApi(credential),
        }, 429)
      }

      try {
        const importResult = await importSyncfyTransactionsForCredential(
          env,
          normalizedEmail,
          credential.syncfy_user_id,
          credential.syncfy_credential_id,
          { jobStatusPaths: getSyncfyCredentialJobStatusPaths(credential) }
        )
        const importComplete = isSyncfyTransactionImportComplete(importResult)
        if (importComplete) {
          await markSyncfyCredentialSyncSuccess(env, normalizedEmail, credential.syncfy_credential_id)
        } else {
          await markSyncfyCredentialSyncPending(env, normalizedEmail, credential.syncfy_credential_id)
        }
        const dashboard = await getFinanceDashboard(env, normalizedEmail)

        return json({
          ...dashboard,
          source: 'syncfy',
          syncfy: importResult,
          pendingTransactions: !importComplete,
          message: getSyncfyTransactionImportMessage(importResult),
        }, importComplete ? 200 : 202)
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
        return error('Secreto de webhook Syncfy inválido', 401)
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
              event.syncfy_user_id || credential?.syncfy_user_id || null,
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
        return error('Correo inválido')
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

    if (url.pathname === '/api/expenses' && request.method === 'GET') {
      if (isProductionEnv(env)) {
        return error('Not found', 404)
      }

      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

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
            importResult = await importSyncfyTransactionsForCredential(
              env,
              normalizedEmail,
              credential.syncfy_user_id,
              credential.syncfy_credential_id
            )
            if (isSyncfyTransactionImportComplete(importResult)) {
              await markSyncfyCredentialSyncSuccess(env, normalizedEmail, credential.syncfy_credential_id)
            } else {
              await markSyncfyCredentialSyncPending(env, normalizedEmail, credential.syncfy_credential_id)
            }
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
      if (isProductionEnv(env) && !isFeatureEnabled(env.ENABLE_LEGACY_CHAT)) {
        return error('Not found', 404)
      }

      const { messages } = (await request.json()) as { messages: Message[] }

      const messagesWithSystem = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ]

      const aiMessage = await runAIResponse(env, messagesWithSystem, isLocalRequest(url))

      return json({ message: aiMessage })
    }

    if ((url.pathname === '/api/signup' || url.pathname === '/api/auth/request-link') && request.method === 'POST') {
      const { email, name, diagnosticData, source, redirectPath } = (await request.json()) as {
        email: string
        name?: string
        diagnosticData?: string
        source?: string
        redirectPath?: string
      }

      const normalizedEmail = normalizeSignupEmail(email)
      if (!normalizedEmail) {
        return error('Correo inválido')
      }

      if (url.pathname === '/api/auth/request-link' || isEmailAuthRequired(env)) {
        let challenge: { debugCode?: string; debugToken?: string }
        try {
          challenge = await createEmailLoginChallenge(
            env,
            request,
            normalizedEmail,
            source || 'email-auth',
            redirectPath || '/dashboard'
          )
        } catch (challengeError) {
          console.error('Email auth challenge failed:', challengeError)
          return error('Correo transaccional no configurado. Activa el envío de correo de Cloudflare para mail.finov.ai.', 503)
        }

        await upsertLead(env, normalizedEmail, name, diagnosticData)

        return json({
          success: true,
          email: normalizedEmail,
          verificationRequired: true,
          expiresInSeconds: EMAIL_LOGIN_TTL_SECONDS,
          debugCode: challenge.debugCode,
          debugToken: challenge.debugToken,
        })
      }

      const access = await createOrVerifyDashboardEmailSession(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      await upsertLead(env, normalizedEmail, name, diagnosticData)

      return json({ success: true, email: normalizedEmail, clientSecret: access.clientSecret })
    }

    if (url.pathname === '/api/auth/verify' && request.method === 'POST') {
      const { email, code, token, source } = (await request.json()) as {
        email?: string
        code?: string
        token?: string
        source?: string
      }
      const normalizedEmail = normalizeSignupEmail(email)
      if (!normalizedEmail) {
        return error('Correo inválido')
      }

      const verified = await verifyEmailLoginChallenge(env, normalizedEmail, {
        code: typeof code === 'string' ? code.trim() : undefined,
        token: typeof token === 'string' ? token.trim() : undefined,
      })
      if (!verified.ok) return error(verified.message, verified.status)

      await upsertLead(env, normalizedEmail, '', JSON.stringify({
        source: source || 'email-auth-verified',
        verifiedAt: new Date().toISOString(),
      }))

      return json({ success: true, email: normalizedEmail, clientSecret: verified.clientSecret })
    }

    if (url.pathname === '/api/health') {
      return json({
        status: 'ok',
        environment: env.ENVIRONMENT || 'unknown',
        syncfyEnvironment: env.SYNCFY_ENV || 'unlabeled',
        timestamp: new Date().toISOString(),
      })
    }

    return error('Not found', 404)
  } catch (err) {
    console.error('API Error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
}
