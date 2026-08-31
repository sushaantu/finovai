import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { Bot, PiggyBank, SlidersHorizontal } from 'lucide-react'

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
} from '@/components/ui/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { CategoryPeriodFilter } from '../lib/types'
import {
  FINANCE_ARTIFACT_CARD_CLASS,
  FINANCE_ARTIFACT_INSET_CLASS,
  FINANCE_ARTIFACT_TILE_CLASS,
  FINANCE_SCROLLBAR_CLASS,
  PANEL_VALUE_CLASS,
  SINGLE_VALUE_CHART_CONFIG,
} from '../lib/styles'
import {
  formatCardCurrency,
  formatMonth,
  getBudgetStatusClass,
  getBudgetStatusLabel,
  getCategoryIcon,
} from '../lib/format'
import { useDashboardModel, type DashboardModelOptions } from '../lib/use-dashboard-model'

interface CategoriesPageProps {
  email: string
  modelOptions: DashboardModelOptions
  categoryPeriodFilter: CategoryPeriodFilter
  onCategoryPeriodFilterChange: (filter: CategoryPeriodFilter) => void
  onAnalyze: (question: string) => void
  isChatPending: boolean
}

export function CategoriesPage({
  email,
  modelOptions,
  categoryPeriodFilter,
  onCategoryPeriodFilterChange,
  onAnalyze,
  isChatPending,
}: CategoriesPageProps) {
  const {
    baseCategoryAnalysis,
    categoryBreakdown,
    categoryBreakdownTotal,
    categoryBudgetLabel,
    categoryChartData,
    categoryOverBudgetAmount,
    categoryPageAdvice,
    categoryPageRows,
    categoryPeriodLabel,
    chatCurrency,
    dataModeLabel,
    hasConnectedInstitution,
    hasReconnectRequiredCredential,
    investmentCategoryAmount,
    investmentCategoryBudget,
    investmentCategoryPrompt,
    investmentCategoryShare,
    investmentCategoryStatus,
    selectedCategoryAnalysis,
  } = useDashboardModel(email, modelOptions)

  return (
    <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
      <CardHeader className="gap-4">
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <CardTitle>Presupuesto vs realidad</CardTitle>
            <CardDescription>
              {`Comparativo de ${categoryPeriodLabel}.`}
            </CardDescription>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
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
                onClick={() => onCategoryPeriodFilterChange(value)}
                className="min-w-0"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        {categoryBreakdown.length > 0 ? (
          <div className="grid min-w-0 gap-4">
            <div className={cn(FINANCE_ARTIFACT_INSET_CLASS, 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center')}>
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
                className="w-full justify-center sm:w-fit"
                disabled={isChatPending}
                onClick={() => onAnalyze(`Analiza mis gastos por categoría de ${categoryPeriodLabel}. ${categoryPageAdvice}`)}
              >
                <Bot data-icon="inline-start" />
                Analizar con FinovAI
              </Button>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

            <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
              <ChartContainer
                config={SINGLE_VALUE_CHART_CONFIG}
                className="h-[300px] w-full min-w-0 max-w-full aspect-auto"
                initialDimension={{ width: 260, height: 220 }}
              >
                <BarChart data={categoryChartData} layout="vertical" margin={{ left: 8, right: 18, top: 8, bottom: 8 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="label"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    width={104}
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
              <div className="grid min-w-0 gap-3">
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
                        <div className="min-w-0 text-left sm:text-right">
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
              <div className={cn(FINANCE_ARTIFACT_TILE_CLASS, 'overflow-hidden')}>
                <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Meses</p>
                    <p className="text-xs text-muted-foreground">Gasto, categoría principal y diferencia contra el mes anterior.</p>
                  </div>
                  <SlidersHorizontal className="size-4 text-muted-foreground" />
                </div>
                <div className="grid gap-2 xl:hidden">
                  {selectedCategoryAnalysis.monthRows.slice(0, 6).map((row) => (
                    <div key={row.month} className="min-w-0 rounded-xl bg-background/55 p-3">
                      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight">{formatMonth(row.month)}</p>
                          <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                            Mayor categoría: {row.topCategory}
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-right">
                          {formatCardCurrency(row.spendingTotal, chatCurrency)}
                        </p>
                      </div>
                      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className={cn('tabular-nums', row.deltaFromPrevious && row.deltaFromPrevious > 0 ? 'text-rose-500' : 'text-primary')}>
                          {row.deltaFromPrevious === null ? 'Sin base' : `${row.deltaFromPrevious >= 0 ? '+' : ''}${formatCardCurrency(row.deltaFromPrevious, chatCurrency)}`}
                        </span>
                        <Badge className={getBudgetStatusClass(row.status)} variant="outline">
                          {row.budgetTotal ? formatCardCurrency(row.budgetTotal, chatCurrency) : 'Pendiente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={cn('hidden overflow-x-auto xl:block', FINANCE_SCROLLBAR_CLASS)}>
                  <Table className="min-w-[640px]">
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

        <div className={cn(FINANCE_ARTIFACT_TILE_CLASS, 'border border-primary/15 bg-primary/5')}>
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)] xl:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PiggyBank className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold leading-tight">Inversión</p>
                  <Badge className={investmentCategoryAmount > 0 ? 'border-primary/25 bg-primary/10 text-primary' : 'border-border/70 bg-secondary text-muted-foreground'} variant="outline">
                    {investmentCategoryAmount > 0 ? 'Con movimientos' : 'Categoría disponible'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Separa aportaciones, Bitso, CETES, GBM o fondos para no mezclarlos con gasto corriente.
                </p>
              </div>
            </div>

            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              <div className="min-w-0 rounded-lg bg-background/55 p-3">
                <p className="text-xs font-medium text-muted-foreground">Registrado</p>
                <p className="mt-1 text-sm font-semibold tabular-nums [overflow-wrap:anywhere]">
                  {formatCardCurrency(investmentCategoryAmount, chatCurrency)}
                </p>
              </div>
              <div className="min-w-0 rounded-lg bg-background/55 p-3">
                <p className="text-xs font-medium text-muted-foreground">Peso</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {investmentCategoryShare > 0 ? `${investmentCategoryShare}%` : 'Sin uso'}
                </p>
              </div>
              <div className="min-w-0 rounded-lg bg-background/55 p-3">
                <p className="text-xs font-medium text-muted-foreground">Tope</p>
                <p className="mt-1 text-sm font-semibold tabular-nums [overflow-wrap:anywhere]">
                  {investmentCategoryBudget ? formatCardCurrency(investmentCategoryBudget, chatCurrency) : 'Opcional'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Estado: {getBudgetStatusLabel(investmentCategoryStatus)}.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-center sm:w-fit"
              disabled={isChatPending}
              onClick={() => onAnalyze(investmentCategoryPrompt)}
            >
              <Bot data-icon="inline-start" />
              Analizar inversión
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
