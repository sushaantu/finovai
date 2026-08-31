import { test, expect, afterEach } from 'bun:test'
import { createTestDb, loadSchema } from './lib/test-d1'
import { runScheduled } from './cron'
import { applyConnectionEvent } from './lib/ingest'
import { setSyncfyFetchForTests } from './lib/syncfy'
import type { Env } from './lib/shared'

// Vendor seam: lib/syncfy.ts routes ALL Paybook HTTP through one module-level function.
// Add to lib/syncfy.ts:
//   let syncfyFetch: typeof fetch = fetch
//   export function setSyncfyFetchForTests(impl: typeof fetch): void { syncfyFetch = impl }
// and replace every direct `fetch(` in that module with `syncfyFetch(`.

type VendorScript = (credentialId: string) => { ok: boolean; status: number; message: string }

function makeEnv(db: unknown, vendor: VendorScript, opts: { onEmail?: (m: { subject: string }) => void; utcHour?: number } = {}) {
  setSyncfyFetchForTests(async (input) => {
    const url = String(input)
    const credentialId = url.match(/credentials\/([^/?]+)/)?.[1] ?? 'unknown'
    const scripted = vendor(credentialId)
    return new Response(
      JSON.stringify({ code: scripted.status, status: scripted.ok, message: scripted.message, response: scripted.ok ? [] : undefined }),
      { status: scripted.ok ? 200 : scripted.status }
    )
  })
  return {
    DB: db,
    SYNCFY_API_KEY: 'test-key',
    OPS_ALERT_EMAIL: 'ops@test.local',
    EMAIL: { send: async (msg: { subject: string }) => { opts.onEmail?.(msg) } },
    __testUtcHour: opts.utcHour, // cron.ts reads this override in tests; falls back to real clock
  } as unknown as Env
}

async function seedCredential(db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { run: () => Promise<unknown> } } }, over: Partial<Record<string, unknown>> = {}) {
  const credentialId = over.id ?? 'cred-1'
  await db.prepare(`INSERT INTO syncfy_credentials
    (id, email, syncfy_user_id, syncfy_credential_id, site_name, status, state, attempt_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending_transactions', ?, ?, ?, datetime('now'))`)
    .bind(credentialId, over.email ?? 'u@x.co', 'su-1', credentialId, over.site ?? 'BBVA',
          over.state ?? 'pending', over.attempts ?? 0, over.createdAt ?? '2026-06-10T00:00:00Z').run()
}

afterEach(() => {
  setSyncfyFetchForTests((input, init) => fetch(input, init))
})

test('repeat vendor 400 on a never-succeeded credential lands in broken, then abandoned, then polling stops', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, { createdAt: '2026-06-10T00:00:00Z' }) // 81 days old
  const env = makeEnv(db, () => ({ ok: false, status: 400, message: "Credential can't be sync at this moment" }))

  await runScheduled(env)
  let row = await db.prepare('SELECT state, attempt_count FROM syncfy_credentials').first<any>()
  expect(['broken', 'abandoned']).toContain(row.state)

  // simulate 15 daily runs — must terminate in abandoned and stop calling the vendor
  let vendorCalls = 0
  const countingEnv = makeEnv(db, () => { vendorCalls += 1; return { ok: false, status: 400, message: 'x' } })
  for (let day = 0; day < 15; day += 1) await runScheduled(countingEnv)
  row = await db.prepare('SELECT state FROM syncfy_credentials').first<any>()
  expect(row.state).toBe('abandoned')
  const callsAtAbandon = vendorCalls
  await runScheduled(countingEnv)
  expect(vendorCalls).toBe(callsAtAbandon) // abandoned credentials are never polled
})

test('healthy credential that succeeds stays healthy and resets counters', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, { state: 'healthy', attempts: 2, createdAt: '2026-08-01T00:00:00Z' })
  const env = makeEnv(db, () => ({ ok: true, status: 200, message: 'ok' }))
  await runScheduled(env)
  const row = await db.prepare('SELECT state, attempt_count, last_successful_sync_at FROM syncfy_credentials').first<any>()
  expect(row.state).toBe('healthy')
  expect(row.attempt_count).toBe(0)
  expect(row.last_successful_sync_at).not.toBeNull()
})

test('pending empty vendor 200 still applies a lifecycle event', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, { state: 'pending', createdAt: new Date().toISOString() })
  const env = makeEnv(db, () => ({ ok: true, status: 200, message: 'ok' }))
  await runScheduled(env)
  const row = await db.prepare('SELECT state, attempt_count, last_pull_at, status FROM syncfy_credentials').first<any>()
  expect(row.state).toBe('pending')
  expect(row.attempt_count).toBe(1)
  expect(row.last_pull_at).not.toBeNull()
  expect(row.status).toBe('pending_transactions')
})

test('needs_user and abandoned are excluded from due selection', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, { id: 'cred-nu', state: 'needs_user' })
  await seedCredential(db, { id: 'cred-ab', email: 'v@x.co', state: 'abandoned' })
  let vendorCalls = 0
  const env = makeEnv(db, () => { vendorCalls += 1; return { ok: true, status: 200, message: 'ok' } })
  await runScheduled(env)
  expect(vendorCalls).toBe(0)
})

async function seedRecentSyncfyTransaction(db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { run: () => Promise<unknown> } } }) {
  const email = 'u@x.co'
  const now = new Date().toISOString()
  await db.prepare(
    `INSERT INTO financial_profiles (email, currency, created_at) VALUES (?, 'MXN', ?) ON CONFLICT(email) DO NOTHING`
  ).bind(email, now).run()
  await db.prepare(
    `INSERT INTO transactions (
      id, email, date, type, amount, currency, category, description, source, confidence, category_locked, created_at
    ) VALUES (?, ?, ?, 'expense', 100, 'MXN', 'Otro', 'Test', 'syncfy', 1, 0, datetime('now'))`
  ).bind('txn-health-1', email, now.slice(0, 10)).run()
}

test('health tick alerts when nothing ingested in 24h and a credential has no success in 48h', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, { state: 'broken', createdAt: '2026-06-10T00:00:00Z' })
  const sent: { subject: string }[] = []
  const vendorOk = () => ({ ok: true, status: 200, message: 'ok' })
  const env = makeEnv(db, vendorOk, { onEmail: (msg) => sent.push(msg), utcHour: 12 })
  await runScheduled(env)
  expect(sent.length).toBe(1)
  expect(sent[0].subject).toContain('FinovAI health')
})

test('applyConnectionEvent keeps state_changed_at when state does not change', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, {
    state: 'broken',
    attempts: 2,
    createdAt: '2026-08-27T00:00:00Z',
  })
  await db.prepare(
    `UPDATE syncfy_credentials
     SET first_failed_at = ?, state_changed_at = ?`
  ).bind('2026-08-29T00:00:00Z', '2026-08-29T00:00:00Z').run()

  const env = makeEnv(db, () => ({ ok: true, status: 200, message: 'ok' }))
  await applyConnectionEvent(
    env,
    { email: 'u@x.co', syncfy_credential_id: 'cred-1' },
    { type: 'sync_failed', statusCode: 400, vendorCode: null },
    new Date('2026-08-30T12:00:00Z')
  )

  const stuck = await db.prepare(
    `SELECT state, state_changed_at, attempt_count FROM syncfy_credentials WHERE syncfy_credential_id = ?`
  ).bind('cred-1').first<{ state: string; state_changed_at: string | null; attempt_count: number }>()
  expect(stuck?.state).toBe('broken')
  expect(stuck?.state_changed_at).toBe('2026-08-29T00:00:00Z')
  expect(stuck?.attempt_count).toBe(3)

  await applyConnectionEvent(
    env,
    { email: 'u@x.co', syncfy_credential_id: 'cred-1' },
    { type: 'sync_succeeded' },
    new Date('2026-08-30T13:00:00Z')
  )
  const recovered = await db.prepare(
    `SELECT state, state_changed_at FROM syncfy_credentials WHERE syncfy_credential_id = ?`
  ).bind('cred-1').first<{ state: string; state_changed_at: string | null }>()
  expect(recovered?.state).toBe('healthy')
  expect(recovered?.state_changed_at).toBe('2026-08-30T13:00:00.000Z')
})

test('healthy day sends no email', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, { state: 'healthy', createdAt: new Date().toISOString() })
  await seedRecentSyncfyTransaction(db)
  const sent: { subject: string }[] = []
  const env = makeEnv(db, () => ({ ok: true, status: 200, message: 'ok' }), {
    onEmail: (msg) => sent.push(msg),
    utcHour: 12,
  })
  await runScheduled(env)
  expect(sent.length).toBe(0)
})
