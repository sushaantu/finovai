import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2, Lock } from 'lucide-react'

import { SyncfyConnect } from '@/components/SyncfyConnect'
import { FinovaiLogo } from '@/components/LandingPage'
import { apiClient } from '@/lib/api'
import { setDashboardSession } from '@/lib/dashboard-session'

export type AuthMode = 'login' | 'signup'

interface AuthPageProps {
  mode: AuthMode
  initialEmail?: string
  onAuthenticated: (email: string) => void
  onNavigate: (path: string) => void
}

/** Steps the signup flow walks through. Login stops after 'code'. */
type Step = 'email' | 'code' | 'connect'

// Kept to one word each: three tracked-out labels have to sit on one line
// inside a 440px panel without truncating.
const signupSteps: { key: Step; label: string }[] = [
  { key: 'email', label: 'Correo' },
  { key: 'code', label: 'Código' },
  { key: 'connect', label: 'Banco' },
]

/**
 * Logged-out entry point for both intents, on the landing's dark canvas.
 *
 * `login` is deliberately one short column: a returning user knows what this
 * is and wants out of it fast. `signup` is framed as onboarding — numbered
 * steps, a visible finish line — because a first-time visitor needs to know
 * how much is left before they hand over a bank connection.
 */
export default function AuthPage({ mode, initialEmail = '', onAuthenticated, onNavigate }: AuthPageProps) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const isSignup = mode === 'signup'
  const verifiedEmail = email.trim().toLowerCase()

  const finish = (authedEmail: string) => {
    onAuthenticated(authedEmail)
    onNavigate('/dashboard')
  }

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!verifiedEmail.includes('@')) {
      setStatus('Ingresa un correo válido.')
      return
    }

    setIsBusy(true)
    setStatus(null)

    try {
      // Signup registers the address; login only asks for a fresh code.
      const response = isSignup
        ? await apiClient.signup(verifiedEmail, {
            diagnosticData: JSON.stringify({ source: 'auth-signup', capturedAt: new Date().toISOString() }),
          })
        : await apiClient.requestLoginLink(verifiedEmail)

      const registeredEmail = response.email || verifiedEmail

      // An already-verified session can skip the code entirely.
      if (!response.verificationRequired && response.clientSecret) {
        setDashboardSession(registeredEmail, response.clientSecret)
        if (isSignup) {
          setEmail(registeredEmail)
          setStep('connect')
          return
        }
        finish(registeredEmail)
        return
      }

      setEmail(registeredEmail)
      setStep('code')
      setStatus(
        response.debugCode
          ? `Código local: ${response.debugCode}`
          : 'Te enviamos un código de 6 dígitos a tu correo.'
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos continuar. Intenta de nuevo.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (code.trim().length < 4) {
      setStatus('Ingresa el código que enviamos a tu correo.')
      return
    }

    setIsBusy(true)
    setStatus(null)

    try {
      const response = await apiClient.verifyLoginCode(verifiedEmail, code.trim(), `auth-${mode}`)
      const registeredEmail = response.email || verifiedEmail
      setDashboardSession(registeredEmail, response.clientSecret)

      if (isSignup) {
        setEmail(registeredEmail)
        setStep('connect')
        setStatus(null)
        return
      }
      finish(registeredEmail)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'El código no es válido.')
    } finally {
      setIsBusy(false)
    }
  }

  const resendCode = async () => {
    setIsBusy(true)
    setStatus(null)
    try {
      const response = await apiClient.requestLoginLink(verifiedEmail)
      setStatus(response.debugCode ? `Código local: ${response.debugCode}` : 'Te enviamos un código nuevo.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pudimos reenviar el código.')
    } finally {
      setIsBusy(false)
    }
  }

  const activeIndex = signupSteps.findIndex((entry) => entry.key === step)

  return (
    <div className="finovai-landing landing-v2 auth-v2">
      <header className="auth-bar">
        <button className="landing-wordmark auth-wordmark" type="button" onClick={() => onNavigate('/')}>
          <FinovaiLogo />
          <span>
            finov<span>ai</span>
          </span>
        </button>

        <p className="auth-bar-aside">
          {isSignup ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'}{' '}
          <button type="button" onClick={() => onNavigate(isSignup ? '/login' : '/signup')}>
            {isSignup ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </p>
      </header>

      <main className={`auth-main${step === 'connect' ? ' auth-main-wide' : ''}`}>
        <div className="auth-panel">
          {isSignup ? (
            <ol className="auth-steps" aria-label="Progreso de registro">
              {signupSteps.map((entry, index) => {
                const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo'

                return (
                  <li key={entry.key} className={`auth-step auth-step-${state}`}>
                    <span className="auth-step-dot" aria-hidden="true">
                      {state === 'done' ? <Check /> : index + 1}
                    </span>
                    <span className="auth-step-label">{entry.label}</span>
                  </li>
                )
              })}
            </ol>
          ) : null}

          {step === 'email' ? (
            <>
              <h1 className="landing-display landing-display-sm">
                {isSignup ? (
                  <>
                    <em>Empieza</em> por preguntar.
                  </>
                ) : (
                  <>
                    <em>Vuelve</em> a tu dinero.
                  </>
                )}
              </h1>
              <p className="auth-lede">
                {isSignup
                  ? 'Crea tu cuenta con un correo. Sin contraseña, sin tarjeta: te mandamos un código y sigues.'
                  : 'Entra con tu correo. Te mandamos un código de acceso, sin contraseña que recordar.'}
              </p>

              <form className="auth-form" onSubmit={handleEmailSubmit}>
                <label className="auth-label" htmlFor="auth-email">
                  Correo
                </label>
                <input
                  id="auth-email"
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  autoFocus
                />
                <button className="landing-btn landing-btn-solid landing-btn-lg auth-submit" type="submit" disabled={isBusy}>
                  {isBusy ? <Loader2 className="auth-spin" aria-hidden="true" /> : null}
                  {isSignup ? 'Crear mi cuenta' : 'Entrar'}
                  {!isBusy ? <ArrowRight aria-hidden="true" /> : null}
                </button>
              </form>
            </>
          ) : null}

          {step === 'code' ? (
            <>
              <h1 className="landing-display landing-display-sm">
                <em>Revisa</em> tu correo.
              </h1>
              <p className="auth-lede">
                Enviamos un código de 6 dígitos a <b>{verifiedEmail}</b>.
              </p>

              <form className="auth-form" onSubmit={handleCodeSubmit}>
                <label className="auth-label" htmlFor="auth-code">
                  Código
                </label>
                <input
                  id="auth-code"
                  className="auth-input auth-input-code"
                  inputMode="numeric"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  autoFocus
                />
                <button className="landing-btn landing-btn-solid landing-btn-lg auth-submit" type="submit" disabled={isBusy}>
                  {isBusy ? <Loader2 className="auth-spin" aria-hidden="true" /> : null}
                  Verificar
                  {!isBusy ? <ArrowRight aria-hidden="true" /> : null}
                </button>
              </form>

              <div className="auth-row">
                <button
                  className="auth-link"
                  type="button"
                  onClick={() => {
                    setStep('email')
                    setCode('')
                    setStatus(null)
                  }}
                >
                  <ArrowLeft aria-hidden="true" /> Cambiar correo
                </button>
                <button className="auth-link" type="button" onClick={resendCode} disabled={isBusy}>
                  Reenviar código
                </button>
              </div>
            </>
          ) : null}

          {step === 'connect' ? (
            <>
              <h1 className="landing-display landing-display-sm">
                <em>Conecta</em> tu banco.
              </h1>
              <p className="auth-lede">
                Último paso. FinovAI lee tus movimientos para responderte con tus números reales — nunca puede
                mover dinero.
              </p>

              {/* SyncfyConnect is built from the dashboard's shadcn primitives, so it
                  needs that scope to theme at all; `dark` plus the token overrides in
                  .auth-connect keep it on the landing's canvas instead of the
                  dashboard's navy. */}
              <div className="auth-connect finovai-dashboard dark">
                <SyncfyConnect email={verifiedEmail} onStatus={setStatus} />
              </div>

              <div className="auth-row auth-row-end">
                <button className="auth-link" type="button" onClick={() => finish(verifiedEmail)}>
                  Lo hago después
                </button>
                <button
                  className="landing-btn landing-btn-solid auth-submit-inline"
                  type="button"
                  onClick={() => finish(verifiedEmail)}
                >
                  Ir a mi panel
                  <ArrowRight aria-hidden="true" />
                </button>
              </div>
            </>
          ) : null}

          {status ? (
            <p className="auth-status" role="status">
              {status}
            </p>
          ) : null}

          {/* Signup only: this reassures someone about to hand over a bank
              connection. A returning user is not connecting anything. */}
          {isSignup ? (
            <p className="auth-fineprint">
              <Lock aria-hidden="true" /> Conexión de solo lectura · Sin credenciales nuestras · Revocable cuando quieras
            </p>
          ) : null}
        </div>
      </main>
    </div>
  )
}
