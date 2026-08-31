import type { SyncfyCredential } from '@finovai/core'

export function syncfyCredentialNeedsReconnect(credential: SyncfyCredential) {
  return credential.connectionState === 'action_required' ||
    credential.connectionState === 'abandoned' ||
    credential.needsReconnect === true ||
    credential.status === 'needs_reconnect'
}

export function syncfyCredentialIsConnected(credential: SyncfyCredential) {
  return credential.connectionState === 'ready' || credential.status === 'synced'
}

export function syncfyCredentialHasProviderIssue(credential: SyncfyCredential) {
  return credential.connectionState === 'provider_unavailable' ||
    credential.connectionState === 'broken' ||
    credential.status === 'provider_unavailable'
}

export function syncfyCredentialNeedsSupport(credential: SyncfyCredential) {
  if (syncfyCredentialNeedsReconnect(credential)) return false
  return credential.connectionState === 'support_required' ||
    credential.status === 'sync_error'
}
