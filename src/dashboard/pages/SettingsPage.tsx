import { useEffect, useState, type FormEvent } from 'react'
import { Check, Loader2, Mail, UserPlus, WalletCards } from 'lucide-react'

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
import { cn } from '@/lib/utils'
import type { DashboardResponse, FinancialProfile } from '@finovai/core'
import { EXPENSE_CATEGORIES, buildCategoryAnalysis } from '@finovai/core'
import { useInviteSpouse, useSaveProfile } from '@finovai/core/react'
import {
  FINANCE_ARTIFACT_CARD_CLASS,
  FINANCE_ARTIFACT_INSET_CLASS,
  FINANCE_ARTIFACT_TILE_CLASS,
} from '../lib/styles'
import { formatCardCurrency, formatDate, moneyInputValue, parseMoneyInput } from '../lib/format'
import type { ProfileForm } from '../lib/types'
import { createPreviewDashboardResponse } from '../lib/preview'
import { useDashboardModel, type DashboardModelOptions } from '../lib/use-dashboard-model'

interface SettingsPageProps {
  email: string
  modelOptions: DashboardModelOptions
  onStatus: (message: string) => void
  renderQueryErrorNotice: (message: string, onRetry: () => void) => React.ReactNode
}

export function SettingsPage({ email, modelOptions, onStatus, renderQueryErrorNotice }: SettingsPageProps) {
  const model = useDashboardModel(email, modelOptions)
  const {
    budgetCoveragePercent,
    budgetRunwayAmount,
    chatCurrency,
    chatProfile,
    chatSummary,
    chatTransactions,
    householdInvites,
    householdQuery,
    profile,
    savedCategoryBudgetEntries,
    savedCategoryBudgetTotal,
    savedMonthlyBudget,
  } = model

  const [spouseEmail, setSpouseEmail] = useState('')
  const [profileForm, setProfileForm] = useState<ProfileForm>({ monthlyIncome: '', monthlyBudget: '' })
  const [categoryBudgetInputs, setCategoryBudgetInputs] = useState<Record<string, string>>({})

  const saveProfile = useSaveProfile(email)
  const inviteSpouse = useInviteSpouse(email)
  const isSavingProfile = saveProfile.isPending
  const isInvitingSpouse = inviteSpouse.isPending
  const activeEmail = email
  const setStatus = onStatus
  const previewEnabled = modelOptions.previewEnabled
  const data = model.data
  const setDashboardData = model.setDashboardData

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

    try {
      const response = await inviteSpouse.mutateAsync(normalizedSpouseEmail)

      setSpouseEmail('')
      setStatus(response.emailSent
        ? `Invitación enviada a ${normalizedSpouseEmail}.`
        : `Invitación guardada para ${normalizedSpouseEmail}. El correo solo se envía cuando Cloudflare Email está configurado.`
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos guardar la invitación.')
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
          categoryAnalysis: buildCategoryAnalysis(chatTransactions, chatSummary, nextProfile),
          message: 'Perfil financiero actualizado.',
        }
        setDashboardData(nextData)
        setStatus('Perfil financiero actualizado.')
        return
      }
      const response = await saveProfile.mutateAsync({
        currency: chatCurrency,
        monthlyIncome,
        monthlyBudget,
        categoryBudgets,
      })
      setStatus(response.message || 'Perfil financiero actualizado.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos guardar el perfil financiero.')
    }
  }

  return (
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

              {householdQuery.isError ? (
                renderQueryErrorNotice(
                  'No pudimos cargar las invitaciones.',
                  () => { void householdQuery.refetch() },
                )
              ) : householdInvites.length > 0 ? (
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
  )
}
