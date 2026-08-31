import type {
  Env,
} from './lib/shared'
import {
  loadDueSyncfyCredentials,
  refreshSyncfyCredential,
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
    const result = await refreshSyncfyCredential(env, credential)
    imported += result.imported
    if (result.failed) failed += 1
  }

  return { checked: dueCredentials.length, imported, failed }
}

export async function runScheduled(env: Env): Promise<void> {
  const result = await refreshDueSyncfyCredentials(env)
  console.log('Scheduled connection refresh complete', result)
}
