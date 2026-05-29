import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, DatabaseZap, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ADMIN_SECRET_STORAGE_KEY = 'finovai_syncfy_admin_secret'

interface SyncfyAdminSummary {
  webhookSecretConfigured: boolean
  emailSendingConfigured: boolean
  supportAdminSecretConfigured: boolean
  lastWebhookAt: string | null
  lastWebhookEvent: string | null
  webhookStatus: string
  lastErrorAt: string | null
  recentErrorCount: number
}

interface SyncfyAdminUser {
  email: string
  syncfy_user_id: string
  mode: string
  created_at: string
  updated_at: string | null
  last_session_at: string | null
}

interface SyncfyAdminCredential {
  email: string
  syncfy_user_id: string
  syncfy_credential_id: string
  site_name: string | null
  status: string | null
  last_successful_sync_at: string | null
  last_pull_at: string | null
  last_rid: string | null
  updated_at: string | null
}

interface SyncfyAdminError {
  id: string
  email: string | null
  syncfy_user_id: string | null
  syncfy_credential_id: string | null
  rid: string | null
  status_code: number | null
  error_code: string | null
  message: string | null
  source: string
  institution: string | null
  created_at: string
}

interface SyncfyAdminWebhook {
  id: string
  event_type: string
  syncfy_user_id: string | null
  syncfy_credential_id: string | null
  rid: string | null
  processed_at: string | null
  created_at: string
}

interface SyncfyAdminResponse {
  success: boolean
  environment: string
  email: string | null
  summary: SyncfyAdminSummary
  users: SyncfyAdminUser[]
  credentials: SyncfyAdminCredential[]
  errors: SyncfyAdminError[]
  webhooks: SyncfyAdminWebhook[]
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-MX', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortId(value: string | null | undefined) {
  if (!value) return '—'
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
}

export default function SyncfyAdminPage() {
  const [secret, setSecret] = useState(() =>
    typeof window === 'undefined' ? '' : window.sessionStorage.getItem(ADMIN_SECRET_STORAGE_KEY) || ''
  )
  const [email, setEmail] = useState('')
  const [data, setData] = useState<SyncfyAdminResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const statusCards = useMemo(() => {
    if (!data) return []
    return [
      {
        label: 'Webhook',
        value: data.summary.webhookStatus === 'none' ? 'Sin eventos' : data.summary.webhookStatus,
        active: data.summary.webhookSecretConfigured,
      },
      {
        label: 'Último error',
        value: formatDate(data.summary.lastErrorAt),
        active: data.summary.recentErrorCount === 0,
      },
      {
        label: 'Email sending',
        value: data.summary.emailSendingConfigured ? 'Binding listo' : 'No onboarded',
        active: data.summary.emailSendingConfigured,
      },
    ]
  }, [data])

  const loadData = async (event?: FormEvent) => {
    event?.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ limit: '75' })
      if (email.trim()) params.set('email', email.trim())
      const response = await fetch(`/api/admin/syncfy?${params.toString()}`, {
        headers: { 'X-FinovAI-Admin-Secret': secret },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'No autorizado')
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ADMIN_SECRET_STORAGE_KEY, secret)
      }
      setData(payload as SyncfyAdminResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar soporte Syncfy.')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (secret) void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="finovai-dashboard dark min-h-screen bg-[#071326] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#00D4AA]/12 text-[#00D4AA]">
              <DatabaseZap className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00D4AA]">Soporte interno</p>
              <h1 className="text-2xl font-semibold tracking-tight">Syncfy health desk</h1>
            </div>
          </div>
          <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white">
            <ArrowLeft className="size-4" />
            Volver al inicio
          </a>
        </header>

        <Card className="rounded-lg border-white/10 bg-white/[0.04] text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-[#2B7AE8]" />
              Acceso de soporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={loadData}>
              <input
                type="text"
                name="username"
                value="support-admin"
                autoComplete="username"
                readOnly
                className="sr-only"
                tabIndex={-1}
              />
              <div className="grid gap-2">
                <Label htmlFor="admin-secret">Admin secret</Label>
                <Input
                  id="admin-secret"
                  type="password"
                  autoComplete="current-password"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="X-FinovAI-Admin-Secret"
                  className="border-white/10 bg-[#0A1628] text-white"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="support-email">Filtrar por email</Label>
                <Input
                  id="support-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="mosoriom507@gmail.com"
                  className="border-white/10 bg-[#0A1628] text-white"
                />
              </div>
              <Button type="submit" disabled={isLoading || !secret} className="self-end bg-[#2B7AE8] text-white hover:bg-[#2167c7]">
                {isLoading ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Actualizar
              </Button>
            </form>
            {error ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {data ? (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              {statusCards.map((card) => (
                <Card key={card.label} className="rounded-lg border-white/10 bg-white/[0.04] text-white">
                  <CardContent className="flex items-center justify-between gap-3 p-5">
                    <div>
                      <p className="text-sm text-white/60">{card.label}</p>
                      <p className="mt-1 text-lg font-semibold">{card.value}</p>
                    </div>
                    <Badge className={card.active ? 'bg-[#00D4AA]/15 text-[#00D4AA]' : 'bg-amber-400/15 text-amber-200'}>
                      {card.active ? 'OK' : 'Revisar'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
              <Card className="rounded-lg border-white/10 bg-white/[0.04] text-white">
                <CardHeader>
                  <CardTitle>Errores Syncfy</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Institución</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>RID</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.errors.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.email || '—'}</TableCell>
                          <TableCell>{item.institution || '—'}</TableCell>
                          <TableCell>{item.status_code || item.error_code || '—'}</TableCell>
                          <TableCell className="font-mono normal-case tracking-normal">{shortId(item.rid)}</TableCell>
                          <TableCell>{item.source}</TableCell>
                          <TableCell>{formatDate(item.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="rounded-lg border-white/10 bg-white/[0.04] text-white">
                <CardHeader>
                  <CardTitle>Usuarios</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {data.users.map((item) => (
                    <div key={item.email} className="rounded-lg border border-white/10 bg-[#0A1628] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-medium">{item.email}</p>
                        <Badge variant="outline">{item.mode}</Badge>
                      </div>
                      <p className="mt-2 font-mono text-xs normal-case tracking-normal text-white/55">{item.syncfy_user_id}</p>
                      <p className="mt-1 text-xs text-white/55">Última sesión: {formatDate(item.last_session_at)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-lg border-white/10 bg-white/[0.04] text-white">
                <CardHeader>
                  <CardTitle>Credenciales</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Institución</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Último pull</TableHead>
                        <TableHead>RID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.credentials.map((item) => (
                        <TableRow key={`${item.email}-${item.syncfy_credential_id}`}>
                          <TableCell>{item.email}</TableCell>
                          <TableCell>{item.site_name || shortId(item.syncfy_credential_id)}</TableCell>
                          <TableCell>{item.status || '—'}</TableCell>
                          <TableCell>{formatDate(item.last_pull_at || item.last_successful_sync_at)}</TableCell>
                          <TableCell className="font-mono normal-case tracking-normal">{shortId(item.last_rid)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="rounded-lg border-white/10 bg-white/[0.04] text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-[#00D4AA]" />
                    Webhooks
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Evento</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Credential</TableHead>
                        <TableHead>RID</TableHead>
                        <TableHead>Procesado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.webhooks.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.event_type}</TableCell>
                          <TableCell className="font-mono normal-case tracking-normal">{shortId(item.syncfy_user_id)}</TableCell>
                          <TableCell className="font-mono normal-case tracking-normal">{shortId(item.syncfy_credential_id)}</TableCell>
                          <TableCell className="font-mono normal-case tracking-normal">{shortId(item.rid)}</TableCell>
                          <TableCell>{formatDate(item.processed_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
