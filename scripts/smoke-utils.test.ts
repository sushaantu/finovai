import { afterEach, expect, test } from 'bun:test'

import {
  asRecord,
  booleanField,
  numberField,
  loadDevVars,
  requestJson,
  requireSupportAdminHeaders,
  stringField,
  supportAdminHeaders,
  UpstreamRequestError,
} from './smoke-utils'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('record helpers return safe primitive fields', () => {
  const record = asRecord({
    name: 'FinovAI',
    count: 3,
    enabled: true,
    nested: { value: 'ignored' },
  })

  expect(asRecord(null)).toEqual({})
  expect(asRecord(['x'])).toEqual({})
  expect(stringField(record, 'name')).toBe('FinovAI')
  expect(stringField(record, 'count')).toBe('')
  expect(numberField(record, 'count')).toBe(3)
  expect(numberField(record, 'name')).toBeNull()
  expect(booleanField(record, 'enabled')).toBe(true)
  expect(booleanField(record, 'missing')).toBe(false)
})

test('supportAdminHeaders sends the admin secret when configured', () => {
  const previousFinovai = process.env.FINOVAI_SUPPORT_ADMIN_SECRET
  const previousSupport = process.env.SUPPORT_ADMIN_SECRET
  delete process.env.FINOVAI_SUPPORT_ADMIN_SECRET
  delete process.env.SUPPORT_ADMIN_SECRET
  expect(supportAdminHeaders()).toEqual({})

  process.env.SUPPORT_ADMIN_SECRET = 'from-support'
  expect(supportAdminHeaders()).toEqual({ 'x-finovai-admin-secret': 'from-support' })

  process.env.FINOVAI_SUPPORT_ADMIN_SECRET = 'from-finovai'
  expect(supportAdminHeaders()).toEqual({ 'x-finovai-admin-secret': 'from-finovai' })

  if (previousFinovai === undefined) delete process.env.FINOVAI_SUPPORT_ADMIN_SECRET
  else process.env.FINOVAI_SUPPORT_ADMIN_SECRET = previousFinovai
  if (previousSupport === undefined) delete process.env.SUPPORT_ADMIN_SECRET
  else process.env.SUPPORT_ADMIN_SECRET = previousSupport
})

test('requestJson sends json headers and parses json responses', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({ ok: true, name: 'smoke' }), { status: 202 })
  }) as typeof fetch

  const response = await requestJson('https://api.example.test', '/health', {
    method: 'POST',
    body: JSON.stringify({ ping: true }),
  }, 1_000)

  expect(response).toEqual({ status: 202, data: { ok: true, name: 'smoke' } })
  expect(calls[0].url).toBe('https://api.example.test/health')
  expect(calls[0].init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
  expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal)
})

test('loadDevVars fills gaps from .dev.vars without overriding the environment', async () => {
  const dir = `${process.env.TMPDIR || '/tmp'}/finovai-devvars-${Date.now()}`
  const file = `${dir}/.dev.vars`
  await Bun.write(file, [
    '# comment line',
    '',
    'SMOKE_TEST_FRESH=from-file',
    'SMOKE_TEST_PRESET=from-file',
    'SMOKE_TEST_QUOTED="quoted value"',
    'malformed-line-without-equals',
  ].join('\n'))

  process.env.SMOKE_TEST_PRESET = 'from-shell'
  delete process.env.SMOKE_TEST_FRESH
  delete process.env.SMOKE_TEST_QUOTED

  const loaded = await loadDevVars(file)

  // The shell wins, so CI and one-off overrides beat the file.
  expect(process.env.SMOKE_TEST_PRESET).toBe('from-shell')
  expect(process.env.SMOKE_TEST_FRESH).toBe('from-file')
  expect(process.env.SMOKE_TEST_QUOTED).toBe('quoted value')
  expect(loaded).toContain('SMOKE_TEST_FRESH')
  expect(loaded).not.toContain('SMOKE_TEST_PRESET')

  delete process.env.SMOKE_TEST_PRESET
  delete process.env.SMOKE_TEST_FRESH
  delete process.env.SMOKE_TEST_QUOTED
})

test('loadDevVars is a no-op when the file is absent', async () => {
  expect(await loadDevVars('/nonexistent/.dev.vars')).toEqual([])
})

test('requireSupportAdminHeaders names the real cause instead of letting a 404 mislead', () => {
  const previousFinovai = process.env.FINOVAI_SUPPORT_ADMIN_SECRET
  const previousSupport = process.env.SUPPORT_ADMIN_SECRET
  delete process.env.FINOVAI_SUPPORT_ADMIN_SECRET
  delete process.env.SUPPORT_ADMIN_SECRET

  expect(() => requireSupportAdminHeaders()).toThrow(/SUPPORT_ADMIN_SECRET is not set/)

  process.env.SUPPORT_ADMIN_SECRET = 'configured'
  expect(requireSupportAdminHeaders()).toEqual({ 'x-finovai-admin-secret': 'configured' })

  if (previousFinovai === undefined) delete process.env.FINOVAI_SUPPORT_ADMIN_SECRET
  else process.env.FINOVAI_SUPPORT_ADMIN_SECRET = previousFinovai
  if (previousSupport === undefined) delete process.env.SUPPORT_ADMIN_SECRET
  else process.env.SUPPORT_ADMIN_SECRET = previousSupport
})

test('requestJson reports a transport failure as UpstreamRequestError by default', async () => {
  globalThis.fetch = (async () => {
    throw new Error('The operation timed out.')
  }) as typeof fetch

  expect(requestJson('https://api.example.test', '/api/syncfy/credential')).rejects.toThrow(UpstreamRequestError)
})

// finishSmoke ends the process, so its contract is only observable from outside.
async function runFinishSmoke(source: string, env: Record<string, string> = {}) {
  const proc = Bun.spawn(['bun', '-e', source], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stderr = await new Response(proc.stderr).text()
  return { exitCode: await proc.exited, stderr }
}

const SKIP_SOURCE =
  "import {finishSmoke, SmokeSkip} from './scripts/smoke-utils';"
  + "finishSmoke(new SmokeSkip('sandbox produced no data'), 'gate')"

test('an upstream outage does not fail the release gate', async () => {
  const { exitCode, stderr } = await runFinishSmoke(SKIP_SOURCE)
  expect(exitCode).toBe(0)
  expect(stderr).toContain('SKIPPED')
})

test('FINOVAI_SMOKE_STRICT turns an upstream outage back into a failure', async () => {
  const { exitCode } = await runFinishSmoke(SKIP_SOURCE, { FINOVAI_SMOKE_STRICT: '1' })
  expect(exitCode).toBe(1)
})

test('a genuine assertion failure still fails the release gate', async () => {
  const { exitCode } = await runFinishSmoke(
    "import {finishSmoke} from './scripts/smoke-utils';"
    + "finishSmoke(new Error('Signup returned success=false'), 'gate')"
  )
  expect(exitCode).toBe(1)
})

// The path that actually matters: a failure deep inside a top-level-await
// script. This rejects module evaluation, which arrives as uncaughtException
// rather than unhandledRejection — the distinction the gate depends on.
const TLA_SOURCE = (thrown: string) =>
  "import {installSmokeExit, SmokeSkip, UpstreamRequestError} from './scripts/smoke-utils';"
  + "installSmokeExit('gate');"
  + `async function deep() { await new Promise(r => setTimeout(r, 5)); throw ${thrown} }`
  + 'await deep();'
  + "console.log('NOT REACHED')"

test('installSmokeExit turns an upstream outage in a top-level-await script into a skip', async () => {
  const { exitCode, stderr } = await runFinishSmoke(TLA_SOURCE("new SmokeSkip('sandbox produced no data')"))
  expect(exitCode).toBe(0)
  expect(stderr).toContain('SKIPPED')
  expect(stderr).not.toContain('NOT REACHED')
})

test('installSmokeExit treats a transport failure as an outage', async () => {
  const { exitCode } = await runFinishSmoke(TLA_SOURCE("new UpstreamRequestError('timed out')"))
  expect(exitCode).toBe(0)
})

test('installSmokeExit still fails the build on an assertion failure', async () => {
  const { exitCode } = await runFinishSmoke(TLA_SOURCE("new Error('Signup returned success=false')"))
  expect(exitCode).toBe(1)
})

test('installSmokeExit honours FINOVAI_SMOKE_STRICT for outages', async () => {
  const { exitCode } = await runFinishSmoke(
    TLA_SOURCE("new SmokeSkip('sandbox produced no data')"),
    { FINOVAI_SMOKE_STRICT: '1' },
  )
  expect(exitCode).toBe(1)
})
