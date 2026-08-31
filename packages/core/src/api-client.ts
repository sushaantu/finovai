import type {
  AuthResponse, DashboardResponse, TransactionCategoryResponse, DashboardChatResponse,
  HouseholdResponse, ManualTransactionInput, ProfilePatch,
  SyncfyCredentialsResponse, SyncfySessionResponse, SyncfyCredentialCaptureResponse,
  SyncfyRefreshResponse, SyncfyCredentialDeleteResponse,
} from './api-types'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface ApiClientConfig {
  /** '' on web (Vite proxies /api); the absolute worker URL on mobile. */
  baseUrl: string
  getAuthHeaders: () => Record<string, string>
  onUnauthorized?: () => void
  fetchImpl?: typeof fetch
}

export function createApiClient(config: ApiClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...config.getAuthHeaders(),
        ...init?.headers,
      },
    })
    const body: unknown = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401) config.onUnauthorized?.()
      const message =
        typeof (body as { error?: unknown })?.error === 'string'
          ? (body as { error: string }).error
          : 'Error de API'
      throw new ApiError(response.status, message, body)
    }
    return body as T
  }

  const post = (payload: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(payload) })
  const patch = (payload: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(payload) })

  return {
    // --- auth ---
    signup: (email: string, options?: { redirectPath?: string; diagnosticData?: string }) =>
      request<AuthResponse>('/api/signup', post({
        email,
        redirectPath: options?.redirectPath ?? '/dashboard',
        diagnosticData: options?.diagnosticData,
      })),
    verifyLoginCode: (email: string, code: string, source: string) =>
      request<AuthResponse>('/api/auth/verify', post({ email, code, source })),
    verifyLoginToken: (email: string, token: string) =>
      request<AuthResponse>('/api/auth/verify', post({ email, token, source: 'magic-link' })),
    requestLoginLink: (email: string) =>
      request<AuthResponse>('/api/auth/request-link', post({ email })),

    // --- finance ---
    getTransactions: (email: string) =>
      request<DashboardResponse>(`/api/transactions?email=${encodeURIComponent(email)}`),
    saveManualTransaction: (email: string, input: ManualTransactionInput) =>
      request<DashboardResponse>('/api/transactions/manual', post({ email, ...input })),
    updateTransactionCategory: (email: string, transactionId: string, category: string) =>
      request<TransactionCategoryResponse>('/api/transactions/category', patch({ email, transactionId, category })),
    saveProfile: (email: string, profile: ProfilePatch) =>
      request<DashboardResponse>('/api/profile', patch({ email, ...profile })),
    sendDashboardChat: (email: string, question: string) =>
      request<DashboardChatResponse>('/api/dashboard/chat', post({ email, question })),

    // --- household ---
    getHousehold: (email: string) =>
      request<HouseholdResponse>(`/api/household?email=${encodeURIComponent(email)}`),
    inviteSpouse: (email: string, spouseEmail: string) =>
      request<HouseholdResponse>('/api/household/invite', post({ email, spouseEmail })),

    // --- syncfy ---
    getSyncfyCredentials: (email: string) =>
      request<SyncfyCredentialsResponse>(`/api/syncfy/credentials?email=${encodeURIComponent(email)}`),
    createSyncfySession: (email: string, options?: { credentialId?: string | null; mode?: string }) =>
      request<SyncfySessionResponse>('/api/syncfy/session', post({ email, credentialId: options?.credentialId, mode: options?.mode })),
    captureSyncfyCredential: (email: string, eventType: string, payload: unknown) =>
      request<SyncfyCredentialCaptureResponse>('/api/syncfy/credential', post({ email, eventType, payload })),
    refreshSyncfyCredential: (email: string, credentialId?: string) =>
      request<SyncfyRefreshResponse>('/api/syncfy/refresh', post({ email, credentialId })),
    deleteSyncfyCredential: (email: string, credentialId: string) =>
      request<SyncfyCredentialDeleteResponse>('/api/syncfy/credential', { method: 'DELETE', body: JSON.stringify({ email, credentialId }) }),

    // --- support admin (its own credential, never the dashboard session secret) ---
    getSyncfyAdmin: <T>(adminSecret: string, options?: { email?: string; limit?: number }) => {
      const params = new URLSearchParams({ limit: String(options?.limit ?? 75) })
      if (options?.email) params.set('email', options.email)
      return request<T>(`/api/admin/syncfy?${params.toString()}`, {
        headers: { 'X-FinovAI-Admin-Secret': adminSecret },
      })
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
