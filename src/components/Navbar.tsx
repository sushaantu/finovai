import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'

import EmailSignup from './EmailSignup'

interface NavbarProps {
  email: string | null
  onDashboard: () => void
  onLoginSuccess: (email: string) => void
  onLogout: () => void
}

export default function Navbar({ email, onDashboard, onLoginSuccess, onLogout }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLoginSuccess = (nextEmail: string) => {
    setIsLoginOpen(false)
    setIsMenuOpen(false)
    onLoginSuccess(nextEmail)
  }

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <div className="relative mx-auto max-w-7xl">
        <div className={`flex items-center justify-between rounded-full border px-6 py-3.5 transition-all duration-500 ${
          isScrolled
            ? 'border-white/[0.15] bg-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl'
            : 'border-white/[0.08] bg-white/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl'
        }`}>
          <a href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
            <span className="font-display text-xl text-[--color-text]">FinovAI</span>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a href="/#conectar" className="text-sm text-[--color-text-muted] transition-colors duration-300 hover:text-[--color-text] focus-visible:outline-none focus-visible:underline">
              Cómo funciona
            </a>
            <a href="/#herramientas" className="text-sm text-[--color-text-muted] transition-colors duration-300 hover:text-[--color-text] focus-visible:outline-none focus-visible:underline">
              Herramientas
            </a>
            <a href="/#caracteristicas" className="text-sm text-[--color-text-muted] transition-colors duration-300 hover:text-[--color-text] focus-visible:outline-none focus-visible:underline">
              Características
            </a>
            <a href="/#faq" className="text-sm text-[--color-text-muted] transition-colors duration-300 hover:text-[--color-text] focus-visible:outline-none focus-visible:underline">
              FAQ
            </a>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {email ? (
              <>
                <button
                  type="button"
                  onClick={onDashboard}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  Mi panel
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] px-4 py-2.5 text-sm font-medium text-[--color-text-muted] transition-colors hover:bg-white/[0.08] hover:text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <LogOut className="size-4" />
                  Salir
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsLoginOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] px-4 py-2.5 text-sm font-medium text-[--color-text] transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  Entrar
                </button>
                <a
                  href="/#registro"
                  className="group inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  Analizar gastos
                  <svg className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </>
            )}
          </div>

          <button
            className="rounded-lg p-2 text-[--color-text-muted] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isMenuOpen}
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {isLoginOpen && !email ? (
          <div className="absolute right-0 top-[calc(100%+0.5rem)] hidden w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-white/[0.15] bg-zinc-950/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:block">
            <p className="mb-3 text-sm text-zinc-300">Entra con tu correo para seguir tu análisis.</p>
            <EmailSignup
              source="navbar-login"
              compact
              submitLabel="Entrar"
              idleMessage="Usaremos este correo para cargar tu panel."
              successMessage="Listo. Abriendo panel."
              onSuccess={handleLoginSuccess}
            />
          </div>
        ) : null}
      </div>

      {isMenuOpen && (
        <div className="mx-auto mt-2 max-w-7xl space-y-4 rounded-2xl border border-white/[0.15] bg-white/[0.08] px-6 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl md:hidden">
          <a href="/#conectar" className="block py-2 text-[--color-text-muted] transition-colors duration-300 hover:text-[--color-text]">
            Cómo funciona
          </a>
          <a href="/#herramientas" className="block py-2 text-[--color-text-muted] transition-colors duration-300 hover:text-[--color-text]">
            Herramientas
          </a>
          <a href="/#caracteristicas" className="block py-2 text-[--color-text-muted] transition-colors duration-300 hover:text-[--color-text]">
            Características
          </a>
          <a href="/#faq" className="block py-2 text-[--color-text-muted] transition-colors duration-300 hover:text-[--color-text]">
            FAQ
          </a>

          {email ? (
            <div className="grid gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false)
                  onDashboard()
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition-all duration-300 hover:bg-emerald-400"
              >
                Mi panel
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/[0.14] px-5 py-3 text-sm font-medium text-[--color-text] transition-colors hover:bg-white/[0.08]"
              >
                <LogOut className="size-4" />
                Salir
              </button>
            </div>
          ) : (
            <div className="grid gap-4 pt-2">
              <EmailSignup
                source="mobile-login"
                compact
                submitLabel="Entrar"
                idleMessage="Entra o crea tu panel con correo."
                successMessage="Listo. Abriendo panel."
                onSuccess={handleLoginSuccess}
              />
              <a
                href="/#registro"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/[0.14] px-5 py-3 text-sm font-medium text-[--color-text] transition-all duration-300 hover:bg-white/[0.08]"
              >
                Ver registro
              </a>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
