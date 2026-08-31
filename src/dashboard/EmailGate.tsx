import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  FileSearch,
  Landmark,
  Loader2,
  Moon,
  Sun,
  WalletCards,
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
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import { setDashboardSession } from '@/lib/dashboard-session'
import { DashboardBrandWordmark } from './components/DashboardBrandWordmark'
import {
  FINANCE_APP_SHELL_CLASS,
  FINANCE_ARTIFACT_CARD_CLASS,
  FINANCE_ARTIFACT_INSET_CLASS,
} from './lib/styles'
import type { DashboardTheme } from './lib/types'

interface EmailGateProps {
  initialEmail: string
  status: string
  dashboardTheme: DashboardTheme
  onStatus: (message: string) => void
  onToggleTheme: () => void
  onBackHome: () => void
  onAuthenticated: (email: string) => void
}

/** Logged-out dashboard: email + one-time code, both through the core client. */
export function EmailGate({
  initialEmail,
  status,
  dashboardTheme,
  onStatus,
  onToggleTheme,
  onBackHome,
  onAuthenticated,
}: EmailGateProps) {
  const [emailInput, setEmailInput] = useState(initialEmail)
  const [pendingLoginEmail, setPendingLoginEmail] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [isIdentifying, setIsIdentifying] = useState(false)
  const setStatus = onStatus
  const toggleDashboardTheme = onToggleTheme

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

    setIsIdentifying(true)
    setStatus(pendingLoginEmail ? 'Verificando código.' : 'Registrando correo.')

    try {
      const response = pendingLoginEmail
        ? await apiClient.verifyLoginCode(pendingLoginEmail, loginCode.trim(), 'dashboard-email-gate')
        : await apiClient.signup(normalizedEmail, {
            diagnosticData: JSON.stringify({
              source: 'dashboard-email-gate',
              capturedAt: new Date().toISOString(),
            }),
          })
      const registeredEmail = response.email || normalizedEmail
      if (response.verificationRequired) {
        setPendingLoginEmail(registeredEmail)
        setStatus(response.debugCode ? `Código local: ${response.debugCode}` : 'Te enviamos un código y enlace de acceso a tu correo.')
        return
      }
      setDashboardSession(registeredEmail, response.clientSecret)
      onAuthenticated(registeredEmail)
      setEmailInput(registeredEmail)
      setPendingLoginEmail('')
      setLoginCode('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos registrar el correo.')
    } finally {
      setIsIdentifying(false)
    }
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
                    Entra para conectar tu banco y analizar fugas, patrones y ahorro.
                  </p>
                </div>
              </header>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
                <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                  <CardHeader>
                    <CardTitle>Entrar a FinovAI</CardTitle>
                    <CardDescription>
                      Entra para conectar tu banco. Después FinovAI trae movimientos y te ayuda a ahorrar.
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
                      <Button type="submit" className="self-end rounded-full px-5" disabled={isIdentifying}>
                        {isIdentifying ? <Loader2 className="size-4 animate-spin" /> : null}
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
