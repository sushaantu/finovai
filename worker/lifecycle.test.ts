// worker/lifecycle.test.ts
import { test, expect } from 'bun:test'
import { transition, classifyVendorFailure, type ConnectionSnapshot } from './lib/lifecycle'
import { resolveLifecycleState } from './lib/syncfy'
import type { SyncfyCredentialRow } from './lib/shared'

const at = (iso: string) => new Date(iso)
const snap = (over: Partial<ConnectionSnapshot>): ConnectionSnapshot => ({
  state: 'pending', attemptCount: 0, firstFailedAt: null,
  lastSuccessfulSyncAt: null, createdAt: '2026-08-01T00:00:00Z', ...over,
})

test('success from any state resets to healthy', () => {
  for (const state of ['pending', 'degraded', 'broken', 'needs_user', 'abandoned'] as const) {
    const r = transition(snap({ state, attemptCount: 9, firstFailedAt: '2026-08-01T00:00:00Z' }),
      { type: 'sync_succeeded' }, at('2026-08-20T00:00:00Z'))
    expect(r.state).toBe('healthy')
    expect(r.attemptCount).toBe(0)
    expect(r.firstFailedAt).toBeNull()
  }
})

test('never-succeeded failure under 48h stays pending', () => {
  const r = transition(snap({}), { type: 'sync_failed', statusCode: 400, vendorCode: null },
    at('2026-08-02T00:00:00Z')) // 24h after createdAt
  expect(r.state).toBe('pending')
  expect(r.attemptCount).toBe(1)
})

test('never-succeeded failure past 48h becomes broken and alerts once', () => {
  const first = transition(snap({}), { type: 'sync_failed', statusCode: 400, vendorCode: null },
    at('2026-08-04T00:00:00Z')) // 72h after createdAt
  expect(first.state).toBe('broken')
  expect(first.alerts).toContain('entered_broken')
  const again = transition(snap({ state: 'broken', attemptCount: 1, firstFailedAt: '2026-08-04T00:00:00Z' }),
    { type: 'sync_failed', statusCode: 400, vendorCode: null }, at('2026-08-05T00:00:00Z'))
  expect(again.state).toBe('broken')
  expect(again.alerts).not.toContain('entered_broken') // only on entry
})

test('healthy failure degrades; degraded stays degraded', () => {
  const r = transition(snap({ state: 'healthy', lastSuccessfulSyncAt: '2026-08-10T00:00:00Z' }),
    { type: 'sync_failed', statusCode: 500, vendorCode: null }, at('2026-08-11T00:00:00Z'))
  expect(r.state).toBe('degraded')
})

test('14 days of failure with no success abandons', () => {
  const r = transition(snap({ state: 'broken', attemptCount: 14, firstFailedAt: '2026-08-01T00:00:00Z' }),
    { type: 'sync_failed', statusCode: 400, vendorCode: null }, at('2026-08-16T00:00:00Z'))
  expect(r.state).toBe('abandoned')
})

test('auth_required forces needs_user from any active state', () => {
  for (const state of ['pending', 'healthy', 'degraded', 'broken'] as const) {
    const r = transition(snap({ state }), { type: 'auth_required' }, at('2026-08-10T00:00:00Z'))
    expect(r.state).toBe('needs_user')
  }
})

test('user_reconnected restarts the attempt window', () => {
  const r = transition(snap({ state: 'abandoned', attemptCount: 30, firstFailedAt: '2026-08-01T00:00:00Z' }),
    { type: 'user_reconnected' }, at('2026-08-20T00:00:00Z'))
  expect(r.state).toBe('pending')
  expect(r.attemptCount).toBe(0)
  expect(r.firstFailedAt).toBeNull()
})

test('classifyVendorFailure: BBVA 400 is sync_failed, not auth; 401 is auth; unknown code flags alert', () => {
  expect(classifyVendorFailure(400, "Credential can't be sync at this moment").type).toBe('sync_failed')
  expect(classifyVendorFailure(401, 'login rejected').type).toBe('auth_required')
  const unknown = classifyVendorFailure(402, 'Payment Required')
  expect(unknown.type).toBe('sync_failed') // still a failure...
  // ...and the transition must surface it:
  const r = transition(snap({}), unknown, at('2026-08-02T00:00:00Z'))
  expect(r.alerts).toContain('unmapped_vendor_code')
})

function credentialForState(over: Partial<SyncfyCredentialRow>): SyncfyCredentialRow {
  return {
    id: 'cred-1',
    email: 'u@x.co',
    syncfy_user_id: 'su-1',
    syncfy_credential_id: 'cred-1',
    syncfy_site_id: null,
    site_name: null,
    status: null,
    last_successful_sync_at: null,
    last_pull_at: null,
    last_pull_attempt_at: null,
    last_rid: null,
    raw_json: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: null,
    ...over,
  }
}

test('resolveLifecycleState trusts pending and only falls back when state is unknown', () => {
  expect(resolveLifecycleState(credentialForState({ state: 'pending', status: 'synced' }))).toBe('pending')
  expect(resolveLifecycleState(credentialForState({ state: 'pending', status: 'needs_reconnect' }))).toBe('pending')
  expect(resolveLifecycleState(credentialForState({ state: 'healthy', status: 'pending_transactions' }))).toBe('healthy')
  expect(resolveLifecycleState(credentialForState({ state: null, status: 'synced' }))).toBe('healthy')
  expect(resolveLifecycleState(credentialForState({ state: 'unknown', status: 'needs_reconnect' }))).toBe('needs_user')
  expect(resolveLifecycleState(credentialForState({ state: null, status: 'provider_unavailable' }))).toBe('degraded')
  expect(resolveLifecycleState(credentialForState({ state: undefined, status: 'sync_error' }))).toBe('abandoned')
})
