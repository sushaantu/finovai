export type JsonRecord = Record<string, unknown>

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function stringField(record: JsonRecord, key: string) {
  return typeof record[key] === 'string' ? record[key] : ''
}

export function booleanField(record: JsonRecord, key: string) {
  return Boolean(record[key])
}

export function numberField(record: JsonRecord, key: string) {
  return typeof record[key] === 'number' ? record[key] : null
}

export function supportAdminHeaders(): Record<string, string> {
  const secret = process.env.FINOVAI_SUPPORT_ADMIN_SECRET || process.env.SUPPORT_ADMIN_SECRET
  return secret ? { 'x-finovai-admin-secret': secret } : {}
}

export async function requestJson<T extends JsonRecord>(
  apiBaseUrl: string,
  path: string,
  init?: RequestInit,
  timeoutMs?: number
): Promise<{ status: number; data: T }> {
  const requestInit: RequestInit = {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  }

  if (!requestInit.signal && timeoutMs) {
    requestInit.signal = AbortSignal.timeout(timeoutMs)
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, requestInit)
    const data = await response.json().catch(() => ({})) as T
    return { status: response.status, data }
  } catch (err) {
    // Transport-level failure: the request never produced a response. Typed so
    // release gates can tell "the network/upstream flaked" apart from "our API
    // answered, and the answer was wrong".
    throw new UpstreamRequestError(
      `Request failed for ${path}: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * A dependency outside this repo did not cooperate (Syncfy sandbox slow or
 * down, transport timeout). Not a defect in the build under test, so release
 * gates report it as a skip rather than failing the deploy.
 */
export class SmokeSkip extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SmokeSkip'
  }
}

/** A request that never got a response. See requestJson. */
export class UpstreamRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UpstreamRequestError'
  }
}

/**
 * Bun auto-loads `.env` but not `.dev.vars`, so secrets kept there never reach
 * these scripts from a clean shell. Anything already in the environment wins,
 * so CI and one-off overrides beat the file.
 *
 * Returns the names (never the values) of what it loaded.
 */
export async function loadDevVars(path = '.dev.vars'): Promise<string[]> {
  let text: string
  try {
    text = await Bun.file(path).text()
  } catch {
    return []
  }

  const loaded: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    if (!key || process.env[key] !== undefined) continue
    process.env[key] = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '')
    loaded.push(key)
  }
  return loaded
}

/**
 * Admin-gated routes answer 404 when the secret is absent, which reads as a
 * missing route and sent us chasing a phantom regression. Fail with the real
 * cause instead.
 */
export function requireSupportAdminHeaders(): Record<string, string> {
  const headers = supportAdminHeaders()
  if (!headers['x-finovai-admin-secret']) {
    throw new Error(
      'SUPPORT_ADMIN_SECRET is not set, so admin-gated routes will answer 404 as if they did not exist. '
      + 'Set it in the shell or in .dev.vars, and call loadDevVars() before reading it.'
    )
  }
  return headers
}

function strictSmoke() {
  return /^(1|true|yes)$/i.test(process.env.FINOVAI_SMOKE_STRICT || '')
}

/**
 * Route every error escaping a smoke script through finishSmoke.
 *
 * These scripts are a flat sequence of top-level awaits, so a failure anywhere
 * rejects the module's evaluation. That surfaces as `uncaughtException`, not
 * `unhandledRejection` — in Node and Bun alike, since it is ESM module-
 * evaluation semantics rather than a runtime quirk. Registering the wrong one
 * silently never fires and the process exits 1 with the policy ignored.
 *
 * Call this once, at the top of a gate, before any await that can fail.
 */
export function installSmokeExit(label: string) {
  process.on('uncaughtException', (error) => finishSmoke(error, label))
}

/**
 * Terminal handler for a release-gate smoke. An unavailable upstream exits 0
 * with a loud notice so a third-party outage cannot block a deploy of code that
 * does not touch it; everything else still fails the build. Set
 * FINOVAI_SMOKE_STRICT=1 to make outages fail too.
 */
export function finishSmoke(error: unknown, label = 'smoke'): never {
  const skippable = error instanceof SmokeSkip || error instanceof UpstreamRequestError
  const reason = error instanceof Error ? error.message : String(error)

  if (skippable && !strictSmoke()) {
    console.error('')
    console.error(`[${label}] SKIPPED - an upstream dependency was unavailable.`)
    console.error(`[${label}] reason: ${reason}`)
    console.error(`[${label}] This does not indicate a regression in the build under test.`)
    console.error(`[${label}] Set FINOVAI_SMOKE_STRICT=1 to treat this as a failure.`)
    console.error('')
    process.exit(0)
  }

  console.error(error instanceof Error ? (error.stack || error.message) : String(error))
  process.exit(1)
}
