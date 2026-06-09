import { useEffect, useRef, useState } from 'react'
import type { SyncfyWidgetInstance } from '@syncfy/authentication-widget'
import syncfyWidgetUmdUrl from '../../node_modules/@syncfy/authentication-widget/dist/syncfy-authentication-widget.umd.js?url'
import '@syncfy/authentication-widget/dist/syncfy-authentication-widget.css'
import {
  AlertCircle,
  CheckCircle2,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
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
import { cn } from '@/lib/utils'
import { getDashboardAuthHeaders } from '@/lib/dashboard-session'

interface SyncfyConnectProps {
  email: string
  initialCredentials?: SyncfyCredential[]
  isLoadingCredentials?: boolean
  onStatus?: (message: string) => void
  onSynced?: (dashboard: unknown) => void
  onCredentialsChange?: (credentials: SyncfyCredential[]) => void
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
  credentials: SyncfyCredential[]
}

interface SyncfyImportSummary {
  fetched: number
  imported: number
  skipped: number
}

interface SyncfyCredentialCaptureResponse {
  success: boolean
  credential?: SyncfyCredential | null
  credentials: SyncfyCredential[]
  message?: string
  transactions?: unknown[]
  pendingTransactions?: boolean
  syncfy?: SyncfyImportSummary | null
}

interface SyncfySessionResponse {
  success: boolean
  token: string | null
  widgetEnabled: boolean
  widgetConfig: Record<string, unknown>
  credentialId: string | null
  error?: string
}

interface SyncfyRefreshResponse {
  success: boolean
  message?: string
  error?: string
  retryAfterSeconds?: number
  transactions?: unknown[]
  pendingTransactions?: boolean
  syncfy?: SyncfyImportSummary | null
}

type WidgetMode = 'create' | 'update'
type SyncfyWidgetConstructor = new (params: {
  token: string
  element: string | HTMLElement
  config?: Record<string, unknown>
  refreshTokenFunction?: () => Promise<{ token: string }>
}) => SyncfyWidgetInstance

declare global {
  interface Window {
    SyncfyWidget?: SyncfyWidgetConstructor
    SyncfyAuthenticationWidget?: {
      default?: SyncfyWidgetConstructor
      SyncfyWidget?: SyncfyWidgetConstructor
    }
  }
}

let syncfyWidgetLoader: Promise<SyncfyWidgetConstructor> | null = null

function getLoadedSyncfyWidget() {
  return window.SyncfyWidget
    || window.SyncfyAuthenticationWidget?.default
    || window.SyncfyAuthenticationWidget?.SyncfyWidget
    || null
}

function loadSyncfyWidget() {
  const loadedWidget = getLoadedSyncfyWidget()
  if (loadedWidget) return Promise.resolve(loadedWidget)

  syncfyWidgetLoader ??= new Promise<SyncfyWidgetConstructor>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[data-syncfy-widget="true"]`
    )

    const resolveLoadedWidget = () => {
      const nextWidget = getLoadedSyncfyWidget()
      if (nextWidget) {
        resolve(nextWidget)
      } else {
        syncfyWidgetLoader = null
        reject(new Error('Connection widget loaded without exposing the widget constructor.'))
      }
    }

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolveLoadedWidget()
        return
      }
      existingScript.addEventListener('load', resolveLoadedWidget, { once: true })
      existingScript.addEventListener('error', () => {
        syncfyWidgetLoader = null
        reject(new Error('Connection widget script failed to load.'))
      }, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = syncfyWidgetUmdUrl
    script.async = true
    script.dataset.syncfyWidget = 'true'
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolveLoadedWidget()
    }, { once: true })
    script.addEventListener('error', () => {
      syncfyWidgetLoader = null
      reject(new Error('Connection widget script failed to load.'))
    }, { once: true })
    document.head.appendChild(script)
  })

  return syncfyWidgetLoader
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getDashboardAuthHeaders(),
      ...init?.headers,
    },
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : 'Error de API'
    const error = new Error(message) as Error & { data?: unknown; status?: number }
    error.data = data
    error.status = response.status
    throw error
  }

  return data as T
}

function formatCooldown(seconds: number) {
  if (seconds <= 0) return 'Listo'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`
}

const FINANCE_CONNECT_CARD_CLASS = 'min-w-0 rounded-[1.45rem] border-border/70 bg-card py-5 shadow-[0_16px_45px_rgba(20,33,27,0.06)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.26)]'
const FINANCE_CONNECT_INSET_CLASS = 'rounded-2xl bg-secondary/45 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]'

function getCredentialLabel(credential: SyncfyCredential) {
  return credential.siteName || credential.syncfyCredentialId
}

function getCredentialLogoText(credential: SyncfyCredential) {
  const label = getCredentialLabel(credential)
  const words = label
    .replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return (words[0] || label).slice(0, 2).toUpperCase()
}

function getCredentialStatusText(credential: SyncfyCredential) {
  if (credential.needsReconnect || credential.status === 'needs_reconnect') {
    return 'Reconecta el acceso para volver a sincronizar.'
  }

  return credential.ready
    ? 'Lista para sincronizar'
    : `Próxima sincronización en ${formatCooldown(credential.cooldownSeconds)}`
}

export function SyncfyConnect({
  email,
  initialCredentials = [],
  isLoadingCredentials = false,
  onStatus,
  onSynced,
  onCredentialsChange,
}: SyncfyConnectProps) {
  const widgetContainerRef = useRef<HTMLDivElement | null>(null)
  const widgetRef = useRef<SyncfyWidgetInstance | null>(null)
  const pollTimeoutRef = useRef<number | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)
  const [credentials, setCredentials] = useState<SyncfyCredential[]>(initialCredentials)
  const [session, setSession] = useState<SyncfySessionResponse | null>(null)
  const [widgetMode, setWidgetMode] = useState<WidgetMode>('create')
  const [activeCredentialId, setActiveCredentialId] = useState<string | null>(null)
  const [message, setMessage] = useState('Ve a Conectar cuenta y sigue los pasos para vincular una institución.')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [widgetRunId, setWidgetRunId] = useState(0)

  const hasCredentials = credentials.length > 0
  const isBusy = isLoading || isRefreshing

  const applyCredentials = (nextCredentials: SyncfyCredential[]) => {
    setCredentials(nextCredentials)
    onCredentialsChange?.(nextCredentials)
  }

  const loadCredentials = async () => {
    const response = await apiJson<SyncfyCredentialsResponse>(
      `/api/syncfy/credentials?email=${encodeURIComponent(email)}`
    )
    applyCredentials(response.credentials)
    return response.credentials
  }

  const clearCredentialPolling = () => {
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }

  const clearTransactionRetry = () => {
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }

  const closeWidget = () => {
    widgetRef.current?.close?.()
    widgetRef.current = null
    if (widgetContainerRef.current) {
      widgetContainerRef.current.innerHTML = ''
    }
  }

  const pollForCredential = (attemptRefresh: boolean) => {
    clearCredentialPolling()
    let attempts = 0

    const tick = async () => {
      attempts += 1
      const nextCredentials = await loadCredentials().catch(() => [])
      const nextCredential = nextCredentials[0]

      if (nextCredential) {
        setMessage(attemptRefresh
          ? 'Institución detectada. Buscando movimientos.'
          : 'Institución detectada.')
        if (attemptRefresh) {
          void refreshTransactions(nextCredential.syncfyCredentialId, 0)
        }
        return
      }

      if (attempts < 10) {
        pollTimeoutRef.current = window.setTimeout(() => {
          void tick()
        }, 3000)
      } else {
        setMessage('La conexión todavía no confirma la institución. Puedes dejar esta página abierta; FinovAI seguirá esperando la confirmación.')
      }
    }

    pollTimeoutRef.current = window.setTimeout(() => {
      void tick()
    }, 2000)
  }

  const captureWidgetCredential = async (eventType: string, args: unknown[]) => {
    const payload = args.length <= 1 ? args[0] ?? {} : args

    try {
      const response = await apiJson<SyncfyCredentialCaptureResponse>('/api/syncfy/credential', {
        method: 'POST',
        body: JSON.stringify({
          email,
          eventType,
          payload,
        }),
      })

      applyCredentials(response.credentials)
      if (response.message) {
        setMessage(response.message)
        onStatus?.(response.message)
      }
      if (Array.isArray(response.transactions)) {
        onSynced?.(response)
      }

      const nextCredential = response.credential || response.credentials[0]
      if (nextCredential?.syncfyCredentialId) {
        window.setTimeout(() => {
          void refreshTransactions(nextCredential.syncfyCredentialId, response.pendingTransactions ? 1 : 0)
        }, 1200)
      }

      return true
    } catch (error) {
      const apiError = error as Error & { status?: number }
      const message = apiError.message || 'No pudimos guardar la institución conectada.'
      setMessage(message)
      onStatus?.(message)
      return apiError.status !== 422
    }
  }

  useEffect(() => {
    setCredentials(initialCredentials)
  }, [initialCredentials])

  useEffect(() => () => {
    clearCredentialPolling()
    clearTransactionRetry()
  }, [])

  useEffect(() => {
    if (!session?.widgetEnabled || !session.token || !widgetContainerRef.current) return

    let cancelled = false
    const token = session.token
    widgetContainerRef.current.innerHTML = ''

    void loadSyncfyWidget().then((SyncfyWidget) => {
      if (cancelled || !widgetContainerRef.current) return

      const widget = new SyncfyWidget({
        token,
        element: '#syncfy-widget',
        config: session.widgetConfig,
        refreshTokenFunction: async () => {
          const refreshed = await createSession(widgetMode, activeCredentialId, false)
          return { token: refreshed.token || '' }
        },
      })
      widgetRef.current = widget

      widget.on('success', (...args: unknown[]) => {
        clearCredentialPolling()
        setMessage('Institución conectada. Guardando credencial y esperando movimientos.')
        onStatus?.('Institución conectada. Esperando movimientos.')
        void captureWidgetCredential('widget.success', args).then((captured) => {
          if (!captured) pollForCredential(true)
        })
      })
      widget.on('updated', (...args: unknown[]) => {
        clearCredentialPolling()
        setMessage('Acceso actualizado. Buscando movimientos nuevos.')
        onStatus?.('Acceso actualizado.')
        void captureWidgetCredential('widget.updated', args).then((captured) => {
          if (!captured) {
            window.setTimeout(() => {
              void refreshTransactions(activeCredentialId || undefined, 0)
            }, 1500)
          }
        })
      })
      widget.on('error', () => {
        const rid = widget.getLastRid?.()
        setMessage(rid ? `La conexión reportó un error. RID: ${rid}` : 'La conexión reportó un error.')
      })
      widget.on('closed', () => {
        clearCredentialPolling()
        setSession(null)
        void loadCredentials()
      })

      window.setTimeout(() => {
        if (cancelled || widgetRef.current !== widget) return

        if (widgetMode === 'update' && activeCredentialId) {
          widget.setEntrypointUpdateCredential(activeCredentialId)
        } else {
          widget.open()
        }
      }, 0)
    }).catch((error) => {
      console.error('Connection widget load failed', error)
      setMessage('No pudimos cargar el formulario de conexión.')
    })

    return () => {
      cancelled = true
      closeWidget()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, widgetRunId])

  async function createSession(mode: WidgetMode, credentialId: string | null, showLoading = true) {
    if (showLoading) {
      setIsLoading(true)
      clearTransactionRetry()
      setMessage(mode === 'update'
        ? 'Abriendo el formulario para actualizar el acceso.'
        : 'Abriendo el formulario. Después del éxito, los movimientos pueden tardar unos segundos en llegar.')
      closeWidget()
      setSession(null)
    }

    try {
      const response = await apiJson<SyncfySessionResponse>('/api/syncfy/session', {
        method: 'POST',
        body: JSON.stringify({
          email,
          credentialId,
          mode,
        }),
      })

      if (!response.widgetEnabled) {
        setMessage(response.error || 'La conexión bancaria no está configurada en este entorno.')
      }

      if (showLoading) {
        setWidgetMode(mode)
        setActiveCredentialId(credentialId)
        setSession(response)
        setWidgetRunId((value) => value + 1)
      }

      return response
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'No pudimos iniciar la conexión bancaria.'
      setMessage(nextMessage)
      onStatus?.(nextMessage)
      throw error
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  async function refreshTransactions(credentialId?: string, retryAttempt = 0) {
    if (retryAttempt === 0) clearTransactionRetry()
    setIsRefreshing(true)
    setMessage(retryAttempt > 0
      ? `Los movimientos siguen preparándose. Reintentando (${retryAttempt}/6).`
      : 'Buscando movimientos nuevos.')

    try {
      const response = await apiJson<SyncfyRefreshResponse>('/api/syncfy/refresh', {
        method: 'POST',
        body: JSON.stringify({
          email,
          credentialId,
        }),
      })

      const pendingTransactions = Boolean(response.pendingTransactions)
      const nextMessage = response.message || 'Movimientos sincronizados.'
      if (pendingTransactions && credentialId && retryAttempt < 6) {
        setMessage(`${nextMessage} Reintento automático en unos segundos.`)
        onStatus?.(nextMessage)
        retryTimeoutRef.current = window.setTimeout(() => {
          void refreshTransactions(credentialId, retryAttempt + 1)
        }, 8000)
      } else {
        setMessage(nextMessage)
        onStatus?.(nextMessage)
      }
      onSynced?.(response)
      await loadCredentials()
    } catch (error) {
      const data = (error as Error & { data?: { retryAfterSeconds?: number } }).data
      const nextMessage = data?.retryAfterSeconds
        ? `Puedes volver a sincronizar en ${formatCooldown(data.retryAfterSeconds)}.`
        : error instanceof Error ? error.message : 'No pudimos sincronizar movimientos.'
      setMessage(nextMessage)
      onStatus?.(nextMessage)
      await loadCredentials()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Card className={FINANCE_CONNECT_CARD_CLASS}>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{hasCredentials ? 'Instituciones conectadas' : 'Conecta una institución'}</CardTitle>
          <CardDescription>
            Bancos, SAT, Bitso, American Express y fuentes compatibles en México.
          </CardDescription>
        </div>
        <Badge variant={credentials.length > 0 ? 'secondary' : 'outline'}>
          {isLoadingCredentials
            ? 'Cargando'
            : credentials.length > 0
              ? `${credentials.length} credencial${credentials.length === 1 ? '' : 'es'}`
              : 'Sin conexión'}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className={cn(FINANCE_CONNECT_INSET_CLASS, 'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between')}>
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Acceso solo lectura</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                FinovAI recibe movimientos para analizarlos; el formulario seguro se completa con la institución.
              </p>
            </div>
          </div>

          <Button
            type="button"
            className="shrink-0"
            onClick={() => void createSession('create', null)}
            disabled={isBusy}
          >
            {isLoading && widgetMode === 'create' ? <Loader2 className="size-4 animate-spin" /> : <Landmark data-icon="inline-start" />}
            {hasCredentials ? 'Agregar institución' : 'Conectar institución'}
          </Button>
        </div>

        {credentials.length > 0 ? (
          <div className="grid gap-2">
            {credentials.map((credential) => (
              <div
                key={credential.syncfyCredentialId}
                className={cn(FINANCE_CONNECT_INSET_CLASS, 'flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between')}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
                    {getCredentialLogoText(credential)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{getCredentialLabel(credential)}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">Institución conectada</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getCredentialStatusText(credential)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Badge variant={credential.ready ? 'secondary' : 'outline'}>
                    {credential.status || 'Pendiente'}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void refreshTransactions(credential.syncfyCredentialId, 0)}
                    disabled={isBusy || credential.needsReconnect || !credential.ready}
                  >
                    {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw data-icon="inline-start" />}
                    Sincronizar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void createSession('update', credential.syncfyCredentialId)}
                    disabled={isBusy}
                  >
                    {credential.needsReconnect || credential.status === 'needs_reconnect' ? 'Reconectar' : 'Actualizar acceso'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            'flex items-start gap-2 rounded-2xl border p-3 text-sm',
            message.toLowerCase().includes('error') || message.includes('No pudimos')
              ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-100'
              : isLoading || isRefreshing || message.includes('preparando')
                ? 'border-ring/25 bg-accent text-foreground'
              : 'border-primary/20 bg-primary/10 text-foreground'
          )}
        >
          {message.toLowerCase().includes('error') || message.includes('No pudimos')
            ? <AlertCircle className="mt-0.5 size-4 shrink-0" />
            : isLoading || isRefreshing || message.includes('preparando')
              ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
              : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
          <span>{message}</span>
        </div>

        {session?.widgetEnabled ? (
          <div className="grid gap-3">
            <div className={cn(FINANCE_CONNECT_INSET_CLASS, 'flex flex-wrap items-center justify-between gap-2 p-3')}>
              <span className="text-sm text-muted-foreground">
                Completa el formulario. Al terminar, FinovAI buscará los movimientos automáticamente.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  clearCredentialPolling()
                  closeWidget()
                  setSession(null)
                }}
                disabled={isLoading}
              >
                Cerrar formulario
              </Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
              <div ref={widgetContainerRef} id="syncfy-widget" className="min-h-[640px]" />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
