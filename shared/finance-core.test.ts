import { expect, test } from 'bun:test'

import {
  buildCategoryAnalysis,
  buildDashboardDebtGate,
  buildFinancialSummary,
  DEFAULT_FINANCE_CURRENCY,
  EXPENSE_CATEGORIES,
  type FinanceTransaction,
} from './finance-core'

test('finance core uses the FinovAI MXN category model', () => {
  expect(DEFAULT_FINANCE_CURRENCY).toBe('MXN')
  expect(EXPENSE_CATEGORIES).toContain('Deuda')
  expect(EXPENSE_CATEGORIES).toContain('Inversión')
})

test('finance core computes summary, budget analysis, and debt gate from one source', () => {
  const transactions = [
    transaction('2026-05-01', 'income', 100000, 'Sueldo', 'Nomina'),
    transaction('2026-05-02', 'expense', 43000, 'Deuda', 'AMERICAN EXPRESS pago minimo'),
    transaction('2026-05-03', 'expense', 12000, 'Comida fuera', 'Restaurante'),
    transaction('2026-04-03', 'expense', 5000, 'Comida fuera', 'Restaurante'),
  ]
  const profile = {
    email: 'user@example.com',
    currency: 'MXN',
    monthlyIncome: 100000,
    monthlyBudget: 65000,
    categoryBudgets: {
      Deuda: 30000,
      'Comida fuera': 8000,
    },
  }

  const summary = buildFinancialSummary(transactions)
  const analysis = buildCategoryAnalysis(transactions, summary, profile)
  const debtGate = buildDashboardDebtGate(summary, transactions, profile.monthlyIncome)

  expect(summary.month).toBe('2026-05')
  expect(summary.estimatedSavingsOpportunity).toBe(1200)
  expect(analysis.categories[0]).toMatchObject({
    category: 'Deuda',
    amount: 43000,
    budget: 30000,
    budgetStatus: 'over',
  })
  expect(debtGate.active).toBe(true)
  expect(debtGate.debtShareOfIncome).toBe(43)
})

function transaction(
  date: string,
  type: 'income' | 'expense',
  amount: number,
  category: string,
  description: string
): FinanceTransaction {
  return {
    id: `${date}-${category}`,
    email: 'user@example.com',
    date,
    type,
    amount,
    currency: 'MXN',
    category,
    description,
    merchant: description,
    notes: null,
    source: 'syncfy',
    confidence: 1,
    rawSource: null,
    cartolaImportId: null,
    created_at: `${date}T00:00:00.000Z`,
  }
}
