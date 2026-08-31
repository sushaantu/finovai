import {
  ArrowRightLeft,
  Banknote,
  Car,
  CircleDollarSign,
  Film,
  HeartPulse,
  Home,
  Landmark,
  PiggyBank,
  ReceiptText,
  Repeat2,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import {
  DEFAULT_FINANCE_CURRENCY,
  roundMoney,
  type FinanceInsight,
  type FinanceSummary,
} from '@finovai/core'
import type { BudgetStatus, TransactionSource } from './types'

export function formatCurrency(value: number, currency = DEFAULT_FINANCE_CURRENCY) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(value)
}

export function formatCardCurrency(value: number, currency = DEFAULT_FINANCE_CURRENCY) {
  const formatted = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Math.abs(value))

  return value < 0 ? `-${formatted}` : formatted
}

export function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

export function formatTransactionSource(source: TransactionSource) {
  if (source === 'syncfy') return 'Conexión bancaria'
  if (source === 'cartola') return 'Importación de respaldo'
  return 'Ajuste de respaldo'
}

export function formatMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatShortMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    month: 'short',
  }).format(date).replace('.', '')
}

export function getMonthRange(firstMonth: string | null, lastMonth: string | null) {
  if (!firstMonth || !lastMonth) return []

  const first = new Date(`${firstMonth}-01T00:00:00`)
  const last = new Date(`${lastMonth}-01T00:00:00`)
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return []

  const months: string[] = []
  const cursor = new Date(first)
  while (cursor <= last && months.length < 36) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}

export function formatDataCoverage(coverage: FinanceSummary['dataCoverage']) {
  if (!coverage.transactionCount || !coverage.firstMonth || !coverage.lastMonth) return 'Sin historial analizado'
  const monthRange = coverage.firstMonth === coverage.lastMonth
    ? formatMonth(coverage.lastMonth)
    : `${formatMonth(coverage.firstMonth)} - ${formatMonth(coverage.lastMonth)}`
  const monthLabel = coverage.monthCount === 1 ? '1 mes' : `${coverage.monthCount} meses`
  const transactionLabel = coverage.transactionCount === 1 ? '1 movimiento' : `${coverage.transactionCount} movimientos`

  return `${monthLabel} analizados · ${transactionLabel} · ${monthRange}`
}

export function getShortChartLabel(value: string, maxLength = 18) {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean

  return `${clean.slice(0, maxLength - 1).trim()}…`
}

export function parseMoneyInput(value: string): number | null {
  const normalized = value.replace(/[^\d.,-]/g, '').trim()
  if (!normalized) return null
  const hasCommaDecimal = /,\d{1,2}$/.test(normalized)
  const clean = hasCommaDecimal
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.replace(/,/g, '')
  const number = Number(clean)
  return Number.isFinite(number) && number >= 0 ? roundMoney(number) : null
}

export function moneyInputValue(value: number | null | undefined) {
  return value && value > 0 ? String(value) : ''
}

export function getBudgetStatusLabel(status: BudgetStatus) {
  if (status === 'over') return 'Excedido'
  if (status === 'near') return 'Cerca del tope'
  if (status === 'under') return 'Bajo control'
  return 'Sin presupuesto'
}

export function getBudgetStatusClass(status: BudgetStatus) {
  if (status === 'over') return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300'
  if (status === 'near') return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (status === 'under') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  return 'border-border/70 bg-secondary text-muted-foreground'
}

export function getInsightToneClasses(tone: FinanceInsight['tone']) {
  if (tone === 'good') return 'border-primary/25 bg-primary/10 text-primary'
  if (tone === 'urgent') return 'border-rose-500/20 bg-rose-500/8 text-rose-700 dark:text-rose-300'
  return 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300'
}

export const CATEGORY_ICON_RULES: Array<{ terms: string[]; icon: LucideIcon }> = [
  { terms: ['transfer', 'traspas', 'spei'], icon: ArrowRightLeft },
  { terms: ['impuesto', 'sat', 'tax'], icon: Landmark },
  { terms: ['supermercado', 'super', 'mercado', 'despensa', 'grocery'], icon: ShoppingCart },
  { terms: ['compra', 'shopping', 'amazon', 'retail'], icon: ShoppingBag },
  { terms: ['transporte', 'uber', 'didi', 'taxi', 'metro', 'gasolina'], icon: Car },
  { terms: ['salud', 'farmacia', 'medic', 'doctor'], icon: HeartPulse },
  { terms: ['comida', 'restaurante', 'cafe', 'starbucks', 'food'], icon: Utensils },
  { terms: ['suscripcion', 'recurrente', 'netflix', 'spotify'], icon: Repeat2 },
  { terms: ['ocio', 'cine', 'entretenimiento', 'cinemex'], icon: Film },
  { terms: ['renta', 'alquiler', 'vivienda', 'hogar', 'servicio', 'utilities'], icon: Home },
  { terms: ['inversion', 'ahorro', 'bitso', 'cripto', 'crypto'], icon: PiggyBank },
  { terms: ['sueldo', 'nomina', 'ingreso', 'salario'], icon: Banknote },
  { terms: ['comision', 'cargo', 'fee'], icon: ReceiptText },
]

export function getCategoryIcon(category: string): LucideIcon {
  const normalizedCategory = normalizeQuestion(category)
  const match = CATEGORY_ICON_RULES.find((rule) => (
    rule.terms.some((term) => normalizedCategory.includes(term))
  ))

  return match?.icon || CircleDollarSign
}

export function normalizeQuestion(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
