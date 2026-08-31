import type {
  CategoryAnalysis,
  FinanceActionPlan,
  FinanceInsight,
  FinanceSummary,
  FinanceTransaction,
  FinancialProfile,
} from './finance-core'

// --- finance ---

export interface DashboardResponse {
  success: boolean
  email: string
  transactions: FinanceTransaction[]
  profile?: FinancialProfile
  summary: FinanceSummary
  categoryAnalysis?: CategoryAnalysis
  insights: FinanceInsight[]
  actionPlan?: FinanceActionPlan
  message?: string
}

export interface TransactionCategoryResponse extends DashboardResponse {
  transaction: FinanceTransaction
}

export interface DashboardChatResponse {
  success: boolean
  answer: string
  model: string
  source: 'anthropic'
}

// --- household ---

export interface HouseholdInvite {
  id: string
  inviterEmail: string
  inviteeEmail: string
  status: 'pending' | 'accepted' | 'cancelled'
  created_at: string
}

export interface HouseholdResponse {
  success: boolean
  email: string
  invite?: HouseholdInvite
  invites: HouseholdInvite[]
  emailSent?: boolean
  message?: string
}

// --- syncfy ---

export interface SyncfyConnectionIssue {
  kind: 'action_required' | 'provider_unavailable' | 'rate_limited' | 'unknown' | 'broken' | 'abandoned' | 'connecting'
  owner: 'user' | 'provider' | 'finovai'
  action: 'update_access' | 'retry_later' | 'contact_support'
  title: string
  message: string
  supportCode: string | null
  statusCode: number | null
  occurredAt: string
  source: string
}

export interface SyncfyCredential {
  id: string
  syncfyCredentialId: string
  siteName: string | null
  status: string | null
  lastSuccessfulSyncAt: string | null
  lastPullAt: string | null
  cooldownSeconds: number
  ready: boolean
  needsReconnect?: boolean
  connectionState?: 'ready' | 'verifying' | 'action_required' | 'provider_unavailable' | 'support_required' | 'broken' | 'abandoned'
  connectionIssue?: SyncfyConnectionIssue | null
}

export interface SyncfyImportSummary {
  fetched: number
  imported: number
  skipped: number
}

export interface SyncfyCredentialsResponse {
  success?: boolean
  email?: string
  credentials: SyncfyCredential[]
}

export interface SyncfyCredentialCaptureResponse {
  success: boolean
  credential?: SyncfyCredential | null
  credentials: SyncfyCredential[]
  message?: string
  transactions?: unknown[]
  pendingTransactions?: boolean
  syncfy?: SyncfyImportSummary | null
}

export interface SyncfySessionResponse {
  success: boolean
  token: string | null
  widgetEnabled: boolean
  widgetEnableTestMode?: boolean
  widgetConfig: Record<string, unknown>
  credentialId: string | null
  error?: string
}

export interface SyncfyRefreshResponse {
  success: boolean
  message?: string
  error?: string
  retryAfterSeconds?: number
  credential?: SyncfyCredential
  transactions?: unknown[]
  pendingTransactions?: boolean
  syncfy?: SyncfyImportSummary | null
}

export interface SyncfyCredentialDeleteResponse {
  success: boolean
  credentials: SyncfyCredential[]
  message?: string
  deletedTransactions?: number
  syncfyCredentialDeleteAttempted?: boolean
  syncfyCredentialDeleted?: boolean
  transactions?: unknown[]
}

// --- auth ---

export interface AuthResponse {
  success: boolean
  email: string
  clientSecret?: string
  verificationRequired?: boolean
  debugCode?: string
  error?: string
}

// --- request payloads ---

export interface ManualTransactionInput {
  date: string
  type: 'income' | 'expense'
  amount: string
  currency: string
  category: string
  description: string
  merchant: string
  notes: string
}

export interface ProfilePatch {
  currency: string
  monthlyIncome: number | null
  monthlyBudget: number | null
  categoryBudgets: Record<string, number> | undefined
}
