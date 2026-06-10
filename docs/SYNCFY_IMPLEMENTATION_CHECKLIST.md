# Syncfy Implementation Checklist

## PM-Ready Status

FinovAI now has the core Syncfy operating model in place: one Syncfy user per FinovAI user, `id_external` mapping, stored `id_user`, widget session creation, email-scoped dashboard sessions, Cloudflare Email passwordless login support, credential/webhook/error storage, `rid` capture, refresh cooldowns, and Syncfy transaction import into the same dashboard analysis tables. The default transaction pull requests six months of history with `dt_transaction_from` / `dt_transaction_to` and paginates up to 5,000 rows per import.

## Configure In Syncfy

- Production webhook URL: `https://finov.ai/api/syncfy/webhook`
- Sandbox/preview webhook URL: `https://finovai-preview.my-cloudflare-711.workers.dev/api/syncfy/webhook`
- Production webhook is configured in Paybook/Syncfy with `credentials.created`, `credentials.updated`, `credentials.deleted`, and `credentials.refreshed`.
- Sandbox uses its own webhook endpoint before production promotion.
- Use the authorized `@finovai` Syncfy workspace for both sandbox and production configuration.
- If Syncfy supports custom headers, send either `Authorization: Bearer <SYNCFY_WEBHOOK_SECRET>` or `x-finovai-webhook-secret: <SYNCFY_WEBHOOK_SECRET>`.

## Wrangler Secrets

```sh
direnv exec /Users/sushaantu/Developer bunx wrangler secret put SYNCFY_API_KEY
direnv exec /Users/sushaantu/Developer bunx wrangler secret put SYNCFY_WEBHOOK_SECRET
```

## Checklist Mapping

| Area | Status | Notes |
| --- | --- | --- |
| User management | DONE | `/api/syncfy/session` creates one Syncfy user per email, sends `id_external`, and stores Syncfy `id_user`. |
| Transaction storage | DONE | Syncfy transactions are normalized and upserted into `transactions` with `source = syncfy`. |
| Credential ID storage | DONE | `syncfy_credentials` stores `syncfy_credential_id`, Syncfy user/site IDs, status, refresh timestamps, and raw payload. |
| Webhooks | DONE | `/api/syncfy/webhook` stores raw events, verifies `SYNCFY_WEBHOOK_SECRET`, acknowledges with `202`, and processes imports in the background. |
| `credentials.refreshed` handling | DONE | Refresh events read Syncfy-provided transaction endpoints and import new/updated movements. |
| Historical transaction window | DONE | Default credential pulls request the last 6 months; override with `SYNCFY_TRANSACTION_LOOKBACK_MONTHS` if product needs a different baseline. |
| Error `rid` storage | DONE | Syncfy API failures and webhook payloads store `rid` when present. |
| Widget integration | DONE | Dashboard embeds `@syncfy/authentication-widget`, locks country to Mexico, supports credential creation/update, and handles widget events. |
| Pull/rate-limit behavior | DONE | Backend enforces a 5-minute pull cooldown per credential and the dashboard disables refresh while cooling down. |
| API-change tolerance | DONE | Payload extraction is flexible around nested `response`, `data`, `credential`, `credentials`, `extra`, and variable field names. |
| Dashboard access control | DONE | Production dashboard APIs require a browser-held client secret created during email signup, so email-only reads are blocked. |
| Email account recovery | READY | `/api/auth/request-link` and `/api/auth/verify` support passwordless codes/links through Cloudflare Email. Turn on `EMAIL_AUTH_REQUIRED` after Email Sending is enabled for `mail.finov.ai`. |
| Legacy flow shutdown | DONE | Generic expenses, legacy chat, manual entry, and bank-statement backup imports are disabled in production unless explicitly re-enabled. |
| Security | DONE | API key stays server-side, browser uses widget session tokens, and production Syncfy webhooks are protected with a shared-secret header. |
| Docs/tests | DONE | Unit tests cover path, transaction normalization, dashboard session auth, production legacy-gating, nested webhook envelopes, webhook `waitUntil`, stored-transaction fallback, sandbox widget test mode, and stale Syncfy-state cleanup. |

## Technical Notes

- Architecture doc: [SYNCFY_ARCHITECTURE.md](SYNCFY_ARCHITECTURE.md)
- Syncfy user table: `syncfy_users`
- Credential lifecycle table: `syncfy_credentials`
- Webhook audit table: `syncfy_webhook_events`
- Error support table: `syncfy_errors`
- Dashboard session table: `dashboard_sessions`
- Email login challenge table: `email_login_challenges`
- Internal status endpoint: `GET /api/syncfy/status?email=<user>` requires the webhook secret in production.

## Remaining Work

1. Resolve Syncfy account/API-key entitlement for new credential creation. Local sandbox and direct API verification must pass `POST /v1/credentials/pulls`; `402 Payment Required` blocks bank linking before FinovAI can import movements.
2. Enable Cloudflare Email Sending for `mail.finov.ai`, then set `EMAIL_AUTH_REQUIRED = "true"`.
3. Keep validating sandbox ACME Bank tests before changing production behavior.
4. Add load tests once expected traffic is known.

## Beta Launch Guardrails

- Invite a small first cohort and ask users to stay on the same browser/device during the beta session.
- Ask users to send the email used, institution name, timestamp, and screenshot for Syncfy connection issues.
- Do not describe FinovAI as moving money or initiating investments. It analyzes transactions and routes interested users toward partner investment platforms.
