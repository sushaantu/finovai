import { useState } from 'react'

interface NavbarProps {
  onChatOpen: () => void
}

export default function Navbar({ onChatOpen }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 pt-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4 bg-neutral-900/80 backdrop-blur-md rounded-2xl border border-neutral-700/30">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200/50 rounded-lg">
          <span className="font-display text-xl text-white">
            FinovAI
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#como-funciona" className="text-sm text-neutral-300 hover:text-neutral-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            Cómo funciona
          </a>
          <a href="#caracteristicas" className="text-sm text-neutral-300 hover:text-neutral-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            Características
          </a>
          <a href="#faq" className="text-sm text-neutral-300 hover:text-neutral-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            FAQ
          </a>
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={onChatOpen}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-neutral-900 font-medium text-sm rounded-full hover:bg-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200/50"
          >
            Comenzar gratis
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200/50 rounded-lg"
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
        <div className="md:hidden max-w-6xl mx-auto mt-2 px-6 py-4 space-y-4 bg-neutral-900/90 backdrop-blur-md rounded-2xl border border-neutral-700/30">
          <a href="#como-funciona" className="block text-neutral-300 hover:text-neutral-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            Cómo funciona
          </a>
          <a href="#caracteristicas" className="block text-neutral-300 hover:text-neutral-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            Características
          </a>
          <a href="#faq" className="block text-neutral-300 hover:text-neutral-100 transition-colors duration-300 focus-visible:outline-none focus-visible:underline">
            FAQ
          </a>
          <button
            onClick={onChatOpen}
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 bg-white text-neutral-900 font-medium text-sm rounded-full hover:bg-white transition-all duration-300 mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200/50"
          >
            Comenzar gratis
          </button>
        </div>
      )}
    </nav>
  )
}
