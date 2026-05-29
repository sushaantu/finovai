import { FormEvent, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { setDashboardSession } from '@/lib/dashboard-session'

interface EmailSignupProps {
  source: string
  className?: string
  onSuccess?: (email: string) => void
  submitLabel?: string
  idleMessage?: string
  loadingMessage?: string
  successMessage?: string
  compact?: boolean
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function EmailSignup({
  source,
  className = '',
  onSuccess,
  submitLabel = 'Analizar mis gastos',
  idleMessage = 'Verás un ejemplo y podrás subir tu cartola o cargar gastos manuales.',
  loadingMessage = 'Preparando tu análisis...',
  successMessage = 'Listo. Abriendo tu análisis.',
  compact = false,
}: EmailSignupProps) {
  const [email, setEmail] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState(idleMessage)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (!pendingEmail && !EMAIL_PATTERN.test(normalizedEmail)) {
      setStatus('error')
      setMessage('Escribe un email válido.')
      return
    }
    if (pendingEmail && code.trim().length < 4) {
      setStatus('error')
      setMessage('Escribe el código que enviamos a tu email.')
      return
    }

    setStatus('loading')
    setMessage(pendingEmail ? 'Verificando código...' : loadingMessage)

    try {
      const response = await fetch(pendingEmail ? '/api/auth/verify' : '/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingEmail
          ? {
              email: pendingEmail,
              code: code.trim(),
              source,
            }
          : {
              email: normalizedEmail,
              redirectPath: '/dashboard',
              diagnosticData: JSON.stringify({
                source,
                capturedAt: new Date().toISOString(),
              }),
            }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'No pudimos guardar tu email.')
      }

      if (data.verificationRequired) {
        const nextEmail = data.email || normalizedEmail
        setPendingEmail(nextEmail)
        setStatus('success')
        setMessage(data.debugCode ? `Código local: ${data.debugCode}` : 'Te enviamos un código y link de acceso a tu email.')
        return
      }

      setEmail('')
      setCode('')
      setPendingEmail('')
      setStatus('success')
      setMessage(successMessage)
      setDashboardSession(data.email || normalizedEmail, data.clientSecret)
      onSuccess?.(data.email || normalizedEmail)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'No pudimos guardar tu email.')
    }
  }

  const isLoading = status === 'loading'
  const StatusIcon = status === 'success' ? CheckCircle2 : status === 'error' ? AlertCircle : Mail

  return (
    <div
      id={source === 'hero' ? 'registro' : undefined}
      className={cn('w-full', compact ? 'max-w-none' : 'max-w-xl', className)}
    >
      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex w-full flex-col gap-3 border border-white/10 bg-black/25 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:flex-row',
          compact ? 'rounded-2xl p-2' : 'rounded-[2rem] p-2'
        )}
      >
        <label className="sr-only" htmlFor={`email-signup-${source}`}>
          Email
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-white/[0.04] px-4 py-3 text-left">
          <Mail className="size-4 shrink-0 text-emerald-400" />
          <Input
            id={`email-signup-${source}`}
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setPendingEmail('')
              setCode('')
              if (status !== 'idle') {
                setStatus('idle')
                setMessage(idleMessage)
              }
            }}
            placeholder="tu@email.com"
            autoComplete="email"
            disabled={isLoading}
            className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-white shadow-none outline-none placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
          />
        </div>
        {pendingEmail ? (
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-white/[0.04] px-4 py-3 text-left sm:max-w-40">
            <Input
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Código"
              autoComplete="one-time-code"
              disabled={isLoading}
              className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-white shadow-none outline-none placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
            />
          </div>
        ) : null}
        <Button
          type="submit"
          disabled={isLoading}
          className={cn(
            'h-12 rounded-full bg-white px-5 text-sm font-semibold text-zinc-950 transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70',
            compact && 'shrink-0'
          )}
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendingEmail ? 'Verificar' : submitLabel}
        </Button>
      </form>
      <p
        className={`mt-3 flex items-center gap-2 text-sm ${
          status === 'success' ? 'text-emerald-300' : status === 'error' ? 'text-red-300' : 'text-zinc-500'
        }`}
        role="status"
      >
        <StatusIcon className="size-4 shrink-0" />
        {message}
      </p>
    </div>
  )
}
