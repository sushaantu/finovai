import { useState, type FormEvent } from 'react'
import {
  Bot,
  Check,
  Landmark,
  Loader2,
  Plus,
  ReceiptText,
  Trash2,
  TrendingDown,
  TrendingUp,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  DEFAULT_FINANCE_CURRENCY,
  getFinanceCategoriesForType,
  type FinanceTransaction,
} from '@finovai/core'
import { useSaveManualTransaction, useUpdateTransactionCategory } from '@finovai/core/react'
import { CategorySearchSelect } from '../components/CategorySearchSelect'
import type { DashboardPage } from '../lib/routing'
import type { ManualDraft, ManualForm } from '../lib/types'
import {
  FINANCE_ARTIFACT_CARD_CLASS,
  FINANCE_ARTIFACT_INSET_CLASS,
  FINANCE_SCROLLBAR_CLASS,
  PANEL_VALUE_CLASS,
} from '../lib/styles'
import { createManualForm } from '../lib/constants'
import {
  formatCardCurrency,
  formatCurrency,
  formatDate,
  formatTransactionSource,
  getInsightToneClasses,
} from '../lib/format'
import { useDashboardModel, type DashboardModelOptions } from '../lib/use-dashboard-model'

interface MovementsPageProps {
  email: string
  modelOptions: DashboardModelOptions
  onStatus: (message: string) => void
  onNavigate: (page: DashboardPage) => void
  onAnalyze: (question: string) => void
  isChatPending: boolean
}

export function MovementsPage({
  email,
  modelOptions,
  onStatus,
  onNavigate,
  onAnalyze,
  isChatPending,
}: MovementsPageProps) {
  const {
    connectActionLabel,
    effectiveNetBalance,
    hasConnectedInstitution,
    hasProviderIssueCredential,
    hasReconnectRequiredCredential,
    hasSupportIssueCredential,
    hasVerifyingCredential,
    insights,
    hasTransactions,
    latestCurrency,
    summary,
    transactions,
  } = useDashboardModel(email, modelOptions)

  const [manualForm, setManualForm] = useState<ManualForm>(() => createManualForm())
  const [manualDrafts, setManualDrafts] = useState<ManualDraft[]>([])

  const saveManualTransaction = useSaveManualTransaction(email)
  const updateCategory = useUpdateTransactionCategory(email)
  const isSaving = saveManualTransaction.isPending
  const updatingCategoryId = updateCategory.isPending
    ? updateCategory.variables?.transactionId ?? null
    : null

  const activeEmail = email
  const setStatus = onStatus
  const setActivePage = onNavigate
  const categories = getFinanceCategoriesForType(manualForm.type)

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
    try {
      // Sequential on purpose: the worker recomputes the summary per insert.
      for (const draft of draftsToSave) {
        await saveManualTransaction.mutateAsync({
          date: draft.date,
          type: draft.type,
          amount: draft.amount,
          currency: DEFAULT_FINANCE_CURRENCY,
          category: draft.category,
          description: draft.description,
          merchant: draft.merchant,
          notes: draft.notes,
        })
      }

      setManualDrafts([])
      setStatus(`${draftsToSave.length} ${draftsToSave.length === 1 ? 'movimiento guardado' : 'movimientos guardados'}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos guardar los movimientos.')
    }
  }

  const handleTransactionCategoryChange = async (transaction: FinanceTransaction, category: string) => {
    if (!activeEmail || category === transaction.category || updatingCategoryId) return

    try {
      const response = await updateCategory.mutateAsync({ transactionId: transaction.id, category })
      setStatus(response.message || `Categoría actualizada a ${category}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos actualizar la categoría.')
    }
  }

  return (
    <>
      {manualDrafts.length > 0 ? (
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

      {hasTransactions ? (
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
                        disabled={isChatPending}
                        onClick={() => onAnalyze(`Analiza el día atípico ${insight.value}: ${insight.body}`)}
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

      {!hasTransactions ? (
        <Card className={cn(FINANCE_ARTIFACT_CARD_CLASS, 'border-dashed')}>
          <CardHeader>
            <CardTitle>Sin transacciones conectadas</CardTitle>
            <CardDescription>
              {hasConnectedInstitution
                ? 'La institución ya está conectada. Todavía no hay movimientos para este historial.'
                : hasReconnectRequiredCredential
                  ? 'La institución rechazó el acceso. Actualízalo para volver a importar movimientos.'
                  : hasSupportIssueCredential
                    ? 'La conexión necesita revisión de FinovAI. Consulta y comparte el código de soporte.'
                  : hasProviderIssueCredential
                    ? 'La institución está fallando temporalmente. Revisa el detalle y el código de soporte.'
                    : hasVerifyingCredential
                      ? 'La credencial está guardada, pero la institución todavía está verificando el acceso.'
                      : 'Ve a Conectar cuenta y sigue los pasos para llenar este historial con movimientos reales.'}
            </CardDescription>
          </CardHeader>
          {!hasConnectedInstitution ? (
            <CardContent>
              <Button type="button" onClick={() => setActivePage('syncfy')}>
                <Landmark data-icon="inline-start" />
                {connectActionLabel}
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </>
  )
}
