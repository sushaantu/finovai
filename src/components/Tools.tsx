import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Clock3, Sparkles, TrendingUp } from 'lucide-react'

const toolCards = [
  {
    title: 'Calculadora de interés compuesto',
    description: 'Visualiza cómo el tiempo, la tasa y la constancia cambian el resultado final.',
    status: 'Disponible',
    eyebrow: 'Crecimiento',
    accent: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300',
    icon: TrendingUp,
    href: '/tools/interes-compuesto',
    ctaLabel: 'Abrir herramienta',
  },
  {
    title: 'Regla del 72',
    description: 'Explica en segundos cuánto tardaría tu dinero en duplicarse a una tasa dada.',
    status: 'Disponible',
    eyebrow: 'Educación',
    accent: 'border-cyan-500/20 bg-cyan-500/8 text-cyan-300',
    icon: Clock3,
    href: '/tools/regla-72',
    ctaLabel: 'Abrir herramienta',
  },
  {
    title: 'Costo de oportunidad',
    description: 'Próxima herramienta para mostrar cuánto cuesta retrasar una decisión de inversión.',
    status: 'Próximamente',
    eyebrow: 'Siguiente lanzamiento',
    accent: 'border-white/10 bg-white/[0.03] text-zinc-300',
    icon: Sparkles,
    href: '/tools/costo-oportunidad',
    ctaLabel: 'Ver vista previa',
  },
]

export default function Tools() {
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

  return (
    <section
      ref={sectionRef}
      id="herramientas"
      className="relative overflow-hidden bg-[--color-bg-secondary] px-5 py-24 sm:px-6 sm:py-32"
    >
      <div className="absolute inset-0 grid-bg opacity-15" />
      <div className="glow-emerald -left-48 top-24 opacity-20" />
      <div className="glow-violet -bottom-40 right-0 opacity-20" />

      <div className="relative mx-auto max-w-7xl">
        <div className={`mb-14 text-center transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <span className="glass mb-8 inline-flex items-center rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-[--color-text-dim]">
            Herramientas
          </span>
          <h2 className="font-display text-4xl text-[--color-text] md:text-5xl lg:text-6xl">
            Explora las herramientas
          </h2>
          <p className="mt-3 font-serif text-4xl italic text-emerald-400 md:text-5xl lg:text-6xl">
            de FinovAI
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[--color-text-muted]">
            Cada tarjeta abre una experiencia dedicada. Sin interacciones escondidas, sin ambiguedad sobre qué pasó al hacer clic.
          </p>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          {toolCards.map((tool, index) => {
            const Icon = tool.icon

            return (
              <a
                key={tool.title}
                href={tool.href}
                className={`group min-w-0 rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-5 transition-all duration-700 hover:-translate-y-1 hover:border-white/14 sm:p-6 ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
                style={{ transitionDelay: `${index * 100 + 120}ms` }}
              >
                <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2 sm:justify-between sm:gap-3">
                  <span className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 [overflow-wrap:anywhere] sm:tracking-[0.2em]">
                    {tool.eyebrow}
                  </span>
                  <div className={`inline-flex max-w-full rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] [overflow-wrap:anywhere] sm:tracking-[0.18em] ${tool.accent}`}>
                    {tool.status}
                  </div>
                </div>

                <div className={`mb-5 inline-flex rounded-2xl border px-3 py-3 ${tool.accent}`}>
                  <Icon className="size-5" />
                </div>

                <h3 className="mb-2 text-lg font-semibold text-[--color-text]">{tool.title}</h3>
                <p className="min-h-14 text-sm leading-relaxed text-[--color-text-muted]">{tool.description}</p>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white transition-transform group-hover:translate-x-1">
                  {tool.ctaLabel}
                  <ArrowRight className="size-4" />
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
