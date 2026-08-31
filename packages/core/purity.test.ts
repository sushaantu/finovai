import { test, expect } from 'bun:test'
import { Glob } from 'bun'

const FORBIDDEN = [/\bwindow\./, /\bdocument\./, /\blocalStorage\b/, /\bsessionStorage\b/, /import\.meta\.env/]

test('core package contains no web-only globals', async () => {
  const root = new URL('./', import.meta.url).pathname
  const glob = new Glob('src/**/*.{ts,tsx}')
  let scanned = 0
  for await (const file of glob.scan(root)) {
    scanned += 1
    const text = await Bun.file(`${root}${file}`).text()
    for (const pattern of FORBIDDEN) {
      expect(pattern.test(text), `${file} matches ${pattern}`).toBe(false)
    }
  }
  expect(scanned).toBeGreaterThan(0)
})
