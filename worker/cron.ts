import type {
  Env,
} from './lib/shared'
import {
  storeSyncfyError,
} from './lib/db'
import {
  SyncfyRequestError,
  classifySyncfyCredentialBlocker,
  fetchSyncfyCredentialHealth,
} from './lib/syncfy'
import {
  getSyncfyCredentialJobStatusPaths,
  importSyncfyTransactionsForCredential,
  isSyncfyProviderPullRetryDue,
  loadDueSyncfyCredentials,
  markSyncfyCredentialFromImportResult,
  markSyncfyCredentialSyncError,
  resolveSyncfyTransactionImportState,
} from './lib/ingest'

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
      const health = await fetchSyncfyCredentialHealth(
        env,
        credential.syncfy_user_id,
        credential.syncfy_credential_id
      )
      const blocker = classifySyncfyCredentialBlocker(health)

      if (blocker === 'needs_reconnect') {
        failed += 1
        await storeSyncfyError(env, {
          email: credential.email,
          syncfyUserId: credential.syncfy_user_id,
          syncfyCredentialId: credential.syncfy_credential_id,
          statusCode: health?.code ?? null,
          message: health?.isTwofa
            ? 'Syncfy credential requires user 2FA; waiting for reconnect.'
            : 'Syncfy credential login rejected by institution; waiting for reconnect.',
          source: 'syncfy-credential-state',
        })
        await markSyncfyCredentialSyncError(
          env,
          credential.email,
          credential.syncfy_credential_id,
          'needs_reconnect'
        )
        continue
      }

      const result = await importSyncfyTransactionsForCredential(
        env,
        credential.email,
        credential.syncfy_user_id,
        credential.syncfy_credential_id,
        {
          jobStatusPaths: getSyncfyCredentialJobStatusPaths(credential),
          // Provider-side scrape failures (5xx) only recover through a new pull, but
          // retrying every cron cycle just hits Syncfy throttles. Back off to one
          // pull attempt per SYNCFY_PROVIDER_RETRY_INTERVAL_SECONDS.
          startPull: blocker !== 'provider_pending'
            || isSyncfyProviderPullRetryDue(credential.last_pull_attempt_at),
        }
      )
      imported += result.imported
      const importState = await resolveSyncfyTransactionImportState(
        env,
        credential.email,
        credential.syncfy_credential_id,
        result
      )
      await markSyncfyCredentialFromImportResult(
        env,
        credential.email,
        credential.syncfy_credential_id,
        result,
        importState
      )
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

export async function runScheduled(env: Env): Promise<void> {
  const result = await refreshDueSyncfyCredentials(env)
  console.log('Scheduled connection refresh complete', result)
}
