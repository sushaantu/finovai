import {
  asRecord,
  error,
  extractSyncfyCode,
  extractSyncfyNumericStatus,
  extractSyncfyRid,
  getAppOrigin,
  isProductionEnv,
  isSyncfyDeleteEvent,
  isSyncfyRefreshEvent,
  isSyncfySandboxEnv,
  json,
  normalizeSignupEmail,
  parseJsonUnknown,
  stringFromUnknown,
  timingSafeStringEqual,
  upsertLead,
  verifyDashboardEmailAccess,
  verifyDashboardEmailAccessOrSupportAdmin,
  verifySupportAdminAccess,
} from '../lib/shared'
import type {
  Env,
  SyncfyCredentialRow,
  SyncfyCredentialsResponse,
  SyncfyErrorRow,
  SyncfyTransactionImportResult,
  SyncfyUserRow,
  SyncfyWebhookEventRow,
} from '../lib/shared'
import {
  ensureSyncfyTables,
  getOrCreateUserByEmail,
  storeSyncfyError,
} from '../lib/db'
import {
  DEFAULT_SYNCFY_BASE_URL,
  SyncfyRequestError,
  addSyncfyUserParamToEndpoint,
  buildSyncfyAuthHeaderValue,
  buildSyncfyTransactionsPath,
  buildSyncfyUserMessage,
  classifySyncfyCredentialBlocker,
  createSyncfyWidgetSession,
  deleteLocalSyncfyStateForEmail,
  deleteSyncfyCredentialForEmail,
  deleteSyncfyCredentialFromWebhook,
  fetchSyncfyCredentialHealth,
  findEmailBySyncfyUserId,
  getOrCreateSyncfyUser,
  getSyncfyCredentialBlockerMessage,
  getSyncfyCredentialCooldownSeconds,
  getSyncfyTransactionLookbackMonths,
  isSyncfyInvalidUserError,
  loadDisplaySyncfyCredentialsForEmail,
  loadSyncfyCredentialsForEmail,
  markSyncfyWebhookEventProcessed,
  normalizeSyncfyRequestPath,
  recreateSyncfyUser,
  resetSyncfyConnectionForEmail,
  storeSyncfyCredential,
  storeSyncfyWebhookEvent,
  syncfyCredentialToApi,
} from '../lib/syncfy'
import {
  countStoredSyncfyTransactionsForCredential,
  getSyncfyCredentialJobStatusPaths,
  getSyncfyJobStatusPaths,
  getSyncfyTransactionImportMessageForState,
  getSyncfyWebhookEndpointPaths,
  applyConnectionEvent,
  applyPollOutcome,
  connectionEventFromPoll,
  importSyncfyTransactionsForCredential,
  importSyncfyTransactionsFromEndpoints,
  importSyncfyTransactionsFromJobStatuses,
  isSyncfyTransactionImportComplete,
  mergeSyncfyTransactionImportResults,
  refreshSyncfyCredential,
  resolveSyncfyTransactionImportState,
  storeSyncfyCredentialStateError,
} from '../lib/ingest'
import {
  classifyVendorFailure,
} from '../lib/lifecycle'
import {
  getFinanceDashboard,
} from '../routes/finance'

const SYNCFY_WIDGET_CONFIG = {
  locale: 'es',
  entrypoint: {
    country: 'MX',
  },
  navigation: {
    displayErrorsInToast: false,
    displayPrivacyScreen: true,
    displayStatusInToast: false,
    hideSelectCountry: true,
    socketTimeout: 600_000,
    toastDuration: 7000,
  },
}

function summarizeSyncfyProbeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const sample = asRecord(value[0])
    return {
      type: 'array',
      length: value.length,
      sampleKeys: sample ? Object.keys(sample).slice(0, 20) : [],
    }
  }

  const record = asRecord(value)
  if (!record) return { type: value === null ? 'null' : typeof value }

  const endpoints = asRecord(record.endpoints)
  const summary: Record<string, unknown> = {
    type: 'object',
    keys: Object.keys(record).slice(0, 30),
  }

  if (endpoints) {
    summary.endpointGroups = Object.fromEntries(
      Object.entries(endpoints).map(([key, item]) => [key, Array.isArray(item) ? item.length : 1])
    )
  }

  for (const key of ['transactions', 'items', 'results', 'data']) {
    const nested = record[key]
    if (Array.isArray(nested)) summary[`${key}Count`] = nested.length
  }

  const responseValue = record.response
  if (responseValue !== undefined) {
    summary.response = summarizeSyncfyProbeValue(responseValue)
  }

  for (const key of ['is_executing', 'code', 'status', 'message']) {
    if (key in record) summary[key] = record[key]
  }

  return summary
}

async function probeSyncfyPath(
  env: Env,
  target: string,
  path: string
): Promise<Record<string, unknown>> {
  if (!env.SYNCFY_API_KEY) {
    return { target, configured: false, ok: false, message: 'SYNCFY_API_KEY is not configured' }
  }

  const baseUrl = (env.SYNCFY_API_BASE_URL || DEFAULT_SYNCFY_BASE_URL).replace(/\/+$/, '')
  const requestPath = normalizeSyncfyRequestPath(path)
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set(env.SYNCFY_AUTH_HEADER_NAME || 'Authorization', buildSyncfyAuthHeaderValue(env))

  try {
    const response = await fetch(`${baseUrl}${requestPath}`, { method: 'GET', headers })
    const text = await response.text()
    const payload = parseJsonUnknown(text)
    const record = asRecord(payload)
    const syncfyStatus = record && 'status' in record ? Boolean(record.status) : response.ok
    const wrappedResponse = record && 'response' in record ? record.response : payload

    return {
      target,
      configured: true,
      ok: response.ok && syncfyStatus,
      httpStatus: response.status,
      rid: extractSyncfyRid(payload),
      code: extractSyncfyCode(payload),
      syncfyStatus,
      message: stringFromUnknown(record?.message, 500),
      response: summarizeSyncfyProbeValue(wrappedResponse),
    }
  } catch (err) {
    return {
      target,
      configured: true,
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

async function buildSyncfyStatusProbes(
  env: Env,
  syncfyUser: SyncfyUserRow | null,
  credentials: SyncfyCredentialRow[]
): Promise<Record<string, unknown>[]> {
  if (!syncfyUser) return []

  const credential = credentials[0] || null
  if (!credential) return []

  const probes: Promise<Record<string, unknown>>[] = [
    probeSyncfyPath(
      env,
      'credential',
      `/credentials/${encodeURIComponent(credential.syncfy_credential_id)}?id_user=${encodeURIComponent(syncfyUser.syncfy_user_id)}`
    ),
  ]

  for (const jobStatusPath of getSyncfyCredentialJobStatusPaths(credential).slice(0, 3)) {
    probes.push(probeSyncfyPath(
      env,
      'job_status',
      addSyncfyUserParamToEndpoint(jobStatusPath, syncfyUser.syncfy_user_id)
    ))
  }

  probes.push(probeSyncfyPath(
    env,
    'transactions',
    buildSyncfyTransactionsPath(credential.syncfy_credential_id, syncfyUser.syncfy_user_id, 0, {
      lookbackMonths: getSyncfyTransactionLookbackMonths(env),
    })
  ))

  return Promise.all(probes)
}

function getSyncfySecretFromRequest(request: Request): string | null {
  const headerSecret = request.headers.get('x-finovai-webhook-secret') || request.headers.get('x-syncfy-webhook-secret')
  if (headerSecret) return headerSecret

  const auth = request.headers.get('authorization')
  const match = auth?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

async function verifySyncfySecret(request: Request, env: Env): Promise<boolean> {
  if (!env.SYNCFY_WEBHOOK_SECRET) return false

  const suppliedSecret = getSyncfySecretFromRequest(request)
  if (!suppliedSecret) return false

  return timingSafeStringEqual(suppliedSecret, env.SYNCFY_WEBHOOK_SECRET)
}

async function verifySyncfyDiagnosticAccess(request: Request, env: Env): Promise<boolean> {
  if (await verifySyncfySecret(request, env)) return true
  return verifySupportAdminAccess(request, env)
}

async function processSyncfyWebhookEvent(
  env: Env,
  payload: unknown,
  event: SyncfyWebhookEventRow,
  credential: SyncfyCredentialRow | null
): Promise<void> {
  let webhookEmail: string | null = null
  const webhookCredentialId = event.syncfy_credential_id || credential?.syncfy_credential_id || null

  try {
    if (isSyncfyDeleteEvent(event.event_type)) {
      await deleteSyncfyCredentialFromWebhook(env, event)
      await markSyncfyWebhookEventProcessed(env, event.id)
      return
    }

    webhookEmail = event.syncfy_user_id ? await findEmailBySyncfyUserId(env, event.syncfy_user_id) : credential?.email || null
    const known = credential || (
      webhookEmail && webhookCredentialId
        ? await env.DB.prepare(
          `SELECT * FROM syncfy_credentials
           WHERE email = ? AND syncfy_credential_id = ? AND deleted_at IS NULL`
        ).bind(webhookEmail, webhookCredentialId).first<SyncfyCredentialRow>()
        : null
    )
    if (known) {
      await refreshSyncfyCredential(env, known)
    }

    await markSyncfyWebhookEventProcessed(env, event.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (err instanceof SyncfyRequestError) {
      await storeSyncfyError(env, {
        email: webhookEmail,
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
      await storeSyncfyError(env, {
        email: webhookEmail,
        syncfyUserId: event.syncfy_user_id,
        syncfyCredentialId: event.syncfy_credential_id,
        rid: event.rid,
        message,
        source: 'syncfy-webhook-background',
        payload,
      })
    }

    console.error('Syncfy webhook background processing failed', {
      eventId: event.id,
      eventType: event.event_type,
      message,
    })
  }
}

export async function handleSyncfyRoutes(request: Request, env: Env, url: URL, ctx?: ExecutionContext): Promise<Response | null> {
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
           WHERE (email = ? OR syncfy_user_id = ?) AND deleted_at IS NULL
           ORDER BY COALESCE(updated_at, created_at) DESC
           LIMIT ?`
        )
          .bind(normalizedEmail, syncfyUserId, limit)
          .all()
        : await env.DB.prepare(
          `SELECT email, syncfy_user_id, syncfy_credential_id, syncfy_site_id, site_name, status,
             last_successful_sync_at, last_pull_at, last_rid, created_at, updated_at
           FROM syncfy_credentials
           WHERE deleted_at IS NULL
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

      await getOrCreateUserByEmail(env.DB, normalizedEmail)
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

          await deleteLocalSyncfyStateForEmail(env, normalizedEmail)
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
        widgetEnableTestMode: isSyncfySandboxEnv(env),
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

      const credentials = await loadDisplaySyncfyCredentialsForEmail(env, normalizedEmail)
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
      const access = await verifyDashboardEmailAccessOrSupportAdmin(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      const reset = await resetSyncfyConnectionForEmail(env, normalizedEmail, name)
      const credentials = await loadDisplaySyncfyCredentialsForEmail(env, normalizedEmail)

      return json({
        success: true,
        email: normalizedEmail,
        syncfyUserId: reset.syncfyUser?.syncfy_user_id || null,
        recreated: reset.recreated,
        deletedTransactions: reset.deletedTransactions,
        deletedCredentials: reset.deletedCredentials,
        credentials: credentials.map(syncfyCredentialToApi),
        message: reset.recreated
          ? 'Conexión anterior limpiada. Puedes elegir institución de nuevo.'
          : 'Conexión local limpiada. Puedes intentar elegir institución de nuevo.',
      })
    }

    if (url.pathname === '/api/syncfy/credential' && request.method === 'DELETE') {
      const body = (await request.json()) as {
        email?: string
        credentialId?: string
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      const credentialId = typeof body.credentialId === 'string' ? body.credentialId.trim() : ''
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      if (!credentialId) {
        return error('Credencial inválida')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      let deletion: Awaited<ReturnType<typeof deleteSyncfyCredentialForEmail>>
      try {
        deletion = await deleteSyncfyCredentialForEmail(env, normalizedEmail, credentialId)
      } catch (err) {
        if (err instanceof SyncfyRequestError) {
          return json({
            success: false,
            email: normalizedEmail,
            credentialId,
            error: buildSyncfyUserMessage(err),
            rid: err.rid,
            localStateDeleted: false,
            message: 'No pudimos confirmar la eliminación en Syncfy. La conexión local no fue eliminada; intenta de nuevo.',
          }, err.status >= 500 ? 502 : 409)
        }

        throw err
      }

      if (!deletion.credential) {
        return error('No encontramos esa institución conectada.', 404)
      }

      const dashboard = await getFinanceDashboard(env, normalizedEmail)
      return json({
        ...dashboard,
        success: true,
        email: normalizedEmail,
        credentialId,
        credentials: deletion.credentials.map(syncfyCredentialToApi),
        deletedTransactions: deletion.deletedTransactions,
        syncfyCredentialDeleteAttempted: deletion.syncfyCredentialDeleteAttempted,
        syncfyCredentialDeleted: deletion.syncfyCredentialDeleted,
        message: 'Institución eliminada.',
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
      const credential = await storeSyncfyCredential(env, payload, eventType, normalizedEmail, { undelete: true })
      if (!credential) {
        const rid = extractSyncfyRid(payload)
        const isWidgetError = eventType.toLowerCase().includes('error')
        await storeSyncfyError(env, {
          email: normalizedEmail,
          rid,
          statusCode: extractSyncfyNumericStatus(payload),
          errorCode: extractSyncfyCode(payload),
          message: isWidgetError
            ? 'Syncfy widget reported an error before returning a credential.'
            : 'Syncfy widget callback did not include a credential.',
          source: isWidgetError ? 'syncfy-widget-error' : 'syncfy-widget-no-credential',
          payload,
        })
        const credentials = await loadDisplaySyncfyCredentialsForEmail(env, normalizedEmail)
        const message = rid
          ? `Syncfy no creó una credencial para esta conexión. RID: ${rid}`
          : 'Syncfy no creó una credencial para esta conexión.'
        return json({
          success: false,
          email: normalizedEmail,
          rid,
          error: message,
          message,
          credentials: credentials.map(syncfyCredentialToApi),
        }, isWidgetError ? 409 : 422)
      }

      await applyConnectionEvent(env, {
        email: normalizedEmail,
        syncfy_credential_id: credential.syncfy_credential_id,
      }, { type: 'user_reconnected' })

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

      if (!importResult || !isSyncfyTransactionImportComplete(importResult)) {
        try {
          const pullImportResult = await importSyncfyTransactionsForCredential(
            env,
            normalizedEmail,
            credential.syncfy_user_id,
            credential.syncfy_credential_id,
            {
              jobStatusPaths: importResult ? [] : jobStatusPaths,
              // The widget has already started this provider job. Starting another
              // pull while it is executing creates false 429/400 failures.
              startPull: jobStatusPaths.length === 0,
            }
          )
          importResult = importResult
            ? mergeSyncfyTransactionImportResults(importResult, pullImportResult)
            : pullImportResult
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
              source: 'syncfy-widget-pull',
              payload: err.responseBody,
            })
          } else {
            throw err
          }
        }
      }

      if (importResult) {
        const importState = await resolveSyncfyTransactionImportState(
          env,
          normalizedEmail,
          credential.syncfy_credential_id,
          importResult
        )
        if (importState.complete) {
          await applyConnectionEvent(env, {
            email: normalizedEmail,
            syncfy_credential_id: credential.syncfy_credential_id,
          }, { type: 'sync_succeeded' })
        } else if (importResult.vendorStatus != null || importResult.vendorMessage) {
          await applyPollOutcome(
            env,
            {
              email: normalizedEmail,
              syncfy_user_id: credential.syncfy_user_id,
              syncfy_credential_id: credential.syncfy_credential_id,
            },
            classifyVendorFailure(importResult.vendorStatus ?? null, importResult.vendorMessage ?? null),
            { result: importResult }
          )
        }
      }

      const credentials = await loadDisplaySyncfyCredentialsForEmail(env, normalizedEmail)
      const displayCredential = credentials.find((item) => item.syncfy_credential_id === credential.syncfy_credential_id) || credential
      const dashboard = importResult ? await getFinanceDashboard(env, normalizedEmail) : null
      const importState = importResult
        ? await resolveSyncfyTransactionImportState(env, normalizedEmail, credential.syncfy_credential_id, importResult)
        : null
      return json({
        ...(dashboard || {}),
        success: true,
        email: normalizedEmail,
        credential: syncfyCredentialToApi(displayCredential),
        credentials: credentials.map(syncfyCredentialToApi),
        syncfy: importResult,
        pendingTransactions: importState ? !importState.complete : true,
        message: importResult
          ? getSyncfyTransactionImportMessageForState(importResult, importState!)
          : 'Institución guardada. Ya puedes sincronizar transacciones.',
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
      const access = await verifyDashboardEmailAccessOrSupportAdmin(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      const credentials = await loadSyncfyCredentialsForEmail(env, normalizedEmail)
      const credential = body.credentialId
        ? credentials.find((item) => item.syncfy_credential_id === body.credentialId)
        : credentials[0]

      if (!credential) {
        return error('Ve a Conectar cuenta y sigue los pasos primero.', 404)
      }

      const storedTransactions = await countStoredSyncfyTransactionsForCredential(
        env,
        normalizedEmail,
        credential.syncfy_credential_id
      )
      if (storedTransactions > 0) {
        await applyConnectionEvent(env, {
          email: normalizedEmail,
          syncfy_credential_id: credential.syncfy_credential_id,
        }, { type: 'sync_succeeded' })
        const dashboard = await getFinanceDashboard(env, normalizedEmail)

        return json({
          ...dashboard,
          source: 'syncfy',
          syncfy: {
            credentialId: credential.syncfy_credential_id,
            fetched: 0,
            imported: storedTransactions,
            skipped: 0,
            endpoints: [],
          },
          pendingTransactions: false,
          message: `${storedTransactions} movimientos sincronizados.`,
        }, 200)
      }

      const cooldownSeconds = getSyncfyCredentialCooldownSeconds(credential)
      const jobStatusPaths = getSyncfyCredentialJobStatusPaths(credential)
      const canPollPendingCredential = credential.status === 'pending_transactions' ||
        (credential.state === 'pending' && credential.status !== 'synced')

      if (cooldownSeconds > 0 && !canPollPendingCredential && (credential.status === 'synced' || credential.state === 'healthy')) {
        return json({
          success: false,
          error: 'Puedes hacer una sincronización exitosa por institución cada 30 minutos.',
          retryAfterSeconds: cooldownSeconds,
          credential: syncfyCredentialToApi(credential),
        }, 429)
      }

      const health = await fetchSyncfyCredentialHealth(
        env,
        credential.syncfy_user_id,
        credential.syncfy_credential_id
      )
      const blocker = classifySyncfyCredentialBlocker(health)

      if (blocker === 'needs_reconnect') {
        await storeSyncfyCredentialStateError(env, credential, { health })
        await applyConnectionEvent(env, {
          email: normalizedEmail,
          syncfy_credential_id: credential.syncfy_credential_id,
        }, { type: 'auth_required' })
        const updatedCredentials = await loadSyncfyCredentialsForEmail(env, normalizedEmail)
        const updatedCredential = updatedCredentials.find(
          (item) => item.syncfy_credential_id === credential.syncfy_credential_id
        ) || credential

        return json({
          success: false,
          error: getSyncfyCredentialBlockerMessage('needs_reconnect', health),
          credential: syncfyCredentialToApi(updatedCredential),
          needsReconnect: true,
        }, 409)
      }

      const pendingMessage = blocker === 'provider_pending'
        ? getSyncfyCredentialBlockerMessage('provider_pending', health)
        : 'Movimientos todavía no disponibles. FinovAI seguirá verificando.'

      if (ctx && cooldownSeconds > 0 && canPollPendingCredential) {
        ctx.waitUntil((async () => {
          try {
            const importResult = await importSyncfyTransactionsForCredential(
              env,
              normalizedEmail,
              credential.syncfy_user_id,
              credential.syncfy_credential_id,
              {
                jobStatusPaths,
                startPull: false,
              }
            )
            const importState = await resolveSyncfyTransactionImportState(
              env,
              normalizedEmail,
              credential.syncfy_credential_id,
              importResult
            )

            await applyPollOutcome(
              env,
              {
                email: normalizedEmail,
                syncfy_user_id: credential.syncfy_user_id,
                syncfy_credential_id: credential.syncfy_credential_id,
              },
              connectionEventFromPoll(importResult, importState, blocker, credential.state),
              { result: importResult }
            )
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            if (err instanceof SyncfyRequestError) {
              await storeSyncfyError(env, {
                email: normalizedEmail,
                syncfyUserId: credential.syncfy_user_id,
                syncfyCredentialId: credential.syncfy_credential_id,
                rid: err.rid,
                statusCode: err.status,
                errorCode: err.code,
                message: err.message,
                source: 'syncfy-refresh-background',
                payload: err.responseBody,
              })
              await applyPollOutcome(
                env,
                {
                  email: normalizedEmail,
                  syncfy_user_id: credential.syncfy_user_id,
                  syncfy_credential_id: credential.syncfy_credential_id,
                },
                classifyVendorFailure(err.status, err.message),
                { result: { vendorStatus: err.status, vendorMessage: err.message } }
              )
            } else {
              await storeSyncfyError(env, {
                email: normalizedEmail,
                syncfyUserId: credential.syncfy_user_id,
                syncfyCredentialId: credential.syncfy_credential_id,
                message,
                source: 'syncfy-refresh-background',
              })
              await applyConnectionEvent(
                env,
                { email: normalizedEmail, syncfy_credential_id: credential.syncfy_credential_id },
                { type: 'sync_failed', statusCode: null, vendorCode: null }
              )
            }
            console.error('Syncfy refresh background import failed', {
              email: normalizedEmail,
              credentialId: credential.syncfy_credential_id,
              message,
            })
          }
        })())

        const dashboard = await getFinanceDashboard(env, normalizedEmail)
        return json({
          ...dashboard,
          source: 'syncfy',
          syncfy: null,
          pendingTransactions: true,
          retryAfterSeconds: cooldownSeconds,
          credential: syncfyCredentialToApi(credential),
          message: pendingMessage,
        }, 202)
      }

      if (cooldownSeconds > 0 && !canPollPendingCredential) {
        return json({
          success: false,
          error: 'Puedes hacer una sincronización exitosa por institución cada 30 minutos.',
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
          {
            jobStatusPaths,
            // Manual refreshes may retry provider pulls (rate-limited by the 30-minute
            // cooldown); only skip starting a new pull while still cooling down.
            startPull: cooldownSeconds > 0 ? false : true,
          }
        )
        const importState = await resolveSyncfyTransactionImportState(
          env,
          normalizedEmail,
          credential.syncfy_credential_id,
          importResult
        )
        const importComplete = importState.complete
        await applyPollOutcome(
          env,
          {
            email: normalizedEmail,
            syncfy_user_id: credential.syncfy_user_id,
            syncfy_credential_id: credential.syncfy_credential_id,
          },
          connectionEventFromPoll(importResult, importState, blocker, credential.state),
          { result: importResult }
        )
        const dashboard = await getFinanceDashboard(env, normalizedEmail)

        return json({
          ...dashboard,
          source: 'syncfy',
          syncfy: importResult,
          pendingTransactions: !importComplete,
          message: !importComplete && blocker === 'provider_pending'
            ? pendingMessage
            : getSyncfyTransactionImportMessageForState(importResult, importState),
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
          await applyPollOutcome(
            env,
            {
              email: normalizedEmail,
              syncfy_user_id: credential.syncfy_user_id,
              syncfy_credential_id: credential.syncfy_credential_id,
            },
            classifyVendorFailure(err.status, err.message),
            { result: { vendorStatus: err.status, vendorMessage: err.message } }
          )

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
        return error('Secreto de webhook inválido', 401)
      }

      const payload = await request.json() as unknown
      const event = await storeSyncfyWebhookEvent(env, payload)
      const credential = isSyncfyDeleteEvent(event.event_type)
        ? null
        : await storeSyncfyCredential(env, payload, event.event_type)
      const processing = processSyncfyWebhookEvent(env, payload, event, credential)
      if (ctx) {
        ctx.waitUntil(processing)
      } else {
        processing.catch((err) => {
          console.error('Syncfy webhook processing failed outside Cloudflare context', err)
        })
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
        processingQueued: true,
      }, 202)
    }

    if (url.pathname === '/api/syncfy/status' && request.method === 'GET') {
      if (env.ENVIRONMENT === 'production' && !(await verifySyncfyDiagnosticAccess(request, env))) {
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
        `SELECT * FROM syncfy_credentials WHERE email = ? AND deleted_at IS NULL ORDER BY updated_at DESC, created_at DESC LIMIT 20`
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
      const probes = url.searchParams.get('probe') === '1'
        ? await buildSyncfyStatusProbes(env, syncfyUser, credentials.results)
        : undefined

      return json({
        success: true,
        email: normalizedEmail,
        syncfyUser,
        credentials: credentials.results,
        recentErrors: errors.results,
        recentWebhooks: webhooks.results,
        probes,
      })
    }

  return null
}
