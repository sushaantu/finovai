import { useState, useEffect } from 'react'

interface HeroProps {
  onChatOpen: () => void
}

export default function Hero({ onChatOpen }: HeroProps) {
  const [displayText, setDisplayText] = useState('')
  const fullText = '¿En qué se me va el dinero?'
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    if (isTyping && displayText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setDisplayText(fullText.slice(0, displayText.length + 1))
      }, 80)
      return () => clearTimeout(timeout)
    } else if (displayText.length === fullText.length) {
      const timeout = setTimeout(() => {
        setIsTyping(false)
        setTimeout(() => {
          setDisplayText('')
          setIsTyping(true)
        }, 2000)
      }, 1500)
      return () => clearTimeout(timeout)
    }
  }, [displayText, isTyping])

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
        style={{ backgroundImage: "url('/hero2.png')" }}
      />

      {/* Gradient overlay - softer to let image show through */}
      <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-neutral-950/70 to-neutral-950/50" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div>
            {/* Tagline chip */}
            <div className="mb-8">
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-sm tracking-wide text-neutral-300 backdrop-blur-sm">
                Tu asesor financiero con IA
              </span>
            </div>

            {/* Main headline */}
            <h1 className="mb-6">
              <span className="block font-display text-4xl md:text-5xl lg:text-6xl text-white leading-[1.1] tracking-tight">
                Ordena tu casa
              </span>
              <span className="block font-serif text-4xl md:text-5xl lg:text-6xl text-emerald-400 leading-[1.1] italic mt-1">
                financiera
              </span>
            </h1>

            {/* Typing effect */}
            <div className="mb-6 h-8">
              <span className="text-lg text-neutral-400">
                "{displayText}
                <span className="typing-cursor" />
                "
              </span>
            </div>

            {/* Description */}
            <p className="mb-8 text-lg text-neutral-300 max-w-md leading-relaxed">
              FinovAI te ayuda a entender tus finanzas, crear estructura y, cuando estés listo, invertir con claridad. Sin humo, con proceso.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <button
                onClick={onChatOpen}
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-neutral-900 font-medium rounded-full hover:bg-neutral-100 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 shadow-lg"
              >
                Habla con FinovAI
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
                className="inline-flex items-center justify-center px-8 py-4 text-neutral-300 font-medium hover:text-white transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-full"
              >
                Ver cómo funciona
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center gap-4 text-sm text-neutral-500">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Gratis para empezar
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Sin tarjeta de crédito
              </span>
            </div>
          </div>

          {/* Right: Phone mockup */}
          <div className="hidden lg:flex justify-center">
            <div className="phone-mockup">
              <div className="phone-notch" />
              <div className="phone-screen p-6">
                {/* Financial Index Card */}
                <div className="bg-neutral-800/50 rounded-2xl p-5 border border-neutral-700/50">
                  <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Tu Índice Financiero</p>

                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-display text-5xl text-emerald-400">73</span>
                    <span className="text-sm text-emerald-400/70">+12 este mes</span>
                  </div>

                  {/* Mini chart */}
                  <div className="flex items-end gap-1 h-16 mt-4 mb-4">
                    {[40, 45, 42, 50, 55, 52, 60, 65, 62, 70, 73].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-emerald-500/30 rounded-sm"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>

                  {/* Stats row */}
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-neutral-500">Gastos</p>
                      <p className="text-neutral-200 font-medium">$2,450</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Ahorro</p>
                      <p className="text-emerald-400 font-medium">$580</p>
                    </div>
                  </div>
                </div>

                {/* AI Suggestion */}
                <div className="mt-4 bg-violet-500/10 rounded-xl p-4 border border-violet-500/20">
                  <div className="flex items-start gap-2">
                    <span className="text-violet-400">✦</span>
                    <div>
                      <p className="text-sm text-violet-300 font-medium">FinovAI dice:</p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Podrías ahorrar $100 más reduciendo suscripciones.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-gentle-float">
        <svg className="w-6 h-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  )
}
