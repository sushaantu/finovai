import { expect, test } from 'bun:test'

test('runtime transaction schema keeps MXN as the default currency', async () => {
  const workerSource = await Bun.file('worker/lib/db.ts').text()
  const schemaSource = await Bun.file('worker/schema.sql').text()

  expect(schemaSource).toContain("currency TEXT NOT NULL DEFAULT 'MXN'")
  expect(workerSource).not.toContain("currency TEXT NOT NULL DEFAULT 'CLP'")
  expect(workerSource).toContain("currency TEXT NOT NULL DEFAULT 'MXN'")
})
