import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function stringField(record: JsonRecord, key: string) {
  return typeof record[key] === 'string' ? record[key] : ''
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function requestJson<T extends JsonRecord>(
  apiBaseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const data = await response.json().catch(() => ({})) as T
  return { status: response.status, data }
}

function walkFiles(root: string, suffix: string, deadlineMs: number): string[] {
  if (Date.now() > deadlineMs || !existsSync(root)) return []

  const files: string[] = []
  let names: string[]
  try {
    names = readdirSync(root)
  } catch {
    return files
  }

  for (const name of names) {
    const path = join(root, name)
    let stat
    try {
      stat = statSync(path)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      files.push(...walkFiles(path, suffix, deadlineMs))
    } else if (path.endsWith(suffix)) {
      files.push(path)
    }
  }

  return files
}

function getMiniflareTempRoots() {
  try {
    return readdirSync(tmpdir())
      .filter((name) => name.startsWith('miniflare-'))
      .map((name) => join(tmpdir(), name))
  } catch {
    return []
  }
}

async function findLocalMiniflareCode(email: string, startedAt: number) {
  const deadlineMs = Date.now() + 15_000
  const minMtimeMs = startedAt - 5_000
  while (Date.now() < deadlineMs) {
    const candidates = getMiniflareTempRoots()
      .flatMap((root) => walkFiles(root, '.txt', Date.now() + 1_500))
      .filter((path) => path.includes('/email/email-text/'))
      .map((path) => {
        try {
          const stat = statSync(path)
          return { path, mtimeMs: stat.mtimeMs }
        } catch {
          return null
        }
      })
      .filter((item): item is { path: string; mtimeMs: number } => Boolean(item && item.mtimeMs >= minMtimeMs))
      .sort((left, right) => right.mtimeMs - left.mtimeMs)

    let fallback: { code: string; path: string } | null = null
    for (const candidate of candidates) {
      const text = readFileSync(candidate.path, 'utf8')
      const code = text.match(/\b\d{6}\b/)?.[0]
      if (!code) continue
      if (text.includes(email)) return { code, path: candidate.path }
      fallback ??= { code, path: candidate.path }
    }
    if (fallback) return fallback

    await Bun.sleep(500)
  }

  return null
}

const apiBaseUrl = (process.env.FINOVAI_API_BASE_URL || 'http://127.0.0.1:8788').replace(/\/+$/, '')
const email = `email-login-smoke-${Date.now()}@finov.ai`
const startedAt = Date.now()

const request = await requestJson<JsonRecord>(apiBaseUrl, '/api/auth/request-link', {
  method: 'POST',
  body: JSON.stringify({
    email,
    source: 'email-login-local-smoke',
    redirectPath: '/dashboard',
  }),
})

assert(request.status === 200, `Login-code request failed with ${request.status}: ${String(request.data.error || 'unknown')}`)
assert(request.data.verificationRequired === true, 'Login-code request did not require verification.')

const debugCode = stringField(request.data, 'debugCode')
const localEmail = debugCode ? { code: debugCode, path: null as string | null } : await findLocalMiniflareCode(email, startedAt)
assert(localEmail?.code, 'Could not find the local login code. Run this against local wrangler dev.')

const verified = await requestJson<JsonRecord>(apiBaseUrl, '/api/auth/verify', {
  method: 'POST',
  body: JSON.stringify({
    email,
    code: localEmail.code,
    source: 'email-login-local-smoke',
  }),
})
const clientSecret = stringField(verified.data, 'clientSecret')
assert(verified.status === 200, `Login-code verification failed with ${verified.status}: ${String(verified.data.error || 'unknown')}`)
assert(clientSecret, 'Login-code verification did not return a dashboard session.')

const dashboard = await requestJson<JsonRecord>(
  apiBaseUrl,
  `/api/transactions?email=${encodeURIComponent(email)}`,
  { headers: { 'x-finovai-dashboard-secret': clientSecret } },
)
assert(dashboard.status === 200, `Dashboard session check failed with ${dashboard.status}: ${String(dashboard.data.error || 'unknown')}`)

console.log(JSON.stringify({
  ok: true,
  apiBaseUrl,
  email,
  verificationRequired: true,
  codeFound: true,
  codeSource: localEmail.path ? 'miniflare-email' : 'debug-response',
  clientSecret: true,
  dashboardStatus: dashboard.status,
}, null, 2))
