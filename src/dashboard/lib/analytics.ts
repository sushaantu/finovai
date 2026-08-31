import {
  DISCRETIONARY_CATEGORIES,
  projectInvestmentContribution,
  type FinanceSummary,
} from '@finovai/core'
import type { AnalysisTransaction } from './types'
import { formatDate, formatShortMonth, getMonthRange, getShortChartLabel } from './format'
import { CHART_COLORS } from './styles'

export function getCategoryTrendChartData(
  transactions: AnalysisTransaction[],
  category: string,
  coverage: FinanceSummary['dataCoverage']
) {
  const totals = new Map<string, number>()
  const months = getMonthRange(coverage.firstMonth, coverage.lastMonth).slice(-7)

  for (const month of months) {
    totals.set(month, 0)
  }

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    if (transaction.category !== category) continue

    const month = transaction.date.slice(0, 7)
    if (!totals.has(month)) continue

    totals.set(month, (totals.get(month) || 0) + transaction.amount)
  }

  return months.map((month) => {
    const amount = Math.round((totals.get(month) || 0) * 100) / 100

    return {
      month,
      label: formatShortMonth(month),
      amount,
    }
  })
}

export function getExpenseBreakdown(transactions: AnalysisTransaction[], month?: string | null) {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    if (month && !transaction.date.startsWith(month)) continue
    totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amount)
  }

  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

export function getTopTransactions(transactions: AnalysisTransaction[], month: string) {
  return transactions
    .filter((transaction) => transaction.type === 'expense' && transaction.date.startsWith(month))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
}

export function getBreakdownTotal(breakdown: Array<{ total: number }>) {
  return Math.round(breakdown.reduce((sum, item) => sum + item.total, 0) * 100) / 100
}

export function getDailyFlowChartData(transactions: AnalysisTransaction[], month: string) {
  const totals = new Map<string, { date: string; label: string; income: number; spending: number; net: number }>()

  for (const transaction of transactions) {
    if (!transaction.date.startsWith(month)) continue
    const current = totals.get(transaction.date) || {
      date: transaction.date,
      label: formatDate(transaction.date),
      income: 0,
      spending: 0,
      net: 0,
    }

    if (transaction.type === 'income') current.income += transaction.amount
    else current.spending += transaction.amount
    current.net = current.income - current.spending
    totals.set(transaction.date, current)
  }

  return [...totals.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      ...item,
      income: Math.round(item.income * 100) / 100,
      spending: Math.round(item.spending * 100) / 100,
      net: Math.round(item.net * 100) / 100,
    }))
}

export function getCategoryChartData(breakdown: Array<{ category: string; total: number }>, monthlySpending: number) {
  const topCategories = breakdown.slice(0, 6)

  return topCategories.map((item, index) => ({
    category: item.category,
    label: getShortChartLabel(item.category, 16),
    amount: Math.round(item.total * 100) / 100,
    share: monthlySpending > 0 ? Math.round((item.total / monthlySpending) * 100) : 0,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }))
}

export function getSavingsChartData(breakdown: Array<{ category: string; total: number }>) {
  return breakdown
    .filter((item) => DISCRETIONARY_CATEGORIES.has(item.category))
    .slice(0, 4)
    .map((item, index) => ({
      category: item.category,
      label: getShortChartLabel(item.category, 14),
      amount: Math.round(item.total * 0.15 * 100) / 100,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }))
    .filter((item) => item.amount > 0)
}

export function getRecurringChartData(summary: FinanceSummary) {
  return summary.recurringExpenses.slice(0, 4).map((expense, index) => ({
    label: getShortChartLabel(expense.description, 16),
    description: expense.description,
    amount: Math.round(expense.amount * expense.count * 100) / 100,
    averageAmount: expense.amount,
    count: expense.count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }))
}

export function getSavingsProjection(summary: FinanceSummary) {
  return projectInvestmentContribution(summary.estimatedSavingsOpportunity).tenYearValue
}
