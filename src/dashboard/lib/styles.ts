import type { CSSProperties } from 'react'
import type { ChartConfig } from '@/components/ui/chart'

export const PANEL_VALUE_CLASS = 'mt-2 min-w-0 text-lg font-semibold leading-tight tracking-normal tabular-nums [overflow-wrap:anywhere]'

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)',
]

export const FINANCE_APP_SHELL_CLASS = 'mx-auto grid h-[calc(100vh-1.5rem)] w-full max-w-[1760px] overflow-hidden rounded-[1.85rem] border border-border/70 bg-background shadow-[0_30px_90px_rgba(10,22,40,0.14)] sm:h-[calc(100vh-2.5rem)] md:grid-cols-[236px_minmax(0,1fr)] lg:h-[calc(100vh-3.5rem)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)]'

export const FINANCE_ARTIFACT_CARD_CLASS = 'min-w-0 rounded-[1.45rem] border-border/70 bg-card py-5 shadow-[0_16px_45px_rgba(20,33,27,0.06)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.26)]'

export const FINANCE_ARTIFACT_INSET_CLASS = 'min-w-0 rounded-2xl bg-secondary/45 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]'

export const FINANCE_ARTIFACT_TILE_CLASS = 'min-w-0 rounded-2xl bg-secondary/45 p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]'

export const FINANCE_SCROLLBAR_CLASS = 'finovai-scrollbar [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/40'

export const CASHFLOW_CHART_CONFIG = {
  spending: {
    label: 'Gastos',
    color: 'var(--chart-1)',
  },
  income: {
    label: 'Ingresos',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

export const SINGLE_VALUE_CHART_CONFIG = {
  amount: {
    label: 'Monto',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export const CHAT_TOOLTIP_POSITION = { x: 8, y: 8 }

export const CHAT_TOOLTIP_WRAPPER_STYLE: CSSProperties = {
  maxWidth: 'calc(100% - 16px)',
  pointerEvents: 'none',
  zIndex: 30,
}

export const CHAT_TOOLTIP_CLASS = 'min-w-0 max-w-48 whitespace-normal break-words'
