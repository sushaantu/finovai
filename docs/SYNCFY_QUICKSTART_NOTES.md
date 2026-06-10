# Syncfy Quickstart Notes

## PM-Ready Summary

The bank-connect feature is only useful after the full Syncfy chain completes: FinovAI user, Syncfy user, widget session, provider credential, credential pull, transaction read, local transaction import, and chat/dashboard visibility.

This file captures the Syncfy quickstart and entity docs used during the June 2026 incident review. It intentionally excludes API keys, webhook secrets, and real user credentials.

## Reference Sources

- Paybook sample repo: <https://github.com/Paybook/sync-code-samples>
- Widget config: <https://github.com/Paybook/sync-code-samples/blob/master/widget/config.md>
- Widget events: <https://github.com/Paybook/sync-code-samples/blob/master/widget/events.md>
- Create credential sample: <https://github.com/Paybook/sync-code-samples/blob/master/nodejs/examples/credential/create.js>
- Refresh credential sample: <https://github.com/Paybook/sync-code-samples/blob/master/nodejs/examples/credential/put.js>
- Transaction read sample: <https://github.com/Paybook/sync-code-samples/blob/master/nodejs/examples/transaction/get.js>

## Required Entity Flow

| Step | Entity | Endpoint | Notes |
| --- | --- | --- | --- |
| 1 | User | `POST /v1/users` | Store Syncfy `id_user` against FinovAI email. Use `id_external` for FinovAI correlation. |
| 2 | Session | `POST /v1/sessions` | Returns a short-lived widget token. Sessions expire after inactivity. |
| 3 | Widget | `SyncfyWidget` | Browser opens the Syncfy UI with the session token. Sandbox must pass `enableTestMode: true`. |
| 4 | Credential | `POST /v1/credentials/pulls` | First-time institution linking creates the provider credential. `402 Payment Required` blocks the whole flow. |
| 5 | Pull | `PUT /v1/credentials/:id_credential/pulls` | Existing credential refresh starts or restarts provider data collection. |
| 6 | Job | `GET /v1/jobs/:id/status` | Poll/follow status when Syncfy returns a job URL. |
| 7 | Accounts | `GET /v1/accounts?id_credential=...` | Optional account metadata for display/debug. |
| 8 | Transactions | `GET /v1/transactions?id_credential=...` | Import movements into FinovAI `transactions` with `source = 'syncfy'`. |

## Key Entity Fields

User:

- `id_user`: Syncfy's user ID.
- `id_external`: FinovAI-owned correlation ID.
- `name`: user display name.
- `dt_create`, `dt_modify`: Syncfy timestamps.

Session:

- `token`: short-lived widget access token.

Credential:

- `id_credential`: Syncfy credential ID.
- `id_user`: owning Syncfy user.
- `id_site`, `id_site_organization`, `id_site_organization_type`: institution/site identifiers.
- `is_authorized`, `is_locked`, `is_twofa`, `can_sync`, `ready_in`, `code`: provider state signals.
- Credentials are encrypted by Syncfy and are not returned in plain text.

Account:

- `id_account`, `id_credential`, `id_user`: account and ownership IDs.
- `name`, `number`, `balance`, `currency`, `account_type`: account display data.
- `site`: institution metadata.

Transaction:

- `id_transaction`, `id_account`, `id_credential`, `id_user`: movement IDs and ownership IDs.
- `description`, `amount`, `currency`, `dt_transaction`: movement data.
- `is_pending`, `is_deleted`, `is_disable`: status flags.
- Syncfy commonly returns around 60 days of movements, depending on the institution/source.

## Sandbox Test Notes

Paybook ACME validation must prove two separate things:

1. The widget is in test mode and shows ACME test institutions.
2. The API key/account can create a new credential through `POST /v1/credentials/pulls`.

Seeing Syncfy HTTP `200` rows for sessions, catalogues, jobs, pulls, or transactions is not enough. New bank linking can still be blocked if `POST /v1/credentials/pulls` returns `402 Payment Required`.

## Acceptance Criteria

- A newly signed-up FinovAI user can open the widget.
- The user can create a provider credential.
- FinovAI receives or re-reads the credential.
- FinovAI imports at least one transaction when the provider exposes rows.
- Movements page shows imported rows.
- Chat can answer using those imported movements.

