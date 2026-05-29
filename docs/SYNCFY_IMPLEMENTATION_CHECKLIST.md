# Syncfy Implementation Checklist

## PM-Ready Status

FinovAI now has the core Syncfy operating model in place: one Syncfy user per FinovAI user, `id_external` mapping, stored `id_user`, widget session creation, email-scoped dashboard sessions, Cloudflare Email passwordless login support, credential/webhook/error storage, `rid` capture, refresh cooldowns, and Syncfy transaction import into the same dashboard analysis tables.

## Configure In Syncfy

- Production webhook URL: `https://finov.ai/api/syncfy/webhook`
- Worker URL: `https://finovai.my-cloudflare-711.workers.dev/api/syncfy/webhook`
- Subscribe to `credentials.refresh`.
- Use separate Sandbox and Production webhook URLs in Syncfy.
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
| Webhooks | DONE | `/api/syncfy/webhook` stores raw events and upserts credential state. |
| `credentials.refresh` handling | DONE | Refresh events read Syncfy-provided transaction endpoints and import new/updated movements. |
| Error `rid` storage | DONE | Syncfy API failures and webhook payloads store `rid` when present. |
| Widget integration | DONE | Dashboard embeds `@syncfy/authentication-widget`, locks country to Mexico, supports credential creation/update, and handles widget events. |
| Pull/rate-limit behavior | DONE | Backend enforces a 5-minute pull cooldown per credential and the dashboard disables refresh while cooling down. |
| API-change tolerance | DONE | Payload extraction is flexible around nested `response`, `data`, `credential`, `credentials`, `extra`, and variable field names. |
| Dashboard access control | DONE | Production dashboard APIs require a browser-held client secret created during email signup, so email-only reads are blocked. |
| Email account recovery | READY | `/api/auth/request-link` and `/api/auth/verify` support passwordless codes/links through Cloudflare Email. Turn on `EMAIL_AUTH_REQUIRED` after Email Sending is enabled for `finov.ai`. |
| Legacy flow shutdown | DONE | Generic expenses, legacy chat, manual entry, and bank-statement backup imports are disabled in production unless explicitly re-enabled. |
| Security | PARTIAL | API key stays server-side and browser uses widget session token. Webhook shared-secret verification should be enabled after the Syncfy dashboard sends the same header. |
| Docs/tests | PARTIAL | Unit tests cover path, transaction normalization, dashboard session auth, and production legacy-gating. ACME Bank sandbox and load testing still require Syncfy dashboard access. |

## Technical Notes

- Syncfy user table: `syncfy_users`
- Credential lifecycle table: `syncfy_credentials`
- Webhook audit table: `syncfy_webhook_events`
- Error support table: `syncfy_errors`
- Dashboard session table: `dashboard_sessions`
- Email login challenge table: `email_login_challenges`
- Internal status endpoint: `GET /api/syncfy/status?email=<user>` requires the webhook secret in production.

## Remaining Work

1. Configure Syncfy dashboard webhook subscription for production and sandbox.
2. Enable `SYNCFY_WEBHOOK_SECRET` after Syncfy is configured to send the matching header.
3. Enable Cloudflare Email Sending for `finov.ai`, then set `EMAIL_AUTH_REQUIRED = "true"`.
4. Run ACME Bank sandbox tests across access types before changing sandbox behavior.
5. Add load tests once expected traffic is known.

## Beta Launch Guardrails

- Invite a small first cohort and ask users to stay on the same browser/device during the beta session.
- Ask users to send the email used, institution name, timestamp, and screenshot for Syncfy connection issues.
- Do not describe FinovAI as moving money or initiating investments. It analyzes transactions and routes interested users toward partner investment platforms.
