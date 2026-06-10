const DEFAULT_API_BASE_URL = 'https://finovai-preview.my-cloudflare-711.workers.dev'
const ACME_NORMAL_SITE_ID = '56cf5728784806f72b8b4568'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function requestJson<T extends JsonRecord>(
  apiBaseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      signal: init?.signal || AbortSignal.timeout(requestTimeoutMs),
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
    const data = await response.json().catch(() => ({})) as T
    return { status: response.status, data }
  } catch (err) {
    throw new Error(`Request failed for ${path}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function booleanField(record: JsonRecord, key: string) {
  return Boolean(record[key])
}

function stringField(record: JsonRecord, key: string) {
  return typeof record[key] === 'string' ? record[key] : ''
}

function numberField(record: JsonRecord, key: string) {
  return typeof record[key] === 'number' ? record[key] : null
}

function transactionCount(data: JsonRecord) {
  return Array.isArray(data.transactions) ? data.transactions.length : 0
}

const apiBaseUrl = (process.env.FINOVAI_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
const pollAttempts = Number(process.env.SYNCFY_FULL_FLOW_POLL_ATTEMPTS || 12)
const pollDelayMs = Number(process.env.SYNCFY_FULL_FLOW_POLL_DELAY_MS || 5000)
const requestTimeoutMs = Number(process.env.FINOVAI_SMOKE_REQUEST_TIMEOUT_MS || 20_000)
const started = Date.now()

function logStep(step: string) {
  console.error(`[smoke-syncfy-full-flow] ${step}`)
}

logStep('health')
const health = await requestJson<JsonRecord>(apiBaseUrl, '/api/health')
assert(health.status === 200, `Health failed with ${health.status}`)
assert(health.data.syncfyEnvironment === 'sandbox', `Refusing full-flow smoke outside Syncfy sandbox: ${String(health.data.syncfyEnvironment || 'missing')}`)
assert(health.data.environment !== 'production', 'Refusing full-flow smoke against production.')

const email = `syncfy-full-flow-${Date.now()}@finov.ai`
logStep('signup')
const signup = await requestJson<JsonRecord>(apiBaseUrl, '/api/signup', {
  method: 'POST',
  body: JSON.stringify({
    email,
    name: 'Syncfy Full Flow Smoke',
    source: 'syncfy-full-flow-smoke',
  }),
})
assert(signup.status === 200, `Signup failed with ${signup.status}: ${String(signup.data.error || 'unknown')}`)
assert(signup.data.success !== false, 'Signup returned success=false')

const dashboardSecret = stringField(signup.data, 'clientSecret')
const authHeaders = dashboardSecret ? { 'x-finovai-dashboard-secret': dashboardSecret } : {}
logStep('syncfy-session')
const session = await requestJson<JsonRecord>(apiBaseUrl, '/api/syncfy/session', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    email,
    name: 'Syncfy Full Flow Smoke',
    mode: 'create',
  }),
})
const token = stringField(session.data, 'token')
assert(session.status === 200, `Syncfy session failed with ${session.status}: ${String(session.data.error || 'unknown')}`)
assert(token, 'Syncfy session did not return a widget token.')
assert(stringField(session.data, 'syncfyUserId'), 'Syncfy session did not return a Syncfy user.')

logStep('syncfy-credential-create')
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
const createBody = asRecord(createPayload.response)
const credentialId = stringField(createBody, 'id_credential')
assert(createResponse.ok && createPayload.status !== false, `Syncfy credential create failed with ${createResponse.status}: ${String(createPayload.message || 'unknown')}`)
assert(credentialId, 'Syncfy credential create did not return id_credential.')

logStep('finovai-credential-capture')
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

const credentialRecord = asRecord(capture.data.credential)
const capturedCredentialId = stringField(credentialRecord, 'syncfyCredentialId') || credentialId
let refresh: { status: number; data: JsonRecord } | null = null
let transactions: { status: number; data: JsonRecord } | null = null

for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
  logStep(`transactions attempt ${attempt + 1}/${pollAttempts}`)
  transactions = await requestJson<JsonRecord>(
    apiBaseUrl,
    `/api/transactions?email=${encodeURIComponent(email)}`,
    { headers: authHeaders },
  )
  if (transactionCount(transactions.data) > 0) break

  logStep(`refresh attempt ${attempt + 1}/${pollAttempts}`)
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

logStep('dashboard-chat')
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

console.log(JSON.stringify({
  ok: true,
  apiBaseUrl,
  environment: health.data.environment,
  syncfyEnvironment: health.data.syncfyEnvironment,
  email,
  elapsedSeconds: Math.round((Date.now() - started) / 1000),
  signup: {
    status: signup.status,
    verificationRequired: booleanField(signup.data, 'verificationRequired'),
    clientSecret: Boolean(dashboardSecret),
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
    statusUrl: Boolean(stringField(createBody, 'status')),
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
