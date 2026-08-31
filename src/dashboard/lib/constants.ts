import type {
  CategoryAnalysis,
  FinanceActionPlan,
  FinanceInsight,
  FinanceSummary,
  FinanceTransaction,
  FinancialProfile,
  HouseholdInvite,
  SyncfyCredential,
} from '@finovai/core'
import { DEFAULT_FINANCE_CURRENCY, DEFAULT_INVESTMENT_ASSUMPTION } from '@finovai/core'
import { getStoredDashboardEmail } from '@/lib/dashboard-session'
import type { DashboardTheme, ManualForm } from './types'
import { formatMonth } from './format'

export const DASHBOARD_THEME_STORAGE_KEY = 'finovai-dashboard-theme'

export const EMPTY_SUMMARY: FinanceSummary = {
  month: new Date().toISOString().slice(0, 7),
  monthlyIncome: 0,
  monthlySpending: 0,
  netBalance: 0,
  transactionCount: 0,
  dataCoverage: {
    firstDate: null,
    lastDate: null,
    firstMonth: null,
    lastMonth: null,
    monthCount: 0,
    transactionCount: 0,
    preliminary: true,
  },
  topSpendingCategory: 'Sin datos',
  topSpendingCategoryAmount: 0,
  unusualHighSpendDay: null,
  recurringExpenses: [],
  estimatedSavingsOpportunity: 0,
}

export const EMPTY_TRANSACTIONS: FinanceTransaction[] = []

export const EMPTY_SYNCFY_CREDENTIALS: SyncfyCredential[] = []

export const EMPTY_HOUSEHOLD_INVITES: HouseholdInvite[] = []

export const EMPTY_INSIGHTS: FinanceInsight[] = []

export const EMPTY_PROFILE: FinancialProfile = {
  email: '',
  currency: DEFAULT_FINANCE_CURRENCY,
  monthlyIncome: null,
  monthlyBudget: null,
  categoryBudgets: {},
}

export const EMPTY_CATEGORY_ANALYSIS: CategoryAnalysis = {
  period: EMPTY_SUMMARY.month,
  periodLabel: formatMonth(EMPTY_SUMMARY.month),
  previousPeriod: null,
  spendingTotal: 0,
  incomeTotal: 0,
  budgetTotal: null,
  budgetSource: 'missing',
  fixedExpenseShare: null,
  fixedExpenseLimit: null,
  summaryAdvice: 'Falta tu ingreso y presupuesto mensual. Agrega esos datos para comparar el gasto contra una meta real.',
  categories: [],
  monthRows: [],
}

export const EMPTY_ACTION_PLAN: FinanceActionPlan = {
  monthlySavingsTarget: 0,
  topOpportunities: [],
  investmentProjection: {
    monthlyContribution: 0,
    years: DEFAULT_INVESTMENT_ASSUMPTION.years,
    annualReturn: DEFAULT_INVESTMENT_ASSUMPTION.annualReturn,
    totalContributed: 0,
    tenYearValue: 0,
    potentialGrowth: 0,
  },
  nextActions: [],
}

export function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

export function createManualForm(): ManualForm {
  return {
    type: 'expense',
    amount: '',
    date: getTodayInputDate(),
    category: 'Comida fuera',
    description: '',
    merchant: '',
    notes: '',
  }
}

export function getStoredEmail(fallback: string | null) {
  if (fallback) return fallback
  return getStoredDashboardEmail()
}

export function getStoredDashboardTheme(): DashboardTheme {
  if (typeof window === 'undefined') return 'light'
  const storedTheme = window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY)
  return storedTheme === 'dark' ? 'dark' : 'light'
}

export function getDashboardPreviewEnabled() {
  if (typeof window === 'undefined') return false
  if (!import.meta.env.DEV) return false
  return new URLSearchParams(window.location.search).get('preview') === 'dashboard'
}

export function getDashboardLoadingPreviewEnabled() {
  if (typeof window === 'undefined') return false
  if (!import.meta.env.DEV) return false
  return new URLSearchParams(window.location.search).get('preview') === 'loading'
}
