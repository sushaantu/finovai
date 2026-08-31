import {
  DEFAULT_FINANCE_CURRENCY,
  normalizeCategoryInput,
  roundMoney,
} from '../../shared/finance-core'
import type {
  FinanceTransactionType,
} from '../../shared/finance-core'
import {
  asRecord,
  cleanText,
  collectSyncfyRecords,
  extractSyncfySiteMetadata,
  firstSyncfyString,
  inferFinanceCategory,
  inferFinanceMerchant,
  normalizeFinancialAmount,
  normalizeFinancialDate,
  parseJsonUnknown,
  resolveFinanceCategory,
  stringFromUnknown,
} from './shared'
import type {
  Env,
  FinanceTransactionRow,
  NormalizedSyncfyTransaction,
  SyncfyConnectionIssueKind,
  SyncfyCredentialRow,
  SyncfySiteMetadata,
  SyncfyTransactionImportResult,
} from './shared'
import {
  ensureFinanceTables,
  ensureSyncfyTables,
  getOrCreateUserByEmail,
  storeSyncfyError,
  upsertFinancialProfile,
} from './db'
import {
  SyncfyRequestError,
  addSyncfyUserParamToEndpoint,
  buildNextSyncfyTransactionsPageEndpoint,
  buildSyncfyTransactionsPath,
  classifySyncfyConnectionIssue,
  enrichSyncfyCredentialInstitutionById,
  getSyncfyTransactionLookbackMonths,
  normalizeSyncfyRequestPath,
  syncfyRequest,
} from './syncfy'

// Backoff for re-running provider pulls after Syncfy-side scrape failures (code 5xx).
const SYNCFY_PROVIDER_RETRY_INTERVAL_SECONDS = 24 * 60 * 60

const SYNCFY_BACKGROUND_REFRESH_INTERVAL_SECONDS = 24 * 60 * 60

const SYNCFY_BACKGROUND_REFRESH_LIMIT = 25

const SYNCFY_MAX_TRANSACTION_IMPORT_PAGES = 10

export function getSyncfyWebhookEndpointPaths(payload: unknown, key: 'accounts' | 'credential' | 'transactions'): string[] {
  for (const record of collectSyncfyRecords(payload)) {
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

export function getSyncfyCredentialJobStatusPaths(credential: SyncfyCredentialRow): string[] {
  if (!credential.raw_json) return []
  return getSyncfyJobStatusPaths(parseJsonUnknown(credential.raw_json))
}

function buildSyncfyCredentialPullPath(credentialId: string, syncfyUserId: string): string {
  const params = new URLSearchParams({ id_user: syncfyUserId })
  return `/credentials/${encodeURIComponent(credentialId)}/pulls?${params.toString()}`
}

async function storeSyncfyCredentialPullState(
  env: Env,
  email: string,
  credentialId: string,
  pullResponse: unknown
): Promise<void> {
  await ensureSyncfyTables(env)

  const existing = await env.DB.prepare(`SELECT * FROM syncfy_credentials WHERE email = ? AND syncfy_credential_id = ?`)
    .bind(email, credentialId)
    .first<SyncfyCredentialRow>()

  if (!existing) return

  const previousRaw = existing.raw_json ? parseJsonUnknown(existing.raw_json) : null
  await env.DB.prepare(
    `UPDATE syncfy_credentials
     SET raw_json = ?,
         last_pull_at = datetime("now"),
         status = 'pending_transactions',
         updated_at = datetime("now")
     WHERE email = ? AND syncfy_credential_id = ?`
  )
    .bind(JSON.stringify({
      previous: previousRaw,
      pull: pullResponse,
      response: pullResponse,
    }), email, credentialId)
    .run()
}

export function isSyncfyTransactionImportComplete(
  result: Pick<SyncfyTransactionImportResult, 'fetched' | 'imported' | 'skipped'>
): boolean {
  return result.imported > 0
}

function getSyncfyTransactionImportMessage(result: SyncfyTransactionImportResult): string {
  if (isSyncfyTransactionImportComplete(result)) {
    return `${result.imported} movimientos sincronizados.`
  }

  if (result.connectionIssue) {
    return result.connectionIssue.message
  }

  if (result.fetched > 0 && result.skipped >= result.fetched) {
    return 'La conexión devolvió movimientos, pero FinovAI todavía no pudo leer el formato de esa institución. El equipo debe revisar esa respuesta.'
  }

  return 'La institución quedó conectada. Los movimientos todavía se están preparando; FinovAI reintentará automáticamente.'
}

export async function countStoredSyncfyTransactionsForCredential(
  env: Env,
  email: string,
  credentialId: string
): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM transactions
     WHERE email = ?
       AND source = 'syncfy'
       AND instr(COALESCE(raw_source, ''), ?) > 0`
  )
    .bind(email, `"_finovaiCredentialId":"${credentialId}"`)
    .first<{ count: number }>()

  return Number(row?.count || 0)
}

export async function resolveSyncfyTransactionImportState(
  env: Env,
  email: string,
  credentialId: string,
  result: SyncfyTransactionImportResult
): Promise<{ complete: boolean; storedTransactions: number }> {
  if (isSyncfyTransactionImportComplete(result)) {
    return { complete: true, storedTransactions: result.imported }
  }

  const storedTransactions = await countStoredSyncfyTransactionsForCredential(env, email, credentialId)
  return { complete: storedTransactions > 0, storedTransactions }
}

export function getSyncfyTransactionImportMessageForState(
  result: SyncfyTransactionImportResult,
  state: { complete: boolean; storedTransactions: number }
): string {
  if (state.complete && !isSyncfyTransactionImportComplete(result)) {
    return `${state.storedTransactions} movimientos sincronizados.`
  }

  return getSyncfyTransactionImportMessage(result)
}

export function isSyncfyProviderPullRetryDue(
  lastPullAttemptAt: string | null,
  nowMs = Date.now()
): boolean {
  if (!lastPullAttemptAt) return true

  const attemptMs = Date.parse(lastPullAttemptAt)
  if (!Number.isFinite(attemptMs)) return true

  return nowMs - attemptMs >= SYNCFY_PROVIDER_RETRY_INTERVAL_SECONDS * 1000
}

export function isSyncfyBackgroundRefreshDue(
  lastPullAt: string | null,
  nowMs = Date.now()
): boolean {
  if (!lastPullAt) return true

  const lastPullMs = Date.parse(lastPullAt)
  if (!Number.isFinite(lastPullMs)) return true

  return nowMs - lastPullMs >= SYNCFY_BACKGROUND_REFRESH_INTERVAL_SECONDS * 1000
}

async function recordSyncfyCredentialPullAttempt(
  env: Env,
  email: string,
  credentialId: string
): Promise<void> {
  await env.DB.prepare(
    `UPDATE syncfy_credentials
     SET last_pull_attempt_at = datetime("now"),
         updated_at = datetime("now")
     WHERE email = ? AND syncfy_credential_id = ?`
  )
    .bind(email, credentialId)
    .run()
}

export async function loadDueSyncfyCredentials(env: Env): Promise<SyncfyCredentialRow[]> {
  await ensureSyncfyTables(env)

  // needs_reconnect requires user action (new login/2FA in the widget); polling cannot fix it.
  const result = await env.DB.prepare(
    `SELECT * FROM syncfy_credentials
     WHERE (last_pull_at IS NULL
        OR unixepoch(last_pull_at) <= unixepoch('now') - ?)
       AND COALESCE(status, '') <> 'needs_reconnect'
     ORDER BY COALESCE(last_pull_at, created_at) ASC
     LIMIT ?`
  )
    .bind(SYNCFY_BACKGROUND_REFRESH_INTERVAL_SECONDS, SYNCFY_BACKGROUND_REFRESH_LIMIT)
    .all<SyncfyCredentialRow>()

  return result.results
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
    'Movimiento conectado'
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

  const type = inferSyncfyTransactionType(record, description, charge, deposit, rawAmount)
  const currency = (firstSyncfyString(record, ['currency', 'currency_code', 'id_currency']) || DEFAULT_FINANCE_CURRENCY).toUpperCase().slice(0, 8)
  const category = resolveFinanceCategory(
    extractSyncfyProviderCategory(record) || (type === 'income' ? 'Otro ingreso' : 'Otro'),
    description,
    merchant,
    type,
    'syncfy'
  )
  const stableId = externalId || `${credentialId || 'credential'}-${date}-${amountSource}-${description}-${index}`
  const rawWithCredential = {
    ...record,
    _finovaiCredentialId: credentialId,
  }

  return {
    id: `syncfy:${stableId}`.slice(0, 512),
    date,
    type,
    amount: Math.abs(roundMoney(amountSource)),
    currency,
    category,
    description: description || 'Movimiento conectado',
    merchant: merchant || 'Conexión bancaria',
    syncfyCredentialId: credentialId,
    raw: rawWithCredential,
  }
}

function inferSyncfyTransactionType(
  record: Record<string, unknown>,
  description: string,
  charge: number | null,
  deposit: number | null,
  rawAmount: number | null
): FinanceTransactionType {
  const typeText = normalizeCategoryInput(firstSyncfyString(record, ['type', 'transaction_type', 'movement_type']) || '')
  const reference = firstSyncfyString(record, ['reference', 'id_reference', 'external_reference']) || ''
  const signalText = normalizeCategoryInput(`${description} ${reference}`)

  if (/DEBIT|CARGO|CHARGE|WITHDRAWAL|EXPENSE|RETIRO|ENVIADO/.test(typeText)) return 'expense'
  if (/CREDIT|DEPOSIT|INCOME|INGRESO|RECIBIDO/.test(typeText)) return 'income'

  if (/(PAGO TDC|PAGO TARJETA|TARJETA DE CREDITO|SU PAGO.*GRACIAS|SU ABONO.*GRACIAS|GRACIAS POR SU PAGO)/.test(signalText)) {
    return 'expense'
  }

  if (deposit !== null) return 'income'
  if (charge !== null) return 'expense'

  if (rawAmount !== null) {
    if (rawAmount < 0) return 'expense'
    if (/(DEPOSITO|SPEI RECIBIDO|PAGO INTERBANCARIO|INTERES)/.test(signalText)) return 'income'
    return 'income'
  }

  return 'expense'
}

export function resolveSyncfyStoredTransactionType(row: FinanceTransactionRow): FinanceTransactionType {
  if (row.source !== 'syncfy' || !row.raw_source) return row.type

  const record = asRecord(parseJsonUnknown(row.raw_source))
  if (!record) return row.type

  const charge = firstSyncfyNumber(record, ['charge', 'debit', 'withdrawal', 'expense'])
  const deposit = firstSyncfyNumber(record, ['deposit', 'credit', 'income'])
  const rawAmount = firstSyncfyNumber(record, ['amount', 'amount_original', 'transaction_amount', 'total'])

  return inferSyncfyTransactionType(record, row.description, charge, deposit, rawAmount)
}

function extractSyncfyProviderCategory(raw: unknown): string | null {
  const category = cleanText(firstSyncfyString(raw, [
    'category',
    'category_name',
    'categoryName',
    'transaction_category',
    'subcategory',
    'sub_category',
    'subcategory_name',
    'subcategoryName',
  ]) || '')

  return category || null
}

export function resolveSyncfyStoredTransactionCategory(
  row: FinanceTransactionRow,
  type: FinanceTransactionType
): string | null {
  if (row.source !== 'syncfy' || !row.raw_source) return null

  const raw = parseJsonUnknown(row.raw_source)
  const providerCategory = extractSyncfyProviderCategory(raw)

  if (providerCategory) {
    return resolveFinanceCategory(providerCategory, row.description, row.merchant, type, row.source)
  }

  return inferFinanceCategory(`${row.description} ${row.merchant || ''}`.trim(), type)
}

async function upsertSyncfyFinanceTransaction(
  env: Env,
  email: string,
  transaction: NormalizedSyncfyTransaction
): Promise<boolean> {
  await upsertFinancialProfile(env, email)
  const user = await getOrCreateUserByEmail(env.DB, email)

  await env.DB.prepare(
    `INSERT INTO transactions (
      id, email, date, type, amount, currency, category, description, merchant, notes,
      source, confidence, category_locked, raw_source, cartola_import_id, created_at, updated_at, user_id
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'syncfy', 0.9, 0, ?, NULL, datetime("now"), datetime("now"), ?)
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
       updated_at = datetime("now"),
       user_id = COALESCE(excluded.user_id, transactions.user_id)`
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
      JSON.stringify(transaction.raw),
      user.id
    )
    .run()

  return true
}

export async function importSyncfyTransactionsFromEndpoints(
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

export function mergeSyncfyTransactionImportResults(
  left: SyncfyTransactionImportResult,
  right: SyncfyTransactionImportResult
): SyncfyTransactionImportResult {
  const issuePriority: Record<SyncfyConnectionIssueKind, number> = {
    action_required: 4,
    provider_unavailable: 3,
    unknown: 2,
    rate_limited: 1,
  }
  const leftIssue = left.connectionIssue || null
  const rightIssue = right.connectionIssue || null
  const connectionIssue = !leftIssue
    ? rightIssue
    : !rightIssue
      ? leftIssue
      : issuePriority[rightIssue.kind] > issuePriority[leftIssue.kind]
        ? rightIssue
        : leftIssue

  return {
    credentialId: left.credentialId || right.credentialId,
    fetched: left.fetched + right.fetched,
    imported: left.imported + right.imported,
    skipped: left.skipped + right.skipped,
    endpoints: [...left.endpoints, ...right.endpoints],
    connectionIssue,
  }
}

export async function importSyncfyTransactionsFromJobStatuses(
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
    const requestPath = addSyncfyUserParamToEndpoint(normalizedPath, syncfyUserId)
    const jobStatus = await syncfyRequest<unknown>(env, requestPath, { method: 'GET' })
    result = {
      ...result,
      endpoints: [...result.endpoints, requestPath],
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

async function startSyncfyCredentialPull(
  env: Env,
  email: string,
  syncfyUserId: string,
  credentialId: string
): Promise<SyncfyTransactionImportResult> {
  const pullPath = buildSyncfyCredentialPullPath(credentialId, syncfyUserId)
  await recordSyncfyCredentialPullAttempt(env, email, credentialId)
  const pullResponse = await syncfyRequest<unknown>(env, pullPath, { method: 'PUT' })
  await storeSyncfyCredentialPullState(env, email, credentialId, pullResponse)

  let result: SyncfyTransactionImportResult = {
    credentialId,
    fetched: 0,
    imported: 0,
    skipped: 0,
    endpoints: [pullPath],
  }

  const transactionEndpoints = getSyncfyWebhookEndpointPaths(pullResponse, 'transactions')
  if (transactionEndpoints.length > 0) {
    result = mergeSyncfyTransactionImportResults(result, await importSyncfyTransactionsFromEndpoints(
      env,
      email,
      syncfyUserId,
      credentialId,
      transactionEndpoints
    ))
  }

  const jobStatusPaths = getSyncfyJobStatusPaths(pullResponse)
  if (jobStatusPaths.length > 0 && !isSyncfyTransactionImportComplete(result)) {
    result = mergeSyncfyTransactionImportResults(result, await importSyncfyTransactionsFromJobStatuses(
      env,
      email,
      syncfyUserId,
      credentialId,
      jobStatusPaths
    ))
  }

  return result
}

export async function importSyncfyTransactionsForCredential(
  env: Env,
  email: string,
  syncfyUserId: string,
  credentialId: string,
  options: { jobStatusPaths?: string[]; startPull?: boolean } = {}
): Promise<SyncfyTransactionImportResult> {
  let result: SyncfyTransactionImportResult | null = null

  if (options.jobStatusPaths?.length) {
    result = await importSyncfyTransactionsFromJobStatuses(
      env,
      email,
      syncfyUserId,
      credentialId,
      options.jobStatusPaths
    )

    if (isSyncfyTransactionImportComplete(result)) {
      return result
    }
  }

  if (options.startPull !== false) {
    const pullPath = buildSyncfyCredentialPullPath(credentialId, syncfyUserId)
    try {
      const pullResult = await startSyncfyCredentialPull(env, email, syncfyUserId, credentialId)
      result = result ? mergeSyncfyTransactionImportResults(result, pullResult) : pullResult

      if (isSyncfyTransactionImportComplete(result)) {
        return result
      }
    } catch (err) {
      if (!(err instanceof SyncfyRequestError)) throw err

      await storeSyncfyError(env, {
        email,
        syncfyUserId,
        syncfyCredentialId: credentialId,
        rid: err.rid,
        statusCode: err.status,
        errorCode: err.code,
        message: err.message,
        source: 'syncfy-pull',
        payload: err.responseBody,
      })

      const failedPullResult: SyncfyTransactionImportResult = {
        credentialId,
        fetched: 0,
        imported: 0,
        skipped: 0,
        endpoints: [pullPath],
        connectionIssue: classifySyncfyConnectionIssue({
          rid: err.rid,
          status_code: err.status,
          message: err.message,
          source: 'syncfy-pull',
          created_at: new Date().toISOString(),
        }),
      }
      result = result ? mergeSyncfyTransactionImportResults(result, failedPullResult) : failedPullResult
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

  return result ? mergeSyncfyTransactionImportResults(result, directResult) : directResult
}

export async function markSyncfyCredentialSyncSuccess(
  env: Env,
  email: string,
  credentialId: string
): Promise<void> {
  await env.DB.prepare(
    `UPDATE syncfy_credentials
     SET last_pull_at = datetime("now"),
         last_successful_sync_at = datetime("now"),
         status = 'synced',
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
     SET last_pull_at = datetime("now"),
         status = 'pending_transactions',
         updated_at = datetime("now")
     WHERE email = ? AND syncfy_credential_id = ?`
  )
    .bind(email, credentialId)
    .run()
}

export async function markSyncfyCredentialSyncError(
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

export async function markSyncfyCredentialFromImportResult(
  env: Env,
  email: string,
  credentialId: string,
  result: SyncfyTransactionImportResult,
  state: { complete: boolean }
): Promise<void> {
  if (state.complete) {
    await markSyncfyCredentialSyncSuccess(env, email, credentialId)
    return
  }

  if (result.connectionIssue?.kind === 'action_required') {
    await markSyncfyCredentialSyncError(env, email, credentialId, 'needs_reconnect')
    return
  }

  if (
    result.connectionIssue?.kind === 'provider_unavailable'
  ) {
    await markSyncfyCredentialSyncError(env, email, credentialId, 'provider_unavailable')
    return
  }

  if (result.connectionIssue?.kind === 'unknown') {
    await markSyncfyCredentialSyncError(env, email, credentialId, 'sync_error')
    return
  }

  await markSyncfyCredentialSyncPending(env, email, credentialId)
}
