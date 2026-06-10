# Syncfy Vendor Reference

## PM-Ready Summary

Syncfy/Paybook is not a fire-and-forget widget. The widget creates or updates a credential, but FinovAI must still run the backend data path: start a credential pull, follow the returned job/status URL, read transactions, and store imported movements before the connection is useful in chat or the dashboard.

Transport success is not data success. A `200` in Syncfy HTTP logs only proves the API request or webhook delivery completed; it does not prove that transactions are available or imported.

## Source References

- Paybook samples repository: <https://github.com/Paybook/sync-code-samples>
- New credential sample: <https://github.com/Paybook/sync-code-samples/blob/master/nodejs/examples/credential/create.js>
- Existing credential pull sample: <https://github.com/Paybook/sync-code-samples/blob/master/nodejs/examples/credential/put.js>
- Transaction read sample: <https://github.com/Paybook/sync-code-samples/blob/master/nodejs/examples/transaction/get.js>
- Widget config sample: <https://github.com/Paybook/sync-code-samples/blob/master/widget/config.md>
- Widget event sample: <https://github.com/Paybook/sync-code-samples/blob/master/widget/events.md>
- Widget method sample: <https://github.com/Paybook/sync-code-samples/blob/master/widget/methods.md>
- Webhook event sample: <https://github.com/Paybook/sync-code-samples/blob/master/webhooks/sync/events.md>

The local investigation also used the Syncfy quickstart/docs snippets supplied in this thread for Users, Sessions, Accounts, Credentials, and Transactions.

## Entity Lifecycle

| Step | Syncfy object | Endpoint | FinovAI responsibility |
| --- | --- | --- | --- |
| 1 | User | `POST /v1/users` | Create/reuse one Syncfy user per FinovAI email and persist `id_user`. |
| 2 | Session | `POST /v1/sessions` | Create a short-lived widget token for that `id_user`. |
| 3 | Widget | `SyncfyWidget` | Let the user authenticate the institution in Syncfy UI. |
| 4 | New credential | `POST /v1/credentials/pulls` inside widget/provider flow | Syncfy creates the provider-side credential. Without this, FinovAI has nothing to import. |
| 5 | Pull | `PUT /v1/credentials/:id_credential/pulls` | Explicitly start/follow a credential refresh; do not rely on webhook delivery alone. |
| 6 | Job status | Returned `/v1/jobs/:id/status` URL | Poll/follow until terminal or readable transaction endpoints appear. |
| 7 | Transactions | `GET /v1/transactions?id_credential=...` | Page through readable rows, normalize, and upsert into `transactions`. |

## New Credential Creation Contract

Paybook's create-credential sample calls:

```text
POST /v1/credentials/pulls?pretty=1
```

with the Syncfy user, site, username/password, and authentication fields. The Syncfy widget performs this same class of operation during first-time institution linking.

Operational rule:

- If this call returns `402 Payment Required`, the Syncfy API key/account is not entitled to create new credentials. This blocks the flow before FinovAI can receive a credential callback, webhook, transactions, or chat context.
- A `200` on other Syncfy requests such as `/sessions`, `/catalogues/...`, `/credentials/:id/pulls`, `/jobs/:id/status`, or `/transactions` does not prove new credential creation is enabled.
- Sandbox ACME validation requires both a sandbox-capable key and `enableTestMode: true` in the widget configuration.

## Existing Credential Pull Contract

Paybook's Node sample calls:

```text
PUT /v1/credentials/:id_credential/pulls?pretty=1
```

Then it reads `response.status` and polls that job-status URL. FinovAI mirrors this in `worker/index.ts` through the credential import/refresh path.

Important terminal codes from the Paybook sample:

| Code | Meaning | FinovAI status implication |
| --- | --- | --- |
| `200` | Finished; data processed | Import transactions, mark `synced` if rows exist. |
| `201` | Processed, pending background data | Keep `pending_transactions`, retry later. |
| `202` | Finished with no transactions | Keep credential, record no rows, retry on schedule. |
| `203` | Partial transactions | Import available rows, keep support visibility. |
| `204` | Incomplete data | Keep `pending_transactions` unless rows prove success. |
| `206` | No accounts | Keep support visibility; no usable movements yet. |
| `401` | Invalid credential | Mark `needs_reconnect`. |
| `500`, `501`, `504`, `509` | Provider/script/maintenance failures | Keep retryable state and log the Syncfy RID/error. |

## Transaction Read Contract

Paybook's transaction sample reads:

```text
GET /v1/transactions?id_credential=:id_credential&id_account=:id_account
```

FinovAI reads by credential and paginates. It stores imported movements with `source = 'syncfy'` and includes credential evidence in `raw_source` for support/debugging.

The user-facing app is not successful until imported transactions are visible in:

- the Movimientos page,
- summary calculations,
- and chat answers grounded in those movements.

## Widget Event Contract

The widget can emit `opened`, `closed`, `updated`, `status`, `success`, and `error`.

FinovAI should treat widget events as connection progress, not final data proof:

- `success` means a credential exists or was updated.
- `error` can happen even when Syncfy created a credential but has not produced data yet.
- After any credential signal, FinovAI must re-read credential state and attempt the backend import path.

For reconnect/update flows, Paybook's widget methods include `setEntrypointCredential(id_credential)`, which opens the widget directly on an existing credential.

## Webhook Contract

Syncfy webhook events such as `credentials.created`, `credentials.updated`, `credentials.deleted`, and `credentials.refreshed` are useful for background import and audit.

The `credentials.refreshed` sample can include transaction endpoints under:

```text
payload.endpoints.transactions[]
```

FinovAI should import those endpoints when present, but it must also support direct pull/job/transaction reads because webhook delivery can be delayed, absent, or only transport-successful.

## Operational Rules

- Production must use the authorized `@finovai` Syncfy account.
- Preview/local validation must use Syncfy sandbox credentials before production changes.
- Do not swap production to a candidate Syncfy key until that key passes `POST /v1/credentials/pulls` against sandbox/test or a controlled production institution.
- Never store Syncfy API keys or webhook secrets in this document.
- Do not equate Syncfy HTTP `200` with imported movements.
- A connection is healthy only when credential state and transaction evidence both agree.

PM-ready reviewer note:

> The Syncfy integration is correct only if the full data chain works: user, session, widget credential, credential pull, job status, transaction read, FinovAI transaction storage, movements UI, and chat over those movements. Any review that stops at webhook or HTTP `200` status is incomplete.
