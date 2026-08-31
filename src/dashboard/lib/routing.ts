import {
  Bot,
  ChartPie,
  Landmark,
  ReceiptText,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type DashboardPage = 'inicio' | 'syncfy' | 'movimientos' | 'categorias' | 'analisis' | 'ajustes'

export const DASHBOARD_PAGES: Array<{ id: DashboardPage; label: string; icon: LucideIcon }> = [
  { id: 'inicio', label: 'Chat', icon: Bot },
  { id: 'syncfy', label: 'Conectar cuenta', icon: Landmark },
  { id: 'movimientos', label: 'Movimientos', icon: ReceiptText },
  { id: 'categorias', label: 'Categorías', icon: ChartPie },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
]

export const DASHBOARD_PAGE_PATHS: Record<DashboardPage, string> = {
  inicio: '/dashboard',
  syncfy: '/connect',
  movimientos: '/movements',
  categorias: '/categories',
  analisis: '/analysis',
  ajustes: '/settings',
}

export const LEGACY_DASHBOARD_PAGE_PATHS: Partial<Record<string, DashboardPage>> = {
  '/dashboard/connect': 'syncfy',
  '/dashboard/movements': 'movimientos',
  '/dashboard/movement': 'movimientos',
  '/dashboard/categories': 'categorias',
  '/dashboard/category': 'categorias',
  '/dashboard/analysis': 'analisis',
  '/dashboard/settings': 'ajustes',
  '/movement': 'movimientos',
  '/category': 'categorias',
}

export const PAGE_META: Record<DashboardPage, { title: string; description: string }> = {
  inicio: {
    title: 'Chat financiero',
    description: 'Pregunta sobre tus movimientos, fugas, patrones y ahorro posible.',
  },
  syncfy: {
    title: 'Conectar cuenta',
    description: 'Vincula bancos, SAT, Bitso, American Express y fuentes compatibles.',
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

export function normalizeDashboardPath(path: string | null | undefined): string {
  const normalizedPath = (path || '/dashboard').replace(/\/+$/, '') || '/dashboard'
  return normalizedPath
}

export function getDashboardPageFromPath(path: string | null | undefined): DashboardPage {
  const normalizedPath = normalizeDashboardPath(path)
  const match = (Object.entries(DASHBOARD_PAGE_PATHS) as Array<[DashboardPage, string]>)
    .find(([, pagePath]) => pagePath === normalizedPath)

  return match?.[0] || LEGACY_DASHBOARD_PAGE_PATHS[normalizedPath] || 'inicio'
}

export function shouldCanonicalizeDashboardPath(path: string | null | undefined): boolean {
  return Boolean(LEGACY_DASHBOARD_PAGE_PATHS[normalizeDashboardPath(path)])
}
