# Syncfy Architecture

## PM-Ready Summary

FinovAI uses Syncfy/Paybook as the embedded bank connection provider. Users connect an institution inside the Syncfy widget; FinovAI stores the resulting credential, imports transaction data into the dashboard tables, and keeps the connection fresh through webhooks, manual refresh, and production cron refresh.

The active Syncfy workspace for production operations is `@finovai`. Do not use the older `@finov-ai` workspace for production configuration.

## Environment Map

| Environment | App URL | Worker | Syncfy mode | Webhook URL | D1 database |
| --- | --- | --- | --- | --- | --- |
| Production | `https://finov.ai` | `finovai` | `production` | `https://finov.ai/api/syncfy/webhook` | `finovai-db` |
| Preview | `https://finovai-preview.my-cloudflare-711.workers.dev` | `finovai-preview` | `sandbox` | `https://finovai-preview.my-cloudflare-711.workers.dev/api/syncfy/webhook` | `finovai-preview-db` |
| Local sandbox | `http://127.0.0.1:5173` | local Wrangler | `sandbox` | local tunnel if needed | local/selected D1 |

Production and preview must stay separated. Preview uses the sandbox Syncfy API and the isolated preview D1 database, so preview validation should not touch production Syncfy credentials or production transaction rows.

## Syncfy Dashboard Configuration

Syncfy should send these events to the matching environment webhook:

- `credentials.created`
- `credentials.updated`
- `credentials.deleted`
- `credentials.refreshed`

Webhook authentication is shared-secret based. Configure Syncfy to send one of:

- `x-finovai-webhook-secret: <SYNCFY_WEBHOOK_SECRET>`
- `x-syncfy-webhook-secret: <SYNCFY_WEBHOOK_SECRET>`
- `Authorization: Bearer <SYNCFY_WEBHOOK_SECRET>`

Never commit API keys or webhook secret values. Store them as Cloudflare Worker secrets.

## Frontend Flow

The connect experience lives in `src/components/SyncfyConnect.tsx`.

1. The dashboard renders the connect page.
2. The browser calls `POST /api/syncfy/session`.
3. The Worker creates or reuses the Syncfy user for the signed-in FinovAI email.
4. The Worker creates a Syncfy widget session and returns a short-lived widget token.
5. The browser opens `@syncfy/authentication-widget`.
6. When the widget reports a credential, the browser calls `POST /api/syncfy/credential`.
7. The Worker stores the credential, starts a Syncfy credential pull, follows returned job-status links, and imports transactions as soon as Syncfy exposes readable rows.

The browser never receives the Syncfy API key. It only receives a widget session token.

Sandbox widget sessions must return `widgetEnableTestMode = true` and pass `enableTestMode: true` into `SyncfyWidget`. This is required for the Paybook ACME test catalog and is disabled in production.

## Backend Flow

The Cloudflare Worker in `worker/index.ts` owns the integration:

- Syncfy API auth and request wrapper.
- Syncfy user creation and lookup.
- Widget session creation.
- Credential upsert and institution metadata extraction.
- Credential pull initiation through Syncfy `/credentials/:id/pulls`.
- Job-status following through Syncfy `/jobs/:id/status`.
- Transaction normalization and upsert into `transactions`.
- Webhook verification and event storage.
- Background webhook processing with `ctx.waitUntil`.
- Manual refresh and scheduled production refresh.
- Admin/support diagnostics.

CRUD contract details live in [SYNCFY_CRUD_OPERATIONS.md](SYNCFY_CRUD_OPERATIONS.md). That document is the guardrail for create/read/update/delete behavior across Syncfy and FinovAI local state.

Vendor contract details live in [SYNCFY_VENDOR_REFERENCE.md](SYNCFY_VENDOR_REFERENCE.md). That document maps Syncfy/Paybook docs and sample code to the implementation contract.

Primary routes:

| Route | Purpose |
| --- | --- |
| `POST /api/syncfy/session` | Create or reuse Syncfy user, then create widget session. |
| `GET /api/syncfy/credentials` | Return connected credentials for the signed-in user. |
| `POST /api/syncfy/credential` | Store/update a credential after widget success and attempt import. |
| `DELETE /api/syncfy/credential` | Delete the Syncfy credential upstream, then remove the stored credential and its Syncfy transactions from FinovAI. |
| `POST /api/syncfy/refresh` | Refresh one credential with cooldown protection; support-admin access can trigger this without a browser session. |
| `POST /api/syncfy/webhook` | Receive Syncfy webhook, acknowledge quickly, process in background. |
| `GET /api/syncfy/status` | Internal per-user diagnostic endpoint. |
| `GET /api/admin/syncfy` | Support/admin overview of users, credentials, errors, and webhooks. |
| `GET /api/health` | Environment proof, including `syncfyEnvironment`. |

## Data Model

Syncfy state is stored in D1:

| Table | Purpose |
| --- | --- |
| `syncfy_users` | Maps one FinovAI email to one Syncfy `id_user` and `id_external`. |
| `syncfy_credentials` | Stores connected institution credentials, status, site metadata, raw payload, and refresh timestamps. |
| `syncfy_webhook_events` | Stores raw webhook events for audit and replay/debugging. |
| `syncfy_errors` | Stores Syncfy errors, request IDs, status codes, and payloads for support escalation. |
| `transactions` | Stores imported movements with `source = 'syncfy'`; newer imports include `_finovaiCredentialId` in `raw_source`. |

Credential health is based on both credential status and imported transaction evidence. A stored credential is not considered healthy merely because it exists.

## Webhook Processing Model

The webhook endpoint is intentionally fast:

1. Verify the shared secret.
2. Parse and store the event.
3. Store or update credential state when possible.
4. Return `202 Accepted` quickly to Syncfy.
5. Continue transaction import and credential status updates in `ctx.waitUntil`.

This prevents Syncfy from timing out while FinovAI imports transactions. In Syncfy logs, healthy webhook delivery should show an HTTP `202`. Old HTTP `0` rows around 31 seconds indicate timeout behavior from before this async processing model.

## Refresh Model

FinovAI has three refresh paths:

| Path | Trigger | Notes |
| --- | --- | --- |
| Immediate import | Widget success / credential callback | Gives the user fast feedback after connecting. |
| Manual refresh | `POST /api/syncfy/refresh` | Uses a five-minute credential cooldown; support-admin can run the same endpoint for production repair. |
| Scheduled refresh | Production cron every five minutes | Refreshes due credentials whose last pull is older than the configured interval. |

The webhook path is important, but user-visible success must not depend only on webhook delivery. After a credential exists, FinovAI explicitly starts a Syncfy pull, persists the returned job state in `syncfy_credentials.raw_json`, follows job-status links, and falls back to direct `/transactions` reads. If Syncfy rejects a new pull as rate-limited but `/transactions` is already readable, FinovAI should still import the readable movements and store the pull error for support.

The five-minute UI cooldown, `POST /api/syncfy/refresh`, and scheduled cron interval must stay aligned. If the UI says FinovAI will retry in about five minutes, the Worker must consider that credential due after the same interval.

Syncfy HTTP register status is transport-level evidence only. A `200` on `/credentials/:id/pulls`, `/jobs/:id/status`, or `/transactions` means Syncfy accepted and answered the API request; it does not prove that the institution produced readable movements. FinovAI treats `200` plus zero transactions as `pending_transactions`, records `last_pull_at`, and waits for scheduled/support refresh.

New institution connection has an earlier hard gate: Syncfy must allow `POST /v1/credentials/pulls`. If Syncfy returns `402 Payment Required` there, the account/API key cannot create the credential at all. No webhook, transaction import, or chat behavior can fix that because no usable provider credential exists yet.

## Status Semantics

| Status | Meaning |
| --- | --- |
| `synced` | Credential has successful transaction evidence and a successful sync timestamp. |
| `pending_transactions` | Credential exists, but Syncfy has not yet yielded readable transaction data. |
| `needs_reconnect` | Syncfy rejected refresh/import or the credential is no longer usable. User should reconnect. |

For support, check transaction counts as well as credential status. Historical transaction rows can exist even when the current credential is `needs_reconnect`.

## Operations

Use `direnv exec` so Wrangler uses the correct Cloudflare account and secrets.

Preview deploy:

```sh
direnv exec /Users/sushaantu/Developer/finovai bun run deploy:preview
curl https://finovai-preview.my-cloudflare-711.workers.dev/api/health
```

Production deploy:

```sh
direnv exec /Users/sushaantu/Developer/finovai bun run deploy:production
curl https://finov.ai/api/health
```

Expected health proof:

- Production: `environment = production`, `syncfyEnvironment = production`
- Preview: `environment = preview`, `syncfyEnvironment = sandbox`

## Support Checklist

When a user says the connection did not complete:

1. Confirm the environment: production or preview/sandbox.
2. Check `/api/admin/syncfy` or production D1 for the user's `syncfy_users` row.
3. Check `syncfy_credentials` for institution, status, and timestamps.
4. Check `transactions` for `source = 'syncfy'` rows for that email.
5. Check `syncfy_errors` for recent `rid`, HTTP status, and Syncfy message.
6. Check Syncfy HTTP logs for fresh webhook delivery status.
7. If Syncfy HTTP logs show `200`, still verify whether `/transactions` returned rows; `200` with zero rows is pending/provider data, not app success.
8. For a user who cannot add a new bank, verify `POST /v1/credentials/pulls` directly or through a fresh widget run. `402 Payment Required` is a Syncfy account/key entitlement blocker.
9. Treat `401 Invalid user` as a reconnect/recovery state unless Syncfy confirms otherwise.

PM-ready support wording:

> The account connection can exist before transactions are usable. For each user, confirm three things separately: Syncfy user exists, institution credential exists, and transaction data imported successfully. If a credential is `pending_transactions`, FinovAI will keep retrying; if it is `needs_reconnect`, the user needs a clean reconnect before relying on dashboard data.

When a user wants to fully retry an institution, use the FinovAI delete action first. That now removes the upstream Syncfy credential as well as FinovAI's local rows, so the next add attempt is a clean provider-side connection attempt.
