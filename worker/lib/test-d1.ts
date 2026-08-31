/// <reference types="bun" />
// worker/lib/test-d1.ts — test-only D1 adapter over bun:sqlite.
//
// Exposes the exact surface Workers D1 gives us (`prepare(sql).bind(...).run()/first()/all()`,
// plus `batch()` and `exec()`) on top of a real in-memory SQLite database loaded from the real
// `worker/schema.sql`. Tests therefore execute the same SQL the Worker sends to D1, instead of
// the string-matching mock this replaced.
//
// Not imported by any runtime path — only tests pull this in.
import { Database } from 'bun:sqlite'

type Bound = unknown[]

export interface TestD1Meta {
  changes: number
  last_row_id: number
  duration: number
  rows_read: number
  rows_written: number
}

export interface TestD1Result<T> {
  results: T[]
  success: true
  meta: TestD1Meta
}

function normalize(sql: string): string {
  // D1 accepts double-quoted string literals like datetime("now"). SQLite only treats them as
  // identifiers when they resolve to one, and bun:sqlite is built with the same double-quoted
  // string fallback enabled, so these pass through untouched. Verified by the adapter smoke test.
  return sql
}

function meta(changes = 0, lastRowId = 0): TestD1Meta {
  return {
    changes,
    last_row_id: lastRowId,
    duration: 0,
    rows_read: 0,
    rows_written: changes,
  }
}

export function createTestDb(schemaSql: string) {
  const sqlite = new Database(':memory:')
  // D1 enforces foreign key constraints; bare SQLite defaults them off. Without this, the FKs
  // schema.sql declares (transactions.email, household_invites.inviter_email → financial_profiles)
  // would be checked in production but not in tests.
  sqlite.exec('PRAGMA foreign_keys = ON')
  sqlite.exec(schemaSql)

  const db = {
    prepare(sql: string) {
      const stmt = () => sqlite.query(normalize(sql))

      const make = (params: Bound) => ({
        async run() {
          // D1 surfaces affected-row counts through `meta.changes`; production code reads it
          // (see `worker/lib/syncfy.ts` deletedTransactions and `worker/routes/finance.ts`
          // updatedCount), so the adapter has to report real numbers.
          const result = stmt().run(...(params as never[]))
          return {
            success: true as const,
            results: [],
            meta: meta(Number(result.changes || 0), Number(result.lastInsertRowid || 0)),
          }
        },
        async first<T>(): Promise<T | null> {
          return (stmt().get(...(params as never[])) ?? null) as T | null
        },
        async all<T>(): Promise<TestD1Result<T>> {
          return {
            results: stmt().all(...(params as never[])) as T[],
            success: true as const,
            meta: meta(),
          }
        },
      })

      return { bind: (...params: Bound) => make(params), ...make([]) }
    },
    async batch(statements: Array<{ run(): Promise<unknown> }>) {
      const out: unknown[] = []
      for (const statement of statements) out.push(await statement.run())
      return out
    },
    async exec(sql: string) {
      sqlite.exec(normalize(sql))
      return { count: 0, duration: 0 }
    },
  }

  return { db, sqlite }
}

let cachedSchema: string | null = null

export async function loadSchema(): Promise<string> {
  if (cachedSchema === null) {
    cachedSchema = await Bun.file(new URL('../schema.sql', import.meta.url).pathname).text()
  }
  return cachedSchema
}
