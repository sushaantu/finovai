# Worker Reduction and Connection Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink `worker/index.ts` (7,511 lines) into a small, modular, tested worker with a real bank-connection lifecycle, stable user IDs, and a daily health alert, before mobile app development starts.

**Architecture:** Single Cloudflare Worker + D1 (unchanged deployment). The monolith is split into `routes/`, `lib/`, and `cron.ts`. Connection state becomes a six-state machine (`pending → healthy | degraded | broken | needs_user | abandoned`) written only by `transitionConnection()` in `lib/lifecycle.ts`. Polling is the sole writer of state; webhooks only schedule polls. Tests run against real in-memory SQLite via a thin D1 adapter.

**Tech Stack:** Bun (test runner, tooling), TypeScript, Cloudflare Workers, D1 (SQLite), `bun:sqlite` for tests, Cloudflare Email Sending for alerts.

**Spec:** `docs/superpowers/specs/2026-08-30-worker-reduction-and-connection-lifecycle-design.md`

## Global Constraints

- Use Bun for everything: `bun test`, `bun run <script>`, `bunx`. Never npm/node/vitest.
- No new npm dependencies. `bun:sqlite` is built in.
- All user-facing copy is Spanish (match existing tone in `worker/index.ts` messages).
- All wrangler/production commands run via `direnv exec /Users/sushaantu/Developer -- wrangler ...` (personal Cloudflare account). Never paste tokens.
- Production D1 database: `finovai-db` (id `f618ec3b-b453-49dd-b16a-b4a5a2778314`). Any `--remote` command that writes must be reviewed by the user first; read-only SELECTs are fine.
- Line numbers cited below are from the pre-change tree and will shift after Task 1. Always locate code by symbol name (`rg -n "functionName" worker/`), not by line.
- Existing credential `status` values (kept during transition, replaced in Task 7): `synced`, `pending_transactions`, `needs_reconnect`, `provider_unavailable`, `sync_error`.
- After every task: `bun test` passes and `bunx tsc -p worker/tsconfig.json --noEmit` passes. Commit at the end of every task.

---

### Task 1: Delete legacy phone/quiz/conversations code and legacy chat

**Files:**
- Modify: `worker/index.ts`
- Modify: `worker/signup.test.ts` (remove tests for deleted helpers)
- Modify: `worker/finance.test.ts` (remove MockD1 members/tests for deleted areas, if any)

**Interfaces:**
- Consumes: nothing.
- Produces: a worker with only email auth, Syncfy, finance, and cartola code (cartola dies in Task 2). No route under `/api/auth/send-otp`, `/api/auth/verify-otp`, `/api/auth/me`, `/api/auth/logout`, `/api/users/me`, `/api/conversations*`, `/api/chat`.

- [ ] **Step 1: Inventory the deletion set**

Run each and note the symbols found (they are the deletion worklist):

```bash
rg -n "send-otp|verify-otp|/api/users/me|/api/conversations|'/api/chat'" worker/index.ts
rg -n "otp_verifications|INSERT INTO users|INSERT INTO sessions|conversations|messages|couples|chat_sessions" worker/index.ts
```

- [ ] **Step 2: Delete the route branches**

In `handleAPI` (search `async function handleAPI`), delete the branches handling: `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `GET /api/auth/me`, `POST /api/auth/logout`, `PATCH /api/users/me`, `GET|POST /api/conversations`, the regex-matched `/api/conversations/:id/messages`, and `POST /api/chat` (legacy product chat — NOT `/api/dashboard/chat`, which stays).

- [ ] **Step 3: Delete the now-unreferenced implementations**

Delete every function/type only reachable from those branches: WhatsApp OTP send/verify helpers, phone-session helpers reading `sessions`/`users`, quiz/conversation message handlers, the legacy chat system prompt and its `runAIResponse` call site (keep `runAIResponse` itself — dashboard chat uses the Anthropic helpers). Verify nothing dangles:

```bash
bunx tsc -p worker/tsconfig.json --noEmit
rg -n "otp_verifications|conversation_participants|chat_sessions" worker/index.ts   # expect: no matches
```

- [ ] **Step 4: Delete tests for deleted code**

In `worker/signup.test.ts`, remove the "legacy chat models" tests (search `describe` blocks touching chat model selection for `/api/chat`). Remove any `worker/finance.test.ts` tests that call deleted routes.

- [ ] **Step 5: Run tests, verify pass**

Run: `bun test`
Expected: PASS (all remaining suites).

- [ ] **Step 6: Commit**

```bash
git add -A worker/ && git commit -m "Delete legacy phone auth, quiz/conversations, and legacy chat"
```

---

### Task 2: Delete cartola import

**Files:**
- Modify: `worker/index.ts` (parsers ~4682–5148 pre-shift; routes `POST /api/cartola/import`, `POST /api/cartola/confirm`)
- Modify: `src/components/Dashboard.tsx` (remove cartola upload UI and fetches to `/api/cartola/*`)
- Modify: `worker/finance.test.ts` (remove cartola tests and `imports` member of MockD1)

**Interfaces:**
- Consumes: Task 1 complete.
- Produces: `transactions.source` effectively only `manual` | `syncfy` (the CHECK constraint still allows `cartola`; rows keep historical values — do not migrate data).

- [ ] **Step 1: Delete worker cartola code**

Delete the two `handleAPI` branches for `/api/cartola/import` and `/api/cartola/confirm`, then every parser reachable only from them (search `rg -n "cartola" worker/index.ts` — delete all except the `transactions.source` CHECK string and `cartola_imports` DDL in `ensureFinanceTables`, which dies in Task 10).

- [ ] **Step 2: Delete frontend cartola UI**

```bash
rg -n "cartola" src/
```
Remove the upload component/section and its state from `Dashboard.tsx`. Keep the manual-transaction UI.

- [ ] **Step 3: Delete cartola tests, run everything**

Run: `bun test && bunx tsc -p worker/tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A worker/ src/ && git commit -m "Delete cartola statement import (feature retired)"
```

---

### Task 3: Mechanical module split

**Files:**
- Create: `worker/routes/auth.ts`, `worker/routes/syncfy.ts`, `worker/routes/finance.ts`
- Create: `worker/lib/syncfy.ts`, `worker/lib/ingest.ts`, `worker/lib/db.ts`, `worker/lib/ai.ts`, `worker/lib/shared.ts`
- Create: `worker/cron.ts`
- Modify: `worker/index.ts` (entry only)

**Interfaces:**
- Consumes: Tasks 1–2 complete (file is ~5,000 lines).
- Produces: `worker/index.ts` exports `default { fetch, scheduled }` only. Every moved symbol keeps its exact name and signature; route modules export `handleAuthRoutes(request, env, url)`, `handleSyncfyRoutes(request, env, url, ctx)`, `handleFinanceRoutes(request, env, url)`, each returning `Promise<Response | null>` (null = not my route). `worker/cron.ts` exports `runScheduled(env: Env): Promise<void>`.

Move map (locate by symbol, move with imports intact, zero behavior change):

| Destination | Symbols |
| --- | --- |
| `lib/shared.ts` | `Env` + shared types/constants, `normalizeSignupEmail`, `timingSafeStringEqual`, `verifyDashboardEmailAccess`, `verifySupportAdminAccess`, `upsertLead`, `escapeHtml` |
| `lib/ai.ts` | model selection + `runAIResponse` and Anthropic/AI-Gateway helpers (~479–843) |
| `lib/db.ts` | `ensureSyncfyTables`, `ensureFinanceTables`, other DDL/query helpers |
| `lib/syncfy.ts` | Syncfy HTTP client, `SyncfyRequestError`, request/parse/extract helpers, `fetchSyncfyCredentialHealth`, `classifySyncfyCredentialBlocker`, `classifySyncfyConnectionIssue`, `buildSyncfyRecoveryExternalId`, session/user/reset helpers |
| `lib/ingest.ts` | `importSyncfyTransactionsForCredential`, `importSyncfyTransactionsFromEndpoints`, upsert + job-status + pull helpers, `resolveSyncfyTransactionImportState`, `markSyncfyCredential*` (all four), `storeSyncfyError`, `isSyncfyBackgroundRefreshDue`, `isSyncfyProviderPullRetryDue`, `loadDueSyncfyCredentials` |
| `cron.ts` | `refreshDueSyncfyCredentials`, new `runScheduled` wrapper |
| `routes/auth.ts` | signup, `request-link`, `verify`, `sendDashboardLoginEmail`, `buildLoginLink`, dashboard-session helpers |
| `routes/syncfy.ts` | all `/api/syncfy/*` + `/api/admin/syncfy` branches, `processSyncfyWebhookEvent`, `verifySyncfySecret`, `getSyncfySecretFromRequest` |
| `routes/finance.ts` | transactions/profile/dashboard-chat/household branches + finance domain helpers (~3914–4681), `/api/expenses` |

- [ ] **Step 1: Create `lib/` modules and move symbols per the map** (keep `export` on everything already exported; add `export` where cross-module use requires it)

- [ ] **Step 2: Create route modules; `handleAPI` becomes a 3-line chain**

```ts
// worker/index.ts (target shape)
import { handleAuthRoutes } from './routes/auth'
import { handleSyncfyRoutes } from './routes/syncfy'
import { handleFinanceRoutes } from './routes/finance'
import { runScheduled } from './cron'
import type { Env } from './lib/shared'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 })
    const response =
      (await handleAuthRoutes(request, env, url)) ??
      (await handleSyncfyRoutes(request, env, url, ctx)) ??
      (await handleFinanceRoutes(request, env, url))
    return response ?? new Response('Not found', { status: 404 })
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduled(env))
  },
}
```

Preserve the existing `GET /api/health` branch (move into `routes/finance.ts` for now; Task 8 rewrites it). Re-export moved test-visible symbols from `worker/index.ts` temporarily if tests import them from there, OR update test imports — prefer updating test imports.

- [ ] **Step 3: Typecheck, run tests**

Run: `bunx tsc -p worker/tsconfig.json --noEmit && bun test`
Expected: PASS. If a test imported from `./index`, point it at the new module.

- [ ] **Step 4: Verify no file exceeds ~1,200 lines**

Run: `wc -l worker/index.ts worker/cron.ts worker/routes/*.ts worker/lib/*.ts`

- [ ] **Step 5: Commit**

```bash
git add -A worker/ && git commit -m "Split worker monolith into routes/, lib/, and cron modules"
```

---

### Task 4: Test harness — real SQLite behind the D1 interface

**Files:**
- Create: `worker/lib/test-d1.ts`
- Modify: `worker/finance.test.ts` (replace `MockD1` usage)
- Delete: `worker/schema-drift.test.ts`

**Interfaces:**
- Consumes: `worker/schema.sql`.
- Produces: `createTestDb(): { db: D1Like, sqlite: Database }` where `D1Like` implements `prepare(sql).bind(...).run()/first()/all()` exactly as Workers D1 does. All subsequent tasks' tests use it.

- [ ] **Step 1: Write the adapter**

```ts
// worker/lib/test-d1.ts — test-only D1 adapter over bun:sqlite
import { Database } from 'bun:sqlite'

type Bound = (string | number | null)[]

function normalize(sql: string): string {
  // D1 accepts double-quoted string literals like datetime("now"); SQLite strict mode treats
  // them as identifiers only when they don't resolve — bun:sqlite accepts them, so pass through.
  return sql
}

export function createTestDb(schemaSql: string) {
  const sqlite = new Database(':memory:')
  sqlite.exec(schemaSql)

  const db = {
    prepare(sql: string) {
      const stmt = () => sqlite.query(normalize(sql))
      const make = (params: Bound) => ({
        async run() {
          stmt().run(...params)
          return { success: true, meta: {} }
        },
        async first<T>() {
          return (stmt().get(...params) ?? null) as T | null
        },
        async all<T>() {
          return { results: stmt().all(...params) as T[], success: true, meta: {} }
        },
      })
      return { bind: (...params: Bound) => make(params), ...make([]) }
    },
    async batch(statements: { run(): Promise<unknown> }[]) {
      for (const s of statements) await s.run()
      return []
    },
    async exec(sql: string) {
      sqlite.exec(sql)
      return { count: 0, duration: 0 }
    },
  }
  return { db, sqlite }
}

export async function loadSchema(): Promise<string> {
  return await Bun.file(new URL('../schema.sql', import.meta.url).pathname).text()
}
```

- [ ] **Step 2: Write a smoke test for the adapter itself**

```ts
// in worker/finance.test.ts (top, or a new describe block)
import { createTestDb, loadSchema } from './lib/test-d1'

test('test-d1 adapter runs real schema and round-trips a row', async () => {
  const { db } = createTestDb(await loadSchema())
  await db.prepare(`INSERT INTO leads (email, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))`)
    .bind('a@b.co').run()
  const row = await db.prepare('SELECT email FROM leads WHERE email = ?').bind('a@b.co').first<{ email: string }>()
  expect(row?.email).toBe('a@b.co')
})
```

Run: `bun test worker/finance.test.ts -t "test-d1 adapter"`
Expected: PASS.

- [ ] **Step 3: Port `finance.test.ts` off MockD1**

Replace `new MockD1()` construction with `createTestDb(await loadSchema()).db` in the env fixture. Fix tests that relied on MockD1's in-memory Maps for assertions: assert via SELECTs instead (e.g. `db.prepare('SELECT status FROM syncfy_credentials WHERE syncfy_credential_id = ?')`). Delete the `MockD1` class once no test references it. Expect this to surface real-SQL bugs in tests (not in prod code) — fix the tests.

Run: `bun test`
Expected: PASS.

- [ ] **Step 4: Delete `worker/schema-drift.test.ts`** (redundant — schema.sql is now loaded directly)

- [ ] **Step 5: Commit**

```bash
git add -A worker/ && git commit -m "Replace string-matching MockD1 with real SQLite test adapter"
```

---

### Task 5: Identity — users table, backfill, versioned Syncfy external ID

**Files:**
- Create: `worker/migrations/2026-08-31-users-identity.sql`
- Modify: `worker/schema.sql` (replace old `users`/`sessions` DDL with the new `users` DDL; delete `sessions`, `otp_verifications`, `couples`, `conversations`, `conversation_participants`, `messages`, `chat_sessions` DDL)
- Modify: `worker/lib/db.ts` (add `getOrCreateUserByEmail`)
- Modify: `worker/lib/syncfy.ts` (`buildSyncfyRecoveryExternalId` replacement)
- Test: `worker/finance.test.ts`

**Interfaces:**
- Consumes: Task 4 adapter.
- Produces: `getOrCreateUserByEmail(db: D1Database, email: string): Promise<{ id: string; email: string; syncfy_identity_version: number }>` and `buildSyncfyExternalId(userId: string, version: number): string` returning `finovai:user:{id}:v{n}`.

- [ ] **Step 1: Write the migration**

```sql
-- worker/migrations/2026-08-31-users-identity.sql
-- Legacy users/sessions are empty in production; safe to rebuild.
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS sessions;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  syncfy_identity_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE transactions ADD COLUMN user_id TEXT;
ALTER TABLE syncfy_credentials ADD COLUMN user_id TEXT;
ALTER TABLE syncfy_errors ADD COLUMN user_id TEXT;
ALTER TABLE syncfy_users ADD COLUMN user_id TEXT;
ALTER TABLE financial_profiles ADD COLUMN user_id TEXT;
ALTER TABLE dashboard_sessions ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_syncfy_credentials_user ON syncfy_credentials(user_id);
```

Mirror the same changes in `worker/schema.sql` (new-install shape) and in the runtime DDL in `lib/db.ts` (`ensureFinanceTables`/`ensureSyncfyTables`).

- [ ] **Step 2: Write failing tests**

```ts
test('getOrCreateUserByEmail is idempotent and normalizes email', async () => {
  const { db } = createTestDb(await loadSchema())
  const a = await getOrCreateUserByEmail(db, 'Foo@Bar.com ')
  const b = await getOrCreateUserByEmail(db, 'foo@bar.com')
  expect(a.id).toBe(b.id)
  expect(a.syncfy_identity_version).toBe(1)
})

test('buildSyncfyExternalId encodes user id and version', () => {
  expect(buildSyncfyExternalId('u-123', 3)).toBe('finovai:user:u-123:v3')
})
```

Run: `bun test -t "getOrCreateUserByEmail"` — Expected: FAIL (not defined).

- [ ] **Step 3: Implement**

```ts
// worker/lib/db.ts
import { normalizeSignupEmail } from './shared'

export async function getOrCreateUserByEmail(
  db: D1Database,
  rawEmail: string
): Promise<{ id: string; email: string; syncfy_identity_version: number }> {
  const email = normalizeSignupEmail(rawEmail)
  const existing = await db
    .prepare('SELECT id, email, syncfy_identity_version FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; email: string; syncfy_identity_version: number }>()
  if (existing) return existing
  const id = crypto.randomUUID()
  await db
    .prepare(`INSERT INTO users (id, email) VALUES (?, ?)
              ON CONFLICT(email) DO NOTHING`)
    .bind(id, email)
    .run()
  return (await db
    .prepare('SELECT id, email, syncfy_identity_version FROM users WHERE email = ?')
    .bind(email)
    .first())!
}
```

```ts
// worker/lib/syncfy.ts
export function buildSyncfyExternalId(userId: string, version: number): string {
  return `finovai:user:${userId}:v${version}`
}
```

Replace the body of the reset path that called `buildSyncfyRecoveryExternalId(email)`: it now calls `getOrCreateUserByEmail`, increments `syncfy_identity_version` (`UPDATE users SET syncfy_identity_version = syncfy_identity_version + 1 WHERE id = ?`), and uses `buildSyncfyExternalId`. Keep `buildSyncfyRecoveryExternalId` deleted — grep to confirm no references. Existing credentials keep their stored external IDs; only new sessions/resets use the new format. Call `getOrCreateUserByEmail` from signup, login-verify, and Syncfy session creation, writing `user_id` onto rows those paths insert (`dashboard_sessions`, `syncfy_users`, `syncfy_credentials`, `transactions` inserts in `lib/ingest.ts`).

- [ ] **Step 4: Run tests** — `bun test` — Expected: PASS.

- [ ] **Step 5: Production backfill (user reviews before running)**

Present these to the user, run only after approval, via:
`direnv exec /Users/sushaantu/Developer -- wrangler d1 execute finovai-db --remote --command "..."`

```sql
-- 1. apply migration file first (wrangler d1 execute --file)
-- 2. merge the typo BEFORE creating users rows:
UPDATE transactions SET email = 'mosoriom507@gmail.com' WHERE email = 'mosoriom507@gnail.com';
UPDATE syncfy_credentials SET email = 'mosoriom507@gmail.com' WHERE email = 'mosoriom507@gnail.com';
UPDATE syncfy_errors SET email = 'mosoriom507@gmail.com' WHERE email = 'mosoriom507@gnail.com';
UPDATE financial_profiles SET email = 'mosoriom507@gmail.com' WHERE email = 'mosoriom507@gnail.com';
DELETE FROM syncfy_users WHERE email = 'mosoriom507@gnail.com';
DELETE FROM leads WHERE email = 'mosoriom507@gnail.com';
-- 3. create users for every distinct real email (excludes codex-* test accounts):
INSERT INTO users (id, email)
SELECT lower(hex(randomblob(16))), email FROM (
  SELECT DISTINCT email FROM syncfy_users WHERE email NOT LIKE 'codex-%'
  UNION SELECT DISTINCT email FROM dashboard_sessions WHERE email NOT LIKE 'codex-%'
);
-- 4. backfill user_id everywhere:
UPDATE transactions       SET user_id = (SELECT id FROM users WHERE users.email = transactions.email);
UPDATE syncfy_credentials SET user_id = (SELECT id FROM users WHERE users.email = syncfy_credentials.email);
UPDATE syncfy_errors      SET user_id = (SELECT id FROM users WHERE users.email = syncfy_errors.email);
UPDATE syncfy_users       SET user_id = (SELECT id FROM users WHERE users.email = syncfy_users.email);
UPDATE financial_profiles SET user_id = (SELECT id FROM users WHERE users.email = financial_profiles.email);
UPDATE dashboard_sessions SET user_id = (SELECT id FROM users WHERE users.email = dashboard_sessions.email);
-- verify: SELECT COUNT(*) FROM users;  (expect ~11)
--         SELECT COUNT(*) FROM transactions WHERE user_id IS NULL; (expect 0)
```

- [ ] **Step 6: Commit**

```bash
git add -A worker/ && git commit -m "Add stable user IDs with versioned Syncfy external identity"
```

---

### Task 6: Lifecycle module (pure, fully unit-tested)

**Files:**
- Create: `worker/lib/lifecycle.ts`
- Create: `worker/lifecycle.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (exact names later tasks rely on):

```ts
export type ConnectionState = 'pending' | 'healthy' | 'degraded' | 'broken' | 'needs_user' | 'abandoned'
export type ConnectionEvent =
  | { type: 'sync_succeeded' }
  | { type: 'sync_failed'; statusCode: number | null; vendorCode: string | null; unmapped?: boolean }
  | { type: 'auth_required' }          // bad credentials / MFA
  | { type: 'user_reconnected' }
export interface ConnectionSnapshot {
  state: ConnectionState
  attemptCount: number
  firstFailedAt: string | null         // ISO
  lastSuccessfulSyncAt: string | null  // ISO
  createdAt: string                    // ISO
}
export interface TransitionResult {
  state: ConnectionState
  attemptCount: number
  firstFailedAt: string | null
  alerts: ('entered_broken' | 'unmapped_vendor_code')[]
}
export const BROKEN_AFTER_HOURS = 48
export const ABANDON_AFTER_DAYS = 14
export function transition(snapshot: ConnectionSnapshot, event: ConnectionEvent, now: Date): TransitionResult
export function classifyVendorFailure(statusCode: number | null, vendorMessage: string | null): ConnectionEvent
export function userFacingIssue(state: ConnectionState): { kind: string; title: string; message: string } | null
```

- [ ] **Step 1: Write the failing table-driven tests**

```ts
// worker/lifecycle.test.ts
import { test, expect } from 'bun:test'
import { transition, classifyVendorFailure, type ConnectionSnapshot } from './lib/lifecycle'

const at = (iso: string) => new Date(iso)
const snap = (over: Partial<ConnectionSnapshot>): ConnectionSnapshot => ({
  state: 'pending', attemptCount: 0, firstFailedAt: null,
  lastSuccessfulSyncAt: null, createdAt: '2026-08-01T00:00:00Z', ...over,
})

test('success from any state resets to healthy', () => {
  for (const state of ['pending', 'degraded', 'broken', 'needs_user', 'abandoned'] as const) {
    const r = transition(snap({ state, attemptCount: 9, firstFailedAt: '2026-08-01T00:00:00Z' }),
      { type: 'sync_succeeded' }, at('2026-08-20T00:00:00Z'))
    expect(r.state).toBe('healthy')
    expect(r.attemptCount).toBe(0)
    expect(r.firstFailedAt).toBeNull()
  }
})

test('never-succeeded failure under 48h stays pending', () => {
  const r = transition(snap({}), { type: 'sync_failed', statusCode: 400, vendorCode: null },
    at('2026-08-02T00:00:00Z')) // 24h after createdAt
  expect(r.state).toBe('pending')
  expect(r.attemptCount).toBe(1)
})

test('never-succeeded failure past 48h becomes broken and alerts once', () => {
  const first = transition(snap({}), { type: 'sync_failed', statusCode: 400, vendorCode: null },
    at('2026-08-04T00:00:00Z')) // 72h after createdAt
  expect(first.state).toBe('broken')
  expect(first.alerts).toContain('entered_broken')
  const again = transition(snap({ state: 'broken', attemptCount: 1, firstFailedAt: '2026-08-04T00:00:00Z' }),
    { type: 'sync_failed', statusCode: 400, vendorCode: null }, at('2026-08-05T00:00:00Z'))
  expect(again.state).toBe('broken')
  expect(again.alerts).not.toContain('entered_broken') // only on entry
})

test('healthy failure degrades; degraded stays degraded', () => {
  const r = transition(snap({ state: 'healthy', lastSuccessfulSyncAt: '2026-08-10T00:00:00Z' }),
    { type: 'sync_failed', statusCode: 500, vendorCode: null }, at('2026-08-11T00:00:00Z'))
  expect(r.state).toBe('degraded')
})

test('14 days of failure with no success abandons', () => {
  const r = transition(snap({ state: 'broken', attemptCount: 14, firstFailedAt: '2026-08-01T00:00:00Z' }),
    { type: 'sync_failed', statusCode: 400, vendorCode: null }, at('2026-08-16T00:00:00Z'))
  expect(r.state).toBe('abandoned')
})

test('auth_required forces needs_user from any active state', () => {
  for (const state of ['pending', 'healthy', 'degraded', 'broken'] as const) {
    const r = transition(snap({ state }), { type: 'auth_required' }, at('2026-08-10T00:00:00Z'))
    expect(r.state).toBe('needs_user')
  }
})

test('user_reconnected restarts the attempt window', () => {
  const r = transition(snap({ state: 'abandoned', attemptCount: 30, firstFailedAt: '2026-08-01T00:00:00Z' }),
    { type: 'user_reconnected' }, at('2026-08-20T00:00:00Z'))
  expect(r.state).toBe('pending')
  expect(r.attemptCount).toBe(0)
  expect(r.firstFailedAt).toBeNull()
})

test('classifyVendorFailure: BBVA 400 is sync_failed, not auth; 401 is auth; unknown code flags alert', () => {
  expect(classifyVendorFailure(400, "Credential can't be sync at this moment").type).toBe('sync_failed')
  expect(classifyVendorFailure(401, 'login rejected').type).toBe('auth_required')
  const unknown = classifyVendorFailure(402, 'Payment Required')
  expect(unknown.type).toBe('sync_failed') // still a failure...
  // ...and the transition must surface it:
  const r = transition(snap({}), unknown, at('2026-08-02T00:00:00Z'))
  expect(r.alerts).toContain('unmapped_vendor_code')
})
```

Run: `bun test worker/lifecycle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement `worker/lib/lifecycle.ts`**

```ts
export type ConnectionState = 'pending' | 'healthy' | 'degraded' | 'broken' | 'needs_user' | 'abandoned'
export type ConnectionEvent =
  | { type: 'sync_succeeded' }
  | { type: 'sync_failed'; statusCode: number | null; vendorCode: string | null; unmapped?: boolean }
  | { type: 'auth_required' }
  | { type: 'user_reconnected' }

export interface ConnectionSnapshot {
  state: ConnectionState
  attemptCount: number
  firstFailedAt: string | null
  lastSuccessfulSyncAt: string | null
  createdAt: string
}

export interface TransitionResult {
  state: ConnectionState
  attemptCount: number
  firstFailedAt: string | null
  alerts: ('entered_broken' | 'unmapped_vendor_code')[]
}

export const BROKEN_AFTER_HOURS = 48
export const ABANDON_AFTER_DAYS = 14

const HOUR_MS = 3_600_000
const KNOWN_FAILURE_CODES = new Set([400, 401, 403, 429, 500, 502, 503, 504])

export function transition(s: ConnectionSnapshot, event: ConnectionEvent, now: Date): TransitionResult {
  const alerts: TransitionResult['alerts'] = []

  if (event.type === 'sync_succeeded') {
    return { state: 'healthy', attemptCount: 0, firstFailedAt: null, alerts }
  }
  if (event.type === 'user_reconnected') {
    return { state: 'pending', attemptCount: 0, firstFailedAt: null, alerts }
  }
  if (event.type === 'auth_required') {
    return { state: 'needs_user', attemptCount: s.attemptCount + 1, firstFailedAt: s.firstFailedAt ?? now.toISOString(), alerts }
  }

  // sync_failed
  if (event.unmapped) alerts.push('unmapped_vendor_code')
  const firstFailedAt = s.firstFailedAt ?? now.toISOString()
  const attemptCount = s.attemptCount + 1
  const failingForMs = now.getTime() - new Date(firstFailedAt).getTime()
  const ageMs = now.getTime() - new Date(s.createdAt).getTime()

  if (failingForMs >= ABANDON_AFTER_DAYS * 24 * HOUR_MS && !s.lastSuccessfulSyncAt) {
    return { state: 'abandoned', attemptCount, firstFailedAt, alerts }
  }
  if (s.lastSuccessfulSyncAt) {
    return { state: 'degraded', attemptCount, firstFailedAt, alerts }
  }
  if (ageMs >= BROKEN_AFTER_HOURS * HOUR_MS) {
    if (s.state !== 'broken') alerts.push('entered_broken')
    return { state: 'broken', attemptCount, firstFailedAt, alerts }
  }
  return { state: 'pending', attemptCount, firstFailedAt, alerts }
}

export function classifyVendorFailure(statusCode: number | null, vendorMessage: string | null): ConnectionEvent {
  const text = (vendorMessage ?? '').toLowerCase()
  const authByText = /two.?factor|2fa|verification code|c[oó]digo de seguridad|otp/.test(text) ||
    (/invalid|incorrect|rejected|rechaz/.test(text) && /password|contrase|credential|login|access|acceso/.test(text))
  if (statusCode === 401 || authByText) return { type: 'auth_required' }
  const unmapped = statusCode !== null && !KNOWN_FAILURE_CODES.has(statusCode)
  return { type: 'sync_failed', statusCode, vendorCode: null, unmapped }
}

export function userFacingIssue(state: ConnectionState): { kind: string; title: string; message: string } | null {
  switch (state) {
    case 'pending': return { kind: 'connecting', title: 'Conectando…', message: 'Estamos verificando la conexión con tu institución.' }
    case 'healthy': return null
    case 'degraded': return { kind: 'provider_unavailable', title: 'Problema temporal', message: 'Tu institución está fallando temporalmente. FinovAI reintentará automáticamente; no necesitas hacer nada.' }
    case 'broken': return { kind: 'broken', title: 'Esta conexión no está funcionando', message: 'La conexión con tu institución no ha logrado sincronizar. Estamos investigando con el proveedor; te avisaremos cuando haya novedades.' }
    case 'needs_user': return { kind: 'action_required', title: 'Actualiza el acceso de esta institución', message: 'La institución rechazó el acceso guardado. Vuelve a conectar tu cuenta para continuar.' }
    case 'abandoned': return { kind: 'abandoned', title: 'Conexión retirada', message: 'Esta conexión falló durante 14 días y fue retirada. Puedes volver a conectarla cuando quieras.' }
  }
}
```

- [ ] **Step 3: Run tests** — `bun test worker/lifecycle.test.ts` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add worker/lib/lifecycle.ts worker/lifecycle.test.ts && git commit -m "Add connection lifecycle state machine with honest user-facing states"
```

---

### Task 7: Wire lifecycle into cron, import, webhook, and API

**Files:**
- Create: `worker/migrations/2026-08-31-connection-lifecycle.sql`
- Modify: `worker/cron.ts` (rewrite `refreshDueSyncfyCredentials`)
- Modify: `worker/lib/ingest.ts` (delete `markSyncfyCredentialSyncSuccess/Pending/Error/FromImportResult`; add `applyConnectionEvent`)
- Modify: `worker/lib/syncfy.ts` (delete `classifySyncfyConnectionIssue`; `GET /api/syncfy/credentials` maps via `userFacingIssue`)
- Modify: `worker/routes/syncfy.ts` (webhook demotion; reconnect → `user_reconnected`; credential DELETE → soft delete)
- Test: `worker/cron.test.ts` (new), `worker/finance.test.ts` (port status assertions to `state`)

**Interfaces:**
- Consumes: Task 6 exports; Task 4 `createTestDb`.
- Produces: `applyConnectionEvent(db: D1Database, credential: { email: string; syncfy_credential_id: string }, event: ConnectionEvent, now?: Date): Promise<TransitionResult>` — the ONLY writer of `syncfy_credentials.state`. `runScheduled` drives it. Legacy `status` column keeps being written with a mapped value (`healthy→synced`, `degraded/broken→provider_unavailable`, `needs_user→needs_reconnect`, `pending→pending_transactions`, `abandoned→sync_error`) until the frontend is ported, then dropped in Task 10.

- [ ] **Step 1: Migration**

```sql
-- worker/migrations/2026-08-31-connection-lifecycle.sql
ALTER TABLE syncfy_credentials ADD COLUMN state TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE syncfy_credentials ADD COLUMN state_changed_at TEXT;
ALTER TABLE syncfy_credentials ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE syncfy_credentials ADD COLUMN first_failed_at TEXT;
ALTER TABLE syncfy_credentials ADD COLUMN deleted_at TEXT;
-- backfill states from history:
UPDATE syncfy_credentials SET state = 'healthy' WHERE last_successful_sync_at IS NOT NULL;
UPDATE syncfy_credentials SET state = 'broken'
  WHERE last_successful_sync_at IS NULL AND created_at < datetime('now', '-48 hours');
UPDATE syncfy_credentials SET state = 'needs_user' WHERE status = 'needs_reconnect';
-- long-dead never-succeeded credentials go straight to abandoned (BBVA, 81 days):
UPDATE syncfy_credentials SET state = 'abandoned', first_failed_at = created_at
  WHERE last_successful_sync_at IS NULL AND created_at < datetime('now', '-14 days');
```

Mirror columns in `schema.sql` and runtime DDL.

- [ ] **Step 2: Write the failing cron end-to-end test**

```ts
// worker/cron.test.ts
import { test, expect } from 'bun:test'
import { createTestDb, loadSchema } from './lib/test-d1'
import { runScheduled } from './cron'

// Vendor seam: lib/syncfy.ts routes ALL Paybook HTTP through one module-level function.
// Add to lib/syncfy.ts:
//   let syncfyFetch: typeof fetch = fetch
//   export function setSyncfyFetchForTests(impl: typeof fetch): void { syncfyFetch = impl }
// and replace every direct `fetch(` in that module with `syncfyFetch(`.

type VendorScript = (credentialId: string) => { ok: boolean; status: number; message: string }

function makeEnv(db: unknown, vendor: VendorScript, opts: { onEmail?: (m: { subject: string }) => void; utcHour?: number } = {}) {
  setSyncfyFetchForTests(async (input) => {
    const url = String(input)
    const credentialId = url.match(/credentials\/([^/?]+)/)?.[1] ?? 'unknown'
    const scripted = vendor(credentialId)
    return new Response(
      JSON.stringify({ code: scripted.status, status: scripted.ok, message: scripted.message, response: scripted.ok ? [] : undefined }),
      { status: scripted.ok ? 200 : scripted.status }
    )
  })
  return {
    DB: db,
    SYNCFY_API_KEY: 'test-key',
    OPS_ALERT_EMAIL: 'ops@test.local',
    EMAIL: { send: async (msg: { subject: string }) => { opts.onEmail?.(msg) } },
    __testUtcHour: opts.utcHour, // cron.ts reads this override in tests; falls back to real clock
  } as unknown as Env
}

async function seedCredential(db, over: Partial<Record<string, unknown>> = {}) {
  await db.prepare(`INSERT INTO syncfy_credentials
    (email, syncfy_user_id, syncfy_credential_id, site_name, status, state, attempt_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending_transactions', ?, ?, ?, datetime('now'))`)
    .bind(over.email ?? 'u@x.co', 'su-1', over.id ?? 'cred-1', over.site ?? 'BBVA',
          over.state ?? 'pending', over.attempts ?? 0, over.createdAt ?? '2026-06-10T00:00:00Z').run()
}

test('repeat vendor 400 on a never-succeeded credential lands in broken, then abandoned, then polling stops', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, { createdAt: '2026-06-10T00:00:00Z' }) // 81 days old
  const env = makeEnv(db, () => ({ ok: false, status: 400, message: "Credential can't be sync at this moment" }))

  await runScheduled(env)
  let row = await db.prepare('SELECT state, attempt_count FROM syncfy_credentials').first<any>()
  expect(['broken', 'abandoned']).toContain(row.state)

  // simulate 15 daily runs — must terminate in abandoned and stop calling the vendor
  let vendorCalls = 0
  const countingEnv = makeEnv(db, () => { vendorCalls += 1; return { ok: false, status: 400, message: 'x' } })
  for (let day = 0; day < 15; day += 1) await runScheduled(countingEnv)
  row = await db.prepare('SELECT state FROM syncfy_credentials').first<any>()
  expect(row.state).toBe('abandoned')
  const callsAtAbandon = vendorCalls
  await runScheduled(countingEnv)
  expect(vendorCalls).toBe(callsAtAbandon) // abandoned credentials are never polled
})

test('healthy credential that succeeds stays healthy and resets counters', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, { state: 'healthy', attempts: 2, createdAt: '2026-08-01T00:00:00Z' })
  const env = makeEnv(db, () => ({ ok: true, status: 200, message: 'ok' }))
  await runScheduled(env)
  const row = await db.prepare('SELECT state, attempt_count, last_successful_sync_at FROM syncfy_credentials').first<any>()
  expect(row.state).toBe('healthy')
  expect(row.attempt_count).toBe(0)
  expect(row.last_successful_sync_at).not.toBeNull()
})

test('needs_user and abandoned are excluded from due selection', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, { id: 'cred-nu', state: 'needs_user' })
  await seedCredential(db, { id: 'cred-ab', email: 'v@x.co', state: 'abandoned' })
  let vendorCalls = 0
  const env = makeEnv(db, () => { vendorCalls += 1; return { ok: true, status: 200, message: 'ok' } })
  await runScheduled(env)
  expect(vendorCalls).toBe(0)
})
```

Run: `bun test worker/cron.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `applyConnectionEvent` in `lib/ingest.ts`**

```ts
import { transition, type ConnectionEvent, type TransitionResult, type ConnectionState } from './lifecycle'

const LEGACY_STATUS: Record<ConnectionState, string> = {
  healthy: 'synced', pending: 'pending_transactions', degraded: 'provider_unavailable',
  broken: 'provider_unavailable', needs_user: 'needs_reconnect', abandoned: 'sync_error',
}

export async function applyConnectionEvent(
  db: D1Database,
  credential: { email: string; syncfy_credential_id: string },
  event: ConnectionEvent,
  now: Date = new Date()
): Promise<TransitionResult> {
  const row = await db.prepare(
    `SELECT state, attempt_count, first_failed_at, last_successful_sync_at, created_at
     FROM syncfy_credentials WHERE email = ? AND syncfy_credential_id = ? AND deleted_at IS NULL`
  ).bind(credential.email, credential.syncfy_credential_id).first<any>()
  if (!row) throw new Error(`applyConnectionEvent: credential not found ${credential.syncfy_credential_id}`)

  const result = transition(
    { state: row.state, attemptCount: row.attempt_count, firstFailedAt: row.first_failed_at,
      lastSuccessfulSyncAt: row.last_successful_sync_at, createdAt: row.created_at },
    event, now
  )
  const success = event.type === 'sync_succeeded'
  await db.prepare(
    `UPDATE syncfy_credentials
     SET state = ?, state_changed_at = ?, attempt_count = ?, first_failed_at = ?,
         status = ?, last_pull_at = ?,
         last_successful_sync_at = CASE WHEN ? THEN ? ELSE last_successful_sync_at END,
         updated_at = ?
     WHERE email = ? AND syncfy_credential_id = ?`
  ).bind(
    result.state, now.toISOString(), result.attemptCount, result.firstFailedAt,
    LEGACY_STATUS[result.state], now.toISOString(),
    success ? 1 : 0, now.toISOString(), now.toISOString(),
    credential.email, credential.syncfy_credential_id
  ).run()
  return result
}
```

Delete `markSyncfyCredentialSyncSuccess`, `markSyncfyCredentialSyncPending`, `markSyncfyCredentialSyncError`, `markSyncfyCredentialFromImportResult`. Every former call site maps its outcome to a `ConnectionEvent` (success → `sync_succeeded`; `classifySyncfyCredentialBlocker === 'needs_reconnect'` → `auth_required`; import/vendor error → `classifyVendorFailure(status, message)`) and calls `applyConnectionEvent`. `TransitionResult.alerts` containing `entered_broken` or `unmapped_vendor_code` triggers the internal alert email (Task 8's `sendOpsAlertEmail`; until Task 8 lands, `console.error` with a `LIFECYCLE_ALERT` prefix).

- [ ] **Step 4: Rewrite cron selection and loop in `cron.ts`**

`loadDueSyncfyCredentials` adds: `AND deleted_at IS NULL AND state NOT IN ('needs_user', 'abandoned')`. The loop keeps the existing health-check + import flow but ends every branch in exactly one `applyConnectionEvent` call. `runScheduled(env)` = `await refreshDueSyncfyCredentials(env)` plus the Task 8 daily health tick.

- [ ] **Step 5: Demote the webhook**

In `processSyncfyWebhookEvent` (routes/syncfy.ts): keep storing the raw event in `syncfy_webhook_events`; delete every credential-state write; instead, if the event references a known credential, run the same poll-and-apply flow used by the cron for that single credential (immediate poll). Credential DELETE route: replace row deletion with `UPDATE syncfy_credentials SET deleted_at = datetime('now') ...`; all list queries filter `deleted_at IS NULL`.

- [ ] **Step 6: Map states for the UI**

`GET /api/syncfy/credentials` returns `connectionState`/`connectionIssue` derived from `userFacingIssue(state)`. Update `src/components/SyncfyConnect.tsx` to render the two new kinds (`broken`, `abandoned`) — reuse the existing issue-card UI; `abandoned` shows a reconnect button (calls the existing reset/reconnect flow, which now emits `user_reconnected`).

- [ ] **Step 7: Run everything**

Run: `bun test && bunx tsc -p worker/tsconfig.json --noEmit`
Expected: PASS, including the new cron suite. Port any `finance.test.ts` assertions still reading legacy `status`.

- [ ] **Step 8: Commit**

```bash
git add -A worker/ src/ && git commit -m "Drive credential state through lifecycle transitions; demote webhooks to poll triggers"
```

---

### Task 8: Daily health check and ops alert email

**Files:**
- Modify: `worker/cron.ts` (health tick), `worker/routes/auth.ts` or new `worker/lib/email.ts` (extract send helper), `worker/routes/finance.ts` (`GET /api/health` rewrite)
- Test: `worker/cron.test.ts`

**Interfaces:**
- Consumes: `env.EMAIL` (Cloudflare Email Sending, same binding as `sendDashboardLoginEmail`), `env.EMAIL_FROM`, new `env.OPS_ALERT_EMAIL` (add to `Env` in `lib/shared.ts` and to wrangler config as a var).
- Produces: `collectHealthMetrics(db): Promise<HealthMetrics>`, `sendOpsAlertEmail(env, subject, lines: string[])`, health tick runs when `new Date().getUTCHours() === 12`.

- [ ] **Step 1: Failing test**

```ts
test('health tick alerts when nothing ingested in 24h and a credential has no success in 48h', async () => {
  const { db } = createTestDb(await loadSchema())
  await seedCredential(db, { state: 'broken', createdAt: '2026-06-10T00:00:00Z' })
  const sent: { subject: string }[] = []
  const vendorOk = () => ({ ok: true, status: 200, message: 'ok' })
  const env = makeEnv(db, vendorOk, { onEmail: (msg) => sent.push(msg), utcHour: 12 })
  await runScheduled(env)
  expect(sent.length).toBe(1)
  expect(sent[0].subject).toContain('FinovAI health')
})

test('healthy day sends no email', async () => { /* seed recent transaction + healthy credential, expect sent.length 0 */ })
```

Run: `bun test worker/cron.test.ts -t "health tick"` — Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
// in worker/cron.ts
export interface HealthMetrics {
  transactionsLast24h: number
  credentialsNoSuccess48h: number
  enteredBrokenLast24h: number
  unmappedVendorCodesLast24h: number
}

export async function collectHealthMetrics(db: D1Database): Promise<HealthMetrics> {
  const txns = await db.prepare(
    `SELECT COUNT(*) n FROM transactions WHERE source = 'syncfy' AND created_at >= datetime('now', '-1 day')`
  ).first<{ n: number }>()
  const noSuccess = await db.prepare(
    `SELECT COUNT(*) n FROM syncfy_credentials
     WHERE deleted_at IS NULL AND state NOT IN ('abandoned', 'needs_user')
       AND (last_successful_sync_at IS NULL OR last_successful_sync_at < datetime('now', '-2 days'))
       AND created_at < datetime('now', '-2 days')`
  ).first<{ n: number }>()
  const broken = await db.prepare(
    `SELECT COUNT(*) n FROM syncfy_credentials WHERE state = 'broken' AND state_changed_at >= datetime('now', '-1 day')`
  ).first<{ n: number }>()
  const unmapped = await db.prepare(
    `SELECT COUNT(*) n FROM syncfy_errors
     WHERE created_at >= datetime('now', '-1 day')
       AND status_code NOT IN (400, 401, 403, 429, 500, 502, 503, 504)`
  ).first<{ n: number }>()
  return {
    transactionsLast24h: txns?.n ?? 0,
    credentialsNoSuccess48h: noSuccess?.n ?? 0,
    enteredBrokenLast24h: broken?.n ?? 0,
    unmappedVendorCodesLast24h: unmapped?.n ?? 0,
  }
}
```

Alert condition: `transactionsLast24h === 0 || credentialsNoSuccess48h > 0 || enteredBrokenLast24h > 0 || unmappedVendorCodesLast24h > 0`. `sendOpsAlertEmail` mirrors `sendDashboardLoginEmail`'s `env.EMAIL.send` call, to `env.OPS_ALERT_EMAIL`, subject `FinovAI health: <n> issue(s)`, one metric per line. Wire the `entered_broken`/`unmapped_vendor_code` alerts from Task 7 to the same helper (replace the `LIFECYCLE_ALERT` console.error). Rewrite `GET /api/health` to return `collectHealthMetrics` JSON, gated by `verifySupportAdminAccess`.

- [ ] **Step 3: Run tests** — `bun test` — Expected: PASS.

- [ ] **Step 4: Add `OPS_ALERT_EMAIL` var to wrangler config** (user supplies the address; do not invent one). Verify config parses: `direnv exec /Users/sushaantu/Developer -- wrangler deploy --dry-run`.

- [ ] **Step 5: Commit**

```bash
git add -A worker/ wrangler* && git commit -m "Add daily health check with ops alert email and admin health endpoint"
```

---

### Task 9: Deploy, apply migrations, verify production

**Files:** none (operational).

- [ ] **Step 1: Preview deploy + smoke**

Run: `direnv exec /Users/sushaantu/Developer -- bun run scripts/smoke-syncfy-full-flow.ts` against preview (script's existing target). Expected: full flow passes.

- [ ] **Step 2: Apply migrations to production (user approves each)**

```bash
direnv exec /Users/sushaantu/Developer -- wrangler d1 execute finovai-db --remote --file worker/migrations/2026-08-31-users-identity.sql
# then the Task 5 Step 5 backfill statements
direnv exec /Users/sushaantu/Developer -- wrangler d1 execute finovai-db --remote --file worker/migrations/2026-08-31-connection-lifecycle.sql
```

- [ ] **Step 3: Deploy worker, then verify with read-only queries**

```bash
direnv exec /Users/sushaantu/Developer -- wrangler d1 execute finovai-db --remote --command \
  "SELECT state, COUNT(*) FROM syncfy_credentials WHERE deleted_at IS NULL GROUP BY state"
```
Expected: Amex credentials `healthy`; BBVA/Azteca `abandoned` or `needs_user`; nothing in legacy-only statuses. Confirm the next cron run logs cleanly (`wrangler tail`).

- [ ] **Step 4: Commit any config changes; tag**

```bash
git tag lifecycle-live && git push --tags
```

---

### Task 10: Deferred destructive cleanup (run only after ≥3 days of clean production operation)

**Files:**
- Create: `worker/migrations/2026-09-XX-drop-legacy-tables.sql`

- [ ] **Step 1: Confirm health** — 3+ consecutive days of health emails absent (or all-green), `wrangler tail` clean.

- [ ] **Step 2: Migration**

```sql
DROP TABLE IF EXISTS otp_verifications;
DROP TABLE IF EXISTS conversation_participants;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS couples;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS cartola_imports;
```

Also remove their `CREATE TABLE` blocks from `schema.sql` and any remaining runtime DDL, and drop the legacy `status` column write from `applyConnectionEvent` once `SyncfyConnect.tsx`/`Dashboard.tsx` read only `connectionState` (verify with `rg -n "status" src/components/SyncfyConnect.tsx`).

- [ ] **Step 3: Apply with user approval, run `bun test`, commit**

```bash
git add -A worker/ && git commit -m "Drop legacy tables after lifecycle rollout verified"
```

---

## Non-code actions (parallel, user-owned unless delegated)

1. **Syncfy vendor ticket for BBVA** — site `56cf5728784806f72b8b456b`, RIDs `ec7c682b-c595-4851-964c-5bf58d0b75a9`, `773390ec-67c5-4457-b8cf-f10b22a80a8c`; 376 failures since 10 June, all `{"code":400,"message":"Credential can't be sync at this moment"}`.
2. **Institution allowlist** — before any new bank appears in the picker, one verified successful sync in preview. Enforce in `POST /api/syncfy/session` config when the vendor answers on BBVA.
