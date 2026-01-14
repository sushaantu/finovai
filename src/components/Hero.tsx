interface HeroProps {
  onChatOpen: () => void
}

export default function Hero({ onChatOpen }: HeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero2.png')" }}
      />

      {/* Gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-stone-950/50 to-stone-950/80" />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-32 text-center">
        {/* Tagline chip */}
        <div className="mb-8">
          <span className="inline-flex items-center px-4 py-2 rounded-full bg-stone-800/60 border border-stone-700/50 text-sm tracking-wide text-amber-100/90 backdrop-blur-sm">
            Tu asesor financiero con IA
          </span>
        </div>

        {/* Main headline */}
        <h1 className="mb-6">
          <span className="block font-display text-5xl md:text-6xl lg:text-7xl text-amber-50 leading-[1.1] tracking-tight text-shadow-hero">
            Ordena tu casa
          </span>
          <span className="block font-serif text-5xl md:text-6xl lg:text-7xl text-amber-100/90 leading-[1.1] italic mt-1 text-shadow-hero">
            financiera
          </span>
        </h1>

        {/* Description */}
        <p className="mb-10 text-lg text-stone-200 max-w-md mx-auto leading-relaxed text-shadow-strong">
          Entiende tus finanzas, crea estructura y encuentra claridad.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-14">
          <button
            onClick={onChatOpen}
            className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-amber-50 text-stone-900 font-medium rounded-full hover:bg-white transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 shadow-lg"
          >
            Comenzar
            <svg
              className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
          <a
            href="#como-funciona"
            className="inline-flex items-center justify-center px-8 py-4 text-stone-200 font-medium hover:text-amber-100 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 rounded-full text-shadow-strong"
          >
            Saber más
          </a>
        </div>

        {/* Trust indicators */}
        <p className="text-sm text-stone-300 text-shadow">
          Gratis para empezar · Sin tarjeta
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-gentle-float">
        <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  )
}
