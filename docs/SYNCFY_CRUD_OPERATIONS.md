# Syncfy CRUD Operations

## PM-Ready Summary

Every Syncfy credential operation has two systems of record: Syncfy owns the provider-side connection, and FinovAI owns the local user, credential, transaction, webhook, and error records. A user-visible operation is complete only when the required provider-side and local-side effects both match the operation contract below.

The main guardrail: FinovAI must not perform a local-only delete after a retryable Syncfy delete failure. If Syncfy cannot confirm deletion because of a provider outage, timeout, or 5xx error, keep the local credential and transactions intact and ask the user to retry.

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
| 3 | Browser widget | User selects and authenticates the institution. |
| 4 | `POST /api/syncfy/credential` | Store `syncfy_credentials` after the widget returns `id_credential`. |
| 5 | Transaction import | Import immediately if Syncfy returns transaction endpoints. |

Success state:

- `syncfy_users` row exists.
- `syncfy_credentials` row exists.
- Status is `synced` only if there is successful transaction evidence.

Failure state:

- Widget-only errors may have a Syncfy RID but no FinovAI backend row.
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
- Historical transactions can exist for a user whose current credential is `needs_reconnect`.

## Update

| Trigger | Operation | Required behavior |
| --- | --- | --- |
| Widget update/reconnect | `POST /api/syncfy/session` with update credential | Reuse the stored `id_user` and pass the selected credential to the widget. |
| Credential callback | `POST /api/syncfy/credential` | Upsert credential metadata and import any returned transactions. |
| Manual refresh | `POST /api/syncfy/refresh` | Enforce cooldown, import transactions, then mark status. |
| Webhook refresh | `POST /api/syncfy/webhook` | Store event, return `202`, process import in `ctx.waitUntil`. |
| Production cron | Scheduled Worker | Refresh due credentials only. |

Update status rules:

- `synced`: transaction import succeeded or existing credential-tagged transactions prove success.
- `pending_transactions`: credential exists but no readable transactions are available yet.
- `needs_reconnect`: Syncfy reports invalid/expired/failed credential state.

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
| 400/401/404/410 terminal stale state | Delete | Delete credential-scoped rows | `200`, `syncfyCredentialDeleted=false` | Store `syncfy-delete-credential` |
| 429/5xx/network/retryable failure | Keep | Keep | `409` or `502`, `localStateDeleted=false` | Store `syncfy-delete-credential` when Syncfy returned a response |

Why terminal stale states can clean local rows:

- If Syncfy says the credential or user is already invalid/gone, FinovAI cannot repair that credential by keeping the row.
- Local cleanup is acceptable because the provider-side connection is already unusable.
- The cleanup must still be logged so support can see that upstream deletion was attempted but not confirmed as a normal 2xx delete.

## Regression Tests

The worker test suite must keep these cases covered:

- Successful delete calls Syncfy upstream before local cleanup.
- Retryable upstream delete failure preserves local credential and transactions.
- Terminal upstream stale-state delete logs the provider error and removes local stale rows.
- Webhook processing returns `202` before transaction import.
- Refresh treats existing credential-tagged transactions as success when polling returns empty.

Run:

```sh
bun test worker/finance.test.ts
bun run verify
```

PM-ready acceptance criteria:

> A reconnect retry is clean only when the old provider-side Syncfy credential is removed or Syncfy confirms it is already unusable. If Syncfy is temporarily failing, FinovAI must keep the local connection visible and ask the user to retry instead of pretending deletion succeeded.
