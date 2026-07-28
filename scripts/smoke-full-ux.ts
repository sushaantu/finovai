import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assert,
  asRecord,
  booleanField,
  numberField,
  requestJson as requestJsonWithTimeout,
  stringField,
  type JsonRecord,
} from './smoke-utils'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8788'
const PREVIEW_API_BASE_URL = 'https://finovai-preview.my-cloudflare-711.workers.dev'
const ACME_NORMAL_SITE_ID = '56cf5728784806f72b8b4568'

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

function transactionCount(data: JsonRecord) {
  return Array.isArray(data.transactions) ? data.transactions.length : 0
}

const apiBaseUrl = (
  process.env.FINOVAI_API_BASE_URL ||
  (process.env.FINOVAI_FULL_UX_TARGET === 'preview' ? PREVIEW_API_BASE_URL : DEFAULT_API_BASE_URL)
).replace(/\/+$/, '')
const pollAttempts = Number(process.env.FINOVAI_FULL_UX_POLL_ATTEMPTS || 12)
const pollDelayMs = Number(process.env.FINOVAI_FULL_UX_POLL_DELAY_MS || 5000)
const maxSeconds = Number(process.env.FINOVAI_FULL_UX_MAX_SECONDS || 120)
const requestTimeoutMs = Number(process.env.FINOVAI_SMOKE_REQUEST_TIMEOUT_MS || 20_000)
const requireEmailCode = process.env.FINOVAI_FULL_UX_REQUIRE_EMAIL_CODE === 'true'
const startedAt = Date.now()
const email = `full-ux-smoke-${Date.now()}@finov.ai`

function requestJson<T extends JsonRecord>(baseUrl: string, path: string, init?: RequestInit) {
  return requestJsonWithTimeout<T>(baseUrl, path, init, requestTimeoutMs)
}

const health = await requestJson<JsonRecord>(apiBaseUrl, '/api/health')
assert(health.status === 200, `Health failed with ${health.status}`)
assert(health.data.environment !== 'production', 'Refusing full UX smoke against production without an explicit manual test window.')
assert(health.data.syncfyEnvironment === 'sandbox', `Refusing full UX smoke outside Syncfy sandbox: ${String(health.data.syncfyEnvironment || 'missing')}`)

const signup = await requestJson<JsonRecord>(apiBaseUrl, '/api/signup', {
  method: 'POST',
  body: JSON.stringify({
    email,
    name: 'Full UX Smoke',
    source: 'full-ux-smoke',
    redirectPath: '/dashboard/connect',
  }),
})
assert(signup.status === 200, `Signup failed with ${signup.status}: ${String(signup.data.error || 'unknown')}`)

let clientSecret = stringField(signup.data, 'clientSecret')
let codeSource = 'not-required'
if (booleanField(signup.data, 'verificationRequired')) {
  const code = stringField(signup.data, 'debugCode') ||
    process.env.FINOVAI_EMAIL_LOGIN_CODE ||
    (await findLocalMiniflareCode(email, startedAt))?.code ||
    ''
  assert(code, 'Email verification was required, but no code was available. Use local Miniflare email output or FINOVAI_EMAIL_LOGIN_CODE.')

  const verified = await requestJson<JsonRecord>(apiBaseUrl, '/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({
      email,
      code,
      source: 'full-ux-smoke',
    }),
  })
  clientSecret = stringField(verified.data, 'clientSecret')
  assert(verified.status === 200, `Email verification failed with ${verified.status}: ${String(verified.data.error || 'unknown')}`)
  assert(clientSecret, 'Email verification did not return a dashboard session.')
  codeSource = stringField(signup.data, 'debugCode') ? 'debug-response' : process.env.FINOVAI_EMAIL_LOGIN_CODE ? 'env' : 'miniflare-email'
} else if (requireEmailCode) {
  throw new Error('Expected email-code verification, but the target API issued a session directly.')
}

const authHeaders = clientSecret ? { 'x-finovai-dashboard-secret': clientSecret } : {}
const session = await requestJson<JsonRecord>(apiBaseUrl, '/api/syncfy/session', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    email,
    name: 'Full UX Smoke',
    mode: 'create',
  }),
})
const token = stringField(session.data, 'token')
assert(session.status === 200, `Syncfy session failed with ${session.status}: ${String(session.data.error || 'unknown')}`)
assert(token, 'Syncfy session did not return a widget token.')
assert(stringField(session.data, 'syncfyUserId'), 'Syncfy session did not return a Syncfy user.')

const createResponse = await fetch('https://opendata-api.syncfy.com/v1/credentials/pulls?pretty=1', {
  method: 'POST',
  signal: AbortSignal.timeout(requestTimeoutMs),
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    id_site: ACME_NORMAL_SITE_ID,
    credentials: {
      username: 'test',
      password: 'test',
    },
  }),
})
const createPayload = await createResponse.json().catch(() => ({})) as JsonRecord
const credentialId = stringField(asRecord(createPayload.response), 'id_credential')
assert(createResponse.ok && createPayload.status !== false, `Syncfy credential create failed with ${createResponse.status}: ${String(createPayload.message || 'unknown')}`)
assert(credentialId, 'Syncfy credential create did not return id_credential.')

const capture = await requestJson<JsonRecord>(apiBaseUrl, '/api/syncfy/credential', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    email,
    eventType: 'widget.success',
    payload: createPayload,
  }),
})
assert([200, 202].includes(capture.status), `FinovAI credential capture failed with ${capture.status}: ${String(capture.data.error || 'unknown')}`)
assert(capture.data.success !== false, 'FinovAI credential capture returned success=false')

const capturedCredentialId = stringField(asRecord(capture.data.credential), 'syncfyCredentialId') || credentialId
let refresh: { status: number; data: JsonRecord } | null = null
let transactions: { status: number; data: JsonRecord } | null = null

for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
  transactions = await requestJson<JsonRecord>(
    apiBaseUrl,
    `/api/transactions?email=${encodeURIComponent(email)}`,
    { headers: authHeaders },
  )
  if (transactionCount(transactions.data) > 0) break

  refresh = await requestJson<JsonRecord>(apiBaseUrl, '/api/syncfy/refresh', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email,
      credentialId: capturedCredentialId,
    }),
  })
  if (transactionCount(refresh.data) > 0) {
    transactions = refresh
    break
  }
  await Bun.sleep(pollDelayMs)
}

const importedTransactionCount = transactions ? transactionCount(transactions.data) : 0
assert(importedTransactionCount > 0, `No transactions imported after ${pollAttempts} attempts.`)

const chat = await requestJson<JsonRecord>(apiBaseUrl, '/api/dashboard/chat', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    email,
    question: '¿Dónde estoy gastando más?',
  }),
})
const answer = stringField(chat.data, 'answer')
assert(chat.status === 200, `Dashboard chat failed with ${chat.status}: ${String(chat.data.error || 'unknown')}`)
assert(answer.length > 20, 'Dashboard chat returned an empty or too-short answer.')

const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
assert(elapsedSeconds <= maxSeconds, `Full UX smoke took ${elapsedSeconds}s, above ${maxSeconds}s.`)

console.log(JSON.stringify({
  ok: true,
  apiBaseUrl,
  environment: health.data.environment,
  syncfyEnvironment: health.data.syncfyEnvironment,
  email,
  elapsedSeconds,
  signup: {
    status: signup.status,
    verificationRequired: booleanField(signup.data, 'verificationRequired'),
    codeSource,
    clientSecret: Boolean(clientSecret),
  },
  syncfySession: {
    status: session.status,
    token: Boolean(token),
    syncfyUser: Boolean(stringField(session.data, 'syncfyUserId')),
    widgetEnableTestMode: booleanField(session.data, 'widgetEnableTestMode'),
  },
  syncfyCredentialCreate: {
    httpStatus: createResponse.status,
    code: numberField(createPayload, 'code'),
    rid: stringField(createPayload, 'rid'),
    credentialId: Boolean(credentialId),
    statusUrl: Boolean(stringField(asRecord(createPayload.response), 'status')),
  },
  finovaiCapture: {
    status: capture.status,
    pendingTransactions: booleanField(capture.data, 'pendingTransactions'),
    message: stringField(capture.data, 'message'),
    imported: numberField(asRecord(capture.data.syncfy), 'imported'),
  },
  refresh: refresh ? {
    status: refresh.status,
    pendingTransactions: booleanField(refresh.data, 'pendingTransactions'),
    message: stringField(refresh.data, 'message'),
    imported: numberField(asRecord(refresh.data.syncfy), 'imported'),
  } : null,
  transactions: {
    count: importedTransactionCount,
    monthlySpending: numberField(asRecord(transactions?.data.summary), 'monthlySpending'),
  },
  chat: {
    status: chat.status,
    model: stringField(chat.data, 'model'),
    answerPreview: answer.slice(0, 220),
  },
}, null, 2))
