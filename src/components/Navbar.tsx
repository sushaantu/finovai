import { useState, useEffect } from 'react'

interface NavbarProps {
  onChatOpen: () => void
}

export default function Navbar({ onChatOpen }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

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
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={onChatOpen}
            className="group inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white font-medium text-sm rounded-full transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            Comenzar gratis
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
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
          <button
            onClick={() => {
              onChatOpen()
              setIsMenuOpen(false)
            }}
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-emerald-500 text-white font-medium text-sm rounded-full mt-2 transition-all duration-300 hover:bg-emerald-400"
          >
            Comenzar gratis
          </button>
        </div>
      )}
    </nav>
  )
}
