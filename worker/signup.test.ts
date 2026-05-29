import { expect, test } from 'bun:test'
import {
  buildSyncfyExternalId,
  extractSyncfyTransactions,
  inferExpenseCategory,
  normalizeSyncfyRequestPath,
  normalizeSyncfyTransaction,
  normalizeSignupEmail,
  summarizeExpenses,
} from './index'

test('normalizeSignupEmail normalizes valid email addresses', () => {
  expect(normalizeSignupEmail('  USER@Example.COM  ')).toBe('user@example.com')
})

test('normalizeSignupEmail rejects invalid email addresses', () => {
  expect(normalizeSignupEmail('not-an-email')).toBeNull()
  expect(normalizeSignupEmail('missing-domain@')).toBeNull()
  expect(normalizeSignupEmail(undefined)).toBeNull()
})

test('buildSyncfyExternalId scopes external ids to FinovAI', () => {
  expect(buildSyncfyExternalId('user@example.com')).toBe('finovai:user@example.com')
})

test('normalizeSyncfyRequestPath accepts webhook and direct endpoint paths', () => {
  expect(normalizeSyncfyRequestPath('/v1/transactions?id_credential=abc')).toBe('/transactions?id_credential=abc')
  expect(normalizeSyncfyRequestPath('transactions?id_credential=abc')).toBe('/transactions?id_credential=abc')
  expect(normalizeSyncfyRequestPath('https://sync.paybook.com/v1/transactions?id_credential=abc')).toBe('/transactions?id_credential=abc')
})

test('extractSyncfyTransactions reads common wrapped response shapes', () => {
  expect(extractSyncfyTransactions({
    response: {
      transactions: [
        { id_transaction: 'txn-1' },
        { id_transaction: 'txn-2' },
      ],
    },
  })).toHaveLength(2)
})

test('normalizeSyncfyTransaction maps Syncfy transaction into finance shape', () => {
  const transaction = normalizeSyncfyTransaction({
    id_transaction: 'txn-1',
    dt_transaction: 1772150400,
    description: 'DLO*UBER EATS',
    amount: '251.81',
    currency: 'MXN',
    type: 'debit',
  }, 'cred-1', 0)

  expect(transaction).toMatchObject({
    id: 'syncfy:txn-1',
    date: '2026-02-27',
    type: 'expense',
    amount: 251.81,
    currency: 'MXN',
    category: 'Comida fuera',
  })
})

test('summarizeExpenses returns dashboard totals', () => {
  const summary = summarizeExpenses([
    { id: '1', date: '2026-04-01', description: 'Netflix', amount: 200, category: 'Suscripciones', merchant: 'Netflix' },
    { id: '2', date: '2026-04-02', description: 'Super', amount: 500, category: 'Supermercado', merchant: 'La Comer' },
    { id: '3', date: '2026-04-03', description: 'Spotify', amount: 100, category: 'Suscripciones', merchant: 'Spotify' },
    { id: '4', date: '2026-04-04', description: 'Deposito', amount: -1000, category: 'Ingreso', merchant: 'Nomina' },
  ])

  expect(summary.totalSpent).toBe(800)
  expect(summary.transactionCount).toBe(4)
  expect(summary.topCategory).toBe('Supermercado')
  expect(summary.savingsOpportunity).toBe(150)
})

test('inferExpenseCategory handles common merchant descriptions', () => {
  expect(inferExpenseCategory('Uber trip')).toBe('Transporte')
  expect(inferExpenseCategory('Walmart compra')).toBe('Supermercado')
})
