# Frontend Simplification: Shared Core + Dashboard Decomposition — Design

**Date:** 2026-08-31
**Status:** Approved for planning
**Companion to:** `2026-08-30-worker-reduction-and-connection-lifecycle-design.md` (the worker side of the same effort)

## 1. Problem

`src/components/Dashboard.tsx` is a 4,437-line monolith holding the auth gate, six page views, chat, Syncfy embedding, and profile management in one component. There is no request-state model: every network call is ad-hoc `fetch` + boolean `useState` flags (`isLoading`, `isLoadingCredentials`, `isSaving`, `reloadNonce`, …). Consequences:

- The loading screen shows **hard-coded fake progress bars** unrelated to actual fetch state.
- Chat inserts an **artificial 1.2-second delay** with fabricated "reasoning" text before calling the API.
- Credentials and household fetches **swallow errors silently**.
- The API client (`apiJson`) is **duplicated** in `Dashboard.tsx` and `SyncfyConnect.tsx`, both hardwired to web-only primitives (relative `fetch`, `localStorage`, `window` events).
- Refetch-after-mutation is hand-rolled (`reloadNonce`), which is the bug class that motivated this work.

We are about to build **React Native/Expo mobile apps**. They must share the API client, types, and request-state model with the web dashboard — not reimplement them.

## 2. Goals

1. A platform-neutral **`@finovai/core`** workspace package: typed API client for the surviving worker contract, TanStack Query hooks, session abstraction, and the existing `finance-core` domain logic.
2. The web dashboard decomposed into **focused page components** that consume the core, with `Dashboard.tsx` retired.
3. **Honest UX**: real loading/error states replace fake progress bars, the artificial chat delay, and silent error swallowing.

## 3. Non-goals

- Building the mobile apps themselves (separate project; this creates their foundation).
- A React Native Syncfy bank-link UI (the widget is a DOM-only UMD script; mobile will need its own link UX later — the credential/session *endpoints* are in the core).
- Changing the worker API (frozen by the worker-reduction spec).
- Visual redesign of the dashboard (same layout/copy except where dishonest states are fixed).
- Router or build-tool changes (keep Vite + hand-rolled history routing).

## 4. Decisions made during brainstorm

| Question | Decision |
| --- | --- |
| Purpose | Shared core for mobile reuse (not web-only cleanup) |
| Mobile stack | React Native / Expo → shared TypeScript package, hooks included |
| Scope | One spec, two phases: extract core (A), then decompose Dashboard (B) |
| UX | Fix dishonest states as part of Phase B (fake bars, 1.2s chat delay, silent errors) |
| Request-state layer | TanStack Query + thin typed API client (rejected: hand-rolled model, Zustand-as-cache) |

## 5. Architecture

### 5.1 Package: `packages/core` (`@finovai/core`)

Bun workspace package. **Purity rule:** no `window`, `document`, `localStorage`, `import.meta.env`, or DOM-only APIs anywhere in the package (enforced by a test). React and `@tanstack/react-query` are peer dependencies; the `./react` subpath isolates hook code from the pure client.

```
packages/core/
  package.json            name @finovai/core; exports "." and "./react"
  src/
    index.ts              re-exports finance-core, api-types, api-client, session
    finance-core.ts       moved from shared/finance-core.ts, unchanged
    api-types.ts          request/response types for every surviving endpoint
    api-client.ts         ApiError, ApiClientConfig, createApiClient
    session.ts            SessionStore interface (get/set/clear email+secret)
    react/
      index.ts
      context.ts          FinovaiCoreProvider + useApiClient
      keys.ts             query key factories
      queries.ts          useTransactions, useSyncfyCredentials, useHousehold
      mutations.ts        useSaveManualTransaction, useUpdateTransactionCategory,
                          useSaveProfile, useInviteSpouse, useSendChatMessage
  *.test.ts               bun test, mocked fetchImpl, no DOM
```

`shared/finance-core.ts` becomes a one-line re-export shim so the worker's five import sites don't change in this project.

### 5.2 API client

`createApiClient(config)` replaces both duplicated `apiJson` helpers.

```ts
interface ApiClientConfig {
  baseUrl: string                                  // '' on web (Vite proxy), worker URL on mobile
  getAuthHeaders: () => Record<string, string>     // X-FinovAI-Dashboard-Secret
  onUnauthorized?: () => void                      // web: clear session + dispatch event; mobile supplies its own handler
  fetchImpl?: typeof fetch                         // injectable for tests
}
```

- One typed method per surviving worker endpoint (auth, transactions, profile, chat, household, Syncfy) with payloads copied verbatim from the current call sites.
- Errors become `ApiError { status, body, message }` where message is the worker's Spanish `error` string. Nothing is swallowed at this layer; 401 triggers `onUnauthorized`.

### 5.3 Query layer

TanStack Query v5. Keys are per-user: `['transactions', email]`, `['syncfyCredentials', email]`, `['household', email]`. Most worker mutations return the fresh `DashboardResponse`, so mutations write it into the cache with `setQueryData` (matching today's behavior) instead of blind invalidation. Chat is a plain mutation with no cache writes. The web `QueryClient` uses defaults except `retry: 1` and `staleTime: 30_000` for queries.

### 5.4 Session

`SessionStore` interface in core (getEmail/getSecret/set/clear). `src/lib/dashboard-session.ts` remains the web implementation (localStorage); mobile will implement it over `expo-secure-store`/AsyncStorage. The client's `getAuthHeaders` is built from a `SessionStore`.

### 5.5 Phase B: web decomposition

```
src/dashboard/
  DashboardApp.tsx        shell: session gate, routing, theme, rail (< ~400 lines)
  EmailGate.tsx           email + OTP form (uses core auth methods)
  pages/ChatPage.tsx      current 'inicio'
  pages/ConnectPage.tsx   wraps SyncfyConnect
  pages/MovementsPage.tsx manual drafts + transactions table
  pages/CategoriesPage.tsx
  pages/AnalysisPage.tsx
  pages/SettingsPage.tsx  profile, budgets, household invites
  components/             Rail, LoadingState, shared chrome
  lib/routing.ts          page/path maps (moved verbatim)
```

Rewiring order matters: hooks first (each page can then call `useTransactions(email)` independently — React Query dedupes), then the file split becomes mechanical. `src/components/Dashboard.tsx` is deleted at the end; `App.tsx` imports `DashboardApp`.

`SyncfyConnect.tsx` and `EmailSignup.tsx` are ported to the shared client (their local `apiJson`/fetch code deleted). Dead code is removed: `src/components/chat/*` (calls deleted worker routes), empty `src/hooks/` and `src/components/auth/` directories.

### 5.6 UX fixes (Phase B)

1. **Loading screen:** fake step-progress bars replaced by an honest skeleton driven by the real `useTransactions` state, with the existing retry/error view on failure.
2. **Chat:** the 1,200 ms artificial delay and fabricated reasoning text are deleted. The thinking indicator shows during the real request; duration shown is real elapsed time; the local-analysis fallback on API failure is kept and labeled `análisis local` as today.
3. **Silent errors:** credentials and household query failures render a small inline notice with a retry action instead of silently showing empty data. Copy in Spanish, matching existing tone.

Dev-only preview modes (`?preview=dashboard`, `?preview=loading`) are preserved by disabling queries (`enabled: false`) and supplying preview data.

## 6. Error handling

- `ApiError` carries worker status + Spanish message; UI surfaces `error.message` exactly as today's `catch` blocks do.
- 401 anywhere → web `onUnauthorized` clears the session and dispatches `finovai:session-expired` (existing listener in Dashboard shell keeps working).
- Query retries: 1 (network blips), mutations: 0 (never double-submit manual transactions).

## 7. Testing

- **Core:** `bun test` unit tests with injected `fetchImpl` — happy path, error extraction, 401 handling, baseUrl prefixing, per-endpoint payload shape. A purity test greps core sources for forbidden web globals.
- **Web:** `bun run verify` (tsc + tests + build) after every task; `bun run smoke:ux:local` as the end-to-end regression net after Phase B rewiring and after the file split.
- Hooks are exercised through typecheck + the smoke flow rather than DOM-simulated unit tests (avoids adding jsdom/testing-library deps for thin wrappers).

## 8. Mobile-readiness acceptance criteria

A future Expo app in this monorepo can, without touching web code:

1. `import { createApiClient } from '@finovai/core'` with its own `baseUrl`, `SessionStore`, and `onUnauthorized`.
2. `import { useTransactions, useSendChatMessage, ... } from '@finovai/core/react'` inside its own `QueryClientProvider`.
3. Compile the package with Metro (package is self-contained TS source; no web globals).

## 9. Rollout

Pure frontend + package restructuring; no worker or DB changes. Ships through the normal `deploy:preview` → verify → production path. No migration or backfill. Riskiest step is the Phase B rewiring of the monolith; the smoke UX flow gates it.
