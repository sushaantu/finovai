import {
  EXPENSE_CATEGORIES,
  buildDashboardDebtGate,
  buildDashboardIncomeGuidance,
  roundMoney,
  type FinanceSummary,
  type FinancialProfile,
} from '@finovai/core'
import type { AnalysisTransaction, DashboardChatChartType } from './types'
import { EMPTY_PROFILE } from './constants'
import {
  formatCurrency,
  formatDate,
  formatMonth,
  normalizeQuestion,
} from './format'
import {
  getBreakdownTotal,
  getExpenseBreakdown,
  getTopTransactions,
} from './analytics'

export const DASHBOARD_CHAT_SUGGESTIONS = [
  '¿Dónde está mi fuga principal?',
  '¿Qué puedo ahorrar esta semana?',
  '¿Qué patrón se repite?',
]

export const EXPLICIT_CHART_PATTERN = /(grafica|grafico|chart|linea|evolucion|tendencia|historico|serie)/

export const CATEGORY_QUERY_ALIASES: Array<{ category: string; pattern: RegExp }> = [
  { category: 'Comida fuera', pattern: /(comida fuera|restaur|restor|restaurant|uber eats|rappi|didi food|cafeter|cafe|bar|taquer|don asado|fisher|orale|milan)/ },
  { category: 'Supermercado', pattern: /(supermercado|super|despensa|walmart|soriana|chedraui|costco|sams|heb|mercado)/ },
  { category: 'Transporte', pattern: /(transporte|uber|didi|taxi|metro|gasolina|combustible|estacionamiento)/ },
  { category: 'Suscripciones', pattern: /(suscrip|netflix|spotify|amazon prime|apple|google|membresia)/ },
  { category: 'Ocio', pattern: /(ocio|cine|cinemex|cinepolis|entretenimiento|dulceria)/ },
  { category: 'Deuda', pattern: /(deuda|interes|comision|disposicion|credito|tarjeta)/ },
  { category: 'Inversión', pattern: /(inversion|invertir|invertido|bitso|gbm|cetes|fondo|broker|cripto|crypto|acciones|etf)/ },
]

export const CATEGORY_QUESTION_PATTERN = /(donde|categoria|rubro|gaste|gast[eé]|mas|mayor|principal)/

export const CURRENT_MONTH_QUESTION_PATTERN = /(mes|mensual|este mes|mes actual|actual|ultimo mes|último mes|reciente)/

export function isCategoryQuestion(normalizedQuestion: string) {
  return CATEGORY_QUESTION_PATTERN.test(normalizedQuestion)
}

export function isExplicitChartQuestion(normalizedQuestion: string) {
  return EXPLICIT_CHART_PATTERN.test(normalizedQuestion)
}

export function getDashboardChatChartCategory(question: string): string | undefined {
  const normalized = normalizeQuestion(question)
  const alias = CATEGORY_QUERY_ALIASES.find((item) => item.pattern.test(normalized))
  if (alias) return alias.category

  return EXPENSE_CATEGORIES.find((category) => normalized.includes(normalizeQuestion(category)))
}

export function getCategoryQuestionMonth(normalizedQuestion: string, summary: FinanceSummary) {
  return CURRENT_MONTH_QUESTION_PATTERN.test(normalizedQuestion) ? summary.month : null
}

export function getCategoryScopeLabel(month: string | null) {
  return month ? `de ${formatMonth(month)}` : 'en todos tus movimientos'
}

export function buildDashboardChatOpening(
  transactions: AnalysisTransaction[],
  hasConnectedInstitution: boolean,
  hasReconnectRequiredCredential = false
) {
  if (transactions.length === 0) {
    if (hasConnectedInstitution) {
      return 'La institución ya está conectada. Cuando los movimientos estén listos, puedo encontrar fugas, patrones y oportunidades para ahorrar.'
    }

    if (hasReconnectRequiredCredential) {
      return 'Ve a Conectar cuenta y sigue los pasos para reconectar la institución.'
    }

    return 'Ve a Conectar cuenta y sigue los pasos. En cuanto entren transacciones, puedo encontrar fugas, patrones y oportunidades para ahorrar.'
  }

  return 'Ya tengo movimientos conectados. Pregúntame dónde se fuga tu dinero, qué patrón se repite o cuánto podrías ahorrar e invertir.'
}

export function getDashboardEffectiveMonthlyIncome(summary: FinanceSummary, profile?: FinancialProfile | null) {
  return buildDashboardIncomeGuidance(summary, profile || EMPTY_PROFILE).effectiveMonthlyIncome || 0
}

export function buildDashboardChatAnswer(
  question: string,
  transactions: AnalysisTransaction[],
  summary: FinanceSummary,
  currency: string,
  isDraftAnalysis = false,
  hasConnectedInstitution = false,
  hasReconnectRequiredCredential = false,
  profile?: FinancialProfile | null
) {
  if (transactions.length === 0) {
    if (hasConnectedInstitution) {
      return 'La institución ya está conectada, pero todavía no tengo transacciones disponibles. Ve a Conectar cuenta y sigue los pasos si esto no cambia en unos minutos.'
    }

    if (hasReconnectRequiredCredential) {
      return 'Ve a Conectar cuenta y sigue los pasos para reconectar la institución antes de leer transacciones nuevas.'
    }

    return 'Todavía no tengo transacciones para analizar. Ve a Conectar cuenta y sigue los pasos para traer movimientos reales.'
  }

  const normalized = normalizeQuestion(question)
  const categoryQuestionMonth = getCategoryQuestionMonth(normalized, summary)
  const breakdown = getExpenseBreakdown(transactions, categoryQuestionMonth)
  const topCategory = breakdown[0]
  const topTransactions = getTopTransactions(transactions, summary.month)
  const prefix = isDraftAnalysis ? 'Preliminar: ' : ''
  const effectiveMonthlyIncome = getDashboardEffectiveMonthlyIncome(summary, profile)
  const monthlyMargin = effectiveMonthlyIncome > 0 ? roundMoney(effectiveMonthlyIncome - summary.monthlySpending) : null
  const spendingShareOfIncome = effectiveMonthlyIncome > 0 ? Math.round((summary.monthlySpending / effectiveMonthlyIncome) * 100) : null
  const starterSavingsTarget = effectiveMonthlyIncome > 0 ? roundMoney(effectiveMonthlyIncome * 0.05) : null
  const strongSavingsTarget = effectiveMonthlyIncome > 0 ? roundMoney(effectiveMonthlyIncome * 0.2) : null
  const debtGate = buildDashboardDebtGate(summary, transactions, effectiveMonthlyIncome)

  if (isCategoryQuestion(normalized) && topCategory) {
    const totalSpending = getBreakdownTotal(breakdown)
    const share = totalSpending > 0 ? Math.round((topCategory.total / totalSpending) * 100) : 0
    const nextCategories = breakdown.slice(1, 3)
      .map((item) => `${item.category}: ${formatCurrency(item.total, currency)}`)
      .join(' · ')

    return `${prefix}Tu mayor gasto ${getCategoryScopeLabel(categoryQuestionMonth)} está en ${topCategory.category}: ${formatCurrency(topCategory.total, currency)} (${share}% del gasto).${nextCategories ? ` Después viene ${nextCategories}.` : ''}`
  }

  if (/(ahorr|reduc|bajar|optim|invert|invers|futur)/.test(normalized)) {
    if (debtGate.active && /(invert|invers|futur)/.test(normalized)) {
      const incomeShare = debtGate.debtShareOfIncome !== null ? ` (${debtGate.debtShareOfIncome}% del ingreso)` : ''

      return `${prefix}Etapa actual: liquidación de deuda. En ${formatMonth(summary.month)}, Deuda suma ${formatCurrency(debtGate.monthlyDebtPayments, currency)}${incomeShare}. Prioriza bajar intereses y pagos de tarjeta antes de pasar a inversión.`
    }

    if (effectiveMonthlyIncome <= 0) {
      return `${prefix}Falta tu ingreso mensual. Ve a Ajustes y guárdalo para calcular ahorro como porcentaje real de lo que ganas.`
    }

    const opportunityShare = Math.round((summary.estimatedSavingsOpportunity / effectiveMonthlyIncome) * 100)
    const marginText = monthlyMargin !== null
      ? `Tu margen actual es ${formatCurrency(monthlyMargin, currency)} (${Math.round((monthlyMargin / effectiveMonthlyIncome) * 100)}%).`
      : ''
    const investmentText = /(invert|invers|futur)/.test(normalized)
      ? ' Si lo inviertes, úsalo solo como referencia ilustrativa.\n\nInformación general, no asesoría personalizada.'
      : ''

    return summary.estimatedSavingsOpportunity > 0
      ? `${prefix}Con ingreso base de ${formatCurrency(effectiveMonthlyIncome, currency)}, gastaste ${spendingShareOfIncome}% este mes. ${marginText} Ahorro inicial realista: ${formatCurrency(summary.estimatedSavingsOpportunity, currency)} (${opportunityShare}% del ingreso); rango guía ${formatCurrency(starterSavingsTarget || 0, currency)}-${formatCurrency(strongSavingsTarget || 0, currency)} según deuda y gastos.${investmentText}`
      : `${prefix}Con ingreso base de ${formatCurrency(effectiveMonthlyIncome, currency)}, todavía no veo una fuga clara. Usa como guía 5%-20% del ingreso: ${formatCurrency(starterSavingsTarget || 0, currency)}-${formatCurrency(strongSavingsTarget || 0, currency)}.`
  }

  if (/(recurrent|suscrip|mensual|repite|repet)/.test(normalized)) {
    if (summary.recurringExpenses.length === 0) {
      return `${prefix}No detecté gastos recurrentes confiables todavía. Con más transacciones conectadas puedo separar mejor suscripciones de compras puntuales.`
    }

    return `${prefix}${summary.recurringExpenses
      .slice(0, 3)
      .map((expense) => `${expense.description}: ${expense.count} cargos, aprox. ${formatCurrency(expense.amount, currency)} cada uno.`)
      .join(' ')}`
  }

  if (/(dia|d[ií]a|raro|inusual|alto|peak|pico)/.test(normalized)) {
    return summary.unusualHighSpendDay
      ? `${prefix}El día que más llama la atención es ${formatDate(summary.unusualHighSpendDay.date)}: salieron ${formatCurrency(summary.unusualHighSpendDay.amount, currency)}. Revisa si fue compra puntual o patrón.`
      : `${prefix}No hay un día atípico claro todavía. Con más movimientos puedo comparar mejor los días de gasto.`
  }

  if (/(balance|saldo|ingreso|neto|mes)/.test(normalized)) {
    const incomeLabel = effectiveMonthlyIncome > 0 ? formatCurrency(effectiveMonthlyIncome, currency) : formatCurrency(summary.monthlyIncome, currency)
    const netBalance = effectiveMonthlyIncome > 0 ? effectiveMonthlyIncome - summary.monthlySpending : summary.netBalance
    const shareText = spendingShareOfIncome !== null ? ` (${spendingShareOfIncome}% del ingreso)` : ''

    return `${prefix}En ${formatMonth(summary.month)} tienes ingreso base de ${incomeLabel}, gastos por ${formatCurrency(summary.monthlySpending, currency)}${shareText} y balance neto de ${formatCurrency(netBalance, currency)}.`
  }

  if (topTransactions.length > 0) {
    const biggest = topTransactions
      .map((transaction) => `${transaction.description}: ${formatCurrency(transaction.amount, currency)}`)
      .join(' · ')

    return `${prefix}Lectura rápida: gastaste ${formatCurrency(summary.monthlySpending, currency)} en ${formatMonth(summary.month)}. La categoría principal es ${summary.topSpendingCategory}. Movimientos grandes: ${biggest}.`
  }

  return `${prefix}Tengo ${transactions.length} movimientos para analizar. Puedo revisar categorías, días atípicos, cargos recurrentes y ahorro estimado.`
}

export function getDashboardChatChartType(
  question: string,
  transactions: AnalysisTransaction[],
  summary: FinanceSummary
): DashboardChatChartType | undefined {
  if (transactions.length === 0) return undefined

  const normalized = normalizeQuestion(question)
  const hasMonthSpending = summary.monthlySpending > 0
  const requestedChartCategory = getDashboardChatChartCategory(question)
  const asksForChart = isExplicitChartQuestion(normalized)
  const debtGate = buildDashboardDebtGate(summary, transactions)

  if (asksForChart && requestedChartCategory && transactions.some((transaction) => transaction.type === 'expense' && transaction.category === requestedChartCategory)) {
    return 'category-trend'
  }

  if (debtGate.active && /(deuda|tarjeta|credito|invert|invers|futur)/.test(normalized)) {
    return undefined
  }

  if (asksForChart && /(linea|evolucion|tendencia|historico|serie|mes|mensual)/.test(normalized) && hasMonthSpending) {
    return 'daily-spend'
  }

  if (isCategoryQuestion(normalized) && hasMonthSpending) {
    return 'categories'
  }

  if (/(ahorr|reduc|bajar|optim|invert|invers|futur)/.test(normalized) && summary.estimatedSavingsOpportunity > 0 && !debtGate.active) {
    return 'savings'
  }

  if (/(recurrent|suscrip|mensual|repite|repet)/.test(normalized) && summary.recurringExpenses.length > 0) {
    return 'recurring'
  }

  if (/(dia|d[ií]a|raro|inusual|alto|peak|pico|balance|saldo|ingreso|neto|mes)/.test(normalized) && hasMonthSpending) {
    return 'daily-spend'
  }

  return undefined
}
