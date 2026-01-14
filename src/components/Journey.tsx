import { useEffect, useRef, useState } from 'react'

export default function Journey() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.2 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const stages = [
    {
      number: "0",
      gradient: "from-amber-500 to-orange-500",
      bgGlow: "bg-amber-500",
      title: "Ordena tu casa",
      subtitle: "Entiende tu situación actual",
      description: "Diagnosticamos tus hábitos, mapeamos tu flujo de dinero y creamos la estructura base que necesitas.",
      items: ["Diagnóstico de hábitos", "Mapa de ingresos y gastos", "Estructura y reglas claras"],
      accentColor: "text-amber-400",
      borderColor: "border-amber-500/20",
      iconBg: "bg-amber-500/10",
    },
    {
      number: "1",
      gradient: "from-violet-500 to-purple-500",
      bgGlow: "bg-violet-500",
      title: "Crea margen",
      subtitle: "De supervivencia a estabilidad",
      description: "Optimizamos gastos, automatizamos ahorro y tomamos decisiones conscientes para que te quede dinero.",
      items: ["Optimización de gastos", "Ahorro automatizado", "Prioridades definidas"],
      accentColor: "text-violet-400",
      borderColor: "border-violet-500/20",
      iconBg: "bg-violet-500/10",
    },
    {
      number: "2",
      gradient: "from-emerald-500 to-teal-500",
      bgGlow: "bg-emerald-500",
      title: "Invierte con sistema",
      subtitle: "De estabilidad a crecimiento",
      description: "Con margen real, creamos tu perfil de inversión y tu asesor IA personalizado te guía paso a paso.",
      items: ["Plan de inversión", "Asesor IA personalizado", "Seguimiento continuo"],
      accentColor: "text-emerald-400",
      borderColor: "border-emerald-500/20",
      iconBg: "bg-emerald-500/10",
    },
  ]

  return (
    <section ref={sectionRef} id="como-funciona" className="relative py-32 px-6 bg-[--color-bg-secondary] overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="glow-emerald -bottom-60 -right-60 opacity-30" />
      <div className="glow-violet -top-40 -left-40 opacity-20" />

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-20 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <span className="inline-flex items-center px-4 py-2 rounded-full glass text-[11px] uppercase tracking-widest text-[--color-text-dim] font-semibold mb-8">
            La Ruta FinovAI
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-[--color-text] leading-tight">
            Tres etapas hacia tu
          </h2>
          <p className="font-serif text-4xl md:text-5xl lg:text-6xl text-emerald-400 italic mt-3">
            libertad financiera
          </p>
          <p className="text-lg text-[--color-text-muted] mt-8 max-w-2xl mx-auto leading-relaxed">
            Primero ordenas la casa, luego compras acciones. El patrimonio no empieza invirtiendo,
            <span className="text-[--color-text-secondary]"> empieza teniendo estructura.</span>
          </p>
        </div>

        {/* Connection line - visible on desktop */}
        <div className="hidden md:block absolute top-[calc(50%+40px)] left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Stages */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {stages.map((stage, index) => (
            <div
              key={index}
              className={`group relative transition-all duration-700 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'
              }`}
              style={{ transitionDelay: `${index * 150 + 300}ms` }}
            >
              {/* Card */}
              <div className={`relative p-7 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border ${stage.borderColor} hover:border-opacity-40 transition-all duration-500 h-full backdrop-blur-sm group-hover:translate-y-[-4px] group-hover:shadow-xl`}>
                {/* Glow effect on hover */}
                <div className={`absolute -inset-px rounded-3xl ${stage.bgGlow} opacity-0 group-hover:opacity-5 blur-xl transition-opacity duration-500`} />

                {/* Number badge */}
                <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${stage.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                  <span className="text-white font-display text-2xl">{stage.number}</span>
                </div>

                {/* Label */}
                <p className="text-[10px] text-[--color-text-dim] uppercase tracking-[0.2em] mb-3 font-semibold">
                  Etapa {stage.number}
                </p>

                {/* Title */}
                <h3 className="font-display text-2xl text-[--color-text] mb-2 tracking-tight">
                  {stage.title}
                </h3>
                <p className={`text-sm ${stage.accentColor} mb-5 font-medium`}>
                  {stage.subtitle}
                </p>

                {/* Description */}
                <p className="text-[--color-text-muted] text-[15px] mb-6 leading-relaxed">
                  {stage.description}
                </p>

                {/* Items */}
                <div className="space-y-3">
                  {stage.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-sm text-[--color-text-muted] group/item"
                    >
                      <div className={`w-6 h-6 rounded-lg ${stage.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <svg className={`w-3.5 h-3.5 ${stage.accentColor}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="group-hover/item:text-[--color-text-secondary] transition-colors">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div className={`mt-24 text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '800ms' }}>
          <div className="relative inline-block">
            <span className="absolute -left-8 -top-4 text-6xl text-white/5 font-serif">"</span>
            <p className="font-serif text-3xl md:text-4xl text-[--color-text-dim] italic leading-relaxed">
              Antes de invertir, hay que ordenar la casa.
            </p>
            <span className="absolute -right-8 -bottom-8 text-6xl text-white/5 font-serif">"</span>
          </div>
        </div>
      </div>
    </section>
  )
}
