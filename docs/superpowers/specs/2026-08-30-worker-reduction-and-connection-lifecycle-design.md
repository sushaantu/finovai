# Worker reduction and connection lifecycle — design

**Date:** 2026-08-30
**Status:** Approved approach (Approach A); spec pending user review
**Context:** Incident brief of 30 Aug 2026 (findings F1–F5, decisions D1–D7). 8 of 11 real users have zero transactions; only Amex has ever synced; a 26-day ingest blackout went unnoticed. Mobile app development starts this week and needs a small, tested API surface.

## Goals

1. Reduce `worker/index.ts` (7,511 lines) to a small, modular, tested codebase before mobile work begins.
2. Give bank connections a real lifecycle: attempt ceilings, honest user-facing states, terminal states, and internal alerting.
3. Introduce a stable internal user ID before mobile clients bake in email-as-identity.
4. Make "is bank sync healthy?" answerable by a machine, with a daily alert email.

## Non-goals

- Durable Object per credential (revisit at hundreds of users).
- Re-keying every historical row off email (email columns remain during transition).
- Fixing the BBVA connector itself — that requires a Syncfy vendor ticket (RIDs `ec7c682b-c595-4851-964c-5bf58d0b75a9`, `773390ec-67c5-4457-b8cf-f10b22a80a8c`), filed in parallel.

## Decisions made

| Brief ID | Decision |
| --- | --- |
| D1 | Lifecycle lives as columns + a single transition function on D1 rows. No Durable Objects. |
| D2 | Never-succeeded + 48h → `broken` (honest message + internal alert). 14 consecutive failure-days with no success → `abandoned` (polling stops; explicit reconnect required). 24h backoff retained. |
| D3 | Classify on status code + connection history. Vendor prose is diagnostic detail only. Unmapped codes raise an internal alert, never a silent "contact support". |
| D4 | Polling is the sole writer of credential state. Webhooks only schedule an immediate poll. |
| D5 | Daily health tick inside the hourly cron; alert by email to the founder via the existing email path; admin-gated `GET /api/health` exposes the same metrics. |
| D6 | Stable `users.id` introduced now; 11 real users backfilled; `gnail.com` typo merged. |
| D7 | Institution allowlist: a bank appears in the picker only after one verified successful sync. |

## Scope of deletion (agreed)

Delete outright, code and tables:

- Phone-OTP / WhatsApp auth (legacy `users`, `sessions`, `otp_verifications` tables — empty in production).
- Quiz / conversations messaging (`conversations`, `messages`, `couples`, `chat_sessions`).
- Legacy `POST /api/chat` product chat.
- Cartola CSV/PDF import: parsers, `/api/cartola/*` routes, `cartola_imports` table.

Roughly 2,000 lines of worker code plus their tests and mocks. Net worker size ~4,500 lines.

## Section 1 — Identity

New root table:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,          -- UUID
  email TEXT NOT NULL UNIQUE,   -- normalized
  created_at TEXT NOT NULL
);
```

- Surviving tables (`transactions`, `syncfy_credentials`, `syncfy_errors`, `financial_profiles`, `dashboard_sessions`, `syncfy_users`) gain a nullable `user_id` column, backfilled from normalized email. Email columns remain during the transition; new code joins on `user_id`.
- The `mosoriom507@gnail.com` typo account is merged into `mosoriom507@gmail.com` during backfill.
- Syncfy external ID format changes from `finovai:{email}` / `finovai:{email}:reset:{timestamp}` to `finovai:user:{id}:v{n}`, where `n` is an integer column (`syncfy_identity_version`) on `users`. A vendor-identity reset increments `n`; all local history stays attached to the same `user_id`. Existing external IDs keep working for existing credentials; new/reset identities use the new format.

## Section 2 — Connection lifecycle

New columns on `syncfy_credentials`: `state`, `state_changed_at`, `attempt_count` (consecutive failures), `first_failed_at`, `deleted_at`. Credential rows are soft-deleted only (fixes F4).

`transitionConnection(db, credential, event)` in `lib/lifecycle.ts` is the only code permitted to write `state`. All current ad-hoc status writes are removed.

### States

| State | Meaning | User sees | Polling |
| --- | --- | --- | --- |
| `pending` | Created, never succeeded, < 48h old | "Connecting…" | Yes |
| `healthy` | Last sync succeeded | Normal | Yes (24h cadence) |
| `degraded` | Succeeded before, currently failing | "Temporary issue, retrying automatically" | Yes (24h backoff) |
| `broken` | Never succeeded, ≥ 48h old | "This connection isn't working; we're investigating" | Yes, until abandoned; internal alert on entry |
| `needs_user` | Vendor reports bad credentials / MFA required | "Action required: reconnect" | No |
| `abandoned` | 14 consecutive days of failure, zero success | "Connection retired; reconnect to try again" | No (terminal until explicit reconnect) |

### Transition policy

- Success from any state → `healthy`; resets `attempt_count` and `first_failed_at`.
- Failure in `pending` past 48h → `broken` (alert fires once, on entry).
- Failure in `healthy` → `degraded`.
- Vendor auth/MFA codes → `needs_user` regardless of prior state.
- `first_failed_at` older than 14 days with no intervening success → `abandoned`.
- Explicit user reconnect from `needs_user`/`abandoned`/`broken` → `pending` (new attempt window).

### Classification

`classify(statusCode, vendorCode, history)` maps status code plus history to an event. Vendor prose is stored in `syncfy_errors` for diagnostics but never drives state. Any unmapped code produces the event `unknown_vendor_error`, which transitions per the failure rules **and** triggers an internal alert email.

### Webhooks

The webhook handler stores the raw event (unchanged) and schedules an immediate poll for the affected credential. It no longer writes credential state.

## Section 3 — Module layout

```
worker/
  index.ts          — entry: fetch router + scheduled dispatch (~100 lines)
  routes/auth.ts    — email login, sessions, signup
  routes/syncfy.ts  — session, credential CRUD, webhook, status, admin
  routes/finance.ts — transactions, profile, dashboard chat, household
  lib/syncfy.ts     — Paybook HTTP client (injectable)
  lib/lifecycle.ts  — state machine, transitions, classification
  lib/ingest.ts     — transaction import/upsert
  lib/db.ts         — schema, migrations, query helpers
  cron.ts           — hourly refresh loop + daily health check
```

Shared helpers (`verifyDashboardEmailAccess`, `normalizeSignupEmail`, `timingSafeStringEqual`, `runAIResponse`) move to `lib/`. The split is mechanical — no behavior change, proven by the existing test suite.

### Surviving API surface (the mobile contract)

- Auth: `POST /api/signup`, `POST /api/auth/request-link`, `POST /api/auth/verify`
- Syncfy: `POST /api/syncfy/session`, `GET /api/syncfy/credentials`, `POST|DELETE /api/syncfy/credential`, `POST /api/syncfy/refresh`, `POST /api/syncfy/reset`, `POST /api/syncfy/webhook`, `GET /api/syncfy/status`, `GET /api/admin/syncfy`
- Finance: `GET /api/transactions`, `POST /api/transactions/manual`, `PATCH /api/transactions/category`, `GET|PATCH /api/profile`, `POST /api/dashboard/chat`, `GET /api/household`, `POST /api/household/invite`
- Ops: `GET /api/health` (admin-gated), `GET /api/expenses`

## Section 4 — Testing

- Replace the hand-rolled `MockD1` (string-matching SQL mock, ~3,500 lines) with a thin adapter exposing the D1 interface over in-memory `bun:sqlite`, loading the real `schema.sql`. `schema-drift.test.ts` becomes redundant and is deleted.
- `lib/syncfy.ts` is the injectable seam; tests script vendor responses (success, BBVA-style 400, 402, unmapped code).
- Priority order:
  1. Cron end-to-end: seed credentials in every state, run the real refresh loop against the fake vendor, assert transitions, ceilings, and that polling stops for terminal states. (This test has never existed.)
  2. Lifecycle table: every (state, event) pair asserted; illegal transitions throw.
  3. Classification regressions: never-succeeded 400 → `broken` path; 402 → internal alert, not "contact support".
  4. Route surface: existing `finance.test.ts` route tests ported to the SQLite adapter — the mobile contract.
  5. Health check: seeded ingest gap composes an alert email.
- `scripts/smoke-syncfy-full-flow.ts` remains the real-vendor preview smoke.

## Section 5 — Health and alerting

Daily tick at a fixed UTC hour inside the existing hourly cron. Metrics: transactions ingested in last 24h, credentials with no success in 48h, unmapped vendor codes in last 24h, entries into `broken`. Any red metric → email to founder via the existing email-sending path. `GET /api/health` (admin-gated) returns the same metrics as JSON.

## Section 6 — Rollout order

1. Delete legacy + cartola code (pure reduction; tests pass).
2. Mechanical module split (no behavior change).
3. Test harness swap (`bun:sqlite` adapter in, `MockD1` out).
4. Identity migration (additive; backfill 11 users; typo merge).
5. Lifecycle (columns, `transitionConnection`, cron rewrite, classification flip, webhook demotion).
6. Health check + alert email.
7. Destructive cleanup (drop legacy tables) only after several days of clean production operation.

Parallel non-code actions: Syncfy vendor ticket for BBVA with the F1 RIDs; institution allowlist policy adopted.

## Risks

- **Backfill/merge mistakes:** identity migration is additive and reversible until step 7; verify with read-only queries before and after.
- **Behavior drift during the split:** mitigated by porting the existing test suite first and keeping the split mechanical.
- **BBVA may still not work after all this:** correct — the lifecycle makes the failure honest and bounded; the connector fix depends on the vendor ticket (D7).
