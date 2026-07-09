export type FinanceTransactionType = 'income' | 'expense'
export type FinanceTransactionSource = 'manual' | 'cartola' | 'syncfy'

export interface FinanceDataCoverage {
  firstDate: string | null
  lastDate: string | null
  firstMonth: string | null
  lastMonth: string | null
  monthCount: number
  transactionCount: number
  preliminary: boolean
}

export interface FinanceTransaction {
  id: string
  email: string
  date: string
  type: FinanceTransactionType
  amount: number
  currency: string
  category: string
  description: string
  merchant: string | null
  notes: string | null
  source: FinanceTransactionSource
  confidence: number
  rawSource: string | null
  cartolaImportId: string | null
  created_at: string
}

export type FinanceAnalysisTransaction = Pick<
  FinanceTransaction,
  'date' | 'type' | 'amount' | 'currency' | 'category' | 'description'
> & Partial<Pick<FinanceTransaction, 'merchant'>>

export interface FinancialProfile {
  email: string
  currency: string
  monthlyIncome: number | null
  monthlyBudget: number | null
  categoryBudgets: Record<string, number>
}

export interface FinanceSummary {
  month: string
  monthlyIncome: number
  monthlySpending: number
  netBalance: number
  transactionCount: number
  dataCoverage: FinanceDataCoverage
  topSpendingCategory: string
  topSpendingCategoryAmount: number
  unusualHighSpendDay: { date: string; amount: number } | null
  recurringExpenses: Array<{ key: string; description: string; amount: number; count: number }>
  estimatedSavingsOpportunity: number
}

export type BudgetSource = 'user' | 'income_rule' | 'missing'
export type CategoryBudgetStatus = 'under' | 'near' | 'over' | 'unset'

export interface CategoryBudgetComparison {
  category: string
  amount: number
  share: number
  previousAmount: number
  deltaFromPrevious: number
  budget: number | null
  budgetUsage: number | null
  budgetStatus: CategoryBudgetStatus
  advice: string
}

export interface CategoryMonthRow {
  month: string
  spendingTotal: number
  incomeTotal: number
  topCategory: string
  deltaFromPrevious: number | null
  budgetTotal: number | null
  status: CategoryBudgetStatus
}

export interface CategoryAnalysis {
  period: string
  periodLabel: string
  previousPeriod: string | null
  spendingTotal: number
  incomeTotal: number
  budgetTotal: number | null
  budgetSource: BudgetSource
  fixedExpenseShare: number | null
  fixedExpenseLimit: number | null
  summaryAdvice: string
  categories: CategoryBudgetComparison[]
  monthRows: CategoryMonthRow[]
}

export interface FinanceInsight {
  id: string
  title: string
  value: string
  body: string
  tone: 'good' | 'watch' | 'urgent'
}

export type FinanceOpportunityKind = 'recurring' | 'merchant_leak' | 'category_leak' | 'unusual_day'

export interface FinanceOpportunity {
  id: string
  kind: FinanceOpportunityKind
  title: string
  body: string
  sourceLabel: string
  estimatedMonthlySavings: number
}

export interface FinanceActionPlan {
  monthlySavingsTarget: number
  topOpportunities: FinanceOpportunity[]
  investmentProjection: {
    monthlyContribution: number
    years: number
    annualReturn: number
    totalContributed: number
    tenYearValue: number
    potentialGrowth: number
  }
  nextActions: Array<{
    id: string
    label: string
    body: string
    target: 'movements' | 'categories' | 'chat' | 'connect' | 'partner'
  }>
}

export type DashboardFinancialStage = 'diagnostico' | 'control' | 'ahorro' | 'liquidacion_de_deuda' | 'inversion'

export interface DashboardDebtGate {
  active: boolean
  monthlyDebtPayments: number
  debtShareOfIncome: number | null
  debtShareOfSpending: number | null
  expensiveDebtSignals: string[]
  rule: string
}

export interface DashboardFinancialStageAssessment {
  stage: DashboardFinancialStage
  label: string
  reason: string
  savingsRate: number | null
  debtGate: DashboardDebtGate
}

export interface DashboardIncomeGuidance {
  effectiveMonthlyIncome: number | null
  incomeSource: 'profile' | 'transactions' | 'missing'
  currentSpendingShareOfIncome: number | null
  currentSavingsRate: number | null
  recommendedMonthlyBudget: number | null
  starterSavingsTarget: number | null
  strongSavingsTarget: number | null
  rule: string
}

export const DEFAULT_FINANCE_CURRENCY = 'MXN'
export const INVESTMENT_CATEGORY = 'Inversión'
export const DEFAULT_INVESTMENT_ASSUMPTION = {
  years: 10,
  annualReturn: 0.08,
}

export const INCOME_CATEGORIES = ['Sueldo', 'Freelance', INVESTMENT_CATEGORY, 'Reembolso', 'Venta', 'Otro ingreso']
export const EXPENSE_CATEGORIES = [
  'Comida fuera',
  'Supermercado',
  'Transporte',
  'Suscripciones',
  'Hogar',
  'Salud',
  'Educación',
  'Ocio',
  'Compras',
  'Transferencias',
  'Retiros',
  'Deuda',
  INVESTMENT_CATEGORY,
  'Impuestos',
  'Otro',
]
export const DISCRETIONARY_CATEGORIES = new Set(['Comida fuera', 'Suscripciones', 'Ocio', 'Transporte'])

const FIXED_EXPENSE_CATEGORIES = new Set(['Deuda', 'Hogar', 'Suscripciones', 'Impuestos', 'Salud'])

const DASHBOARD_STAGE_LABELS: Record<DashboardFinancialStage, string> = {
  diagnostico: 'Diagnóstico',
  control: 'Control',
  ahorro: 'Ahorro',
  liquidacion_de_deuda: 'Liquidación de deuda',
  inversion: 'Inversión',
}

export function getFinanceCategoriesForType(type: FinanceTransactionType): string[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function normalizeCategoryInput(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

export function buildFinanceDataCoverage(transactions: Array<Pick<FinanceAnalysisTransaction, 'date'>>): FinanceDataCoverage {
  const dates = transactions
    .map((transaction) => transaction.date)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
  const months = [...new Set(dates.map((date) => date.slice(0, 7)))]

  return {
    firstDate: dates[0] || null,
    lastDate: dates.at(-1) || null,
    firstMonth: months[0] || null,
    lastMonth: months.at(-1) || null,
    monthCount: months.length,
    transactionCount: transactions.length,
    preliminary: months.length < 3 || transactions.length < 30,
  }
}

export function buildFinancialSummary(transactions: FinanceAnalysisTransaction[]): FinanceSummary {
  const latestMonth = transactions
    .map((transaction) => transaction.date.slice(0, 7))
    .sort()
    .at(-1) || new Date().toISOString().slice(0, 7)
  const monthlyTransactions = transactions.filter((transaction) => transaction.date.startsWith(latestMonth))
  const categoryTotals = new Map<string, number>()
  const dailySpending = new Map<string, number>()
  let monthlyIncome = 0
  let monthlySpending = 0

  for (const transaction of monthlyTransactions) {
    if (transaction.type === 'income') {
      monthlyIncome += transaction.amount
      continue
    }

    monthlySpending += transaction.amount
    categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) || 0) + transaction.amount)
    dailySpending.set(transaction.date, (dailySpending.get(transaction.date) || 0) + transaction.amount)
  }

  const [topSpendingCategory = 'Sin datos', topSpendingCategoryAmount = 0] = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .at(0) || []
  const unusualHighSpendDay = getUnusualHighSpendDay(dailySpending)
  const recurringExpenses = getRecurringExpenses(transactions)
  const discretionaryTotal = [...categoryTotals.entries()].reduce((sum, [category, amount]) => {
    return DISCRETIONARY_CATEGORIES.has(category) ? sum + amount : sum
  }, 0)
  const recurringTotal = recurringExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  return {
    month: latestMonth,
    monthlyIncome: roundMoney(monthlyIncome),
    monthlySpending: roundMoney(monthlySpending),
    netBalance: roundMoney(monthlyIncome - monthlySpending),
    transactionCount: transactions.length,
    dataCoverage: buildFinanceDataCoverage(transactions),
    topSpendingCategory,
    topSpendingCategoryAmount: roundMoney(topSpendingCategoryAmount),
    unusualHighSpendDay,
    recurringExpenses,
    estimatedSavingsOpportunity: Math.round(discretionaryTotal * 0.1 + recurringTotal * 0.25),
  }
}

export function buildCategoryAnalysis(
  transactions: FinanceAnalysisTransaction[],
  summary: FinanceSummary,
  profile: FinancialProfile
): CategoryAnalysis {
  const months = getTransactionMonths(transactions)
  const period = summary.month || months[0] || new Date().toISOString().slice(0, 7)
  const previousPeriod = months.find((month) => month < period) || null
  const current = getMonthTotals(transactions, period)
  const previous = previousPeriod ? getMonthTotals(transactions, previousPeriod) : null
  const budget = resolveBudgetTotal(profile, current.incomeTotal)
  const incomeForGuidance = profile.monthlyIncome || current.incomeTotal
  const fixedExpenseShare = incomeForGuidance > 0
    ? Math.round((current.fixedExpenseTotal / incomeForGuidance) * 100)
    : null
  const fixedExpenseLimit = incomeForGuidance > 0 ? roundMoney(incomeForGuidance * 0.5) : null
  const currency = profile.currency || transactions[0]?.currency || DEFAULT_FINANCE_CURRENCY
  const spendingShareDenominator = current.spendingTotal || 1
  const categoryBudgets = profile.categoryBudgets

  const categories = [...current.categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => {
      const roundedAmount = roundMoney(amount)
      const previousAmount = roundMoney(previous?.categoryTotals.get(category) || 0)
      const categoryBudget = categoryBudgets[category] || null
      const budgetStatus = getBudgetStatus(roundedAmount, categoryBudget)

      return {
        category,
        amount: roundedAmount,
        share: Math.round((roundedAmount / spendingShareDenominator) * 100),
        previousAmount,
        deltaFromPrevious: roundMoney(roundedAmount - previousAmount),
        budget: categoryBudget,
        budgetUsage: categoryBudget ? Math.round((roundedAmount / categoryBudget) * 100) : null,
        budgetStatus,
        advice: buildCategoryAdvice(category, roundedAmount, previousAmount, categoryBudget, budgetStatus, currency),
      }
    })

  const summaryAdvice = (() => {
    if (budget.source === 'missing') {
      return 'Falta tu ingreso y presupuesto mensual. Agrega esos datos para comparar el gasto contra una meta real.'
    }
    if (fixedExpenseShare !== null && fixedExpenseShare > 50) {
      return `Tus gastos fijos son ${fixedExpenseShare}% de tus ingresos. Intenta mantenerlos bajo 50%.`
    }
    if (budget.value && current.spendingTotal > budget.value) {
      return `Este mes estás ${formatFinanceCurrency(current.spendingTotal - budget.value, currency)} sobre presupuesto. Prioriza las categorías excedidas.`
    }
    if (budget.source === 'income_rule') {
      return `Aún no tienes presupuesto guardado. FinovAI propone partir con ${formatFinanceCurrency(budget.value || 0, currency)} como tope mensual.`
    }
    return 'Vas dentro del presupuesto mensual. Revisa las categorías que crecieron frente al mes anterior.'
  })()

  const monthRows = months.map((month, index) => {
    const totals = getMonthTotals(transactions, month)
    const nextMonth = months[index + 1]
    const previousTotals = nextMonth ? getMonthTotals(transactions, nextMonth) : null
    const monthBudget = resolveBudgetTotal(profile, totals.incomeTotal).value

    return {
      month,
      spendingTotal: totals.spendingTotal,
      incomeTotal: totals.incomeTotal,
      topCategory: totals.topCategory,
      deltaFromPrevious: previousTotals ? roundMoney(totals.spendingTotal - previousTotals.spendingTotal) : null,
      budgetTotal: monthBudget,
      status: getBudgetStatus(totals.spendingTotal, monthBudget),
    }
  })

  return {
    period,
    periodLabel: formatAnalysisMonth(period),
    previousPeriod,
    spendingTotal: current.spendingTotal,
    incomeTotal: current.incomeTotal,
    budgetTotal: budget.value,
    budgetSource: budget.source,
    fixedExpenseShare,
    fixedExpenseLimit,
    summaryAdvice,
    categories,
    monthRows,
  }
}

export function buildExpenseCategoryBreakdown(
  transactions: Array<Pick<FinanceAnalysisTransaction, 'type' | 'date' | 'category' | 'amount'>>,
  month?: string | null
) {
  const totals = new Map<string, { category: string; amount: number; count: number }>()

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    if (month && !transaction.date.startsWith(month)) continue

    const current = totals.get(transaction.category) || {
      category: transaction.category,
      amount: 0,
      count: 0,
    }
    current.amount += transaction.amount
    current.count += 1
    totals.set(transaction.category, current)
  }

  const totalAmount = [...totals.values()].reduce((sum, item) => sum + item.amount, 0)

  return [...totals.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      category: item.category,
      amount: roundMoney(item.amount),
      count: item.count,
      share: totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0,
    }))
}

export function buildDashboardDebtGate(
  summary: FinanceSummary,
  transactions: Array<Pick<FinanceAnalysisTransaction, 'type' | 'date' | 'category' | 'amount' | 'description'> & Partial<Pick<FinanceTransaction, 'merchant'>>>,
  effectiveMonthlyIncome = summary.monthlyIncome
): DashboardDebtGate {
  const currentMonthDebtTransactions = transactions.filter((transaction) => (
    transaction.type === 'expense' &&
    transaction.category === 'Deuda' &&
    transaction.date.startsWith(summary.month)
  ))
  const monthlyDebtPayments = roundMoney(currentMonthDebtTransactions.reduce((sum, transaction) => sum + transaction.amount, 0))
  const debtShareOfIncome = effectiveMonthlyIncome > 0
    ? Math.round((monthlyDebtPayments / effectiveMonthlyIncome) * 100)
    : null
  const debtShareOfSpending = summary.monthlySpending > 0
    ? Math.round((monthlyDebtPayments / summary.monthlySpending) * 100)
    : null
  const expensiveDebtSignals = currentMonthDebtTransactions
    .filter((transaction) => /AMERICAN EXPRESS|AMEX|TARJETA|TDC|INTERES|COMISION|DISPOSICION|PAGO MINIMO|CAT\b/i.test(`${transaction.description} ${transaction.merchant || ''}`))
    .map((transaction) => transaction.description)
    .slice(0, 4)
  const active = monthlyDebtPayments > 0 && (
    summary.topSpendingCategory === 'Deuda' ||
    (debtShareOfIncome !== null && debtShareOfIncome >= 30) ||
    (debtShareOfSpending !== null && debtShareOfSpending >= 25) ||
    expensiveDebtSignals.length > 0
  )

  return {
    active,
    monthlyDebtPayments,
    debtShareOfIncome,
    debtShareOfSpending,
    expensiveDebtSignals,
    rule: active
      ? 'No recomiendes invertir todavía. Prioriza controlar o liquidar deuda cara con números reales del usuario.'
      : 'Puede hablarse de ahorro o inversión solo si el usuario pregunta y hay margen real.',
  }
}

export function buildDashboardIncomeGuidance(
  summary: FinanceSummary,
  profile?: Pick<FinancialProfile, 'monthlyIncome'> | null
): DashboardIncomeGuidance {
  const profileIncome = profile?.monthlyIncome && profile.monthlyIncome > 0 ? profile.monthlyIncome : null
  const transactionIncome = summary.monthlyIncome > 0 ? summary.monthlyIncome : null
  const effectiveMonthlyIncome = profileIncome || transactionIncome
  const incomeSource = profileIncome ? 'profile' : transactionIncome ? 'transactions' : 'missing'
  const effectiveNetBalance = effectiveMonthlyIncome !== null
    ? roundMoney(effectiveMonthlyIncome - summary.monthlySpending)
    : null

  return {
    effectiveMonthlyIncome,
    incomeSource,
    currentSpendingShareOfIncome: effectiveMonthlyIncome
      ? Math.round((summary.monthlySpending / effectiveMonthlyIncome) * 100)
      : null,
    currentSavingsRate: effectiveMonthlyIncome && effectiveNetBalance !== null
      ? Math.round((effectiveNetBalance / effectiveMonthlyIncome) * 100)
      : null,
    recommendedMonthlyBudget: effectiveMonthlyIncome ? roundMoney(effectiveMonthlyIncome * 0.8) : null,
    starterSavingsTarget: effectiveMonthlyIncome ? roundMoney(effectiveMonthlyIncome * 0.05) : null,
    strongSavingsTarget: effectiveMonthlyIncome ? roundMoney(effectiveMonthlyIncome * 0.2) : null,
    rule: effectiveMonthlyIncome
      ? 'Usa este ingreso como denominador. Expresa topes, ahorro, deuda e inversion como porcentaje y monto derivado del ingreso real del usuario.'
      : 'Falta ingreso. No des metas monetarias fijas; pide guardar ingreso mensual en Ajustes o detectar ingresos con movimientos conectados.',
  }
}

export function buildFinancialStageAssessment(
  summary: FinanceSummary,
  transactions: Array<Pick<FinanceAnalysisTransaction, 'type' | 'date' | 'category' | 'amount' | 'description'> & Partial<Pick<FinanceTransaction, 'merchant'>>>,
  profile?: Pick<FinancialProfile, 'monthlyIncome'> | null
): DashboardFinancialStageAssessment {
  const incomeGuidance = buildDashboardIncomeGuidance(summary, profile)
  const effectiveMonthlyIncome = incomeGuidance.effectiveMonthlyIncome || 0
  const effectiveNetBalance = effectiveMonthlyIncome > 0
    ? roundMoney(effectiveMonthlyIncome - summary.monthlySpending)
    : summary.netBalance
  const debtGate = buildDashboardDebtGate(summary, transactions, effectiveMonthlyIncome)
  const savingsRate = effectiveMonthlyIncome > 0
    ? Math.round((effectiveNetBalance / effectiveMonthlyIncome) * 100)
    : null
  const hasInvestmentActivity = transactions.some((transaction) => (
    transaction.category === INVESTMENT_CATEGORY && transaction.date.startsWith(summary.month)
  ))

  if (summary.transactionCount === 0 || effectiveMonthlyIncome <= 0) {
    return {
      stage: 'diagnostico',
      label: DASHBOARD_STAGE_LABELS.diagnostico,
      reason: 'Faltan ingresos o movimientos suficientes para pasar a control.',
      savingsRate,
      debtGate,
    }
  }

  if (debtGate.active) {
    return {
      stage: 'liquidacion_de_deuda',
      label: DASHBOARD_STAGE_LABELS.liquidacion_de_deuda,
      reason: `Deuda suma ${formatFinanceCurrency(debtGate.monthlyDebtPayments)} este mes${debtGate.debtShareOfIncome !== null ? ` (${debtGate.debtShareOfIncome}% del ingreso)` : ''}.`,
      savingsRate,
      debtGate,
    }
  }

  if (effectiveNetBalance <= 0 || (savingsRate !== null && savingsRate < 10)) {
    return {
      stage: 'control',
      label: DASHBOARD_STAGE_LABELS.control,
      reason: 'Primero hay que estabilizar flujo mensual y presupuesto.',
      savingsRate,
      debtGate,
    }
  }

  if (hasInvestmentActivity || (savingsRate !== null && savingsRate >= 20)) {
    return {
      stage: 'inversion',
      label: DASHBOARD_STAGE_LABELS.inversion,
      reason: 'Hay margen mensual y no aparece deuda cara activa.',
      savingsRate,
      debtGate,
    }
  }

  return {
    stage: 'ahorro',
    label: DASHBOARD_STAGE_LABELS.ahorro,
    reason: 'Hay margen positivo; toca construir colchón y metas antes de inversión compleja.',
    savingsRate,
    debtGate,
  }
}

export function buildFinancialInsights(
  summary: FinanceSummary,
  transactions: FinanceAnalysisTransaction[],
  profile?: FinancialProfile
): FinanceInsight[] {
  if (transactions.length === 0) {
    return [
      {
        id: 'empty',
        title: 'Sin señal todavía',
        value: '0 movimientos',
        body: 'Ve a Conectar cuenta y sigue los pasos para generar insights reales.',
        tone: 'watch',
      },
    ]
  }

  const effectiveIncome = summary.monthlyIncome || profile?.monthlyIncome || 0
  const effectiveNetBalance = roundMoney(effectiveIncome - summary.monthlySpending)
  const insights: FinanceInsight[] = effectiveIncome > 0
    ? [{
      id: 'net-balance',
      title: 'Balance mensual',
      value: formatFinanceCurrency(effectiveNetBalance, profile?.currency),
      body: `Ingresos ${formatFinanceCurrency(effectiveIncome, profile?.currency)} menos gastos ${formatFinanceCurrency(summary.monthlySpending, profile?.currency)}.`,
      tone: effectiveNetBalance >= 0 ? 'good' : 'urgent',
    }]
    : [{
      id: 'income-missing',
      title: 'Falta ingreso',
      value: 'Completa perfil',
      body: 'Agrega tu ingreso mensual y presupuesto para comparar este gasto contra una meta real.',
      tone: 'watch',
    }]

  if (summary.topSpendingCategoryAmount > 0) {
    const share = summary.monthlySpending > 0
      ? Math.round((summary.topSpendingCategoryAmount / summary.monthlySpending) * 100)
      : 0
    insights.push({
      id: 'top-category',
      title: 'Mayor categoría',
      value: summary.topSpendingCategory,
      body: `${formatFinanceCurrency(summary.topSpendingCategoryAmount)} concentrados aquí (${share}% del gasto mensual).`,
      tone: share >= 35 ? 'urgent' : 'watch',
    })
  }

  if (summary.unusualHighSpendDay) {
    insights.push({
      id: 'unusual-day',
      title: 'Día atípico',
      value: summary.unusualHighSpendDay.date,
      body: `Ese día salieron ${formatFinanceCurrency(summary.unusualHighSpendDay.amount, profile?.currency)}. Analiza si fue un gasto extraño o un patrón nuevo.`,
      tone: 'watch',
    })
  }

  if (summary.recurringExpenses.length > 0) {
    const topRecurring = summary.recurringExpenses[0]
    insights.push({
      id: 'recurring',
      title: 'Gasto recurrente',
      value: topRecurring.description,
      body: `${topRecurring.count} cargos similares, aprox. ${formatFinanceCurrency(topRecurring.amount)} cada vez.`,
      tone: 'watch',
    })
  }

  if (summary.estimatedSavingsOpportunity > 0) {
    insights.push({
      id: 'savings',
      title: 'Ahorro estimado',
      value: formatFinanceCurrency(summary.estimatedSavingsOpportunity),
      body: 'Estimado reduciendo 10% de gastos flexibles y 25% de cargos recurrentes revisables.',
      tone: 'good',
    })
  }

  return insights.slice(0, 5)
}

export function buildActionPlan(
  summary: FinanceSummary,
  transactions: FinanceAnalysisTransaction[],
  profile?: FinancialProfile
): FinanceActionPlan {
  const opportunities = buildFinanceOpportunities(summary, transactions)
  const monthlySavingsTarget = roundMoney(
    opportunities.slice(0, 3).reduce((sum, opportunity) => sum + opportunity.estimatedMonthlySavings, 0)
  )
  const investmentProjection = projectInvestmentContribution(monthlySavingsTarget)
  const financialStage = buildFinancialStageAssessment(summary, transactions, profile)

  return {
    monthlySavingsTarget,
    topOpportunities: opportunities.slice(0, 4),
    investmentProjection,
    nextActions: buildFinanceNextActions(monthlySavingsTarget, opportunities, transactions.length, financialStage),
  }
}

export function buildFinanceOpportunities(
  summary: FinanceSummary,
  transactions: FinanceAnalysisTransaction[]
): FinanceOpportunity[] {
  if (transactions.length === 0) return []

  const latestMonth = summary.month
  const currentMonthExpenses = transactions.filter((transaction) => (
    transaction.type === 'expense' && transaction.date.startsWith(latestMonth)
  ))
  const opportunities: FinanceOpportunity[] = []

  for (const recurring of summary.recurringExpenses.slice(0, 3)) {
    const estimatedMonthlySavings = roundMoney(Math.max(recurring.amount * 0.5, 0))
    if (estimatedMonthlySavings <= 0) continue
    opportunities.push({
      id: `recurring:${recurring.key}`,
      kind: 'recurring',
      title: `Revisar ${recurring.description}`,
      body: `${recurring.count} cargos similares detectados. Cancela, baja plan o confirma que sigue siendo necesario.`,
      sourceLabel: recurring.description,
      estimatedMonthlySavings,
    })
  }

  const merchantTotals = new Map<string, { merchant: string; amount: number; count: number; category: string }>()
  const categoryTotals = new Map<string, number>()
  const monthlySpending = Math.max(summary.monthlySpending, 1)

  for (const transaction of currentMonthExpenses) {
    categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) || 0) + transaction.amount)

    if (!DISCRETIONARY_CATEGORIES.has(transaction.category)) continue
    const merchant = cleanText(transaction.merchant) || cleanText(transaction.description)
    const merchantKey = normalizeRecurringKey(merchant)
    if (!merchantKey) continue

    const current = merchantTotals.get(merchantKey) || {
      merchant,
      amount: 0,
      count: 0,
      category: transaction.category,
    }
    current.amount += transaction.amount
    current.count += 1
    merchantTotals.set(merchantKey, current)
  }

  for (const [merchantKey, merchant] of merchantTotals.entries()) {
    if (merchant.count < 2 || merchant.amount / monthlySpending < 0.04) continue
    const estimatedMonthlySavings = roundMoney(merchant.amount * 0.2)
    opportunities.push({
      id: `merchant:${merchantKey}`,
      kind: 'merchant_leak',
      title: `Bajar frecuencia en ${merchant.merchant}`,
      body: `${merchant.count} cargos este mes en ${merchant.category}. Reducir una parte crea margen sin cambiar todo el presupuesto.`,
      sourceLabel: merchant.merchant,
      estimatedMonthlySavings,
    })
  }

  for (const [category, amount] of [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    if (!DISCRETIONARY_CATEGORIES.has(category) || amount / monthlySpending < 0.15) continue
    const estimatedMonthlySavings = roundMoney(amount * 0.1)
    opportunities.push({
      id: `category:${normalizeRecurringKey(category)}`,
      kind: 'category_leak',
      title: `Tope suave para ${category}`,
      body: `${formatFinanceCurrency(amount)} concentrados en ${category} durante ${summary.month}. Empieza con una reducción conservadora del 10%.`,
      sourceLabel: category,
      estimatedMonthlySavings,
    })
  }

  if (summary.unusualHighSpendDay && summary.unusualHighSpendDay.amount / monthlySpending >= 0.25) {
    opportunities.push({
      id: `unusual-day:${summary.unusualHighSpendDay.date}`,
      kind: 'unusual_day',
      title: 'Revisar día atípico',
      body: `El ${summary.unusualHighSpendDay.date} salió ${formatFinanceCurrency(summary.unusualHighSpendDay.amount)}. Si no fue puntual, conviértelo en regla.`,
      sourceLabel: summary.unusualHighSpendDay.date,
      estimatedMonthlySavings: roundMoney(summary.unusualHighSpendDay.amount * 0.1),
    })
  }

  return dedupeFinanceOpportunities(opportunities)
    .sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings)
}

export function projectInvestmentContribution(
  monthlyContribution: number,
  years = DEFAULT_INVESTMENT_ASSUMPTION.years,
  annualReturn = DEFAULT_INVESTMENT_ASSUMPTION.annualReturn
): FinanceActionPlan['investmentProjection'] {
  const roundedContribution = roundMoney(monthlyContribution)
  const months = years * 12
  const monthlyReturn = annualReturn / 12
  let value = 0

  for (let month = 0; month < months; month += 1) {
    value = (value + roundedContribution) * (1 + monthlyReturn)
  }

  const totalContributed = roundMoney(roundedContribution * months)
  const tenYearValue = roundMoney(value)

  return {
    monthlyContribution: roundedContribution,
    years,
    annualReturn,
    totalContributed,
    tenYearValue,
    potentialGrowth: roundMoney(tenYearValue - totalContributed),
  }
}

export function finalizeDashboardChatAnswer(answer: string): string {
  return addInvestmentDisclaimer(
    trimIncompleteDashboardAnswer(stripModelChartPayload(replaceInvisibleDashboardDestinations(answer)))
  )
}

export function formatFinanceCurrency(value: number, currency = DEFAULT_FINANCE_CURRENCY) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(value)
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function getTransactionMonths(transactions: FinanceAnalysisTransaction[]): string[] {
  return [...new Set(transactions.map((transaction) => transaction.date.slice(0, 7)).filter(Boolean))]
    .sort()
    .reverse()
}

function formatAnalysisMonth(month: string) {
  const [year, monthNumber] = month.split('-')
  const monthIndex = Number(monthNumber) - 1
  if (!year || !Number.isFinite(monthIndex)) return month
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
    .format(new Date(Number(year), monthIndex, 1))
}

function getMonthTotals(transactions: FinanceAnalysisTransaction[], month: string) {
  const categoryTotals = new Map<string, number>()
  let spendingTotal = 0
  let incomeTotal = 0
  let fixedExpenseTotal = 0

  for (const transaction of transactions) {
    if (!transaction.date.startsWith(month)) continue
    if (transaction.type === 'income') {
      incomeTotal += transaction.amount
      continue
    }

    spendingTotal += transaction.amount
    categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) || 0) + transaction.amount)
    if (FIXED_EXPENSE_CATEGORIES.has(transaction.category)) {
      fixedExpenseTotal += transaction.amount
    }
  }

  const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin datos'

  return {
    categoryTotals,
    spendingTotal: roundMoney(spendingTotal),
    incomeTotal: roundMoney(incomeTotal),
    fixedExpenseTotal: roundMoney(fixedExpenseTotal),
    topCategory,
  }
}

function resolveBudgetTotal(profile: FinancialProfile, incomeTotal: number): { value: number | null; source: BudgetSource } {
  if (profile.monthlyBudget && profile.monthlyBudget > 0) return { value: profile.monthlyBudget, source: 'user' }

  const income = profile.monthlyIncome || incomeTotal
  if (income > 0) return { value: roundMoney(income * 0.8), source: 'income_rule' }

  return { value: null, source: 'missing' }
}

export function getBudgetStatus(amount: number, budget: number | null | undefined): CategoryBudgetStatus {
  if (!budget || budget <= 0) return 'unset'
  if (amount > budget) return 'over'
  if (amount / budget >= 0.85) return 'near'
  return 'under'
}

function buildCategoryAdvice(
  category: string,
  amount: number,
  previousAmount: number,
  budget: number | null,
  budgetStatus: CategoryBudgetStatus,
  currency: string
) {
  if (budgetStatus === 'over' && budget) {
    return `${category} está ${formatFinanceCurrency(amount - budget, currency)} sobre presupuesto. Revisa los movimientos principales antes de cerrar el mes.`
  }
  if (budgetStatus === 'near') {
    return `${category} está cerca del tope. Define una pausa o límite semanal para no pasarte.`
  }
  if (previousAmount > 0 && amount > previousAmount) {
    return `${category} subió ${formatFinanceCurrency(amount - previousAmount, currency)} frente al mes anterior. Revisa si fue puntual o nuevo patrón.`
  }
  if (!budget) {
    return `Sin presupuesto asignado para ${category}. Agrega un tope para comparar este gasto con una meta real.`
  }
  return `${category} sigue dentro del presupuesto. Mantén el seguimiento durante el mes.`
}

function dedupeFinanceOpportunities(opportunities: FinanceOpportunity[]): FinanceOpportunity[] {
  const seen = new Set<string>()
  const result: FinanceOpportunity[] = []

  for (const opportunity of opportunities) {
    if (opportunity.estimatedMonthlySavings <= 0 || seen.has(opportunity.id)) continue
    seen.add(opportunity.id)
    result.push(opportunity)
  }

  return result
}

function buildFinanceNextActions(
  monthlySavingsTarget: number,
  opportunities: FinanceOpportunity[],
  transactionCount: number,
  financialStage?: DashboardFinancialStageAssessment
): FinanceActionPlan['nextActions'] {
  if (transactionCount === 0) {
    return [
      {
        id: 'connect',
        label: 'Conectar institución',
        body: 'Ve a Conectar cuenta y sigue los pasos para que FinovAI pueda detectar fugas.',
        target: 'connect',
      },
    ]
  }

  const actions: FinanceActionPlan['nextActions'] = []
  if (financialStage?.debtGate.active) {
    actions.push({
      id: 'debt-first',
      label: 'Priorizar deuda',
      body: `Deuda del mes: ${formatFinanceCurrency(financialStage.debtGate.monthlyDebtPayments)}. Revisa pagos e intereses antes de invertir.`,
      target: 'movements',
    })
  }

  if (opportunities.some((opportunity) => opportunity.kind === 'recurring')) {
    actions.push({
      id: 'review-recurring',
      label: 'Ver movimientos',
      body: 'Revisa los cargos repetidos en Movimientos y elimina los que ya no uses.',
      target: 'movements',
    })
  }

  if (opportunities.some((opportunity) => opportunity.kind === 'merchant_leak' || opportunity.kind === 'category_leak')) {
    actions.push({
      id: 'fix-categories',
      label: 'Afinar categorías',
      body: 'Corrige comercios repetidos para que FinovAI aprenda tus reglas y calcule mejor el margen.',
      target: 'categories',
    })
  }

  actions.push({
    id: 'ask-plan',
    label: 'Preguntar a FinovAI',
    body: 'Pide un plan semanal basado en estas fugas y movimientos.',
    target: 'chat',
  })

  if (monthlySavingsTarget > 0 && !financialStage?.debtGate.active) {
    actions.push({
      id: 'route-investment',
      label: 'Preparar inversión',
      body: 'Convierte el margen mensual en una ruta ilustrativa hacia una plataforma aliada.',
      target: 'partner',
    })
  }

  return actions.slice(0, 4)
}

function getUnusualHighSpendDay(dailySpending: Map<string, number>) {
  const entries = [...dailySpending.entries()]
  if (entries.length === 0) return null

  const total = entries.reduce((sum, [, amount]) => sum + amount, 0)
  const average = total / entries.length
  const highest = entries.sort((a, b) => b[1] - a[1])[0]

  if (!highest || highest[1] <= 0) return null
  if (entries.length < 3) return { date: highest[0], amount: roundMoney(highest[1]) }

  return highest[1] >= average * 1.5
    ? { date: highest[0], amount: roundMoney(highest[1]) }
    : null
}

function getRecurringExpenses(transactions: FinanceAnalysisTransaction[]) {
  const groups = new Map<string, FinanceAnalysisTransaction[]>()

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    const key = normalizeRecurringKey(transaction.merchant || transaction.description)
    if (!key) continue
    groups.set(key, [...(groups.get(key) || []), transaction])
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      if (group.length < 2) return null

      const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))
      const amounts = sorted.map((transaction) => transaction.amount)
      const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
      const maxDelta = Math.max(...amounts.map((amount) => Math.abs(amount - average)))
      const stableAmounts = average > 0 && maxDelta / average <= 0.35
      const spansDays = daysBetween(sorted[0].date, sorted.at(-1)?.date || sorted[0].date) >= 15

      if (!stableAmounts || !spansDays) return null

      return {
        key,
        description: sorted[0].merchant || sorted[0].description,
        amount: roundMoney(average),
        count: sorted.length,
      }
    })
    .filter((expense): expense is { key: string; description: string; amount: number; count: number } => Boolean(expense))
    .sort((a, b) => b.amount * b.count - a.amount * a.count)
}

function normalizeRecurringKey(value: string) {
  return normalizeHeader(value)
    .replace(/\b\d+\b/g, '')
    .split('_')
    .filter(Boolean)
    .slice(0, 3)
    .join('_')
}

function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round(Math.abs(end - start) / 86_400_000)
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function replaceInvisibleDashboardDestinations(answer: string): string {
  return answer
    .replace(/\bVe a Revisar recurrentes\b/gi, 'Ve a Movimientos')
    .replace(/\bEn Revisar recurrentes\b/gi, 'En Movimientos')
    .replace(/\bdesde Revisar recurrentes\b/gi, 'desde Movimientos')
    .replace(/\bRevisar recurrentes\b/g, 'Movimientos')
    .replace(/\brevisar recurrentes\b/g, 'Movimientos')
}

function trimIncompleteDashboardAnswer(answer: string): string {
  const trimmed = answer.trim()
  if (!trimmed) return trimmed
  if (/[.!?…)]$/.test(trimmed)) return trimmed

  const lines = trimmed.split('\n')
  if (lines.length > 1 && !/[.!?…)]$/.test((lines.at(-1) || '').trim())) {
    return lines.slice(0, -1).join('\n').trim()
  }

  const lastSentenceEnd = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf('!'),
    trimmed.lastIndexOf('?'),
    trimmed.lastIndexOf('…')
  )

  if (lastSentenceEnd >= 0) {
    return trimmed.slice(0, lastSentenceEnd + 1).trim()
  }

  return `${trimmed.replace(/[,;:\-\s]+$/, '')}.`
}

function stripModelChartPayload(answer: string): string {
  const chartPayloadStart = answer.search(/\n\s*(CHART|```(?:json|chart)?\s*\{)/i)
  if (chartPayloadStart < 0) return answer

  const maybePayload = answer.slice(chartPayloadStart)
  if (!/("datasets"|"type"\s*:|"labels"\s*:)/i.test(maybePayload)) return answer

  return answer.slice(0, chartPayloadStart).trim()
}

function addInvestmentDisclaimer(answer: string): string {
  if (!/(INVERT|INVERSION|INVERSIONES|CETES|GBM|ETF|AFORE|PORTAFOLIO|RENDIMIENTO)/.test(normalizeCategoryInput(answer))) {
    return answer
  }

  if (/(ASESORIA PERSONALIZADA|ASESORIA FINANCIERA|INFORMACION GENERAL)/.test(normalizeCategoryInput(answer))) {
    return answer
  }

  return `${answer.trim()}\n\nInformación general, no asesoría personalizada.`
}
