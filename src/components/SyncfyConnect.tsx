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
  onStatus?: (message: string) => void
  onSynced?: (dashboard: unknown) => void
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
}

interface SyncfyCredentialsResponse {
  credentials: SyncfyCredential[]
}

interface SyncfyCredentialCaptureResponse {
  success: boolean
  credential?: SyncfyCredential | null
  credentials: SyncfyCredential[]
  message?: string
  transactions?: unknown[]
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
        reject(new Error('Syncfy widget loaded without exposing SyncfyWidget.'))
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
        reject(new Error('Syncfy widget script failed to load.'))
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
      reject(new Error('Syncfy widget script failed to load.'))
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
    const error = new Error(message) as Error & { data?: unknown }
    error.data = data
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

function getCredentialLabel(credential: SyncfyCredential) {
  return credential.siteName || credential.syncfyCredentialId
}

export function SyncfyConnect({ email, onStatus, onSynced }: SyncfyConnectProps) {
  const widgetContainerRef = useRef<HTMLDivElement | null>(null)
  const widgetRef = useRef<SyncfyWidgetInstance | null>(null)
  const pollTimeoutRef = useRef<number | null>(null)
  const [credentials, setCredentials] = useState<SyncfyCredential[]>([])
  const [session, setSession] = useState<SyncfySessionResponse | null>(null)
  const [widgetMode, setWidgetMode] = useState<WidgetMode>('create')
  const [activeCredentialId, setActiveCredentialId] = useState<string | null>(null)
  const [message, setMessage] = useState('Conecta una institución con Syncfy para que FinovAI lea transacciones reales.')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const primaryCredential = credentials[0]
  const canRefresh = Boolean(primaryCredential?.ready)

  const loadCredentials = async () => {
    const response = await apiJson<SyncfyCredentialsResponse>(
      `/api/syncfy/credentials?email=${encodeURIComponent(email)}`
    )
    setCredentials(response.credentials)
    return response.credentials
  }

  const clearCredentialPolling = () => {
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
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
          ? 'Credencial Syncfy detectada. Sincronizando transacciones.'
          : 'Credencial Syncfy detectada.')
        if (attemptRefresh) {
          void refreshTransactions(nextCredential.syncfyCredentialId)
        }
        return
      }

      if (attempts < 10) {
        pollTimeoutRef.current = window.setTimeout(() => {
          void tick()
        }, 3000)
      } else {
        setMessage('Syncfy aun no confirma la credencial. Si ya terminaste el banco, espera el webhook o intenta actualizar.')
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

      setCredentials(response.credentials)
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
          void refreshTransactions(nextCredential.syncfyCredentialId)
        }, 1200)
      }

      return true
    } catch {
      return false
    }
  }

  useEffect(() => {
    let cancelled = false

    apiJson<SyncfyCredentialsResponse>(`/api/syncfy/credentials?email=${encodeURIComponent(email)}`)
      .then((response) => {
        if (!cancelled) setCredentials(response.credentials)
      })
      .catch(() => {
        if (!cancelled) setCredentials([])
      })

    return () => {
      cancelled = true
    }
  }, [email])

  useEffect(() => () => {
    clearCredentialPolling()
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

      if (widgetMode === 'update' && activeCredentialId) {
        widget.setEntrypointUpdateCredential(activeCredentialId)
      } else {
        widget.open()
      }

      widget.on('success', (...args: unknown[]) => {
        clearCredentialPolling()
        setMessage('Syncfy conectó la institución. Guardando credencial e importando transacciones.')
        onStatus?.('Syncfy conectado. Guardando credencial.')
        void captureWidgetCredential('widget.success', args).then((captured) => {
          if (!captured) pollForCredential(true)
        })
      })
      widget.on('updated', (...args: unknown[]) => {
        clearCredentialPolling()
        setMessage('Credencial Syncfy actualizada. Sincronizando transacciones.')
        onStatus?.('Credencial Syncfy actualizada.')
        void captureWidgetCredential('widget.updated', args).then((captured) => {
          if (!captured) {
            window.setTimeout(() => {
              void refreshTransactions(activeCredentialId || undefined)
            }, 1500)
          }
        })
      })
      widget.on('error', () => {
        const rid = widget.getLastRid?.()
        setMessage(rid ? `Syncfy reportó un error. RID: ${rid}` : 'Syncfy reportó un error.')
      })
      widget.on('closed', () => {
        clearCredentialPolling()
        void loadCredentials()
      })
    }).catch((error) => {
      console.error('Syncfy widget load failed', error)
      setMessage('No pudimos cargar el widget de Syncfy.')
    })

    return () => {
      cancelled = true
      widgetRef.current?.close?.()
      widgetRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  async function createSession(mode: WidgetMode, credentialId: string | null, showLoading = true) {
    if (showLoading) {
      setIsLoading(true)
      setMessage(mode === 'update' ? 'Preparando actualización de credencial.' : 'Preparando widget de Syncfy.')
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
        setMessage(response.error || 'Syncfy no está configurado en este entorno.')
      }

      if (showLoading) {
        setSession(response)
        setWidgetMode(mode)
        setActiveCredentialId(credentialId)
      }

      return response
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'No pudimos iniciar Syncfy.'
      setMessage(nextMessage)
      onStatus?.(nextMessage)
      throw error
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  async function refreshTransactions(credentialId?: string) {
    setIsRefreshing(true)
    setMessage('Pidiendo a Syncfy los movimientos nuevos.')

    try {
      const response = await apiJson<SyncfyRefreshResponse>('/api/syncfy/refresh', {
        method: 'POST',
        body: JSON.stringify({
          email,
          credentialId,
        }),
      })

      setMessage(response.message || 'Movimientos sincronizados desde Syncfy.')
      onStatus?.(response.message || 'Movimientos sincronizados desde Syncfy.')
      onSynced?.(response)
      await loadCredentials()
    } catch (error) {
      const data = (error as Error & { data?: { retryAfterSeconds?: number } }).data
      const nextMessage = data?.retryAfterSeconds
        ? `Syncfy permite otro pull en ${formatCooldown(data.retryAfterSeconds)}.`
        : error instanceof Error ? error.message : 'No pudimos sincronizar Syncfy.'
      setMessage(nextMessage)
      onStatus?.(nextMessage)
      await loadCredentials()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Card className="rounded-lg border-[#2B7AE8]/20 bg-card/95">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Conecta tus cuentas con Syncfy</CardTitle>
          <CardDescription>
            Bancos, SAT, Bitso, American Express y fuentes compatibles en México. La API key nunca toca el navegador.
          </CardDescription>
        </div>
        <Badge variant={credentials.length > 0 ? 'secondary' : 'outline'}>
          {credentials.length > 0 ? `${credentials.length} credencial${credentials.length === 1 ? '' : 'es'}` : 'Sin conexión'}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="rounded-lg bg-secondary/20 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#00D4AA]/10 text-[#00D4AA]">
                <ShieldCheck className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Solo lectura</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Syncfy maneja el acceso a instituciones compatibles y FinovAI recibe movimientos para detectar fugas y oportunidades de ahorro.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button
              type="button"
              onClick={() => void createSession('create', null)}
              disabled={isLoading}
            >
              {isLoading && widgetMode === 'create' ? <Loader2 className="size-4 animate-spin" /> : <Landmark data-icon="inline-start" />}
              Conectar institución
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refreshTransactions(primaryCredential?.syncfyCredentialId)}
              disabled={isRefreshing || !primaryCredential || !canRefresh}
            >
              {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw data-icon="inline-start" />}
              Actualizar
            </Button>
          </div>
        </div>

        {credentials.length > 0 ? (
          <div className="grid gap-2">
            {credentials.map((credential) => (
              <div
                key={credential.syncfyCredentialId}
                className="flex flex-col gap-3 rounded-lg bg-secondary/20 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{getCredentialLabel(credential)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {credential.ready
                      ? 'Lista para pull'
                      : `Próximo pull en ${formatCooldown(credential.cooldownSeconds)}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Badge variant={credential.ready ? 'secondary' : 'outline'}>
                    {credential.status || 'Syncfy'}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void createSession('update', credential.syncfyCredentialId)}
                    disabled={isLoading}
                  >
                    Actualizar acceso
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            'flex items-start gap-2 rounded-lg border p-3 text-sm',
            message.toLowerCase().includes('error') || message.includes('No pudimos')
              ? 'border-rose-500/20 bg-rose-500/10 text-rose-100'
              : 'border-[#2B7AE8]/20 bg-[#00D4AA]/10 text-[#d9fff7]'
          )}
        >
          {message.toLowerCase().includes('error') || message.includes('No pudimos')
            ? <AlertCircle className="mt-0.5 size-4 shrink-0" />
            : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
          <span>{message}</span>
        </div>

        {session?.widgetEnabled ? (
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <div ref={widgetContainerRef} id="syncfy-widget" className="min-h-[640px]" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
