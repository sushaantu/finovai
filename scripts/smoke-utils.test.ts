import { afterEach, expect, test } from 'bun:test'

import {
  asRecord,
  booleanField,
  numberField,
  requestJson,
  stringField,
} from './smoke-utils'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('record helpers return safe primitive fields', () => {
  const record = asRecord({
    name: 'FinovAI',
    count: 3,
    enabled: true,
    nested: { value: 'ignored' },
  })

  expect(asRecord(null)).toEqual({})
  expect(asRecord(['x'])).toEqual({})
  expect(stringField(record, 'name')).toBe('FinovAI')
  expect(stringField(record, 'count')).toBe('')
  expect(numberField(record, 'count')).toBe(3)
  expect(numberField(record, 'name')).toBeNull()
  expect(booleanField(record, 'enabled')).toBe(true)
  expect(booleanField(record, 'missing')).toBe(false)
})

test('requestJson sends json headers and parses json responses', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({ ok: true, name: 'smoke' }), { status: 202 })
  }) as typeof fetch

  const response = await requestJson('https://api.example.test', '/health', {
    method: 'POST',
    body: JSON.stringify({ ping: true }),
  }, 1_000)

  expect(response).toEqual({ status: 202, data: { ok: true, name: 'smoke' } })
  expect(calls[0].url).toBe('https://api.example.test/health')
  expect(calls[0].init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
  expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal)
})
