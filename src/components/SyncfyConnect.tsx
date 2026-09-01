import { useEffect, useRef, useState } from 'react'
import type { SocketMessage, SyncfyWidgetInstance } from '@syncfy/authentication-widget'
import syncfyWidgetUmdUrl from '../../node_modules/@syncfy/authentication-widget/dist/syncfy-authentication-widget.umd.js?url'
import '@syncfy/authentication-widget/dist/syncfy-authentication-widget.css'
import {
  AlertCircle,
  CheckCircle2,
  Landmark,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Trash2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ApiError } from '@finovai/core'
import { apiClient } from '@/lib/api'
import type { SyncfyCredential, SyncfySessionResponse } from '@finovai/core'

export type { SyncfyConnectionIssue, SyncfyCredential } from '@finovai/core'

interface SyncfyConnectProps {
  email: string
  initialCredentials?: SyncfyCredential[]
  isLoadingCredentials?: boolean
  onStatus?: (message: string) => void
  onSynced?: (dashboard: unknown) => void
  onCredentialsChange?: (credentials: SyncfyCredential[]) => void
}

type WidgetMode = 'create' | 'update'
type SyncfyWidgetConstructor = new (params: {
  token: string
  element: string | HTMLElement
  config?: Record<string, unknown>
  enableTestMode?: boolean
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

function formatConnectErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (
      msg.includes('failed to fetch') ||
      msg.includes('network error') ||
      msg.includes('networkerror') ||
      msg.includes('fetch failed') ||
      msg.includes('load failed') ||
      error.name === 'TypeError'
    ) {
      return 'No pudimos conectar con el servidor. Puedes volver a intentar.'
    }
    return error.message || fallback
  }
  return fallback
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

function getCredentialConnectionState(credential: SyncfyCredential) {
  if (credential.connectionState) return credential.connectionState
  if (credential.status === 'synced') return 'ready'
  if (credential.needsReconnect || credential.status === 'needs_reconnect') return 'action_required'
  if (credential.status === 'provider_unavailable') {
    return 'provider_unavailable'
  }
  if (credential.status === 'sync_error') return 'support_required'
  if (credential.connectionIssue?.kind === 'broken') return 'broken'
  if (credential.connectionIssue?.kind === 'abandoned') return 'abandoned'
  return 'verifying'
}

function formatConnectionIssueTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getCredentialStatusText(credential: SyncfyCredential) {
  if (credential.connectionIssue) {
    return credential.connectionIssue.message
  }

  const connectionState = getCredentialConnectionState(credential)
  if (connectionState === 'action_required') {
    return 'La institución necesita que actualices el acceso antes de importar movimientos.'
  }
  if (connectionState === 'provider_unavailable') {
    return 'La institución está fallando temporalmente. FinovAI reintentará automáticamente.'
  }
  if (connectionState === 'support_required') {
    return 'La conexión respondió con un error que el equipo de FinovAI debe revisar.'
  }
  if (connectionState === 'broken') {
    return 'La conexión con tu institución no ha logrado sincronizar. Estamos investigando con el proveedor.'
  }
  if (connectionState === 'abandoned') {
    return 'Esta conexión falló durante 14 días y fue retirada. Puedes volver a conectarla cuando quieras.'
  }

  if (credential.status === 'pending_transactions') {
    return credential.ready
      ? 'FinovAI está trayendo movimientos; puedes verificar ahora.'
      : `FinovAI está trayendo movimientos; siguiente verificación en ${formatCooldown(credential.cooldownSeconds)}.`
  }

  if (credential.needsReconnect || credential.status === 'needs_reconnect') {
    return credential.ready
      ? 'Reintenta sincronizar; si falla, actualiza el acceso.'
      : `Próximo intento en ${formatCooldown(credential.cooldownSeconds)}`
  }

  return credential.ready
    ? 'Lista para sincronizar'
    : `Próximo intento disponible en ${formatCooldown(credential.cooldownSeconds)}`
}

function getDefaultConnectMessage(credentials: SyncfyCredential[], activeLinkingId?: string | null) {
  const getEffectiveState = (credential: SyncfyCredential) => {
    if (activeLinkingId && credential.syncfyCredentialId === activeLinkingId) {
      const state = getCredentialConnectionState(credential)
      return state === 'action_required' ? 'verifying' : state
    }
    return getCredentialConnectionState(credential)
  }

  if (credentials.some((credential) => getEffectiveState(credential) === 'abandoned')) {
    return 'Una conexión fue retirada. Puedes volver a conectarla cuando quieras.'
  }

  if (credentials.some((credential) => getEffectiveState(credential) === 'action_required')) {
    return 'Una institución necesita que actualices el acceso para continuar.'
  }

  if (credentials.some((credential) => getEffectiveState(credential) === 'broken')) {
    return 'Una conexión no ha logrado sincronizar. Estamos investigando con el proveedor.'
  }

  if (credentials.some((credential) => getEffectiveState(credential) === 'provider_unavailable')) {
    return 'Una institución está fallando temporalmente. Puedes revisar el detalle y el código de soporte aquí.'
  }

  if (credentials.some((credential) => getEffectiveState(credential) === 'support_required')) {
    return 'Una conexión necesita revisión de FinovAI. Comparte el código de soporte con el equipo.'
  }

  if (credentials.some((credential) => credential.status === 'pending_transactions')) {
    return 'FinovAI está trayendo movimientos. Puedes ir a Chat; el análisis estará listo cuando lleguen.'
  }

  if (credentials.some((credential) => {
    if (activeLinkingId && credential.syncfyCredentialId === activeLinkingId) return false
    return credential.needsReconnect || credential.status === 'needs_reconnect'
  })) {
    return 'Hay una institución que necesita reconexión. Usa Actualizar acceso o vuelve a conectar.'
  }

  if (credentials.length > 0) {
    return 'Institución conectada. Puedes sincronizar cuando esté disponible.'
  }

  return 'Conecta tu banco para traer movimientos reales. Empieza con Conectar institución.'
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
  const sessionBaselineCredentialIdsRef = useRef<Set<string>>(new Set(initialCredentials.map((credential) => credential.syncfyCredentialId)))
  const [credentials, setCredentials] = useState<SyncfyCredential[]>(initialCredentials)
  const [session, setSession] = useState<SyncfySessionResponse | null>(null)
  const [widgetMode, setWidgetMode] = useState<WidgetMode>('create')
  const [activeCredentialId, setActiveCredentialId] = useState<string | null>(null)
  const [message, setMessage] = useState(() => getDefaultConnectMessage(initialCredentials))
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [openCredentialMenuId, setOpenCredentialMenuId] = useState<string | null>(null)
  const [deleteCredential, setDeleteCredential] = useState<SyncfyCredential | null>(null)
  const [isDeletingCredentialId, setIsDeletingCredentialId] = useState<string | null>(null)
  const [widgetRunId, setWidgetRunId] = useState(0)

  const isWidgetSessionActive = Boolean(session)
  const hasCredentials = credentials.length > 0
  const isBusy = isLoading || isRefreshing || Boolean(isDeletingCredentialId)
  const hasPendingTransactions = credentials.some((credential) => credential.status === 'pending_transactions')

  const isCredentialForWidgetRun = (credential: SyncfyCredential) => {
    if (widgetMode === 'update' && activeCredentialId) {
      return credential.syncfyCredentialId === activeCredentialId
    }

    return !sessionBaselineCredentialIdsRef.current.has(credential.syncfyCredentialId)
  }

  const hasReconnectRequired = credentials.some(
    (credential) => {
      const isLinking = isWidgetSessionActive && isCredentialForWidgetRun(credential)
      return getCredentialConnectionState(credential) === 'action_required' && !isLinking
    }
  )
  const hasProviderUnavailable = credentials.some(
    (credential) => getCredentialConnectionState(credential) === 'provider_unavailable'
  )
  const hasSupportRequired = credentials.some(
    (credential) => getCredentialConnectionState(credential) === 'support_required'
  )

  const applyCredentials = (nextCredentials: SyncfyCredential[]) => {
    setCredentials(nextCredentials)
    onCredentialsChange?.(nextCredentials)
  }

  const loadCredentials = async () => {
    const response = await apiClient.getSyncfyCredentials(email)
    applyCredentials(response.credentials)
    return response.credentials
  }

  const findCredentialForWidgetRun = (nextCredentials: SyncfyCredential[]) => {
    return nextCredentials.find(isCredentialForWidgetRun) || null
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

  const dismissWidgetSession = () => {
    closeWidget()
    setSession(null)
  }

  const pollForCredential = (attemptRefresh: boolean) => {
    clearCredentialPolling()
    let attempts = 0

    const tick = async () => {
      attempts += 1
      setMessage(attemptRefresh
        ? 'Verificando si los movimientos ya están disponibles.'
        : 'Verificando la conexión...')
      const nextCredentials = await loadCredentials().catch(() => [])
      const nextCredential = findCredentialForWidgetRun(nextCredentials)

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
      const response = await apiClient.captureSyncfyCredential(email, eventType, payload)

      applyCredentials(response.credentials)
      if (response.message) {
        setMessage(response.message)
        onStatus?.(response.message)
      }
      if (Array.isArray(response.transactions)) {
        onSynced?.(response)
      }

      const responseCredential = response.credential && isCredentialForWidgetRun(response.credential)
        ? response.credential
        : null
      const nextCredential = responseCredential || findCredentialForWidgetRun(response.credentials)
      if (nextCredential?.syncfyCredentialId) {
        window.setTimeout(() => {
          void refreshTransactions(nextCredential.syncfyCredentialId, response.pendingTransactions ? 1 : 0)
        }, 1200)
      }

      return true
    } catch (error) {
      const message = formatConnectErrorMessage(error, 'No pudimos guardar la institución conectada.')
      setMessage(message)
      onStatus?.(message)
      return !(error instanceof ApiError) || error.status !== 422
    }
  }

  useEffect(() => {
    setCredentials(initialCredentials)
    if (!session && !isLoading && !isRefreshing && !isDeletingCredentialId) {
      setMessage(getDefaultConnectMessage(initialCredentials))
    }
  }, [initialCredentials, isDeletingCredentialId, isLoading, isRefreshing, session])

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
        enableTestMode: Boolean(session.widgetEnableTestMode),
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
      widget.on('socket-message', (...args: unknown[]) => {
        const payload = args[0] as Partial<SocketMessage> | undefined
        if (!payload || typeof payload.code !== 'number') return

        const nextMessage = payload.code === 410
          ? 'Tu banco solicita el token móvil o un código de seguridad. Revisa su app y completa la verificación en este formulario.'
          : payload.code === 411
            ? 'El código de seguridad venció. Vuelve a intentarlo con la app de tu banco lista.'
            : null
        if (!nextMessage) return

        setMessage(nextMessage)
        onStatus?.(nextMessage)
      })
      widget.on('error', () => {
        const rid = widget.getLastRid?.()
        const fallbackMessage = rid ? `La conexión reportó un error. RID: ${rid}` : 'La conexión reportó un error.'
        setMessage(rid
          ? `Syncfy reportó una incidencia. RID: ${rid}. Verificando la conexión.`
          : 'Syncfy reportó una incidencia. Verificando la conexión.')

        window.setTimeout(() => {
          void loadCredentials()
            .then((nextCredentials) => {
              const nextCredential = findCredentialForWidgetRun(nextCredentials)
              if (nextCredential?.syncfyCredentialId) {
                dismissWidgetSession()
                const nextMessage = 'Institución detectada. Buscando movimientos.'
                setMessage(nextMessage)
                onStatus?.(nextMessage)
                void refreshTransactions(nextCredential.syncfyCredentialId, 0)
                return
              }

              dismissWidgetSession()
              setMessage(fallbackMessage)
              onStatus?.(fallbackMessage)
            })
            .catch(() => {
              setMessage(fallbackMessage)
              onStatus?.(fallbackMessage)
            })
        }, 1500)
      })
      widget.on('closed', () => {
        clearCredentialPolling()
        setSession(null)
        // Re-sync after the widget closes: an in-widget 2FA completion can leave
        // the stored credential in needs_user even though the institution has
        // already authorized it, and only a fresh refresh (which re-runs the
        // provider health check) recovers it without user action.
        void loadCredentials().then((nextCredentials) => {
          const nextCredential = findCredentialForWidgetRun(nextCredentials)
          if (nextCredential?.syncfyCredentialId) {
            void refreshTransactions(nextCredential.syncfyCredentialId, 0)
          }
        })
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

  useEffect(() => {
    if (!openCredentialMenuId) return

    const closeMenuOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-syncfy-credential-menu-root="true"]')) {
        return
      }
      setOpenCredentialMenuId(null)
    }

    window.addEventListener('pointerdown', closeMenuOnOutsidePointer)
    return () => {
      window.removeEventListener('pointerdown', closeMenuOnOutsidePointer)
    }
  }, [openCredentialMenuId])

  async function createSession(mode: WidgetMode, credentialId: string | null, showLoading = true) {
    if (showLoading) {
      setIsLoading(true)
      setOpenCredentialMenuId(null)
      clearTransactionRetry()
      sessionBaselineCredentialIdsRef.current = new Set(credentials.map((credential) => credential.syncfyCredentialId))
      setMessage(mode === 'update'
        ? 'Abriendo el formulario para actualizar el acceso.'
        : 'Abriendo el formulario. Después del éxito, los movimientos pueden tardar unos minutos en llegar.')
      closeWidget()
      setSession(null)
    }

    try {
      const response = await apiClient.createSyncfySession(email, { credentialId, mode })

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
      const nextMessage = formatConnectErrorMessage(error, 'No pudimos iniciar la conexión bancaria.')
      setMessage(nextMessage)
      onStatus?.(nextMessage)
      throw error
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  async function refreshTransactions(credentialId?: string, retryAttempt = 0) {
    if (retryAttempt === 0) clearTransactionRetry()
    setOpenCredentialMenuId(null)
    setIsRefreshing(true)
    setMessage(retryAttempt > 0
      ? 'Verificando si los movimientos ya están disponibles.'
      : 'Buscando movimientos nuevos.')

    try {
      const response = await apiClient.refreshSyncfyCredential(email, credentialId)

      const pendingTransactions = Boolean(response.pendingTransactions)
      const nextMessage = response.message || 'Movimientos sincronizados.'
      const nextCredentials = await loadCredentials()
      const refreshedCredential = credentialId
        ? nextCredentials.find((credential) => credential.syncfyCredentialId === credentialId)
        : nextCredentials[0]
      if (pendingTransactions && credentialId && retryAttempt < 8) {
        const waitSeconds = Math.max(
          refreshedCredential?.cooldownSeconds && refreshedCredential.cooldownSeconds > 0
            ? Math.min(refreshedCredential.cooldownSeconds, 45)
            : 20,
          10
        )
        setMessage(`Movimientos todavía no disponibles. Verificaremos otra vez en ${formatCooldown(waitSeconds)}.`)
        onStatus?.(nextMessage)
        clearTransactionRetry()
        retryTimeoutRef.current = window.setTimeout(() => {
          void refreshTransactions(credentialId, retryAttempt + 1)
        }, waitSeconds * 1000)
      } else {
        setMessage(nextMessage)
        onStatus?.(nextMessage)
      }
      onSynced?.(response)
    } catch (error) {
      const data = error instanceof ApiError
        ? (error.body as { credential?: SyncfyCredential; retryAfterSeconds?: number } | undefined)
        : undefined
      const isPendingCredential = data?.credential?.status === 'pending_transactions'
      const nextMessage = isPendingCredential
        ? 'Movimientos todavía no disponibles. FinovAI seguirá verificando.'
        : data?.retryAfterSeconds
          ? `Puedes volver a sincronizar en ${formatCooldown(data.retryAfterSeconds)}.`
          : formatConnectErrorMessage(error, 'No pudimos sincronizar movimientos.')
      setMessage(nextMessage)
      onStatus?.(nextMessage)
      await loadCredentials().catch(() => [])
    } finally {
      setIsRefreshing(false)
    }
  }

  async function deleteCredentialConnection() {
    if (!deleteCredential) return

    const credentialId = deleteCredential.syncfyCredentialId
    const credentialLabel = getCredentialLabel(deleteCredential)
    setIsDeletingCredentialId(credentialId)
    setOpenCredentialMenuId(null)
    setMessage(`Eliminando ${credentialLabel}.`)

    try {
      const response = await apiClient.deleteSyncfyCredential(email, credentialId)
      applyCredentials(response.credentials)
      onSynced?.(response)
      setDeleteCredential(null)

      const deletedCount = typeof response.deletedTransactions === 'number'
        ? ` Movimientos retirados: ${response.deletedTransactions}.`
        : ''
      const nextMessage = `${response.message || 'Institución eliminada.'}${deletedCount}`
      setMessage(nextMessage)
      onStatus?.(nextMessage)
    } catch (error) {
      const nextMessage = formatConnectErrorMessage(error, 'No pudimos eliminar la institución.')
      setMessage(nextMessage)
      onStatus?.(nextMessage)
    } finally {
      setIsDeletingCredentialId(null)
    }
  }

  return (
    <>
    <Card className={FINANCE_CONNECT_CARD_CLASS}>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>
            {hasReconnectRequired
              ? 'Una conexión requiere atención'
              : hasSupportRequired
                ? 'Una conexión necesita revisión'
              : hasProviderUnavailable
                ? 'Hay una incidencia con una institución'
                : hasPendingTransactions
                  ? 'Verificando conexiones'
                  : hasCredentials
                    ? 'Instituciones conectadas'
                    : 'Conecta una institución'}
          </CardTitle>
          <CardDescription>
            {hasReconnectRequired
              ? 'Revisa el motivo y actualiza el acceso desde la acción principal.'
              : hasSupportRequired
                ? 'Comparte el código de soporte para que FinovAI pueda revisar la respuesta.'
              : hasProviderUnavailable
                ? 'No necesitas volver a ingresar tu contraseña. FinovAI seguirá reintentando.'
                : hasPendingTransactions
                  ? 'La credencial está guardada, pero la institución todavía no confirma que los movimientos estén disponibles.'
                  : hasCredentials
                    ? 'Bancos, SAT, Bitso, American Express y fuentes compatibles en México.'
                    : 'Conecta tu banco para traer movimientos. Empieza con Conectar institución.'}
          </CardDescription>
        </div>
        <Badge variant={credentials.length > 0 ? 'secondary' : 'outline'}>
          {isLoadingCredentials
            ? 'Cargando'
            : hasReconnectRequired
              ? 'Acción requerida'
              : hasSupportRequired
                ? 'Revisión necesaria'
              : hasProviderUnavailable
                ? 'Incidencia'
                : hasPendingTransactions
                  ? 'Verificando'
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
            {credentials.map((credential) => {
              const menuId = `credential-menu-${credential.syncfyCredentialId}`
              const isLinking = isWidgetSessionActive && isCredentialForWidgetRun(credential)
              const rawConnectionState = getCredentialConnectionState(credential)
              const connectionState = (isLinking && rawConnectionState === 'action_required')
                ? 'verifying'
                : rawConnectionState
              const rawIssue = credential.connectionIssue
              const issue = (isLinking && rawIssue?.kind === 'action_required')
                ? null
                : rawIssue
              const needsReconnect = connectionState === 'action_required' || connectionState === 'abandoned'
              const providerUnavailable = connectionState === 'provider_unavailable'
              const supportRequired = connectionState === 'support_required'
              const isBroken = connectionState === 'broken'
              const isVerifying = connectionState === 'verifying'
              const primaryActionLabel = needsReconnect
                ? 'Actualizar acceso'
                : isBroken
                  ? 'Estamos investigando'
                  : providerUnavailable
                    ? credential.ready ? 'Reintentar' : 'Reintentaremos'
                    : supportRequired
                      ? credential.ready ? 'Reintentar' : 'Reintentar más tarde'
                    : isVerifying
                      ? credential.ready ? 'Verificar ahora' : 'Verificando'
                      : 'Sincronizar'
              const primaryActionDisabled = isBusy || isBroken || isLinking || (!needsReconnect && !credential.ready)
              const statusText = (isLinking && rawConnectionState === 'action_required')
                ? 'Estamos verificando la conexión…'
                : getCredentialStatusText(credential)

              return (
                <div
                  key={credential.syncfyCredentialId}
                  className={cn(FINANCE_CONNECT_INSET_CLASS, 'grid gap-3 p-3')}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
                        {getCredentialLogoText(credential)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{getCredentialLabel(credential)}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {needsReconnect
                            ? connectionState === 'abandoned'
                              ? 'Conexión retirada'
                              : 'La institución rechazó el acceso'
                            : isBroken
                              ? 'Esta conexión no está funcionando'
                            : providerUnavailable
                              ? 'Incidencia en la institución'
                              : supportRequired
                                ? 'FinovAI necesita revisar la respuesta'
                              : isVerifying
                                ? (isLinking ? 'Estamos verificando la conexión…' : 'Credencial guardada; verificando acceso')
                                : 'Movimientos importados'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {statusText}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant={needsReconnect ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          if (needsReconnect) {
                            void createSession('update', credential.syncfyCredentialId)
                            return
                          }
                          void refreshTransactions(credential.syncfyCredentialId, 0)
                        }}
                        disabled={primaryActionDisabled}
                      >
                        {isRefreshing
                          ? <Loader2 className="size-4 animate-spin" />
                          : <RefreshCw data-icon="inline-start" />}
                        {primaryActionLabel}
                      </Button>
                      <div className="relative" data-syncfy-credential-menu-root="true">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Más opciones para ${getCredentialLabel(credential)}`}
                          aria-haspopup="menu"
                          aria-expanded={openCredentialMenuId === credential.syncfyCredentialId}
                          aria-controls={menuId}
                          onPointerDown={(event) => {
                            event.preventDefault()
                            setOpenCredentialMenuId((current) => (
                              current === credential.syncfyCredentialId ? null : credential.syncfyCredentialId
                            ))
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            setOpenCredentialMenuId((current) => (
                              current === credential.syncfyCredentialId ? null : credential.syncfyCredentialId
                            ))
                          }}
                          disabled={isBusy}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                        {openCredentialMenuId === credential.syncfyCredentialId ? (
                          <div
                            id={menuId}
                            role="menu"
                            className="absolute right-0 top-[calc(100%+0.35rem)] z-20 grid min-w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                          >
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              Estado: {connectionState}
                            </div>
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                              onClick={() => void createSession('update', credential.syncfyCredentialId)}
                            >
                              <RefreshCw className="size-4" />
                              Actualizar acceso
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none"
                              onClick={() => {
                                setOpenCredentialMenuId(null)
                                setDeleteCredential(credential)
                              }}
                            >
                              <Trash2 className="size-4" />
                              Eliminar institución
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {issue ? (
                    <div
                      className={cn(
                        'flex items-start gap-2 rounded-xl border p-3 text-sm',
                        issue.kind === 'action_required' || issue.kind === 'abandoned'
                          ? 'border-destructive/20 bg-destructive/5 text-destructive'
                          : 'border-amber-500/20 bg-amber-500/8 text-amber-800 dark:text-amber-200'
                      )}
                      role={issue.kind === 'action_required' || issue.kind === 'abandoned' ? 'alert' : 'status'}
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">{issue.title}</p>
                        <p className="mt-1 leading-relaxed text-current/80">{issue.message}</p>
                        <p className="mt-2 text-xs text-current/70">
                          Último intento: {formatConnectionIssueTime(issue.occurredAt)}
                          {issue.supportCode ? ` · Código de soporte: ${issue.supportCode}` : ''}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
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
    <Dialog
      open={Boolean(deleteCredential)}
      onOpenChange={(open) => {
        if (!open && !isDeletingCredentialId) {
          setDeleteCredential(null)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar institución</DialogTitle>
          <DialogDescription>
            Se eliminará {deleteCredential ? getCredentialLabel(deleteCredential) : 'esta institución'} de FinovAI y se retirarán los movimientos importados desde esa conexión.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteCredential(null)}
            disabled={Boolean(isDeletingCredentialId)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void deleteCredentialConnection()}
            disabled={Boolean(isDeletingCredentialId)}
          >
            {isDeletingCredentialId ? <Loader2 className="size-4 animate-spin" /> : <Trash2 data-icon="inline-start" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
