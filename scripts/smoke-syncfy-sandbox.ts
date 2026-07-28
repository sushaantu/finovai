import {
  assert,
  requestJson as requestJsonBase,
  type JsonRecord,
} from './smoke-utils'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8788'

type JsonResponse = JsonRecord & {
  success?: boolean
  email?: string
  clientSecret?: string
  verificationRequired?: boolean
  widgetEnabled?: boolean
  mode?: string
  token?: string
  syncfyUserId?: string
  credentials?: unknown[]
  error?: string
  rid?: string
  environment?: string
  syncfyEnvironment?: string
}

async function localDevVars() {
  try {
    return await Bun.file('.dev.vars').text()
  } catch {
    return ''
  }
}

function hasLocalDevVar(content: string, name: string, expected?: string) {
  const pattern = new RegExp(`^${name}=([^\\n\\r]*)`, 'm')
  const value = content.match(pattern)?.[1]?.trim()
  if (expected === undefined) return Boolean(value)
  return value === expected
}

async function requestJson(path: string, init?: RequestInit): Promise<{ status: number; data: JsonResponse }> {
  return requestJsonBase<JsonResponse>(apiBaseUrl, path, init)
}

const apiBaseUrl = (process.env.FINOVAI_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
const devVars = await localDevVars()
const sandboxLabeled = process.env.SYNCFY_ENV === 'sandbox' || hasLocalDevVar(devVars, 'SYNCFY_ENV', 'sandbox')
assert(
  sandboxLabeled,
  'Refusing to run: set SYNCFY_ENV=sandbox in .dev.vars or the shell before testing Syncfy locally.'
)

const health = await requestJson('/api/health')
assert(health.status === 200, `Health check failed with ${health.status}: ${health.data.error || 'unknown error'}`)
assert(health.data.environment === 'sandbox', `Expected API ENVIRONMENT=sandbox, got ${health.data.environment || 'missing'}.`)
assert(
  health.data.syncfyEnvironment === 'sandbox',
  `Expected API SYNCFY_ENV=sandbox, got ${health.data.syncfyEnvironment || 'missing'}.`
)

const email = `sandbox-smoke-${Date.now()}@finov.ai`
const signup = await requestJson('/api/signup', {
  method: 'POST',
  body: JSON.stringify({
    email,
    name: 'Sandbox Smoke',
    source: 'syncfy-sandbox-smoke',
  }),
})

assert(signup.status === 200, `Signup failed with ${signup.status}: ${signup.data.error || 'unknown error'}`)
assert(!signup.data.verificationRequired, 'Sandbox signup should not require email verification.')
assert(signup.data.email === email, 'Signup returned the wrong email.')

const authHeaders = signup.data.clientSecret
  ? { 'x-finovai-dashboard-secret': signup.data.clientSecret }
  : {}
const session = await requestJson('/api/syncfy/session', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    email,
    name: 'Sandbox Smoke',
    mode: 'create',
  }),
})

assert(session.status === 200, `Syncfy session failed with ${session.status}: ${session.data.error || 'unknown error'}`)
assert(session.data.success, 'Syncfy session did not return success=true.')
assert(session.data.mode === 'live', `Expected Syncfy live mode, got ${session.data.mode || 'missing'}.`)
assert(session.data.widgetEnabled, 'Syncfy widget was not enabled.')
assert(session.data.token, 'Syncfy session did not return a widget token.')
assert(session.data.syncfyUserId, 'Syncfy session did not return a Syncfy user id.')

const credentials = await requestJson(`/api/syncfy/credentials?email=${encodeURIComponent(email)}`, {
  headers: authHeaders,
})
assert(credentials.status === 200, `Credential lookup failed with ${credentials.status}: ${credentials.data.error || 'unknown error'}`)
assert(Array.isArray(credentials.data.credentials), 'Credential lookup did not return an array.')

const reset = await requestJson('/api/syncfy/reset', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({
    email,
    name: 'Sandbox Smoke',
  }),
})
assert(reset.status === 200, `Syncfy reset failed with ${reset.status}: ${reset.data.error || 'unknown error'}`)
assert(reset.data.success, 'Syncfy reset did not return success=true.')

console.log(JSON.stringify({
  ok: true,
  apiBaseUrl,
  environment: health.data.environment,
  syncfyEnvironment: health.data.syncfyEnvironment,
  email,
  signup: {
    clientSecret: Boolean(signup.data.clientSecret),
    verificationRequired: Boolean(signup.data.verificationRequired),
  },
  syncfySession: {
    mode: session.data.mode,
    widgetEnabled: Boolean(session.data.widgetEnabled),
    token: Boolean(session.data.token),
    syncfyUserId: Boolean(session.data.syncfyUserId),
  },
  credentials: {
    count: credentials.data.credentials.length,
  },
  reset: {
    success: Boolean(reset.data.success),
  },
}, null, 2))
