import type {
  CategoryBudgetStatus,
  FinanceAnalysisTransaction,
  FinanceTransactionSource,
  FinanceTransactionType,
} from '@finovai/core'

export type TransactionType = FinanceTransactionType

export type TransactionSource = FinanceTransactionSource

export type DashboardTheme = 'light' | 'dark'

export type CategoryPeriodFilter = 'current' | 'previous' | 'all'

export type BudgetStatus = CategoryBudgetStatus

export interface ManualForm {
  type: TransactionType
  amount: string
  date: string
  category: string
  description: string
  merchant: string
  notes: string
}

export interface ManualDraft extends ManualForm {
  id: string
}

export interface ProfileForm {
  monthlyIncome: string
  monthlyBudget: string
}

export interface DashboardChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  chart?: DashboardChatChartType
  chartCategory?: string
  reasoning?: string
  reasoningDuration?: number
}

export type DashboardChatChartType = 'categories' | 'daily-spend' | 'savings' | 'recurring' | 'category-trend'

export interface PendingChatAnswer {
  question: string
  startedAt: number
}

export type AnalysisTransaction = FinanceAnalysisTransaction
