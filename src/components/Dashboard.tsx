import { type CSSProperties, type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ArrowLeft,
  ArrowRightLeft,
  Banknote,
  Bot,
  Car,
  ChartPie,
  Check,
  CircleDollarSign,
  FileSearch,
  FileUp,
  Film,
  HeartPulse,
  Home,
  Landmark,
  Loader2,
  LogOut,
  Mail,
  Moon,
  PiggyBank,
  Plus,
  ReceiptText,
  Repeat2,
  SendHorizontal,
  Settings,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  Utensils,
  UserPlus,
  WalletCards,
  type LucideIcon,
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
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
  MessageAvatar,
  MessageContent,
} from '@/components/ui/message'
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input'
import { PromptSuggestion } from '@/components/ui/prompt-suggestion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ThinkingBar } from '@/components/ui/thinking-bar'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { MessageResponse } from '@/components/ai-elements/message-response'
import { Shimmer } from '@/components/ai-elements/shimmer'
import { FinovaiLogo } from './LandingPage'
import { SyncfyConnect } from '@/components/SyncfyConnect'
import { cn } from '@/lib/utils'
import {
  getDashboardAuthHeaders,
  getStoredDashboardEmail,
  setDashboardSession,
} from '@/lib/dashboard-session'

interface DashboardProps {
  email: string | null
  initialNotice?: string | null
  initialPath?: string
  onBackHome: () => void
  onLogout: () => void
}

type TransactionType = 'income' | 'expense'
type TransactionSource = 'manual' | 'cartola' | 'syncfy'
type DashboardPage = 'inicio' | 'syncfy' | 'cartola' | 'movimientos' | 'categorias' | 'analisis' | 'ajustes'
type DashboardTheme = 'light' | 'dark'
type CategoryPeriodFilter = 'current' | 'previous' | 'all'

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
  dataCoverage: {
    firstDate: string | null
    lastDate: string | null
    firstMonth: string | null
    lastMonth: string | null
    monthCount: number
    transactionCount: number
    preliminary: boolean
  }
  topSpendingCategory: string
  topSpendingCategoryAmount: number
  unusualHighSpendDay: { date: string; amount: number } | null
  recurringExpenses: Array<{ key: string; description: string; amount: number; count: number }>
  estimatedSavingsOpportunity: number
}

interface FinancialProfile {
  email: string
  currency: string
  monthlyIncome: number | null
  monthlyBudget: number | null
  categoryBudgets: Record<string, number>
}

type BudgetStatus = 'under' | 'near' | 'over' | 'unset'

interface CategoryBudgetComparison {
  category: string
  amount: number
  share: number
  previousAmount: number
  deltaFromPrevious: number
  budget: number | null
  budgetUsage: number | null
  budgetStatus: BudgetStatus
  advice: string
}

interface CategoryMonthRow {
  month: string
  spendingTotal: number
  incomeTotal: number
  topCategory: string
  deltaFromPrevious: number | null
  budgetTotal: number | null
  status: BudgetStatus
}

interface CategoryAnalysis {
  period: string
  periodLabel: string
  previousPeriod: string | null
  spendingTotal: number
  incomeTotal: number
  budgetTotal: number | null
  budgetSource: 'user' | 'income_rule' | 'missing'
  fixedExpenseShare: number | null
  fixedExpenseLimit: number | null
  summaryAdvice: string
  categories: CategoryBudgetComparison[]
  monthRows: CategoryMonthRow[]
}

interface FinanceInsight {
  id: string
  title: string
  value: string
  body: string
  tone: 'good' | 'watch' | 'urgent'
}

interface FinanceOpportunity {
  id: string
  kind: 'recurring' | 'merchant_leak' | 'category_leak' | 'unusual_day'
  title: string
  body: string
  sourceLabel: string
  estimatedMonthlySavings: number
}

interface FinanceActionPlan {
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

interface DashboardResponse {
  success: boolean
  email: string
  transactions: FinanceTransaction[]
  profile?: FinancialProfile
  summary: FinanceSummary
  categoryAnalysis?: CategoryAnalysis
  insights: FinanceInsight[]
  actionPlan?: FinanceActionPlan
  message?: string
}

interface SyncfyCredential {
  id: string
  syncfyCredentialId: string
  siteName: string | null
  status: string | null
  lastSuccessfulSyncAt: string | null
  lastPullAt: string | null
  cooldownSeconds: number
  ready: boolean
  needsReconnect?: boolean
}

interface SyncfyCredentialsResponse {
  success: boolean
  email: string
  credentials: SyncfyCredential[]
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

interface ProfileForm {
  monthlyIncome: string
  monthlyBudget: string
}

interface DashboardChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  chart?: DashboardChatChartType
  chartCategory?: string
  reasoning?: string
  reasoningDuration?: number
}

interface DashboardChatResponse {
  success: boolean
  answer: string
  model: string
  source: 'anthropic'
}

interface TransactionCategoryResponse extends DashboardResponse {
  transaction: FinanceTransaction
}

type DashboardChatChartType = 'categories' | 'daily-spend' | 'savings' | 'recurring' | 'category-trend'

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
  emailSent?: boolean
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
  'Inversión',
  'Impuestos',
  'Otro',
]

const INCOME_CATEGORIES = ['Sueldo', 'Freelance', 'Inversión', 'Reembolso', 'Venta', 'Otro ingreso']
const DISCRETIONARY_CATEGORIES = new Set(['Comida fuera', 'Suscripciones', 'Ocio', 'Transporte'])
const DASHBOARD_CHAT_SUGGESTIONS = [
  '¿Dónde está mi fuga principal?',
  '¿Qué puedo ahorrar esta semana?',
  '¿Qué patrón se repite?',
]
const DASHBOARD_THEME_STORAGE_KEY = 'finovai-dashboard-theme'
const DASHBOARD_PAGES: Array<{ id: DashboardPage; label: string; icon: LucideIcon }> = [
  { id: 'inicio', label: 'Chat', icon: Bot },
  { id: 'syncfy', label: 'Conectar cuenta', icon: Landmark },
  { id: 'movimientos', label: 'Movimientos', icon: ReceiptText },
  { id: 'categorias', label: 'Categorías', icon: ChartPie },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
]
const DASHBOARD_PAGE_PATHS: Record<DashboardPage, string> = {
  inicio: '/dashboard',
  syncfy: '/connect',
  movimientos: '/movements',
  categorias: '/categories',
  cartola: '/import',
  analisis: '/analysis',
  ajustes: '/settings',
}

function DashboardBrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2.5 font-['Inter_Tight',sans-serif] text-[17px] font-extrabold leading-none tracking-[-0.02em] text-foreground",
        className
      )}
      aria-hidden="true"
    >
      <span className="flex w-10 shrink-0 items-center [&_svg]:h-auto [&_svg]:w-10">
        <FinovaiLogo />
      </span>
      <span className="hidden truncate md:inline">
        finov<span className="text-[#2B7AE8]">ai</span>
      </span>
    </span>
  )
}

const LEGACY_DASHBOARD_PAGE_PATHS: Partial<Record<string, DashboardPage>> = {
  '/dashboard/connect': 'syncfy',
  '/dashboard/movements': 'movimientos',
  '/dashboard/movement': 'movimientos',
  '/dashboard/categories': 'categorias',
  '/dashboard/category': 'categorias',
  '/dashboard/import': 'cartola',
  '/dashboard/analysis': 'analisis',
  '/dashboard/settings': 'ajustes',
  '/movement': 'movimientos',
  '/category': 'categorias',
}
const PAGE_META: Record<DashboardPage, { title: string; description: string }> = {
  inicio: {
    title: 'Chat financiero',
    description: 'Pregunta sobre tus movimientos, fugas, patrones y ahorro posible.',
  },
  syncfy: {
    title: 'Conectar cuenta',
    description: 'Vincula bancos, SAT, Bitso, American Express y fuentes compatibles.',
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
const PANEL_VALUE_CLASS = 'mt-2 min-w-0 text-lg font-semibold leading-tight tracking-normal tabular-nums [overflow-wrap:anywhere]'
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)',
]
const FINANCE_APP_SHELL_CLASS = 'mx-auto grid h-[calc(100vh-1.5rem)] w-full max-w-[1760px] overflow-hidden rounded-[1.85rem] border border-border/70 bg-background shadow-[0_30px_90px_rgba(34,73,58,0.14)] sm:h-[calc(100vh-2.5rem)] md:grid-cols-[236px_minmax(0,1fr)] lg:h-[calc(100vh-3.5rem)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.38)]'
const FINANCE_ARTIFACT_CARD_CLASS = 'min-w-0 rounded-[1.45rem] border-border/70 bg-card py-5 shadow-[0_16px_45px_rgba(20,33,27,0.06)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.26)]'
const FINANCE_ARTIFACT_INSET_CLASS = 'rounded-2xl bg-secondary/45 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]'
const FINANCE_ARTIFACT_TILE_CLASS = 'rounded-2xl bg-secondary/45 p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]'
const FINANCE_SCROLLBAR_CLASS = 'finovai-scrollbar [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/40'
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
  dataCoverage: {
    firstDate: null,
    lastDate: null,
    firstMonth: null,
    lastMonth: null,
    monthCount: 0,
    transactionCount: 0,
    preliminary: true,
  },
  topSpendingCategory: 'Sin datos',
  topSpendingCategoryAmount: 0,
  unusualHighSpendDay: null,
  recurringExpenses: [],
  estimatedSavingsOpportunity: 0,
}

const EMPTY_TRANSACTIONS: FinanceTransaction[] = []
const EMPTY_INSIGHTS: FinanceInsight[] = []
const EMPTY_PROFILE: FinancialProfile = {
  email: '',
  currency: 'MXN',
  monthlyIncome: null,
  monthlyBudget: null,
  categoryBudgets: {},
}
const EMPTY_CATEGORY_ANALYSIS: CategoryAnalysis = {
  period: EMPTY_SUMMARY.month,
  periodLabel: formatMonth(EMPTY_SUMMARY.month),
  previousPeriod: null,
  spendingTotal: 0,
  incomeTotal: 0,
  budgetTotal: null,
  budgetSource: 'missing',
  fixedExpenseShare: null,
  fixedExpenseLimit: null,
  summaryAdvice: 'Falta tu ingreso y presupuesto mensual. Agrega esos datos para comparar el gasto contra una meta real.',
  categories: [],
  monthRows: [],
}
const EMPTY_ACTION_PLAN: FinanceActionPlan = {
  monthlySavingsTarget: 0,
  topOpportunities: [],
  investmentProjection: {
    monthlyContribution: 0,
    years: DEFAULT_INVESTMENT_ASSUMPTION.years,
    annualReturn: DEFAULT_INVESTMENT_ASSUMPTION.annualReturn,
    totalContributed: 0,
    tenYearValue: 0,
    potentialGrowth: 0,
  },
  nextActions: [],
}

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
  if (source === 'syncfy') return 'Conexión bancaria'
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

function formatShortMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-CL', {
    month: 'short',
  }).format(date).replace('.', '')
}

function getMonthRange(firstMonth: string | null, lastMonth: string | null) {
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

function buildDataCoverage(transactions: Array<Pick<AnalysisTransaction, 'date'>>): FinanceSummary['dataCoverage'] {
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

function formatDataCoverage(coverage: FinanceSummary['dataCoverage']) {
  if (!coverage.transactionCount || !coverage.firstMonth || !coverage.lastMonth) return 'Sin historial analizado'
  const monthRange = coverage.firstMonth === coverage.lastMonth
    ? formatMonth(coverage.lastMonth)
    : `${formatMonth(coverage.firstMonth)} - ${formatMonth(coverage.lastMonth)}`
  const monthLabel = coverage.monthCount === 1 ? '1 mes' : `${coverage.monthCount} meses`
  const transactionLabel = coverage.transactionCount === 1 ? '1 movimiento' : `${coverage.transactionCount} movimientos`

  return `${monthLabel} analizados · ${transactionLabel} · ${monthRange}`
}

function getCategoryTrendChartData(
  transactions: AnalysisTransaction[],
  category: string,
  coverage: FinanceSummary['dataCoverage']
) {
  const totals = new Map<string, number>()
  const months = getMonthRange(coverage.firstMonth, coverage.lastMonth).slice(-7)

  for (const month of months) {
    totals.set(month, 0)
  }

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    if (transaction.category !== category) continue

    const month = transaction.date.slice(0, 7)
    if (!totals.has(month)) continue

    totals.set(month, (totals.get(month) || 0) + transaction.amount)
  }

  return months.map((month) => {
    const amount = Math.round((totals.get(month) || 0) * 100) / 100

    return {
      month,
      label: formatShortMonth(month),
      amount,
    }
  })
}

function syncfyCredentialNeedsReconnect(credential: SyncfyCredential) {
  return credential.needsReconnect === true || credential.status === 'needs_reconnect'
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

function getStoredDashboardTheme(): DashboardTheme {
  if (typeof window === 'undefined') return 'light'
  const storedTheme = window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY)
  return storedTheme === 'dark' ? 'dark' : 'light'
}

function getDashboardPreviewEnabled() {
  if (typeof window === 'undefined') return false
  if (!import.meta.env.DEV) return false
  return new URLSearchParams(window.location.search).get('preview') === 'dashboard'
}

function normalizeDashboardPath(path: string | null | undefined): string {
  const normalizedPath = (path || '/dashboard').replace(/\/+$/, '') || '/dashboard'
  return normalizedPath
}

function getDashboardPageFromPath(path: string | null | undefined): DashboardPage {
  const normalizedPath = normalizeDashboardPath(path)
  const match = (Object.entries(DASHBOARD_PAGE_PATHS) as Array<[DashboardPage, string]>)
    .find(([, pagePath]) => pagePath === normalizedPath)

  return match?.[0] || LEGACY_DASHBOARD_PAGE_PATHS[normalizedPath] || 'inicio'
}

function shouldCanonicalizeDashboardPath(path: string | null | undefined): boolean {
  return Boolean(LEGACY_DASHBOARD_PAGE_PATHS[normalizeDashboardPath(path)])
}

function getInsightToneClasses(tone: FinanceInsight['tone']) {
  if (tone === 'good') return 'border-primary/25 bg-primary/10 text-primary'
  if (tone === 'urgent') return 'border-rose-500/20 bg-rose-500/8 text-rose-700 dark:text-rose-300'
  return 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300'
}

function normalizeQuestion(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const EXPLICIT_CHART_PATTERN = /(grafica|grafico|chart|linea|evolucion|tendencia|historico|serie)/
const CATEGORY_QUERY_ALIASES: Array<{ category: string; pattern: RegExp }> = [
  { category: 'Comida fuera', pattern: /(comida fuera|restaur|restor|restaurant|uber eats|rappi|didi food|cafeter|cafe|bar|taquer|don asado|fisher|orale|milan)/ },
  { category: 'Supermercado', pattern: /(supermercado|super|despensa|walmart|soriana|chedraui|costco|sams|heb|mercado)/ },
  { category: 'Transporte', pattern: /(transporte|uber|didi|taxi|metro|gasolina|combustible|estacionamiento)/ },
  { category: 'Suscripciones', pattern: /(suscrip|netflix|spotify|amazon prime|apple|google|membresia)/ },
  { category: 'Ocio', pattern: /(ocio|cine|cinemex|cinepolis|entretenimiento|dulceria)/ },
  { category: 'Deuda', pattern: /(deuda|interes|comision|disposicion|credito|tarjeta)/ },
  { category: 'Inversión', pattern: /(inversion|invertir|invertido|bitso|gbm|cetes|fondo|broker|cripto|crypto|acciones|etf)/ },
]

const CATEGORY_QUESTION_PATTERN = /(donde|categoria|rubro|gaste|gast[eé]|mas|mayor|principal)/
const CURRENT_MONTH_QUESTION_PATTERN = /(mes|mensual|este mes|mes actual|actual|ultimo mes|último mes|reciente)/

function isCategoryQuestion(normalizedQuestion: string) {
  return CATEGORY_QUESTION_PATTERN.test(normalizedQuestion)
}

function isExplicitChartQuestion(normalizedQuestion: string) {
  return EXPLICIT_CHART_PATTERN.test(normalizedQuestion)
}

function getDashboardChatChartCategory(question: string): string | undefined {
  const normalized = normalizeQuestion(question)
  const alias = CATEGORY_QUERY_ALIASES.find((item) => item.pattern.test(normalized))
  if (alias) return alias.category

  return EXPENSE_CATEGORIES.find((category) => normalized.includes(normalizeQuestion(category)))
}

function getCategoryQuestionMonth(normalizedQuestion: string, summary: FinanceSummary) {
  return CURRENT_MONTH_QUESTION_PATTERN.test(normalizedQuestion) ? summary.month : null
}

function getCategoryScopeLabel(month: string | null) {
  return month ? `de ${formatMonth(month)}` : 'en todos tus movimientos'
}

const CATEGORY_ICON_RULES: Array<{ terms: string[]; icon: LucideIcon }> = [
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

function getCategoryIcon(category: string): LucideIcon {
  const normalizedCategory = normalizeQuestion(category)
  const match = CATEGORY_ICON_RULES.find((rule) => (
    rule.terms.some((term) => normalizedCategory.includes(term))
  ))

  return match?.icon || CircleDollarSign
}

function getFinanceCategoriesForType(type: TransactionType) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

function getExpenseBreakdown(transactions: AnalysisTransaction[], month?: string | null) {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    if (month && !transaction.date.startsWith(month)) continue
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

function getBreakdownTotal(breakdown: Array<{ total: number }>) {
  return Math.round(breakdown.reduce((sum, item) => sum + item.total, 0) * 100) / 100
}

function roundUiMoney(value: number) {
  return Math.round(value * 100) / 100
}

function parseMoneyInput(value: string): number | null {
  const normalized = value.replace(/[^\d.,-]/g, '').trim()
  if (!normalized) return null
  const hasCommaDecimal = /,\d{1,2}$/.test(normalized)
  const clean = hasCommaDecimal
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.replace(/,/g, '')
  const number = Number(clean)
  return Number.isFinite(number) && number >= 0 ? roundUiMoney(number) : null
}

function moneyInputValue(value: number | null | undefined) {
  return value && value > 0 ? String(value) : ''
}

function getBudgetStatus(amount: number, budget: number | null | undefined): BudgetStatus {
  if (!budget || budget <= 0) return 'unset'
  if (amount > budget) return 'over'
  if (amount / budget >= 0.85) return 'near'
  return 'under'
}

function getBudgetStatusLabel(status: BudgetStatus) {
  if (status === 'over') return 'Excedido'
  if (status === 'near') return 'Cerca del tope'
  if (status === 'under') return 'Bajo control'
  return 'Sin presupuesto'
}

function getBudgetStatusClass(status: BudgetStatus) {
  if (status === 'over') return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300'
  if (status === 'near') return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (status === 'under') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  return 'border-border/70 bg-secondary text-muted-foreground'
}

function getMonthTotalsForAnalysis(transactions: AnalysisTransaction[], month: string) {
  const categoryTotals = new Map<string, number>()
  let spendingTotal = 0
  let incomeTotal = 0

  for (const transaction of transactions) {
    if (!transaction.date.startsWith(month)) continue
    if (transaction.type === 'income') {
      incomeTotal += transaction.amount
      continue
    }
    spendingTotal += transaction.amount
    categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) || 0) + transaction.amount)
  }

  const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin datos'
  return {
    categoryTotals,
    spendingTotal: roundUiMoney(spendingTotal),
    incomeTotal: roundUiMoney(incomeTotal),
    topCategory,
  }
}

function getAvailableMonths(transactions: AnalysisTransaction[]) {
  return [...new Set(transactions.map((transaction) => transaction.date.slice(0, 7)).filter(Boolean))]
    .sort()
    .reverse()
}

function getProfileIncome(profile: FinancialProfile, fallbackIncome: number) {
  return profile.monthlyIncome && profile.monthlyIncome > 0 ? profile.monthlyIncome : fallbackIncome
}

function getMonthlyBudget(profile: FinancialProfile, fallbackIncome: number) {
  if (profile.monthlyBudget && profile.monthlyBudget > 0) {
    return { value: profile.monthlyBudget, source: 'user' as const }
  }
  const income = getProfileIncome(profile, fallbackIncome)
  if (income > 0) return { value: roundUiMoney(income * 0.8), source: 'income_rule' as const }
  return { value: null, source: 'missing' as const }
}

function buildClientCategoryAnalysis(
  transactions: AnalysisTransaction[],
  summary: FinanceSummary,
  profile: FinancialProfile,
  period = summary.month
): CategoryAnalysis {
  const months = getAvailableMonths(transactions)
  const currentPeriod = period || months[0] || summary.month
  const previousPeriod = months.find((month) => month < currentPeriod) || null
  const current = getMonthTotalsForAnalysis(transactions, currentPeriod)
  const previous = previousPeriod ? getMonthTotalsForAnalysis(transactions, previousPeriod) : null
  const budget = getMonthlyBudget(profile, current.incomeTotal)
  const denominator = current.spendingTotal || 1
  const currency = profile.currency || transactions[0]?.currency || 'MXN'

  const categories = [...current.categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, rawAmount]) => {
      const amount = roundUiMoney(rawAmount)
      const previousAmount = roundUiMoney(previous?.categoryTotals.get(category) || 0)
      const categoryBudget = profile.categoryBudgets[category] || null
      const budgetStatus = getBudgetStatus(amount, categoryBudget)
      const deltaFromPrevious = roundUiMoney(amount - previousAmount)
      const advice = budgetStatus === 'over' && categoryBudget
        ? `${category} está ${formatCardCurrency(amount - categoryBudget, currency)} sobre presupuesto.`
        : deltaFromPrevious > 0
          ? `${category} subió ${formatCardCurrency(deltaFromPrevious, currency)} frente al mes anterior.`
          : categoryBudget
            ? `${category} sigue dentro del presupuesto.`
            : `Sin presupuesto para ${category}.`

      return {
        category,
        amount,
        share: Math.round((amount / denominator) * 100),
        previousAmount,
        deltaFromPrevious,
        budget: categoryBudget,
        budgetUsage: categoryBudget ? Math.round((amount / categoryBudget) * 100) : null,
        budgetStatus,
        advice,
      }
    })

  const income = getProfileIncome(profile, current.incomeTotal)
  const summaryAdvice = budget.source === 'missing'
    ? 'Falta tu ingreso y presupuesto mensual. Agrega esos datos para comparar el gasto contra una meta real.'
    : budget.value && current.spendingTotal > budget.value
      ? `Este mes estás ${formatCardCurrency(current.spendingTotal - budget.value, currency)} sobre presupuesto.`
      : budget.source === 'income_rule'
        ? `Aún no tienes presupuesto guardado. FinovAI propone ${formatCardCurrency(budget.value || 0, currency)} como tope mensual.`
        : income > 0 && current.spendingTotal / income > 0.5
          ? `Tus gastos superan 50% de tus ingresos. Revisa gastos fijos y deuda.`
          : 'Vas dentro del presupuesto mensual.'

  const monthRows = months.map((month, index) => {
    const totals = getMonthTotalsForAnalysis(transactions, month)
    const previousMonth = months[index + 1]
    const previousTotals = previousMonth ? getMonthTotalsForAnalysis(transactions, previousMonth) : null
    const monthBudget = getMonthlyBudget(profile, totals.incomeTotal).value

    return {
      month,
      spendingTotal: totals.spendingTotal,
      incomeTotal: totals.incomeTotal,
      topCategory: totals.topCategory,
      deltaFromPrevious: previousTotals ? roundUiMoney(totals.spendingTotal - previousTotals.spendingTotal) : null,
      budgetTotal: monthBudget,
      status: getBudgetStatus(totals.spendingTotal, monthBudget),
    }
  })

  return {
    period: currentPeriod,
    periodLabel: formatMonth(currentPeriod),
    previousPeriod,
    spendingTotal: current.spendingTotal,
    incomeTotal: current.incomeTotal,
    budgetTotal: budget.value,
    budgetSource: budget.source,
    fixedExpenseShare: income > 0 ? Math.round((current.spendingTotal / income) * 100) : null,
    fixedExpenseLimit: income > 0 ? roundUiMoney(income * 0.5) : null,
    summaryAdvice,
    categories,
    monthRows,
  }
}

function CategorySearchSelect({
  disabled,
  onSelect,
  type,
  value,
}: {
  disabled?: boolean
  onSelect: (category: string) => void
  type: TransactionType
  value: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const options = getFinanceCategoriesForType(type)
  const normalizedQuery = normalizeQuestion(query)
  const filteredOptions = options.filter((option) => (
    normalizeQuestion(option).includes(normalizedQuery)
  ))

  const updateDropdownPosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return

    const width = Math.max(rect.width, 240)
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12))
    setDropdownStyle({
      left,
      top: Math.min(rect.bottom + 6, window.innerHeight - 320),
      width,
    })
  }

  useLayoutEffect(() => {
    if (!isOpen) return

    updateDropdownPosition()
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
    return () => {
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) setQuery('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  return (
    <div className="min-w-40 max-w-56">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full min-w-0 justify-between px-2 text-left font-normal"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">{value}</span>
        {disabled ? <Loader2 className="size-3.5 animate-spin" /> : null}
      </Button>

      {isOpen ? (
        <div
          ref={panelRef}
          className="fixed z-50 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
          style={dropdownStyle}
        >
          <Input
            value={query}
            className="h-8"
            placeholder="Buscar categoría"
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsOpen(false)
              if (event.key === 'Enter' && filteredOptions[0]) {
                event.preventDefault()
                onSelect(filteredOptions[0])
                setIsOpen(false)
              }
            }}
          />
          <div className={cn('mt-2 flex max-h-44 flex-col gap-1 overflow-y-auto', FINANCE_SCROLLBAR_CLASS)} role="listbox">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  className={cn(
                    'flex min-w-0 items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                    option === value && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => {
                    onSelect(option)
                    setIsOpen(false)
                  }}
                >
                  <span className="min-w-0 truncate">{option}</span>
                  {option === value ? <Check className="size-3.5" /> : null}
                </button>
              ))
            ) : (
              <p className="px-2 py-2 text-sm text-muted-foreground">Sin resultados</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
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
    amount: Math.round(expense.amount * expense.count * 100) / 100,
    averageAmount: expense.amount,
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
    transactionCount: transactions.length,
    dataCoverage: buildDataCoverage(transactions),
    topSpendingCategory: topCategory?.[0] || 'Sin datos',
    topSpendingCategoryAmount: Math.round((topCategory?.[1] || 0) * 100) / 100,
    unusualHighSpendDay: unusualDay ? { date: unusualDay[0], amount: Math.round(unusualDay[1] * 100) / 100 } : null,
    recurringExpenses,
    estimatedSavingsOpportunity: Math.round(estimatedSavingsOpportunity * 100) / 100,
  }
}

function createPreviewTransaction(
  id: string,
  date: string,
  category: string,
  description: string,
  amount: number,
  type: TransactionType = 'expense'
): FinanceTransaction {
  return {
    id,
    email: 'demo@finov.ai',
    date,
    type,
    amount,
    currency: 'MXN',
    category,
    description,
    merchant: description,
    notes: null,
    source: 'syncfy',
    confidence: 0.94,
    rawSource: 'syncfy-preview',
    cartolaImportId: null,
    created_at: `${date}T12:00:00.000Z`,
  }
}

function createPreviewDashboardResponse(email: string): DashboardResponse {
  const transactions: FinanceTransaction[] = [
    createPreviewTransaction('preview-may-1', '2026-05-01', 'Sueldo', 'Nómina', 52000, 'income'),
    createPreviewTransaction('preview-may-2', '2026-05-02', 'Transferencias', 'Renta departamento', 16500),
    createPreviewTransaction('preview-may-3', '2026-05-06', 'Supermercado', 'City Market', 2200),
    createPreviewTransaction('preview-may-4', '2026-05-09', 'Comida fuera', 'Restaurante', 980),
    createPreviewTransaction('preview-may-5', '2026-05-14', 'Suscripciones', 'Netflix', 299),
    createPreviewTransaction('preview-may-6', '2026-05-18', 'Transporte', 'Uber', 610),
    createPreviewTransaction('preview-1', '2026-06-01', 'Sueldo', 'Nómina', 52000, 'income'),
    createPreviewTransaction('preview-2', '2026-06-01', 'Transferencias', 'Renta departamento', 16500),
    createPreviewTransaction('preview-3', '2026-06-02', 'Supermercado', 'City Market', 2840),
    createPreviewTransaction('preview-4', '2026-06-03', 'Suscripciones', 'Netflix', 299),
    createPreviewTransaction('preview-5', '2026-06-04', 'Transporte', 'Uber', 480),
    createPreviewTransaction('preview-6', '2026-06-05', 'Comida fuera', 'Starbucks', 185),
    createPreviewTransaction('preview-7', '2026-06-06', 'Comida fuera', 'Starbucks', 165),
    createPreviewTransaction('preview-8', '2026-06-07', 'Compras', 'Amazon MX', 1450),
    createPreviewTransaction('preview-9', '2026-06-08', 'Suscripciones', 'Spotify', 129),
    createPreviewTransaction('preview-10', '2026-06-09', 'Salud', 'Farmacia Guadalajara', 780),
    createPreviewTransaction('preview-11', '2026-06-10', 'Ocio', 'Cinemex', 620),
    createPreviewTransaction('preview-12', '2026-06-11', 'Transporte', 'Didi', 360),
    createPreviewTransaction('preview-13', '2026-06-12', 'Comida fuera', 'Starbucks', 195),
    createPreviewTransaction('preview-14', '2026-06-13', 'Impuestos', 'SAT pago provisional', 3800),
    createPreviewTransaction('preview-15', '2026-06-14', 'Inversión', 'Bitso compra recurrente', 2500, 'income'),
  ].map((transaction) => ({ ...transaction, email }))

  const summary = buildLocalSummary(transactions)
  const profile: FinancialProfile = {
    email,
    currency: 'MXN',
    monthlyIncome: 52000,
    monthlyBudget: 39000,
    categoryBudgets: {
      Transferencias: 17000,
      Supermercado: 6000,
      'Comida fuera': 1800,
      Suscripciones: 900,
      Transporte: 1800,
      Impuestos: 3500,
    },
  }
  const categoryAnalysis = buildClientCategoryAnalysis(transactions, summary, profile)
  const actionPlan: FinanceActionPlan = {
    monthlySavingsTarget: summary.estimatedSavingsOpportunity,
    topOpportunities: [
      {
        id: 'preview-coffee',
        kind: 'merchant_leak',
        title: 'Café entre semana',
        body: 'Starbucks aparece varias veces en pocos días. Reducir dos visitas por semana libera margen sin cambiar gastos fijos.',
        sourceLabel: 'Starbucks',
        estimatedMonthlySavings: 1480,
      },
      {
        id: 'preview-subscriptions',
        kind: 'recurring',
        title: 'Suscripciones pequeñas',
        body: 'Netflix y Spotify no son grandes solos, pero juntos ya son una fuga recurrente revisable.',
        sourceLabel: 'Suscripciones',
        estimatedMonthlySavings: 428,
      },
    ],
    investmentProjection: {
      monthlyContribution: summary.estimatedSavingsOpportunity,
      years: 10,
      annualReturn: DEFAULT_INVESTMENT_ASSUMPTION.annualReturn,
      totalContributed: summary.estimatedSavingsOpportunity * 120,
      tenYearValue: projectMonthlyContribution(summary.estimatedSavingsOpportunity),
      potentialGrowth: Math.max(0, projectMonthlyContribution(summary.estimatedSavingsOpportunity) - summary.estimatedSavingsOpportunity * 120),
    },
    nextActions: [
      {
        id: 'preview-plan',
        label: 'Plan semanal',
        body: 'Convierte estas fugas en una meta automática de ahorro.',
        target: 'chat',
      },
      {
        id: 'preview-invest',
        label: 'Ruta de inversión',
        body: 'Simula el margen mensual como aportación futura.',
        target: 'partner',
      },
    ],
  }

  return {
    success: true,
    email,
    transactions,
    profile,
    summary,
    categoryAnalysis,
    insights: [
      {
        id: 'preview-leak',
        title: 'Fuga principal',
        value: 'Comida fuera',
        body: 'El gasto repetido en cafés y salidas pequeñas tiene margen de reducción inmediato.',
        tone: 'watch',
      },
      {
        id: 'preview-investable',
        title: 'Ahorro invertible',
        value: formatCardCurrency(summary.estimatedSavingsOpportunity, 'MXN'),
        body: 'FinovAI puede transformar ese margen en próximos pasos de inversión.',
        tone: 'good',
      },
    ],
    actionPlan,
  }
}

function createPreviewSyncfyCredentials(): SyncfyCredential[] {
  return [
    {
      id: 'preview-bbva',
      syncfyCredentialId: 'preview-bbva',
      siteName: 'BBVA México',
      status: 'synced',
      lastSuccessfulSyncAt: '2026-06-02T12:00:00.000Z',
      lastPullAt: '2026-06-02T12:00:00.000Z',
      cooldownSeconds: 0,
      ready: true,
    },
    {
      id: 'preview-amex',
      syncfyCredentialId: 'preview-amex',
      siteName: 'American Express',
      status: 'synced',
      lastSuccessfulSyncAt: '2026-06-02T12:00:00.000Z',
      lastPullAt: '2026-06-02T12:00:00.000Z',
      cooldownSeconds: 0,
      ready: true,
    },
    {
      id: 'preview-bitso',
      syncfyCredentialId: 'preview-bitso',
      siteName: 'Bitso',
      status: 'synced',
      lastSuccessfulSyncAt: '2026-06-02T12:00:00.000Z',
      lastPullAt: '2026-06-02T12:00:00.000Z',
      cooldownSeconds: 0,
      ready: true,
    },
  ]
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

function buildDashboardChatOpening(
  transactions: AnalysisTransaction[],
  draftCount: number,
  selectedDraftCount: number,
  hasConnectedInstitution: boolean,
  hasReconnectRequiredCredential = false
) {
  if (draftCount > 0 && selectedDraftCount > 0) {
    return `Ya puedo hacer un análisis preliminar de ${selectedDraftCount} movimientos seleccionados. Pregúntame qué se repite, dónde se fuga dinero o qué podrías ahorrar.`
  }

  if (draftCount > 0) {
    return 'Tienes movimientos de respaldo cargados, pero no hay filas seleccionadas. Marca movimientos para analizarlos antes de confirmar.'
  }

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

function getDashboardEffectiveMonthlyIncome(summary: FinanceSummary, profile?: FinancialProfile | null) {
  return getProfileIncome(profile || EMPTY_PROFILE, summary.monthlyIncome)
}

function getDashboardDebtGate(transactions: AnalysisTransaction[], summary: FinanceSummary, effectiveMonthlyIncome = summary.monthlyIncome) {
  const debtTransactions = transactions.filter((transaction) => (
    transaction.type === 'expense' &&
    transaction.category === 'Deuda' &&
    transaction.date.startsWith(summary.month)
  ))
  const monthlyDebtPayments = roundUiMoney(debtTransactions.reduce((sum, transaction) => sum + transaction.amount, 0))
  const debtShareOfIncome = effectiveMonthlyIncome > 0
    ? Math.round((monthlyDebtPayments / effectiveMonthlyIncome) * 100)
    : null
  const debtShareOfSpending = summary.monthlySpending > 0
    ? Math.round((monthlyDebtPayments / summary.monthlySpending) * 100)
    : null
  const expensiveDebtSignals = debtTransactions.filter((transaction) => (
    /(american express|amex|tarjeta|tdc|interes|comision|disposicion|pago minimo|cat)/i.test(transaction.description)
  ))
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
  }
}

function buildDashboardChatAnswer(
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
  const monthlyMargin = effectiveMonthlyIncome > 0 ? roundUiMoney(effectiveMonthlyIncome - summary.monthlySpending) : null
  const spendingShareOfIncome = effectiveMonthlyIncome > 0 ? Math.round((summary.monthlySpending / effectiveMonthlyIncome) * 100) : null
  const starterSavingsTarget = effectiveMonthlyIncome > 0 ? roundUiMoney(effectiveMonthlyIncome * 0.05) : null
  const strongSavingsTarget = effectiveMonthlyIncome > 0 ? roundUiMoney(effectiveMonthlyIncome * 0.2) : null
  const debtGate = getDashboardDebtGate(transactions, summary, effectiveMonthlyIncome)

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

function finalizeDashboardChatAnswer(answer: string) {
  const replaced = answer
    .replace(/\bVe a Revisar recurrentes\b/gi, 'Ve a Movimientos')
    .replace(/\bEn Revisar recurrentes\b/gi, 'En Movimientos')
    .replace(/\bdesde Revisar recurrentes\b/gi, 'desde Movimientos')
    .replace(/\bRevisar recurrentes\b/g, 'Movimientos')
    .replace(/\brevisar recurrentes\b/g, 'Movimientos')
    .trim()
  const chartPayloadStart = replaced.search(/\n\s*(CHART|```(?:json|chart)?\s*\{)/i)
  const withoutChartPayload = chartPayloadStart >= 0 && /("datasets"|"type"\s*:|"labels"\s*:)/i.test(replaced.slice(chartPayloadStart))
    ? replaced.slice(0, chartPayloadStart).trim()
    : replaced

  if (!withoutChartPayload || /[.!?…)]$/.test(withoutChartPayload)) return withoutChartPayload

  const lines = withoutChartPayload.split('\n')
  if (lines.length > 1 && !/[.!?…)]$/.test((lines.at(-1) || '').trim())) {
    return lines.slice(0, -1).join('\n').trim()
  }

  const lastSentenceEnd = Math.max(
    withoutChartPayload.lastIndexOf('.'),
    withoutChartPayload.lastIndexOf('!'),
    withoutChartPayload.lastIndexOf('?'),
    withoutChartPayload.lastIndexOf('…')
  )

  if (lastSentenceEnd >= 0) {
    return withoutChartPayload.slice(0, lastSentenceEnd + 1).trim()
  }

  return `${withoutChartPayload.replace(/[,;:\-\s]+$/, '')}.`
}

function getDashboardChatChartType(
  question: string,
  transactions: AnalysisTransaction[],
  summary: FinanceSummary
): DashboardChatChartType | undefined {
  if (transactions.length === 0) return undefined

  const normalized = normalizeQuestion(question)
  const hasMonthSpending = summary.monthlySpending > 0
  const requestedChartCategory = getDashboardChatChartCategory(question)
  const asksForChart = isExplicitChartQuestion(normalized)
  const debtGate = getDashboardDebtGate(transactions, summary)

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

  if (isCategoryQuestion(normalized)) {
    const month = getCategoryQuestionMonth(normalized, summary)
    return `Agrupo ${transactions.length} ${scope} por categoría, ${month ? `sumo solo gastos de ${formatMonth(month)}` : 'uso todos los gastos disponibles'} y comparo el peso relativo de los rubros principales.`
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

export default function Dashboard({ email, initialNotice, initialPath, onBackHome, onLogout }: DashboardProps) {
  const previewEnabled = getDashboardPreviewEnabled()
  const previewEmail = previewEnabled ? 'preview@finov.ai' : null
  const [activeEmail, setActiveEmail] = useState<string | null>(() => getStoredEmail(email) || previewEmail)
  const [emailInput, setEmailInput] = useState(() => getStoredEmail(email) || previewEmail || '')
  const [pendingLoginEmail, setPendingLoginEmail] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [data, setData] = useState<DashboardResponse | null>(() => previewEmail ? createPreviewDashboardResponse(previewEmail) : null)
  const [manualForm, setManualForm] = useState<ManualForm>(() => createManualForm())
  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([])
  const [draftRows, setDraftRows] = useState<CartolaDraftRow[]>([])
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set())
  const [currentImport, setCurrentImport] = useState<CartolaImportResponse | null>(null)
  const [status, setStatus] = useState(initialNotice || 'Identifícate con tu correo. Después ve a Conectar cuenta y sigue los pasos.')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<DashboardChatMessage[]>([])
  const [pendingChatAnswer, setPendingChatAnswer] = useState<PendingChatAnswer | null>(null)
  const [activePage, setActivePageState] = useState<DashboardPage>(() => getDashboardPageFromPath(initialPath))
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(() => getStoredDashboardTheme())
  const [syncfyCredentials, setSyncfyCredentials] = useState<SyncfyCredential[]>(() => previewEnabled ? createPreviewSyncfyCredentials() : [])
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(() => Boolean(getStoredEmail(email)) && !previewEnabled)
  const [spouseEmail, setSpouseEmail] = useState('')
  const [householdInvites, setHouseholdInvites] = useState<HouseholdInvite[]>([])
  const [isInvitingSpouse, setIsInvitingSpouse] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileForm>({ monthlyIncome: '', monthlyBudget: '' })
  const [categoryBudgetInputs, setCategoryBudgetInputs] = useState<Record<string, string>>({})
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [categoryPeriodFilter, setCategoryPeriodFilter] = useState<CategoryPeriodFilter>('current')
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | null>(null)
  const chatAnswerTimeoutRef = useRef<number | null>(null)
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null)
  const activeSyncfyCredentials = syncfyCredentials.filter((credential) => !syncfyCredentialNeedsReconnect(credential))
  const reconnectCredentialCount = syncfyCredentials.length - activeSyncfyCredentials.length
  const connectedInstitutionCount = activeSyncfyCredentials.length
  const hasConnectedInstitution = connectedInstitutionCount > 0
  const hasReconnectRequiredCredential = reconnectCredentialCount > 0
  const showConnectNudge = !hasConnectedInstitution && activePage !== 'syncfy'

  useEffect(() => {
    if (initialNotice) setStatus(initialNotice)
  }, [initialNotice])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, dashboardTheme)
  }, [dashboardTheme])

  const setActivePage = (nextPage: DashboardPage) => {
    setActivePageState(nextPage)
    if (typeof window === 'undefined') return

    const nextPath = previewEnabled && import.meta.env.DEV
      ? `${DASHBOARD_PAGE_PATHS[nextPage]}?preview=dashboard`
      : DASHBOARD_PAGE_PATHS[nextPage]
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  useEffect(() => {
    if (email && email !== activeEmail) {
      setActiveEmail(email)
      setEmailInput(email)
    }
  }, [activeEmail, email])

  useEffect(() => {
    const nextPage = getDashboardPageFromPath(initialPath)
    setActivePageState(nextPage)

    if (typeof window === 'undefined' || !shouldCanonicalizeDashboardPath(initialPath)) return

    const canonicalPath = DASHBOARD_PAGE_PATHS[nextPage]
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({}, '', canonicalPath)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [initialPath])

  useEffect(() => {
    let cancelled = false
    if (previewEnabled) {
      const nextEmail = activeEmail || previewEmail || 'preview@finov.ai'
      setData(createPreviewDashboardResponse(nextEmail))
      setStatus('Vista local de referencia para revisar el panel financiero.')
      return
    }
    if (!activeEmail) return

    setIsLoading(true)
    setStatus('Cargando transacciones conectadas.')

    apiJson<DashboardResponse>(`/api/transactions?email=${encodeURIComponent(activeEmail)}`)
      .then((response) => {
        if (cancelled) return
        setData(response)
        setStatus(response.transactions.length > 0
          ? 'Transacciones listas para análisis.'
          : hasConnectedInstitution
            ? 'Institución conectada. Esperando movimientos.'
            : hasReconnectRequiredCredential
              ? 'Ve a Conectar cuenta y sigue los pasos para reconectar tu institución.'
            : 'Ve a Conectar cuenta y sigue los pasos para analizar tus datos reales.')
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
  }, [activeEmail, hasConnectedInstitution, hasReconnectRequiredCredential, previewEmail, previewEnabled])

  useEffect(() => {
    let cancelled = false
    if (previewEnabled) {
      setSyncfyCredentials(createPreviewSyncfyCredentials())
      setIsLoadingCredentials(false)
      return
    }
    if (!activeEmail) {
      setSyncfyCredentials([])
      setIsLoadingCredentials(false)
      return
    }

    setIsLoadingCredentials(true)
    apiJson<SyncfyCredentialsResponse>(`/api/syncfy/credentials?email=${encodeURIComponent(activeEmail)}`)
      .then((response) => {
        if (!cancelled) setSyncfyCredentials(response.credentials)
      })
      .catch(() => {
        if (!cancelled) setSyncfyCredentials([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCredentials(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeEmail, previewEnabled])

  useEffect(() => {
    let cancelled = false
    if (previewEnabled) {
      setHouseholdInvites([])
      return
    }
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
  }, [activeEmail, previewEnabled])

  const transactions = data?.transactions || EMPTY_TRANSACTIONS
  const rawSummary = data?.summary || EMPTY_SUMMARY
  const summary = rawSummary.dataCoverage
    ? rawSummary
    : { ...rawSummary, dataCoverage: buildDataCoverage(transactions) }
  const profile = data?.profile || EMPTY_PROFILE
  const serverCategoryAnalysis = data?.categoryAnalysis || EMPTY_CATEGORY_ANALYSIS
  const insights = data?.insights || EMPTY_INSIGHTS
  const actionPlan = data?.actionPlan || EMPTY_ACTION_PLAN
  const categories = getFinanceCategoriesForType(manualForm.type)
  const hasTransactions = transactions.length > 0
  const hasDraftRows = draftRows.length > 0
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
  const chatProfile = profile.email ? profile : { ...profile, email: activeEmail || profile.email }
  const latestCurrency = transactions[0]?.currency || 'MXN'
  const chatCurrency = chatProfile.currency || chatTransactions[0]?.currency || latestCurrency
  const effectiveMonthlyIncome = chatSummary.monthlyIncome || chatProfile.monthlyIncome || 0
  const effectiveNetBalance = effectiveMonthlyIncome > 0
    ? Math.round((effectiveMonthlyIncome - chatSummary.monthlySpending) * 100) / 100
    : null
  const savedMonthlyBudget = chatProfile.monthlyBudget || 0
  const savedCategoryBudgetEntries = Object.entries(chatProfile.categoryBudgets || {})
    .filter(([, amount]) => amount > 0)
  const savedCategoryBudgetTotal = roundUiMoney(savedCategoryBudgetEntries.reduce((sum, [, amount]) => sum + amount, 0))
  const budgetCoveragePercent = savedMonthlyBudget > 0
    ? Math.round((savedCategoryBudgetTotal / savedMonthlyBudget) * 100)
    : null
  const budgetRunwayAmount = savedMonthlyBudget > 0
    ? roundUiMoney(savedMonthlyBudget - chatSummary.monthlySpending)
    : null
  const isDraftChat = hasDraftRows
  const pageMeta = PAGE_META[activePage]
  const monthlyCategoryBreakdown = useMemo(
    () => getExpenseBreakdown(chatTransactions, chatSummary.month),
    [chatTransactions, chatSummary.month]
  )
  const allCategoryBreakdown = useMemo(
    () => getExpenseBreakdown(chatTransactions),
    [chatTransactions]
  )
  const fallbackCategoryAnalysis = useMemo(
    () => buildClientCategoryAnalysis(chatTransactions, chatSummary, chatProfile),
    [chatProfile, chatSummary, chatTransactions]
  )
  const baseCategoryAnalysis = hasDraftRows || !data?.categoryAnalysis
    ? fallbackCategoryAnalysis
    : serverCategoryAnalysis
  const previousCategoryAnalysis = useMemo(
    () => baseCategoryAnalysis.previousPeriod
      ? buildClientCategoryAnalysis(chatTransactions, chatSummary, chatProfile, baseCategoryAnalysis.previousPeriod)
      : null,
    [baseCategoryAnalysis.previousPeriod, chatProfile, chatSummary, chatTransactions]
  )
  const selectedCategoryAnalysis = categoryPeriodFilter === 'previous'
    ? previousCategoryAnalysis || baseCategoryAnalysis
    : baseCategoryAnalysis
  const categoryBreakdown = categoryPeriodFilter === 'all'
    ? allCategoryBreakdown
    : selectedCategoryAnalysis.categories.map((item) => ({ category: item.category, total: item.amount }))
  const categoryBreakdownTotal = getBreakdownTotal(categoryBreakdown)
  const topAnalysisTransactions = getTopTransactions(chatTransactions, chatSummary.month)
  const lowConfidenceRows = draftRows.filter((row) => row.confidence < 0.75).length
  const dataModeLabel = hasDraftRows ? 'Preliminar' : hasTransactions ? 'Confirmado' : 'Sin datos'
  const cashflowChartData = useMemo(
    () => getDailyFlowChartData(chatTransactions, chatSummary.month),
    [chatTransactions, chatSummary.month]
  )
  const categoryChartData = useMemo(
    () => getCategoryChartData(categoryBreakdown, categoryBreakdownTotal),
    [categoryBreakdown, categoryBreakdownTotal]
  )
  const savingsChartData = useMemo(
    () => getSavingsChartData(monthlyCategoryBreakdown),
    [monthlyCategoryBreakdown]
  )
  const recurringChartData = useMemo(
    () => getRecurringChartData(chatSummary),
    [chatSummary]
  )
  const projectedSavingsValue = useMemo(
    () => getSavingsProjection(chatSummary),
    [chatSummary]
  )
  const hasChartData = chatTransactions.length > 0
  const categoryPageRows = categoryChartData
  const categoryPeriodLabel = categoryPeriodFilter === 'all'
    ? 'Todo el historial'
    : selectedCategoryAnalysis.periodLabel
  const categoryPageAdvice = categoryPeriodFilter === 'all'
    ? 'Vista histórica. Cambia a este mes para comparar contra presupuesto y mes anterior.'
    : selectedCategoryAnalysis.summaryAdvice
  const categoryBudgetLabel = selectedCategoryAnalysis.budgetTotal
    ? formatCardCurrency(selectedCategoryAnalysis.budgetTotal, chatCurrency)
    : 'Sin presupuesto'
  const categoryOverBudgetAmount = selectedCategoryAnalysis.budgetTotal
    ? selectedCategoryAnalysis.spendingTotal - selectedCategoryAnalysis.budgetTotal
    : 0
  const chatDataCoverageLabel = formatDataCoverage(chatSummary.dataCoverage)
  const chatDataCoverageQualifier = chatSummary.dataCoverage.preliminary
    ? 'Lectura preliminar'
    : 'Historial suficiente'

  useEffect(() => {
    setProfileForm({
      monthlyIncome: moneyInputValue(profile.monthlyIncome),
      monthlyBudget: moneyInputValue(profile.monthlyBudget),
    })
    setCategoryBudgetInputs(
      EXPENSE_CATEGORIES.reduce<Record<string, string>>((next, category) => {
        next[category] = moneyInputValue(profile.categoryBudgets[category])
        return next
      }, {})
    )
  }, [profile.categoryBudgets, profile.monthlyBudget, profile.monthlyIncome])

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
          content: buildDashboardChatOpening(
            chatTransactions,
            draftRows.length,
            selectedRows.length,
            hasConnectedInstitution,
            hasReconnectRequiredCredential
          ),
        },
        ...current.filter((message) => !message.id.startsWith(`welcome-${activeEmail}`)),
      ]
    })
  }, [activeEmail, chatTransactions, draftRows.length, hasConnectedInstitution, hasDraftRows, hasReconnectRequiredCredential, selectedRows.length, transactions.length])

  useEffect(() => () => {
    if (chatAnswerTimeoutRef.current) {
      window.clearTimeout(chatAnswerTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages, pendingChatAnswer])

  const handleIdentify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = emailInput.trim().toLowerCase()
    if (!pendingLoginEmail && !normalizedEmail.includes('@')) {
      setStatus('Ingresa un correo válido.')
      return
    }
    if (pendingLoginEmail && loginCode.trim().length < 4) {
      setStatus('Ingresa el código que enviamos a tu correo.')
      return
    }

    setIsLoading(true)
    setStatus(pendingLoginEmail ? 'Verificando código.' : 'Registrando correo.')

    try {
      const response = await apiJson<{
        success: boolean
        email: string
        clientSecret?: string
        verificationRequired?: boolean
        debugCode?: string
      }>(pendingLoginEmail ? '/api/auth/verify' : '/api/signup', {
        method: 'POST',
        body: JSON.stringify(pendingLoginEmail
          ? {
              email: pendingLoginEmail,
              code: loginCode.trim(),
              source: 'dashboard-email-gate',
            }
          : {
              email: normalizedEmail,
              redirectPath: '/dashboard',
              diagnosticData: JSON.stringify({
                source: 'dashboard-email-gate',
                capturedAt: new Date().toISOString(),
              }),
            }),
      })
      const registeredEmail = response.email || normalizedEmail
      if (response.verificationRequired) {
        setPendingLoginEmail(registeredEmail)
        setStatus(response.debugCode ? `Código local: ${response.debugCode}` : 'Te enviamos un código y enlace de acceso a tu correo.')
        return
      }
      setDashboardSession(registeredEmail, response.clientSecret)
      setActiveEmail(registeredEmail)
      setEmailInput(registeredEmail)
      setPendingLoginEmail('')
      setLoginCode('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos registrar el correo.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInviteSpouse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeEmail) return

    const normalizedSpouseEmail = spouseEmail.trim().toLowerCase()
    if (!normalizedSpouseEmail.includes('@')) {
      setStatus('Ingresa el correo de tu pareja.')
      return
    }
    if (normalizedSpouseEmail === activeEmail) {
      setStatus('Usa un correo distinto para invitar a tu pareja.')
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
      setStatus(response.emailSent
        ? `Invitación enviada a ${normalizedSpouseEmail}.`
        : `Invitación guardada para ${normalizedSpouseEmail}. El correo solo se envía cuando Cloudflare Email está configurado.`
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos guardar la invitación.')
    } finally {
      setIsInvitingSpouse(false)
    }
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeEmail) {
      setStatus('Primero identifica el correo del usuario.')
      return
    }

    const monthlyIncome = parseMoneyInput(profileForm.monthlyIncome)
    const monthlyBudget = parseMoneyInput(profileForm.monthlyBudget)
    if (!monthlyIncome && !monthlyBudget) {
      setStatus('Agrega ingreso mensual o presupuesto mensual.')
      return
    }

    setIsSavingProfile(true)
    try {
      const categoryBudgets = Object.entries(categoryBudgetInputs).reduce<Record<string, number>>((next, [category, value]) => {
        const amount = parseMoneyInput(value)
        if (amount && amount > 0) next[category] = amount
        return next
      }, {})
      if (previewEnabled) {
        const nextProfile: FinancialProfile = {
          ...profile,
          email: activeEmail || profile.email || 'preview@finov.ai',
          currency: chatCurrency,
          monthlyIncome,
          monthlyBudget,
          categoryBudgets,
        }
        const nextData: DashboardResponse = {
          ...(data || createPreviewDashboardResponse(nextProfile.email)),
          profile: nextProfile,
          categoryAnalysis: buildClientCategoryAnalysis(chatTransactions, chatSummary, nextProfile),
          message: 'Perfil financiero actualizado.',
        }
        setData(nextData)
        setStatus('Perfil financiero actualizado.')
        return
      }
      const response = await apiJson<DashboardResponse>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          email: activeEmail,
          currency: chatCurrency,
          monthlyIncome,
          monthlyBudget,
          categoryBudgets,
        }),
      })
      setData(response)
      setStatus(response.message || 'Perfil financiero actualizado.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos guardar el perfil financiero.')
    } finally {
      setIsSavingProfile(false)
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
      setStatus('Primero identifica el correo del usuario.')
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

  const handleTransactionCategoryChange = async (transaction: FinanceTransaction, category: string) => {
    if (!activeEmail || category === transaction.category || updatingCategoryId) return

    setUpdatingCategoryId(transaction.id)
    try {
      const response = await apiJson<TransactionCategoryResponse>('/api/transactions/category', {
        method: 'PATCH',
        body: JSON.stringify({
          email: activeEmail,
          transactionId: transaction.id,
          category,
        }),
      })
      setData(response)
      setStatus(response.message || `Categoría actualizada a ${category}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos actualizar la categoría.')
    } finally {
      setUpdatingCategoryId(null)
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
    window.setTimeout(() => {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 0)

    if (chatAnswerTimeoutRef.current) {
      window.clearTimeout(chatAnswerTimeoutRef.current)
    }

    chatAnswerTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        let answer = ''
        let model: string | undefined
        let chatError: string | null = null

        if (activeEmail && !hasDraftRows) {
          try {
            const response = await apiJson<DashboardChatResponse>('/api/dashboard/chat', {
              method: 'POST',
              body: JSON.stringify({
                email: activeEmail,
                question,
              }),
            })
            answer = response.answer
            model = response.model
          } catch (error) {
            chatError = error instanceof Error ? error.message : 'No pudimos conectar con el modelo financiero.'
          }
        } else {
          answer = buildDashboardChatAnswer(
            question,
            chatTransactions,
            chatSummary,
            chatCurrency,
            isDraftChat,
            hasConnectedInstitution,
            hasReconnectRequiredCredential,
            chatProfile
          )
          model = isDraftChat ? 'análisis local preliminar' : undefined
        }

        if (chatError) {
          answer = buildDashboardChatAnswer(
            question,
            chatTransactions,
            chatSummary,
            chatCurrency,
            isDraftChat,
            hasConnectedInstitution,
            hasReconnectRequiredCredential,
            chatProfile
          )
          model = 'análisis local'
        }

        answer = finalizeDashboardChatAnswer(answer)

        const chart = getDashboardChatChartType(question, chatTransactions, chatSummary)
        const chartCategory = chart === 'category-trend' ? getDashboardChatChartCategory(question) : undefined
        const reasoningDuration = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000))

        setChatMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: answer,
            chart,
            chartCategory,
            reasoning: model
              ? `${reasoning}\nModelo: ${model}${chatError ? `\nModelo remoto no ejecutado: ${chatError}` : ''}`
                : reasoning,
            reasoningDuration,
          },
        ])
        setPendingChatAnswer(null)
        chatAnswerTimeoutRef.current = null
      })()
    }, 1200)
  }

  const submitDashboardChatInput = () => {
    queueDashboardChatAnswer(chatInput.trim())
  }

  const askDashboardQuestion = (question: string) => {
    queueDashboardChatAnswer(question)
  }

  const analyzeWithFinovAI = (question: string) => {
    setActivePage('inicio')
    window.setTimeout(() => queueDashboardChatAnswer(question), 0)
  }

  const toggleDashboardTheme = () => {
    setDashboardTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const handleActionPlanTarget = (target: FinanceActionPlan['nextActions'][number]['target']) => {
    if (target === 'connect') {
      setActivePage('syncfy')
      return
    }
    if (target === 'movements') {
      setActivePage('movimientos')
      return
    }
    if (target === 'categories') {
      setActivePage('categorias')
      return
    }

    setActivePage('inicio')
    if (target === 'partner') {
      askDashboardQuestion('¿Cómo convierto este ahorro mensual en una ruta de inversión?')
      return
    }

    askDashboardQuestion('Dame un plan semanal para reducir estas fugas.')
  }

  const renderDashboardRail = () => (
    <aside className="flex min-w-0 items-center justify-between gap-3 border-b border-border/70 bg-background px-3 py-2 md:h-full md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-3 md:py-4">
      <div className="flex min-w-0 items-center gap-2 md:flex-col md:items-stretch md:gap-5">
        <button
          type="button"
          className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-0 text-foreground transition-colors hover:bg-secondary md:w-full md:justify-start md:px-2"
          aria-label="FinovAI"
          title="FinovAI"
          onClick={() => setActivePage('inicio')}
        >
          <DashboardBrandWordmark />
        </button>

        <nav className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] md:mx-0 md:flex-col md:items-stretch md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden" aria-label="Dashboard">
          {DASHBOARD_PAGES.map((page) => {
            const Icon = page.icon
            const isActive = activePage === page.id

            return (
              <button
                key={page.id}
                type="button"
                aria-label={page.label}
                title={page.label}
                className={cn(
                  'flex h-10 shrink-0 items-center justify-center gap-3 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:w-full md:justify-start',
                  isActive && 'bg-secondary text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                )}
                onClick={() => setActivePage(page.id)}
              >
                <Icon className="size-4" />
                <span className="hidden truncate md:block">{page.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1 md:flex-col md:items-stretch">
        <button
          type="button"
          aria-label={dashboardTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={dashboardTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          className="flex h-10 shrink-0 items-center justify-center gap-3 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:w-full md:justify-start"
          onClick={toggleDashboardTheme}
        >
          {dashboardTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          <span className="hidden truncate md:block">{dashboardTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
        <button
          type="button"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-10 shrink-0 items-center justify-center gap-3 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:w-full md:justify-start"
          onClick={onLogout}
        >
          <LogOut className="size-4" />
          <span className="hidden truncate md:block">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )

  const renderActionPlanPanel = () => {
    const hasOpportunities = actionPlan.topOpportunities.length > 0
    const projection = actionPlan.investmentProjection
    const projectionYears = projection.years || DEFAULT_INVESTMENT_ASSUMPTION.years
    const fallbackAction = hasConnectedInstitution
      ? {
          id: 'sync-wait',
          label: 'Ver movimientos',
          body: 'Revisa si los movimientos ya están listos.',
          target: 'movements',
        } satisfies FinanceActionPlan['nextActions'][number]
      : hasReconnectRequiredCredential
        ? {
            id: 'reconnect',
            label: 'Reconectar cuenta',
            body: 'Ve a Conectar cuenta y sigue los pasos para autorizar la lectura de movimientos.',
            target: 'connect',
          } satisfies FinanceActionPlan['nextActions'][number]
        : {
            id: 'connect',
            label: 'Conectar cuenta',
            body: 'Ve a Conectar cuenta y sigue los pasos para traer movimientos reales.',
            target: 'connect',
          } satisfies FinanceActionPlan['nextActions'][number]

    return (
      <Card className={cn(FINANCE_ARTIFACT_CARD_CLASS, 'border-primary/20 bg-primary/5')}>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Plan de ahorro invertible</CardTitle>
            <CardDescription>
              Fugas detectadas que FinovAI puede convertir en próximos pasos.
            </CardDescription>
          </div>
          <Badge variant={hasOpportunities ? 'secondary' : 'outline'}>
            {hasOpportunities ? `${actionPlan.topOpportunities.length} oportunidades` : 'Sin oportunidad clara'}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[minmax(220px,0.7fr)_minmax(0,1fr)_minmax(240px,0.8fr)]">
          <div className="rounded-lg bg-background/45 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <p className="text-sm text-muted-foreground">Meta mensual</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal text-primary tabular-nums [overflow-wrap:anywhere]">
              {formatCardCurrency(actionPlan.monthlySavingsTarget, chatCurrency)}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {actionPlan.monthlySavingsTarget > 0
                ? `Si se invierte cada mes, en ${projectionYears} años podría ser ${formatCardCurrency(projection.tenYearValue, chatCurrency)} bajo un supuesto anual ilustrativo de ${Math.round(projection.annualReturn * 100)}%.`
                : hasConnectedInstitution
                  ? 'La institución está conectada, pero todavía falta suficiente señal para estimar una meta real.'
                  : hasReconnectRequiredCredential
                    ? 'Reconecta la institución para estimar una meta con movimientos reales.'
                  : 'Conecta una institución para calcular una meta con movimientos reales.'}
            </p>
          </div>

          <div className="grid gap-2">
            {hasOpportunities ? (
              actionPlan.topOpportunities.map((opportunity) => (
                <div
                  key={opportunity.id}
                  className="rounded-lg bg-background/40 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight [overflow-wrap:anywhere]">{opportunity.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{opportunity.body}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-primary tabular-nums">
                      {formatCardCurrency(opportunity.estimatedMonthlySavings, chatCurrency)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm leading-relaxed text-muted-foreground">
                {hasTransactions
                  ? 'Hay movimientos, pero FinovAI necesita más recurrencia o concentración para sugerir una acción fuerte.'
                  : 'Cuando entren movimientos, aquí aparecerán fugas concretas como suscripciones, comercios repetidos y días atípicos.'}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {(actionPlan.nextActions.length > 0 ? actionPlan.nextActions : [fallbackAction]).map((action) => (
              <Button
                key={action.id}
                type="button"
                variant={action.target === 'partner' ? 'default' : 'outline'}
                className="h-auto min-w-0 justify-start whitespace-normal px-3 py-2 text-left"
                onClick={() => handleActionPlanTarget(action.target)}
                disabled={Boolean(pendingChatAnswer) && (action.target === 'chat' || action.target === 'partner')}
              >
                {action.target === 'partner' ? <TrendingUp data-icon="inline-start" /> : <TrendingDown data-icon="inline-start" />}
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">{action.label}</span>
                  <span className="mt-1 block text-xs font-normal leading-relaxed opacity-75">{action.body}</span>
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderChatChart = (chart?: DashboardChatChartType, chartCategory?: string) => {
    if (!chart) return null

    if (chart === 'category-trend') {
      const category = chartCategory || chatSummary.topSpendingCategory
      const data = getCategoryTrendChartData(chatTransactions, category, chatSummary.dataCoverage)
      if (data.length === 0) return null

      const total = data.reduce((sum, item) => sum + item.amount, 0)
      const peak = [...data].sort((a, b) => b.amount - a.amount)[0]

      return (
        <div className="mt-3 rounded-lg bg-background/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Evolución mensual
              </p>
              <p className="mt-1 text-sm font-semibold leading-tight">{category}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Total
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {formatCardCurrency(total, chatCurrency)}
              </p>
            </div>
          </div>
          <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="mt-3 h-40 w-full aspect-auto">
            <LineChart data={data} margin={{ left: 4, right: 12, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} />
              <YAxis hide domain={[0, 'dataMax']} />
              <ChartTooltip
                cursor={false}
                position={CHAT_TOOLTIP_POSITION}
                wrapperStyle={CHAT_TOOLTIP_WRAPPER_STYLE}
                content={(
                  <ChartTooltipContent
                    className={CHAT_TOOLTIP_CLASS}
                    formatter={(value) => (
                      <>
                        <span className="text-muted-foreground">{category}</span>
                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                          {formatCardCurrency(Number(value), chatCurrency)}
                        </span>
                      </>
                    )}
                  />
                )}
              />
              <Line
                dataKey="amount"
                type="monotone"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
          {peak ? (
            <p className="mt-2 text-xs leading-snug text-muted-foreground">
              Pico: {formatShortMonth(peak.month)} con {formatCardCurrency(peak.amount, chatCurrency)}.
            </p>
          ) : null}
        </div>
      )
    }

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
        <div className="mt-3 rounded-lg bg-primary/10 p-3 text-foreground shadow-[inset_0_0_0_1px_rgba(40,114,68,0.18)] dark:shadow-[inset_0_0_0_1px_rgba(114,215,134,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary">
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
              <p className="mt-1 text-sm font-semibold tabular-nums text-primary">
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

    const maxRecurringAmount = Math.max(...data.map((item) => item.amount), 1)
    const recurringTotal = data.reduce((total, item) => total + item.amount, 0)

    return (
      <div className="mt-3 rounded-lg bg-background/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Patrones recurrentes
            </p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Impacto estimado = veces detectadas por monto promedio.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Top {data.length}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {formatCardCurrency(recurringTotal, chatCurrency)}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          {data.map((item, index) => {
            const width = Math.max(8, Math.round((item.amount / maxRecurringAmount) * 100))

            return (
              <div key={item.description} className="rounded-md bg-card/80 p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight" title={item.description}>
                      {index + 1}. {item.description}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                      {item.count} cargos · prom. {formatCardCurrency(item.averageAmount, chatCurrency)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatCardCurrency(item.amount, chatCurrency)}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${width}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            )
          })}
        </div>
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
    (() => {
      const showConnectPrompt = (!hasTransactions || hasDraftRows) && !hasConnectedInstitution
      const questions = DASHBOARD_CHAT_SUGGESTIONS.slice(0, showConnectPrompt ? 2 : 3)

      return (
        <div
          className={cn(
            'flex min-w-0 max-w-full gap-2',
            isMobile ? '-mx-1 flex-nowrap overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap'
          )}
        >
          {showConnectPrompt ? (
            <PromptSuggestion
              type="button"
              variant="secondary"
              size="sm"
              className={cn('rounded-full', isMobile && 'shrink-0')}
            onClick={() => setActivePage('syncfy')}
            disabled={Boolean(pendingChatAnswer)}
          >
            <Landmark data-icon="inline-start" />
            {hasReconnectRequiredCredential ? 'Reconectar cuenta' : 'Conectar cuenta'}
          </PromptSuggestion>
          ) : null}
          {questions.map((question) => (
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
    })()
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
            className="mt-1 border border-[#2B7AE8]/20 bg-[#2B7AE8]/10 text-blue-700 dark:text-[#9dc2ff]"
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
            {isAssistant ? (
              <MessageResponse>{message.content}</MessageResponse>
            ) : (
              <p>{message.content}</p>
            )}
            {isAssistant ? renderChatChart(message.chart, message.chartCategory) : null}
          </MessageContent>
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
          className="mt-1 border border-[#2B7AE8]/20 bg-[#2B7AE8]/10 text-blue-700 dark:text-[#9dc2ff]"
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

  const renderFinanceChatComposer = () => (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-3">
      {renderDashboardPromptSuggestions()}
      <PromptInput
        value={chatInput}
        onValueChange={setChatInput}
        onSubmit={submitDashboardChatInput}
        isLoading={Boolean(pendingChatAnswer)}
        disabled={Boolean(pendingChatAnswer)}
        className="min-w-0 rounded-[1.65rem] border-border/80 bg-card px-2 py-2 shadow-[0_8px_28px_rgba(16,24,20,0.08)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
      >
        <PromptInputTextarea
          className="max-h-40 min-h-11 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground sm:text-base"
          placeholder="Mensaje a FinovAI"
          disabled={Boolean(pendingChatAnswer)}
        />
        <PromptInputActions className="items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            size="icon"
            className="size-9 rounded-full bg-foreground text-background hover:bg-foreground/85"
            disabled={!chatInput.trim() || Boolean(pendingChatAnswer)}
            aria-label="Enviar mensaje"
            onClick={submitDashboardChatInput}
          >
            {pendingChatAnswer ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </Button>
        </PromptInputActions>
      </PromptInput>
    </div>
  )

  const renderFinanceCockpitHome = () => {
    return (
      <div className="flex h-[calc(100vh-1.5rem)] min-h-[680px] min-w-0 flex-col bg-background sm:h-[calc(100vh-2.5rem)] lg:h-[calc(100vh-3.5rem)]">
        <header className="shrink-0 border-b border-border/70 px-4 py-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-[1000px] items-center">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">Chat financiero</h1>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden" aria-live="polite">
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5">
            {chatMessages.length > 0 ? (
              chatMessages.map((message) => renderDashboardChatMessage(message))
            ) : (
              <div className="flex min-h-[46vh] flex-col items-center justify-center text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-5" />
                </div>
                <h2 className="mt-4 text-2xl font-medium tracking-normal">Pregunta sobre tus finanzas</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Puedo revisar fugas, recurrentes, días atípicos, categorías y ahorro invertible.
                </p>
              </div>
            )}
            {pendingChatAnswer ? renderPendingChatMessage() : null}
            <div ref={chatMessagesEndRef} />
          </div>
        </div>

        <footer className="shrink-0 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          {renderFinanceChatComposer()}
        </footer>
      </div>
    )
  }

  if (activeEmail && !data) {
    return (
      <main className={cn('finovai-dashboard min-h-screen text-foreground', dashboardTheme === 'dark' && 'dark')}>
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
      <main className={cn('finovai-dashboard min-h-screen text-foreground', dashboardTheme === 'dark' && 'dark')}>
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

        <div className="min-h-screen p-3 sm:p-5 lg:p-7">
          <div className={FINANCE_APP_SHELL_CLASS}>
            {renderDashboardRail()}

            <section className={cn('relative min-h-0 min-w-0 bg-background [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', activePage === 'inicio' ? 'overflow-hidden' : 'overflow-y-auto')}>
              <div className={cn('min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:pb-10', activePage === 'inicio' && 'px-0 py-0 sm:px-0 md:px-0 lg:pb-0')}>
                {activePage !== 'inicio' ? (
                  <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h1 className="text-2xl font-semibold tracking-normal">{pageMeta.title}</h1>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {pageMeta.description}
                      </p>
                    </div>
                    {showConnectNudge ? (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={() => setActivePage('syncfy')}>
                          <Landmark data-icon="inline-start" />
                          {hasReconnectRequiredCredential ? 'Reconectar cuenta' : 'Conectar cuenta'}
                        </Button>
                      </div>
                    ) : null}
                  </header>
                ) : null}

              <div className="flex min-w-0 flex-col gap-4">
                {activePage === 'inicio' ? (
                  renderFinanceCockpitHome()
              ) : null}

              {activePage === 'syncfy' ? (
                <SyncfyConnect
                  email={activeEmail}
                  initialCredentials={syncfyCredentials}
                  isLoadingCredentials={isLoadingCredentials}
                  onStatus={setStatus}
                  onCredentialsChange={setSyncfyCredentials}
                  onSynced={(response) => {
                    const nextData = response as DashboardResponse & { credentials?: SyncfyCredential[] }
                    if (Array.isArray(nextData.credentials)) {
                      setSyncfyCredentials(nextData.credentials)
                    }
                    if (Array.isArray(nextData.transactions)) {
                      setData(nextData)
                    }
                  }}
                />
              ) : null}

              {activePage === 'cartola' ? (
              <Card id="cartola-panel" className={FINANCE_ARTIFACT_CARD_CLASS}>
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

                  <div className={FINANCE_ARTIFACT_TILE_CLASS}>
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
                        <span>Confirma solo las filas que quieres guardar.</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              ) : null}

              {activePage === 'cartola' && hasDraftRows ? (
                <Card id="review-panel" className={FINANCE_ARTIFACT_CARD_CLASS}>
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
                    <div className={cn('max-h-[560px] overflow-auto rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]', FINANCE_SCROLLBAR_CLASS)}>
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
                                  className={cn(row.confidence < 0.75 && 'border-amber-500/30 text-amber-700 dark:text-amber-300')}
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
                <Card id="manual-entry" className={FINANCE_ARTIFACT_CARD_CLASS}>
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
                      <div className={cn(FINANCE_ARTIFACT_INSET_CLASS, 'grid grid-cols-2 gap-2 p-1')}>
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

                    <div className={FINANCE_ARTIFACT_INSET_CLASS}>
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
                            <div key={draft.id} className={cn(FINANCE_ARTIFACT_INSET_CLASS, 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3')}>
                              <div className="min-w-0">
                                <p className="text-sm font-medium leading-tight [overflow-wrap:anywhere]">{draft.description || draft.category}</p>
                                <p className="text-xs text-muted-foreground">{draft.date} · {draft.category}</p>
                              </div>
                              <div className="flex items-center gap-2 sm:justify-end">
                                <span className={cn('text-sm font-semibold tabular-nums [overflow-wrap:anywhere]', draft.type === 'income' ? 'text-primary' : 'text-foreground')}>
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
                        <div className="mt-3 rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                          Agrega uno o más movimientos. Luego guárdalos todos.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {activePage === 'movimientos' && hasTransactions ? (
                <Card id="transactions-panel" className={cn(FINANCE_ARTIFACT_CARD_CLASS, '[border-right-width:0]')}>
                  <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Movimientos guardados</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      <div className={FINANCE_ARTIFACT_INSET_CLASS}>
                        <p className="text-sm text-muted-foreground">Gastos</p>
                        <p className={PANEL_VALUE_CLASS}>
                          {formatCardCurrency(summary.monthlySpending, latestCurrency)}
                        </p>
                      </div>
                      <div className={FINANCE_ARTIFACT_INSET_CLASS}>
                        <p className="text-sm text-muted-foreground">Balance</p>
                        <p
                          className={cn(
                            PANEL_VALUE_CLASS,
                            effectiveNetBalance === null || effectiveNetBalance >= 0 ? 'text-primary' : 'text-rose-700 dark:text-rose-300'
                          )}
                        >
                          {effectiveNetBalance === null ? 'Falta ingreso' : formatCardCurrency(effectiveNetBalance, latestCurrency)}
                        </p>
                      </div>
                      <div className={FINANCE_ARTIFACT_INSET_CLASS}>
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
                            {insight.id === 'unusual-day' ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-3"
                                disabled={Boolean(pendingChatAnswer)}
                                onClick={() => analyzeWithFinovAI(`Analiza el día atípico ${insight.value}: ${insight.body}`)}
                              >
                                <Bot data-icon="inline-start" />
                                Analizar con FinovAI
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2">
                      <ReceiptText className="size-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Todas las transacciones</p>
                    </div>

                    <div className={cn('max-h-[560px] overflow-auto rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]', FINANCE_SCROLLBAR_CLASS)}>
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
                              <TableCell className="align-top">
                                <CategorySearchSelect
                                  value={transaction.category}
                                  type={transaction.type}
                                  disabled={updatingCategoryId === transaction.id}
                                  onSelect={(category) => {
                                    void handleTransactionCategoryChange(transaction, category)
                                  }}
                                />
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right font-medium tabular-nums',
                                  transaction.type === 'income' ? 'text-primary' : 'text-foreground'
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
                <Card className={cn(FINANCE_ARTIFACT_CARD_CLASS, 'border-dashed')}>
                  <CardHeader>
                    <CardTitle>Sin transacciones conectadas</CardTitle>
                    <CardDescription>
                      {hasConnectedInstitution
                        ? 'La institución ya está conectada. Todavía no hay movimientos para este historial.'
                        : hasReconnectRequiredCredential
                          ? 'Reconecta la institución para volver a llenar este historial con movimientos reales.'
                        : 'Ve a Conectar cuenta y sigue los pasos para llenar este historial con movimientos reales.'}
                    </CardDescription>
                  </CardHeader>
                  {!hasConnectedInstitution ? (
                    <CardContent>
                      <Button type="button" onClick={() => setActivePage('syncfy')}>
                        <Landmark data-icon="inline-start" />
                        {hasReconnectRequiredCredential ? 'Reconectar cuenta' : 'Conectar cuenta'}
                      </Button>
                    </CardContent>
                  ) : null}
                </Card>
              ) : null}

              {activePage === 'categorias' ? (
                <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                  <CardHeader className="gap-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <CardTitle>Presupuesto vs realidad</CardTitle>
                        <CardDescription>
                          {hasDraftRows
                            ? 'Vista preliminar de movimientos seleccionados.'
                            : `Comparativo de ${categoryPeriodLabel}.`}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {([
                          ['current', 'Este mes'],
                          ['previous', 'Mes anterior'],
                          ['all', 'Todo'],
                        ] as Array<[CategoryPeriodFilter, string]>).map(([value, label]) => (
                          <Button
                            key={value}
                            type="button"
                            size="sm"
                            variant={categoryPeriodFilter === value ? 'default' : 'outline'}
                            disabled={value === 'previous' && !baseCategoryAnalysis.previousPeriod}
                            onClick={() => setCategoryPeriodFilter(value)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {categoryBreakdown.length > 0 ? (
                      <div className="grid gap-4">
                        <div className={cn(FINANCE_ARTIFACT_INSET_CLASS, 'grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center')}>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-tight">{categoryPageAdvice}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {categoryPeriodFilter === 'all'
                                ? 'Los presupuestos se evalúan por mes; esta vista solo resume todo el historial.'
                                : selectedCategoryAnalysis.previousPeriod
                                  ? `Comparado contra ${formatMonth(selectedCategoryAnalysis.previousPeriod)}.`
                                  : 'Aún falta un mes anterior para comparar tendencia.'}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-fit"
                            disabled={Boolean(pendingChatAnswer)}
                            onClick={() => analyzeWithFinovAI(`Analiza mis gastos por categoría de ${categoryPeriodLabel}. ${categoryPageAdvice}`)}
                          >
                            <Bot data-icon="inline-start" />
                            Analizar con FinovAI
                          </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div className={FINANCE_ARTIFACT_TILE_CLASS}>
                            <p className="text-xs font-medium text-muted-foreground">Gasto</p>
                            <p className={PANEL_VALUE_CLASS}>{formatCardCurrency(categoryBreakdownTotal, chatCurrency)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{categoryPeriodLabel}</p>
                          </div>
                          <div className={FINANCE_ARTIFACT_TILE_CLASS}>
                            <p className="text-xs font-medium text-muted-foreground">Presupuesto</p>
                            <p className={PANEL_VALUE_CLASS}>{categoryPeriodFilter === 'all' ? 'Mensual' : categoryBudgetLabel}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {selectedCategoryAnalysis.budgetSource === 'user'
                                ? 'Definido por el usuario'
                                : selectedCategoryAnalysis.budgetSource === 'income_rule'
                                  ? 'Sugerido desde ingreso'
                                  : 'Pendiente en perfil'}
                            </p>
                          </div>
                          <div className={FINANCE_ARTIFACT_TILE_CLASS}>
                            <p className="text-xs font-medium text-muted-foreground">Estado</p>
                            <p className={cn(PANEL_VALUE_CLASS, categoryOverBudgetAmount > 0 ? 'text-rose-500' : 'text-primary')}>
                              {categoryPeriodFilter === 'all'
                                ? dataModeLabel
                                : selectedCategoryAnalysis.budgetTotal
                                  ? categoryOverBudgetAmount > 0
                                    ? `${formatCardCurrency(categoryOverBudgetAmount, chatCurrency)} sobre`
                                    : 'Dentro'
                                  : 'Configurar'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Presupuesto mensual</p>
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
                          <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="h-[320px] w-full aspect-auto">
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
                          <div className="grid gap-3">
                            {categoryPageRows.map((item) => {
                              const Icon = getCategoryIcon(item.category)
                              const comparison = selectedCategoryAnalysis.categories.find((category) => category.category === item.category)
                              const status = categoryPeriodFilter === 'all' ? 'unset' : comparison?.budgetStatus || 'unset'

                              return (
                                <div key={item.category} className={FINANCE_ARTIFACT_TILE_CLASS}>
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background" style={{ color: item.fill }}>
                                        <Icon className="size-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="min-w-0 text-sm font-medium leading-tight [overflow-wrap:anywhere]">{item.category}</p>
                                        {comparison && categoryPeriodFilter !== 'all' ? (
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {comparison.deltaFromPrevious >= 0 ? '+' : ''}{formatCardCurrency(comparison.deltaFromPrevious, chatCurrency)} vs mes anterior
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="text-left sm:text-right">
                                      <p className="text-sm font-semibold tabular-nums [overflow-wrap:anywhere]">
                                        {formatCardCurrency(item.amount, chatCurrency)}
                                      </p>
                                      <Badge className={cn('mt-1', getBudgetStatusClass(status))} variant="outline">
                                        {getBudgetStatusLabel(status)}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/60">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${Math.max(6, item.share)}%`, backgroundColor: item.fill }}
                                    />
                                  </div>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {categoryPeriodFilter === 'all'
                                      ? `${item.share}% del gasto total`
                                      : comparison?.advice || `${item.share}% del gasto mensual`}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {selectedCategoryAnalysis.monthRows.length > 0 ? (
                          <div className={FINANCE_ARTIFACT_TILE_CLASS}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">Meses</p>
                                <p className="text-xs text-muted-foreground">Gasto, categoría principal y diferencia contra el mes anterior.</p>
                              </div>
                              <SlidersHorizontal className="size-4 text-muted-foreground" />
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Mes</TableHead>
                                  <TableHead>Gasto</TableHead>
                                  <TableHead>Mayor categoría</TableHead>
                                  <TableHead>Vs anterior</TableHead>
                                  <TableHead>Presupuesto</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedCategoryAnalysis.monthRows.slice(0, 6).map((row) => (
                                  <TableRow key={row.month}>
                                    <TableCell className="font-medium">{formatMonth(row.month)}</TableCell>
                                    <TableCell className="tabular-nums">{formatCardCurrency(row.spendingTotal, chatCurrency)}</TableCell>
                                    <TableCell>{row.topCategory}</TableCell>
                                    <TableCell className={cn('tabular-nums', row.deltaFromPrevious && row.deltaFromPrevious > 0 ? 'text-rose-500' : 'text-primary')}>
                                      {row.deltaFromPrevious === null ? 'Sin base' : `${row.deltaFromPrevious >= 0 ? '+' : ''}${formatCardCurrency(row.deltaFromPrevious, chatCurrency)}`}
                                    </TableCell>
                                    <TableCell>
                                      <Badge className={getBudgetStatusClass(row.status)} variant="outline">
                                        {row.budgetTotal ? formatCardCurrency(row.budgetTotal, chatCurrency) : 'Pendiente'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
                        {hasConnectedInstitution
                          ? 'Aún no hay gastos para agrupar. Todavía no hay movimientos disponibles.'
                          : hasReconnectRequiredCredential
                            ? 'Aún no hay gastos para agrupar. Reconecta la institución para traer transacciones.'
                          : 'Aún no hay gastos para agrupar. Conecta una cuenta para traer transacciones.'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {activePage === 'analisis' ? (
                <div className="grid gap-4">
                  <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle>Resumen del mes</CardTitle>
                        <CardDescription>
                          {formatMonth(chatSummary.month)} · {dataModeLabel} · {chatDataCoverageLabel}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={chatTransactions.length > 0 ? 'secondary' : 'outline'}>
                          {chatTransactions.length} movimientos
                        </Badge>
                        {chatTransactions.length > 0 ? (
                          <Badge variant={chatSummary.dataCoverage.preliminary ? 'outline' : 'secondary'}>
                            {chatDataCoverageQualifier}
                          </Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      <div className={FINANCE_ARTIFACT_TILE_CLASS}>
                        <p className="text-sm text-muted-foreground">Gasto total</p>
                        <p className={PANEL_VALUE_CLASS}>
                          {formatCardCurrency(chatSummary.monthlySpending, chatCurrency)}
                        </p>
                      </div>
                      <div className={FINANCE_ARTIFACT_TILE_CLASS}>
                        <p className="text-sm text-muted-foreground">Mayor categoría</p>
                        <p className="mt-2 text-lg font-semibold leading-tight [overflow-wrap:anywhere]">{chatSummary.topSpendingCategory}</p>
                      </div>
                      <div className="rounded-2xl bg-primary/10 p-4 text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                        <p className="text-sm text-primary">Ahorro posible</p>
                        <p className={PANEL_VALUE_CLASS}>
                          {formatCardCurrency(chatSummary.estimatedSavingsOpportunity, chatCurrency)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {renderActionPlanPanel()}

                  {hasChartData ? (
                    <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
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
                    <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                      <CardHeader>
                        <CardTitle>Día raro</CardTitle>
                        <CardDescription>El día con mayor salida detectada.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {chatSummary.unusualHighSpendDay ? (
                          <div className={FINANCE_ARTIFACT_TILE_CLASS}>
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

                    <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                      <CardHeader>
                        <CardTitle>Recurrentes</CardTitle>
                        <CardDescription>Cargos parecidos que se repiten.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-2">
                        {chatSummary.recurringExpenses.length > 0 ? (
                          chatSummary.recurringExpenses.slice(0, 3).map((expense) => (
                            <div key={expense.key} className={cn(FINANCE_ARTIFACT_INSET_CLASS, 'flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3')}>
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

                  <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                    <CardHeader>
                      <CardTitle>Movimientos grandes</CardTitle>
                      <CardDescription>Los mayores gastos del mes.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      {topAnalysisTransactions.length > 0 ? (
                        topAnalysisTransactions.map((transaction) => (
                          <div key={`${transaction.date}-${transaction.description}-${transaction.amount}`} className={cn(FINANCE_ARTIFACT_INSET_CLASS, 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3')}>
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
                        <p className="text-sm text-muted-foreground">
                          {hasConnectedInstitution
                            ? 'Todavía no hay movimientos disponibles para generar análisis.'
                            : hasReconnectRequiredCredential
                              ? 'Reconecta la institución para generar análisis.'
                            : 'Conecta una cuenta para generar análisis.'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {activePage === 'ajustes' ? (
                <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                  <CardHeader>
                    <CardTitle>Perfil financiero</CardTitle>
                    <CardDescription>
                      Preferencias de cuenta, acceso compartido y controles de datos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className={FINANCE_ARTIFACT_TILE_CLASS}>
                        <p className="text-sm text-muted-foreground">Correo</p>
                        <p className="mt-1 break-all text-sm font-medium">{activeEmail}</p>
                      </div>
                      <div className={FINANCE_ARTIFACT_TILE_CLASS}>
                        <p className="text-sm text-muted-foreground">Moneda</p>
                        <p className="mt-1 text-sm font-medium">{chatCurrency}</p>
                      </div>
                      <div className={FINANCE_ARTIFACT_TILE_CLASS}>
                        <p className="text-sm text-muted-foreground">Cuenta compartida</p>
                        <p className="mt-1 text-sm font-medium">
                          {householdInvites.length > 0 ? `${householdInvites.length} invitación${householdInvites.length === 1 ? '' : 'es'}` : 'Sin invitaciones'}
                        </p>
                      </div>
                    </div>

                    <form className={cn(FINANCE_ARTIFACT_TILE_CLASS, 'overflow-hidden p-0')} onSubmit={handleProfileSubmit}>
                      <div className="border-b border-border/70 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <WalletCards className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">Ingreso y presupuesto</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Define tu marco mensual y topes por categoría.
                              </p>
                            </div>
                          </div>
                          <Badge className={cn(savedMonthlyBudget > 0 ? 'border-primary/25 bg-primary/10 text-primary' : 'border-border/70 bg-secondary text-muted-foreground')} variant="outline">
                            {savedMonthlyBudget > 0 ? 'Presupuesto activo' : 'Pendiente'}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-3 p-4 md:grid-cols-3">
                        <div className="rounded-2xl bg-background/60 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                          <p className="text-xs font-medium text-muted-foreground">Ingreso mensual</p>
                          <p className="mt-2 text-lg font-semibold tabular-nums [overflow-wrap:anywhere]">
                            {chatProfile.monthlyIncome ? formatCardCurrency(chatProfile.monthlyIncome, chatCurrency) : 'Sin dato'}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-background/60 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                          <p className="text-xs font-medium text-muted-foreground">Presupuesto mensual</p>
                          <p className="mt-2 text-lg font-semibold tabular-nums [overflow-wrap:anywhere]">
                            {savedMonthlyBudget > 0 ? formatCardCurrency(savedMonthlyBudget, chatCurrency) : 'Sin tope'}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-background/60 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                          <p className="text-xs font-medium text-muted-foreground">Margen del mes</p>
                          <p className={cn('mt-2 text-lg font-semibold tabular-nums [overflow-wrap:anywhere]', budgetRunwayAmount !== null && budgetRunwayAmount < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-primary')}>
                            {budgetRunwayAmount === null ? 'Sin base' : formatCardCurrency(budgetRunwayAmount, chatCurrency)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 border-t border-border/70 p-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
                        <div className="grid gap-3 content-start">
                          <div className="flex min-w-0 flex-col gap-2">
                            <Label htmlFor="monthly-income">Ingreso mensual</Label>
                            <Input
                              id="monthly-income"
                              inputMode="decimal"
                              value={profileForm.monthlyIncome}
                              onChange={(event) => setProfileForm((current) => ({ ...current, monthlyIncome: event.target.value }))}
                              placeholder="52000"
                            />
                          </div>
                          <div className="flex min-w-0 flex-col gap-2">
                            <Label htmlFor="monthly-budget">Presupuesto mensual</Label>
                            <Input
                              id="monthly-budget"
                              inputMode="decimal"
                              value={profileForm.monthlyBudget}
                              onChange={(event) => setProfileForm((current) => ({ ...current, monthlyBudget: event.target.value }))}
                              placeholder="39000"
                            />
                          </div>
                          <div className="rounded-2xl bg-background/60 p-3 text-sm text-muted-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                            <p className="font-medium text-foreground">Categorías cubiertas</p>
                            <p className="mt-1">
                              {savedCategoryBudgetEntries.length > 0
                                ? `${savedCategoryBudgetEntries.length} topes por ${formatCardCurrency(savedCategoryBudgetTotal, chatCurrency)}${budgetCoveragePercent !== null ? ` (${budgetCoveragePercent}%)` : ''}.`
                                : 'Aún no hay topes por categoría.'}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                              <p className="text-sm font-medium">Topes por categoría</p>
                              <p className="text-xs text-muted-foreground">Úsalos para detectar sobrepresupuesto en Categorías.</p>
                            </div>
                            <p className="text-xs font-medium text-muted-foreground">
                              {savedCategoryBudgetTotal > 0 ? formatCardCurrency(savedCategoryBudgetTotal, chatCurrency) : 'Sin topes'}
                            </p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {EXPENSE_CATEGORIES.map((category) => (
                              <div key={category} className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-background/60 p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                                <Label htmlFor={`budget-${category}`} className="truncate text-xs text-muted-foreground">
                                  {category}
                                </Label>
                                <Input
                                  id={`budget-${category}`}
                                  inputMode="decimal"
                                  value={categoryBudgetInputs[category] || ''}
                                  onChange={(event) => setCategoryBudgetInputs((current) => ({
                                    ...current,
                                    [category]: event.target.value,
                                  }))}
                                  placeholder="0"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 p-4">
                        <p className="text-xs text-muted-foreground">
                          {savedMonthlyBudget > 0
                            ? `Tope actual: ${formatCardCurrency(savedMonthlyBudget, chatCurrency)}`
                            : 'Guarda ingreso y presupuesto para activar comparativas.'}
                        </p>
                        <Button type="submit" disabled={isSavingProfile}>
                          {isSavingProfile ? <Loader2 className="size-4 animate-spin" /> : <Check data-icon="inline-start" />}
                          Guardar presupuesto
                        </Button>
                      </div>
                    </form>

                    <form className={FINANCE_ARTIFACT_TILE_CLASS} onSubmit={handleInviteSpouse}>
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-start">
                        <div className="flex items-start gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <UserPlus className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">Invitar pareja</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Enviaremos un correo a la dirección indicada y dejaremos la invitación en estado pendiente.
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <div className="flex min-w-0 flex-col gap-2">
                              <Label htmlFor="spouse-email">Correo de tu pareja</Label>
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
                              Enviar invitación
                            </Button>
                          </div>

                          {householdInvites.length > 0 ? (
                            <div className="grid gap-2">
                              {householdInvites.map((invite) => (
                                <div key={invite.id} className={cn(FINANCE_ARTIFACT_INSET_CLASS, 'grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center')}>
                                  <div className="min-w-0">
                                    <p className="min-w-0 break-all text-sm font-medium">{invite.inviteeEmail}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(invite.created_at.slice(0, 10))}</p>
                                  </div>
                                  <Badge className="w-fit" variant="outline">
                                    {invite.status === 'pending' ? 'Pendiente' : invite.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
                              Todavía no hay invitaciones enviadas.
                            </div>
                          )}
                        </div>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : null}
            </div>
            </div>
          </section>

          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={cn('finovai-dashboard min-h-screen text-foreground', dashboardTheme === 'dark' && 'dark')}>
      <div className="min-h-screen p-3 sm:p-5 lg:p-7">
        <div className={FINANCE_APP_SHELL_CLASS}>
          <aside className="flex min-w-0 items-center justify-between gap-3 border-b border-border/70 bg-background px-3 py-2 md:h-full md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-2 md:py-4">
            <button
              type="button"
              className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-0 text-foreground transition-colors hover:bg-secondary md:w-full md:justify-start md:px-2"
              aria-label="FinovAI"
              title="FinovAI"
              onClick={onBackHome}
            >
              <DashboardBrandWordmark />
            </button>

            <div className="flex items-center gap-1 md:flex-col">
              <button
                type="button"
                aria-label={dashboardTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                title={dashboardTheme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                onClick={toggleDashboardTheme}
              >
                {dashboardTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <button
                type="button"
                aria-label="Volver"
                title="Volver"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                onClick={onBackHome}
              >
                <ArrowLeft className="size-4" />
              </button>
            </div>
          </aside>

          <section className="relative min-w-0 bg-background">
            <div className="mx-auto flex min-h-full w-full max-w-[1080px] flex-col justify-center gap-8 px-4 py-8 sm:px-6 lg:py-12">
              <header className="flex flex-col gap-3">
                <Badge variant="secondary" className="w-fit">México y LATAM</Badge>
                <div>
                  <h1 className="text-3xl font-medium tracking-normal sm:text-4xl">Finanzas</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Entra para conectar bancos, SAT, Bitso, American Express y fuentes compatibles.
                  </p>
                </div>
              </header>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                  <CardHeader>
                    <CardTitle>Entrar a FinovAI</CardTitle>
                    <CardDescription>
                      Usa tu correo para activar el análisis de fugas, patrones y ahorro invertible.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      className={cn(
                        'grid gap-3',
                        pendingLoginEmail
                          ? 'sm:grid-cols-[minmax(0,1fr)_minmax(120px,0.42fr)_auto]'
                          : 'sm:grid-cols-[minmax(0,1fr)_auto]'
                      )}
                      onSubmit={handleIdentify}
                    >
                      <div className="flex min-w-0 flex-col gap-2">
                        <Label htmlFor="dashboard-auth-email">Correo</Label>
                        <Input
                          id="dashboard-auth-email"
                          type="email"
                          value={emailInput}
                          onChange={(event) => {
                            setEmailInput(event.target.value)
                            setPendingLoginEmail('')
                            setLoginCode('')
                          }}
                          placeholder="tu@email.com"
                          autoComplete="email"
                        />
                      </div>
                      {pendingLoginEmail ? (
                        <div className="flex min-w-0 flex-col gap-2">
                          <Label htmlFor="dashboard-auth-code">Código</Label>
                          <Input
                            id="dashboard-auth-code"
                            inputMode="numeric"
                            value={loginCode}
                            onChange={(event) => setLoginCode(event.target.value)}
                            placeholder="000000"
                            autoComplete="one-time-code"
                          />
                        </div>
                      ) : null}
                      <Button type="submit" className="self-end rounded-full px-5" disabled={isLoading}>
                        {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                        {pendingLoginEmail ? 'Verificar' : 'Continuar'}
                      </Button>
                    </form>
                    <p className={cn(FINANCE_ARTIFACT_INSET_CLASS, 'mt-4 text-sm leading-relaxed text-muted-foreground')} role="status">
                      {status}
                    </p>
                  </CardContent>
                </Card>

                <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                  <CardHeader>
                    <CardTitle>Fuentes compatibles</CardTitle>
                    <CardDescription>
                      Lectura financiera para cuentas personales y de pareja.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {[
                      { label: 'Bancos', body: 'Movimientos y saldos conectados.', icon: Landmark },
                      { label: 'SAT', body: 'Señales fiscales para contexto.', icon: FileSearch },
                      { label: 'Bitso', body: 'Actividad cripto conectada.', icon: WalletCards },
                    ].map((item) => {
                      const Icon = item.icon

                      return (
                        <div key={item.label} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl bg-secondary/45 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                          <div className="flex size-8 items-center justify-center rounded-full bg-background text-primary">
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
