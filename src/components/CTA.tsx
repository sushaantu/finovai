import { useEffect, useRef, useState } from 'react'

interface CTAProps {
  onChatOpen: () => void
}

export default function CTA({ onChatOpen }: CTAProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.3 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="relative py-32 px-6 bg-[--color-bg] overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="glow-emerald top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30" />

      <div className="relative max-w-7xl mx-auto">
        <div className={`relative rounded-[2.5rem] overflow-hidden transition-all duration-1000 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
          {/* Card background with gradient border effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-violet-500/20 rounded-[2.5rem]" />
          <div className="absolute inset-[1px] bg-gradient-to-b from-[--color-bg-tertiary] to-[--color-bg-secondary] rounded-[calc(2.5rem-1px)]" />

          <div className="relative p-12 md:p-20 text-center">
            {/* Floating shapes */}
            <div className="absolute top-10 left-10 w-20 h-20 rounded-full border border-emerald-500/10 animate-float" />
            <div className="absolute bottom-10 right-10 w-16 h-16 rounded-full border border-violet-500/10 animate-float" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/4 right-20 w-3 h-3 rounded-full bg-emerald-500/30 animate-float" style={{ animationDelay: '0.5s' }} />

            {/* Badge */}
            <span className={`inline-flex items-center px-4 py-2 rounded-full glass text-[11px] uppercase tracking-widest text-[--color-text-dim] font-semibold mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '100ms' }}>
              Empieza Hoy
            </span>

            {/* Headline */}
            <h2 className={`font-display text-4xl md:text-5xl lg:text-6xl text-[--color-text] mb-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
              Tu mejor inversión es
            </h2>
            <p className={`font-serif text-4xl md:text-5xl lg:text-6xl text-emerald-400 italic transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '300ms' }}>
              tener un sistema
            </p>

            {/* Description */}
            <p className={`text-lg text-[--color-text-muted] mb-12 max-w-lg mx-auto mt-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '400ms' }}>
              Empieza ordenando tu casa financiera. Nuestro asesor IA te guiará en tu diagnóstico inicial.
            </p>

            {/* CTA Button */}
            <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '500ms' }}>
              <button
                onClick={onChatOpen}
                className="group inline-flex items-center gap-3 px-10 py-5 bg-emerald-500 text-white font-semibold rounded-full transition-all duration-300 hover:bg-emerald-400 hover:scale-[1.02] hover:shadow-[0_30px_60px_rgba(16,185,129,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <span className="text-lg">Habla con FinovAI</span>
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>

            {/* Trust note */}
            <p className={`text-sm text-[--color-text-dim] mt-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '600ms' }}>
              Sin tarjeta de crédito • Gratis para empezar
            </p>

            {/* Trust badges */}
            <div className={`flex flex-wrap justify-center gap-2 md:gap-6 mt-10 text-sm text-[--color-text-dim] transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '700ms' }}>
              <span className="px-4 py-2 rounded-full bg-white/5 border border-white/5">Con dato, no con vibes</span>
              <span className="px-4 py-2 rounded-full bg-white/5 border border-white/5">Plan {">"} impulso</span>
              <span className="px-4 py-2 rounded-full bg-white/5 border border-white/5">Menos ruido, más proceso</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
