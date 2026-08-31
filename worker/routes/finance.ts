import {
  DASHBOARD_CHAT_BENCHMARK_CASES,
} from '../dashboard-chat-benchmark'
import {
  DEFAULT_FINANCE_CURRENCY,
  buildActionPlan,
  buildCategoryAnalysis,
  buildDashboardIncomeGuidance,
  buildExpenseCategoryBreakdown,
  buildFinancialInsights,
  buildFinancialStageAssessment,
  buildFinancialSummary,
  finalizeDashboardChatAnswer,
  formatFinanceCurrency,
  getFinanceCategoriesForType,
  normalizeCategoryInput,
  roundMoney,
} from '../../shared/finance-core'
import type {
  DashboardFinancialStage,
  FinanceTransaction,
  FinanceTransactionSource,
  FinanceTransactionType,
  FinancialProfile,
} from '../../shared/finance-core'
import {
  cleanText,
  error,
  escapeHtml,
  getAppOrigin,
  inferFinanceMerchant,
  isFeatureEnabled,
  isProductionEnv,
  json,
  normalizeFinancialAmount,
  normalizeFinancialDate,
  normalizeSignupEmail,
  resolveFinanceCategory,
  verifyDashboardEmailAccess,
} from '../lib/shared'
import type {
  DashboardQuestionBenchmark,
  Env,
  Expense,
  ExpenseSummary,
  FinanceTransactionRow,
  FinancialProfileRow,
  HouseholdInvite,
  HouseholdInviteRow,
  NormalizedSyncfyTransaction,
  SyncfyTransactionImportResult,
  SyncfyUserRow,
} from '../lib/shared'
import {
  ensureFinanceTables,
  ensureHouseholdTables,
  ensureSyncfyTables,
  storeSyncfyError,
  upsertFinancialProfile,
} from '../lib/db'
import {
  getDashboardChatModel,
  runAIResponse,
} from '../lib/ai'
import {
  SyncfyRequestError,
  buildSyncfyUserMessage,
  getSyncfyCredentialCooldownSeconds,
  loadSyncfyCredentialsForEmail,
  syncfyRequest,
} from '../lib/syncfy'
import {
  extractSyncfyTransactions,
  importSyncfyTransactionsForCredential,
  markSyncfyCredentialFromImportResult,
  normalizeSyncfyTransaction,
  resolveSyncfyStoredTransactionCategory,
  resolveSyncfyStoredTransactionType,
  resolveSyncfyTransactionImportState,
} from '../lib/ingest'

const SAMPLE_EXPENSES: Expense[] = [
  {
    id: 'sample-1',
    date: '2026-04-28',
    description: 'Supermercado La Comer',
    amount: 1340,
    category: 'Supermercado',
    merchant: 'La Comer',
  },
  {
    id: 'sample-2',
    date: '2026-04-27',
    description: 'Uber trip',
    amount: 188,
    category: 'Transporte',
    merchant: 'Uber',
  },
  {
    id: 'sample-3',
    date: '2026-04-25',
    description: 'Netflix',
    amount: 219,
    category: 'Suscripciones',
    merchant: 'Netflix',
  },
  {
    id: 'sample-4',
    date: '2026-04-23',
    description: 'Restaurante',
    amount: 720,
    category: 'Comida fuera',
    merchant: 'Restaurante',
  },
  {
    id: 'sample-5',
    date: '2026-04-21',
    description: 'Farmacia',
    amount: 315,
    category: 'Salud',
    merchant: 'Farmacia',
  },
]

export function summarizeExpenses(expenses: Expense[]): ExpenseSummary {
  const categoryTotals = new Map<string, number>()
  const merchantTotals = new Map<string, number>()
  const totalSpent = expenses.reduce((sum, expense) => {
    const amount = Math.max(expense.amount, 0)
    if (amount === 0) return sum

    categoryTotals.set(expense.category, (categoryTotals.get(expense.category) || 0) + amount)
    merchantTotals.set(expense.merchant, (merchantTotals.get(expense.merchant) || 0) + amount)
    return sum + amount
  }, 0)

  const topCategory = maxByTotal(categoryTotals) || 'Sin datos'
  const topMerchant = maxByTotal(merchantTotals) || 'Sin datos'
  const subscriptions = categoryTotals.get('Suscripciones') || 0

  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    transactionCount: expenses.length,
    topCategory,
    topMerchant,
    savingsOpportunity: Math.round(subscriptions * 0.5),
  }
}

function maxByTotal(totals: Map<string, number>): string | null {
  let winner: string | null = null
  let max = 0

  for (const [key, value] of totals.entries()) {
    if (value > max) {
      winner = key
      max = value
    }
  }

  return winner
}

function buildHouseholdInviteLink(env: Env, request: Request, invite: HouseholdInvite): string {
  const inviteUrl = new URL('/settings', getAppOrigin(env, request))
  inviteUrl.searchParams.set('household_invite', invite.id)
  inviteUrl.searchParams.set('email', invite.inviteeEmail)
  return inviteUrl.toString()
}

async function sendHouseholdInviteEmail(
  env: Env,
  request: Request,
  invite: HouseholdInvite
): Promise<{ emailSent: boolean; inviteUrl: string }> {
  const inviteUrl = buildHouseholdInviteLink(env, request, invite)

  if (!env.EMAIL) {
    if (isProductionEnv(env)) {
      throw new Error('Cloudflare Email Sending is not configured')
    }

    return { emailSent: false, inviteUrl }
  }

  const fromEmail = env.EMAIL_FROM || 'noreply@mail.finov.ai'
  const text = [
    'Te invitaron a FinovAI',
    '',
    `${invite.inviterEmail} quiere preparar contigo un espacio financiero compartido en FinovAI.`,
    '',
    `Abre este enlace con ${invite.inviteeEmail}: ${inviteUrl}`,
    '',
    'Si no esperabas esta invitación, puedes ignorar este correo.',
  ].join('\n')

  await env.EMAIL.send({
    to: invite.inviteeEmail,
    from: { email: fromEmail, name: 'FinovAI' },
    replyTo: fromEmail,
    subject: 'Invitación a FinovAI',
    text,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#071326">
        <h1 style="font-size:20px">Te invitaron a FinovAI</h1>
        <p><strong>${escapeHtml(invite.inviterEmail)}</strong> quiere preparar contigo un espacio financiero compartido en FinovAI.</p>
        <p><a href="${escapeHtml(inviteUrl)}">Abrir invitación</a></p>
        <p style="color:#536275">Entra con ${escapeHtml(invite.inviteeEmail)}. Si no esperabas esta invitación, puedes ignorar este correo.</p>
      </div>
    `,
  })

  return { emailSent: true, inviteUrl }
}

export function inferExpenseCategory(description: string): string {
  const value = description.toUpperCase()

  if (/(NETFLIX|SPOTIFY|APPLE|GOOGLE|PRIME|DISNEY|HBO)/.test(value)) return 'Suscripciones'
  if (/(UBER|DIDI|TAXI|CABIFY|METRO|TRANSPORTE|GASOLINA|PEMEX)/.test(value)) return 'Transporte'
  if (/(SUPERMERCADO|WALMART|CHEDRAUI|COMER|COSTCO|SORIAN|OXXO|MERCADO)/.test(value)) return 'Supermercado'
  if (/(RESTAUR|CAFE|STARBUCKS|COMIDA|RAPPI|UBER EATS)/.test(value)) return 'Comida fuera'
  if (/(FARMACIA|HOSPITAL|MEDIC|SALUD)/.test(value)) return 'Salud'
  if (/(RENTA|ARREND|HIPOTECA|LUZ|CFE|AGUA|TELCEL|INTERNET)/.test(value)) return 'Hogar'

  return 'Sin categoría'
}

function expensesResponse(source: 'sample' | 'syncfy', email: string, expenses: Expense[]) {
  return {
    success: true,
    email,
    source,
    summary: summarizeExpenses(expenses),
    expenses,
    message:
      source === 'sample'
        ? 'Datos de muestra hasta configurar los detalles del endpoint de transacciones.'
        : 'Transacciones cargadas.',
  }
}

function financeTransactionToExpense(transaction: FinanceTransaction): Expense {
  return {
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    amount: transaction.type === 'income' ? -transaction.amount : transaction.amount,
    category: transaction.category,
    merchant: transaction.merchant || transaction.description,
    accountCurrency: transaction.currency,
    type: transaction.type === 'income' ? 'credit' : 'debit',
  }
}

function normalizeProfileMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : normalizeFinancialAmount(value)
  if (!Number.isFinite(number) || number < 0) return null
  return roundMoney(number)
}

function normalizeCategoryBudgets(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const normalized: Record<string, number> = {}
  for (const [key, rawAmount] of Object.entries(value as Record<string, unknown>)) {
    const category = normalizeRequestedFinanceCategory(key, 'expense')
    const amount = normalizeProfileMoney(rawAmount)
    if (!category || !amount || amount <= 0) continue
    normalized[category] = amount
  }

  return normalized
}

function parseCategoryBudgets(jsonValue: string | null | undefined): Record<string, number> {
  if (!jsonValue) return {}
  try {
    return normalizeCategoryBudgets(JSON.parse(jsonValue))
  } catch {
    return {}
  }
}

function financialProfileRowToApi(row: FinancialProfileRow | null, email: string): FinancialProfile {
  return {
    email,
    currency: row?.currency || DEFAULT_FINANCE_CURRENCY,
    monthlyIncome: normalizeProfileMoney(row?.monthly_income),
    monthlyBudget: normalizeProfileMoney(row?.monthly_budget),
    categoryBudgets: parseCategoryBudgets(row?.category_budgets_json),
  }
}

async function loadFinancialProfile(env: Env, email: string): Promise<FinancialProfile> {
  await ensureFinanceTables(env)
  await upsertFinancialProfile(env, email)

  const row = await env.DB.prepare(
    `SELECT * FROM financial_profiles WHERE email = ?`
  )
    .bind(email)
    .first<FinancialProfileRow>()

  return financialProfileRowToApi(row, email)
}

async function updateFinancialProfile(
  env: Env,
  email: string,
  input: {
    currency?: unknown
    monthlyIncome?: unknown
    monthlyBudget?: unknown
    categoryBudgets?: unknown
  }
): Promise<FinancialProfile> {
  await ensureFinanceTables(env)
  await upsertFinancialProfile(env, email)

  const current = await loadFinancialProfile(env, email)
  const currency = typeof input.currency === 'string' && input.currency.trim()
    ? input.currency.trim().toUpperCase().slice(0, 8)
    : current.currency
  const monthlyIncome = Object.prototype.hasOwnProperty.call(input, 'monthlyIncome')
    ? normalizeProfileMoney(input.monthlyIncome)
    : current.monthlyIncome
  const monthlyBudget = Object.prototype.hasOwnProperty.call(input, 'monthlyBudget')
    ? normalizeProfileMoney(input.monthlyBudget)
    : current.monthlyBudget
  const categoryBudgets = Object.prototype.hasOwnProperty.call(input, 'categoryBudgets')
    ? normalizeCategoryBudgets(input.categoryBudgets)
    : current.categoryBudgets

  await env.DB.prepare(
    `UPDATE financial_profiles
     SET currency = ?,
         monthly_income = ?,
         monthly_budget = ?,
         category_budgets_json = ?,
         updated_at = datetime("now")
     WHERE email = ?`
  )
    .bind(
      currency,
      monthlyIncome,
      monthlyBudget,
      JSON.stringify(categoryBudgets),
      email
    )
    .run()

  return {
    email,
    currency,
    monthlyIncome,
    monthlyBudget,
    categoryBudgets,
  }
}

function householdInviteRowToApi(row: HouseholdInviteRow): HouseholdInvite {
  return {
    id: row.id,
    inviterEmail: row.inviter_email,
    inviteeEmail: row.invitee_email,
    status: row.status,
    created_at: row.created_at,
  }
}

async function loadHouseholdInvites(env: Env, email: string): Promise<HouseholdInvite[]> {
  await ensureHouseholdTables(env)
  await upsertFinancialProfile(env, email)

  const result = await env.DB.prepare(
    `SELECT * FROM household_invites
     WHERE inviter_email = ?
     ORDER BY created_at DESC`
  )
    .bind(email)
    .all<HouseholdInviteRow>()

  return result.results.map(householdInviteRowToApi)
}

async function upsertHouseholdInvite(env: Env, inviterEmail: string, inviteeEmail: string): Promise<HouseholdInvite> {
  await ensureHouseholdTables(env)
  await upsertFinancialProfile(env, inviterEmail)

  await env.DB.prepare(
    `INSERT INTO household_invites (id, inviter_email, invitee_email, status, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', datetime("now"), datetime("now"))
     ON CONFLICT(inviter_email, invitee_email) DO UPDATE SET
       status = 'pending',
       updated_at = datetime("now")`
  )
    .bind(crypto.randomUUID(), inviterEmail, inviteeEmail)
    .run()

  const row = await env.DB.prepare(
    `SELECT * FROM household_invites
     WHERE inviter_email = ? AND invitee_email = ?`
  )
    .bind(inviterEmail, inviteeEmail)
    .first<HouseholdInviteRow>()

  if (!row) {
    throw new Error('Unable to load household invite')
  }

  return householdInviteRowToApi(row)
}

function transactionRowToApi(row: FinanceTransactionRow): FinanceTransaction {
  const type = resolveSyncfyStoredTransactionType(row)
  const category = row.category_locked
    ? row.category
    : resolveSyncfyStoredTransactionCategory(row, type) ||
      resolveFinanceCategory(row.category, row.description, row.merchant, type, row.source)

  return {
    id: row.id,
    email: row.email,
    date: row.date,
    type,
    amount: Number(row.amount),
    currency: row.currency,
    category,
    description: row.description,
    merchant: row.merchant,
    notes: row.notes,
    source: row.source,
    confidence: Number(row.confidence),
    rawSource: row.raw_source,
    cartolaImportId: row.cartola_import_id,
    created_at: row.created_at,
  }
}

async function loadFinanceTransactions(env: Env, email: string): Promise<FinanceTransaction[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM transactions
     WHERE email = ?
     ORDER BY date DESC, created_at DESC`
  )
    .bind(email)
    .all<FinanceTransactionRow>()

  return result.results.map(transactionRowToApi)
}

export async function getFinanceDashboard(env: Env, email: string) {
  await ensureFinanceTables(env)
  await upsertFinancialProfile(env, email)

  const profile = await loadFinancialProfile(env, email)
  const transactions = await loadFinanceTransactions(env, email)
  const summary = buildFinancialSummary(transactions)
  const categoryAnalysis = buildCategoryAnalysis(transactions, summary, profile)
  const insights = buildFinancialInsights(summary, transactions, profile)
  const actionPlan = buildActionPlan(summary, transactions, profile)

  return {
    success: true,
    email,
    transactions,
    profile,
    summary,
    categoryAnalysis,
    insights,
    actionPlan,
  }
}

const DASHBOARD_STAGE_LABELS: Record<DashboardFinancialStage, string> = {
  diagnostico: 'Diagnóstico',
  control: 'Control',
  ahorro: 'Ahorro',
  liquidacion_de_deuda: 'Liquidación de deuda',
  inversion: 'Inversión',
}

const DASHBOARD_QUESTION_STAGE_RULES: Array<{
  stage: DashboardFinancialStage
  category: string
  pattern: RegExp
}> = [
  {
    stage: 'diagnostico',
    category: 'Diagnóstico inicial',
    pattern: /(FINANZAS.*REALIDAD|EN QUE SE ME VA|GASTANDO MAS.*GANO|NECESITO GANAR|NIVEL DE DEUDA|NUNCA ME ALCANZA)/,
  },
  {
    stage: 'liquidacion_de_deuda',
    category: 'Deudas',
    pattern: /(DEUDA|TARJETA|CREDITO|CAT\b|PAGO MINIMO|MINIMO|BURO|CONSOLIDACION|PAGAR DEUDAS|TENGO DEUDAS)/,
  },
  {
    stage: 'ahorro',
    category: 'Ahorro y fondo de emergencia',
    pattern: /(FONDO|EMERGENCIA|AHORR|TANDA|AGUINALDO|GUARD.*DINERO|^(?!.*DONDE INVIERTO).*(NU\b|HEY BANCO|KLAR|SOFIPO))/,
  },
  {
    stage: 'inversion',
    category: 'Inversión y metas',
    pattern: /(INVERT|INVIER|INVERSION|CETES|PAGARE|DOLARES|DIVERSIF|CASA|COCHE|RETIRO|METAS|INDEPENDENCIA|AFORE|BOLSA|ETF|GBM|KUSPIT|IMPUESTOS.*INVERSION)/,
  },
  {
    stage: 'control',
    category: 'Presupuesto y control',
    pattern: /(PRESUPUESTO|RENTA|COMIDA|TRANSPORTE|GASTAR MENOS|RECORT|NO NECESITO|QUINCENA|SUSCRIPC|MSI|GANAR MAS|AUMENTO|FREELANCE|IMPUESTOS|SAT\b|GASTAR DE MAS|CONSEJO FINANCIERO)/,
  },
]

export function classifyDashboardQuestionStage(question: string): DashboardQuestionBenchmark {
  const exactBenchmarkCase = DASHBOARD_CHAT_BENCHMARK_CASES.find((item) => item.question === question)
  if (exactBenchmarkCase) {
    return {
      stage: exactBenchmarkCase.expectedStage,
      label: DASHBOARD_STAGE_LABELS[exactBenchmarkCase.expectedStage],
      category: exactBenchmarkCase.category,
    }
  }

  const normalized = normalizeCategoryInput(question)
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
  const rule = DASHBOARD_QUESTION_STAGE_RULES.find((item) => item.pattern.test(normalized))
  const stage = rule?.stage || 'diagnostico'

  return {
    stage,
    label: DASHBOARD_STAGE_LABELS[stage],
    category: rule?.category || 'Diagnóstico inicial',
  }
}

export function buildDashboardChatContext(dashboard: Awaited<ReturnType<typeof getFinanceDashboard>>, question = ''): string {
  const transactions = dashboard.transactions.slice(0, 80).map((transaction) => (
    `${transaction.date} | ${transaction.type} | ${transaction.currency} ${transaction.amount} | ${transaction.category} | ${transaction.description}`
  ))
  const incomeGuidance = buildDashboardIncomeGuidance(dashboard.summary, dashboard.profile)
  const financialStage = buildFinancialStageAssessment(dashboard.summary, dashboard.transactions, dashboard.profile)
  const questionBenchmark = question ? classifyDashboardQuestionStage(question) : null

  return JSON.stringify({
    email: dashboard.email,
    profile: dashboard.profile,
    summary: dashboard.summary,
    categoryAnalysis: dashboard.categoryAnalysis,
    insights: dashboard.insights,
    actionPlan: dashboard.actionPlan,
    analysisWindow: {
      ...dashboard.summary.dataCoverage,
      rule: 'Menciona esta cobertura cuando respondas preguntas amplias sobre patrones. Si el historial es preliminar, aclara que la lectura es direccional y pide sincronizar más historial.',
    },
    categoryBreakdown: {
      allExpenses: buildExpenseCategoryBreakdown(dashboard.transactions),
      currentMonth: buildExpenseCategoryBreakdown(dashboard.transactions, dashboard.summary.month),
      rule: 'Use allExpenses for category/rubro questions unless the user explicitly asks about the current month.',
    },
    questionBenchmark,
    financialStage,
    incomeGuidance,
    responseRules: [
      'Cada respuesta incluye numeros reales del usuario: monto, categoria, comercio, porcentaje, mes o conteo.',
      'Para presupuestos, ahorro, deuda o inversion, calcula recomendaciones como porcentaje del ingreso real y muestra el monto resultante.',
      'No uses montos fijos genericos como 10000, 15000 o 20000 salvo que provengan del usuario o de sus transacciones.',
      incomeGuidance.effectiveMonthlyIncome
        ? `Ingreso base para calculos: ${formatFinanceCurrency(incomeGuidance.effectiveMonthlyIncome)} (${incomeGuidance.incomeSource}).`
        : 'Si falta ingreso, pide guardarlo en Ajustes antes de calcular metas monetarias.',
      'Usa questionBenchmark para entender la etapa de la pregunta y financialStage para decidir la prioridad real.',
      financialStage.debtGate.active
        ? 'Debt gate activo: evita recomendar inversion; prioriza liquidar deuda cara o controlar pagos.'
        : 'Debt gate inactivo: puedes hablar de ahorro o inversion si la pregunta lo pide y hay margen real.',
      'Si mencionas inversion, agrega un disclaimer breve: Informacion general, no asesoria personalizada.',
    ].join(' '),
    transactions,
    transactionCount: dashboard.transactions.length,
  })
}

async function answerDashboardChatWithAnthropic(
  env: Env,
  question: string,
  dashboard: Awaited<ReturnType<typeof getFinanceDashboard>>,
  allowLocalFallback: boolean
): Promise<{ answer: string; model: string }> {
  const model = getDashboardChatModel(env)
  const answer = await runAIResponse(env, [
    { role: 'system', content: DASHBOARD_CHAT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Pregunta del usuario: ${question}\n\nDatos financieros disponibles:\n${buildDashboardChatContext(dashboard, question)}`,
    },
  ], allowLocalFallback, 360)

  return { answer: finalizeDashboardChatAnswer(answer), model }
}

async function insertFinanceTransaction(
  env: Env,
  email: string,
  input: {
    date?: unknown
    type?: unknown
    amount?: unknown
    currency?: unknown
    category?: unknown
    description?: unknown
    merchant?: unknown
    notes?: unknown
  },
  source: FinanceTransactionSource,
  confidence = 1,
  rawSource: string | null = null,
  cartolaImportId: string | null = null
): Promise<FinanceTransaction> {
  const date = normalizeFinancialDate(input.date)
  const type = input.type === 'income' ? 'income' : 'expense'
  const amount = Math.abs(normalizeFinancialAmount(input.amount))
  const currency = typeof input.currency === 'string' && input.currency.trim()
    ? input.currency.trim().toUpperCase().slice(0, 8)
    : DEFAULT_FINANCE_CURRENCY
  const description = cleanText(input.description) || (type === 'income' ? 'Ingreso manual' : 'Gasto manual')
  const merchant = cleanText(input.merchant) || inferFinanceMerchant(description)
  const requestedCategory = normalizeRequestedFinanceCategory(input.category, type)
  const inferredCategory = resolveFinanceCategory(cleanText(input.category), description, merchant, type, source)
  const category = source === 'manual'
    ? requestedCategory || inferredCategory
    : inferredCategory
  const categoryLocked = source === 'manual' && requestedCategory ? 1 : 0
  const notes = cleanText(input.notes)

  if (!date) {
    throw new Error('Fecha inválida')
  }
  if (amount <= 0) {
    throw new Error('Monto inválido')
  }
  if (!category) {
    throw new Error('Categoría inválida')
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO transactions (
      id, email, date, type, amount, currency, category, description, merchant, notes,
      source, confidence, category_locked, raw_source, cartola_import_id, created_at, updated_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`
  )
    .bind(
      id,
      email,
      date,
      type,
      roundMoney(amount),
      currency,
      category,
      description,
      merchant || null,
      notes || null,
      source,
      clampConfidence(confidence),
      categoryLocked,
      rawSource,
      cartolaImportId
    )
    .run()

  const created = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND email = ?`)
    .bind(id, email)
    .first<FinanceTransactionRow>()

  if (!created) {
    throw new Error('Unable to load transaction')
  }

  return transactionRowToApi(created)
}

function normalizeRequestedFinanceCategory(value: unknown, type: FinanceTransactionType): string | null {
  const requested = cleanText(value)
  if (!requested) return null

  const normalizedRequested = normalizeCategoryInput(requested)
  return getFinanceCategoriesForType(type).find((category) => (
    normalizeCategoryInput(category) === normalizedRequested
  )) || null
}

async function updateFinanceTransactionCategory(
  env: Env,
  email: string,
  transactionId: string,
  category: unknown
): Promise<{ transaction: FinanceTransaction; updatedCount: number } | null> {
  const existing = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND email = ?`)
    .bind(transactionId, email)
    .first<FinanceTransactionRow>()

  if (!existing) return null

  const nextCategory = normalizeRequestedFinanceCategory(category, existing.type)
  if (!nextCategory) {
    throw new Error('Categoría inválida')
  }
  const previousCategory = existing.category

  const primaryUpdate = await env.DB.prepare(
    `UPDATE transactions
     SET category = ?,
         category_locked = 1,
         updated_at = datetime("now")
     WHERE id = ?
       AND email = ?`
  )
    .bind(nextCategory, transactionId, email)
    .run()

  let updatedCount = Number(primaryUpdate.meta?.changes || 1)
  const merchant = cleanText(existing.merchant)

  if (merchant) {
    const merchantUpdate = await env.DB.prepare(
      `UPDATE transactions
       SET category = ?,
           category_locked = 1,
           updated_at = datetime("now")
       WHERE email = ?
         AND type = ?
         AND merchant = ?
         AND id <> ?
         AND (COALESCE(category_locked, 0) = 0 OR category = ?)`
    )
      .bind(nextCategory, email, existing.type, merchant, transactionId, previousCategory)
      .run()
    updatedCount += Number(merchantUpdate.meta?.changes || 0)
  }

  const updated = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ? AND email = ?`)
    .bind(transactionId, email)
    .first<FinanceTransactionRow>()

  return updated ? { transaction: transactionRowToApi(updated), updatedCount } : null
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, roundMoney(value)))
}

const DASHBOARD_CHAT_SYSTEM_PROMPT = `Eres FinovAI, un copiloto financiero para México y Latinoamérica.

Responde siempre en español. Usa solo los datos financieros incluidos en el mensaje del usuario. Si faltan movimientos, dilo con claridad y pide ir a Conectar cuenta y seguir los pasos. No menciones el proveedor de conexión por nombre.

Tu trabajo:
- detectar fugas de gasto, patrones, recurrencias y oportunidades de ahorro;
- explicar los hallazgos con montos y categorías concretas;
- conectar cada respuesta con números reales del usuario: monto, categoría, comercio, porcentaje, mes o conteo;
- usar incomeGuidance.effectiveMonthlyIncome como base para presupuestos, ahorro, deuda e inversión;
- si falta ingreso, pedir guardarlo en Ajustes antes de calcular metas monetarias;
- no usar montos genéricos de personas promedio; todo monto sugerido debe salir del ingreso, gasto o pregunta del usuario;
- detectar la etapa de la pregunta y la etapa financiera real usando questionBenchmark y financialStage;
- si financialStage.debtGate.active es true, priorizar deuda cara/control y no sugerir inversión todavía;
- mencionar la ventana de datos analizada cuando respondas preguntas amplias de patrones, ahorro o plan;
- tratar conjuntos de datos marcados como preliminares como lecturas direccionales, no conclusiones definitivas;
- usar categoryBreakdown.allExpenses cuando la pregunta sea sobre categorías/rubros en general, salvo que el usuario pida el mes actual;
- evitar consejos de inversión específicos, promesas de rendimiento o jerga innecesaria;
- mantener respuestas breves, accionables y orientadas a próximos pasos.

Formato obligatorio:
- Responde solo en 3 a 5 bullets cortos; no uses párrafo introductorio.
- Cada bullet debe tener máximo 18 palabras.
- Máximo 100 palabras, salvo que el usuario pida detalle.
- No cierres con preguntas de seguimiento.
- No menciones páginas o secciones que no existen. Destinos válidos: Chat, Conectar cuenta, Movimientos, Categorías, Ajustes.
- Si recomiendas revisar cargos, di "ve a Movimientos" o "usa Categorías"; nunca digas "Revisar recurrentes".
- Si mencionas inversión, agrega: "Información general, no asesoría personalizada."
- Termina con una frase completa antes de cualquier gráfico.`

export async function handleFinanceRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
    // =====================
    // TRANSACTION FALLBACKS
    // =====================

    if (url.pathname === '/api/transactions' && request.method === 'GET') {
      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      return json(await getFinanceDashboard(env, normalizedEmail))
    }

    if (url.pathname === '/api/profile' && request.method === 'GET') {
      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      return json({
        success: true,
        email: normalizedEmail,
        profile: await loadFinancialProfile(env, normalizedEmail),
      })
    }

    if (url.pathname === '/api/profile' && request.method === 'PATCH') {
      const body = (await request.json()) as {
        email?: string
        currency?: unknown
        monthlyIncome?: unknown
        monthlyBudget?: unknown
        categoryBudgets?: unknown
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      const profile = await updateFinancialProfile(env, normalizedEmail, body)
      const dashboard = await getFinanceDashboard(env, normalizedEmail)

      return json({
        ...dashboard,
        profile,
        message: 'Perfil financiero actualizado.',
      })
    }

    if (url.pathname === '/api/dashboard/chat' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        question?: string
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      const question = typeof body.question === 'string' ? body.question.trim() : ''

      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)
      if (!question) {
        return error('Pregunta requerida')
      }

      const dashboard = await getFinanceDashboard(env, normalizedEmail)
      let answer: { answer: string; model: string }
      try {
        answer = await answerDashboardChatWithAnthropic(env, question, dashboard, false)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No pudimos conectar con el modelo financiero.'
        return error(message, 502)
      }

      return json({
        success: true,
        email: normalizedEmail,
        source: 'anthropic',
        model: answer.model,
        answer: answer.answer,
      })
    }

    if (url.pathname === '/api/transactions/category' && request.method === 'PATCH') {
      const body = (await request.json()) as {
        email?: string
        transactionId?: string
        category?: unknown
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : ''

      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)
      if (!transactionId) {
        return error('Movimiento requerido')
      }

      await ensureFinanceTables(env)
      const categoryUpdate = await updateFinanceTransactionCategory(env, normalizedEmail, transactionId, body.category)
      if (!categoryUpdate) {
        return error('Movimiento no encontrado', 404)
      }
      const dashboard = await getFinanceDashboard(env, normalizedEmail)
      const updateMessage = categoryUpdate.updatedCount > 1
        ? `Categoría actualizada en ${categoryUpdate.updatedCount} movimientos similares.`
        : 'Categoría actualizada.'

      return json({
        ...dashboard,
        transaction: categoryUpdate.transaction,
        message: updateMessage,
      })
    }

    if (url.pathname === '/api/transactions/manual' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        date?: unknown
        type?: unknown
        amount?: unknown
        currency?: unknown
        category?: unknown
        description?: unknown
        merchant?: unknown
        notes?: unknown
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)
      if (isProductionEnv(env) && !isFeatureEnabled(env.ENABLE_BACKUP_IMPORT)) {
        return error('Not found', 404)
      }

      await ensureFinanceTables(env)
      await upsertFinancialProfile(env, normalizedEmail)
      const transaction = await insertFinanceTransaction(env, normalizedEmail, body, 'manual', 1)
      const dashboard = await getFinanceDashboard(env, normalizedEmail)

      return json({
        ...dashboard,
        transaction,
        message: 'Movimiento guardado.',
      }, 201)
    }

    if (url.pathname === '/api/household' && request.method === 'GET') {
      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      return json({
        success: true,
        email: normalizedEmail,
        invites: await loadHouseholdInvites(env, normalizedEmail),
      })
    }

    if (url.pathname === '/api/household/invite' && request.method === 'POST') {
      const body = (await request.json()) as {
        email?: string
        spouseEmail?: string
        inviteeEmail?: string
      }
      const normalizedEmail = normalizeSignupEmail(body.email)
      const inviteeEmail = normalizeSignupEmail(body.spouseEmail || body.inviteeEmail)

      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)
      if (!inviteeEmail) {
        return error('Correo de pareja inválido')
      }
      if (normalizedEmail === inviteeEmail) {
        return error('Usa un correo distinto para invitar a tu pareja')
      }

      const invite = await upsertHouseholdInvite(env, normalizedEmail, inviteeEmail)
      const delivery = await sendHouseholdInviteEmail(env, request, invite)

      return json({
        success: true,
        email: normalizedEmail,
        invite,
        invites: await loadHouseholdInvites(env, normalizedEmail),
        emailSent: delivery.emailSent,
        inviteUrl: delivery.inviteUrl,
        message: delivery.emailSent ? 'Invitación enviada.' : 'Invitación guardada. Correo no configurado en local.',
      }, 201)
    }

    if (url.pathname === '/api/expenses' && request.method === 'GET') {
      if (isProductionEnv(env)) {
        return error('Not found', 404)
      }

      const normalizedEmail = normalizeSignupEmail(url.searchParams.get('email'))
      if (!normalizedEmail) {
        return error('Correo inválido')
      }
      const access = await verifyDashboardEmailAccess(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      await ensureSyncfyTables(env)

      const syncfyUser = await env.DB.prepare(`SELECT * FROM syncfy_users WHERE email = ?`)
        .bind(normalizedEmail)
        .first<SyncfyUserRow>()

      if (!syncfyUser || !env.SYNCFY_API_KEY) {
        return json(expensesResponse('sample', normalizedEmail, SAMPLE_EXPENSES))
      }

      let rawTransactions: unknown
      let importResult: SyncfyTransactionImportResult | null = null

      try {
        if (env.SYNCFY_TRANSACTIONS_PATH) {
          const transactionsPath = env.SYNCFY_TRANSACTIONS_PATH.replace('{id_user}', syncfyUser.syncfy_user_id)
          rawTransactions = await syncfyRequest<unknown>(env, transactionsPath, { method: 'GET' })
        } else {
          const credentials = await loadSyncfyCredentialsForEmail(env, normalizedEmail)
          const credential = credentials[0]
          if (!credential) {
            return json(expensesResponse('sample', normalizedEmail, SAMPLE_EXPENSES))
          }

          if (getSyncfyCredentialCooldownSeconds(credential) === 0) {
            importResult = await importSyncfyTransactionsForCredential(
              env,
              normalizedEmail,
              credential.syncfy_user_id,
              credential.syncfy_credential_id
            )
            const importState = await resolveSyncfyTransactionImportState(
              env,
              normalizedEmail,
              credential.syncfy_credential_id,
              importResult
            )
            await markSyncfyCredentialFromImportResult(
              env,
              normalizedEmail,
              credential.syncfy_credential_id,
              importResult,
              importState
            )
          }

          const persisted = await loadFinanceTransactions(env, normalizedEmail)
          const expenses = persisted.map(financeTransactionToExpense)
          return json({
            ...expensesResponse('syncfy', normalizedEmail, expenses),
            syncfy: importResult,
          })
        }
      } catch (err) {
        if (err instanceof SyncfyRequestError) {
          await storeSyncfyError(env, {
            email: normalizedEmail,
            syncfyUserId: syncfyUser.syncfy_user_id,
            rid: err.rid,
            statusCode: err.status,
            errorCode: err.code,
            message: err.message,
            source: 'syncfy-expenses',
            payload: err.responseBody,
          })

          return json({
            success: false,
            email: normalizedEmail,
            source: 'syncfy',
            summary: summarizeExpenses([]),
            expenses: [],
            error: buildSyncfyUserMessage(err),
            rid: err.rid,
          }, err.status >= 500 ? 502 : 409)
        }

        throw err
      }

      const syncfyTransactions = extractSyncfyTransactions(rawTransactions)
      const expenses = syncfyTransactions
        .map((transaction, index) => normalizeSyncfyTransaction(transaction, null, index))
        .filter((transaction): transaction is NormalizedSyncfyTransaction => Boolean(transaction))
        .map((transaction) => ({
          id: transaction.id,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.type === 'income' ? -transaction.amount : transaction.amount,
          category: transaction.category,
          merchant: transaction.merchant,
          accountCurrency: transaction.currency,
          type: transaction.type === 'income' ? 'credit' as const : 'debit' as const,
        }))

      return json({
        success: true,
        email: normalizedEmail,
        source: 'syncfy',
        summary: summarizeExpenses(expenses),
        expenses,
        raw: rawTransactions,
        message: `${expenses.length} movimientos cargados.`,
      })
    }

    if (url.pathname === '/api/health') {
      return json({
        status: 'ok',
        environment: env.ENVIRONMENT || 'unknown',
        syncfyEnvironment: env.SYNCFY_ENV || 'unlabeled',
        timestamp: new Date().toISOString(),
      })
    }

  return null
}
