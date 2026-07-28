# DRY KISS Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce duplicated finance/schema/helper logic and simplify the highest-risk FinovAI code paths without changing product behavior.

**Architecture:** Move shared pure finance rules into `shared/finance-core.ts`, keep Worker-specific I/O in `worker/index.ts`, and keep Dashboard rendering in `src/components/Dashboard.tsx`. Use focused tests to lock parity before replacing duplicated implementations.

**Tech Stack:** Bun, TypeScript, React, Cloudflare Workers, D1, existing Bun test suite.

---

### Task 1: Schema Drift Guard

**Files:**
- Create: `worker/schema-drift.test.ts`
- Modify: `worker/index.ts`

- [x] **Step 1: Write failing schema drift test**

```ts
import { expect, test } from 'bun:test'

test('runtime transaction schema keeps MXN as the default currency', async () => {
  const workerSource = await Bun.file('worker/index.ts').text()
  const schemaSource = await Bun.file('worker/schema.sql').text()

  expect(schemaSource).toContain("currency TEXT NOT NULL DEFAULT 'MXN'")
  expect(workerSource).not.toContain("currency TEXT NOT NULL DEFAULT 'CLP'")
  expect(workerSource).toContain("currency TEXT NOT NULL DEFAULT 'MXN'")
})
```

- [x] **Step 2: Run red test**

Run: `bun test worker/schema-drift.test.ts`
Expected: FAIL because `worker/index.ts` still contains `DEFAULT 'CLP'`.

- [x] **Step 3: Fix runtime schema default**

Change the `transactions.currency` default inside `ensureFinanceTables` from `CLP` to `MXN`.

- [x] **Step 4: Run green test**

Run: `bun test worker/schema-drift.test.ts`
Expected: PASS.

### Task 2: Shared Finance Core

**Files:**
- Create: `shared/finance-core.ts`
- Create: `shared/finance-core.test.ts`
- Modify: `worker/index.ts`
- Modify: `src/components/Dashboard.tsx`
- Modify: `tsconfig.json`
- Modify: `worker/tsconfig.json`
- Modify: `package.json`

- [x] **Step 1: Write failing finance-core parity test**

```ts
import { expect, test } from 'bun:test'
import {
  buildCategoryAnalysis,
  buildFinancialSummary,
  buildDashboardDebtGate,
  DEFAULT_FINANCE_CURRENCY,
  EXPENSE_CATEGORIES,
} from './finance-core'

test('finance core uses the FinovAI MXN category model', () => {
  expect(DEFAULT_FINANCE_CURRENCY).toBe('MXN')
  expect(EXPENSE_CATEGORIES).toContain('Deuda')
  expect(EXPENSE_CATEGORIES).toContain('Inversión')
})

test('finance core computes summary, budget analysis, and debt gate from one source', () => {
  const transactions = [
    transaction('2026-05-01', 'income', 100000, 'Sueldo', 'Nomina'),
    transaction('2026-05-02', 'expense', 43000, 'Deuda', 'AMERICAN EXPRESS pago minimo'),
    transaction('2026-05-03', 'expense', 12000, 'Comida fuera', 'Restaurante'),
    transaction('2026-04-03', 'expense', 5000, 'Comida fuera', 'Restaurante'),
  ]
  const profile = {
    email: 'user@example.com',
    currency: 'MXN',
    monthlyIncome: 100000,
    monthlyBudget: 65000,
    categoryBudgets: { Deuda: 30000, 'Comida fuera': 8000 },
  }

  const summary = buildFinancialSummary(transactions)
  const analysis = buildCategoryAnalysis(transactions, summary, profile)
  const debtGate = buildDashboardDebtGate(summary, transactions, profile.monthlyIncome)

  expect(summary.month).toBe('2026-05')
  expect(analysis.categories[0]).toMatchObject({ category: 'Deuda', budgetStatus: 'over' })
  expect(debtGate.active).toBe(true)
})

function transaction(date: string, type: 'income' | 'expense', amount: number, category: string, description: string) {
  return {
    id: `${date}-${category}`,
    email: 'user@example.com',
    date,
    type,
    amount,
    currency: 'MXN',
    category,
    description,
    merchant: description,
    notes: null,
    source: 'syncfy' as const,
    confidence: 1,
    rawSource: null,
    cartolaImportId: null,
    created_at: `${date}T00:00:00.000Z`,
  }
}
```

- [x] **Step 2: Run red test**

Run: `bun test shared/finance-core.test.ts`
Expected: FAIL because `shared/finance-core.ts` does not exist.

- [x] **Step 3: Create `shared/finance-core.ts`**

Move pure finance constants, types, category analysis, summary, debt gate, currency formatting, and investment projection helpers out of `worker/index.ts`.

- [x] **Step 4: Replace duplicate Worker/Dashboard logic**

Import the shared exports in `worker/index.ts` and `src/components/Dashboard.tsx`; remove local duplicates only after tests pass.

- [x] **Step 5: Run green tests**

Run: `bun test shared/finance-core.test.ts worker/finance.test.ts`
Expected: PASS.

### Task 3: Repeated Helper Extraction

**Files:**
- Create: `src/lib/use-reveal-once.ts`
- Create: `scripts/smoke-utils.ts`
- Modify: marketing components and smoke scripts that duplicate helper code.

- [x] **Step 1: Add a minimal helper test when practical**

For script helpers, add `scripts/smoke-utils.test.ts` covering `asRecord`, `stringField`, and `requestJson` shape.

- [x] **Step 2: Replace duplicated helpers**

Use `useRevealOnce` in marketing components and `scripts/smoke-utils.ts` in smoke scripts.

- [x] **Step 3: Run focused tests**

Run: `bun test scripts/smoke-utils.test.ts`
Expected: PASS.

### Task 4: Verification

**Files:**
- Modify: `package.json`

- [x] **Step 1: Add new tests to `verify`**

Include `worker/schema-drift.test.ts`, `shared/finance-core.test.ts`, and `scripts/smoke-utils.test.ts`.

- [x] **Step 2: Run project verification**

Run: `bun run verify`
Expected: PASS.
