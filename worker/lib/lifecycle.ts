export type ConnectionState = 'pending' | 'healthy' | 'degraded' | 'broken' | 'needs_user' | 'abandoned'
export type ConnectionEvent =
  | { type: 'sync_succeeded' }
  | { type: 'sync_failed'; statusCode: number | null; vendorCode: string | null; unmapped?: boolean }
  | { type: 'auth_required' }
  | { type: 'user_reconnected' }

export interface ConnectionSnapshot {
  state: ConnectionState
  attemptCount: number
  firstFailedAt: string | null
  lastSuccessfulSyncAt: string | null
  createdAt: string
}

export interface TransitionResult {
  state: ConnectionState
  attemptCount: number
  firstFailedAt: string | null
  alerts: ('entered_broken' | 'unmapped_vendor_code')[]
}

export const BROKEN_AFTER_HOURS = 48
export const ABANDON_AFTER_DAYS = 14

const HOUR_MS = 3_600_000
const KNOWN_FAILURE_CODES = new Set([400, 401, 403, 429, 500, 502, 503, 504])

export function transition(s: ConnectionSnapshot, event: ConnectionEvent, now: Date): TransitionResult {
  const alerts: TransitionResult['alerts'] = []

  if (event.type === 'sync_succeeded') {
    return { state: 'healthy', attemptCount: 0, firstFailedAt: null, alerts }
  }
  if (event.type === 'user_reconnected') {
    return { state: 'pending', attemptCount: 0, firstFailedAt: null, alerts }
  }
  if (event.type === 'auth_required') {
    return { state: 'needs_user', attemptCount: s.attemptCount + 1, firstFailedAt: s.firstFailedAt ?? now.toISOString(), alerts }
  }

  // sync_failed
  if (event.unmapped) alerts.push('unmapped_vendor_code')
  const firstFailedAt = s.firstFailedAt ?? now.toISOString()
  const attemptCount = s.attemptCount + 1
  const failingForMs = now.getTime() - new Date(firstFailedAt).getTime()
  const ageMs = now.getTime() - new Date(s.createdAt).getTime()

  if (failingForMs >= ABANDON_AFTER_DAYS * 24 * HOUR_MS && !s.lastSuccessfulSyncAt) {
    return { state: 'abandoned', attemptCount, firstFailedAt, alerts }
  }
  if (s.lastSuccessfulSyncAt) {
    return { state: 'degraded', attemptCount, firstFailedAt, alerts }
  }
  if (ageMs >= BROKEN_AFTER_HOURS * HOUR_MS) {
    if (s.state !== 'broken') alerts.push('entered_broken')
    return { state: 'broken', attemptCount, firstFailedAt, alerts }
  }
  return { state: 'pending', attemptCount, firstFailedAt, alerts }
}

export function classifyVendorFailure(statusCode: number | null, vendorMessage: string | null): ConnectionEvent {
  const text = (vendorMessage ?? '').toLowerCase()
  const authByText = /two.?factor|2fa|verification code|c[oó]digo de seguridad|otp/.test(text) ||
    (/invalid|incorrect|rejected|rechaz/.test(text) && /password|contrase|credential|login|access|acceso/.test(text))
  if (statusCode === 401 || authByText) return { type: 'auth_required' }
  const unmapped = statusCode !== null && !KNOWN_FAILURE_CODES.has(statusCode)
  return { type: 'sync_failed', statusCode, vendorCode: null, unmapped }
}

export function userFacingIssue(state: ConnectionState): { kind: string; title: string; message: string } | null {
  switch (state) {
    case 'pending': return { kind: 'connecting', title: 'Conectando…', message: 'Estamos verificando la conexión con tu institución.' }
    case 'healthy': return null
    case 'degraded': return { kind: 'provider_unavailable', title: 'Problema temporal', message: 'Tu institución está fallando temporalmente. FinovAI reintentará automáticamente; no necesitas hacer nada.' }
    case 'broken': return { kind: 'broken', title: 'Esta conexión no está funcionando', message: 'La conexión con tu institución no ha logrado sincronizar. Estamos investigando con el proveedor; te avisaremos cuando haya novedades.' }
    case 'needs_user': return { kind: 'action_required', title: 'Actualiza el acceso de esta institución', message: 'La institución rechazó el acceso guardado. Vuelve a conectar tu cuenta para continuar.' }
    case 'abandoned': return { kind: 'abandoned', title: 'Conexión retirada', message: 'Esta conexión falló durante 14 días y fue retirada. Puedes volver a conectarla cuando quieras.' }
  }
}
