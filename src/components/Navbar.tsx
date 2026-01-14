import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AuthFlow } from '@/components/auth'
import { User, LogOut, ChevronDown } from 'lucide-react'

interface NavbarProps {
  onChatOpen: () => void
}

export default function Navbar({ onChatOpen }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const { user, isAuthenticated, logout, isLoading } = useAuth()
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 sm:px-6">
      <div className={`max-w-7xl mx-auto flex items-center justify-between px-6 py-3.5 rounded-full border transition-all duration-500 ${
        isScrolled
          ? 'bg-white/[0.08] backdrop-blur-2xl border-white/[0.15] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]'
          : 'bg-white/[0.05] backdrop-blur-xl border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]'
      }`}>
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-lg">
          <span className="font-display text-xl text-[--color-text]">
            FinovAI
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#como-funciona" className="text-sm text-[--color-text-muted] hover:text-[--color-text] transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            Cómo funciona
          </a>
          <a href="#caracteristicas" className="text-sm text-[--color-text-muted] hover:text-[--color-text] transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            Características
          </a>
          <a href="#faq" className="text-sm text-[--color-text-muted] hover:text-[--color-text] transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            FAQ
          </a>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <button
                onClick={onChatOpen}
                className="group inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-medium text-sm rounded-full transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                Abrir chat
              </button>
              {/* Account dropdown */}
              <div className="relative" ref={accountRef}>
                <button
                  onClick={() => setIsAccountOpen(!isAccountOpen)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-full text-sm text-zinc-300 transition-colors hover:bg-white/5"
                >
                  <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-semibold text-white">
                    {user?.displayName?.[0]?.toUpperCase() || user?.phone?.slice(-2)}
                  </div>
                  <ChevronDown className={`size-4 transition-transform ${isAccountOpen ? 'rotate-180' : ''}`} />
                </button>
                {isAccountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-xl">
                    <div className="border-b border-white/10 px-4 py-3">
                      <p className="text-sm font-medium text-white">{user?.displayName || 'Usuario'}</p>
                      <p className="text-xs text-zinc-500">{user?.phone}</p>
                    </div>
                    <button
                      onClick={() => {
                        logout()
                        setIsAccountOpen(false)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <LogOut className="size-4" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
              >
                Iniciar sesión
              </button>
              <button
                onClick={onChatOpen}
                className="group inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-medium text-sm rounded-full transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                Comenzar gratis
                <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-[--color-text-muted] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-lg hover:bg-white/5 transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isMenuOpen}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden max-w-7xl mx-auto mt-2 px-6 py-5 space-y-4 bg-white/[0.08] backdrop-blur-2xl rounded-2xl border border-white/[0.15] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <a href="#como-funciona" className="block text-[--color-text-muted] hover:text-[--color-text] transition-colors duration-300 py-2">
            Cómo funciona
          </a>
          <a href="#caracteristicas" className="block text-[--color-text-muted] hover:text-[--color-text] transition-colors duration-300 py-2">
            Características
          </a>
          <a href="#faq" className="block text-[--color-text-muted] hover:text-[--color-text] transition-colors duration-300 py-2">
            FAQ
          </a>
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-3 py-2 border-t border-white/10 mt-4 pt-4">
                <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-semibold text-white">
                  {user?.displayName?.[0]?.toUpperCase() || user?.phone?.slice(-2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{user?.displayName || 'Usuario'}</p>
                  <p className="text-xs text-zinc-500">{user?.phone}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  onChatOpen()
                  setIsMenuOpen(false)
                }}
                className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-emerald-500 text-white font-medium text-sm rounded-full transition-all duration-300 hover:bg-emerald-400"
              >
                Abrir chat
              </button>
              <button
                onClick={() => {
                  logout()
                  setIsMenuOpen(false)
                }}
                className="flex items-center justify-center gap-2 w-full px-5 py-3 text-zinc-400 text-sm transition-colors hover:text-white"
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsAuthOpen(true)
                  setIsMenuOpen(false)
                }}
                className="block w-full text-center text-[--color-text-muted] hover:text-[--color-text] transition-colors duration-300 py-2 border-t border-white/10 mt-4 pt-4"
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => {
                  onChatOpen()
                  setIsMenuOpen(false)
                }}
                className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-emerald-500 text-white font-medium text-sm rounded-full mt-2 transition-all duration-300 hover:bg-emerald-400"
              >
                Comenzar gratis
              </button>
            </>
          )}
        </div>
      )}

      {/* Auth modal */}
      <AuthFlow
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {
          // Optionally open chat after successful login
        }}
      />
    </nav>
  )
}
