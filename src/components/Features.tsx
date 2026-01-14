import { useEffect, useRef, useState } from 'react'

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.15 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const features = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "Índice de Orden Financiero",
      description: "Tu score de 0-100 que mide qué tan ordenadas están tus finanzas. Trackea tu progreso mes a mes.",
      gradient: "from-emerald-500/20 to-emerald-500/5",
      iconColor: "text-emerald-400",
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      title: "Pregúntale a FinovAI",
      description: "Tu asesor financiero 24/7. Pregunta lo que sea sobre tus finanzas y recibe respuestas personalizadas.",
      gradient: "from-violet-500/20 to-violet-500/5",
      iconColor: "text-violet-400",
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      title: "Plan personalizado",
      description: "No templates genéricos. Tu plan basado en tu situación real, tus metas y tu tolerancia al riesgo.",
      gradient: "from-amber-500/20 to-amber-500/5",
      iconColor: "text-amber-400",
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Alertas inteligentes",
      description: "Te avisamos cuando algo no cuadra: gastos inusuales, oportunidades de ahorro, fechas importantes.",
      gradient: "from-rose-500/20 to-rose-500/5",
      iconColor: "text-rose-400",
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Tracking de metas",
      description: "Visualiza tu progreso hacia tus objetivos financieros. Celebra cada milestone alcanzado.",
      gradient: "from-cyan-500/20 to-cyan-500/5",
      iconColor: "text-cyan-400",
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      title: "Contenido educativo",
      description: "Aprende sobre finanzas personales con guías prácticas y lecciones diseñadas para ti.",
      gradient: "from-indigo-500/20 to-indigo-500/5",
      iconColor: "text-indigo-400",
    },
  ]

  return (
    <section ref={sectionRef} id="caracteristicas" className="relative py-32 px-6 bg-[--color-bg]">
      {/* Background */}
      <div className="absolute inset-0 grid-bg opacity-10" />

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <span className="inline-flex items-center px-4 py-2 rounded-full glass text-[11px] uppercase tracking-widest text-[--color-text-dim] font-semibold mb-8">
            Características
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-[--color-text]">
            Todo lo que necesitas
          </h2>
          <p className="font-serif text-4xl md:text-5xl lg:text-6xl text-emerald-400 italic mt-3">
            en un solo lugar
          </p>
          <p className="text-lg text-[--color-text-muted] mt-6 max-w-xl mx-auto">
            Herramientas diseñadas para darte claridad, control y confianza sobre tu dinero.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`group relative transition-all duration-700 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
              style={{ transitionDelay: `${index * 80 + 200}ms` }}
            >
              <div className="relative p-6 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] hover:border-white/10 transition-all duration-500 h-full group-hover:translate-y-[-2px]">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center ${feature.iconColor} mb-5 transition-transform duration-300 group-hover:scale-110`}>
                  {feature.icon}
                </div>

                {/* Content */}
                <h3 className="font-semibold text-[--color-text] mb-2 text-lg">
                  {feature.title}
                </h3>
                <p className="text-sm text-[--color-text-muted] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
