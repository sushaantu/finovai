export const DASHBOARD_SECRET_HEADER = 'X-FinovAI-Dashboard-Secret'

export interface SessionStore {
  getEmail(): string | null
  getSecret(): string | null
  set(email: string, clientSecret?: string | null): void
  clear(): void
}

export function buildAuthHeaders(store: SessionStore): Record<string, string> {
  const secret = store.getSecret()
  return secret ? { [DASHBOARD_SECRET_HEADER]: secret } : {}
}
