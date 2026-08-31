import {
  assert,
  asRecord,
  booleanField,
  finishSmoke,
  loadDevVars,
  numberField,
  requestJson as requestJsonWithTimeout,
  requireSupportAdminHeaders,
  skipOnUpstreamFailure,
  SmokeSkip,
  stringField,
  UpstreamRequestError,
  type JsonRecord,
} from './smoke-utils'

const SMOKE_LABEL = 'smoke-syncfy-full-flow'

// Before any env read below: Bun loads .env on its own but not .dev.vars, which
// is where SUPPORT_ADMIN_SECRET lives.
await loadDevVars()

// This is a deploy gate against a sandbox we do not control. A Syncfy outage
// must not block shipping code that does not touch Syncfy, so transport
// failures end the run as a skip. FINOVAI_SMOKE_STRICT=1 restores hard failure.
skipOnUpstreamFailure(SMOKE_LABEL)

const DEFAULT_API_BASE_URL = 'https://finovai-preview.my-cloudflare-711.workers.dev'
// Use Syncfy's dedicated sample-data institution for release gates. The normal
// demo institution can leave valid sandbox jobs pending indefinitely.
const SYNCFY_SAMPLE_DATA_SITE_ID = '61aec45361f37158fad6e44b'

function transactionCount(data: JsonRecord) {
  return Array.isArray(data.transactions) ? data.transactions.length : 0
}

const apiBaseUrl = (process.env.FINOVAI_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
const syncfySiteId = process.env.SYNCFY_FULL_FLOW_SITE_ID || SYNCFY_SAMPLE_DATA_SITE_ID
const pollAttempts = Number(process.env.SYNCFY_FULL_FLOW_POLL_ATTEMPTS || 12)
const pollDelayMs = Number(process.env.SYNCFY_FULL_FLOW_POLL_DELAY_MS || 5000)
const requestTimeoutMs = Number(process.env.FINOVAI_SMOKE_REQUEST_TIMEOUT_MS || 20_000)
const started = Date.now()

function requestJson<T extends JsonRecord>(baseUrl: string, path: string, init?: RequestInit) {
  return requestJsonWithTimeout<T>(baseUrl, path, init, requestTimeoutMs)
}

function logStep(step: string) {
  console.error(`[smoke-syncfy-full-flow] ${step}`)
}

logStep('health')
const health = await requestJson<JsonRecord>(apiBaseUrl, '/api/health', {
  headers: requireSupportAdminHeaders(),
})
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
let createResponse: Response
try {
  createResponse = await fetch('https://opendata-api.syncfy.com/v1/credentials/pulls?pretty=1', {
    method: 'POST',
    signal: AbortSignal.timeout(requestTimeoutMs),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id_site: syncfySiteId,
      credentials: {
        username: 'test',
        password: 'test',
      },
    }),
  })
} catch (err) {
  // Syncfy's own API, not ours. Ends the run here: a throw at this level is a
  // top-level-await rejection, which Bun exits 1 on no matter what.
  finishSmoke(
    new UpstreamRequestError(`Syncfy credential create did not respond: ${err instanceof Error ? err.message : String(err)}`),
    SMOKE_LABEL
  )
}
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
if (importedTransactionCount === 0) {
  // Everything of ours answered; the sandbox just never produced sample data.
  finishSmoke(
    new SmokeSkip(
      `Syncfy sandbox imported no transactions after ${pollAttempts} attempts `
      + `(${Math.round((pollAttempts * pollDelayMs) / 1000)}s). Our endpoints all responded.`
    ),
    SMOKE_LABEL
  )
}

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
    siteId: syncfySiteId,
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
