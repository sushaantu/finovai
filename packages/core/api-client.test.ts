import { test, expect } from 'bun:test'
import { createApiClient, ApiError } from './src/api-client'

function mockFetch(status: number, body: unknown, capture?: { url?: string; init?: RequestInit }) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    if (capture) { capture.url = String(url); capture.init = init }
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
}

const OK_DASHBOARD = { success: true, email: 'a@b.co', transactions: [], summary: {}, insights: [] }

test('prefixes baseUrl and sends auth headers + JSON content type', async () => {
  const capture: { url?: string; init?: RequestInit } = {}
  const client = createApiClient({
    baseUrl: 'https://api.example.com',
    getAuthHeaders: () => ({ 'X-FinovAI-Dashboard-Secret': 's3cret' }),
    fetchImpl: mockFetch(200, OK_DASHBOARD, capture),
  })
  await client.getTransactions('a@b.co')
  expect(capture.url).toBe('https://api.example.com/api/transactions?email=a%40b.co')
  const headers = capture.init?.headers as Record<string, string>
  expect(headers['X-FinovAI-Dashboard-Secret']).toBe('s3cret')
  expect(headers['Content-Type']).toBe('application/json')
})

test('empty baseUrl leaves relative paths untouched (web via Vite proxy)', async () => {
  const capture: { url?: string; init?: RequestInit } = {}
  const client = createApiClient({
    baseUrl: '',
    getAuthHeaders: () => ({}),
    fetchImpl: mockFetch(200, OK_DASHBOARD, capture),
  })
  await client.getTransactions('a@b.co')
  expect(capture.url).toBe('/api/transactions?email=a%40b.co')
})

test('non-ok response throws ApiError with worker message and body', async () => {
  const client = createApiClient({
    baseUrl: '',
    getAuthHeaders: () => ({}),
    fetchImpl: mockFetch(400, { error: 'Correo inválido' }),
  })
  const err = await client.signup('bad').catch((e) => e)
  expect(err).toBeInstanceOf(ApiError)
  expect(err.status).toBe(400)
  expect(err.message).toBe('Correo inválido')
  expect(err.body).toEqual({ error: 'Correo inválido' })
})

test('401 invokes onUnauthorized exactly once and still throws', async () => {
  let calls = 0
  const client = createApiClient({
    baseUrl: '',
    getAuthHeaders: () => ({}),
    onUnauthorized: () => { calls += 1 },
    fetchImpl: mockFetch(401, { error: 'Sesión expirada' }),
  })
  await expect(client.getHousehold('a@b.co')).rejects.toThrow('Sesión expirada')
  expect(calls).toBe(1)
})

test('non-401 errors do not invoke onUnauthorized', async () => {
  let calls = 0
  const client = createApiClient({
    baseUrl: '',
    getAuthHeaders: () => ({}),
    onUnauthorized: () => { calls += 1 },
    fetchImpl: mockFetch(500, { error: 'Boom' }),
  })
  await expect(client.getHousehold('a@b.co')).rejects.toThrow('Boom')
  expect(calls).toBe(0)
})

test('malformed error body falls back to generic Spanish message', async () => {
  const client = createApiClient({
    baseUrl: '',
    getAuthHeaders: () => ({}),
    fetchImpl: (async () => new Response('not json', { status: 500 })) as typeof fetch,
  })
  const err = await client.getTransactions('a@b.co').catch((e) => e)
  expect(err.message).toBe('Error de API')
})

test('saveManualTransaction posts the worker payload with email merged in', async () => {
  const capture: { url?: string; init?: RequestInit } = {}
  const client = createApiClient({
    baseUrl: '',
    getAuthHeaders: () => ({}),
    fetchImpl: mockFetch(200, OK_DASHBOARD, capture),
  })
  await client.saveManualTransaction('a@b.co', {
    date: '2026-08-31', type: 'expense', amount: '120.50', currency: 'MXN',
    category: 'Comida', description: 'Tacos', merchant: 'Local', notes: '',
  })
  expect(capture.url).toBe('/api/transactions/manual')
  expect(capture.init?.method).toBe('POST')
  expect(JSON.parse(String(capture.init?.body))).toEqual({
    email: 'a@b.co', date: '2026-08-31', type: 'expense', amount: '120.50', currency: 'MXN',
    category: 'Comida', description: 'Tacos', merchant: 'Local', notes: '',
  })
})

test('updateTransactionCategory and saveProfile use PATCH', async () => {
  const capture: { url?: string; init?: RequestInit } = {}
  const client = createApiClient({
    baseUrl: '', getAuthHeaders: () => ({}), fetchImpl: mockFetch(200, OK_DASHBOARD, capture),
  })
  await client.updateTransactionCategory('a@b.co', 'tx-1', 'Comida')
  expect(capture.init?.method).toBe('PATCH')
  expect(JSON.parse(String(capture.init?.body))).toEqual({ email: 'a@b.co', transactionId: 'tx-1', category: 'Comida' })

  await client.saveProfile('a@b.co', { currency: 'MXN', monthlyIncome: 1000, monthlyBudget: null, categoryBudgets: undefined })
  expect(capture.url).toBe('/api/profile')
  expect(capture.init?.method).toBe('PATCH')
  expect(JSON.parse(String(capture.init?.body))).toEqual({ email: 'a@b.co', currency: 'MXN', monthlyIncome: 1000, monthlyBudget: null })
})

test('deleteSyncfyCredential sends DELETE with a body', async () => {
  const capture: { url?: string; init?: RequestInit } = {}
  const client = createApiClient({
    baseUrl: '', getAuthHeaders: () => ({}), fetchImpl: mockFetch(200, { success: true, credentials: [] }, capture),
  })
  await client.deleteSyncfyCredential('a@b.co', 'cred-1')
  expect(capture.url).toBe('/api/syncfy/credential')
  expect(capture.init?.method).toBe('DELETE')
  expect(JSON.parse(String(capture.init?.body))).toEqual({ email: 'a@b.co', credentialId: 'cred-1' })
})

test('signup defaults redirectPath to /dashboard and forwards diagnosticData', async () => {
  const capture: { url?: string; init?: RequestInit } = {}
  const client = createApiClient({
    baseUrl: '', getAuthHeaders: () => ({}), fetchImpl: mockFetch(200, { success: true, email: 'a@b.co' }, capture),
  })
  await client.signup('a@b.co', { diagnosticData: '{"source":"hero"}' })
  expect(JSON.parse(String(capture.init?.body))).toEqual({
    email: 'a@b.co', redirectPath: '/dashboard', diagnosticData: '{"source":"hero"}',
  })
})
