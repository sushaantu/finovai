# Syncfy CRUD Operations

## PM-Ready Summary

Every Syncfy credential operation has two systems of record: Syncfy owns the provider-side connection, and FinovAI owns the local user, credential, transaction, webhook, and error records. A user-visible operation is complete only when the required provider-side and local-side effects both match the operation contract below.

The main guardrail: FinovAI must not perform a local-only delete after a retryable Syncfy delete failure. If Syncfy cannot confirm deletion because of a provider outage, timeout, or 5xx error, keep the local credential and transactions intact and ask the user to retry.

The vendor behavior behind this contract is documented in [SYNCFY_VENDOR_REFERENCE.md](SYNCFY_VENDOR_REFERENCE.md), including the Paybook sample flow for credential pulls, job-status polling, and transaction reads.

## Source-Of-Truth Rules

| Object | System of record | FinovAI storage |
| --- | --- | --- |
| Syncfy user | Syncfy, keyed by `id_user` and `id_external` | `syncfy_users` |
| Institution credential | Syncfy, keyed by `id_credential` | `syncfy_credentials` |
| Imported movements | FinovAI, derived from Syncfy transaction endpoints | `transactions` with `source = 'syncfy'` |
| Webhook delivery | Syncfy sends; FinovAI audits | `syncfy_webhook_events` |
| Provider/API failures | FinovAI support log | `syncfy_errors` |

## Create

| Step | Operation | Required behavior |
| --- | --- | --- |
| 1 | `POST /api/syncfy/session` | Create or reuse `syncfy_users` for the FinovAI email. |
| 2 | Syncfy `/sessions` | Create a short-lived widget token for the stored Syncfy `id_user`. |
| 3 | Browser widget | User selects and authenticates the institution. Sandbox must pass Syncfy `enableTestMode`. |
| 3a | Syncfy new credential | Syncfy creates the provider credential through `POST /v1/credentials/pulls`. A `402 Payment Required` here means the Syncfy key/account cannot create credentials. |
| 4 | `POST /api/syncfy/credential` | Store `syncfy_credentials` after the widget returns `id_credential`. |
| 5 | Start pull | Call Syncfy `/credentials/:id_credential/pulls?id_user=:id_user` so the provider begins preparing movements. |
| 6 | Follow job | Persist returned job state and follow `/jobs/:id/status` when Syncfy provides it. |
| 7 | Transaction import | Import from returned transaction endpoints or direct `/transactions` reads as soon as rows are readable. |

Success state:

- `syncfy_users` row exists.
- `syncfy_credentials` row exists.
- Status is `synced` only if there is successful transaction evidence.

Failure state:

- Widget-only errors may have a Syncfy RID but no FinovAI backend row.
- If Syncfy rejects `POST /v1/credentials/pulls` with `402 Payment Required`, no FinovAI backend import can run because no provider credential exists.
- FinovAI API failures must store RID/source in `syncfy_errors` when Syncfy returned one.

## Read

| Operation | Endpoint/table | Required behavior |
| --- | --- | --- |
| List user credentials | `GET /api/syncfy/credentials` | Return only credentials for the authenticated email. |
| Admin diagnostics | `GET /api/admin/syncfy` | Return users, credentials, recent webhooks, and recent errors. |
| User diagnostics | `GET /api/syncfy/status?email=...` | Production requires the Syncfy/admin secret. |
| Dashboard data | `transactions` | Read `source = 'syncfy'` rows together with manual rows. |

Read contract:

- A credential row alone does not mean transaction data is usable.
- Support must check credential status and transaction count separately.
- Historical transactions can exist for a user whose current credential is `needs_reconnect`, `provider_unavailable`, or `sync_error`.
- The credentials read response includes `connectionState` and `connectionIssue`; user-facing recovery must use these fields instead of treating every unsynced credential as pending.

## Update

| Trigger | Operation | Required behavior |
| --- | --- | --- |
| Widget update/reconnect | `POST /api/syncfy/session` with update credential | Reuse the stored `id_user` and pass the selected credential to the widget. |
| Credential callback | `POST /api/syncfy/credential` | Upsert credential metadata, start a pull, follow job status, and import readable transactions. |
| Manual refresh | `POST /api/syncfy/refresh` | Enforce cooldown, follow saved job state, start/follow a new pull when allowed, read direct transactions, then mark status. Support-admin access can run this without a browser session for production repair. |
| Webhook refresh | `POST /api/syncfy/webhook` | Store event, return `202`, process import in `ctx.waitUntil`. |
| Production cron | Scheduled Worker | Refresh due credentials on the daily background interval. |

Update status rules:

- `synced`: transaction import succeeded or existing credential-tagged transactions prove success.
- `pending_transactions`: credential exists but no readable transactions are available yet.
- A new pull failure does not automatically block import. If Syncfy rate-limits `/credentials/:id/pulls` but direct `/transactions` returns rows, import those rows and log the pull error in `syncfy_errors`.
- A `200` response with zero readable transactions is still a pull attempt. Keep the credential in `pending_transactions`, update `last_pull_at`, and apply the normal cooldown so repeated empty polls do not flood Syncfy HTTP logs.
- A Syncfy widget `error` event is not enough to mark the FinovAI connection failed if a credential was created. Re-read credentials first; if one exists, continue refresh/import and keep the state as `pending_transactions` until transaction evidence arrives or Syncfy returns a terminal credential error.
- `needs_reconnect`: Syncfy reports rejected, invalid, or expired access. The user must update access.
- `provider_unavailable`: Syncfy or the institution cannot synchronize temporarily. Preserve the credential and retry later without asking the user to re-enter access.
- `sync_error`: the response is not safely attributable to the user or provider. Show the support code and route the issue to FinovAI.

## Delete

Delete is the operation most likely to create split-brain state, so it has a stricter contract.

Endpoint: `DELETE /api/syncfy/credential`

Required order:

1. Load local credential by authenticated email and `id_credential`.
2. Call Syncfy upstream delete: `DELETE /credentials/:id_credential?id_user=:id_user`.
3. If Syncfy confirms delete, remove local `transactions` for that credential.
4. Remove local `syncfy_credentials` row.
5. Return the updated credential list and deletion metadata.

Never do this:

- Do not delete local rows first.
- Do not swallow retryable upstream failures.
- Do not tell the user the institution was deleted if Syncfy delete failed with a retryable error.

Delete failure behavior:

| Syncfy result | Local credential | Local transactions | API response | Error log |
| --- | --- | --- | --- | --- |
| 2xx success | Delete | Delete credential-scoped rows | `200` | None required |
| 200 with `status:false`, or 400/401/404/410 terminal stale state | Delete | Delete credential-scoped rows | `200`, `syncfyCredentialDeleted=false` | Store `syncfy-delete-credential` |
| 429/5xx/network/retryable failure | Keep | Keep | `409` or `502`, `localStateDeleted=false` | Store `syncfy-delete-credential` when Syncfy returned a response |

Why terminal stale states can clean local rows:

- If Syncfy says the credential or user is already invalid/gone, FinovAI cannot repair that credential by keeping the row.
- Local cleanup is acceptable because the provider-side connection is already unusable.
- The cleanup must still be logged so support can see that upstream deletion was attempted but not confirmed as a normal 2xx delete.

Deleted webhook rule:

- `credentials.deleted` webhooks must remove the local `syncfy_credentials` row and credential-scoped `transactions`.
- They must never upsert the deleted credential back into `syncfy_credentials`.
- The webhook event should still be stored and marked `processed_at`.

Reset rule:

- `POST /api/syncfy/reset` and automatic `401 Invalid user` recovery delete all local `syncfy_credentials` and all `transactions` with `source = 'syncfy'` for that email before creating a fresh Syncfy user.
- Manual transactions are preserved.
- This is intentionally stronger than a single-credential delete because it is used for key/account mismatch or stale-user recovery where old provider IDs are no longer trustworthy.

## Regression Tests

The worker test suite must keep these cases covered:

- Successful delete calls Syncfy upstream before local cleanup.
- Retryable upstream delete failure preserves local credential and transactions.
- Terminal upstream stale-state delete logs the provider error and removes local stale rows.
- Webhook processing returns `202` before transaction import.
- Refresh starts a Syncfy credential pull and imports transactions from the returned job status.
- Refresh imports direct transactions when a new pull is rate-limited.
- Refresh treats existing credential-tagged transactions as success when polling returns empty.
- Sandbox sessions return `widgetEnableTestMode = true`; production sessions return `false`.
- Reset/stale-user recovery removes old Syncfy transactions while preserving manual transactions.

Run:

```sh
bun test worker/finance.test.ts
bun run verify
```

PM-ready acceptance criteria:

> A reconnect retry is clean only when the old provider-side Syncfy credential is removed or Syncfy confirms it is already unusable. If Syncfy is temporarily failing, FinovAI must keep the local connection visible and ask the user to retry instead of pretending deletion succeeded.
