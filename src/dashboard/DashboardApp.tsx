import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Landmark, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { clearDashboardSession } from '@/lib/dashboard-session'
import { dismissIncomePrompt, isIncomePromptDismissed } from '@/lib/onboarding'
import type { FinanceActionPlan, FinancialProfile, DashboardResponse } from '@finovai/core'
import { buildCategoryAnalysis } from '@finovai/core'
import { useSaveProfile } from '@finovai/core/react'

import { EmailGate } from './EmailGate'
import { Rail } from './components/Rail'
import { LoadErrorScreen, LoadingScreen } from './components/LoadingState'
import { AnalysisPage } from './pages/AnalysisPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { ChatPage } from './pages/ChatPage'
import { ConnectPage } from './pages/ConnectPage'
import { MovementsPage } from './pages/MovementsPage'
import { SettingsPage } from './pages/SettingsPage'
import {
  DASHBOARD_PAGE_PATHS,
  PAGE_META,
  getDashboardPageFromPath,
  shouldCanonicalizeDashboardPath,
  type DashboardPage,
} from './lib/routing'
import type {
  CategoryPeriodFilter,
  DashboardChatMessage,
  DashboardTheme,
  PendingChatAnswer,
} from './lib/types'
import { FINANCE_APP_SHELL_CLASS } from './lib/styles'
import {
  DASHBOARD_THEME_STORAGE_KEY,
  getDashboardLoadingPreviewEnabled,
  getDashboardPreviewEnabled,
  getStoredDashboardTheme,
  getStoredEmail,
} from './lib/constants'
import { parseMoneyInput } from './lib/format'
import { createPreviewDashboardResponse } from './lib/preview'
import { useDashboardModel } from './lib/use-dashboard-model'

interface DashboardAppProps {
  email: string | null
  initialNotice?: string | null
  initialPath?: string
  onBackHome: () => void
  onLogout: () => void
}

export default function DashboardApp({
  email,
  initialNotice,
  initialPath,
  onBackHome,
  onLogout,
}: DashboardAppProps) {
  const previewEnabled = getDashboardPreviewEnabled()
  const loadingPreviewEnabled = getDashboardLoadingPreviewEnabled()
  const previewEmail = previewEnabled || loadingPreviewEnabled ? 'preview@finov.ai' : null

  const [activeEmail, setActiveEmail] = useState<string | null>(() => getStoredEmail(email) || previewEmail)
  const [status, setStatus] = useState(initialNotice || 'Entra con tu correo para conectar tu banco y analizar tus movimientos.')
  const [activePage, setActivePageState] = useState<DashboardPage>(() => getDashboardPageFromPath(initialPath))
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(() => getStoredDashboardTheme())
  const [categoryPeriodFilter, setCategoryPeriodFilter] = useState<CategoryPeriodFilter>('current')
  const [showIncomePrompt, setShowIncomePrompt] = useState(false)
  const [incomePromptValue, setIncomePromptValue] = useState('')
  const [incomePromptError, setIncomePromptError] = useState('')

  // Chat state lives in the shell: other pages hand questions to it via onAnalyze.
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<DashboardChatMessage[]>([])
  const [pendingChatAnswer, setPendingChatAnswer] = useState<PendingChatAnswer | null>(null)
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null)
  const pendingChatQuestionRef = useRef<string | null>(null)
  const announcedLoadStatusRef = useRef<string | null>(null)

  const queryClient = useQueryClient()
  const modelOptions = { previewEnabled, loadingPreviewEnabled, previewEmail, categoryPeriodFilter }
  const model = useDashboardModel(activeEmail, modelOptions)
  const {
    chatCurrency,
    chatSummary,
    chatTransactions,
    connectActionLabel,
    credentialsFetchFailed,
    credentialsQuery,
    credentialsReadyForEmail,
    data,
    hasConnectedInstitution,
    hasReconnectRequiredCredential,
    hasSupportIssueCredential,
    hasProviderIssueCredential,
    hasVerifyingCredential,
    hasTransactions,
    isLoadingCredentials,
    loadError,
    profile,
    setDashboardData,
    transactionsQuery,
  } = model

  const saveIncomePromptProfile = useSaveProfile(activeEmail ?? '')
  const isSavingIncomePrompt = saveIncomePromptProfile.isPending
  const pageMeta = PAGE_META[activePage]
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

    const nextPath = (previewEnabled || loadingPreviewEnabled) && import.meta.env.DEV
      ? `${DASHBOARD_PAGE_PATHS[nextPage]}?preview=${previewEnabled ? 'dashboard' : 'loading'}`
      : DASHBOARD_PAGE_PATHS[nextPage]
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  useEffect(() => {
    if (email && email !== activeEmail) setActiveEmail(email)
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

  // Mirrors the load state into the status line. Announces a message only when it
  // actually changes, so a mutation writing fresh data into the cache does not
  // clobber the handler's own status ("Perfil financiero actualizado.", etc).
  useEffect(() => {
    const nextStatus = loadingPreviewEnabled
      ? 'Vista local de carga para revisar el panel financiero.'
      : previewEnabled
        ? 'Vista local de referencia para revisar el panel financiero.'
        : !activeEmail
          ? null
          : transactionsQuery.isError
            ? loadError
            : transactionsQuery.isPending
              ? 'Cargando transacciones conectadas.'
              : transactionsQuery.data
                ? transactionsQuery.data.transactions.length > 0
                  ? 'Transacciones listas para análisis.'
                  : hasReconnectRequiredCredential
                    ? 'La institución rechazó el acceso. Ve a Conectar cuenta para actualizarlo.'
                    : hasSupportIssueCredential
                      ? 'La conexión necesita revisión de FinovAI. Ve a Conectar cuenta para consultar el código de soporte.'
                    : hasProviderIssueCredential
                      ? 'La institución está fallando temporalmente. Ve a Conectar cuenta para revisar el detalle.'
                      : hasVerifyingCredential
                        ? 'La credencial está guardada, pero la institución todavía está verificando el acceso.'
                        : hasConnectedInstitution
                          ? 'Institución conectada, pero todavía no hay movimientos disponibles.'
                          : 'Ve a Conectar cuenta y sigue los pasos para analizar tus datos reales.'
                : null

    if (nextStatus === null || announcedLoadStatusRef.current === nextStatus) return
    announcedLoadStatusRef.current = nextStatus
    setStatus(nextStatus)
  }, [
    activeEmail,
    hasConnectedInstitution,
    hasProviderIssueCredential,
    hasReconnectRequiredCredential,
    hasSupportIssueCredential,
    hasVerifyingCredential,
    loadError,
    loadingPreviewEnabled,
    previewEnabled,
    transactionsQuery.data,
    transactionsQuery.isError,
    transactionsQuery.isPending,
  ])

  useEffect(() => {
    function handleSessionExpired() {
      queryClient.clear()
      setActiveEmail(null)
      setStatus('Tu sesión expiró. Vuelve a entrar con tu correo.')
    }
    window.addEventListener('finovai:session-expired', handleSessionExpired)
    return () => window.removeEventListener('finovai:session-expired', handleSessionExpired)
  }, [queryClient])

  useEffect(() => {
    if (previewEnabled || loadingPreviewEnabled || !activeEmail) return
    if (isLoadingCredentials || credentialsFetchFailed) return
    if (credentialsReadyForEmail !== activeEmail) return
    if (activePage !== 'inicio') return
    if (hasConnectedInstitution) return

    setActivePage('syncfy')
  }, [
    activeEmail,
    activePage,
    credentialsFetchFailed,
    credentialsReadyForEmail,
    hasConnectedInstitution,
    isLoadingCredentials,
    loadingPreviewEnabled,
    previewEnabled,
  ])

  useEffect(() => {
    if (previewEnabled || loadingPreviewEnabled || !activeEmail) return
    if (transactionsQuery.isPending || isLoadingCredentials || credentialsFetchFailed) return
    if (credentialsReadyForEmail !== activeEmail) return
    if (!hasTransactions) return
    if (profile.monthlyIncome && profile.monthlyIncome > 0) return
    if (isIncomePromptDismissed(activeEmail)) return
    if (activePage === 'syncfy') return
    setShowIncomePrompt(true)
  }, [
    activeEmail,
    activePage,
    credentialsFetchFailed,
    credentialsReadyForEmail,
    hasTransactions,
    isLoadingCredentials,
    transactionsQuery.isPending,
    loadingPreviewEnabled,
    previewEnabled,
    profile.monthlyIncome,
  ])

  const toggleDashboardTheme = () => {
    setDashboardTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  // Other pages ask a question by switching to the chat and handing it the text;
  // ChatPage picks it up from the ref on its next render.
  const analyzeWithFinovAI = (question: string) => {
    pendingChatQuestionRef.current = question
    setActivePage('inicio')
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

    if (target === 'partner') {
      analyzeWithFinovAI('¿Cómo convierto este ahorro mensual en una ruta de inversión?')
      return
    }

    analyzeWithFinovAI('Dame un plan semanal para reducir estas fugas.')
  }

  const dismissOnboardingIncomePrompt = () => {
    if (activeEmail) dismissIncomePrompt(activeEmail)
    setShowIncomePrompt(false)
    setIncomePromptValue('')
    setIncomePromptError('')
  }

  const handleIncomePromptSave = async () => {
    if (!activeEmail) {
      setIncomePromptError('Primero identifica el correo del usuario.')
      return
    }

    const monthlyIncome = parseMoneyInput(incomePromptValue)
    if (!monthlyIncome || monthlyIncome <= 0) {
      setIncomePromptError('Agrega tu ingreso mensual para continuar.')
      return
    }

    setIncomePromptError('')
    try {
      if (previewEnabled) {
        const nextProfile: FinancialProfile = {
          ...profile,
          email: activeEmail || profile.email || 'preview@finov.ai',
          currency: chatCurrency,
          monthlyIncome,
        }
        const nextData: DashboardResponse = {
          ...(data || createPreviewDashboardResponse(nextProfile.email)),
          profile: nextProfile,
          categoryAnalysis: buildCategoryAnalysis(chatTransactions, chatSummary, nextProfile),
          message: 'Ingreso mensual guardado.',
        }
        setDashboardData(nextData)
        dismissIncomePrompt(activeEmail)
        setShowIncomePrompt(false)
        setIncomePromptValue('')
        setIncomePromptError('')
        setStatus('Ingreso mensual guardado.')
        return
      }

      const response = await saveIncomePromptProfile.mutateAsync({
        currency: chatCurrency,
        monthlyIncome,
        monthlyBudget: profile.monthlyBudget,
        categoryBudgets: profile.categoryBudgets,
      })
      dismissIncomePrompt(activeEmail)
      setShowIncomePrompt(false)
      setIncomePromptValue('')
      setIncomePromptError('')
      setStatus(response.message || 'Ingreso mensual guardado.')
    } catch (error) {
      setIncomePromptError(error instanceof Error ? error.message : 'No pudimos guardar el ingreso mensual.')
    }
  }

  // Background query failures used to be swallowed and rendered as empty data.
  const renderQueryErrorNotice = (message: string, onRetry: () => void) => (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
      <p className="text-sm text-foreground">{message}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )

  const rail = (
    <Rail
      activePage={activePage}
      dashboardTheme={dashboardTheme}
      onNavigate={setActivePage}
      onToggleTheme={toggleDashboardTheme}
      onLogout={onLogout}
    />
  )

  if (activeEmail && !data && loadError) {
    return (
      <LoadErrorScreen
        dashboardTheme={dashboardTheme}
        rail={rail}
        loadError={loadError}
        onRetry={() => { void transactionsQuery.refetch() }}
        onSignOut={() => {
          clearDashboardSession()
          queryClient.clear()
          setActiveEmail(null)
          setStatus('Vuelve a entrar con tu correo.')
        }}
      />
    )
  }

  if (activeEmail && !data) {
    return <LoadingScreen dashboardTheme={dashboardTheme} rail={rail} activeEmail={activeEmail} />
  }

  if (activeEmail && data) {
    return (
      <main className={cn('finovai-dashboard min-h-screen text-foreground', dashboardTheme === 'dark' && 'dark')}>
        <div className="min-h-screen p-3 sm:p-5 lg:p-7">
          <div className={FINANCE_APP_SHELL_CLASS}>
            {rail}

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
                          {connectActionLabel}
                        </Button>
                      </div>
                    ) : null}
                  </header>
                ) : null}

                <div className="flex min-w-0 flex-col gap-4">
                  {credentialsQuery.isError && activePage !== 'inicio' ? (
                    renderQueryErrorNotice(
                      'No pudimos cargar tus conexiones bancarias.',
                      () => { void credentialsQuery.refetch() },
                    )
                  ) : null}

                  {activePage === 'inicio' ? (
                    <ChatPage
                      email={activeEmail}
                      modelOptions={modelOptions}
                      onNavigate={setActivePage}
                      chat={{
                        chatInput,
                        setChatInput,
                        chatMessages,
                        setChatMessages,
                        pendingChatAnswer,
                        setPendingChatAnswer,
                        chatMessagesEndRef,
                        pendingQuestionRef: pendingChatQuestionRef,
                      }}
                    />
                  ) : null}

                  {activePage === 'syncfy' ? (
                    <ConnectPage
                      email={activeEmail}
                      modelOptions={modelOptions}
                      onStatus={setStatus}
                    />
                  ) : null}

                  {activePage === 'movimientos' ? (
                    <MovementsPage
                      email={activeEmail}
                      modelOptions={modelOptions}
                      onStatus={setStatus}
                      onNavigate={setActivePage}
                      onAnalyze={analyzeWithFinovAI}
                      isChatPending={Boolean(pendingChatAnswer)}
                    />
                  ) : null}

                  {activePage === 'categorias' ? (
                    <CategoriesPage
                      email={activeEmail}
                      modelOptions={modelOptions}
                      categoryPeriodFilter={categoryPeriodFilter}
                      onCategoryPeriodFilterChange={setCategoryPeriodFilter}
                      onAnalyze={analyzeWithFinovAI}
                      isChatPending={Boolean(pendingChatAnswer)}
                    />
                  ) : null}

                  {activePage === 'analisis' ? (
                    <AnalysisPage
                      email={activeEmail}
                      modelOptions={modelOptions}
                      onActionPlanTarget={handleActionPlanTarget}
                      isChatPending={Boolean(pendingChatAnswer)}
                    />
                  ) : null}

                  {activePage === 'ajustes' ? (
                    <SettingsPage
                      email={activeEmail}
                      modelOptions={modelOptions}
                      onStatus={setStatus}
                      renderQueryErrorNotice={renderQueryErrorNotice}
                    />
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </div>

        <Dialog
          open={showIncomePrompt}
          onOpenChange={(open) => {
            if (!open) dismissOnboardingIncomePrompt()
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Cuál es tu ingreso mensual?</DialogTitle>
              <DialogDescription>
                Ya tienes movimientos. Con tu ingreso FinovAI compara gasto, ahorro y presupuestos con más precisión.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="onboarding-income">Ingreso mensual ({chatCurrency})</Label>
              <Input
                id="onboarding-income"
                inputMode="decimal"
                value={incomePromptValue}
                onChange={(event) => {
                  setIncomePromptValue(event.target.value)
                  if (incomePromptError) setIncomePromptError('')
                }}
                placeholder="Ej. 45000"
                autoComplete="off"
                aria-invalid={Boolean(incomePromptError)}
              />
              {incomePromptError ? (
                <p className="text-sm text-destructive" role="alert">
                  {incomePromptError}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={dismissOnboardingIncomePrompt}
                disabled={isSavingIncomePrompt}
              >
                Ahora no
              </Button>
              <Button
                type="button"
                onClick={() => void handleIncomePromptSave()}
                disabled={isSavingIncomePrompt}
              >
                {isSavingIncomePrompt ? <Loader2 className="size-4 animate-spin" /> : null}
                Guardar ingreso
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    )
  }

  return (
    <EmailGate
      initialEmail={getStoredEmail(email) || previewEmail || ''}
      status={status}
      dashboardTheme={dashboardTheme}
      onStatus={setStatus}
      onToggleTheme={toggleDashboardTheme}
      onBackHome={onBackHome}
      onAuthenticated={setActiveEmail}
    />
  )
}
