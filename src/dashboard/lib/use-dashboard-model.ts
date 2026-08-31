import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { DashboardResponse, SyncfyCredential } from '@finovai/core'
import {
  DEFAULT_FINANCE_CURRENCY,
  INVESTMENT_CATEGORY,
  buildCategoryAnalysis,
  buildDashboardIncomeGuidance,
  buildFinanceDataCoverage,
  getBudgetStatus,
  roundMoney,
} from '@finovai/core'
import {
  queryKeys,
  useHousehold,
  useSyncfyCredentials,
  useTransactions,
} from '@finovai/core/react'

import type { AnalysisTransaction, CategoryPeriodFilter } from './types'
import {
  EMPTY_ACTION_PLAN,
  EMPTY_CATEGORY_ANALYSIS,
  EMPTY_HOUSEHOLD_INVITES,
  EMPTY_INSIGHTS,
  EMPTY_PROFILE,
  EMPTY_SUMMARY,
  EMPTY_SYNCFY_CREDENTIALS,
  EMPTY_TRANSACTIONS,
} from './constants'
import { formatCardCurrency, formatDataCoverage } from './format'
import {
  getBreakdownTotal,
  getCategoryChartData,
  getDailyFlowChartData,
  getExpenseBreakdown,
  getRecurringChartData,
  getSavingsChartData,
  getSavingsProjection,
  getTopTransactions,
} from './analytics'
import {
  syncfyCredentialHasProviderIssue,
  syncfyCredentialIsConnected,
  syncfyCredentialNeedsReconnect,
  syncfyCredentialNeedsSupport,
} from './credentials'
import { createPreviewDashboardResponse, createPreviewSyncfyCredentials } from './preview'

export interface DashboardModelOptions {
  previewEnabled: boolean
  loadingPreviewEnabled: boolean
  previewEmail: string | null
  categoryPeriodFilter: CategoryPeriodFilter
}

/**
 * Every server-derived value the dashboard pages share. Each page calls this
 * with the same email; React Query dedupes the three underlying requests, so
 * pages stay independent instead of prop-drilling one giant `data` object.
 */
export function useDashboardModel(activeEmail: string | null, options: DashboardModelOptions) {
  const { previewEnabled, loadingPreviewEnabled, previewEmail, categoryPeriodFilter } = options
  const queriesEnabled = !previewEnabled && !loadingPreviewEnabled
  const transactionsQuery = useTransactions(activeEmail, { enabled: queriesEnabled })
  const credentialsQuery = useSyncfyCredentials(activeEmail, { enabled: queriesEnabled })
  const householdQuery = useHousehold(activeEmail, { enabled: queriesEnabled })
  const queryClient = useQueryClient()

  // The worker returns a fresh DashboardResponse from every finance mutation,
  // so callers write it straight into the cache instead of refetching.
  const setDashboardData = (next: DashboardResponse) => {
    if (!activeEmail) return
    queryClient.setQueryData(queryKeys.transactions(activeEmail), next)
  }

  const setSyncfyCredentialsCache = (credentials: SyncfyCredential[]) => {
    if (!activeEmail) return
    queryClient.setQueryData(queryKeys.syncfyCredentials(activeEmail), { credentials })
  }

  const data = previewEnabled
    ? createPreviewDashboardResponse(activeEmail || previewEmail || 'preview@finov.ai')
    : transactionsQuery.data ?? null
  const syncfyCredentials = previewEnabled
    ? createPreviewSyncfyCredentials()
    : credentialsQuery.data?.credentials ?? EMPTY_SYNCFY_CREDENTIALS
  const householdInvites = householdQuery.data?.invites ?? EMPTY_HOUSEHOLD_INVITES
  const isLoadingCredentials = queriesEnabled && Boolean(activeEmail) && credentialsQuery.isPending
  const credentialsReadyForEmail = previewEnabled
    ? activeEmail || previewEmail || 'preview@finov.ai'
    : credentialsQuery.isSuccess
      ? activeEmail
      : null
  const credentialsFetchFailed = credentialsQuery.isError
  const loadError = transactionsQuery.isError
    ? transactionsQuery.error instanceof Error
      ? transactionsQuery.error.message
      : 'No pudimos cargar tu análisis.'
    : null

  const connectedSyncfyCredentials = syncfyCredentials.filter(syncfyCredentialIsConnected)
  const reconnectCredentialCount = syncfyCredentials.filter(syncfyCredentialNeedsReconnect).length
  const providerIssueCredentialCount = syncfyCredentials.filter(syncfyCredentialHasProviderIssue).length
  const supportCredentialCount = syncfyCredentials.filter(syncfyCredentialNeedsSupport).length
  const verifyingCredentialCount = syncfyCredentials.length -
    connectedSyncfyCredentials.length -
    reconnectCredentialCount -
    providerIssueCredentialCount -
    supportCredentialCount
  const connectedInstitutionCount = connectedSyncfyCredentials.length
  const hasConnectedInstitution = connectedInstitutionCount > 0
  const hasReconnectRequiredCredential = reconnectCredentialCount > 0
  const hasProviderIssueCredential = providerIssueCredentialCount > 0
  const hasSupportIssueCredential = supportCredentialCount > 0
  const hasVerifyingCredential = verifyingCredentialCount > 0
  const hasUnresolvedCredential = hasReconnectRequiredCredential ||
    hasProviderIssueCredential ||
    hasSupportIssueCredential ||
    hasVerifyingCredential
  const connectActionLabel = hasReconnectRequiredCredential
    ? 'Actualizar acceso'
    : hasUnresolvedCredential
      ? 'Revisar conexión'
      : 'Conectar cuenta'
  const transactions = data?.transactions || EMPTY_TRANSACTIONS
  const rawSummary = data?.summary || EMPTY_SUMMARY
  const summary = rawSummary.dataCoverage
    ? rawSummary
    : { ...rawSummary, dataCoverage: buildFinanceDataCoverage(transactions) }
  const profile = data?.profile || EMPTY_PROFILE
  const serverCategoryAnalysis = data?.categoryAnalysis || EMPTY_CATEGORY_ANALYSIS
  const insights = data?.insights || EMPTY_INSIGHTS
  const actionPlan = data?.actionPlan || EMPTY_ACTION_PLAN
  const hasTransactions = transactions.length > 0
  const chatTransactions: AnalysisTransaction[] = transactions
  const chatSummary = summary
  const chatProfile = profile.email ? profile : { ...profile, email: activeEmail || profile.email }
  const latestCurrency = transactions[0]?.currency || DEFAULT_FINANCE_CURRENCY
  const chatCurrency = chatProfile.currency || chatTransactions[0]?.currency || latestCurrency
  const incomeGuidance = buildDashboardIncomeGuidance(chatSummary, chatProfile)
  const effectiveMonthlyIncome = incomeGuidance.effectiveMonthlyIncome || 0
  const effectiveNetBalance = effectiveMonthlyIncome > 0
    ? Math.round((effectiveMonthlyIncome - chatSummary.monthlySpending) * 100) / 100
    : null
  const savedMonthlyBudget = chatProfile.monthlyBudget || 0
  const savedCategoryBudgetEntries = Object.entries(chatProfile.categoryBudgets || {})
    .filter(([, amount]) => amount > 0)
  const savedCategoryBudgetTotal = roundMoney(savedCategoryBudgetEntries.reduce((sum, [, amount]) => sum + amount, 0))
  const budgetCoveragePercent = savedMonthlyBudget > 0
    ? Math.round((savedCategoryBudgetTotal / savedMonthlyBudget) * 100)
    : null
  const budgetRunwayAmount = savedMonthlyBudget > 0
    ? roundMoney(savedMonthlyBudget - chatSummary.monthlySpending)
    : null
  const monthlyCategoryBreakdown = useMemo(
    () => getExpenseBreakdown(chatTransactions, chatSummary.month),
    [chatTransactions, chatSummary.month]
  )
  const allCategoryBreakdown = useMemo(
    () => getExpenseBreakdown(chatTransactions),
    [chatTransactions]
  )
  const fallbackCategoryAnalysis = useMemo(
    () => buildCategoryAnalysis(chatTransactions, chatSummary, chatProfile),
    [chatProfile, chatSummary, chatTransactions]
  )
  const baseCategoryAnalysis = data?.categoryAnalysis
    ? serverCategoryAnalysis
    : fallbackCategoryAnalysis
  const previousCategoryAnalysis = useMemo(
    () => baseCategoryAnalysis.previousPeriod
    ? buildCategoryAnalysis(chatTransactions, { ...chatSummary, month: baseCategoryAnalysis.previousPeriod }, chatProfile)
      : null,
    [baseCategoryAnalysis.previousPeriod, chatProfile, chatSummary, chatTransactions]
  )
  const selectedCategoryAnalysis = categoryPeriodFilter === 'previous'
    ? previousCategoryAnalysis || baseCategoryAnalysis
    : baseCategoryAnalysis
  const categoryBreakdown = categoryPeriodFilter === 'all'
    ? allCategoryBreakdown
    : selectedCategoryAnalysis.categories.map((item) => ({ category: item.category, total: item.amount }))
  const categoryBreakdownTotal = getBreakdownTotal(categoryBreakdown)
  const topAnalysisTransactions = getTopTransactions(chatTransactions, chatSummary.month)
  const dataModeLabel = hasTransactions ? 'Confirmado' : 'Sin datos'
  const cashflowChartData = useMemo(
    () => getDailyFlowChartData(chatTransactions, chatSummary.month),
    [chatTransactions, chatSummary.month]
  )
  const categoryChartData = useMemo(
    () => getCategoryChartData(categoryBreakdown, categoryBreakdownTotal),
    [categoryBreakdown, categoryBreakdownTotal]
  )
  const savingsChartData = useMemo(
    () => getSavingsChartData(monthlyCategoryBreakdown),
    [monthlyCategoryBreakdown]
  )
  const recurringChartData = useMemo(
    () => getRecurringChartData(chatSummary),
    [chatSummary]
  )
  const projectedSavingsValue = useMemo(
    () => getSavingsProjection(chatSummary),
    [chatSummary]
  )
  const hasChartData = chatTransactions.length > 0
  const categoryPageRows = categoryChartData
  const categoryPeriodLabel = categoryPeriodFilter === 'all'
    ? 'Todo el historial'
    : selectedCategoryAnalysis.periodLabel
  const categoryPageAdvice = categoryPeriodFilter === 'all'
    ? 'Vista histórica. Cambia a este mes para comparar contra presupuesto y mes anterior.'
    : selectedCategoryAnalysis.summaryAdvice
  const investmentCategoryAmount = roundMoney(
    categoryBreakdown.find((item) => item.category === INVESTMENT_CATEGORY)?.total || 0
  )
  const investmentCategoryBudget = categoryPeriodFilter === 'all'
    ? null
    : selectedCategoryAnalysis.categories.find((item) => item.category === INVESTMENT_CATEGORY)?.budget ||
      chatProfile.categoryBudgets[INVESTMENT_CATEGORY] ||
      null
  const investmentCategoryShare = categoryBreakdownTotal > 0
    ? Math.round((investmentCategoryAmount / categoryBreakdownTotal) * 100)
    : 0
  const investmentCategoryStatus = categoryPeriodFilter === 'all'
    ? 'unset'
    : getBudgetStatus(investmentCategoryAmount, investmentCategoryBudget)
  const investmentCategoryPrompt = investmentCategoryAmount > 0
    ? `Analiza mi categoría Inversión de ${categoryPeriodLabel}: ${formatCardCurrency(investmentCategoryAmount, chatCurrency)}. ¿Cómo la separo del gasto corriente y qué siguiente paso recomienda FinovAI?`
    : '¿Cómo uso la categoría Inversión para separar aportaciones de gasto normal y preparar una ruta de inversión?'
  const categoryBudgetLabel = selectedCategoryAnalysis.budgetTotal
    ? formatCardCurrency(selectedCategoryAnalysis.budgetTotal, chatCurrency)
    : 'Sin presupuesto'
  const categoryOverBudgetAmount = selectedCategoryAnalysis.budgetTotal
    ? selectedCategoryAnalysis.spendingTotal - selectedCategoryAnalysis.budgetTotal
    : 0
  const chatDataCoverageLabel = formatDataCoverage(chatSummary.dataCoverage)
  const chatDataCoverageQualifier = chatSummary.dataCoverage.preliminary
    ? 'Lectura preliminar'
    : 'Historial suficiente'

  return {
    transactionsQuery,
    credentialsQuery,
    householdQuery,
    setDashboardData,
    setSyncfyCredentialsCache,
    data,
    syncfyCredentials,
    householdInvites,
    isLoadingCredentials,
    credentialsReadyForEmail,
    credentialsFetchFailed,
    loadError,
    connectedSyncfyCredentials,
    reconnectCredentialCount,
    providerIssueCredentialCount,
    supportCredentialCount,
    verifyingCredentialCount,
    connectedInstitutionCount,
    hasConnectedInstitution,
    hasReconnectRequiredCredential,
    hasProviderIssueCredential,
    hasSupportIssueCredential,
    hasVerifyingCredential,
    hasUnresolvedCredential,
    connectActionLabel,
    transactions,
    rawSummary,
    summary,
    profile,
    serverCategoryAnalysis,
    insights,
    actionPlan,
    hasTransactions,
    chatTransactions,
    chatSummary,
    chatProfile,
    latestCurrency,
    chatCurrency,
    incomeGuidance,
    effectiveMonthlyIncome,
    effectiveNetBalance,
    savedMonthlyBudget,
    savedCategoryBudgetEntries,
    savedCategoryBudgetTotal,
    budgetCoveragePercent,
    budgetRunwayAmount,
    monthlyCategoryBreakdown,
    allCategoryBreakdown,
    fallbackCategoryAnalysis,
    baseCategoryAnalysis,
    previousCategoryAnalysis,
    selectedCategoryAnalysis,
    categoryBreakdown,
    categoryBreakdownTotal,
    topAnalysisTransactions,
    dataModeLabel,
    cashflowChartData,
    categoryChartData,
    savingsChartData,
    recurringChartData,
    projectedSavingsValue,
    hasChartData,
    categoryPageRows,
    categoryPeriodLabel,
    categoryPageAdvice,
    investmentCategoryAmount,
    investmentCategoryBudget,
    investmentCategoryShare,
    investmentCategoryStatus,
    investmentCategoryPrompt,
    categoryBudgetLabel,
    categoryOverBudgetAmount,
    chatDataCoverageLabel,
    chatDataCoverageQualifier,
  }
}
