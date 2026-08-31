import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'

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
import { cn } from '@/lib/utils'
import { DEFAULT_INVESTMENT_ASSUMPTION, type FinanceActionPlan } from '@finovai/core'
import {
  CASHFLOW_CHART_CONFIG,
  FINANCE_ARTIFACT_CARD_CLASS,
  FINANCE_ARTIFACT_INSET_CLASS,
  FINANCE_ARTIFACT_TILE_CLASS,
  PANEL_VALUE_CLASS,
} from '../lib/styles'
import { formatCardCurrency, formatDate, formatMonth } from '../lib/format'
import { useDashboardModel, type DashboardModelOptions } from '../lib/use-dashboard-model'

interface AnalysisPageProps {
  email: string
  modelOptions: DashboardModelOptions
  onActionPlanTarget: (target: FinanceActionPlan['nextActions'][number]['target']) => void
  isChatPending: boolean
}

export function AnalysisPage({ email, modelOptions, onActionPlanTarget, isChatPending }: AnalysisPageProps) {
  const {
    actionPlan,
    cashflowChartData,
    chatCurrency,
    chatDataCoverageLabel,
    chatDataCoverageQualifier,
    chatSummary,
    chatTransactions,
    dataModeLabel,
    hasChartData,
    hasTransactions,
    hasConnectedInstitution,
    hasReconnectRequiredCredential,
    hasSupportIssueCredential,
    hasUnresolvedCredential,
    topAnalysisTransactions,
  } = useDashboardModel(email, modelOptions)

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
            label: 'Actualizar acceso',
            body: 'La institución rechazó el acceso guardado. Actualízalo para continuar.',
            target: 'connect',
          } satisfies FinanceActionPlan['nextActions'][number]
        : hasUnresolvedCredential
          ? {
            id: 'review-connection',
            label: 'Revisar conexión',
            body: hasSupportIssueCredential
              ? 'Consulta el motivo y comparte el código de soporte con FinovAI.'
              : 'Consulta el estado, el motivo y el próximo paso de la institución.',
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
                onClick={() => onActionPlanTarget(action.target)}
                disabled={isChatPending && (action.target === 'chat' || action.target === 'partner')}
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

  return (
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
  )
}
