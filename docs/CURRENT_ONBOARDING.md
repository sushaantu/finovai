# Current Onboarding (as of 2026-07-27)

There is **no dedicated onboarding wizard**. New users reach a usable dashboard through an emergent path: marketing CTA → email gate → chat-first dashboard with soft “Conectar cuenta” nudges → Syncfy widget → transaction import. Profile and household live under Ajustes and are optional.

Related investigation: bank names on the integrations list are often wrong — see [Bank name bug](#bank-name-bug-on-conectar-cuenta) below.

---

## Happy path

```
Landing CTA ("Conectar mi banco" / "Iniciar sesión")
  → /dashboard email gate
  → OTP / magic link (prod) or immediate session (non-prod)
  → Chat (inicio) with welcome + "Conectar cuenta" chip
  → /connect → Syncfy widget → credential stored
  → refresh / webhook imports transactions
  → Movimientos / Categorías / Chat become useful
  → (optional) Ajustes: income / budget / household
```

“Usable” is defined by **transactions existing**, not by profile completion.

---

## Step-by-step

### 1. Marketing entry

| Surface | Behavior | Files |
|---------|----------|-------|
| `/` landing | `LandingPage` CTAs call `onConnect()` → `navigate('/dashboard')` | `src/components/LandingPage.tsx`, `src/App.tsx` |
| Claimed journey | Conecta → Analiza → Invierte | `HowItWorksSection` |

**Mismatch:** CTA copy says “Conectar mi banco” but the first screen is the **email gate**, not Syncfy.

### 2. Auth / session

| Flow | What happens |
|------|----------------|
| Dashboard email gate | `POST /api/signup` → optional OTP → `POST /api/auth/verify` → `setDashboardSession` |
| Magic link | `?email=&login_token=` verified in `App.tsx`, then `/dashboard` |
| Legacy `EmailSignup` | Still on tool-page `Navbar`; not on current landing |

Session keys: `finovai_signup_email`, `finovai_dashboard_secret`. API auth uses `X-FinovAI-Dashboard-Secret`. Email alone is not enough.

Files: `src/lib/dashboard-session.ts`, `src/components/Dashboard.tsx` (`handleIdentify`), `worker/index.ts` (signup / verify).

### 3. Post-auth product surface

Primary nav (`DASHBOARD_PAGES` in `Dashboard.tsx`):

| Page | Path | Onboarding role |
|------|------|-----------------|
| Chat | `/dashboard` | **Default** after auth |
| Conectar cuenta | `/connect` | Bank link (Syncfy) |
| Movimientos | `/movements` | Empty state + connect CTA |
| Categorías | `/categories` | Weak without profile |
| Ajustes | `/settings` | Income / budget / household |

Hidden but implemented: `/import` (cartola), `/analysis` (orphaned from nav).

There is **no** forced redirect to `/connect`, **no** checklist, **no** completion flag, **no** blocking modal.

### 4. Soft nudges (the only “onboarding”)

1. Chat welcome via `buildDashboardChatOpening` — pushes to Conectar cuenta when empty / reconnect needed
2. Chat suggestion chip — “Conectar cuenta” / “Reconectar cuenta”
3. Header nudge on non-chat pages when no active credential
4. Movimientos empty card
5. Action-plan fallback copy

### 5. Bank connection (Syncfy)

UI: `src/components/SyncfyConnect.tsx`

1. “Conectar institución” → `POST /api/syncfy/session`
2. Mount Syncfy authentication widget (MX locked)
3. On success → `POST /api/syncfy/credential`
4. Poll credentials + auto `POST /api/syncfy/refresh`
5. Webhooks / refresh import rows into `transactions` (`source = syncfy`)

Connected ≠ data ready. Statuses include `pending_transactions` and `needs_reconnect`.

### 6. Profile / household (optional)

Under **Ajustes** only — never gated as step 0/2.

- Income, monthly budget, per-category caps → `PATCH /api/profile`
- Household invite → `POST /api/household/invite` (accept flow incomplete; invite query params unused on frontend)

Without income, savings % and budget UI stay weak; chat may tell the user to go to Ajustes.

---

## Gaps / UX friction

1. CTA promises bank connect; user hits email gate then Chat.
2. No guided wizard — connect is nudged, never enforced.
3. Profile never prompted early; analysis quality suffers.
4. Household invite link has no accept UI.
5. Cartola/manual/analisis exist but contradict the bank-first product path.
6. Landing step “Invierte” is aspirational (chat/action-plan language), not a real partner flow.
7. Connected-but-empty Syncfy state is easy to misread as a failed link.
8. Sandbox Syncfy credential-create can 402 — blocks bank onboarding entirely.

---

## Bank name bug on Conectar cuenta

### Status

**Fixed (2026-07-27)** and deployed to preview. Channel labels like `Personal` / `Token & captcha` are rejected; GET `/api/syncfy/credentials` backfills organization catalogue names and overwrites useless stored labels.

### Symptom (before fix)

Connected banks on the integrations list (`SyncfyConnect`) often showed a **credential Mongo ID**, or a misleading label like `Personal` / `Token & captcha`, instead of the bank brand (e.g. “BBVA México”).

### Root cause

Syncfy’s **site `name`** is an auth/channel label, not the institution brand. The real bank name lives on **site organizations**. FinovAI previously stored site labels as `site_name`, queried `/catalogues/organizations/sites` first, and loaded credentials on GET without enrichment.

---

## Key files

| Concern | Path |
|---------|------|
| Routing / magic link | `src/App.tsx` |
| Session | `src/lib/dashboard-session.ts` |
| Landing CTAs | `src/components/LandingPage.tsx` |
| Email gate + nudges + pages | `src/components/Dashboard.tsx` |
| Integrations UI | `src/components/SyncfyConnect.tsx` |
| Auth + Syncfy + profile APIs | `worker/index.ts` |
| Finance guidance | `shared/finance-core.ts` |
