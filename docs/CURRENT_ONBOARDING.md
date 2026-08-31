# Current Onboarding (as of 2026-07-29)

There is **no multi-step wizard**. First-run uses a **smart redirect** to Conectar cuenta, explicit institution error recovery, clearer pending-movement copy, and a **skippable income prompt** after the first successful transaction sync.

---

## Happy path

```
Landing CTA ("Conectar mi banco" / "Iniciar sesión")
  → /dashboard email gate
  → OTP / magic link (prod) or immediate session (non-prod)
  → If no healthy Syncfy credential and page is Chat → auto /connect
  → Syncfy widget → credential stored
  → pending_transactions waiting copy while movements prepare, or:
      action_required → explain rejected access + "Actualizar acceso"
      provider_unavailable → explain provider incident + automatic retry
      support_required → explain FinovAI review + support code
  → First transactions arrive
  → Income prompt (skippable; dismissed per email in localStorage)
  → Chat / Movimientos / Categorías become useful
  → (optional) Ajustes: budget / household / finer caps
```

Nav stays fully usable (not a hard gate). Income is asked only after transactions exist.

---

## Step-by-step

### 1. Marketing entry

| Surface | Behavior | Files |
|---------|----------|-------|
| `/` landing | CTAs → `navigate('/dashboard')` | `src/components/LandingPage.tsx`, `src/App.tsx` |
| Claimed journey | Conecta → Analiza → Invierte | `HowItWorksSection` |

Email gate copy tells users they are entering to connect their bank. Post-auth smart redirect fulfills the CTA.

### 2. Auth / session

| Flow | What happens |
|------|----------------|
| Dashboard email gate | `POST /api/signup` → optional OTP → `POST /api/auth/verify` → `setDashboardSession` |
| Magic link | `?email=&login_token=` verified in `App.tsx`, then `/dashboard` |

Session keys: `finovai_signup_email`, `finovai_dashboard_secret`.

### 3. Smart redirect

In `Dashboard.tsx`, after credentials load: if `activeEmail` is set, page is `inicio` (Chat), and there is **no healthy connected institution** (including reconnect-only cases), navigate to `syncfy` (`/connect`).

Does **not** redirect when the user is already on Movimientos, Categorías, Ajustes, or Conectar cuenta.

### 4. Primary nav

| Page | Path | Onboarding role |
|------|------|-----------------|
| Chat | `/dashboard` | Soft nudges; auto-redirects to connect when empty |
| Conectar cuenta | `/connect` | Bank link + pending/error recovery UX |
| Movimientos | `/movements` | Empty / data after sync |
| Categorías | `/categories` | Stronger after income |
| Ajustes | `/settings` | Full profile / household |

### 5. Bank connection (Syncfy)

UI: `src/components/SyncfyConnect.tsx`

- Empty: connect CTA copy
- `pending_transactions`: “FinovAI está trayendo movimientos…” (Chat still allowed)
- `action_required`: persistent rejected-access reason, last attempt, support code, and `Actualizar acceso`
- `provider_unavailable`: persistent provider-incident reason, last attempt, support code, and retry expectation
- `support_required`: persistent FinovAI-review reason, last attempt, and support code
- Synced: normal manage/sync UI

### 6. Income prompt (post-sync)

Trigger: `transactions.length > 0`, profile income missing, and prompt not dismissed for this email.

- Dialog: income only → `PATCH /api/profile`
- Skip / “Ahora no” → `dismissIncomePrompt(email)` in `src/lib/onboarding.ts`
- Also opens from Syncfy `onSynced` when the first transaction payload arrives

Budget / category caps stay in Ajustes.

### 7. Soft nudges (still present)

Chat welcome, connect chip, header nudge, Movimientos empty card, action-plan fallback.

---

## Bank name bug on Conectar cuenta

### Status

**Fixed (2026-07-27)** and deployed. Channel labels like `Personal` are rejected or replaced via organization catalogue enrichment on GET credentials; failed enrich no longer clears labels to raw credential IDs.

---

## Key files

| Concern | Path |
|---------|------|
| Smart redirect + income dialog | `src/components/Dashboard.tsx` |
| Income dismiss flags | `src/lib/onboarding.ts` |
| Connect / pending + error recovery UX | `src/components/SyncfyConnect.tsx` |
| Session | `src/lib/dashboard-session.ts` |
| Auth + Syncfy + profile APIs | `worker/index.ts` |
