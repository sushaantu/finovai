import type {
  Env,
} from './lib/shared'
import {
  loadDueSyncfyCredentials,
  refreshSyncfyCredential,
} from './lib/ingest'
import { sendOpsAlertEmail } from './lib/email'

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
    const result = await refreshSyncfyCredential(env, credential)
    imported += result.imported
    if (result.failed) failed += 1
  }

  return { checked: dueCredentials.length, imported, failed }
}

export interface HealthMetrics {
  transactionsLast24h: number
  credentialsNoSuccess48h: number
  enteredBrokenLast24h: number
  unmappedVendorCodesLast24h: number
}

export async function collectHealthMetrics(db: D1Database): Promise<HealthMetrics> {
  const txns = await db.prepare(
    `SELECT COUNT(*) n FROM transactions WHERE source = 'syncfy' AND created_at >= datetime('now', '-1 day')`
  ).first<{ n: number }>()
  const noSuccess = await db.prepare(
    `SELECT COUNT(*) n FROM syncfy_credentials
     WHERE deleted_at IS NULL AND state NOT IN ('abandoned', 'needs_user')
       AND (last_successful_sync_at IS NULL OR last_successful_sync_at < datetime('now', '-2 days'))
       AND created_at < datetime('now', '-2 days')`
  ).first<{ n: number }>()
  const broken = await db.prepare(
    `SELECT COUNT(*) n FROM syncfy_credentials WHERE state = 'broken' AND state_changed_at >= datetime('now', '-1 day')`
  ).first<{ n: number }>()
  const unmapped = await db.prepare(
    `SELECT COUNT(*) n FROM syncfy_errors
     WHERE created_at >= datetime('now', '-1 day')
       AND status_code NOT IN (400, 401, 403, 429, 500, 502, 503, 504)`
  ).first<{ n: number }>()
  return {
    transactionsLast24h: txns?.n ?? 0,
    credentialsNoSuccess48h: noSuccess?.n ?? 0,
    enteredBrokenLast24h: broken?.n ?? 0,
    unmappedVendorCodesLast24h: unmapped?.n ?? 0,
  }
}

function countHealthIssues(metrics: HealthMetrics): number {
  let issues = 0
  if (metrics.transactionsLast24h === 0) issues += 1
  if (metrics.credentialsNoSuccess48h > 0) issues += 1
  if (metrics.enteredBrokenLast24h > 0) issues += 1
  if (metrics.unmappedVendorCodesLast24h > 0) issues += 1
  return issues
}

function healthMetricLines(metrics: HealthMetrics): string[] {
  return [
    `transactionsLast24h: ${metrics.transactionsLast24h}`,
    `credentialsNoSuccess48h: ${metrics.credentialsNoSuccess48h}`,
    `enteredBrokenLast24h: ${metrics.enteredBrokenLast24h}`,
    `unmappedVendorCodesLast24h: ${metrics.unmappedVendorCodesLast24h}`,
  ]
}

function currentUtcHour(env: Env): number {
  return env.__testUtcHour ?? new Date().getUTCHours()
}

async function runDailyHealthTick(env: Env): Promise<void> {
  if (currentUtcHour(env) !== 12) return

  const metrics = await collectHealthMetrics(env.DB)
  const issues = countHealthIssues(metrics)
  if (issues === 0) return

  await sendOpsAlertEmail(
    env,
    `FinovAI health: ${issues} issue(s)`,
    healthMetricLines(metrics)
  )
}

export const SYNCFY_HOURLY_EVENT_ALERT_THRESHOLD = 6

interface RunawaySyncfyCredentialRow {
  syncfy_credential_id: string
  site_name: string | null
  email: string | null
  state: string | null
  event_count: number
}

export async function checkSyncfyRunawayLoop(env: Env): Promise<void> {
  const runaway = await env.DB.prepare(
    `SELECT
       w.syncfy_credential_id,
       c.site_name,
       c.email,
       c.state,
       COUNT(*) AS event_count
     FROM syncfy_webhook_events w
     LEFT JOIN syncfy_credentials c
       ON w.syncfy_credential_id = c.syncfy_credential_id
     WHERE w.created_at >= datetime('now', '-1 hour')
       AND w.syncfy_credential_id IS NOT NULL
     GROUP BY w.syncfy_credential_id
     HAVING COUNT(*) > ?`
  )
    .bind(SYNCFY_HOURLY_EVENT_ALERT_THRESHOLD)
    .all<RunawaySyncfyCredentialRow>()

  if (!runaway.results || runaway.results.length === 0) return

  const lines = runaway.results.map((row) =>
    `credential: ${row.syncfy_credential_id}, site: ${row.site_name ?? 'unknown'}, email: ${row.email ?? 'unknown'}, eventsLastHour: ${row.event_count}, state: ${row.state ?? 'unknown'}`
  )

  await sendOpsAlertEmail(
    env,
    '[FinovAI] Posible loop de sincronización Syncfy',
    lines
  )
}

export async function runScheduled(env: Env): Promise<void> {
  const result = await refreshDueSyncfyCredentials(env)
  console.log('Scheduled connection refresh complete', result)
  await runDailyHealthTick(env)
  await checkSyncfyRunawayLoop(env)
}
