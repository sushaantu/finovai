import type {
  DashboardBenchmarkStage,
} from '../dashboard-chat-benchmark'
import {
  normalizeCategoryInput,
  roundMoney,
} from '../../shared/finance-core'
import type {
  FinanceTransactionSource,
  FinanceTransactionType,
} from '../../shared/finance-core'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: corsHeaders })

export const error = (message: string, status = 400) => json({ error: message }, status)

export interface Env {
  DB: D1Database
  ENVIRONMENT: string
  ENABLE_BACKUP_IMPORT?: string
  EMAIL?: SendEmail
  EMAIL_AUTH_REQUIRED?: string
  EMAIL_FROM?: string
  OPS_ALERT_EMAIL?: string
  APP_ORIGIN?: string
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
  __testUtcHour?: number
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
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

export interface SyncfyUserRow {
  email: string
  syncfy_user_id: string
  syncfy_external_id: string
  name: string | null
  mode: 'live' | 'local'
  created_at: string
  updated_at: string | null
  last_session_at: string | null
  user_id?: string | null
}

export interface SyncfyCredentialRow {
  id: string
  email: string
  syncfy_user_id: string
  syncfy_credential_id: string
  syncfy_site_id: string | null
  site_name: string | null
  status: string | null
  state?: string | null
  state_changed_at?: string | null
  attempt_count?: number | null
  first_failed_at?: string | null
  deleted_at?: string | null
  last_successful_sync_at: string | null
  last_pull_at: string | null
  last_pull_attempt_at: string | null
  last_rid: string | null
  raw_json: string | null
  created_at: string
  updated_at: string | null
  user_id?: string | null
  connection_issue?: SyncfyConnectionIssue | null
}

export interface SyncfyWebhookEventRow {
  id: string
  event_type: string
  syncfy_user_id: string | null
  syncfy_credential_id: string | null
  rid: string | null
  processed_at: string | null
  created_at: string
}

export interface SyncfyErrorRow {
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

export type SyncfyConnectionState = 'ready' | 'verifying' | 'action_required' | 'provider_unavailable' | 'support_required' | 'broken' | 'abandoned'

export type SyncfyConnectionIssueKind = 'action_required' | 'provider_unavailable' | 'rate_limited' | 'unknown' | 'broken' | 'abandoned' | 'connecting'

type SyncfyConnectionIssueOwner = 'user' | 'provider' | 'finovai'

type SyncfyConnectionIssueAction = 'update_access' | 'retry_later' | 'contact_support'

export interface SyncfyConnectionIssue {
  kind: SyncfyConnectionIssueKind
  owner: SyncfyConnectionIssueOwner
  action: SyncfyConnectionIssueAction
  title: string
  message: string
  supportCode: string | null
  statusCode: number | null
  occurredAt: string
  source: string
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

export interface SyncfySiteMetadata {
  syncfySiteId: string | null
  syncfySiteOrganizationId: string | null
  siteName: string | null
}

export interface SyncfyTransactionImportResult {
  credentialId: string | null
  fetched: number
  imported: number
  skipped: number
  endpoints: string[]
  connectionIssue?: SyncfyConnectionIssue | null
  vendorStatus?: number | null
  vendorMessage?: string | null
}

export interface NormalizedSyncfyTransaction {
  id: string
  date: string
  type: FinanceTransactionType
  amount: number
  currency: string
  category: string
  description: string
  merchant: string
  syncfyCredentialId: string | null
  raw: unknown
}

export interface SyncfyCredentialsResponse {
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
    connectionState: SyncfyConnectionState
    connectionIssue: SyncfyConnectionIssue | null
  }>
}

export interface Expense {
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

export interface ExpenseSummary {
  totalSpent: number
  transactionCount: number
  topCategory: string
  topMerchant: string
  savingsOpportunity: number
}

export interface FinanceTransactionRow {
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
  user_id?: string | null
}

export interface FinancialProfileRow {
  email: string
  currency: string
  monthly_income?: number | null
  monthly_budget?: number | null
  category_budgets_json?: string | null
  created_at?: string
  updated_at?: string | null
}

export interface DashboardQuestionBenchmark {
  stage: DashboardBenchmarkStage
  label: string
  category: string
}

export interface HouseholdInviteRow {
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

export interface EmailLoginChallengeRow {
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

const SYNCFY_ORGANIZATION_NAME_KEYS = [
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
]

const SYNCFY_INSTITUTION_NAME_KEYS = [
  ...SYNCFY_ORGANIZATION_NAME_KEYS,
  'site_name',
  'siteName',
  'name_site',
  'siteNameDisplay',
  'name',
]

const SYNCFY_GENERIC_INSTITUTION_NAMES = new Set([
  '2FA',
  'ACCOUNT',
  'BANK',
  'BUSINESS',
  'CAPTCHA',
  'CLAVE',
  'CORPORATE',
  'CREDENTIAL',
  'CREDENTIALS',
  'CREDENCIAL',
  'CUENTA',
  'EMPRESARIAL',
  'LOGIN',
  'MOVIMIENTO',
  'NORMAL',
  'OTP',
  'PASSWORD',
  'PASSWORD CAPTCHA',
  'PERSONAL',
  'PIN',
  'SITE',
  'SITIO',
  'SYNCFY',
  'TOKEN',
  'TOKEN AND CAPTCHA',
  'TOKEN CAPTCHA',
  'TRANSACTION',
  'USERNAME',
  'USERNAME AND PASSWORD',
  'USUARIO',
  'USUARIO Y CONTRASENA',
])

const SYNCFY_AUTH_CHANNEL_NAME_PATTERN = /^(?:PERSONAL|EMPRESARIAL|BUSINESS|CORPORATE|NORMAL|TOKEN(?:\s+(?:AND\s+)?CAPTCHA)?|USUARIO(?:\s+Y\s+CONTRASENA)?|USERNAME(?:\s+AND\s+PASSWORD)?|PASSWORD(?:\s+CAPTCHA)?|CAPTCHA|PIN|OTP|2FA|CLAVE|LOGIN)$/

const KNOWN_SYNCFY_INSTITUTION_NAMES = new Map<string, string>([
  ['56cf5728784806f72b8b4568', 'Acme Bank'],
  ['56cf4ff5784806152c8b4567', 'Acme Bank'],
  ['572930c4784806060f8b456a', 'American Express'],
  ['572930c4784806060f8b456b', 'American Express'],
])

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

export function normalizeSignupEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null

  const normalizedEmail = email.trim().toLowerCase()
  return EMAIL_PATTERN.test(normalizedEmail) ? normalizedEmail : null
}

function isLocalRequest(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
}

export async function upsertLead(env: Env, email: string, name?: string, diagnosticData?: string): Promise<Lead> {
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

export function isProductionEnv(env: Env): boolean {
  return env.ENVIRONMENT === 'production'
}

export function isSyncfySandboxEnv(env: Pick<Env, 'SYNCFY_ENV'>): boolean {
  return env.SYNCFY_ENV?.toLowerCase() === 'sandbox'
}

export function isFeatureEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export function createDashboardClientSecret(): string {
  const bytes = new Uint8Array(DASHBOARD_SECRET_BYTES)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function getDashboardClientSecret(request: Request): string | null {
  const secret = request.headers.get(DASHBOARD_SECRET_HEADER)
  return secret && secret.length <= 256 ? secret : null
}

export async function ensureDashboardSessionTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS dashboard_sessions (
      email TEXT PRIMARY KEY,
      client_secret_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      user_id TEXT
    )`
  ).run()
  await env.DB.prepare(`ALTER TABLE dashboard_sessions ADD COLUMN user_id TEXT`).run().catch(() => {})
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_dashboard_sessions_last_used ON dashboard_sessions(last_used_at DESC)`).run()
}

export async function verifyDashboardEmailAccess(
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

export function getAppOrigin(env: Env, request: Request): string {
  return (env.APP_ORIGIN || new URL(request.url).origin).replace(/\/+$/, '')
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parseJsonUnknown(text: string): unknown {
  if (!text) return {}

  try {
    return JSON.parse(text) as unknown
  } catch {
    return { raw: text }
  }
}

export function stringFromUnknown(value: unknown, maxLength = 4096): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed.slice(0, maxLength) : null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).slice(0, maxLength)
  }

  return null
}

export function collectSyncfyRecords(value: unknown, maxDepth = 4): Array<Record<string, unknown>> {
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
      'events',
      'response',
      'data',
      'header',
      'event',
      'payload',
      'credential',
      'credentials',
      'pull',
      'pulls',
      'job',
      'jobs',
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

export function firstSyncfyString(payload: unknown, keys: string[]): string | null {
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

export function lookupKnownSyncfyInstitutionName(...ids: Array<string | null | undefined>): string | null {
  for (const id of ids) {
    if (!id) continue
    const knownName = KNOWN_SYNCFY_INSTITUTION_NAMES.get(id)
    if (knownName) return knownName
  }

  return null
}

export function isUsefulSyncfyInstitutionName(value: string): boolean {
  const label = cleanText(value)
  if (!label || label.length < 2 || label.length > 120) return false
  if (/^[a-f0-9]{16,}$/i.test(label) || /^\d+$/.test(label)) return false
  if (/^[a-z]+(?:[._-][a-z]+)+$/i.test(label)) return false

  const normalized = normalizeCategoryInput(label).replace(/[^A-Z0-9]+/g, ' ').trim()
  if (!normalized || SYNCFY_GENERIC_INSTITUTION_NAMES.has(normalized)) return false
  if (SYNCFY_AUTH_CHANNEL_NAME_PATTERN.test(normalized)) return false
  // Syncfy site.name is often an auth/channel label ("Token & captcha"), not a bank brand.
  if (/\b(?:CAPTCHA|CONTRASENA|PASSWORD)\b/.test(normalized) && normalized.split(/\s+/).length <= 4) {
    return false
  }

  return true
}

function recordLooksLikeSyncfySiteOrganization(record: Record<string, unknown>): boolean {
  return Boolean(
    record.id_site_organization ||
    record.site_organization_id ||
    record.idSiteOrganization ||
    record.syncfy_site_organization_id ||
    record.organization_name ||
    record.organizationName ||
    record.institution_name ||
    record.institutionName ||
    record.bank_name ||
    record.bankName
  )
}

export function firstSyncfyOrganizationInstitutionName(payload: unknown): string | null {
  for (const record of collectSyncfyRecords(payload)) {
    for (const key of SYNCFY_ORGANIZATION_NAME_KEYS) {
      const value = stringFromUnknown(record[key], 160)
      if (value && isUsefulSyncfyInstitutionName(value)) return cleanText(value)
    }
  }

  for (const record of collectSyncfyRecords(payload)) {
    if (!recordLooksLikeSyncfySiteOrganization(record)) continue
    for (const key of ['name', 'site_name', 'siteName', 'display_name', 'displayName']) {
      const value = stringFromUnknown(record[key], 160)
      if (value && isUsefulSyncfyInstitutionName(value)) return cleanText(value)
    }
  }

  return null
}

export function firstSyncfyInstitutionName(payload: unknown): string | null {
  const organizationName = firstSyncfyOrganizationInstitutionName(payload)
  if (organizationName) return organizationName

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
    siteName: lookupKnownSyncfyInstitutionName(syncfySiteId, syncfySiteOrganizationId) ||
      firstSyncfyInstitutionName(payload),
  }
}

export function extractSyncfyEventType(payload: unknown): string {
  for (const record of collectSyncfyRecords(payload)) {
    const header = asRecord(record.header)
    const headerEvent = asRecord(header?.event)
    const headerName = stringFromUnknown(headerEvent?.name, 256)
    if (headerName) return headerName

    const event = asRecord(record.event)
    const eventName = stringFromUnknown(event?.name, 256)
    if (eventName) return eventName
  }

  const direct = firstSyncfyString(payload, ['event_type', 'webhook_event', 'type', 'event'])
  return direct || 'syncfy.webhook'
}

export function extractSyncfyRid(payload: unknown): string | null {
  return firstSyncfyString(payload, ['rid', 'request_id', 'requestId', 'id_request'])
}

export function extractSyncfyCode(payload: unknown): string | null {
  return firstSyncfyString(payload, ['code', 'error_code', 'errorCode', 'status_code', 'statusCode'])
}

export function extractSyncfyNumericStatus(payload: unknown): number | null {
  const code = extractSyncfyCode(payload)
  if (!code) return null
  const value = Number(code)
  return Number.isFinite(value) ? value : null
}

export function extractSyncfyCredentialPayload(payload: unknown): SyncfyCredentialPayload {
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

export function isSyncfyRefreshEvent(eventType: string): boolean {
  const normalized = eventType.toLowerCase()
  return normalized === 'refresh' || normalized.includes('credentials.refresh') || normalized.includes('credential.refresh')
}

export function isSyncfyDeleteEvent(eventType: string): boolean {
  const normalized = eventType.toLowerCase()
  return normalized === 'delete' ||
    normalized === 'deleted' ||
    normalized.includes('credentials.deleted') ||
    normalized.includes('credential.deleted') ||
    normalized.includes('credential_delete')
}

export function isSyncfySuccessfulStatus(status: string | null): boolean {
  if (!status) return true
  return /success|successful|active|ok|valid|synced|refreshed/i.test(status)
}

export function isSyncfyReconnectRequiredStatus(status: string | null): boolean {
  if (!status) return false
  return /needs[_ -]?reconnect|invalid[_ -]?user|reconnect/i.test(status)
}

export interface SyncfyCredentialHealth {
  found: boolean
  code: number | null
  isAuthorized: boolean | null
  isTwofa: boolean
}

export type SyncfyCredentialBlocker = 'needs_reconnect' | 'provider_pending' | null

export async function timingSafeStringEqual(actual: string, expected: string): Promise<boolean> {
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

export async function verifySupportAdminAccess(request: Request, env: Env): Promise<boolean> {
  if (!env.SUPPORT_ADMIN_SECRET) {
    return !isProductionEnv(env)
  }

  const suppliedSecret = request.headers.get(SUPPORT_ADMIN_SECRET_HEADER)
  if (!suppliedSecret) return false

  return timingSafeStringEqual(suppliedSecret, env.SUPPORT_ADMIN_SECRET)
}

export async function verifyDashboardEmailAccessOrSupportAdmin(
  env: Env,
  request: Request,
  email: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (await verifySupportAdminAccess(request, env)) return { ok: true }
  return verifyDashboardEmailAccess(env, request, email)
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

function isGenericFinanceCategory(category: string, type: FinanceTransactionType) {
  const normalized = normalizeCategoryInput(category).trim()
  if (!normalized) return true

  return type === 'income'
    ? normalized === 'OTRO INGRESO' || normalized === 'OTRO' || normalized === 'OTROS' || normalized === 'SIN CATEGORIA'
    : normalized === 'OTRO' || normalized === 'OTROS' || normalized === 'SIN CATEGORIA'
}

export function inferFinanceCategory(description: string, type: FinanceTransactionType) {
  if (type === 'income') {
    const incomeText = normalizeCategoryInput(description)
    if (/(SUELDO|NOMINA|REMUNERACION)/.test(incomeText)) return 'Sueldo'
    if (/(FREELANCE|HONORARIO|PROYECTO)/.test(incomeText)) return 'Freelance'
    if (/(INTERES|RENDIMIENTO|DIVIDENDO)/.test(incomeText)) return 'Inversión'
    if (/(REEMBOLSO|DEVOLUCION)/.test(incomeText)) return 'Reembolso'
    return 'Otro ingreso'
  }

  const value = normalizeCategoryInput(description)

  if (/(UBER EATS|DLO\*?UBER EATS|RAPPI|PEDIDOSYA|DELIVERY|RESTAUR|RESTA|REST |RESTMONARCH|PASTA|SUSHI|PESCAD|TAQU|TACO|ASADO|PIZZA|DOMINO|KFC|CAFE|COFFEE|STARBUCKS|COMIDA|BAR |CERVECER|FISHER|DOCENA|AROMI|SAPORI|BALCON DEL ZOCALO|PASTELERIA|HELADOS|LE PAIN|VINATA|SIGNORA|SONORA GRILL|JAPANTOWN|SIEMBRA)/.test(value)) return 'Comida fuera'
  if (/(NETFLIX|SPOTIFY|YOUTUBE|APPLE|GOOGLE|PRIME|DISNEY|HBO|OPENAI|MICROSOFT|ADOBE|ZOOM|FIGMA|SUBSCRIP|SUSCRIP)/.test(value)) return 'Suscripciones'
  if (/(AMERICAN EXPRESS|AMEX|PAGO TARJETA|TARJETA DE CREDITO|PAGO TDC|TDC|CREDITO 0*\d{3,}|SU PAGO.*GRACIAS|SU ABONO.*GRACIAS|GRACIAS POR SU PAGO|INTERESES DEL PERIODO|COMISION POR DISPOSICION|COM MANEJO DE CUENT|PLAN DE PAGOS DIFERIDOS|COMISION POR PLAN DE PAGOS DIFERIDOS|COMISION POR PLAN|IVA APLICABLE|SERVICIO DE FACTURACION|REVERSION CARGO)/.test(value)) return 'Deuda'
  if (/(SPEI ENVIADO|TRANSFERENCIA ENVIADA|PAGO CUENTA DE TERCERO|TRASPASO|STP|PAGO TERCERO)/.test(value)) return 'Transferencias'
  if (/(DISPOS\.?EFECTIVO|DISPOSICION EFECTIVO|RETIRO CAJERO|RET CAJ|\bRETIRO\b|CAJERO AUTOMATICO|ATM)/.test(value)) return 'Retiros'
  if (/(INVERSION|INVERTIR|FONDO DE INVERSION|CETES|CETESDIRECTO|GBM|GBM\+|BITSO|BROKER|CRIPTO|CRYPTO|ACCIONES|ETF)/.test(value)) return 'Inversión'
  if (/(UBER RIDE|UBER RIDES|DLO\*?TDA UBER RIDES|DLO\*?UBER RIDES|DIDI|TAXI|CABIFY|METRO|BENCINA|GASOLINA|COPEC|SHELL|PETROBRAS|TRANSPORTE|PEMEX)/.test(value)) return 'Transporte'
  if (/(SUPERMERCADO|JUMBO|LIDER|SANTA ISABEL|UNIMARC|TOTTUS|WALMART|WAL MART|WM EXPRESS|SUPERAMA|SAMS|COSTCO|CHEDRAUI|OXXO|MERCADO|ESTADO NATURAL)/.test(value)) return 'Supermercado'
  if (/(FARMACIA|HOSPITAL|CLINICA|MEDIC|SALUD|SOFIA|GYMPASS|GIMNASIO|FITNESS|PEDIATR|CLUB DEPORTIVO|CUICACALLI)/.test(value)) return 'Salud'
  if (/(ARRIENDO|RENTA|DIVIDENDO|HIPOTECA|LUZ|AGUA|GAS|INTERNET|TELCO|HOGAR|CFE|TELCEL)/.test(value)) return 'Hogar'
  if (/(COLEGIO|UNIVERSIDAD|EDUCACION|CURSO)/.test(value)) return 'Educación'
  if (/(IMPUESTO|\bSAT\b|\bSII\b|TESORERIA)/.test(value)) return 'Impuestos'
  if (/(ONLYFANS|CINE|CINEMEX|CINEPOLIS|TICKETMASTER|PALACIO DEPORTES|AUDITORIO|TEATRO|CONCIERTO|EVENTO|JUEGO|GAMING)/.test(value)) return 'Ocio'
  if (/(AMAZON|MERCADOPAGO|MERPAGO|LIVERPOOL|PALACIO|SEARS|SHOP|STORE|TIENDA|STRIPE|ADIDAS|LEVIS|HM MX|H M |FLORERIA|BOUT |CLIP MX|NETPAY|CONSUMO LOCAL AJENO)/.test(value)) return 'Compras'

  return 'Otro'
}

export function resolveFinanceCategory(
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

export function inferFinanceMerchant(description: string) {
  const cleaned = description
    .replace(/\s+/g, ' ')
    .replace(/[.*_#-]+/g, ' ')
    .trim()

  if (!cleaned) return ''
  return cleaned.split(' ').slice(0, 4).join(' ')
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}
