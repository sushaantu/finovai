import { useState } from 'react'

interface NavbarProps {
  onChatOpen: () => void
}

export default function Navbar({ onChatOpen }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="absolute top-0 left-0 right-0 z-50 px-4 md:px-6 pt-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-6 md:px-8 py-4 bg-stone-900/40 backdrop-blur-md rounded-2xl border border-stone-700/30">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/50 rounded-lg">
          <span className="font-display text-xl text-amber-50">
            FinovAI
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#como-funciona" className="text-sm text-stone-300 hover:text-amber-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            Cómo funciona
          </a>
          <a href="#caracteristicas" className="text-sm text-stone-300 hover:text-amber-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            Características
          </a>
          <a href="#faq" className="text-sm text-stone-300 hover:text-amber-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            FAQ
          </a>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={onChatOpen}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-50/10 text-amber-100 font-medium text-sm rounded-full border border-amber-200/20 hover:bg-amber-50/20 hover:border-amber-200/30 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/50"
          >
            Comenzar
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/50 rounded-lg"
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
        <div className="md:hidden max-w-4xl mx-auto mt-2 px-6 py-4 space-y-4 bg-stone-900/60 backdrop-blur-md rounded-2xl border border-stone-700/30">
          <a href="#como-funciona" className="block text-stone-300 hover:text-amber-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            Cómo funciona
          </a>
          <a href="#caracteristicas" className="block text-stone-300 hover:text-amber-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            Características
          </a>
          <a href="#faq" className="block text-stone-300 hover:text-amber-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            FAQ
          </a>
          <button
            onClick={onChatOpen}
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 bg-amber-50/10 text-amber-100 font-medium text-sm rounded-full border border-amber-200/20 hover:bg-amber-50/20 transition-all duration-300 mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/50"
          >
            Comenzar
          </button>
        </div>
      )}
    </nav>
  )
}
