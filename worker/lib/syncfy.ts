import {
  asRecord,
  extractSyncfyCode,
  extractSyncfyCredentialPayload,
  extractSyncfyEventType,
  extractSyncfyRid,
  extractSyncfySiteMetadata,
  firstSyncfyInstitutionName,
  firstSyncfyOrganizationInstitutionName,
  isSyncfyReconnectRequiredStatus,
  isSyncfyRefreshEvent,
  isSyncfySuccessfulStatus,
  isUsefulSyncfyInstitutionName,
  lookupKnownSyncfyInstitutionName,
  parseJsonUnknown,
  stringFromUnknown,
} from './shared'
import type {
  Env,
  SyncfyConnectionIssue,
  SyncfyConnectionState,
  SyncfyCredentialBlocker,
  SyncfyCredentialHealth,
  SyncfyCredentialRow,
  SyncfyCredentialsResponse,
  SyncfyErrorRow,
  SyncfySiteMetadata,
  SyncfyUserRow,
  SyncfyWebhookEventRow,
} from './shared'
import {
  ensureFinanceTables,
  ensureSyncfyTables,
  getOrCreateUserByEmail,
  storeSyncfyError,
} from './db'

export const DEFAULT_SYNCFY_BASE_URL = 'https://sync.paybook.com/v1'

const SYNCFY_REFRESH_COOLDOWN_SECONDS = 30 * 60

const SYNCFY_DEFAULT_TRANSACTION_LIMIT = 500

const SYNCFY_DEFAULT_TRANSACTION_LOOKBACK_MONTHS = 6

const SYNCFY_MAX_TRANSACTION_IMPORT_COUNT = 5000

export function buildSyncfyExternalId(userId: string, version: number): string {
  return `finovai:user:${userId}:v${version}`
}

export class SyncfyRequestError extends Error {
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

export async function syncfyRequest<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
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
    throw new SyncfyRequestError(`Connection ${response.status}: ${text || response.statusText}`, {
      status: response.status,
      rid: extractSyncfyRid(data),
      code: extractSyncfyCode(data),
      responseBody: data,
    })
  }

  if (responseRecord && 'status' in responseRecord && 'response' in responseRecord) {
    const wrapped = responseRecord as { status: boolean; message?: string | null; response: T }
    if (!wrapped.status) {
      throw new SyncfyRequestError(wrapped.message || 'Connection request failed', {
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

export function buildSyncfyAuthHeaderValue(env: Env): string {
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

export async function findEmailBySyncfyUserId(env: Env, syncfyUserId: string): Promise<string | null> {
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

export async function storeSyncfyCredential(
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

  const user = await getOrCreateUserByEmail(env.DB, email)

  await env.DB.prepare(
    `INSERT INTO syncfy_credentials (
      id, email, syncfy_user_id, syncfy_credential_id, syncfy_site_id, site_name, status,
      last_successful_sync_at, last_pull_at, last_rid, raw_json, created_at, updated_at, user_id
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"), ?)
     ON CONFLICT(email, syncfy_credential_id) DO UPDATE SET
       syncfy_user_id = excluded.syncfy_user_id,
       syncfy_site_id = COALESCE(excluded.syncfy_site_id, syncfy_credentials.syncfy_site_id),
       site_name = COALESCE(excluded.site_name, syncfy_credentials.site_name),
       status = COALESCE(excluded.status, syncfy_credentials.status),
       last_successful_sync_at = COALESCE(excluded.last_successful_sync_at, syncfy_credentials.last_successful_sync_at),
       last_pull_at = COALESCE(excluded.last_pull_at, syncfy_credentials.last_pull_at),
       last_rid = COALESCE(excluded.last_rid, syncfy_credentials.last_rid),
       raw_json = excluded.raw_json,
       updated_at = datetime("now"),
       user_id = COALESCE(excluded.user_id, syncfy_credentials.user_id)`
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
      JSON.stringify(payload),
      user.id
    )
    .run()

  return env.DB.prepare(`SELECT * FROM syncfy_credentials WHERE email = ? AND syncfy_credential_id = ?`)
    .bind(email, credential.syncfyCredentialId)
    .first<SyncfyCredentialRow>()
}

export function getSyncfyTransactionLookbackMonths(env: Pick<Env, 'SYNCFY_TRANSACTION_LOOKBACK_MONTHS'>): number {
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

export function getSyncfyCredentialCooldownSeconds(credential: SyncfyCredentialRow): number {
  if (!credential.last_pull_at) return 0

  const lastPullMs = Date.parse(credential.last_pull_at)
  if (!Number.isFinite(lastPullMs)) return 0

  const elapsedSeconds = Math.floor((Date.now() - lastPullMs) / 1000)
  return Math.max(SYNCFY_REFRESH_COOLDOWN_SECONDS - elapsedSeconds, 0)
}

// Paybook credential codes that require the user to redo/complete institution login:
// 401 invalid credentials, 403 forbidden, 405 locked account, 410-413 token/2FA states.
const SYNCFY_CREDENTIAL_RECONNECT_CODES = new Set([401, 403, 405, 410, 411, 412, 413])

export async function fetchSyncfyCredentialHealth(
  env: Env,
  syncfyUserId: string | null,
  credentialId: string | null
): Promise<SyncfyCredentialHealth | null> {
  if (!env.SYNCFY_API_KEY || !syncfyUserId || !credentialId) return null

  try {
    const response = await syncfyRequest<unknown>(
      env,
      `/credentials?id_user=${encodeURIComponent(syncfyUserId)}`,
      { method: 'GET' }
    )
    const records = Array.isArray(response) ? response : []

    for (const entry of records) {
      const record = asRecord(entry)
      if (!record) continue
      if (stringFromUnknown(record.id_credential, 256) !== credentialId) continue
      return parseSyncfyCredentialHealth(record)
    }

    return { found: false, code: null, isAuthorized: null, isTwofa: false }
  } catch {
    // Health checks must never break the import path; fall back to legacy behavior.
    return null
  }
}

export function parseSyncfyCredentialHealth(record: Record<string, unknown>): SyncfyCredentialHealth {
  const rawCode = record.code
  const code = typeof rawCode === 'number' && Number.isFinite(rawCode) ? rawCode : null
  const rawAuthorized = record.is_authorized
  const isAuthorized = typeof rawAuthorized === 'boolean'
    ? rawAuthorized
    : typeof rawAuthorized === 'number'
      ? rawAuthorized === 1
      : null
  const rawTwofa = record.is_twofa

  return {
    found: true,
    code,
    isAuthorized,
    isTwofa: rawTwofa === 1 || rawTwofa === true,
  }
}

export function classifySyncfyCredentialBlocker(health: SyncfyCredentialHealth | null): SyncfyCredentialBlocker {
  if (!health || !health.found) return null
  if (health.isAuthorized !== false) return null

  if (health.code !== null && SYNCFY_CREDENTIAL_RECONNECT_CODES.has(health.code)) return 'needs_reconnect'
  if (health.isTwofa) return 'needs_reconnect'
  if (health.code !== null && health.code >= 500) return 'provider_pending'

  return null
}

export function getSyncfyCredentialBlockerMessage(
  blocker: Exclude<SyncfyCredentialBlocker, null>,
  health: SyncfyCredentialHealth | null
): string {
  if (blocker === 'needs_reconnect') {
    return health?.isTwofa
      ? 'La institución pide una verificación adicional. Usa "Actualizar acceso" para completar el código de seguridad.'
      : 'La institución rechazó el acceso guardado. Usa "Actualizar acceso" para volver a conectar tu banco.'
  }

  return 'La institución está fallando al iniciar sesión. FinovAI seguirá reintentando automáticamente.'
}

function getSyncfyConnectionState(credential: SyncfyCredentialRow): SyncfyConnectionState {
  if (credential.status === 'synced') return 'ready'
  if (credential.connection_issue?.kind === 'action_required' || isSyncfyReconnectRequiredStatus(credential.status)) {
    return 'action_required'
  }
  if (
    credential.connection_issue?.kind === 'provider_unavailable' ||
    credential.status === 'provider_unavailable'
  ) {
    return 'provider_unavailable'
  }
  if (credential.connection_issue?.kind === 'unknown' || credential.status === 'sync_error') {
    return 'support_required'
  }

  return 'verifying'
}

export function syncfyCredentialToApi(credential: SyncfyCredentialRow): SyncfyCredentialsResponse['credentials'][number] {
  const cooldownSeconds = getSyncfyCredentialCooldownSeconds(credential)
  const connectionState = getSyncfyConnectionState(credential)
  const needsReconnect = connectionState === 'action_required'

  return {
    id: credential.id,
    syncfyCredentialId: credential.syncfy_credential_id,
    siteName: credential.site_name || lookupKnownSyncfyInstitutionName(credential.syncfy_site_id, null),
    status: credential.status,
    lastSuccessfulSyncAt: credential.last_successful_sync_at,
    lastPullAt: credential.last_pull_at,
    cooldownSeconds,
    ready: cooldownSeconds === 0,
    needsReconnect,
    connectionState,
    connectionIssue: credential.connection_issue || null,
  }
}

export async function loadSyncfyCredentialsForEmail(env: Env, email: string): Promise<SyncfyCredentialRow[]> {
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

export async function deleteSyncfyCredentialForEmail(
  env: Env,
  email: string,
  credentialId: string
): Promise<{
  credential: SyncfyCredentialRow | null
  deletedTransactions: number
  credentials: SyncfyCredentialRow[]
  syncfyCredentialDeleteAttempted: boolean
  syncfyCredentialDeleted: boolean
}> {
  await ensureSyncfyTables(env)
  await ensureFinanceTables(env)

  const credential = await env.DB.prepare(
    `SELECT * FROM syncfy_credentials WHERE email = ? AND syncfy_credential_id = ?`
  )
    .bind(email, credentialId)
    .first<SyncfyCredentialRow>()

  if (!credential) {
    return {
      credential: null,
      deletedTransactions: 0,
      credentials: await loadDisplaySyncfyCredentialsForEmail(env, email),
      syncfyCredentialDeleteAttempted: false,
      syncfyCredentialDeleted: false,
    }
  }

  const syncfyDelete = await deleteSyncfyCredentialUpstream(env, credential)
  const localDeletion = await deleteLocalSyncfyCredentialForEmail(env, email, credentialId)

  return {
    credential,
    deletedTransactions: localDeletion.deletedTransactions,
    credentials: localDeletion.credentials,
    syncfyCredentialDeleteAttempted: syncfyDelete.attempted,
    syncfyCredentialDeleted: syncfyDelete.deleted,
  }
}

async function deleteLocalSyncfyCredentialForEmail(
  env: Env,
  email: string,
  credentialId: string
): Promise<{ deletedTransactions: number; credentials: SyncfyCredentialRow[] }> {
  const transactionDelete = await env.DB.prepare(
    `DELETE FROM transactions
     WHERE email = ?
       AND source = 'syncfy'
       AND (
         raw_source LIKE ?
         OR id LIKE ?
       )`
  )
    .bind(email, `%${credentialId}%`, `%${credentialId}%`)
    .run()

  await env.DB.prepare(
    `DELETE FROM syncfy_credentials
     WHERE email = ?
       AND syncfy_credential_id = ?`
  )
    .bind(email, credentialId)
    .run()

  return {
    deletedTransactions: Number(transactionDelete.meta?.changes || 0),
    credentials: await loadDisplaySyncfyCredentialsForEmail(env, email),
  }
}

export async function deleteLocalSyncfyStateForEmail(
  env: Env,
  email: string
): Promise<{ deletedTransactions: number; deletedCredentials: number; credentials: SyncfyCredentialRow[] }> {
  await ensureSyncfyTables(env)
  await ensureFinanceTables(env)

  const transactionDelete = await env.DB.prepare(
    `DELETE FROM transactions
     WHERE email = ?
       AND source = 'syncfy'`
  )
    .bind(email)
    .run()

  const credentialDelete = await env.DB.prepare(
    `DELETE FROM syncfy_credentials WHERE email = ?`
  )
    .bind(email)
    .run()

  return {
    deletedTransactions: Number(transactionDelete.meta?.changes || 0),
    deletedCredentials: Number(credentialDelete.meta?.changes || 0),
    credentials: await loadDisplaySyncfyCredentialsForEmail(env, email),
  }
}

export async function deleteSyncfyCredentialFromWebhook(
  env: Env,
  event: SyncfyWebhookEventRow
): Promise<void> {
  const credentialId = event.syncfy_credential_id
  if (!credentialId) return

  let email = event.syncfy_user_id ? await findEmailBySyncfyUserId(env, event.syncfy_user_id) : null
  if (!email) {
    const row = await env.DB.prepare(`SELECT email FROM syncfy_credentials WHERE syncfy_credential_id = ? LIMIT 1`)
      .bind(credentialId)
      .first<{ email: string }>()
    email = row?.email || null
  }

  if (!email) return
  await deleteLocalSyncfyCredentialForEmail(env, email, credentialId)
}

async function deleteSyncfyCredentialUpstream(
  env: Env,
  credential: SyncfyCredentialRow
): Promise<{ attempted: boolean; deleted: boolean }> {
  if (!env.SYNCFY_API_KEY || credential.syncfy_user_id.startsWith('local_')) {
    return { attempted: false, deleted: false }
  }

  const params = new URLSearchParams()
  params.set('id_user', credential.syncfy_user_id)
  const path = `/credentials/${encodeURIComponent(credential.syncfy_credential_id)}?${params.toString()}`

  try {
    await syncfyRequest<unknown>(env, path, { method: 'DELETE' })
    return { attempted: true, deleted: true }
  } catch (err) {
    if (err instanceof SyncfyRequestError) {
      await storeSyncfyError(env, {
        email: credential.email,
        syncfyUserId: credential.syncfy_user_id,
        syncfyCredentialId: credential.syncfy_credential_id,
        rid: err.rid || credential.last_rid,
        statusCode: err.status,
        errorCode: err.code,
        message: err.message,
        source: 'syncfy-delete-credential',
        payload: err.responseBody,
      })

      if ([200, 400, 401, 404, 410].includes(err.status)) {
        return { attempted: true, deleted: false }
      }
    }

    throw err
  }
}

function buildSyncfyCataloguePath(path: string, metadata: SyncfySiteMetadata): string {
  const params = new URLSearchParams()
  if (metadata.syncfySiteId) params.set('id_site', metadata.syncfySiteId)
  if (metadata.syncfySiteOrganizationId) params.set('id_site_organization', metadata.syncfySiteOrganizationId)

  const query = params.toString()
  return query ? `${path}?${query}` : path
}

async function readSyncfyCatalogueInstitutionName(env: Env, path: string): Promise<string | null> {
  try {
    const response = await syncfyRequest<unknown>(env, path, { method: 'GET' })
    return firstSyncfyOrganizationInstitutionName(response) || firstSyncfyInstitutionName(response)
  } catch {
    // Institution names are presentational; transaction imports must not fail on catalogue lookup.
    return null
  }
}

async function fetchSyncfyInstitutionName(env: Env, metadata: SyncfySiteMetadata): Promise<string | null> {
  const knownName = lookupKnownSyncfyInstitutionName(metadata.syncfySiteId, metadata.syncfySiteOrganizationId)
  if (knownName) return knownName
  if (!env.SYNCFY_API_KEY) return null

  let organizationId = metadata.syncfySiteOrganizationId

  if (organizationId) {
    const organizationName = await readSyncfyCatalogueInstitutionName(
      env,
      buildSyncfyCataloguePath('/catalogues/site_organizations', {
        syncfySiteId: metadata.syncfySiteId,
        syncfySiteOrganizationId: organizationId,
        siteName: null,
      })
    )
    if (organizationName) return organizationName
  }

  if (metadata.syncfySiteId) {
    try {
      const siteResponse = await syncfyRequest<unknown>(
        env,
        buildSyncfyCataloguePath('/catalogues/sites', metadata),
        { method: 'GET' }
      )
      const siteMetadata = extractSyncfySiteMetadata(siteResponse)
      // Prefer nested organization brand names; never trust site channel labels alone.
      const nestedOrganizationName = firstSyncfyOrganizationInstitutionName(siteResponse)
      if (nestedOrganizationName) return nestedOrganizationName

      organizationId = organizationId || siteMetadata.syncfySiteOrganizationId
      if (organizationId) {
        const organizationName = await readSyncfyCatalogueInstitutionName(
          env,
          buildSyncfyCataloguePath('/catalogues/site_organizations', {
            syncfySiteId: metadata.syncfySiteId,
            syncfySiteOrganizationId: organizationId,
            siteName: null,
          })
        )
        if (organizationName) return organizationName
      }
    } catch {
      // Institution names are presentational; transaction imports must not fail on catalogue lookup.
    }
  }

  return null
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

  // Keep channel labels like "Personal" until a real organization name is resolved.
  // Clearing them made Conectar cuenta fall back to raw Syncfy credential IDs.
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

export async function enrichSyncfyCredentialInstitutionById(
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

async function attachSyncfyConnectionIssues(
  env: Env,
  email: string,
  credentials: SyncfyCredentialRow[]
): Promise<SyncfyCredentialRow[]> {
  const unresolvedCredentialIds = new Set(
    credentials
      .filter((credential) => credential.status !== 'synced')
      .map((credential) => credential.syncfy_credential_id)
  )
  if (unresolvedCredentialIds.size === 0) return credentials

  const errors = await env.DB.prepare(
    `SELECT id, email, syncfy_user_id, syncfy_credential_id, rid, status_code,
            error_code, message, source, created_at
     FROM syncfy_errors
     WHERE email = ?
       AND syncfy_credential_id IS NOT NULL
       AND created_at >= datetime('now', '-30 days')
     ORDER BY created_at DESC
     LIMIT 100`
  )
    .bind(email)
    .all<SyncfyErrorRow>()
  const issues = new Map<string, SyncfyConnectionIssue>()

  for (const error of errors.results) {
    const credentialId = error.syncfy_credential_id
    if (!credentialId || !unresolvedCredentialIds.has(credentialId) || issues.has(credentialId)) continue
    issues.set(credentialId, classifySyncfyConnectionIssue(error))
  }

  return credentials.map((credential) => ({
    ...credential,
    connection_issue: credential.status === 'synced'
      ? null
      : issues.get(credential.syncfy_credential_id) || null,
  }))
}

export async function loadDisplaySyncfyCredentialsForEmail(env: Env, email: string): Promise<SyncfyCredentialRow[]> {
  const credentials = await loadSyncfyCredentialsForEmail(env, email)
  const missingLabels = credentials.filter((credential) => (
    !credential.site_name || !isUsefulSyncfyInstitutionName(credential.site_name)
  ))
  let displayCredentials = credentials

  if (missingLabels.length > 0) {
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

    if (changed) {
      displayCredentials = await loadSyncfyCredentialsForEmail(env, email)
    }
  }

  return attachSyncfyConnectionIssues(env, email, displayCredentials)
}

export async function storeSyncfyWebhookEvent(env: Env, payload: unknown): Promise<SyncfyWebhookEventRow> {
  const eventType = extractSyncfyEventType(payload)
  const credential = extractSyncfyCredentialPayload(payload)
  const id = crypto.randomUUID()

  await env.DB.prepare(
    `INSERT INTO syncfy_webhook_events (
      id, event_type, syncfy_user_id, syncfy_credential_id, rid, payload_json, processed_at, created_at
    )
     VALUES (?, ?, ?, ?, ?, ?, NULL, datetime("now"))`
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
    throw new Error('Unable to store connection webhook event')
  }

  return event
}

export async function markSyncfyWebhookEventProcessed(env: Env, eventId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE syncfy_webhook_events
     SET processed_at = datetime("now")
     WHERE id = ?`
  )
    .bind(eventId)
    .run()
}

export function buildSyncfyUserMessage(error: SyncfyRequestError): string {
  if (error.status === 402) {
    return 'La cuenta de Syncfy no tiene habilitada la creación de nuevas credenciales. El equipo debe corregir la llave o el plan de Syncfy antes de pedirte reintentar.'
  }

  if (error.status === 429) {
    return 'La conexión está limitando nuevas sincronizaciones. Intenta de nuevo en unos minutos.'
  }

  if (error.status === 401 || error.status === 403) {
    return 'No pudimos autenticar la conexión bancaria. El equipo debe revisar la configuración.'
  }

  if (error.status >= 500) {
    return 'La conexión bancaria no respondió correctamente. Intenta de nuevo más tarde.'
  }

  return 'No pudimos completar la conexión con la institución. Revisa los datos o intenta otra vez.'
}

export function classifySyncfyConnectionIssue(
  error: Pick<SyncfyErrorRow, 'rid' | 'status_code' | 'message' | 'source' | 'created_at'>
): SyncfyConnectionIssue {
  const text = `${error.message || ''}`.toLowerCase()
  const actionRequired = (
    /credential error.*password/.test(text) ||
    /update|updating|actualiza/.test(text) && /password|contrase|credential|acceso/.test(text) ||
    /invalid|incorrect|rejected|rechaz/.test(text) && /password|contrase|credential|login|access|acceso/.test(text) ||
    /two.?factor|2fa|verification code|c[oó]digo de seguridad|otp/.test(text)
  )
  const providerUnavailable = (
    (error.status_code !== null && error.status_code >= 500) ||
    /can't be sync at this moment|cannot be sync at this moment|temporar|unavailable|maintenance|mantenimiento/.test(text)
  )
  const rateLimited = error.status_code === 429 || /rate limit|too many requests|limit exceeded/.test(text)

  if (actionRequired) {
    return {
      kind: 'action_required',
      owner: 'user',
      action: 'update_access',
      title: 'Actualiza el acceso de esta institución',
      message: 'La institución rechazó el acceso guardado. La contraseña pudo cambiar o puede faltar una verificación de seguridad.',
      supportCode: error.rid,
      statusCode: error.status_code,
      occurredAt: error.created_at,
      source: error.source,
    }
  }

  if (providerUnavailable) {
    return {
      kind: 'provider_unavailable',
      owner: 'provider',
      action: 'retry_later',
      title: 'La institución no está disponible',
      message: 'La conexión de esta institución está fallando temporalmente. No necesitas volver a ingresar tu contraseña; FinovAI reintentará automáticamente.',
      supportCode: error.rid,
      statusCode: error.status_code,
      occurredAt: error.created_at,
      source: error.source,
    }
  }

  if (rateLimited) {
    return {
      kind: 'rate_limited',
      owner: 'provider',
      action: 'retry_later',
      title: 'La institución sigue procesando la conexión',
      message: 'La institución limitó temporalmente las verificaciones. FinovAI volverá a intentar sin que tengas que reconectar.',
      supportCode: error.rid,
      statusCode: error.status_code,
      occurredAt: error.created_at,
      source: error.source,
    }
  }

  return {
    kind: 'unknown',
    owner: 'finovai',
    action: 'contact_support',
    title: 'No pudimos completar esta conexión',
    message: 'La institución respondió con un error que necesita revisión. Intenta otra vez o comparte el código de soporte con el equipo.',
    supportCode: error.rid,
    statusCode: error.status_code,
    occurredAt: error.created_at,
    source: error.source,
  }
}

export async function getOrCreateSyncfyUser(env: Env, email: string, name?: string): Promise<SyncfyUserRow> {
  await ensureSyncfyTables(env)

  const existing = await env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
    .bind(email)
    .first<SyncfyUserRow>()

  if (existing) return existing

  const user = await getOrCreateUserByEmail(env.DB, email)
  const syncfyExternalId = buildSyncfyExternalId(user.id, user.syncfy_identity_version)
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
    `INSERT INTO syncfy_users (email, syncfy_user_id, syncfy_external_id, name, mode, created_at, user_id)
     VALUES (?, ?, ?, ?, ?, datetime("now"), ?)`
  )
    .bind(email, syncfyUserId, syncfyExternalId, name?.trim() || '', mode, user.id)
    .run()

  const created = await env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
    .bind(email)
    .first<SyncfyUserRow>()

  if (!created) {
    throw new Error('Unable to create connection user')
  }

  return created
}

export function isSyncfyInvalidUserError(error: SyncfyRequestError): boolean {
  if (error.status !== 401) return false
  const body = asRecord(error.responseBody)
  const bodyMessage = stringFromUnknown(body?.message)
  return /invalid user/i.test(`${error.message} ${bodyMessage || ''}`)
}

export async function recreateSyncfyUser(
  env: Env,
  email: string,
  name?: string,
  externalId?: string
): Promise<SyncfyUserRow> {
  await ensureSyncfyTables(env)
  const user = await getOrCreateUserByEmail(env.DB, email)
  const resolvedExternalId = externalId ?? buildSyncfyExternalId(user.id, user.syncfy_identity_version)

  if (!env.SYNCFY_API_KEY) {
    throw new Error('SYNCFY_API_KEY is not configured')
  }

  const createdUser = await syncfyRequest<{ id_user: string }>(env, '/users', {
    method: 'POST',
    body: JSON.stringify({
      name: name?.trim() || email,
      id_external: resolvedExternalId,
    }),
  })

  await env.DB.prepare(
    `INSERT INTO syncfy_users (email, syncfy_user_id, syncfy_external_id, name, mode, created_at, updated_at, user_id)
     VALUES (?, ?, ?, ?, 'live', datetime("now"), datetime("now"), ?)
     ON CONFLICT(email) DO UPDATE SET
       syncfy_user_id = excluded.syncfy_user_id,
       syncfy_external_id = excluded.syncfy_external_id,
       name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE syncfy_users.name END,
       mode = 'live',
       updated_at = datetime("now"),
       user_id = excluded.user_id`
  )
    .bind(email, createdUser.id_user, resolvedExternalId, name?.trim() || '', user.id)
    .run()

  const recreated = await env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
    .bind(email)
    .first<SyncfyUserRow>()

  if (!recreated) {
    throw new Error('Unable to recreate connection user')
  }

  return recreated
}

export async function createSyncfyWidgetSession(env: Env, syncfyUser: SyncfyUserRow): Promise<{ token: string | null; mode: 'live' | 'local' }> {
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

export async function resetSyncfyConnectionForEmail(
  env: Env,
  email: string,
  name?: string
): Promise<{ syncfyUser: SyncfyUserRow | null; recreated: boolean; deletedTransactions: number; deletedCredentials: number }> {
  await ensureSyncfyTables(env)

  const localState = await deleteLocalSyncfyStateForEmail(env, email)

  if (!env.SYNCFY_API_KEY) {
    return {
      syncfyUser: await findSyncfyUserByEmail(env, email),
      recreated: false,
      deletedTransactions: localState.deletedTransactions,
      deletedCredentials: localState.deletedCredentials,
    }
  }

  try {
    return {
      syncfyUser: await recreateSyncfyUser(env, email, name),
      recreated: true,
      deletedTransactions: localState.deletedTransactions,
      deletedCredentials: localState.deletedCredentials,
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
          const user = await getOrCreateUserByEmail(env.DB, email)
          await env.DB.prepare(
            `UPDATE users SET syncfy_identity_version = syncfy_identity_version + 1 WHERE id = ?`
          )
            .bind(user.id)
            .run()
          return {
            syncfyUser: await recreateSyncfyUser(
              env,
              email,
              name,
              buildSyncfyExternalId(user.id, user.syncfy_identity_version + 1)
            ),
            recreated: true,
            deletedTransactions: localState.deletedTransactions,
            deletedCredentials: localState.deletedCredentials,
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
            return {
              syncfyUser: await findSyncfyUserByEmail(env, email),
              recreated: false,
              deletedTransactions: localState.deletedTransactions,
              deletedCredentials: localState.deletedCredentials,
            }
          }
          throw fallbackErr
        }
      }

      return {
        syncfyUser: await findSyncfyUserByEmail(env, email),
        recreated: false,
        deletedTransactions: localState.deletedTransactions,
        deletedCredentials: localState.deletedCredentials,
      }
    }
    throw err
  }
}
