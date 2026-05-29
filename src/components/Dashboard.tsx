import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ArrowLeft,
  Bot,
  ChartNoAxesColumn,
  ChartPie,
  Check,
  Copy,
  FileSearch,
  FileUp,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  Plus,
  ReceiptText,
  SendHorizontal,
  Settings,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from '@/components/ui/chat-container'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/message'
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input'
import { PromptSuggestion } from '@/components/ui/prompt-suggestion'
import { ScrollButton } from '@/components/ui/scroll-button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SystemMessage } from '@/components/ui/system-message'
import { ThinkingBar } from '@/components/ui/thinking-bar'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Shimmer } from '@/components/ai-elements/shimmer'
import { SyncfyConnect } from '@/components/SyncfyConnect'
import { cn } from '@/lib/utils'
import {
  getDashboardAuthHeaders,
  getStoredDashboardEmail,
  setDashboardSession,
} from '@/lib/dashboard-session'

interface DashboardProps {
  email: string | null
  onBackHome: () => void
  onLogout: () => void
}

type TransactionType = 'income' | 'expense'
type TransactionSource = 'manual' | 'cartola' | 'syncfy'
type DashboardPage = 'inicio' | 'syncfy' | 'cartola' | 'movimientos' | 'categorias' | 'analisis' | 'ajustes'
type DashboardChartView = 'flujo' | 'categorias' | 'movimientos'

interface FinanceTransaction {
  id: string
  email: string
  date: string
  type: TransactionType
  amount: number
  currency: string
  category: string
  description: string
  merchant: string | null
  notes: string | null
  source: TransactionSource
  confidence: number
  rawSource: string | null
  cartolaImportId: string | null
  created_at: string
}

interface CartolaDraftRow {
  id: string
  date: string
  type: TransactionType
  amount: number
  currency: string
  category: string
  description: string
  merchant: string
  confidence: number
  rawSource: string
}

interface FinanceSummary {
  month: string
  monthlyIncome: number
  monthlySpending: number
  netBalance: number
  transactionCount: number
  topSpendingCategory: string
  topSpendingCategoryAmount: number
  unusualHighSpendDay: { date: string; amount: number } | null
  recurringExpenses: Array<{ key: string; description: string; amount: number; count: number }>
  estimatedSavingsOpportunity: number
}

interface FinanceInsight {
  id: string
  title: string
  value: string
  body: string
  tone: 'good' | 'watch' | 'urgent'
}

interface DashboardResponse {
  success: boolean
  email: string
  transactions: FinanceTransaction[]
  summary: FinanceSummary
  insights: FinanceInsight[]
  message?: string
}

interface CartolaImportResponse {
  success: boolean
  email: string
  importId: string
  fileName: string
  fileType: string
  rows: CartolaDraftRow[]
  message: string
}

interface ManualForm {
  type: TransactionType
  amount: string
  date: string
  category: string
  description: string
  merchant: string
  notes: string
}

interface ManualDraft extends ManualForm {
  id: string
}

interface DashboardChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  chart?: DashboardChatChartType
  reasoning?: string
  reasoningDuration?: number
}

type DashboardChatChartType = 'categories' | 'daily-spend' | 'savings' | 'recurring'

interface PendingChatAnswer {
  question: string
  reasoning: string
  startedAt: number
}

interface HouseholdInvite {
  id: string
  inviterEmail: string
  inviteeEmail: string
  status: 'pending' | 'accepted' | 'cancelled'
  created_at: string
}

interface HouseholdResponse {
  success: boolean
  email: string
  invite?: HouseholdInvite
  invites: HouseholdInvite[]
  message?: string
}

type AnalysisTransaction = Pick<FinanceTransaction, 'date' | 'type' | 'amount' | 'currency' | 'category' | 'description'>

const EXPENSE_CATEGORIES = [
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
  'Impuestos',
  'Otro',
]

const INCOME_CATEGORIES = ['Sueldo', 'Freelance', 'Inversión', 'Reembolso', 'Venta', 'Otro ingreso']
const DISCRETIONARY_CATEGORIES = new Set(['Comida fuera', 'Suscripciones', 'Ocio', 'Transporte'])
const DASHBOARD_CHAT_SUGGESTIONS = [
  '¿Dónde está mi fuga principal?',
  '¿Qué puedo ahorrar esta semana?',
  '¿Qué patrón se repite?',
  '¿Cuánto podría invertir?',
]
const DASHBOARD_PAGES: Array<{ id: DashboardPage; label: string; icon: typeof Sparkles }> = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
  { id: 'syncfy', label: 'Conectar cuenta', icon: Landmark },
  { id: 'movimientos', label: 'Movimientos', icon: ReceiptText },
  { id: 'categorias', label: 'Categorías', icon: ChartPie },
  { id: 'analisis', label: 'Análisis', icon: ChartNoAxesColumn },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
]
const PAGE_META: Record<DashboardPage, { title: string; description: string }> = {
  inicio: {
    title: 'Inicio',
    description: 'Tus fugas, patrones y oportunidades para ahorrar e invertir.',
  },
  syncfy: {
    title: 'Conectar cuenta',
    description: 'Vincula bancos, SAT, Bitso, American Express y fuentes compatibles con Syncfy.',
  },
  cartola: {
    title: 'Importación de respaldo',
    description: 'Flujo operativo no principal para revisar movimientos antes de guardarlos.',
  },
  movimientos: {
    title: 'Movimientos',
    description: 'Transacciones conectadas que FinovAI usa para detectar patrones.',
  },
  categorias: {
    title: 'Categorías',
    description: 'Dónde se está yendo tu dinero por rubro.',
  },
  analisis: {
    title: 'Análisis',
    description: 'Lecturas de fugas, recurrencias y ahorro posible.',
  },
  ajustes: {
    title: 'Ajustes',
    description: 'Perfil, seguridad y controles de datos.',
  },
}
const METRIC_VALUE_CLASS = 'mt-2 min-w-0 text-[1.35rem] font-semibold leading-tight tracking-normal tabular-nums [overflow-wrap:anywhere]'
const PANEL_VALUE_CLASS = 'mt-2 min-w-0 text-lg font-semibold leading-tight tracking-normal tabular-nums [overflow-wrap:anywhere]'
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)',
]
const CASHFLOW_CHART_CONFIG = {
  spending: {
    label: 'Gastos',
    color: 'var(--chart-1)',
  },
  income: {
    label: 'Ingresos',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig
const SINGLE_VALUE_CHART_CONFIG = {
  amount: {
    label: 'Monto',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig
const DEFAULT_INVESTMENT_ASSUMPTION = {
  years: 10,
  annualReturn: 0.08,
}
const CHAT_TOOLTIP_POSITION = { x: 8, y: 8 }
const CHAT_TOOLTIP_WRAPPER_STYLE: CSSProperties = {
  maxWidth: 'calc(100% - 16px)',
  pointerEvents: 'none',
  zIndex: 30,
}
const CHAT_TOOLTIP_CLASS = 'min-w-0 max-w-48 whitespace-normal break-words'

const EMPTY_SUMMARY: FinanceSummary = {
  month: new Date().toISOString().slice(0, 7),
  monthlyIncome: 0,
  monthlySpending: 0,
  netBalance: 0,
  transactionCount: 0,
  topSpendingCategory: 'Sin datos',
  topSpendingCategoryAmount: 0,
  unusualHighSpendDay: null,
  recurringExpenses: [],
  estimatedSavingsOpportunity: 0,
}

const EMPTY_TRANSACTIONS: FinanceTransaction[] = []
const EMPTY_INSIGHTS: FinanceInsight[] = []

function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

function createManualForm(): ManualForm {
  return {
    type: 'expense',
    amount: '',
    date: getTodayInputDate(),
    category: 'Comida fuera',
    description: '',
    merchant: '',
    notes: '',
  }
}

function formatCurrency(value: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(value)
}

function formatCardCurrency(value: number, currency = 'MXN') {
  const formatted = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Math.abs(value))

  return value < 0 ? `-${formatted}` : formatted
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function formatTransactionSource(source: TransactionSource) {
  if (source === 'syncfy') return 'Syncfy'
  if (source === 'cartola') return 'Importación de respaldo'
  return 'Ajuste de respaldo'
}

function formatMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...getDashboardAuthHeaders(),
      ...init?.headers,
    },
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Error de API')
  }

  return data as T
}

function getStoredEmail(fallback: string | null) {
  if (fallback) return fallback
  return getStoredDashboardEmail()
}

function getInsightToneClasses(tone: FinanceInsight['tone']) {
  if (tone === 'good') return 'border-[#00D4AA]/25 bg-[#00D4AA]/10 text-[#00D4AA]'
  if (tone === 'urgent') return 'border-rose-500/20 bg-rose-500/8 text-rose-300'
  return 'border-amber-500/20 bg-amber-500/8 text-amber-300'
}

function normalizeQuestion(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getExpenseBreakdown(transactions: AnalysisTransaction[], month: string) {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || !transaction.date.startsWith(month)) continue
    totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amount)
  }

  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

function getTopTransactions(transactions: AnalysisTransaction[], month: string) {
  return transactions
    .filter((transaction) => transaction.type === 'expense' && transaction.date.startsWith(month))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
}

function getShortChartLabel(value: string, maxLength = 18) {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean

  return `${clean.slice(0, maxLength - 1).trim()}…`
}

function getDailyFlowChartData(transactions: AnalysisTransaction[], month: string) {
  const totals = new Map<string, { date: string; label: string; income: number; spending: number; net: number }>()

  for (const transaction of transactions) {
    if (!transaction.date.startsWith(month)) continue
    const current = totals.get(transaction.date) || {
      date: transaction.date,
      label: formatDate(transaction.date),
      income: 0,
      spending: 0,
      net: 0,
    }

    if (transaction.type === 'income') current.income += transaction.amount
    else current.spending += transaction.amount
    current.net = current.income - current.spending
    totals.set(transaction.date, current)
  }

  return [...totals.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      ...item,
      income: Math.round(item.income * 100) / 100,
      spending: Math.round(item.spending * 100) / 100,
      net: Math.round(item.net * 100) / 100,
    }))
}

function getCategoryChartData(breakdown: Array<{ category: string; total: number }>, monthlySpending: number) {
  const topCategories = breakdown.slice(0, 6)

  return topCategories.map((item, index) => ({
    category: item.category,
    label: getShortChartLabel(item.category, 16),
    amount: Math.round(item.total * 100) / 100,
    share: monthlySpending > 0 ? Math.round((item.total / monthlySpending) * 100) : 0,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }))
}

function getTopExpenseChartData(transactions: AnalysisTransaction[], month: string) {
  return getTopTransactions(transactions, month).slice(0, 5).map((transaction, index) => ({
    label: getShortChartLabel(transaction.description || transaction.category, 22),
    description: transaction.description,
    category: transaction.category,
    amount: Math.round(transaction.amount * 100) / 100,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }))
}

function getSavingsChartData(breakdown: Array<{ category: string; total: number }>) {
  return breakdown
    .filter((item) => DISCRETIONARY_CATEGORIES.has(item.category))
    .slice(0, 4)
    .map((item, index) => ({
      category: item.category,
      label: getShortChartLabel(item.category, 14),
      amount: Math.round(item.total * 0.15 * 100) / 100,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }))
    .filter((item) => item.amount > 0)
}

function getRecurringChartData(summary: FinanceSummary) {
  return summary.recurringExpenses.slice(0, 4).map((expense, index) => ({
    label: getShortChartLabel(expense.description, 16),
    description: expense.description,
    amount: expense.amount,
    count: expense.count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }))
}

function getLatestMonth(transactions: AnalysisTransaction[]) {
  return transactions
    .map((transaction) => transaction.date.slice(0, 7))
    .filter(Boolean)
    .sort()
    .at(-1) || EMPTY_SUMMARY.month
}

function buildLocalSummary(transactions: AnalysisTransaction[]): FinanceSummary {
  const month = getLatestMonth(transactions)
  const monthlyTransactions = transactions.filter((transaction) => transaction.date.startsWith(month))
  const categoryTotals = new Map<string, number>()
  const dayTotals = new Map<string, number>()
  const recurringGroups = new Map<string, AnalysisTransaction[]>()
  let monthlyIncome = 0
  let monthlySpending = 0
  let estimatedSavingsOpportunity = 0

  for (const transaction of monthlyTransactions) {
    if (transaction.type === 'income') {
      monthlyIncome += transaction.amount
      continue
    }

    monthlySpending += transaction.amount
    categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) || 0) + transaction.amount)
    dayTotals.set(transaction.date, (dayTotals.get(transaction.date) || 0) + transaction.amount)
    if (DISCRETIONARY_CATEGORIES.has(transaction.category)) {
      estimatedSavingsOpportunity += transaction.amount * 0.15
    }

    const recurringKey = transaction.description.toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim()
    if (recurringKey) {
      recurringGroups.set(recurringKey, [...(recurringGroups.get(recurringKey) || []), transaction])
    }
  }

  const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]
  const unusualDay = [...dayTotals.entries()].sort((a, b) => b[1] - a[1])[0]
  const recurringExpenses = [...recurringGroups.entries()]
    .filter(([, group]) => group.length >= 2)
    .map(([key, group]) => ({
      key,
      description: group[0]?.description || key,
      amount: Math.round((group.reduce((total, item) => total + item.amount, 0) / group.length) * 100) / 100,
      count: group.length,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    month,
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    monthlySpending: Math.round(monthlySpending * 100) / 100,
    netBalance: Math.round((monthlyIncome - monthlySpending) * 100) / 100,
    transactionCount: monthlyTransactions.length,
    topSpendingCategory: topCategory?.[0] || 'Sin datos',
    topSpendingCategoryAmount: Math.round((topCategory?.[1] || 0) * 100) / 100,
    unusualHighSpendDay: unusualDay ? { date: unusualDay[0], amount: Math.round(unusualDay[1] * 100) / 100 } : null,
    recurringExpenses,
    estimatedSavingsOpportunity: Math.round(estimatedSavingsOpportunity * 100) / 100,
  }
}

function projectMonthlyContribution(monthlyContribution: number, years = DEFAULT_INVESTMENT_ASSUMPTION.years) {
  if (monthlyContribution <= 0) return 0

  const months = years * 12
  const monthlyReturn = DEFAULT_INVESTMENT_ASSUMPTION.annualReturn / 12
  let value = 0

  for (let month = 0; month < months; month += 1) {
    value = (value + monthlyContribution) * (1 + monthlyReturn)
  }

  return Math.round(value)
}

function getSavingsProjection(summary: FinanceSummary) {
  return projectMonthlyContribution(summary.estimatedSavingsOpportunity)
}

function draftRowToAnalysisTransaction(row: CartolaDraftRow): AnalysisTransaction {
  return {
    date: row.date,
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    category: row.category,
    description: row.description,
  }
}

function buildDashboardChatOpening(transactions: AnalysisTransaction[], draftCount: number, selectedDraftCount: number) {
  if (draftCount > 0 && selectedDraftCount > 0) {
    return `Ya puedo hacer un análisis preliminar de ${selectedDraftCount} movimientos seleccionados. Pregúntame qué se repite, dónde se fuga dinero o qué podrías ahorrar.`
  }

  if (draftCount > 0) {
    return 'Tienes movimientos de respaldo cargados, pero no hay filas seleccionadas. Marca movimientos para analizarlos antes de confirmar.'
  }

  if (transactions.length === 0) {
    return 'Conecta una cuenta con Syncfy. En cuanto entren transacciones, puedo encontrar fugas, patrones y oportunidades para ahorrar.'
  }

  return 'Ya tengo movimientos conectados. Pregúntame dónde se fuga tu dinero, qué patrón se repite o cuánto podrías ahorrar e invertir.'
}

function buildDashboardChatAnswer(
  question: string,
  transactions: AnalysisTransaction[],
  summary: FinanceSummary,
  currency: string,
  isDraftAnalysis = false
) {
  if (transactions.length === 0) {
    return 'Todavía no tengo transacciones para analizar. Conecta una cuenta con Syncfy para que FinovAI lea movimientos reales.'
  }

  const normalized = normalizeQuestion(question)
  const breakdown = getExpenseBreakdown(transactions, summary.month)
  const topCategory = breakdown[0]
  const topTransactions = getTopTransactions(transactions, summary.month)
  const prefix = isDraftAnalysis ? 'Preliminar: ' : ''

  if (/(donde|categoria|rubro|gaste|gast[eé]|mas|mayor|principal)/.test(normalized) && topCategory) {
    const share = summary.monthlySpending > 0 ? Math.round((topCategory.total / summary.monthlySpending) * 100) : 0
    const nextCategories = breakdown.slice(1, 3)
      .map((item) => `${item.category}: ${formatCurrency(item.total, currency)}`)
      .join(' · ')

    return `${prefix}Tu mayor gasto de ${formatMonth(summary.month)} está en ${topCategory.category}: ${formatCurrency(topCategory.total, currency)} (${share}% del gasto).${nextCategories ? ` Después viene ${nextCategories}.` : ''}`
  }

  if (/(ahorr|reduc|bajar|optim|invert|invers|futur)/.test(normalized)) {
    return summary.estimatedSavingsOpportunity > 0
      ? `${prefix}Veo una oportunidad inicial de ahorro de ${formatCurrency(summary.estimatedSavingsOpportunity, currency)}. La estimación sale de reducir una parte de gastos flexibles y revisar cargos recurrentes. Ese margen podría convertirse en aportación hacia una plataforma de inversión aliada.`
      : `${prefix}Aún no veo una oportunidad clara de ahorro. Necesito más movimientos o categorías más precisas para estimarlo.`
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
    return `${prefix}En ${formatMonth(summary.month)} tienes ingresos por ${formatCurrency(summary.monthlyIncome, currency)}, gastos por ${formatCurrency(summary.monthlySpending, currency)} y balance neto de ${formatCurrency(summary.netBalance, currency)}.`
  }

  if (topTransactions.length > 0) {
    const biggest = topTransactions
      .map((transaction) => `${transaction.description}: ${formatCurrency(transaction.amount, currency)}`)
      .join(' · ')

    return `${prefix}Lectura rápida: gastaste ${formatCurrency(summary.monthlySpending, currency)} en ${formatMonth(summary.month)}. La categoría principal es ${summary.topSpendingCategory}. Movimientos grandes: ${biggest}.`
  }

  return `${prefix}Tengo ${transactions.length} movimientos para analizar. Puedo revisar categorías, días atípicos, cargos recurrentes y ahorro estimado.`
}

function getDashboardChatChartType(
  question: string,
  transactions: AnalysisTransaction[],
  summary: FinanceSummary
): DashboardChatChartType | undefined {
  if (transactions.length === 0) return undefined

  const normalized = normalizeQuestion(question)
  const hasMonthSpending = summary.monthlySpending > 0

  if (/(donde|categoria|rubro|gaste|gast[eé]|mas|mayor|principal)/.test(normalized) && hasMonthSpending) {
    return 'categories'
  }

  if (/(ahorr|reduc|bajar|optim|invert|invers|futur)/.test(normalized) && summary.estimatedSavingsOpportunity > 0) {
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

function buildDashboardChatReasoning(
  question: string,
  transactions: AnalysisTransaction[],
  summary: FinanceSummary,
  isDraftAnalysis = false
) {
  if (transactions.length === 0) {
    return 'Estoy revisando si hay transacciones disponibles. Sin una cuenta conectada, la respuesta solo puede orientar el siguiente paso.'
  }

  const normalized = normalizeQuestion(question)
  const scope = isDraftAnalysis ? 'movimientos seleccionados' : 'transacciones confirmadas'

  if (/(donde|categoria|rubro|gaste|gast[eé]|mas|mayor|principal)/.test(normalized)) {
    return `Agrupo ${transactions.length} ${scope} por categoría, sumo solo gastos de ${formatMonth(summary.month)} y comparo el peso relativo de los rubros principales.`
  }

  if (/(ahorr|reduc|bajar|optim|invert|invers|futur)/.test(normalized)) {
    return `Reviso gastos flexibles y cargos repetidos de ${formatMonth(summary.month)} para estimar una oportunidad conservadora de ahorro que podría invertirse después.`
  }

  if (/(recurrent|suscrip|mensual|repite|repet)/.test(normalized)) {
    return `Busco descripciones repetidas en los ${scope} para separar cargos recurrentes de compras puntuales.`
  }

  if (/(dia|d[ií]a|raro|inusual|alto|peak|pico)/.test(normalized)) {
    return `Sumo el gasto por día y busco el pico de ${formatMonth(summary.month)} para detectar un día atípico.`
  }

  return `Reviso ingresos, gastos, balance neto, categorías y movimientos grandes de ${formatMonth(summary.month)} antes de responder.`
}

export default function Dashboard({ email, onBackHome, onLogout }: DashboardProps) {
  const [activeEmail, setActiveEmail] = useState<string | null>(() => getStoredEmail(email))
  const [emailInput, setEmailInput] = useState(() => getStoredEmail(email) || '')
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [manualForm, setManualForm] = useState<ManualForm>(() => createManualForm())
  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([])
  const [draftRows, setDraftRows] = useState<CartolaDraftRow[]>([])
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set())
  const [currentImport, setCurrentImport] = useState<CartolaImportResponse | null>(null)
  const [status, setStatus] = useState('Identifícate con email para conectar una cuenta con Syncfy.')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<DashboardChatMessage[]>([])
  const [pendingChatAnswer, setPendingChatAnswer] = useState<PendingChatAnswer | null>(null)
  const [activePage, setActivePage] = useState<DashboardPage>('inicio')
  const [activeChartView, setActiveChartView] = useState<DashboardChartView>('flujo')
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)
  const [spouseEmail, setSpouseEmail] = useState('')
  const [householdInvites, setHouseholdInvites] = useState<HouseholdInvite[]>([])
  const [isInvitingSpouse, setIsInvitingSpouse] = useState(false)
  const [copiedChatMessageId, setCopiedChatMessageId] = useState<string | null>(null)
  const chatAnswerTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (email && email !== activeEmail) {
      setActiveEmail(email)
      setEmailInput(email)
    }
  }, [activeEmail, email])

  useEffect(() => {
    let cancelled = false
    if (!activeEmail) return

    setIsLoading(true)
    setStatus('Cargando transacciones conectadas.')

    apiJson<DashboardResponse>(`/api/transactions?email=${encodeURIComponent(activeEmail)}`)
      .then((response) => {
        if (cancelled) return
        setData(response)
        setStatus(response.transactions.length > 0
          ? 'Transacciones listas para análisis.'
          : 'Conecta una cuenta con Syncfy para analizar tus datos reales.')
      })
      .catch((error: Error) => {
        if (cancelled) return
        setStatus(error.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeEmail])

  useEffect(() => {
    let cancelled = false
    if (!activeEmail) {
      setHouseholdInvites([])
      return
    }

    apiJson<HouseholdResponse>(`/api/household?email=${encodeURIComponent(activeEmail)}`)
      .then((response) => {
        if (!cancelled) setHouseholdInvites(response.invites || [])
      })
      .catch(() => {
        if (!cancelled) setHouseholdInvites([])
      })

    return () => {
      cancelled = true
    }
  }, [activeEmail])

  const transactions = data?.transactions || EMPTY_TRANSACTIONS
  const summary = data?.summary || EMPTY_SUMMARY
  const insights = data?.insights || EMPTY_INSIGHTS
  const categories = manualForm.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const hasTransactions = transactions.length > 0
  const hasDraftRows = draftRows.length > 0
  const showExampleAnalysis = !hasTransactions && !hasDraftRows
  const selectedRows = useMemo(
    () => draftRows.filter((row) => selectedDraftIds.has(row.id)),
    [draftRows, selectedDraftIds]
  )
  const draftAnalysisTransactions = useMemo(
    () => selectedRows.map(draftRowToAnalysisTransaction),
    [selectedRows]
  )
  const chatTransactions: AnalysisTransaction[] = hasDraftRows ? draftAnalysisTransactions : transactions
  const chatSummary = hasDraftRows ? buildLocalSummary(draftAnalysisTransactions) : summary
  const latestCurrency = transactions[0]?.currency || 'MXN'
  const chatCurrency = chatTransactions[0]?.currency || latestCurrency
  const isDraftChat = hasDraftRows
  const pageMeta = PAGE_META[activePage]
  const categoryBreakdown = getExpenseBreakdown(chatTransactions, chatSummary.month)
  const topAnalysisTransactions = getTopTransactions(chatTransactions, chatSummary.month)
  const lowConfidenceRows = draftRows.filter((row) => row.confidence < 0.75).length
  const dataModeLabel = hasDraftRows ? 'Preliminar' : hasTransactions ? 'Confirmado' : 'Sin datos'
  const cashflowChartData = useMemo(
    () => getDailyFlowChartData(chatTransactions, chatSummary.month),
    [chatTransactions, chatSummary.month]
  )
  const categoryChartData = useMemo(
    () => getCategoryChartData(categoryBreakdown, chatSummary.monthlySpending),
    [categoryBreakdown, chatSummary.monthlySpending]
  )
  const savingsChartData = useMemo(
    () => getSavingsChartData(categoryBreakdown),
    [categoryBreakdown]
  )
  const recurringChartData = useMemo(
    () => getRecurringChartData(chatSummary),
    [chatSummary]
  )
  const projectedSavingsValue = useMemo(
    () => getSavingsProjection(chatSummary),
    [chatSummary]
  )
  const topExpenseChartData = useMemo(
    () => getTopExpenseChartData(chatTransactions, chatSummary.month),
    [chatTransactions, chatSummary.month]
  )
  const hasChartData = chatTransactions.length > 0
  const chatPromptPlaceholder = hasDraftRows ? 'Pregunta por estos movimientos...' : 'Pregunta por tus fugas o patrones...'
  const chatSystemMessage = hasDraftRows
    ? 'Estás viendo datos preliminares. FinovAI puede analizarlos antes de guardar, pero todavía debes confirmar las filas.'
    : hasTransactions
      ? `FinovAI está leyendo ${transactions.length} transacciones para responder con fugas, patrones y ahorro posible.`
      : 'Conecta una cuenta con Syncfy para que FinovAI pueda darte una lectura real.'

  useEffect(() => {
    if (!activeEmail) {
      setChatMessages((current) => (current.length > 0 ? [] : current))
      return
    }

    setChatMessages((current) => {
      const firstMessage = current[0]
      const welcomeId = `welcome-${activeEmail}-${hasDraftRows ? `draft-${selectedRows.length}-${draftRows.length}` : `confirmed-${transactions.length}`}`
      if (firstMessage?.id === welcomeId) return current

      return [
        {
          id: welcomeId,
          role: 'assistant',
          content: buildDashboardChatOpening(chatTransactions, draftRows.length, selectedRows.length),
        },
        ...current.filter((message) => !message.id.startsWith(`welcome-${activeEmail}`)),
      ]
    })
  }, [activeEmail, chatTransactions, draftRows.length, hasDraftRows, selectedRows.length, transactions.length])

  useEffect(() => () => {
    if (chatAnswerTimeoutRef.current) {
      window.clearTimeout(chatAnswerTimeoutRef.current)
    }
  }, [])

  const handleIdentify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = emailInput.trim().toLowerCase()
    if (!normalizedEmail.includes('@')) {
      setStatus('Ingresa un email válido.')
      return
    }

    setIsLoading(true)
    setStatus('Registrando email.')

    try {
      const response = await apiJson<{ success: boolean; email: string; clientSecret?: string }>('/api/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          diagnosticData: JSON.stringify({
            source: 'dashboard-email-gate',
            capturedAt: new Date().toISOString(),
          }),
        }),
      })
      const registeredEmail = response.email || normalizedEmail
      setDashboardSession(registeredEmail, response.clientSecret)
      setActiveEmail(registeredEmail)
      setEmailInput(registeredEmail)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos registrar el email.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInviteSpouse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeEmail) return

    const normalizedSpouseEmail = spouseEmail.trim().toLowerCase()
    if (!normalizedSpouseEmail.includes('@')) {
      setStatus('Ingresa el email de tu pareja.')
      return
    }
    if (normalizedSpouseEmail === activeEmail) {
      setStatus('Usa un email distinto para invitar a tu pareja.')
      return
    }

    setIsInvitingSpouse(true)
    try {
      const response = await apiJson<HouseholdResponse>('/api/household/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: activeEmail,
          spouseEmail: normalizedSpouseEmail,
        }),
      })

      setHouseholdInvites(response.invites || [])
      setSpouseEmail('')
      setStatus(`Invitación guardada para ${normalizedSpouseEmail}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos guardar la invitación.')
    } finally {
      setIsInvitingSpouse(false)
    }
  }

  const updateManualForm = <K extends keyof ManualForm>(field: K, value: ManualForm[K]) => {
    setManualForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'type') {
        next.category = value === 'income' ? 'Sueldo' : 'Comida fuera'
      }
      return next
    })
  }

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!manualForm.amount.trim()) {
      setStatus('Ingresa un monto antes de agregarlo a la lista.')
      return
    }
    if (!manualForm.date) {
      setStatus('Ingresa una fecha antes de agregarlo a la lista.')
      return
    }

    const nextCount = manualDrafts.length + 1
    setManualDrafts((current) => [
      ...current,
      { ...manualForm, id: crypto.randomUUID() },
    ])
    setManualForm((current) => ({
      ...createManualForm(),
      type: current.type,
      category: current.type === 'income' ? 'Sueldo' : 'Comida fuera',
      date: current.date,
    }))
    setStatus(`${nextCount} ${nextCount === 1 ? 'movimiento listo' : 'movimientos listos'} para guardar.`)
  }

  const removeManualDraft = (id: string) => {
    setManualDrafts((current) => current.filter((draft) => draft.id !== id))
  }

  const handleSaveManualDrafts = async () => {
    if (!activeEmail) {
      setStatus('Primero identifica el email del usuario.')
      return
    }
    if (manualDrafts.length === 0) {
      setStatus('Agrega al menos un movimiento a la lista de respaldo.')
      return
    }

    const draftsToSave = manualDrafts
    setIsSaving(true)
    try {
      let latestResponse: DashboardResponse | null = null

      for (const draft of draftsToSave) {
        latestResponse = await apiJson<DashboardResponse>('/api/transactions/manual', {
          method: 'POST',
          body: JSON.stringify({
            email: activeEmail,
            date: draft.date,
            type: draft.type,
            amount: draft.amount,
            currency: 'MXN',
            category: draft.category,
            description: draft.description,
            merchant: draft.merchant,
            notes: draft.notes,
          }),
        })
      }

      if (latestResponse) setData(latestResponse)
      setManualDrafts([])
      setStatus(`${draftsToSave.length} ${draftsToSave.length === 1 ? 'movimiento guardado' : 'movimientos guardados'}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos guardar los movimientos.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCartolaUpload = async (file: File | null) => {
    if (!file || !activeEmail) return

    setIsUploading(true)
    setDraftRows([])
    setSelectedDraftIds(new Set())
    setCurrentImport(null)

    try {
      const formData = new FormData()
      formData.append('email', activeEmail)
      formData.append('file', file)

      const response = await apiJson<CartolaImportResponse>('/api/cartola/import', {
        method: 'POST',
        body: formData,
      })

      setCurrentImport(response)
      setDraftRows(response.rows)
      setSelectedDraftIds(new Set(response.rows.map((row) => row.id)))
      setStatus(response.message)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos leer los movimientos.')
    } finally {
      setIsUploading(false)
    }
  }

  const toggleDraftRow = (id: string) => {
    setSelectedDraftIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateDraftRow = <K extends keyof CartolaDraftRow>(id: string, field: K, value: CartolaDraftRow[K]) => {
    setDraftRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  const handleConfirmCartola = async () => {
    if (!activeEmail || !currentImport || selectedRows.length === 0) {
      setStatus('Selecciona al menos un movimiento para confirmar.')
      return
    }

    setIsConfirming(true)
    try {
      const response = await apiJson<DashboardResponse>('/api/cartola/confirm', {
        method: 'POST',
        body: JSON.stringify({
          email: activeEmail,
          importId: currentImport.importId,
          rows: selectedRows.map((row) => ({ ...row, selected: true })),
        }),
      })
      setData(response)
      setDraftRows([])
      setSelectedDraftIds(new Set())
      setCurrentImport(null)
      setStatus(response.message || 'Movimientos confirmados.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos confirmar los movimientos.')
    } finally {
      setIsConfirming(false)
    }
  }

  const queueDashboardChatAnswer = (question: string) => {
    if (!question) return
    if (pendingChatAnswer) return

    const reasoning = buildDashboardChatReasoning(question, chatTransactions, chatSummary, isDraftChat)
    const startedAt = Date.now()
    setChatMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: question },
    ])
    setPendingChatAnswer({ question, reasoning, startedAt })
    setChatInput('')

    if (chatAnswerTimeoutRef.current) {
      window.clearTimeout(chatAnswerTimeoutRef.current)
    }

    chatAnswerTimeoutRef.current = window.setTimeout(() => {
      const answer = buildDashboardChatAnswer(question, chatTransactions, chatSummary, chatCurrency, isDraftChat)
      const chart = getDashboardChatChartType(question, chatTransactions, chatSummary)
      const reasoningDuration = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000))

      setChatMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: answer,
          chart,
          reasoning,
          reasoningDuration,
        },
      ])
      setPendingChatAnswer(null)
      chatAnswerTimeoutRef.current = null
    }, 1200)
  }

  const submitDashboardChatInput = () => {
    queueDashboardChatAnswer(chatInput.trim())
  }

  const askDashboardQuestion = (question: string) => {
    queueDashboardChatAnswer(question)
  }

  const copyChatMessage = (message: DashboardChatMessage) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(message.content)
    }
    setCopiedChatMessageId(message.id)
    window.setTimeout(() => {
      setCopiedChatMessageId((current) => (current === message.id ? null : current))
    }, 1200)
  }

  const renderChatChart = (chart?: DashboardChatChartType) => {
    if (!chart) return null

    if (chart === 'categories') {
      const data = categoryChartData.slice(0, 4)
      if (data.length === 0) return null

      return (
        <div className="mt-3 rounded-lg bg-background/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Categorías
              </p>
              <p className="mt-1 text-sm font-semibold leading-tight">{data[0].category}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              {data[0].share}%
            </p>
          </div>
          <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="mt-2 h-32 w-full aspect-auto">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 6, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                dataKey="label"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickMargin={4}
                width={108}
              />
              <ChartTooltip
                cursor={false}
                position={CHAT_TOOLTIP_POSITION}
                wrapperStyle={CHAT_TOOLTIP_WRAPPER_STYLE}
                content={(
                  <ChartTooltipContent
                    className={CHAT_TOOLTIP_CLASS}
                    hideLabel
                    formatter={(value, name, item) => (
                      <>
                        <span className="text-muted-foreground">
                          {String(item?.payload?.category || name)}
                        </span>
                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                          {formatCardCurrency(Number(value), chatCurrency)}
                        </span>
                      </>
                    )}
                  />
                )}
              />
              <Bar dataKey="amount" radius={5}>
                {data.map((item) => (
                  <Cell key={item.category} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )
    }

    if (chart === 'daily-spend') {
      const data = cashflowChartData.filter((item) => item.spending > 0 || item.income > 0)
      if (data.length === 0) return null

      return (
        <div className="mt-3 rounded-lg bg-background/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Gasto diario
              </p>
              <p className="mt-1 text-sm font-semibold leading-tight">{formatMonth(chatSummary.month)}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              {formatCardCurrency(chatSummary.monthlySpending, chatCurrency)}
            </p>
          </div>
          <ChartContainer config={CASHFLOW_CHART_CONFIG} className="mt-2 h-36 w-full aspect-auto">
            <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} minTickGap={18} />
              <YAxis hide domain={[0, 'dataMax']} />
              <ChartTooltip
                cursor={false}
                position={CHAT_TOOLTIP_POSITION}
                wrapperStyle={CHAT_TOOLTIP_WRAPPER_STYLE}
                content={(
                  <ChartTooltipContent
                    className={CHAT_TOOLTIP_CLASS}
                    formatter={(value, name) => (
                      <>
                        <span className="text-muted-foreground">
                          {name === 'income' ? 'Ingresos' : 'Gastos'}
                        </span>
                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                          {formatCardCurrency(Number(value), chatCurrency)}
                        </span>
                      </>
                    )}
                  />
                )}
              />
              <Area
                dataKey="spending"
                type="natural"
                fill="var(--color-spending)"
                fillOpacity={0.18}
                stroke="var(--color-spending)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      )
    }

    if (chart === 'savings') {
      const data = savingsChartData
      if (data.length === 0) return null

      return (
        <div className="mt-3 rounded-lg bg-[#00D4AA]/10 p-3 text-teal-50 shadow-[inset_0_0_0_1px_rgba(0,212,170,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-teal-200/80">
                Ahorro invertible
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatCardCurrency(chatSummary.estimatedSavingsOpportunity, chatCurrency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                10 años
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-[#00D4AA]">
                {formatCardCurrency(projectedSavingsValue, chatCurrency)}
              </p>
            </div>
          </div>
          <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="mt-2 h-28 w-full aspect-auto">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 6, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickMargin={4} width={108} />
              <ChartTooltip
                cursor={false}
                position={CHAT_TOOLTIP_POSITION}
                wrapperStyle={CHAT_TOOLTIP_WRAPPER_STYLE}
                content={(
                  <ChartTooltipContent
                    className={CHAT_TOOLTIP_CLASS}
                    hideLabel
                    formatter={(value, name, item) => (
                      <>
                        <span className="text-muted-foreground">
                          {String(item?.payload?.category || name)}
                        </span>
                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                          {formatCardCurrency(Number(value), chatCurrency)}
                        </span>
                      </>
                    )}
                  />
                )}
              />
              <Bar dataKey="amount" radius={5} fill="var(--primary)" />
            </BarChart>
          </ChartContainer>
        </div>
      )
    }

    const data = recurringChartData
    if (data.length === 0) return null

    return (
      <div className="mt-3 rounded-lg bg-background/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Recurrentes
        </p>
        <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="mt-2 h-28 w-full aspect-auto">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 6, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickMargin={4} width={108} />
            <ChartTooltip
              cursor={false}
              position={CHAT_TOOLTIP_POSITION}
              wrapperStyle={CHAT_TOOLTIP_WRAPPER_STYLE}
              content={(
                <ChartTooltipContent
                  className={CHAT_TOOLTIP_CLASS}
                  hideLabel
                  formatter={(value, name, item) => (
                    <>
                      <span className="text-muted-foreground">
                        {String(item?.payload?.description || name)}
                      </span>
                      <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                        {formatCardCurrency(Number(value), chatCurrency)}
                      </span>
                    </>
                  )}
                />
              )}
            />
            <Bar dataKey="amount" radius={5}>
              {data.map((item) => (
                <Cell key={item.description} fill={item.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    )
  }

  const renderChatReasoning = ({
    isStreaming,
    reasoning,
    duration,
  }: {
    isStreaming: boolean
    reasoning: string
    duration?: number
  }) => (
    <Reasoning
      className="mb-3 rounded-md bg-background/45 p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
      defaultOpen={isStreaming}
      duration={duration}
      isStreaming={isStreaming}
    >
      <ReasoningTrigger
        className="text-xs"
        getThinkingMessage={(streaming, seconds) => {
          if (streaming || seconds === 0) {
            return <Shimmer duration={1}>Analizando movimientos...</Shimmer>
          }

          return <span>Analizado en {seconds || 1}s</span>
        }}
      />
      <ReasoningContent className="mt-2 text-xs leading-relaxed">
        {reasoning}
      </ReasoningContent>
    </Reasoning>
  )

  const renderDashboardPromptSuggestions = (isMobile = false) => (
    <div
      className={cn(
        'flex min-w-0 max-w-full gap-2',
        isMobile ? '-mx-1 flex-nowrap overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap'
      )}
    >
      {!hasTransactions || hasDraftRows ? (
        <PromptSuggestion
          type="button"
          variant="secondary"
          size="sm"
          className={cn('rounded-full', isMobile && 'shrink-0')}
          onClick={() => setActivePage('syncfy')}
          disabled={Boolean(pendingChatAnswer)}
        >
          <Landmark data-icon="inline-start" />
          Conectar cuenta
        </PromptSuggestion>
      ) : null}
      {DASHBOARD_CHAT_SUGGESTIONS.map((question) => (
        <PromptSuggestion
          key={question}
          type="button"
          variant="outline"
          size="sm"
          className={cn('rounded-full', isMobile && 'shrink-0')}
          disabled={Boolean(pendingChatAnswer)}
          onClick={() => askDashboardQuestion(question)}
        >
          {question}
        </PromptSuggestion>
      ))}
    </div>
  )

  const renderDashboardChatMessage = (message: DashboardChatMessage, isMobile = false) => {
    const isAssistant = message.role === 'assistant'
    const hasRichChart = isAssistant && Boolean(message.chart)

    return (
      <Message
        key={message.id}
        className={cn(
          'group w-full min-w-0',
          isAssistant ? 'justify-start' : 'justify-end',
          !isMobile && isAssistant && 'items-start'
        )}
      >
        {isAssistant && !isMobile ? (
          <MessageAvatar
            src=""
            alt="FinovAI"
            fallback="F"
            className="mt-1 border border-[#2B7AE8]/20 bg-[#2B7AE8]/10 text-[#9dc2ff]"
          />
        ) : null}
        <div
          className={cn(
            'flex min-w-0 flex-col gap-1',
            hasRichChart
              ? isAssistant && !isMobile ? 'max-w-full flex-1' : 'w-full max-w-full'
              : isMobile ? 'max-w-[88%]' : 'max-w-[86%]',
            !isAssistant && 'items-end'
          )}
        >
          {!isMobile ? (
            <div className={cn('flex items-center gap-2 text-[0.7rem] text-muted-foreground', !isAssistant && 'justify-end')}>
              <span>{isAssistant ? 'FinovAI' : 'Tú'}</span>
              {isAssistant && message.chart ? <span>· gráfico incluido</span> : null}
            </div>
          ) : null}
          <MessageContent
            className={cn(
              'min-w-0 rounded-2xl px-3 py-2 text-sm leading-relaxed break-words shadow-none [overflow-wrap:anywhere]',
              isAssistant
                ? 'bg-card/80 text-card-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]'
                : 'bg-[#00D4AA] text-[#04111f] shadow-[0_12px_30px_rgba(0,212,170,0.18)]',
              hasRichChart && 'w-full max-w-full',
              !isMobile && isAssistant && 'rounded-tl-md',
              !isMobile && !isAssistant && 'rounded-tr-md'
            )}
          >
            {isAssistant && message.reasoning
              ? renderChatReasoning({
                isStreaming: false,
                reasoning: message.reasoning,
                duration: message.reasoningDuration,
              })
              : null}
            <p>{message.content}</p>
            {isAssistant ? renderChatChart(message.chart) : null}
          </MessageContent>
          {!isMobile && isAssistant ? (
            <MessageActions className="px-1 opacity-0 transition-opacity group-hover:opacity-100">
              <MessageAction tooltip={copiedChatMessageId === message.id ? 'Copiado' : 'Copiar respuesta'}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-full"
                  onClick={() => copyChatMessage(message)}
                  aria-label="Copiar respuesta"
                >
                  {copiedChatMessageId === message.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </MessageAction>
            </MessageActions>
          ) : null}
        </div>
        {!isAssistant && !isMobile ? (
          <MessageAvatar
            src=""
            alt="Usuario"
            fallback="T"
            className="mt-5 border border-border/70 bg-secondary text-foreground"
          />
        ) : null}
      </Message>
    )
  }

  const renderPendingChatMessage = (isMobile = false) => (
    <Message className="w-full min-w-0 justify-start">
      {!isMobile ? (
        <MessageAvatar
          src=""
          alt="FinovAI"
          fallback="F"
          className="mt-1 border border-[#2B7AE8]/20 bg-[#2B7AE8]/10 text-[#9dc2ff]"
        />
      ) : null}
      <MessageContent
        className={cn(
          'min-w-0 rounded-2xl rounded-tl-md bg-card/80 px-3 py-2 text-sm leading-relaxed text-card-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]',
          isMobile ? 'max-w-full' : 'max-w-[92%]'
        )}
      >
        <ThinkingBar text="Analizando movimientos..." />
        {pendingChatAnswer ? (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {pendingChatAnswer.reasoning}
          </p>
        ) : null}
      </MessageContent>
    </Message>
  )

  const renderDashboardChat = (isMobile = false) => (
    <Card
      className={cn(
        'flex min-w-0 overflow-hidden border-[#2B7AE8]/20 bg-card/95',
        isMobile
          ? 'h-full min-h-0 gap-0 rounded-none border-0 p-0 shadow-none'
          : 'h-full min-h-[560px] gap-0 rounded-xl border-border/70 bg-card/80 p-0 shadow-[0_24px_70px_rgba(0,0,0,0.22)]'
      )}
    >
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
        {isMobile ? <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" /> : null}
        <CardHeader
          className={cn(
            'min-w-0',
            isMobile ? 'gap-0 border-b border-border/60 px-4 py-3 pr-12' : 'gap-0 border-b border-border/60 px-4 py-4'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn('flex min-w-0 gap-3', isMobile ? 'items-center' : 'items-start')}>
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-md bg-[#2B7AE8]/10 text-[#7aa8ff]',
                  isMobile ? 'size-8' : 'size-9'
                )}
              >
                <Bot className={cn(isMobile ? 'size-3.5' : 'size-4')} />
              </div>
              <div className="min-w-0">
                <CardTitle className={cn(isMobile ? 'text-base leading-tight' : 'text-lg')}>
                  FinovAI
                </CardTitle>
                <CardDescription className={cn(isMobile && 'truncate text-xs leading-tight')}>
                  {hasDraftRows
                    ? 'Pregunta por estos movimientos.'
                    : hasTransactions
                      ? 'Pregunta por tus fugas y patrones.'
                      : 'Conecta una cuenta para empezar.'}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className={cn('flex min-h-0 min-w-0 flex-1 flex-col', isMobile ? 'gap-3 px-4 py-3' : 'gap-3 px-4 py-4')}>
          <ChatContainerRoot
            className={cn(
              'relative min-w-0 flex-1',
              isMobile
                ? 'min-h-0 rounded-none bg-transparent p-0 shadow-none'
                : 'min-h-56 overflow-x-hidden rounded-2xl bg-background/35 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
            )}
            aria-live="polite"
          >
            <ChatContainerContent className={cn('gap-3', isMobile ? 'pb-2' : 'p-3')}>
              {!isMobile ? (
                <SystemMessage
                  fill
                  variant={hasDraftRows ? 'warning' : 'action'}
                  icon={<Bot className="size-4" />}
                  cta={!hasTransactions && !hasDraftRows ? { label: 'Conectar cuenta', onClick: () => setActivePage('syncfy') } : undefined}
                >
                  {chatSystemMessage}
                </SystemMessage>
              ) : null}
              {chatMessages.map((message) => renderDashboardChatMessage(message, isMobile))}
              {pendingChatAnswer ? renderPendingChatMessage(isMobile) : null}
              <ChatContainerScrollAnchor />
            </ChatContainerContent>
            {!isMobile ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                <ScrollButton className="pointer-events-auto border-border/70 bg-card/95 shadow-lg" />
              </div>
            ) : null}
          </ChatContainerRoot>

          {renderDashboardPromptSuggestions(isMobile)}

          <PromptInput
            value={chatInput}
            onValueChange={setChatInput}
            onSubmit={submitDashboardChatInput}
            isLoading={Boolean(pendingChatAnswer)}
            disabled={Boolean(pendingChatAnswer)}
            className={cn(
              'min-w-0 rounded-2xl border-border/70 bg-background/55 p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]',
              isMobile && 'rounded-xl bg-secondary/25 p-1'
            )}
          >
            <PromptInputTextarea
              className={cn(
                'min-h-10 px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground',
                isMobile && 'min-h-9'
              )}
              placeholder={chatPromptPlaceholder}
              disabled={Boolean(pendingChatAnswer)}
            />
            <PromptInputActions className="justify-between gap-2 pt-1">
              <div className="flex min-w-0 items-center gap-1">
                <PromptInputAction tooltip="Conectar cuenta">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 rounded-full"
                    onClick={() => setActivePage('syncfy')}
                    disabled={Boolean(pendingChatAnswer)}
                    aria-label="Conectar cuenta"
                  >
                    <Landmark className="size-4" />
                  </Button>
                </PromptInputAction>
                {!isMobile ? (
                  <span className="truncate px-1 text-[0.7rem] text-muted-foreground">
                    Enter envía · Shift+Enter baja línea
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                size="icon"
                className={cn('size-9 shrink-0 bg-[#00D4AA] text-[#04111f] hover:bg-[#72f4db]')}
                disabled={!chatInput.trim() || Boolean(pendingChatAnswer)}
                aria-label="Enviar pregunta"
                onClick={submitDashboardChatInput}
              >
                {pendingChatAnswer ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
              </Button>
            </PromptInputActions>
          </PromptInput>
        </CardContent>
      </div>
    </Card>
  )

  if (activeEmail && !data) {
    return (
      <main className="finovai-dashboard dark min-h-screen bg-background text-foreground">
        <section className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-4">
          <header className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">FinovAI</p>
              <p className="text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">{activeEmail}</p>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={onLogout}>
              <LogOut data-icon="inline-start" />
              Salir
            </Button>
          </header>

          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Preparando tu análisis
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (activeEmail && data) {
    return (
      <main className="finovai-dashboard dark min-h-screen bg-background text-foreground">
        <Input
          id="cartola-upload"
          accept=".pdf,.csv,.tsv,.txt,application/pdf,text/csv,text/tab-separated-values"
          className="hidden"
          type="file"
          disabled={isUploading}
          onChange={(event) => {
            void handleCartolaUpload(event.target.files?.[0] || null)
            event.target.value = ''
          }}
        />

        <div className="grid min-h-screen w-full lg:grid-cols-[240px_minmax(0,1fr)_minmax(360px,400px)] lg:items-start">
          <aside className="flex min-w-0 flex-col gap-4 border-b border-border/70 p-3 sm:p-4 lg:sticky lg:top-0 lg:h-screen lg:gap-5 lg:border-b-0 lg:border-r">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">FinovAI</p>
                  <p className="text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">{activeEmail}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 lg:hidden" onClick={onLogout}>
                <LogOut data-icon="inline-start" />
                Salir
              </Button>
            </div>

            <nav className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:gap-1.5 lg:overflow-visible lg:px-0 lg:pb-0" aria-label="Dashboard">
              {DASHBOARD_PAGES.map((page) => {
                const Icon = page.icon

                return (
                  <Button
                    key={page.id}
                    type="button"
                    variant={activePage === page.id ? 'secondary' : 'ghost'}
                    className="shrink-0 justify-start lg:w-full"
                    onClick={() => setActivePage(page.id)}
                  >
                    <Icon data-icon="inline-start" />
                    {page.label}
                  </Button>
                )
              })}
            </nav>

            <Button variant="outline" size="sm" className="mt-auto hidden justify-start lg:flex" onClick={onLogout}>
              <LogOut data-icon="inline-start" />
              Cerrar sesión
            </Button>
          </aside>

          <section className="min-w-0 px-4 py-5 sm:px-6 lg:min-h-screen lg:px-7 lg:pb-10">
            <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{pageMeta.title}</h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {pageMeta.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => setActivePage('syncfy')}>
                  <Landmark data-icon="inline-start" />
                  Conectar cuenta
                </Button>
              </div>
            </header>

            <div className="flex min-w-0 flex-col gap-4">
              {activePage === 'inicio' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                    <Card className="min-w-0 rounded-lg py-5">
                      <CardContent className="min-w-0 px-5">
                        <p className="text-sm text-muted-foreground">Gastos</p>
                        <p className={METRIC_VALUE_CLASS}>
                          {formatCardCurrency(chatSummary.monthlySpending, chatCurrency)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatMonth(chatSummary.month)}</p>
                      </CardContent>
                    </Card>
                    <Card className="min-w-0 rounded-lg py-5">
                      <CardContent className="min-w-0 px-5">
                        <p className="text-sm text-muted-foreground">Ingresos</p>
                        <p className={METRIC_VALUE_CLASS}>
                          {formatCardCurrency(chatSummary.monthlyIncome, chatCurrency)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{dataModeLabel}</p>
                      </CardContent>
                    </Card>
                    <Card className="min-w-0 rounded-lg py-5">
                      <CardContent className="min-w-0 px-5">
                        <p className="text-sm text-muted-foreground">Balance</p>
                        <p
                          className={cn(
                            METRIC_VALUE_CLASS,
                            chatSummary.netBalance >= 0 ? 'text-[#00D4AA]' : 'text-rose-300'
                          )}
                        >
                          {formatCardCurrency(chatSummary.netBalance, chatCurrency)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Ingresos menos gastos</p>
                      </CardContent>
                    </Card>
                    <Card className="min-w-0 rounded-lg py-5">
                      <CardContent className="min-w-0 px-5">
                        <p className="text-sm text-muted-foreground">Mayor fuga</p>
                        <p className="mt-2 min-w-0 text-[1.35rem] font-semibold leading-tight [overflow-wrap:anywhere]">{chatSummary.topSpendingCategory}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCardCurrency(chatSummary.topSpendingCategoryAmount, chatCurrency)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-lg">
                    <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle>Vista dinámica</CardTitle>
                        <CardDescription>
                          Explora flujo, categorías y movimientos desde tus transacciones conectadas.
                        </CardDescription>
                      </div>
                      <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-secondary/30 p-1 sm:flex sm:w-auto sm:flex-wrap sm:bg-transparent sm:p-0 lg:justify-end">
                        {[
                          ['flujo', 'Flujo'],
                          ['categorias', 'Categorías'],
                          ['movimientos', 'Movimientos'],
                        ].map(([view, label]) => (
                          <Button
                            key={view}
                            type="button"
                            size="sm"
                            className="min-w-0 px-2 text-xs sm:text-sm"
                            variant={activeChartView === view ? 'secondary' : 'ghost'}
                            onClick={() => setActiveChartView(view as DashboardChartView)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {hasChartData ? (
                        activeChartView === 'flujo' ? (
                          <ChartContainer config={CASHFLOW_CHART_CONFIG} className="h-[260px] w-full aspect-auto">
                            <AreaChart data={cashflowChartData} margin={{ left: 6, right: 6, top: 10, bottom: 0 }}>
                              <defs>
                                <linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1">
                                  <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.28} />
                                  <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.02} />
                                </linearGradient>
                                <linearGradient id="spendingGradient" x1="0" x2="0" y1="0" y2="1">
                                  <stop offset="5%" stopColor="var(--color-spending)" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="var(--color-spending)" stopOpacity={0.03} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid vertical={false} />
                              <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} minTickGap={24} />
                              <YAxis hide domain={[0, 'dataMax']} />
                              <ChartTooltip
                                cursor={false}
                                content={(
                                  <ChartTooltipContent
                                    formatter={(value, name) => (
                                      <>
                                        <span className="text-muted-foreground">
                                          {name === 'income' ? 'Ingresos' : 'Gastos'}
                                        </span>
                                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                                          {formatCardCurrency(Number(value), chatCurrency)}
                                        </span>
                                      </>
                                    )}
                                  />
                                )}
                              />
                              <Area
                                dataKey="spending"
                                type="natural"
                                fill="url(#spendingGradient)"
                                stroke="var(--color-spending)"
                                strokeWidth={2}
                                stackId="flow"
                              />
                              <Area
                                dataKey="income"
                                type="natural"
                                fill="url(#incomeGradient)"
                                stroke="var(--color-income)"
                                strokeWidth={2}
                                stackId="flow"
                              />
                            </AreaChart>
                          </ChartContainer>
                        ) : activeChartView === 'categorias' ? (
                          <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.8fr)_1fr]">
                            <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="h-[260px] w-full aspect-auto">
                              <PieChart>
                                <ChartTooltip
                                  cursor={false}
                                  content={(
                                    <ChartTooltipContent
                                      hideLabel
                                      formatter={(value, name) => (
                                        <>
                                          <span className="text-muted-foreground">{String(name)}</span>
                                          <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                                            {formatCardCurrency(Number(value), chatCurrency)}
                                          </span>
                                        </>
                                      )}
                                    />
                                  )}
                                />
                                <Pie
                                  data={categoryChartData}
                                  dataKey="amount"
                                  nameKey="category"
                                  innerRadius={58}
                                  outerRadius={92}
                                  paddingAngle={3}
                                >
                                  {categoryChartData.map((item) => (
                                    <Cell key={item.category} fill={item.fill} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ChartContainer>
                            <div className="grid content-center gap-2">
                              {categoryChartData.map((item) => (
                                <div key={item.category} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/20 p-3">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                                    <span className="min-w-0 text-sm font-medium leading-tight [overflow-wrap:anywhere]">{item.category}</span>
                                  </div>
                                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                                    {item.share}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="h-[280px] w-full aspect-auto">
                            <BarChart data={topExpenseChartData} layout="vertical" margin={{ left: 8, right: 18, top: 6, bottom: 6 }}>
                              <CartesianGrid horizontal={false} />
                              <XAxis type="number" hide />
                              <YAxis
                                dataKey="label"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                tickMargin={10}
                                width={132}
                              />
                              <ChartTooltip
                                cursor={false}
                                content={(
                                  <ChartTooltipContent
                                    hideLabel
                                    formatter={(value, name, item) => (
                                      <>
                                        <span className="text-muted-foreground">
                                          {String(item?.payload?.description || name)}
                                        </span>
                                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                                          {formatCardCurrency(Number(value), chatCurrency)}
                                        </span>
                                      </>
                                    )}
                                  />
                                )}
                              />
                              <Bar dataKey="amount" radius={6}>
                                {topExpenseChartData.map((item) => (
                                  <Cell key={item.description} fill={item.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ChartContainer>
                        )
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                          Conecta una cuenta con Syncfy para activar gráficos con datos reales.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {showExampleAnalysis ? (
                    <Card className="rounded-lg border-[#2B7AE8]/20 bg-card/95">
                      <CardHeader>
                        <CardTitle>Empieza con Syncfy</CardTitle>
                        <CardDescription>
                          Conecta una cuenta para que FinovAI encuentre fugas, patrones y ahorro que puedas convertir en inversión.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 sm:flex-row">
                        <Button type="button" onClick={() => setActivePage('syncfy')}>
                          <Landmark data-icon="inline-start" />
                          Conectar cuenta
                        </Button>
                      </CardContent>
                    </Card>
                  ) : null}

                  {hasDraftRows ? (
                    <Card className="rounded-lg border-amber-500/20">
                      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <CardTitle>Movimientos en revisión</CardTitle>
                          <CardDescription>
                            El chat ya puede analizar las filas seleccionadas como preliminar.
                          </CardDescription>
                        </div>
                        <Badge variant="outline">{selectedRows.length}/{draftRows.length} seleccionadas</Badge>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 sm:flex-row">
                        <Button type="button" onClick={() => setActivePage('cartola')}>
                          <FileSearch data-icon="inline-start" />
                          Revisar movimientos
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleConfirmCartola}
                          disabled={isConfirming || selectedRows.length === 0}
                        >
                          {isConfirming ? <Loader2 className="size-4 animate-spin" /> : <Check data-icon="inline-start" />}
                          Confirmar seleccionadas
                        </Button>
                      </CardContent>
                    </Card>
                  ) : null}

                  {hasTransactions ? (
                    <Card className="rounded-lg">
                      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <CardTitle>Lectura rápida</CardTitle>
                          <CardDescription>
                            Lo principal de tus movimientos confirmados.
                          </CardDescription>
                        </div>
                        <Badge variant="secondary">{summary.transactionCount} movimientos</Badge>
                      </CardHeader>
                      <CardContent className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-lg bg-secondary/20 p-4">
                          <p className="text-sm font-medium">Dónde se fue más</p>
                          <p className="mt-2 text-lg font-semibold leading-tight [overflow-wrap:anywhere]">{summary.topSpendingCategory}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatCardCurrency(summary.topSpendingCategoryAmount, latestCurrency)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-secondary/20 p-4">
                          <p className="text-sm font-medium">Ahorro posible</p>
                          <p className={cn(PANEL_VALUE_CLASS, 'text-[#00D4AA]')}>
                            {formatCardCurrency(summary.estimatedSavingsOpportunity, latestCurrency)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">Estimado desde gastos flexibles.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </>
              ) : null}

              {activePage === 'syncfy' ? (
                <SyncfyConnect
                  email={activeEmail}
                  onStatus={setStatus}
                  onSynced={(response) => {
                    const nextData = response as DashboardResponse
                    if (Array.isArray(nextData.transactions)) {
                      setData(nextData)
                    }
                  }}
                />
              ) : null}

              {activePage === 'cartola' ? (
              <Card id="cartola-panel" className="rounded-lg border-[#2B7AE8]/20 bg-card/95">
                <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Importación de respaldo</CardTitle>
                    <CardDescription>
                      Revisa un archivo de movimientos antes de guardarlo como respaldo operativo.
                    </CardDescription>
                  </div>
                  <Badge variant={hasDraftRows || hasTransactions ? 'secondary' : 'outline'}>
                    {hasDraftRows ? `${draftRows.length} en revisión` : hasTransactions ? `${transactions.length} guardados` : 'Sin datos'}
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
                  <Label
                    htmlFor="cartola-upload"
                    className={cn(
                      'flex min-h-36 cursor-pointer flex-col justify-between rounded-lg bg-primary p-4 text-primary-foreground shadow-[0_18px_60px_rgba(0,212,170,0.16)] transition-transform active:scale-[0.96]',
                      isUploading && 'pointer-events-none opacity-70'
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {isUploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                      {isUploading ? 'Leyendo archivo' : 'Cargar archivo'}
                    </span>
                    <span className="text-sm leading-relaxed text-primary-foreground/75">
                      PDF o CSV. La revisas antes de guardar.
                    </span>
                    <span className="text-sm font-semibold">Elegir archivo</span>
                  </Label>

                  <div className="rounded-lg bg-secondary/20 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                    <p className="text-sm font-medium">Flujo de revisión</p>
                    <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                      <div className="flex items-start gap-3">
                        <Badge variant="secondary">1</Badge>
                        <span>Cargas PDF o CSV.</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="secondary">2</Badge>
                        <span>Revisas fechas, montos y categorías.</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge variant="secondary">3</Badge>
                        <span>Confirmas solo las filas que quieres guardar.</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              ) : null}

              {activePage === 'cartola' && hasDraftRows ? (
                <Card id="review-panel" className="rounded-lg">
                  <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                        <FileSearch className="size-4" />
                      </div>
                      <div>
                        <CardTitle>Revisar transacciones</CardTitle>
                        <CardDescription>
                          Estas filas alimentan el chat como análisis preliminar.
                          {lowConfidenceRows > 0 ? ` ${lowConfidenceRows} requieren más revisión.` : ''}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary">{selectedRows.length}/{draftRows.length} seleccionadas</Badge>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="max-h-[560px] overflow-auto rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">OK</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Detalle</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Conf.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {draftRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>
                                <Checkbox
                                  aria-label={`Seleccionar ${row.description}`}
                                  checked={selectedDraftIds.has(row.id)}
                                  onCheckedChange={() => toggleDraftRow(row.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="w-36"
                                  inputMode="numeric"
                                  placeholder="YYYY-MM-DD"
                                  value={row.date}
                                  onChange={(event) => updateDraftRow(row.id, 'date', event.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={row.type}
                                  onValueChange={(value) => updateDraftRow(row.id, 'type', value as TransactionType)}
                                >
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectItem value="expense">Gasto</SelectItem>
                                      <SelectItem value="income">Ingreso</SelectItem>
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="w-[30rem]"
                                  value={row.description}
                                  onChange={(event) => updateDraftRow(row.id, 'description', event.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="w-40"
                                  value={row.category}
                                  onChange={(event) => updateDraftRow(row.id, 'category', event.target.value)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  className="ml-auto w-32 text-right tabular-nums"
                                  inputMode="decimal"
                                  value={String(row.amount)}
                                  onChange={(event) => updateDraftRow(row.id, 'amount', Number(event.target.value) || 0)}
                                />
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={cn(row.confidence < 0.75 && 'border-amber-500/30 text-amber-300')}
                                  variant={row.confidence < 0.75 ? 'outline' : 'secondary'}
                                >
                                  {Math.round(row.confidence * 100)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Nada se guarda como movimiento hasta que confirmes.
                      </p>
                      <Button onClick={handleConfirmCartola} disabled={isConfirming || selectedRows.length === 0}>
                        {isConfirming ? <Loader2 className="size-4 animate-spin" /> : <Check data-icon="inline-start" />}
                        Confirmar seleccionadas
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activePage === 'movimientos' && manualDrafts.length > 0 ? (
                <Card id="manual-entry" className="rounded-lg">
                  <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Ajuste de respaldo</CardTitle>
                      <CardDescription>
                        Carga varios gastos o ingresos y guárdalos juntos.
                      </CardDescription>
                    </div>
                    <Badge variant={manualDrafts.length > 0 ? 'secondary' : 'outline'}>
                      {manualDrafts.length > 0 ? `${manualDrafts.length} en lista` : 'Respaldo'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                    <form className="flex flex-col gap-3" onSubmit={handleManualSubmit}>
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary/20 p-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={manualForm.type === 'income' ? 'default' : 'ghost'}
                          onClick={() => updateManualForm('type', 'income')}
                        >
                          <TrendingUp data-icon="inline-start" />
                          Ingreso
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={manualForm.type === 'expense' ? 'default' : 'ghost'}
                          onClick={() => updateManualForm('type', 'expense')}
                        >
                          <TrendingDown data-icon="inline-start" />
                          Gasto
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="manual-amount-split">Monto</Label>
                          <Input
                            id="manual-amount-split"
                            inputMode="decimal"
                            value={manualForm.amount}
                            onChange={(event) => updateManualForm('amount', event.target.value)}
                            placeholder="12.500"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="manual-date-split">Fecha</Label>
                          <Input
                            id="manual-date-split"
                            inputMode="numeric"
                            placeholder="YYYY-MM-DD"
                            value={manualForm.date}
                            onChange={(event) => updateManualForm('date', event.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="manual-category-split">Categoría</Label>
                          <Select
                            value={manualForm.category}
                            onValueChange={(value) => updateManualForm('category', value)}
                          >
                            <SelectTrigger id="manual-category-split" className="w-full">
                              <SelectValue placeholder="Categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {categories.map((category) => (
                                  <SelectItem key={category} value={category}>{category}</SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="manual-description-split">Descripción</Label>
                          <Input
                            id="manual-description-split"
                            value={manualForm.description}
                            onChange={(event) => updateManualForm('description', event.target.value)}
                            placeholder="Restaurante, sueldo, supermercado..."
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="manual-merchant-split">Comercio</Label>
                          <Input
                            id="manual-merchant-split"
                            value={manualForm.merchant}
                            onChange={(event) => updateManualForm('merchant', event.target.value)}
                            placeholder="Opcional"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label htmlFor="manual-notes-split">Notas</Label>
                        <Input
                          id="manual-notes-split"
                          value={manualForm.notes}
                          onChange={(event) => updateManualForm('notes', event.target.value)}
                          placeholder="Opcional"
                        />
                      </div>

                      <Button type="submit" variant="secondary" className="sm:w-fit">
                        <Plus data-icon="inline-start" />
                        Agregar a lista
                      </Button>
                    </form>

                    <div className="rounded-lg bg-secondary/20 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">Lista por guardar</p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveManualDrafts}
                          disabled={isSaving || manualDrafts.length === 0}
                        >
                          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check data-icon="inline-start" />}
                          Guardar todo
                        </Button>
                      </div>

                      {manualDrafts.length > 0 ? (
                        <div className="mt-3 max-h-80 space-y-2 overflow-auto">
                          {manualDrafts.map((draft, index) => (
                            <div key={draft.id} className="flex flex-col gap-2 rounded-md bg-card/80 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium leading-tight [overflow-wrap:anywhere]">{draft.description || draft.category}</p>
                                <p className="text-xs text-muted-foreground">{draft.date} · {draft.category}</p>
                              </div>
                              <div className="flex items-center gap-2 sm:justify-end">
                                <span className={cn('text-sm font-semibold tabular-nums [overflow-wrap:anywhere]', draft.type === 'income' ? 'text-[#00D4AA]' : 'text-foreground')}>
                                  {draft.type === 'income' ? '+' : '-'}{draft.amount}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Quitar movimiento ${index + 1}`}
                                  onClick={() => removeManualDraft(draft.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Agrega uno o más movimientos. Luego guárdalos todos.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activePage === 'movimientos' && hasTransactions ? (
                <Card id="transactions-panel" className="rounded-lg">
                  <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Movimientos guardados</CardTitle>
                      <CardDescription>
                        Datos confirmados que FinovAI usa como fuente final.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{summary.transactionCount} movimientos</Badge>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <p className="text-sm text-muted-foreground">Gastos</p>
                        <p className={PANEL_VALUE_CLASS}>
                          {formatCardCurrency(summary.monthlySpending, latestCurrency)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <p className="text-sm text-muted-foreground">Balance</p>
                        <p
                          className={cn(
                            PANEL_VALUE_CLASS,
                            summary.netBalance >= 0 ? 'text-[#00D4AA]' : 'text-rose-300'
                          )}
                        >
                          {formatCardCurrency(summary.netBalance, latestCurrency)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <p className="text-sm text-muted-foreground">Mayor categoría</p>
                        <p className="mt-1 text-lg font-semibold leading-tight [overflow-wrap:anywhere]">{summary.topSpendingCategory}</p>
                      </div>
                    </div>

                    {insights.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {insights.map((insight) => (
                          <div
                            key={insight.id}
                            className={cn('rounded-lg p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]', getInsightToneClasses(insight.tone))}
                          >
                            <p className="text-sm font-medium text-current/80">{insight.title}</p>
                            <p className="mt-2 text-lg font-semibold text-foreground">{insight.value}</p>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{insight.body}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2">
                      <ReceiptText className="size-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Todas las transacciones</p>
                    </div>

                    <div className="max-h-[560px] overflow-auto rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Detalle</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell className="text-muted-foreground">{formatDate(transaction.date)}</TableCell>
                              <TableCell>
                                <p className="max-w-72 whitespace-normal text-sm font-medium leading-tight [overflow-wrap:anywhere]">{transaction.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatTransactionSource(transaction.source)}
                                </p>
                              </TableCell>
                              <TableCell>{transaction.category}</TableCell>
                              <TableCell
                                className={cn(
                                  'text-right font-medium tabular-nums',
                                  transaction.type === 'income' ? 'text-[#00D4AA]' : 'text-foreground'
                                )}
                              >
                                {transaction.type === 'income' ? '+' : '-'}
                                {formatCurrency(transaction.amount, transaction.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activePage === 'movimientos' && !hasTransactions ? (
                <Card className="rounded-lg border-dashed">
                  <CardHeader>
                    <CardTitle>Sin transacciones conectadas</CardTitle>
                    <CardDescription>
                      Conecta una cuenta con Syncfy para llenar este historial con movimientos reales.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button type="button" onClick={() => setActivePage('syncfy')}>
                      <Landmark data-icon="inline-start" />
                      Conectar cuenta
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {activePage === 'categorias' ? (
                <Card className="rounded-lg">
                  <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Gasto por categoría</CardTitle>
                      <CardDescription>
                        {hasDraftRows ? 'Vista preliminar de movimientos seleccionados.' : 'Vista desde movimientos confirmados.'}
                      </CardDescription>
                    </div>
                    <Badge variant={categoryBreakdown.length > 0 ? 'secondary' : 'outline'}>{dataModeLabel}</Badge>
                  </CardHeader>
                  <CardContent>
                    {categoryBreakdown.length > 0 ? (
                      <div className="grid gap-4">
                        <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.75fr)_1fr]">
                          <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="h-[280px] w-full aspect-auto">
                            <PieChart>
                              <ChartTooltip
                                cursor={false}
                                content={(
                                  <ChartTooltipContent
                                    hideLabel
                                    formatter={(value, name) => (
                                      <>
                                        <span className="text-muted-foreground">{String(name)}</span>
                                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                                          {formatCardCurrency(Number(value), chatCurrency)}
                                        </span>
                                      </>
                                    )}
                                  />
                                )}
                              />
                              <Pie
                                data={categoryChartData}
                                dataKey="amount"
                                nameKey="category"
                                innerRadius={64}
                                outerRadius={104}
                                paddingAngle={3}
                              >
                                {categoryChartData.map((item) => (
                                  <Cell key={item.category} fill={item.fill} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ChartContainer>
                          <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="h-[280px] w-full aspect-auto">
                            <BarChart data={categoryChartData} layout="vertical" margin={{ left: 8, right: 18, top: 8, bottom: 8 }}>
                              <CartesianGrid horizontal={false} />
                              <XAxis type="number" hide />
                              <YAxis
                                dataKey="label"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                tickMargin={10}
                                width={118}
                              />
                              <ChartTooltip
                                cursor={false}
                                content={(
                                  <ChartTooltipContent
                                    hideLabel
                                    formatter={(value, name, item) => (
                                      <>
                                        <span className="text-muted-foreground">
                                          {String(item?.payload?.category || name)}
                                        </span>
                                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                                          {formatCardCurrency(Number(value), chatCurrency)}
                                        </span>
                                      </>
                                    )}
                                  />
                                )}
                              />
                              <Bar dataKey="amount" radius={6}>
                                {categoryChartData.map((item) => (
                                  <Cell key={item.category} fill={item.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ChartContainer>
                        </div>

                        <div className="grid gap-3">
                          {categoryChartData.map((item) => (
                            <div key={item.category} className="rounded-lg bg-secondary/20 p-4">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                                  <p className="min-w-0 text-sm font-medium leading-tight [overflow-wrap:anywhere]">{item.category}</p>
                                </div>
                                <p className="text-sm font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-right">
                                  {formatCardCurrency(item.amount, chatCurrency)}
                                </p>
                              </div>
                              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/60">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${Math.max(6, item.share)}%` }}
                                />
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">{item.share}% del gasto del mes</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                        Aún no hay gastos para agrupar. Conecta una cuenta para traer transacciones.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {activePage === 'analisis' ? (
                <div className="grid gap-4">
                  <Card className="rounded-lg">
                    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle>Resumen del mes</CardTitle>
                        <CardDescription>
                          {formatMonth(chatSummary.month)} · {dataModeLabel}
                        </CardDescription>
                      </div>
                      <Badge variant={chatTransactions.length > 0 ? 'secondary' : 'outline'}>
                        {chatTransactions.length} movimientos
                      </Badge>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      <div className="rounded-lg bg-secondary/20 p-4">
                        <p className="text-sm text-muted-foreground">Gasto total</p>
                        <p className={PANEL_VALUE_CLASS}>
                          {formatCardCurrency(chatSummary.monthlySpending, chatCurrency)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-4">
                        <p className="text-sm text-muted-foreground">Mayor categoría</p>
                        <p className="mt-2 text-lg font-semibold leading-tight [overflow-wrap:anywhere]">{chatSummary.topSpendingCategory}</p>
                      </div>
                      <div className="rounded-lg bg-[#00D4AA]/10 p-4 text-[#9ff3e5]">
                        <p className="text-sm text-[#00D4AA]">Ahorro posible</p>
                        <p className={PANEL_VALUE_CLASS}>
                          {formatCardCurrency(chatSummary.estimatedSavingsOpportunity, chatCurrency)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {hasChartData ? (
                    <Card className="rounded-lg">
                      <CardHeader>
                        <CardTitle>Flujo del mes</CardTitle>
                        <CardDescription>Ingresos y gastos por día.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={CASHFLOW_CHART_CONFIG} className="h-[260px] w-full aspect-auto">
                          <AreaChart data={cashflowChartData} margin={{ left: 6, right: 6, top: 10, bottom: 0 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} minTickGap={24} />
                            <YAxis hide domain={[0, 'dataMax']} />
                            <ChartTooltip
                              cursor={false}
                              content={(
                                <ChartTooltipContent
                                  formatter={(value, name) => (
                                    <>
                                      <span className="text-muted-foreground">
                                        {name === 'income' ? 'Ingresos' : 'Gastos'}
                                      </span>
                                      <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                                        {formatCardCurrency(Number(value), chatCurrency)}
                                      </span>
                                    </>
                                  )}
                                />
                              )}
                            />
                            <Area
                              dataKey="spending"
                              type="natural"
                              fill="var(--color-spending)"
                              fillOpacity={0.14}
                              stroke="var(--color-spending)"
                              strokeWidth={2}
                            />
                            <Area
                              dataKey="income"
                              type="natural"
                              fill="var(--color-income)"
                              fillOpacity={0.12}
                              stroke="var(--color-income)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card className="rounded-lg">
                      <CardHeader>
                        <CardTitle>Día raro</CardTitle>
                        <CardDescription>El día con mayor salida detectada.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {chatSummary.unusualHighSpendDay ? (
                          <div className="rounded-lg bg-secondary/20 p-4">
                            <p className="text-lg font-semibold">{formatDate(chatSummary.unusualHighSpendDay.date)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {formatCardCurrency(chatSummary.unusualHighSpendDay.amount, chatCurrency)} en gastos.
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sin suficiente señal todavía.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-lg">
                      <CardHeader>
                        <CardTitle>Recurrentes</CardTitle>
                        <CardDescription>Cargos parecidos que se repiten.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-2">
                        {chatSummary.recurringExpenses.length > 0 ? (
                          chatSummary.recurringExpenses.slice(0, 3).map((expense) => (
                            <div key={expense.key} className="flex flex-col gap-1 rounded-lg bg-secondary/20 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                              <p className="min-w-0 text-sm font-medium leading-tight [overflow-wrap:anywhere]">{expense.description}</p>
                              <p className="text-sm tabular-nums text-muted-foreground [overflow-wrap:anywhere] sm:text-right">
                                {expense.count}x · {formatCardCurrency(expense.amount, chatCurrency)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No hay recurrentes confiables aún.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-lg">
                    <CardHeader>
                      <CardTitle>Movimientos grandes</CardTitle>
                      <CardDescription>Los mayores gastos del mes.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      {topAnalysisTransactions.length > 0 ? (
                        topAnalysisTransactions.map((transaction) => (
                          <div key={`${transaction.date}-${transaction.description}-${transaction.amount}`} className="flex flex-col gap-2 rounded-lg bg-secondary/20 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight [overflow-wrap:anywhere]">{transaction.description}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(transaction.date)} · {transaction.category}</p>
                            </div>
                            <p className="text-sm font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-right">
                              {formatCardCurrency(transaction.amount, transaction.currency)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Conecta una cuenta para generar análisis.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {activePage === 'ajustes' ? (
                <Card className="rounded-lg">
                  <CardHeader>
                    <CardTitle>Perfil financiero</CardTitle>
                    <CardDescription>
                      Preferencias de cuenta, acceso compartido y controles de datos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-secondary/20 p-4">
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="mt-1 break-all text-sm font-medium">{activeEmail}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-4">
                        <p className="text-sm text-muted-foreground">Moneda</p>
                        <p className="mt-1 text-sm font-medium">{chatCurrency}</p>
                      </div>
                    </div>
                    <form className="rounded-lg bg-secondary/20 p-4" onSubmit={handleInviteSpouse}>
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <UserPlus className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Invitar pareja</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Vincula a tu pareja por email para preparar el acceso compartido.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="flex min-w-0 flex-col gap-2">
                          <Label htmlFor="spouse-email">Email de tu pareja</Label>
                          <Input
                            id="spouse-email"
                            type="email"
                            value={spouseEmail}
                            onChange={(event) => setSpouseEmail(event.target.value)}
                            placeholder="pareja@email.com"
                            autoComplete="email"
                          />
                        </div>
                        <Button type="submit" className="self-end" disabled={isInvitingSpouse || !spouseEmail.trim()}>
                          {isInvitingSpouse ? <Loader2 className="size-4 animate-spin" /> : <Mail data-icon="inline-start" />}
                          Invitar
                        </Button>
                      </div>

                      {householdInvites.length > 0 ? (
                        <div className="mt-4 grid gap-2">
                          {householdInvites.map((invite) => (
                            <div key={invite.id} className="flex flex-col gap-2 rounded-lg bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                              <p className="min-w-0 break-all text-sm font-medium">{invite.inviteeEmail}</p>
                              <Badge variant="outline">
                                {invite.status === 'pending' ? 'Pendiente' : invite.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </form>
                    <div className="rounded-lg bg-secondary/20 p-4">
                      <p className="text-sm font-medium">Fuente de datos</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Syncfy es la fuente principal para leer transacciones de bancos, SAT, Bitso, American Express y fuentes compatibles.
                      </p>
                    </div>
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Exportar datos y borrar cuenta quedan como próximos controles de privacidad.
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </section>

          <aside className="hidden min-w-0 border-l border-border/70 bg-background/80 p-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:self-start">
            {renderDashboardChat()}
          </aside>
        </div>

        <Button
          type="button"
          size="icon"
          className="fixed bottom-5 right-5 z-40 size-14 rounded-full bg-primary text-primary-foreground shadow-[0_18px_50px_rgba(0,212,170,0.28)] lg:hidden"
          onClick={() => setIsMobileChatOpen(true)}
          aria-label="Abrir chat FinovAI"
        >
          <Bot className="size-5" />
        </Button>

        <Dialog open={isMobileChatOpen} onOpenChange={setIsMobileChatOpen}>
          <DialogContent
            className="finovai-dashboard dark bottom-0 left-0 right-0 top-auto flex h-[min(76dvh,640px)] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-b-none rounded-t-2xl border-x-0 border-b-0 border-[#2B7AE8]/20 bg-background p-0 text-foreground shadow-2xl sm:bottom-4 sm:left-1/2 sm:right-auto sm:h-[min(78dvh,680px)] sm:w-[min(620px,calc(100vw-3rem))] sm:max-w-[min(620px,calc(100vw-3rem))] sm:translate-x-[-50%] sm:rounded-xl sm:border"
            showCloseButton
          >
            <DialogTitle className="sr-only">Chat FinovAI</DialogTitle>
            <DialogDescription className="sr-only">
              Chat para analizar transacciones, patrones de gasto y oportunidades de ahorro.
            </DialogDescription>
            {renderDashboardChat(true)}
          </DialogContent>
        </Dialog>
      </main>
    )
  }

  return (
    <main className="finovai-dashboard dark min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-4">
        <header className="flex items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">FinovAI</p>
              <p className="text-xs leading-snug text-muted-foreground">Copiloto financiero</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={onBackHome}>
            <ArrowLeft data-icon="inline-start" />
            Volver
          </Button>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <Card className="w-full rounded-lg border-[#2B7AE8]/20 bg-card/95">
            <CardHeader>
              <CardTitle>Entrar a FinovAI</CardTitle>
              <CardDescription>
                Usa tu email para conectar una cuenta con Syncfy y activar el análisis de fugas, patrones y ahorro invertible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleIdentify}>
                <Input
                  type="email"
                  value={emailInput}
                  onChange={(event) => setEmailInput(event.target.value)}
                  placeholder="tu@email.com"
                />
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                  Continuar
                </Button>
              </form>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground" role="status">
                {status}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
