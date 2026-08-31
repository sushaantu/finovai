import type { ReactNode } from 'react'
import { Bot, ChartPie, Landmark, Loader2, ReceiptText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DashboardTheme } from '../lib/types'
import {
  FINANCE_APP_SHELL_CLASS,
  FINANCE_ARTIFACT_CARD_CLASS,
  FINANCE_ARTIFACT_INSET_CLASS,
  FINANCE_ARTIFACT_TILE_CLASS,
  FINANCE_SCROLLBAR_CLASS,
} from '../lib/styles'

interface LoadErrorScreenProps {
  dashboardTheme: DashboardTheme
  rail: ReactNode
  loadError: string
  onRetry: () => void
  onSignOut: () => void
}

/** Shown when the transactions query failed and we have nothing to render. */
export function LoadErrorScreen({ dashboardTheme, rail, loadError, onRetry, onSignOut }: LoadErrorScreenProps) {
  return (
      <main className={cn('finovai-dashboard min-h-screen text-foreground', dashboardTheme === 'dark' && 'dark')}>
        <div className="min-h-screen p-3 sm:p-5 lg:p-7">
          <div className={FINANCE_APP_SHELL_CLASS}>
            {rail}

            <section className={cn('relative min-h-0 min-w-0 overflow-y-auto bg-background', FINANCE_SCROLLBAR_CLASS)}>
              <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                <h1 className="text-2xl font-semibold tracking-normal">No pudimos cargar tu análisis</h1>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{loadError}</p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button onClick={() => { onRetry() }}>Reintentar</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      onSignOut()
                    }}
                  >
                    Volver a entrar
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
  )
}

interface LoadingScreenProps {
  dashboardTheme: DashboardTheme
  rail: ReactNode
  activeEmail: string
}

/** Honest skeleton: no fabricated progress, just the real pending state. */
export function LoadingScreen({ dashboardTheme, rail, activeEmail }: LoadingScreenProps) {
  return (
      <main className={cn('finovai-dashboard min-h-screen text-foreground', dashboardTheme === 'dark' && 'dark')}>
        <div className="min-h-screen p-3 sm:p-5 lg:p-7">
          <div className={FINANCE_APP_SHELL_CLASS} aria-busy="true">
            {rail}

            <section className={cn('relative min-h-0 min-w-0 overflow-y-auto bg-background', FINANCE_SCROLLBAR_CLASS)}>
              <div className="grid min-h-full gap-6 px-4 py-5 sm:px-6 lg:grid-rows-[auto_minmax(0,1fr)] lg:px-8 lg:py-7">
                <header className="flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Badge className="mb-3 w-fit border-primary/20 bg-primary/10 text-primary" variant="outline">
                      <Loader2 className="size-3.5 animate-spin" />
                      Cargando datos
                    </Badge>
                    <h1 className="text-2xl font-semibold tracking-normal text-balance">Preparando tu análisis</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      Estamos trayendo movimientos, categorías y señales de ahorro para esta cuenta.
                    </p>
                  </div>
                  <div className="min-w-0 rounded-2xl bg-secondary/55 p-3 text-sm shadow-[inset_0_0_0_1px_rgba(10,22,40,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] sm:min-w-[260px]">
                    <p className="text-xs font-medium text-muted-foreground">Cuenta</p>
                    <p className="mt-1 font-medium leading-tight [overflow-wrap:anywhere]">{activeEmail}</p>
                  </div>
                </header>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                  <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle>Diagnóstico financiero</CardTitle>
                        <CardDescription>FinovAI está organizando la primera lectura del mes.</CardDescription>
                      </div>
                      <Badge variant="secondary">En proceso</Badge>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        {[
                          ['Gasto', 'Movimientos'],
                          ['Categorías', 'Clasificación'],
                          ['Ahorro', 'Oportunidad'],
                        ].map(([label, body]) => (
                          <div key={label} className={FINANCE_ARTIFACT_TILE_CLASS}>
                            <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            <div className="mt-3 h-6 w-24 animate-pulse rounded-md bg-primary/14" />
                            <p className="mt-3 text-xs text-muted-foreground">{body}</p>
                          </div>
                        ))}
                      </div>

                      <div className={cn(FINANCE_ARTIFACT_INSET_CLASS, 'flex items-center gap-3')}>
                        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Cargando tus movimientos…</p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 content-start">
                    <Card className={FINANCE_ARTIFACT_CARD_CLASS}>
                      <CardHeader>
                        <CardTitle>Fuentes</CardTitle>
                        <CardDescription>Señales que alimentan el dashboard.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-2">
                        {[
                          { label: 'Bancos', icon: Landmark },
                          { label: 'Categorías', icon: ChartPie },
                          { label: 'Movimientos', icon: ReceiptText },
                        ].map((item) => {
                          const Icon = item.icon

                          return (
                            <div key={item.label} className="flex min-w-0 items-center gap-3 rounded-2xl bg-secondary/45 p-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-primary">
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{item.label}</p>
                                <div className="mt-1 h-1.5 w-full animate-pulse rounded-full bg-primary/20" />
                              </div>
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>

                    <div className={cn(FINANCE_ARTIFACT_TILE_CLASS, 'border border-primary/15 bg-primary/5')}>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Bot className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">FinovAI</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            El chat aparecerá cuando termine la lectura inicial.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
  )
}
