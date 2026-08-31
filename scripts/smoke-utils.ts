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
    throw new Error(`Request failed for ${path}: ${err instanceof Error ? err.message : String(err)}`)
  }
}
