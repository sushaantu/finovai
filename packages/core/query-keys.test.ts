import { test, expect } from 'bun:test'
import { queryKeys } from './src/react/keys'

test('query keys are namespaced per user email', () => {
  expect(queryKeys.transactions('a@b.co')).toEqual(['transactions', 'a@b.co'])
  expect(queryKeys.syncfyCredentials('a@b.co')).toEqual(['syncfyCredentials', 'a@b.co'])
  expect(queryKeys.household('a@b.co')).toEqual(['household', 'a@b.co'])
})

test('different users get different cache keys', () => {
  expect(queryKeys.transactions('a@b.co')).not.toEqual(queryKeys.transactions('c@d.co'))
})
