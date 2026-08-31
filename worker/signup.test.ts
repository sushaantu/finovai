import { expect, test } from 'bun:test'
import worker from './index'
import {
  getDashboardChatModel,
  getProductChatModel,
} from './lib/ai'
import {
  extractSyncfyTransactions,
  getSyncfyJobStatusPaths,
  isSyncfyTransactionImportComplete,
  normalizeSyncfyTransaction,
} from './lib/ingest'
import {
  extractSyncfySiteMetadata,
  normalizeSignupEmail,
} from './lib/shared'
import {
  addSyncfyUserParamToEndpoint,
  buildNextSyncfyTransactionsPageEndpoint,
  buildSyncfyExternalId,
  buildSyncfyTransactionsPath,
  normalizeSyncfyRequestPath,
} from './lib/syncfy'
import {
  inferExpenseCategory,
  summarizeExpenses,
} from './routes/finance'

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

test('buildSyncfyTransactionsPath includes id_user and six-month transaction window', () => {
  const path = buildSyncfyTransactionsPath('cred-1', 'user-1', 0, {
    referenceDate: new Date('2026-06-07T12:34:56Z'),
  })
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)

  expect(pathname).toBe('/transactions')
  expect(params.get('id_user')).toBe('user-1')
  expect(params.get('id_credential')).toBe('cred-1')
  expect(params.get('dt_transaction_from')).toBe(String(Date.parse('2025-12-07T00:00:00Z') / 1000))
  expect(params.get('dt_transaction_to')).toBe(String(Date.parse('2026-06-07T12:34:56Z') / 1000))
  expect(params.get('limit')).toBe('500')
  expect(params.get('skip')).toBe('0')
  expect(params.get('order')).toBe('-dt_transaction')
})

test('addSyncfyUserParamToEndpoint adds id_user to webhook transaction endpoints', () => {
  expect(addSyncfyUserParamToEndpoint('/v1/transactions?id_credential=cred-1&limit=5&skip=0', 'user-1'))
    .toBe('/transactions?id_credential=cred-1&limit=5&skip=0&id_user=user-1')
  expect(addSyncfyUserParamToEndpoint('/transactions?id_user=user-1&id_credential=cred-1', 'user-2'))
    .toBe('/transactions?id_user=user-1&id_credential=cred-1')
})

test('buildNextSyncfyTransactionsPageEndpoint advances only when a page is full', () => {
  expect(buildNextSyncfyTransactionsPageEndpoint('/transactions?id_credential=cred-1&limit=500&skip=0', 500))
    .toBe('/transactions?id_credential=cred-1&limit=500&skip=500')
  expect(buildNextSyncfyTransactionsPageEndpoint('/transactions?id_credential=cred-1&limit=500&skip=500', 120))
    .toBeNull()
  expect(buildNextSyncfyTransactionsPageEndpoint('/transactions?id_credential=cred-1&limit=500&skip=4500', 500))
    .toBeNull()
})

test('getSyncfyJobStatusPaths reads widget job status links', () => {
  expect(getSyncfyJobStatusPaths({
    id_job: 'job-from-id',
    status: 'https://sync.paybook.com/v1/jobs/job-from-url/status',
  })).toEqual([
    '/jobs/job-from-url/status',
    '/jobs/job-from-id/status',
  ])
})

test('empty Syncfy transaction imports stay pending instead of completed', () => {
  expect(isSyncfyTransactionImportComplete({ fetched: 0, imported: 0, skipped: 0 })).toBe(false)
  expect(isSyncfyTransactionImportComplete({ fetched: 3, imported: 0, skipped: 3 })).toBe(false)
  expect(isSyncfyTransactionImportComplete({ fetched: 3, imported: 2, skipped: 1 })).toBe(true)
})

test('dashboard chat defaults to Claude Opus model slug', () => {
  expect(getDashboardChatModel({})).toBe('claude-opus-4-8')
  expect(getDashboardChatModel({ ANTHROPIC_CHAT_MODEL: 'claude-opus-4-7' })).toBe('claude-opus-4-7')
})

test('dashboard chat defaults compat Gateway to Claude Opus', () => {
  expect(getDashboardChatModel({
    CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT: 'https://gateway.ai.cloudflare.com/v1/account/default/compat/chat/completions',
  })).toBe('anthropic/claude-opus-4-7')
})

test('product chat model can be overridden for Anthropic', () => {
  expect(getProductChatModel({})).toBe('claude-opus-4-8')
  expect(getProductChatModel({ ANTHROPIC_CHAT_MODEL: 'claude-opus-4-7' })).toBe('claude-opus-4-7')
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

test('extractSyncfySiteMetadata resolves institution ids and ignores generic site names', () => {
  expect(extractSyncfySiteMetadata({
    id_site: '572930c4784806060f8b456b',
    id_site_organization: '572930c4784806060f8b456a',
    site: { name: 'Normal' },
  })).toEqual({
    syncfySiteId: '572930c4784806060f8b456b',
    syncfySiteOrganizationId: '572930c4784806060f8b456a',
    siteName: 'American Express',
  })

  expect(extractSyncfySiteMetadata({
    site_organization: {
      id_site_organization: 'org-1',
      name: 'Banco Demo',
    },
    site: { id_site: 'site-1', name: 'Normal' },
  })).toEqual({
    syncfySiteId: 'site-1',
    syncfySiteOrganizationId: 'org-1',
    siteName: 'Banco Demo',
  })

  expect(extractSyncfySiteMetadata({
    id_site: 'mx-site-1',
    site: { name: 'Personal' },
  })).toEqual({
    syncfySiteId: 'mx-site-1',
    syncfySiteOrganizationId: null,
    siteName: null,
  })

  expect(extractSyncfySiteMetadata({
    id_site: 'mx-site-2',
    site: { name: 'Token & captcha' },
  })).toEqual({
    syncfySiteId: 'mx-site-2',
    syncfySiteOrganizationId: null,
    siteName: null,
  })

  expect(extractSyncfySiteMetadata({
    id_site: 'mx-site-3',
    id_site_organization: 'mx-org-3',
    site: { name: 'Personal' },
    site_organization: { id_site_organization: 'mx-org-3', name: 'BBVA México' },
  })).toEqual({
    syncfySiteId: 'mx-site-3',
    syncfySiteOrganizationId: 'mx-org-3',
    siteName: 'BBVA México',
  })
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

test('normalizeSyncfyTransaction infers signed amount direction when provider omits category fields', () => {
  const deposit = normalizeSyncfyTransaction({
    id_transaction: 'txn-deposit',
    dt_transaction: 1772150400,
    description: 'SPEI RECIBIDO',
    amount: '2500',
    currency: 'MXN',
  }, 'cred-1', 0)
  const payment = normalizeSyncfyTransaction({
    id_transaction: 'txn-payment',
    dt_transaction: 1772150400,
    description: 'SU ABONO...GRACIAS',
    amount: '2500',
    currency: 'MXN',
    reference: 'cr-positive-SUABONO...GRACIAS-20260227',
  }, 'cred-1', 1)
  const withdrawal = normalizeSyncfyTransaction({
    id_transaction: 'txn-withdrawal',
    dt_transaction: 1772150400,
    description: 'DISPOS.EFECTIVO',
    amount: '-2500',
    currency: 'MXN',
  }, 'cred-1', 2)

  expect(deposit).toMatchObject({ type: 'income', category: 'Otro ingreso' })
  expect(payment).toMatchObject({ type: 'expense', category: 'Deuda' })
  expect(withdrawal).toMatchObject({ type: 'expense', category: 'Retiros' })
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
