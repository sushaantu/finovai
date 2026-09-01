# Syncfy Native Toast Mode + 1-Month First Sync — Design

**Date:** 2026-08-31
**Status:** Approved for planning
**Context:** Follow-up to the Sofia/BBVA 2FA incident (fixed 2026-08-31) and her report that the successful connection took 6–7 minutes with the widget modal open the whole time.

## 1. Problem

After a user completes login + 2FA in the Syncfy widget, the modal **never closes on its own**. It shows Syncfy's "Sesión Iniciada Exitosamente" screen whose only prominent CTA is "Agregar Otra Institución"; the exit is an unmarked X. Verified hands-off in the sandbox (ACME Token 2FA site): the modal was still open 3.5+ minutes after the PIN, while the backend had already imported 728 transactions ~80 seconds in. The user is blocked staring at a dead-end modal while their data is ready behind it.

Secondary problems observed in the same session:

- FinovAI's income prompt ("¿Cuál es tu ingreso mensual?") opened **underneath the still-open widget** — stacked modals.
- A raw **"Failed to fetch"** string got stuck in the connect-page status strip.
- The credential card flashes **"La institución rechazó el acceso"** mid-2FA (the `needs_user` flip from the 410 webhook race) while the user is still typing the token.
- First sync pulls **6 months** of transactions, inflating time-to-first-data during onboarding.

## 2. Decision: use Syncfy's native Status Toast mode

No custom events, no home-grown modal management. Syncfy's official widget configuration ([Paybook/sync-widget config reference](https://github.com/Paybook/sync-widget/blob/master/widget/config.md)) provides:

| Flag | Documented behavior |
| --- | --- |
| `navigation.displayStatusInToast: true` | "Continue process in toast after modal closes." The modal closes itself after the credential form; progress renders in a corner toast. |
| `navigation.quickAnswer: true` | "Show final status after authentication, or wait for data download." Flow ends at login+2FA instead of waiting for the full scrape. |
| `navigation.toastDuration` (already set: 7000) | How long the success toast stays before auto-dismissing. |

### Sandbox verification (2026-08-31, ACME sandbox, local dev)

With both flags on, tested against ACME "Multiple Text (2FA)":

1. Modal **closed itself** immediately after submitting username/password; user returned to the app.
2. The **2FA challenge rendered inside the native toast** (top-right), with its own input and submit — completed it there without any modal.
3. Toast dismissed itself after success; credential reached `healthy` with transactions imported ~2 minutes after creation, all in background while the app was fully usable.

Also verified: `quickAnswer: true` does **not** skip 2FA (ACME Token site still showed the token screen before the success state).

### Blocking discovery: our own cleanup hack kills the native toast

`removeSyncfyFloatingNotifications` in `src/components/SyncfyConnect.tsx` force-removes `.el-notification` and `.pb-w-sync_notification-form` — the exact DOM elements Syncfy's native toast (including its 2FA form) renders into. In the first toast-mode test, our `closed` handler deleted the toast and the 2FA challenge had nowhere to appear. This hack predates toast mode (it cleaned up orphaned toasts in modal mode) and **must be removed** as part of this change.

## 3. Goals

1. After login + 2FA, the user is back in the FinovAI app immediately; sync continues in background (Syncfy toast + our existing "Verificando conexiones" polling).
2. All modal-lifecycle behavior is Syncfy-native (documented config flags + documented `on`/`close()` APIs already in use). Zero invented events.
3. First onboarding sync imports **1 month** of transactions instead of 6, shortening time-to-first-data.
4. No scary transient states during an active widget session.

## 4. Non-goals

- Push/email notification when sync completes (existing in-app polling status is retained; notify-later is a separate effort).
- Backfilling months 2–6 after onboarding (possible follow-up via `SYNCFY_TRANSACTION_LOOKBACK_MONTHS` on later syncs; explicitly out of scope here).
- Any change to webhook handling, lifecycle states, or the worker API.
- Widget version upgrade (stay on the current `@syncfy/authentication-widget` package).

## 5. Design

### 5.1 Widget config (`worker/routes/syncfy.ts`, `SYNCFY_WIDGET_CONFIG.navigation`)

Add two documented flags:

```ts
navigation: {
  // ...existing flags unchanged...
  displayStatusInToast: true,
  quickAnswer: true,
}
```

`toastDuration: 7000` and `socketTimeout: 600_000` stay as-is.

### 5.2 Remove the notification-cleanup hack (`src/components/SyncfyConnect.tsx`)

- Delete `removeSyncfyFloatingNotifications`, `scheduleSyncfyNotificationCleanup`, `SYNCFY_FLOATING_NOTIFICATION_SELECTORS`, `SYNCFY_TWOFA_NOTIFICATION_SELECTOR`, and every call site. Syncfy owns its toast lifecycle (`toastDuration`).
- Keep `widget.close()` in `closeWidget()` (documented method) for teardown paths (route change, logout).

### 5.3 Suppress transient credential-state copy while a widget session is active

While a widget session is open (widget instance exists and has not emitted `closed`), the connect page must not render the `action_required` card copy ("La institución rechazó el acceso…") for the credential being linked in this session; show the neutral "Estamos verificando la conexión…" state instead. After `closed` (or session teardown), render true lifecycle state. This kills the mid-2FA scare flash without touching backend state logic.

### 5.4 Sequence FinovAI's own modals after the session

The income prompt must not open while a widget session is active (including its toast phase — a 2FA input may be pending there). Gate it on session end, defined as: widget `closed` seen (or no widget instance) **and** the linked credential's first import has settled (imported or failed).

### 5.5 Clear stale status-strip errors

The connect-page status strip currently retains raw fetch errors ("Failed to fetch") indefinitely. Replace raw error text with a translated retry message and clear it whenever a new poll attempt starts.

### 5.6 First sync lookback: 6 → 1 month

`worker/lib/syncfy.ts` (`SYNCFY_DEFAULT_TRANSACTION_LOOKBACK_MONTHS = 6`):

- Change the default to `1`.
- The env override `SYNCFY_TRANSACTION_LOOKBACK_MONTHS` (validated 1–24) already exists for all environments — update `wrangler.toml` comment and `.dev.vars.example` to reflect the new default.
- This narrows the `dt_transaction_from` window on `/transactions` pulls (our import loop). Note the institution-side scrape duration is Syncfy's job scope and is not controlled by this window; with toast mode it no longer blocks the user either way.
- Update `worker/finance.test.ts` window assertions accordingly.

## 6. Copy

The Syncfy toast in-toast copy is vendor-rendered (locale `es`) — no work. FinovAI-side copy remains as today except the connect-page status strip retry message (5.5). Existing "FinovAI está trayendo movimientos. Puedes ir a Chat; el análisis estará listo cuando lleguen." already matches the new flow.

## 7. Validation gates (before production)

1. **Sandbox regression (desktop):** ACME Normal, Token (2FA), Multiple Text (2FA) — modal closes after form, 2FA renders in toast, toast auto-dismisses, credential reaches `healthy`, movements import; no stuck toasts after session teardown (the hack removal's regression risk).
2. **Sandbox regression (mobile viewport):** same Token flow at 390×844 — the toast (and its 2FA form) must be usable on small screens. If layout is broken, fall back to `toastPosition` tuning or defer `displayStatusInToast` on small screens and keep `quickAnswer`-only there.
3. **Preview smoke:** existing `smoke:ux:*` suite passes (capture flow unchanged server-side).
4. **Production validation:** one real BBVA connection with token móvil (app push, code 413) after deploy — confirm the push challenge surfaces in the toast and the credential completes. Sofia's account or an internal BBVA test account.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| BBVA token móvil (413 push) behaves differently from ACME typed token | Mechanism verified via ACME; production validation gate #4; `quickAnswer` demonstrably does not skip challenges |
| Toast unusable on mobile | Gate #2 with explicit fallback plan |
| Orphaned toasts return after hack removal | Toast lifecycle is now vendor-managed (`toastDuration`); teardown still calls `widget.close()`; gate #1 checks explicitly |
| 1-month window feels thin for analysis | Env override allows raising per environment without deploy; backfill is a listed follow-up |

## 9. Rollout

Standard pipeline: local sandbox verification → preview deploy + smoke → production deploy → gate #4 validation. Single PR; the lookback change and widget change are independently revertable (one-line each).
