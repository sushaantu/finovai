import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calculator, Clock3, Sparkles, TrendingUp } from 'lucide-react'
import { useRevealOnce } from '@/lib/use-reveal-once'

export type ToolSlug = 'compound' | 'rule72' | 'opportunity'

interface ToolPageProps {
  tool: ToolSlug
}

interface ProjectionPoint {
  year: number
  invested: number
  total: number
  interest: number
}

interface ToolCardConfig {
  slug: ToolSlug
  title: string
  description: string
  status: string
  eyebrow: string
  accent: string
  href: string
  icon: typeof TrendingUp
}

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

const decimalFormatter = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const toolCards: ToolCardConfig[] = [
  {
    slug: 'compound',
    title: 'Calculadora de interés compuesto',
    description: 'Visualiza el impacto de la tasa, el tiempo y las aportaciones mensuales.',
    status: 'Disponible',
    eyebrow: 'Crecimiento',
    accent: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300',
    href: '/tools/interes-compuesto',
    icon: TrendingUp,
  },
  {
    slug: 'rule72',
    title: 'Regla del 72',
    description: 'Una explicación rápida para entender cuánto tardaría en duplicarse tu dinero.',
    status: 'Disponible',
    eyebrow: 'Educación',
    accent: 'border-cyan-500/20 bg-cyan-500/8 text-cyan-300',
    href: '/tools/regla-72',
    icon: Clock3,
  },
  {
    slug: 'opportunity',
    title: 'Costo de oportunidad',
    description: 'Vista previa del siguiente simulador de FinovAI.',
    status: 'Próximamente',
    eyebrow: 'Siguiente lanzamiento',
    accent: 'border-white/10 bg-white/[0.03] text-zinc-300',
    href: '/tools/costo-oportunidad',
    icon: Sparkles,
  },
]

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value))
}

function formatYears(value: number) {
  return `${decimalFormatter.format(value)} años`
}

function calculateCompoundProjection(
  principal: number,
  annualRate: number,
  years: number,
  monthlyContribution: number
): ProjectionPoint[] {
  const monthlyRate = annualRate / 100 / 12
  const points: ProjectionPoint[] = []
  let invested = principal
  let balance = principal

  points.push({
    year: 0,
    invested,
    total: balance,
    interest: 0,
  })

  for (let year = 1; year <= years; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      balance = balance * (1 + monthlyRate) + monthlyContribution
      invested += monthlyContribution
    }

    points.push({
      year,
      invested,
      total: balance,
      interest: balance - invested,
    })
  }

  return points
}

function buildLinePath(values: number[]) {
  if (values.length === 0) {
    return ''
  }

  const max = Math.max(...values, 1)
  const minX = 6
  const maxX = 94
  const minY = 10
  const maxY = 92

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : minX + (index / (values.length - 1)) * (maxX - minX)
      const y = maxY - (value / max) * (maxY - minY)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function buildAreaPath(values: number[]) {
  if (values.length === 0) {
    return ''
  }

  return `${buildLinePath(values)} L 94 92 L 6 92 Z`
}

function getMilestones(points: ProjectionPoint[]) {
  const lastYear = points.at(-1)?.year ?? 0
  const targetYears = Array.from(new Set([
    1,
    Math.max(2, Math.round(lastYear / 3)),
    Math.max(3, Math.round((lastYear * 2) / 3)),
    lastYear,
  ]))

  return targetYears
    .map((targetYear) => points.find((point) => point.year === targetYear))
    .filter((point): point is ProjectionPoint => Boolean(point))
}

export default function ToolPage({ tool }: ToolPageProps) {
  const { ref: sectionRef, isVisible } = useRevealOnce<HTMLElement>(0.15)
  const [principal, setPrincipal] = useState(10000)
  const [annualRate, setAnnualRate] = useState(8)
  const [years, setYears] = useState(20)
  const [monthlyContribution, setMonthlyContribution] = useState(500)

  useEffect(() => {
    const titleMap: Record<ToolSlug, string> = {
      compound: 'Calculadora de interés compuesto | FinovAI',
      rule72: 'Regla del 72 | FinovAI',
      opportunity: 'Costo de oportunidad | FinovAI',
    }

    document.title = titleMap[tool]
  }, [tool])

  const projection = useMemo(
    () => calculateCompoundProjection(principal, annualRate, years, monthlyContribution),
    [principal, annualRate, years, monthlyContribution]
  )
  const latestProjection = projection.at(-1) ?? projection[0]
  const rule72Estimate = 72 / annualRate
  const exactDoublingYears = Math.log(2) / Math.log(1 + annualRate / 100)
  const estimateError = Math.abs(rule72Estimate - exactDoublingYears)
  const chartAreaPath = buildAreaPath(projection.map((point) => point.total))
  const chartTotalPath = buildLinePath(projection.map((point) => point.total))
  const chartInvestedPath = buildLinePath(projection.map((point) => point.invested))
  const milestones = getMilestones(projection)

  const copyByTool: Record<ToolSlug, { badge: string; title: string; subtitle: string }> = {
    compound: {
      badge: 'Herramienta activa',
      title: 'Calculadora de interés compuesto',
      subtitle: 'Una vista dedicada para explorar crecimiento, interés ganado y el peso de las aportaciones mensuales.',
    },
    rule72: {
      badge: 'Herramienta activa',
      title: 'Regla del 72',
      subtitle: 'Una página enfocada para explicar en segundos cuánto tardaría tu capital en duplicarse.',
    },
    opportunity: {
      badge: 'Vista previa',
      title: 'Costo de oportunidad',
      subtitle: 'La siguiente herramienta mostrará cuánto cuesta esperar antes de invertir.',
    },
  }

  const currentCopy = copyByTool[tool]

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden bg-[--color-bg-secondary] px-6 pb-24 pt-32"
    >
      <div className="absolute inset-0 grid-bg opacity-15" />
      <div className="glow-emerald -left-48 top-24 opacity-20" />
      <div className="glow-violet -bottom-40 right-0 opacity-20" />

      <div className="relative mx-auto max-w-7xl">
        <a
          href="/#herramientas"
          className={`mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition-all hover:text-white ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
        >
          <ArrowLeft className="size-4" />
          Volver a herramientas
        </a>

        <div className={`mb-12 max-w-3xl transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <span className="glass mb-6 inline-flex items-center rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-[--color-text-dim]">
            {currentCopy.badge}
          </span>
          <h1 className="font-display text-4xl text-white md:text-5xl lg:text-6xl">{currentCopy.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-400">{currentCopy.subtitle}</p>
        </div>

        <div className="mb-10 grid gap-4 lg:grid-cols-3">
          {toolCards.map((card, index) => {
            const Icon = card.icon
            const isActive = card.slug === tool

            return (
              <a
                key={card.slug}
                href={card.href}
                className={`rounded-3xl border bg-gradient-to-b p-5 transition-all duration-700 ${
                  isActive
                    ? 'border-emerald-500/25 from-emerald-500/[0.12] to-transparent'
                    : 'border-white/[0.08] from-white/[0.04] to-transparent hover:border-white/14'
                } ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
                style={{ transitionDelay: `${index * 100 + 120}ms` }}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{card.eyebrow}</span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${card.accent}`}>
                    {card.status}
                  </span>
                </div>
                <div className={`mb-4 inline-flex rounded-2xl border px-3 py-3 ${card.accent}`}>
                  <Icon className="size-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{card.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{card.description}</p>
              </a>
            )
          })}
        </div>

        {tool === 'compound' && (
          <div className={`grid gap-6 xl:grid-cols-[1.1fr_0.9fr] transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
            <div className="rounded-[1.75rem] border border-white/[0.08] bg-black/20 p-5 md:p-6">
              <div className="mb-6">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Parámetros</p>
                <p className="text-sm text-zinc-400">Ajusta el escenario y revisa cómo cambia la trayectoria de crecimiento.</p>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-400">Capital inicial</span>
                    <span className="font-semibold text-white">{formatCurrency(principal)}</span>
                  </div>
                  <input className="tool-slider" type="range" min={1000} max={100000} step={1000} value={principal} onChange={(event) => setPrincipal(Number(event.target.value))} />
                </label>

                <label className="block">
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-400">Tasa anual esperada</span>
                    <span className="font-semibold text-emerald-300">{decimalFormatter.format(annualRate)}%</span>
                  </div>
                  <input className="tool-slider" type="range" min={1} max={20} step={0.5} value={annualRate} onChange={(event) => setAnnualRate(Number(event.target.value))} />
                </label>

                <label className="block">
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-400">Horizonte</span>
                    <span className="font-semibold text-white">{years} años</span>
                  </div>
                  <input className="tool-slider" type="range" min={1} max={40} step={1} value={years} onChange={(event) => setYears(Number(event.target.value))} />
                </label>

                <label className="block">
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-400">Aportación mensual</span>
                    <span className="font-semibold text-white">{formatCurrency(monthlyContribution)}</span>
                  </div>
                  <input className="tool-slider" type="range" min={0} max={5000} step={100} value={monthlyContribution} onChange={(event) => setMonthlyContribution(Number(event.target.value))} />
                </label>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Capital invertido</p>
                  <p className="text-xl font-semibold text-white">{formatCurrency(latestProjection.invested)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200/60">Intereses ganados</p>
                  <p className="text-xl font-semibold text-emerald-300">{formatCurrency(latestProjection.interest)}</p>
                </div>
                <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/8 p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/60">Total final</p>
                  <p className="text-xl font-semibold text-cyan-300">{formatCurrency(latestProjection.total)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-white/[0.08] bg-black/20 p-5 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Proyección</p>
                    <p className="mt-2 text-sm text-zinc-400">La curva separa lo que tú aportas de lo que genera el tiempo a tu favor.</p>
                  </div>
                  <div className="rounded-full border border-white/8 px-3 py-1 text-xs text-zinc-400">{years} años</div>
                </div>

                <div className="rounded-[1.5rem] border border-white/6 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.02))] p-3">
                  <svg viewBox="0 0 100 100" className="h-64 w-full">
                    <defs>
                      <linearGradient id="toolAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(52,211,153,0.45)" />
                        <stop offset="100%" stopColor="rgba(52,211,153,0)" />
                      </linearGradient>
                    </defs>
                    <path d={chartAreaPath} fill="url(#toolAreaGradient)" />
                    <path d={chartInvestedPath} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeLinecap="round" />
                    <path d={chartTotalPath} fill="none" stroke="#34d399" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-400" />Valor total</span>
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-white/40" />Capital invertido</span>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/[0.08] bg-black/20 p-5 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Hitos</p>
                    <p className="mt-2 text-sm text-zinc-400">Lectura rápida para revisar la progresión en momentos clave.</p>
                  </div>
                  <span className="rounded-full border border-white/8 px-3 py-1 text-xs text-zinc-400">MXN</span>
                </div>

                <div className="space-y-3">
                  {milestones.map((milestone) => {
                    const width = latestProjection.total > 0 ? Math.max(10, (milestone.total / latestProjection.total) * 100) : 10

                    return (
                      <div key={milestone.year} className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-white">Año {milestone.year}</span>
                          <span className="text-sm text-zinc-400">{formatCurrency(milestone.total)}</span>
                        </div>
                        <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/6">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${width}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span>Invertido: {formatCurrency(milestone.invested)}</span>
                          <span>Ganancia: {formatCurrency(milestone.interest)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {tool === 'rule72' && (
          <div className={`grid gap-6 lg:grid-cols-[0.9fr_1.1fr] transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
            <div className="rounded-[1.75rem] border border-white/[0.08] bg-black/20 p-5 md:p-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Explicación rápida</p>
              <h2 className="text-2xl font-semibold text-white">Convierte una tasa en algo fácil de entender</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                La regla del 72 sirve para educación financiera, activación comercial y conversaciones iniciales donde todavía no vale la pena entrar a más complejidad.
              </p>

              <div className="mt-8 rounded-[1.5rem] border border-emerald-500/15 bg-emerald-500/8 px-6 py-8 text-center">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200/70">Fórmula</p>
                <div className="text-3xl font-semibold text-white md:text-4xl">
                  72 <span className="mx-2 text-zinc-500">÷</span>
                  <span className="text-emerald-300">{decimalFormatter.format(annualRate)}%</span>
                  <span className="mx-2 text-zinc-500">=</span>
                  <span className="text-cyan-300">{decimalFormatter.format(rule72Estimate)}</span>
                </div>
                <p className="mt-3 text-sm text-zinc-400">Tiempo estimado para duplicar tu dinero</p>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-400">Ajusta la tasa anual</span>
                  <span className="font-semibold text-emerald-300">{decimalFormatter.format(annualRate)}%</span>
                </div>
                <input className="tool-slider" type="range" min={1} max={30} step={0.5} value={annualRate} onChange={(event) => setAnnualRate(Number(event.target.value))} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200/60">Regla del 72</p>
                  <p className="text-2xl font-semibold text-emerald-300">{formatYears(rule72Estimate)}</p>
                </div>
                <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/8 p-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/60">Valor exacto</p>
                  <p className="text-2xl font-semibold text-cyan-300">{formatYears(exactDoublingYears)}</p>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/[0.08] bg-black/20 p-5 md:p-6">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Comparativo</p>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-400">Error de estimación</span>
                      <span className="text-sm font-semibold text-white">{formatYears(estimateError)}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-500">
                      Es una aproximación muy útil para conversaciones rápidas. Si necesitas más detalle, la calculadora de interés compuesto ya vive en su propia página.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-400">$10,000 invertidos hoy</span>
                      <span className="text-sm font-semibold text-emerald-300">$20,000</span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-500">
                      La fuerza de esta herramienta es pedagógica: ayuda a traducir un porcentaje en un plazo memorable.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.02))] p-5 md:p-6">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Cuándo usarla</p>
                <p className="text-base leading-relaxed text-zinc-300">
                  Úsala cuando quieras dar intuición rápida. Después puedes llevar al usuario a una simulación completa o al diagnóstico guiado con FinovAI.
                </p>
              </div>
            </div>
          </div>
        )}

        {tool === 'opportunity' && (
          <div className={`rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-8 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
            <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/15 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                  <Calculator className="size-3.5" />
                  En preparación
                </div>
                <h2 className="text-3xl font-semibold text-white md:text-4xl">Costo de oportunidad</h2>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
                  Esta herramienta mostrará cuánto cuesta postergar una decisión financiera. La idea es traducir gastos cotidianos y tiempo perdido en un número claro de patrimonio no construido.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="rounded-full border border-white/8 px-4 py-2 text-sm text-zinc-300">Habitos recurrentes</span>
                  <span className="rounded-full border border-white/8 px-4 py-2 text-sm text-zinc-300">Simulaciones anuales</span>
                  <span className="rounded-full border border-white/8 px-4 py-2 text-sm text-zinc-300">Comparativos faciles de entender</span>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/[0.08] bg-black/20 p-6">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Próximo paso</p>
                <p className="text-base leading-relaxed text-zinc-300">
                  Mientras esta herramienta sale, el mejor flujo es cargar movimientos y dejar que FinovAI analice el gasto real.
                </p>
                <a
                  href="/#registro"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-emerald-400"
                >
                  Analizar mis gastos
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
