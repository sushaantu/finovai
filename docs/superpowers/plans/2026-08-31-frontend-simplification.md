# Frontend Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a platform-neutral `@finovai/core` package (typed API client + TanStack Query hooks + session abstraction) and decompose the 4,437-line `src/components/Dashboard.tsx` into focused page components with honest request-state UX, so future React Native/Expo apps share the same core.

**Architecture:** Phase A (Tasks 1–5) builds `packages/core` as a Bun workspace package: `finance-core` domain logic moves in, request/response types and a `createApiClient` factory replace the two duplicated `apiJson` helpers, and TanStack Query hooks wrap every endpoint. Phase B (Tasks 6–12) rewires the web app onto the core (queries first, then mutations, then chat), fixes the dishonest loading/chat UX, and splits the monolith into `src/dashboard/` pages. Rewiring precedes splitting because hooks decouple each page's data needs (React Query dedupes), making the split mechanical.

**Tech Stack:** Bun, TypeScript, React 19, Vite 7, TanStack Query v5 (only new dependency), Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-08-31-frontend-simplification-design.md`

## Global Constraints

- Use Bun for everything: `bun test`, `bun run <script>`, `bunx`, `bun install`. Never npm/node/vitest.
- Only new dependency allowed: `@tanstack/react-query` (v5, added in Task 5). Nothing else.
- All user-facing copy is Spanish; when moving JSX, keep copy byte-identical unless a task explicitly changes it.
- `packages/core` purity rule: no `window`, `document`, `localStorage`, `sessionStorage`, or `import.meta.env` anywhere under `packages/core/src` (Task 1 adds the enforcing test).
- Locate code by symbol (`rg -n "symbolName" src/`), not by line number — lines shift as tasks land.
- After every task: `bunx tsc --noEmit` passes and `bun test` passes. Tasks that touch `src/` also run `bun run build`. Commit at the end of every task.
- Any deploy/preview command runs via `direnv exec /Users/sushaantu/Developer -- <cmd>` (personal Cloudflare account). Never paste tokens.
- Do not modify anything under `worker/` except where a task explicitly says so (none do). The API contract is frozen.

---

### Task 1: Workspace package scaffold + move finance-core

**Files:**
- Modify: `package.json` (root — add workspaces)
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`, `packages/core/src/finance-core.ts` (moved), `packages/core/purity.test.ts`
- Modify: `shared/finance-core.ts` (becomes a re-export shim)
- Modify: `tsconfig.json`, `vite.config.ts` (aliases + include)

**Interfaces:**
- Consumes: nothing.
- Produces: importable `@finovai/core` (alias to `packages/core/src/index.ts`) re-exporting everything `shared/finance-core.ts` exported. Worker imports of `../../shared/finance-core` keep working via the shim.

- [ ] **Step 1: Root workspace + package manifest**

Add to root `package.json` (top level): `"workspaces": ["packages/*"]`.

```json
// packages/core/package.json
{
  "name": "@finovai/core",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./react": "./src/react/index.ts"
  },
  "peerDependencies": {
    "react": ">=19",
    "@tanstack/react-query": ">=5"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "@tanstack/react-query": { "optional": true }
  }
}
```

```json
// packages/core/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src"]
}
```

(`DOM` lib is only for `fetch`/`Response` types — the purity test below forbids actual web globals.)

- [ ] **Step 2: Move finance-core, leave shim**

```bash
mkdir -p packages/core/src && git mv shared/finance-core.ts packages/core/src/finance-core.ts
```

```ts
// shared/finance-core.ts (new content, entire file)
export * from '../packages/core/src/finance-core'
```

```ts
// packages/core/src/index.ts
export * from './finance-core'
```

- [ ] **Step 3: Aliases**

Root `tsconfig.json`: add to `paths` (keep `@/*`):

```json
"@finovai/core": ["./packages/core/src/index.ts"],
"@finovai/core/react": ["./packages/core/src/react/index.ts"]
```

and change `"include"` to `["src", "shared", "packages/core/src"]`.

`vite.config.ts` `resolve.alias` (order matters — more specific first):

```ts
'@finovai/core/react': path.resolve(__dirname, './packages/core/src/react/index.ts'),
'@finovai/core': path.resolve(__dirname, './packages/core/src/index.ts'),
```

- [ ] **Step 4: Purity test**

```ts
// packages/core/purity.test.ts
import { test, expect } from 'bun:test'
import { Glob } from 'bun'

const FORBIDDEN = [/\bwindow\./, /\bdocument\./, /\blocalStorage\b/, /\bsessionStorage\b/, /import\.meta\.env/]

test('core package contains no web-only globals', async () => {
  const glob = new Glob('src/**/*.{ts,tsx}')
  for await (const file of glob.scan(new URL('.', import.meta.url).pathname)) {
    const text = await Bun.file(new URL(file, import.meta.url).pathname).text()
    for (const pattern of FORBIDDEN) {
      expect(pattern.test(text), `${file} matches ${pattern}`).toBe(false)
    }
  }
})
```

- [ ] **Step 5: Install, typecheck, test**

Run: `bun install && bunx tsc --noEmit && bun test`
Expected: PASS (finance-core tests run through the shim unchanged).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Create @finovai/core workspace package; move finance-core into it"
```

---

### Task 2: API types module

**Files:**
- Create: `packages/core/src/api-types.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `src/components/Dashboard.tsx`, `src/components/SyncfyConnect.tsx` (import types instead of declaring)

**Interfaces:**
- Consumes: `finance-core` types.
- Produces (exact exported names Tasks 3–12 rely on): `DashboardResponse`, `TransactionCategoryResponse`, `DashboardChatResponse`, `HouseholdInvite`, `HouseholdResponse`, `SyncfyCredential`, `SyncfyCredentialsResponse`, `SyncfySessionResponse`, `SyncfyCredentialCaptureResponse`, `SyncfyRefreshResponse`, `SyncfyCredentialDeleteResponse`, `AuthResponse`, `ManualTransactionInput`, `ProfilePatch`.

- [ ] **Step 1: Move the response interfaces**

Cut these interfaces from `src/components/Dashboard.tsx` (locate with `rg -n "interface DashboardResponse|interface SyncfyCredentialsResponse|interface DashboardChatResponse|interface TransactionCategoryResponse|interface HouseholdInvite|interface HouseholdResponse" src/components/Dashboard.tsx`) into `packages/core/src/api-types.ts`, adding `export` to each, importing their `finance-core` dependencies relatively (`./finance-core`). Cut `SyncfyCredential` and the four Syncfy response interfaces (`SyncfySessionResponse`, `SyncfyCredentialCaptureResponse`, `SyncfyRefreshResponse`, `SyncfyCredentialDeleteResponse`) from `src/components/SyncfyConnect.tsx` — it has the widest `SyncfyCredential` definition; verify Dashboard's local `SyncfyCredential` usages typecheck against it and delete Dashboard's copy (widen the moved interface with any Dashboard-only optional fields rather than keeping two definitions).

Then add these new types (shapes copied verbatim from the current call sites in `Dashboard.tsx`/`App.tsx`):

```ts
// packages/core/src/api-types.ts (additions)
export interface AuthResponse {
  success: boolean
  email: string
  clientSecret?: string
  verificationRequired?: boolean
  debugCode?: string
  error?: string
}

export interface ManualTransactionInput {
  date: string
  type: 'income' | 'expense'
  amount: string
  currency: string
  category: string
  description: string
  merchant: string
  notes: string
}

export interface ProfilePatch {
  currency: string
  monthlyIncome: number | null
  monthlyBudget: number | null
  categoryBudgets: Record<string, number> | undefined
}
```

- [ ] **Step 2: Re-export and rewire imports**

`packages/core/src/index.ts`: add `export * from './api-types'`. In `Dashboard.tsx` and `SyncfyConnect.tsx`, import the moved types from `@finovai/core` and delete the local declarations. Local UI-only types (`ManualForm`, `ManualDraft`, `ProfileForm`, `DashboardChatMessage`, `PendingChatAnswer`, page/theme types) stay in the components.

- [ ] **Step 3: Verify**

Run: `bunx tsc --noEmit && bun test && bun run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Move API response types into @finovai/core"
```

---

### Task 3: API client — auth, finance, household, chat

**Files:**
- Create: `packages/core/src/api-client.ts`, `packages/core/api-client.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces: `ApiError`, `ApiClientConfig`, `createApiClient`, `type ApiClient = ReturnType<typeof createApiClient>`. Method signatures below are load-bearing for Tasks 5–12.

- [ ] **Step 1: Write failing tests**

```ts
// packages/core/api-client.test.ts
import { test, expect } from 'bun:test'
import { createApiClient, ApiError } from './src/api-client'

function mockFetch(status: number, body: unknown, capture?: { url?: string; init?: RequestInit }) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    if (capture) { capture.url = String(url); capture.init = init }
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
}

test('prefixes baseUrl and sends auth headers + JSON content type', async () => {
  const capture: { url?: string; init?: RequestInit } = {}
  const client = createApiClient({
    baseUrl: 'https://api.example.com',
    getAuthHeaders: () => ({ 'X-FinovAI-Dashboard-Secret': 's3cret' }),
    fetchImpl: mockFetch(200, { success: true, email: 'a@b.co', transactions: [], summary: {}, insights: [] }, capture),
  })
  await client.getTransactions('a@b.co')
  expect(capture.url).toBe('https://api.example.com/api/transactions?email=a%40b.co')
  const headers = capture.init?.headers as Record<string, string>
  expect(headers['X-FinovAI-Dashboard-Secret']).toBe('s3cret')
  expect(headers['Content-Type']).toBe('application/json')
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

test('malformed error body falls back to generic Spanish message', async () => {
  const client = createApiClient({
    baseUrl: '',
    getAuthHeaders: () => ({}),
    fetchImpl: (async () => new Response('not json', { status: 500 })) as typeof fetch,
  })
  const err = await client.getTransactions('a@b.co').catch((e) => e)
  expect(err.message).toBe('Error de API')
})
```

Run: `bun test packages/core/api-client.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement**

```ts
// packages/core/src/api-client.ts
import type {
  AuthResponse, DashboardResponse, TransactionCategoryResponse, DashboardChatResponse,
  HouseholdResponse, ManualTransactionInput, ProfilePatch,
  SyncfyCredentialsResponse, SyncfySessionResponse, SyncfyCredentialCaptureResponse,
  SyncfyRefreshResponse, SyncfyCredentialDeleteResponse,
} from './api-types'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface ApiClientConfig {
  baseUrl: string
  getAuthHeaders: () => Record<string, string>
  onUnauthorized?: () => void
  fetchImpl?: typeof fetch
}

export function createApiClient(config: ApiClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...config.getAuthHeaders(),
        ...init?.headers,
      },
    })
    const body: unknown = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401) config.onUnauthorized?.()
      const message =
        typeof (body as { error?: unknown })?.error === 'string'
          ? (body as { error: string }).error
          : 'Error de API'
      throw new ApiError(response.status, message, body)
    }
    return body as T
  }

  const post = (payload: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(payload) })
  const patch = (payload: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(payload) })

  return {
    // --- auth ---
    signup: (email: string, options?: { redirectPath?: string; diagnosticData?: string }) =>
      request<AuthResponse>('/api/signup', post({
        email,
        redirectPath: options?.redirectPath ?? '/dashboard',
        diagnosticData: options?.diagnosticData,
      })),
    verifyLoginCode: (email: string, code: string, source: string) =>
      request<AuthResponse>('/api/auth/verify', post({ email, code, source })),
    verifyLoginToken: (email: string, token: string) =>
      request<AuthResponse>('/api/auth/verify', post({ email, token, source: 'magic-link' })),
    requestLoginLink: (email: string) =>
      request<AuthResponse>('/api/auth/request-link', post({ email })),

    // --- finance ---
    getTransactions: (email: string) =>
      request<DashboardResponse>(`/api/transactions?email=${encodeURIComponent(email)}`),
    saveManualTransaction: (email: string, input: ManualTransactionInput) =>
      request<DashboardResponse>('/api/transactions/manual', post({ email, ...input })),
    updateTransactionCategory: (email: string, transactionId: string, category: string) =>
      request<TransactionCategoryResponse>('/api/transactions/category', patch({ email, transactionId, category })),
    saveProfile: (email: string, profile: ProfilePatch) =>
      request<DashboardResponse>('/api/profile', patch({ email, ...profile })),
    sendDashboardChat: (email: string, question: string) =>
      request<DashboardChatResponse>('/api/dashboard/chat', post({ email, question })),

    // --- household ---
    getHousehold: (email: string) =>
      request<HouseholdResponse>(`/api/household?email=${encodeURIComponent(email)}`),
    inviteSpouse: (email: string, spouseEmail: string) =>
      request<HouseholdResponse>('/api/household/invite', post({ email, spouseEmail })),

    // --- syncfy (payloads verified against SyncfyConnect.tsx call sites) ---
    getSyncfyCredentials: (email: string) =>
      request<SyncfyCredentialsResponse>(`/api/syncfy/credentials?email=${encodeURIComponent(email)}`),
    createSyncfySession: (email: string, options?: { credentialId?: string; mode?: string }) =>
      request<SyncfySessionResponse>('/api/syncfy/session', post({ email, credentialId: options?.credentialId, mode: options?.mode })),
    captureSyncfyCredential: (email: string, eventType: string, payload: unknown) =>
      request<SyncfyCredentialCaptureResponse>('/api/syncfy/credential', post({ email, eventType, payload })),
    refreshSyncfyCredential: (email: string, credentialId: string) =>
      request<SyncfyRefreshResponse>('/api/syncfy/refresh', post({ email, credentialId })),
    deleteSyncfyCredential: (email: string, credentialId: string) =>
      request<SyncfyCredentialDeleteResponse>('/api/syncfy/credential', { method: 'DELETE', body: JSON.stringify({ email, credentialId }) }),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
```

Before finishing: `rg -n "requestLoginLink|request-link" src/ worker/routes/auth.ts` and confirm the `/api/auth/request-link` payload key is `email`; if the worker expects a different body, match the worker exactly.

- [ ] **Step 3: Export, run tests**

Add `export * from './api-client'` to `packages/core/src/index.ts`.
Run: `bunx tsc --noEmit && bun test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add typed API client to @finovai/core"
```

---

### Task 4: Session abstraction

**Files:**
- Create: `packages/core/src/session.ts`
- Modify: `packages/core/src/index.ts`, `src/lib/dashboard-session.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SessionStore` interface + `buildAuthHeaders(store)`; web `SessionStore` implementation exported from `src/lib/dashboard-session.ts` as `webSessionStore` (existing function exports stay for landing-page callers).

- [ ] **Step 1: Core interface**

```ts
// packages/core/src/session.ts
export const DASHBOARD_SECRET_HEADER = 'X-FinovAI-Dashboard-Secret'

export interface SessionStore {
  getEmail(): string | null
  getSecret(): string | null
  set(email: string, clientSecret?: string | null): void
  clear(): void
}

export function buildAuthHeaders(store: SessionStore): Record<string, string> {
  const secret = store.getSecret()
  return secret ? { [DASHBOARD_SECRET_HEADER]: secret } : {}
}
```

Add `export * from './session'` to `packages/core/src/index.ts`. Update `src/lib/dashboard-session.ts` to import `DASHBOARD_SECRET_HEADER` from `@finovai/core` (delete its local constant) and append:

```ts
// src/lib/dashboard-session.ts (addition)
import type { SessionStore } from '@finovai/core'

export const webSessionStore: SessionStore = {
  getEmail: getStoredDashboardEmail,
  getSecret: getStoredDashboardSecret,
  set: setDashboardSession,
  clear: clearDashboardSession,
}
```

- [ ] **Step 2: Verify**

Run: `bunx tsc --noEmit && bun test` — Expected: PASS (purity test still green: `session.ts` has no web globals).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add SessionStore abstraction to core with web implementation"
```

---

### Task 5: React Query layer

**Files:**
- Create: `packages/core/src/react/index.ts`, `packages/core/src/react/context.ts`, `packages/core/src/react/keys.ts`, `packages/core/src/react/queries.ts`, `packages/core/src/react/mutations.ts`
- Create: `packages/core/query-keys.test.ts`
- Modify: `package.json` (root — add dependency)

**Interfaces:**
- Consumes: `ApiClient` (Task 3).
- Produces (exact names Tasks 7–12 use):
  - `FinovaiCoreProvider({ client, children })` — React context carrying the `ApiClient` (NOT the QueryClientProvider; the app owns that)
  - `useApiClient(): ApiClient`
  - `queryKeys.transactions(email)`, `queryKeys.syncfyCredentials(email)`, `queryKeys.household(email)`
  - Queries: `useTransactions(email, opts?)`, `useSyncfyCredentials(email, opts?)`, `useHousehold(email, opts?)` — each accepts `{ enabled?: boolean }`
  - Mutations: `useSaveManualTransaction(email)`, `useUpdateTransactionCategory(email)`, `useSaveProfile(email)`, `useInviteSpouse(email)`, `useSendChatMessage(email)`

- [ ] **Step 1: Add dependency**

Run: `bun add @tanstack/react-query`

- [ ] **Step 2: Keys + failing key test**

```ts
// packages/core/src/react/keys.ts
export const queryKeys = {
  transactions: (email: string) => ['transactions', email] as const,
  syncfyCredentials: (email: string) => ['syncfyCredentials', email] as const,
  household: (email: string) => ['household', email] as const,
}
```

```ts
// packages/core/query-keys.test.ts
import { test, expect } from 'bun:test'
import { queryKeys } from './src/react/keys'

test('query keys are namespaced per user email', () => {
  expect(queryKeys.transactions('a@b.co')).toEqual(['transactions', 'a@b.co'])
  expect(queryKeys.syncfyCredentials('a@b.co')).toEqual(['syncfyCredentials', 'a@b.co'])
  expect(queryKeys.household('a@b.co')).toEqual(['household', 'a@b.co'])
})
```

- [ ] **Step 3: Provider, queries, mutations**

The context lives in its own module so `queries.ts`/`mutations.ts` never import from `index.ts` (avoids a circular import).

```ts
// packages/core/src/react/context.ts
import { createContext, useContext, type ReactNode, createElement } from 'react'
import type { ApiClient } from '../api-client'

const ApiClientContext = createContext<ApiClient | null>(null)

export function FinovaiCoreProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return createElement(ApiClientContext.Provider, { value: client }, children)
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext)
  if (!client) throw new Error('FinovaiCoreProvider missing above this component')
  return client
}
```

```ts
// packages/core/src/react/index.ts
export { FinovaiCoreProvider, useApiClient } from './context'
export { queryKeys } from './keys'
export * from './queries'
export * from './mutations'
```

```ts
// packages/core/src/react/queries.ts
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from './context'
import { queryKeys } from './keys'

interface QueryOpts { enabled?: boolean }

export function useTransactions(email: string | null, opts: QueryOpts = {}) {
  const client = useApiClient()
  return useQuery({
    queryKey: queryKeys.transactions(email ?? ''),
    queryFn: () => client.getTransactions(email!),
    enabled: Boolean(email) && (opts.enabled ?? true),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useSyncfyCredentials(email: string | null, opts: QueryOpts = {}) {
  const client = useApiClient()
  return useQuery({
    queryKey: queryKeys.syncfyCredentials(email ?? ''),
    queryFn: () => client.getSyncfyCredentials(email!),
    enabled: Boolean(email) && (opts.enabled ?? true),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useHousehold(email: string | null, opts: QueryOpts = {}) {
  const client = useApiClient()
  return useQuery({
    queryKey: queryKeys.household(email ?? ''),
    queryFn: () => client.getHousehold(email!),
    enabled: Boolean(email) && (opts.enabled ?? true),
    staleTime: 30_000,
    retry: 1,
  })
}
```

```ts
// packages/core/src/react/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './context'
import { queryKeys } from './keys'
import type { ManualTransactionInput, ProfilePatch } from '../api-types'

// Worker finance mutations return the full fresh DashboardResponse,
// so we write it into the cache instead of refetching.
export function useSaveManualTransaction(email: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ManualTransactionInput) => client.saveManualTransaction(email, input),
    onSuccess: (response) => queryClient.setQueryData(queryKeys.transactions(email), response),
    retry: 0,
  })
}

export function useUpdateTransactionCategory(email: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { transactionId: string; category: string }) =>
      client.updateTransactionCategory(email, vars.transactionId, vars.category),
    onSuccess: (response) => queryClient.setQueryData(queryKeys.transactions(email), response),
    retry: 0,
  })
}

export function useSaveProfile(email: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (profile: ProfilePatch) => client.saveProfile(email, profile),
    onSuccess: (response) => queryClient.setQueryData(queryKeys.transactions(email), response),
    retry: 0,
  })
}

export function useInviteSpouse(email: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (spouseEmail: string) => client.inviteSpouse(email, spouseEmail),
    onSuccess: (response) => queryClient.setQueryData(queryKeys.household(email), response),
    retry: 0,
  })
}

export function useSendChatMessage(email: string) {
  const client = useApiClient()
  return useMutation({
    mutationFn: (question: string) => client.sendDashboardChat(email, question),
    retry: 0,
  })
}
```

Note: `TransactionCategoryResponse extends DashboardResponse`, so `setQueryData` with it is type-correct for the transactions key.

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit && bun test`
Expected: PASS (purity test covers the new `react/` files too).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add TanStack Query layer to @finovai/core"
```

---

### Task 6: Delete dead frontend code

**Files:**
- Delete: `src/components/chat/` (entire directory — calls worker routes deleted in the worker-reduction work)
- Delete: `src/hooks/`, `src/components/auth/` (empty directories)

- [ ] **Step 1: Verify nothing live imports the chat components**

```bash
rg -n "components/chat" src/ --glob '!src/components/chat/**'
```

Expected: matches only in files that are themselves dead or none. If a live file (e.g. `Navbar.tsx`, `LandingPage.tsx`) imports something from `src/components/chat/`, remove that usage in the same commit — check with the user first if the removal is visible on the landing page.

- [ ] **Step 2: Delete and verify**

```bash
git rm -r src/components/chat && rmdir src/hooks src/components/auth 2>/dev/null; bunx tsc --noEmit && bun test && bun run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Delete dead chat components targeting removed worker routes"
```

---

### Task 7: Web wiring — client instance, providers, magic-link port

**Files:**
- Create: `src/lib/api.ts`
- Modify: `src/main.tsx` (providers), `src/App.tsx` (magic-link verify via client)

**Interfaces:**
- Consumes: `createApiClient`, `webSessionStore`, `FinovaiCoreProvider`.
- Produces: `apiClient` singleton (`src/lib/api.ts`) used by every later task; provider tree `QueryClientProvider > FinovaiCoreProvider > App`.

- [ ] **Step 1: Web client singleton**

```ts
// src/lib/api.ts
import { createApiClient, buildAuthHeaders } from '@finovai/core'
import { webSessionStore, clearDashboardSession } from './dashboard-session'

export const apiClient = createApiClient({
  baseUrl: '',
  getAuthHeaders: () => buildAuthHeaders(webSessionStore),
  onUnauthorized: () => {
    clearDashboardSession()
    window.dispatchEvent(new Event('finovai:session-expired'))
  },
})
```

- [ ] **Step 2: Providers in `src/main.tsx`**

Wrap the existing `<App />` render:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FinovaiCoreProvider } from '@finovai/core/react'
import { apiClient } from './lib/api'

const queryClient = new QueryClient()

// inside the existing root.render(...):
<QueryClientProvider client={queryClient}>
  <FinovaiCoreProvider client={apiClient}>
    <App />
  </FinovaiCoreProvider>
</QueryClientProvider>
```

- [ ] **Step 3: Port the magic-link effect in `App.tsx`**

Replace the raw `fetch('/api/auth/verify', ...)` effect (locate: `rg -n "login_token" src/App.tsx`) with `apiClient.verifyLoginToken(email, token)`; keep the exact same success/failure state updates and Spanish notices. The `catch` branch handles both network errors and `ApiError` (use `error instanceof Error ? error.message : ...` to preserve the worker's message where available).

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit && bun test && bun run build`
Expected: PASS. Manual check: `bun run dev`, log in via email code, confirm dashboard loads.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Wire web app to @finovai/core client with QueryClient providers"
```

---

### Task 8: Rewire Dashboard queries + honest loading state

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `useTransactions`, `useSyncfyCredentials`, `useHousehold`, `apiClient`.
- Produces: Dashboard reads all server data from hooks; deleted state Tasks 9–11 must not reference: `data`/`setData`, `loadError`, `isLoading` (fetch flavor), `reloadNonce`, `syncfyCredentials`/`setSyncfyCredentials`, `isLoadingCredentials`, `credentialsFetchFailed`, `credentialsReadyForEmail`, `householdInvites`/`setHouseholdInvites`.

- [ ] **Step 1: Replace the three fetch effects with hooks**

Delete the effects that load transactions, Syncfy credentials, and household invites (locate: `rg -n "reloadNonce|isLoadingCredentials|householdInvites" src/components/Dashboard.tsx`). Replace with:

```tsx
const transactionsQuery = useTransactions(activeEmail, { enabled: !previewEnabled })
const credentialsQuery = useSyncfyCredentials(activeEmail, { enabled: !previewEnabled })
const householdQuery = useHousehold(activeEmail, { enabled: !previewEnabled })

const data = previewEnabled && previewEmail
  ? createPreviewDashboardResponse(previewEmail)
  : transactionsQuery.data ?? null
const syncfyCredentials = previewEnabled
  ? createPreviewSyncfyCredentials()
  : credentialsQuery.data?.credentials ?? []
const householdInvites = householdQuery.data?.invites ?? []
```

Derived values that used the deleted state (`credentialsReadyForEmail`, connected/reconnect counts, smart-redirect effect, income-prompt effect) now derive from `credentialsQuery.isSuccess` / `credentialsQuery.data` / `transactionsQuery.data`. The session-expired event listener stays; on `finovai:session-expired` also call `queryClient.clear()` (import `useQueryClient`).

- [ ] **Step 2: Honest loading and error screens**

In the render gate section (locate: `rg -n "Cuenta localizada" src/components/Dashboard.tsx`):
- Delete the fake step-progress block (the three hard-coded bars "Cuenta localizada" / "Movimientos" / "Resumen" with static widths). Replace with the existing pulse-skeleton cards only, plus a single line `Cargando tus movimientos…`.
- Error screen: keep the existing retry UI but drive it from `transactionsQuery.isError` and `transactionsQuery.error.message`; the retry button calls `transactionsQuery.refetch()` (replaces `setReloadNonce`).

- [ ] **Step 3: Surface previously-swallowed errors**

Where credential status copy renders (locate: `rg -n "credentialsFetchFailed" src/components/Dashboard.tsx` before deleting), render on `credentialsQuery.isError` a small inline notice: `No pudimos cargar tus conexiones bancarias.` with a `Reintentar` action calling `credentialsQuery.refetch()`. Same pattern for `householdQuery.isError` in the settings section: `No pudimos cargar las invitaciones.` + `Reintentar`.

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit && bun test && bun run build`, then `bun run dev` and click through all pages: load, retry-on-error (kill the worker to test), reconnect nudge, income prompt.
Expected: no fake progress bars; real states.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Drive dashboard data from React Query with honest loading/error states"
```

---

### Task 9: Rewire Dashboard mutations

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `useSaveManualTransaction`, `useUpdateTransactionCategory`, `useSaveProfile`, `useInviteSpouse`.
- Produces: no direct `apiJson` calls remain in Dashboard except chat (Task 10). Deleted state: `isSaving`, `isSavingProfile`, `isSavingIncomePrompt`, `isInvitingSpouse`, `updatingCategoryId` (replaced by mutation `isPending` / variables).

- [ ] **Step 1: Instantiate mutations** (only when `activeEmail` is set; guard as today)

```tsx
const saveManualTransaction = useSaveManualTransaction(activeEmail ?? '')
const updateCategory = useUpdateTransactionCategory(activeEmail ?? '')
const saveProfile = useSaveProfile(activeEmail ?? '')
const inviteSpouse = useInviteSpouse(activeEmail ?? '')
```

- [ ] **Step 2: Port each handler, preserving copy and behavior**

- `handleSaveManualDrafts`: keep the sequential loop (worker recomputes the summary per insert): `for (const draft of draftsToSave) { await saveManualTransaction.mutateAsync({ ...draft, currency: DEFAULT_FINANCE_CURRENCY }) }` — cache updates happen in `onSuccess`; keep the success/error `status` messages verbatim. Busy flag: `saveManualTransaction.isPending`.
- `handleTransactionCategoryChange`: `updateCategory.mutate({ transactionId, category })`; per-row spinner uses `updateCategory.isPending && updateCategory.variables?.transactionId === transaction.id`.
- `handleProfileSubmit` and `handleIncomePromptSave`: `saveProfile.mutateAsync({...})` with the exact payload fields from the current code (`currency: chatCurrency`, `monthlyIncome`, `monthlyBudget`, `categoryBudgets`); the income-prompt variant keeps its `profile.monthlyBudget`/`profile.categoryBudgets` passthrough. Preview-mode branches stay as-is.
- `handleInviteSpouse`: `inviteSpouse.mutateAsync(normalizedSpouseEmail)`; keep the `emailSent` message fork verbatim.

- [ ] **Step 3: Verify**

Run: `bunx tsc --noEmit && bun test && bun run build`, then in `bun run dev`: add a manual movement, change a category, save profile, invite spouse — confirm data refreshes without any manual reload logic.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Port dashboard mutations to React Query with cache writes"
```

---

### Task 10: Honest chat — remove the artificial delay and fabricated reasoning

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `useSendChatMessage`.
- Produces: `queueDashboardChatAnswer(question)` with no `setTimeout(…, 1200)`, no `buildDashboardChatReasoning` (delete that helper and its imports if now unused), no `chatAnswerTimeoutRef`.

- [ ] **Step 1: Rewrite `queueDashboardChatAnswer`**

```tsx
const sendChat = useSendChatMessage(activeEmail ?? '')

const queueDashboardChatAnswer = (question: string) => {
  if (!question || pendingChatAnswer) return
  const startedAt = Date.now()
  setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: question }])
  setPendingChatAnswer({ question, reasoning: '', startedAt })
  setChatInput('')

  void (async () => {
    let answer = ''
    let model: string | undefined
    let chatError: string | null = null
    if (activeEmail) {
      try {
        const response = await sendChat.mutateAsync(question)
        answer = response.answer
        model = response.model
      } catch (error) {
        chatError = error instanceof Error ? error.message : 'No pudimos conectar con el modelo financiero.'
      }
    }
    if (!activeEmail || chatError) {
      answer = buildDashboardChatAnswer(question, chatTransactions, chatSummary, chatCurrency, false,
        hasConnectedInstitution, hasReconnectRequiredCredential, chatProfile)
      if (chatError) model = 'análisis local'
    }
    answer = finalizeDashboardChatAnswer(answer)
    const chart = getDashboardChatChartType(question, chatTransactions, chatSummary)
    const chartCategory = chart === 'category-trend' ? getDashboardChatChartCategory(question) : undefined
    const reasoningDuration = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000))
    setChatMessages((current) => [...current, {
      id: crypto.randomUUID(), role: 'assistant', content: answer, chart, chartCategory,
      reasoning: model ? `Modelo: ${model}${chatError ? `\nModelo remoto no ejecutado: ${chatError}` : ''}` : undefined,
      reasoningDuration,
    }])
    setPendingChatAnswer(null)
  })()
}
```

The ThinkingBar keeps rendering while `pendingChatAnswer` is set — now for the real request duration only. Scroll-to-bottom effects stay. Delete `chatAnswerTimeoutRef` and its cleanup effect.

- [ ] **Step 2: Verify**

Run: `bunx tsc --noEmit && bun test && bun run build`, then in dev: ask a chat question — the answer should arrive as fast as the worker responds; kill the worker and confirm the local fallback labeled `análisis local`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Remove artificial chat delay and fabricated reasoning"
```

---

### Task 11: Split the monolith into src/dashboard/ pages

**Files:**
- Create: `src/dashboard/DashboardApp.tsx`, `src/dashboard/EmailGate.tsx`, `src/dashboard/lib/routing.ts`, `src/dashboard/components/Rail.tsx`, `src/dashboard/components/LoadingState.tsx`
- Create: `src/dashboard/pages/ChatPage.tsx`, `src/dashboard/pages/ConnectPage.tsx`, `src/dashboard/pages/MovementsPage.tsx`, `src/dashboard/pages/CategoriesPage.tsx`, `src/dashboard/pages/AnalysisPage.tsx`, `src/dashboard/pages/SettingsPage.tsx`
- Modify: `src/App.tsx` (import `DashboardApp` from `src/dashboard/DashboardApp`)
- Delete: `src/components/Dashboard.tsx` (at the end)

**Interfaces:**
- Consumes: everything from Tasks 7–10.
- Produces: `DashboardApp` with the same props Dashboard had: `{ email, initialNotice?, initialPath?, onBackHome, onLogout }`. Each page component takes `{ email: string }` plus the narrow callbacks it needs (e.g. `SettingsPage` gets `onLogout`); pages fetch their own data via core hooks.

Move map (locate every symbol by name; JSX and copy move byte-identical):

| Destination | Moves from Dashboard.tsx |
| --- | --- |
| `lib/routing.ts` | `DashboardPage` type, `DASHBOARD_PAGES`, `DASHBOARD_PAGE_PATHS`, `LEGACY_DASHBOARD_PAGE_PATHS`, `PAGE_META`, `normalizeDashboardPath`, `getDashboardPageFromPath` |
| `components/Rail.tsx` | rail/nav JSX, `DashboardBrandWordmark`, theme toggle |
| `components/LoadingState.tsx` | Task 8's honest loading + error screens |
| `EmailGate.tsx` | logged-out email/OTP form, `handleIdentify` (ported to `apiClient.signup` / `apiClient.verifyLoginCode`) |
| `pages/ChatPage.tsx` | `renderFinanceCockpitHome`, chat state/handlers (Task 10 version), chart components, `DASHBOARD_CHAT_SUGGESTIONS` |
| `pages/ConnectPage.tsx` | the `syncfy` page section wrapping `SyncfyConnect` |
| `pages/MovementsPage.tsx` | manual form + drafts + transactions table, `ManualForm`/`ManualDraft` types, `createManualForm` |
| `pages/CategoriesPage.tsx` | category breakdown/budgets section, `CategoryPeriodFilter` |
| `pages/AnalysisPage.tsx` | month summary/action-plan/charts section |
| `pages/SettingsPage.tsx` | profile form, category budgets, household invites, logout |
| `DashboardApp.tsx` | session gate (`activeEmail` + session-expired listener), path↔page routing effects, theme state, income-prompt dialog, page switch |

- [ ] **Step 1: Extract `lib/routing.ts` and `components/` first** (pure moves), typecheck after each file.

- [ ] **Step 2: Extract pages one at a time** — after each page: `bunx tsc --noEmit && bun run build`, and click that page in `bun run dev`. Each page calls `useTransactions(email)` etc. itself; React Query dedupes so there is no prop-drilling of `data`. Shared pure helpers used by several pages (currency/formatting helpers like `parseMoneyInput`, `moneyInputValue`) go to `src/dashboard/lib/format.ts`, or into `@finovai/core` if platform-neutral and generally useful.

- [ ] **Step 3: Finish `DashboardApp.tsx`, swap the import, delete the monolith**

Update `src/App.tsx`: `import DashboardApp from './dashboard/DashboardApp'` and render it where `<Dashboard …>` was (same props). Then `git rm src/components/Dashboard.tsx`.

- [ ] **Step 4: Size check**

Run: `wc -l src/dashboard/DashboardApp.tsx src/dashboard/pages/*.tsx`
Expected: no file over ~800 lines (ChatPage will be the largest due to chart JSX).

- [ ] **Step 5: Verify**

Run: `bunx tsc --noEmit && bun test && bun run build && bun run smoke:ux:local`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Decompose dashboard monolith into focused page components"
```

---

### Task 12: Port SyncfyConnect and EmailSignup to the shared client; final sweep

**Files:**
- Modify: `src/components/SyncfyConnect.tsx` (delete local `apiJson`, use `apiClient`)
- Modify: `src/components/EmailSignup.tsx` (use `apiClient.signup` / `verifyLoginCode`)

**Interfaces:**
- Consumes: `apiClient` from `src/lib/api.ts`.
- Produces: zero direct `fetch('/api/…')` or `apiJson` definitions in `src/` — the core client is the single HTTP path.

- [ ] **Step 1: SyncfyConnect**

Delete its `apiJson` and replace each call with the matching client method (`getSyncfyCredentials`, `createSyncfySession`, `captureSyncfyCredential`, `refreshSyncfyCredential`, `deleteSyncfyCredential`). Keep its internal polling/widget logic untouched (DOM widget stays web-only by design). Optionally (small win, do it): replace its `loadCredentials` polling target with `queryClient.invalidateQueries({ queryKey: queryKeys.syncfyCredentials(email) })` after capture/refresh/delete so ConnectPage and the credential nudges stay in sync.

- [ ] **Step 2: EmailSignup**

Replace its direct fetch/`apiJson` calls (locate: `rg -n "fetch\(|apiJson" src/components/EmailSignup.tsx`) with `apiClient.signup(email)` / `apiClient.verifyLoginCode(email, code, source)`, keeping its existing source strings and Spanish notices verbatim.

- [ ] **Step 3: Final sweep**

```bash
rg -n "async function apiJson|fetch\('/api|fetch\(\`/api" src/        # expect: no matches
rg -n "setTimeout\(.*1200" src/                                       # expect: no matches
rg -n "window\.|localStorage" packages/core/src/                      # expect: no matches
```

Run: `bun run verify && bun run smoke:ux:local`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Route all frontend HTTP through @finovai/core client"
```

---

### Task 13: Preview deploy verification (user approves before running)

**Files:** none (operational).

- [ ] **Step 1:** With user approval: `direnv exec /Users/sushaantu/Developer -- bun run deploy:preview`
- [ ] **Step 2:** Run `bun run smoke:ux:preview` and click through the preview dashboard manually (login, connect page, movements, chat).
- [ ] **Step 3:** Tag: `git tag frontend-core-live`

---

## Out of scope (explicitly)

- The Expo app itself (next project; acceptance criteria in spec §8).
- React Native Syncfy link UX (endpoints are ready in the client; widget replacement is a mobile design task).
- Worker changes of any kind.
