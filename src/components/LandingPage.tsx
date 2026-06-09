import { type CSSProperties, useId, useMemo, useState } from 'react'
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  Coffee,
  CreditCard,
  Landmark,
  Leaf,
  Lock,
  Menu,
  Repeat2,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react'

interface LandingPageProps {
  email: string | null
  onConnect: () => void
  onLogout: () => void
}

interface LeakItem {
  icon: 'coffee' | 'repeat' | 'food' | 'taxi' | 'fees'
  color: string
  title: string
  subtitle: string
  month: number
  year: number
}

interface FaqItem {
  question: string
  answer: string
}

interface CoverageBank {
  name: string
  label: string
  logoSrc: string
  kind: string
  color: string
  glow: string
  x: string
  y: string
  size: string
  delay: number
}

const leaks: LeakItem[] = [
  {
    icon: 'coffee',
    color: '#2B7AE8',
    title: 'Café Starbucks · OXXO',
    subtitle: '23 cargos al mes · pago contactless',
    month: 2550,
    year: 30600,
  },
  {
    icon: 'repeat',
    color: '#00D4AA',
    title: 'Suscripciones fantasma',
    subtitle: 'Netflix, Spotify, iCloud, Apple TV, ChatGPT',
    month: 894,
    year: 10728,
  },
  {
    icon: 'food',
    color: '#7C5CFA',
    title: 'Delivery nocturno',
    subtitle: 'Rappi · Uber Eats · DiDi Food',
    month: 3180,
    year: 38160,
  },
  {
    icon: 'taxi',
    color: '#F59E0B',
    title: 'Uber tarde por la noche',
    subtitle: 'Patrón detectado: viernes y sábados 11pm+',
    month: 1240,
    year: 14880,
  },
  {
    icon: 'fees',
    color: '#EF4444',
    title: 'Comisiones bancarias',
    subtitle: '4 cuentas activas · 2 sin uso real',
    month: 380,
    year: 4560,
  },
]

const syncfyCoverageBanks: CoverageBank[] = [
  {
    name: 'BBVA México',
    label: 'BBVA',
    logoSrc: '/bank-logos/bbva.svg',
    kind: 'Banco',
    color: '#1464F4',
    glow: 'rgba(20, 100, 244, 0.42)',
    x: '17%',
    y: '22%',
    size: '90px',
    delay: 0,
  },
  {
    name: 'Santander México',
    label: 'Santander',
    logoSrc: '/bank-logos/santander.svg',
    kind: 'Banco',
    color: '#E21B2D',
    glow: 'rgba(226, 27, 45, 0.42)',
    x: '78%',
    y: '18%',
    size: '96px',
    delay: 0.35,
  },
  {
    name: 'Banorte IXE',
    label: 'Banorte',
    logoSrc: '/bank-logos/banorte.svg',
    kind: 'Banco',
    color: '#B51224',
    glow: 'rgba(181, 18, 36, 0.42)',
    x: '88%',
    y: '50%',
    size: '82px',
    delay: 0.9,
  },
  {
    name: 'Banamex',
    label: 'Banamex',
    logoSrc: '/bank-logos/banamex.svg',
    kind: 'Banco',
    color: '#1E5FBF',
    glow: 'rgba(30, 95, 191, 0.45)',
    x: '12%',
    y: '52%',
    size: '84px',
    delay: 1.2,
  },
  {
    name: 'HSBC',
    label: 'HSBC',
    logoSrc: '/bank-logos/hsbc.svg',
    kind: 'Banco',
    color: '#D71920',
    glow: 'rgba(215, 25, 32, 0.4)',
    x: '73%',
    y: '80%',
    size: '78px',
    delay: 1.55,
  },
  {
    name: 'Scotiabank México',
    label: 'Scotia',
    logoSrc: '/bank-logos/scotiabank.svg',
    kind: 'Banco',
    color: '#E11D2E',
    glow: 'rgba(225, 29, 46, 0.36)',
    x: '28%',
    y: '82%',
    size: '76px',
    delay: 1.9,
  },
  {
    name: 'Inbursa',
    label: 'Inbursa',
    logoSrc: '/bank-logos/inbursa.svg',
    kind: 'Banco',
    color: '#275B9B',
    glow: 'rgba(39, 91, 155, 0.38)',
    x: '52%',
    y: '88%',
    size: '74px',
    delay: 2.15,
  },
  {
    name: 'Bitso',
    label: 'Bitso',
    logoSrc: '/bank-logos/bitso.svg',
    kind: 'Billetera digital',
    color: '#00A86B',
    glow: 'rgba(0, 168, 107, 0.42)',
    x: '49%',
    y: '12%',
    size: '76px',
    delay: 2.45,
  },
  {
    name: 'Hey Banco',
    label: 'Hey',
    logoSrc: '/bank-logos/hey-banco.svg',
    kind: 'Banco digital',
    color: '#00A676',
    glow: 'rgba(0, 166, 118, 0.4)',
    x: '91%',
    y: '30%',
    size: '66px',
    delay: 2.7,
  },
  {
    name: 'American Express',
    label: 'AmEx',
    logoSrc: '/bank-logos/amex.svg',
    kind: 'Tarjeta',
    color: '#2E77BB',
    glow: 'rgba(46, 119, 187, 0.4)',
    x: '10%',
    y: '77%',
    size: '70px',
    delay: 3,
  },
]

const faqItems: FaqItem[] = [
  {
    question: '¿Puede FinovAI mover dinero de mi cuenta?',
    answer:
      'No. FinovAI usa conexiones autorizadas para obtener datos transaccionales y analizarlos; no inicia transferencias, retiros ni pagos. Cuando decides invertir, la decisión y el movimiento ocurren fuera de FinovAI con el proveedor que elijas.',
  },
  {
    question: '¿Qué bancos y plataformas puedo conectar?',
    answer:
      'FinovAI permite conectar bancos en México como BBVA México, Banorte IXE, Santander México, HSBC, Banamex, Scotiabank México, Inbursa, Banregio, Hey Banco y American Express, además de fuentes compatibles como Bitso. La disponibilidad final depende de la cobertura vigente y del tipo de cuenta.',
  },
  {
    question: '¿Cuánto cuesta usar FinovAI?',
    answer:
      'El análisis de fugas y la proyección de inversión son gratuitos. FinovAI gana cuando conecta usuarios listos para ahorrar con plataformas de inversión aliadas.',
  },
  {
    question: '¿Cómo identifica las fugas?',
    answer:
      'Agrupamos transacciones por comercio, monto, horario y frecuencia. Así aparecen patrones como suscripciones recurrentes, cargos pequeños repetidos y categorías que se salen de tu ingreso real.',
  },
  {
    question: '¿Qué plataformas de inversión están disponibles?',
    answer:
      'FinovAI mostrará opciones de inversión relevantes para México y Latinoamérica cuando el usuario tenga margen de ahorro identificado. No ejecutamos inversiones dentro de FinovAI; conectamos la intención con proveedores externos.',
  },
  {
    question: '¿Los rendimientos están garantizados?',
    answer:
      'No. Las proyecciones son ilustrativas y dependen de supuestos de aportación, plazo y rendimiento. La inversión final ocurre con terceros regulados y debe revisarse según tu perfil de riesgo.',
  },
]

export default function LandingPage({ email, onConnect, onLogout }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleConnect = () => {
    setIsMenuOpen(false)
    onConnect()
  }

  return (
    <div className="finovai-landing">
      <LandingNav
        email={email}
        isMenuOpen={isMenuOpen}
        onToggleMenu={() => setIsMenuOpen((current) => !current)}
        onConnect={handleConnect}
        onLogout={onLogout}
      />
      <main>
        <HeroSection onConnect={handleConnect} />
        <HowItWorksSection />
        <LeaksSection />
        <CalculatorSection />
        <SecuritySection />
        <FaqSection />
        <LandingFooter onConnect={handleConnect} />
      </main>
    </div>
  )
}

function LandingNav({
  email,
  isMenuOpen,
  onToggleMenu,
  onConnect,
  onLogout,
}: {
  email: string | null
  isMenuOpen: boolean
  onToggleMenu: () => void
  onConnect: () => void
  onLogout: () => void
}) {
  const navLinks = [
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Fugas detectadas', href: '#fugas' },
    { label: 'Calculadora', href: '#calculadora' },
    { label: 'Seguridad', href: '#seguridad' },
    { label: 'Preguntas', href: '#faq' },
  ]

  return (
    <header className="landing-nav">
      <div className="landing-container">
        <div className="landing-nav-inner">
          <a className="landing-wordmark" href="#top" aria-label="FinovAI inicio">
            <FinovaiLogo />
            <span>
              finov<span>ai</span>
            </span>
          </a>

          <nav className="landing-nav-links" aria-label="Principal">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="landing-nav-actions">
            {email ? (
              <>
                <button className="landing-btn landing-btn-ghost" type="button" onClick={onConnect}>
                  Mi panel
                </button>
                <button className="landing-btn landing-btn-outline landing-btn-compact" type="button" onClick={onLogout}>
                  Salir
                </button>
              </>
            ) : (
              <>
                <button className="landing-btn landing-btn-ghost" type="button" onClick={onConnect}>
                  Iniciar sesión
                </button>
                <button className="landing-btn landing-btn-primary landing-btn-compact" type="button" onClick={onConnect}>
                  Conectar mi banco
                  <ArrowRight aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          <button
            className="landing-menu-button"
            type="button"
            aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isMenuOpen}
            onClick={onToggleMenu}
          >
            {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>

        {isMenuOpen ? (
          <div className="landing-mobile-menu">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={onToggleMenu}>
                {link.label}
              </a>
            ))}
            <button className="landing-btn landing-btn-primary" type="button" onClick={onConnect}>
              {email ? 'Abrir panel' : 'Conectar mi banco'}
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}

function HeroSection({ onConnect }: { onConnect: () => void }) {
  return (
    <section id="top" className="landing-section landing-hero">
      <div className="landing-blob landing-blob-blue" />
      <div className="landing-blob landing-blob-teal" />

      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <Eyebrow>Copiloto financiero · México y LATAM</Eyebrow>
          <h1>
            Tu dinero gotea.
            <br />
            <span className="landing-gradient-text">FinovAI lo invierte.</span>
          </h1>
          <p>
            Conecta tu banco y deja que FinovAI encuentre las fugas invisibles en tus gastos: ese café diario,
            las suscripciones olvidadas y los envíos de cada noche. Luego descubre cuánto podría crecer ese
            dinero si lo invirtieras hoy.
          </p>

          <div className="landing-cta-row">
            <button className="landing-btn landing-btn-primary landing-btn-large" type="button" onClick={onConnect}>
              Conectar mi banco
              <ArrowRight aria-hidden="true" />
            </button>
          </div>

          <div className="landing-microcopy">
            <span>
              <Lock aria-hidden="true" /> Conexión bancaria segura
            </span>
            <span aria-hidden="true">·</span>
            <span>Sin tarjeta de crédito</span>
          </div>
        </div>

        <LeakAnimation />
      </div>

      <div className="landing-container landing-trust-row">
        <span>Conecta fuentes compatibles</span>
        {['Bancos y wallets MX', 'SAT', 'American Express'].map((name) => (
          <strong key={name}>{name}</strong>
        ))}
      </div>
    </section>
  )
}

function BankNetworkAnimation() {
  return (
    <div className="landing-bank-network" aria-label="Instituciones mexicanas conectables">
      <div className="landing-bank-rings" aria-hidden="true" />
      <div className="landing-bank-center">
        <span>Conexión bancaria</span>
        <strong>Conecta tus cuentas</strong>
        <small>Bancos, billeteras digitales y SAT para análisis financiero en FinovAI</small>
      </div>

      {syncfyCoverageBanks.map((bank) => (
        <div
          className="landing-bank-node"
          key={bank.name}
          style={
            {
              '--bank-color': bank.color,
              '--bank-glow': bank.glow,
              '--bank-x': bank.x,
              '--bank-y': bank.y,
              '--bank-size': bank.size,
              '--bank-delay': `${bank.delay}s`,
            } as CSSProperties
          }
          title={`${bank.name} · ${bank.kind}`}
          aria-label={`${bank.name} · ${bank.kind}`}
        >
          <img className="landing-bank-logo-image" src={bank.logoSrc} alt={bank.label} loading="eager" />
        </div>
      ))}

    </div>
  )
}

function LeakAnimation() {
  return (
    <div className="landing-leak-animation" aria-label="Animación de fuga de dinero convertida en inversión">
      <div className="landing-hud">
        <span>
          <i className="landing-dot-blue" /> Café diario
        </span>
        <span>
          <i className="landing-dot-teal" /> Invertido
        </span>
      </div>

      <svg viewBox="0 0 460 360" role="img" aria-labelledby="leak-animation-title">
        <title id="leak-animation-title">Gastos pequeños convertidos en una curva de crecimiento</title>
        <defs>
          <linearGradient id="landingDropGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5BA1F5" />
            <stop offset="100%" stopColor="#2B7AE8" />
          </linearGradient>
          <linearGradient id="landingAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D4AA" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00D4AA" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="landingLineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2B7AE8" />
            <stop offset="100%" stopColor="#00D4AA" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((gridLine) => (
          <line
            key={gridLine}
            x1="60"
            x2="430"
            y1={50 + gridLine * 260}
            y2={50 + gridLine * 260}
            stroke="rgba(10,22,40,0.06)"
            strokeDasharray="2 4"
          />
        ))}

        <path
          d="M60 296 Q125 284 160 254 T240 198 T310 126 T430 76 L430 310 L60 310 Z"
          fill="url(#landingAreaGradient)"
        />
        <path
          d="M60 296 Q125 284 160 254 T240 198 T310 126 T430 76"
          fill="none"
          stroke="url(#landingLineGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle className="landing-chart-pulse" cx="430" cy="76" r="8" fill="#00D4AA" opacity="0.16" />
        <circle cx="430" cy="76" r="4.5" fill="#00D4AA" stroke="white" strokeWidth="2" />

        <g className="landing-drop landing-drop-1">
          <circle r="9" fill="url(#landingDropGradient)" />
          <text textAnchor="middle" y="3.5" fontSize="9" fontWeight="700" fill="white">
            $
          </text>
        </g>
        <g className="landing-drop landing-drop-2">
          <circle r="9" fill="url(#landingDropGradient)" />
          <text textAnchor="middle" y="3.5" fontSize="9" fontWeight="700" fill="white">
            $
          </text>
        </g>
        <g className="landing-drop landing-drop-3">
          <circle r="9" fill="url(#landingDropGradient)" />
          <text textAnchor="middle" y="3.5" fontSize="9" fontWeight="700" fill="white">
            $
          </text>
        </g>

        <image
          className="landing-coffee-illustration"
          href="/starbucks-cup.png"
          x="30"
          y="90"
          width="118"
          height="118"
          preserveAspectRatio="xMidYMid meet"
        />

        <text x="50" y="210" fontSize="11" fontWeight="700" fill="#0A1628">
          $85 / día
        </text>
        <text x="50" y="226" fontSize="10" fill="#A7B5CC">
          Starbucks · OXXO café
        </text>
      </svg>

      <div className="landing-total-card">
        <span>Proyección a 10 años</span>
        <strong>$310,000</strong>
        <small>MXN · rendimiento ilustrativo 8% anual</small>
      </div>
    </div>
  )
}

function HowItWorksSection() {
  return (
    <section id="como-funciona" className="landing-section landing-section-white">
      <div className="landing-container">
        <SectionHeader
          eyebrow="Cómo funciona"
          title="De fugas invisibles a inversión real"
          muted="en tres pasos."
          align="center"
        />

        <div className="landing-steps-grid">
          <StepCard
            icon={<Landmark aria-hidden="true" />}
            step="01 · Conecta"
            title="Vincula tu banco"
            body="Conecta bancos mexicanos y trae movimientos transaccionales a FinovAI."
          >
            <div className="landing-bank-tags">
              {['BBVA', 'Banorte', 'Santander', 'HSBC', 'Hey'].map((bank) => (
                <span key={bank}>{bank}</span>
              ))}
            </div>
          </StepCard>

          <StepCard
            icon={<Sparkles aria-hidden="true" />}
            step="02 · Analiza"
            title="FinovAI encuentra tus fugas"
            body="Detectamos patrones repetitivos: cafés, suscripciones fantasma y entregas nocturnas, ordenados por impacto anual."
          >
            <div className="landing-mini-list">
              <MiniLeak label="Starbucks" value="$2,550" icon={<Coffee aria-hidden="true" />} />
              <MiniLeak label="Netflix · Spotify · iCloud" value="$894" icon={<Repeat2 aria-hidden="true" />} />
              <MiniLeak label="Rappi · Uber Eats" value="$3,180" icon={<Utensils aria-hidden="true" />} />
            </div>
          </StepCard>

          <StepCard
            icon={<Leaf aria-hidden="true" />}
            step="03 · Invierte"
            title="Convierte la fuga en patrimonio"
            body="Te conectamos con plataformas de inversión para canalizar ese margen hacia un instrumento alineado con tu perfil."
          >
            <div className="landing-growth-preview">
              <div>
                <span>A 10 años</span>
                <strong>$384,210</strong>
                <small>MXN</small>
              </div>
              <svg viewBox="0 0 200 50" aria-hidden="true">
                <path d="M0 45 Q40 42 70 35 T140 18 T200 5 L200 50 L0 50 Z" />
                <path d="M0 45 Q40 42 70 35 T140 18 T200 5" />
              </svg>
            </div>
          </StepCard>
        </div>
      </div>
    </section>
  )
}

function LeaksSection() {
  const total = leaks.reduce((sum, leak) => sum + leak.year, 0)

  return (
    <section id="fugas" className="landing-section">
      <div className="landing-container">
        <SectionHeader
          eyebrow="Fugas detectadas"
          title='Lo que la mayoría llama "gastos hormiga",'
          muted="nosotros lo llamamos capital dormido."
        />

        <div className="landing-leaks-grid">
          <div className="landing-leaks-list">
            {leaks.map((leak) => (
              <LeakRow key={leak.title} leak={leak} />
            ))}
          </div>

          <aside className="landing-leak-panel">
            <div className="landing-panel-glow" />
            <div className="landing-panel-content">
              <Eyebrow>Total anual identificado</Eyebrow>
              <div className="landing-total-number">
                ${formatCurrency(total)}
                <span>MXN</span>
              </div>
              <p>Si tomas estas fugas y las inviertes con aportaciones constantes, el impacto puede cambiar de escala.</p>

              <div className="landing-projection-grid">
                <div>
                  <span>5 años</span>
                  <strong>${formatCurrency(Math.round(total * 6.1))}</strong>
                </div>
                <div>
                  <span>10 años</span>
                  <strong>${formatCurrency(Math.round(total * 14.5))}</strong>
                </div>
              </div>

              <a className="landing-btn landing-btn-light" href="#calculadora">
                Calcular mi proyección
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

function CalculatorSection() {
  const [monthly, setMonthly] = useState(2500)
  const [years, setYears] = useState(10)
  const [rate, setRate] = useState(8)

  const projection = useMemo(() => {
    const monthlyRate = rate / 100 / 12
    const months = years * 12
    const futureValue = monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
    const principal = monthly * months
    const gains = futureValue - principal
    const points = []
    const step = Math.max(1, Math.floor(months / 60))

    for (let month = 0; month <= months; month += step) {
      const value = monthly * ((Math.pow(1 + monthlyRate, month) - 1) / monthlyRate)
      const contributed = monthly * month
      points.push({ month, value, contributed })
    }

    return {
      futureValue,
      principal,
      gains,
      months,
      points,
    }
  }, [monthly, years, rate])

  const chart = useMemo(() => buildProjectionChart(projection.points, projection.months, years), [
    projection.months,
    projection.points,
    years,
  ])

  return (
    <section id="calculadora" className="landing-section landing-section-white">
      <div className="landing-container">
        <SectionHeader
          eyebrow="Calculadora"
          title="¿Cuánto crecería tu fuga"
          muted="si la invirtieras hoy?"
        />

        <div className="landing-calculator">
          <div className="landing-slider-stack">
            <CalcSlider
              label="Fuga mensual identificada"
              value={monthly}
              min={500}
              max={15000}
              step={100}
              onChange={setMonthly}
              format={(value) => `$${formatCurrency(value)} MXN`}
              presets={[
                { label: 'Café', value: 2550 },
                { label: 'Subs', value: 894 },
                { label: 'Delivery', value: 3180 },
              ]}
            />
            <CalcSlider
              label="Horizonte de inversión"
              value={years}
              min={1}
              max={30}
              step={1}
              onChange={setYears}
              format={(value) => `${value} años`}
            />
            <CalcSlider
              label="Rendimiento anual estimado"
              value={rate}
              min={4}
              max={14}
              step={0.5}
              onChange={setRate}
              format={(value) => `${value}%`}
              hint="Las tasas de referencia y mercados variables cambian; esto no garantiza resultados."
            />
          </div>

          <div className="landing-chart-stack">
            <div className="landing-result-grid">
              <ResultBox label="Aportado" value={projection.principal} tone="dark" />
              <ResultBox label="Ganancias" value={projection.gains} tone="teal" />
              <ResultBox label="Valor final" value={projection.futureValue} tone="blue" />
            </div>

            <div className="landing-chart-card">
              <div className="landing-chart-legend">
                <LegendDot color="#2B7AE8" label="Valor invertido" />
                <LegendDot color="#A7B5CC" label="Solo aportado" />
              </div>
              <svg viewBox="0 0 600 280" aria-label="Gráfica de proyección de inversión">
                <defs>
                  <linearGradient id="landingCalcArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2B7AE8" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2B7AE8" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="landingCalcLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2B7AE8" />
                    <stop offset="100%" stopColor="#00D4AA" />
                  </linearGradient>
                </defs>

                {[0.25, 0.5, 0.75, 1].map((gridLine) => (
                  <g key={gridLine}>
                    <line x1="60" x2="570" y1={30 + (1 - gridLine) * 210} y2={30 + (1 - gridLine) * 210} />
                    <text x="52" y={34 + (1 - gridLine) * 210} textAnchor="end">
                      ${Math.round((chart.maxY * gridLine) / 1000)}k
                    </text>
                  </g>
                ))}
                {[0, 0.25, 0.5, 0.75, 1].map((xTick) => (
                  <text key={xTick} x={60 + xTick * 510} y="268" textAnchor="middle">
                    {Math.round(years * xTick)}a
                  </text>
                ))}
                <path d={chart.areaPath} fill="url(#landingCalcArea)" />
                <path d={chart.principalPath} className="landing-principal-path" />
                <path d={chart.investedPath} className="landing-invested-path" />
                <circle cx={chart.endPoint.x} cy={chart.endPoint.y} r="5" fill="#00D4AA" stroke="white" strokeWidth="2" />
              </svg>
            </div>

            <p className="landing-disclaimer">
              Proyección con aportaciones mensuales constantes y capitalización mensual. Solo informativo; los
              rendimientos reales dependen del instrumento y del mercado.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function SecuritySection() {
  const proof = [
    {
      title: 'Lectura, no movimiento',
      body: 'Solo leemos transacciones. FinovAI no puede mover, transferir ni autorizar pagos.',
    },
    {
      title: 'Conexión cifrada',
      body: 'El flujo de conexión bancaria se maneja con sesiones seguras. Las claves de conexión se usan solo en el servidor, no en el navegador.',
    },
    {
      title: 'Desconecta cuando quieras',
      body: 'Revoca el acceso desde el banco, el agregador o FinovAI cuando ya no quieras compartir datos.',
    },
  ]

  return (
    <section id="seguridad" className="landing-section landing-security">
      <div className="landing-security-glow landing-security-glow-blue" />
      <div className="landing-security-glow landing-security-glow-teal" />

      <div className="landing-container landing-security-grid">
        <div>
          <Eyebrow>Seguridad bancaria</Eyebrow>
          <h2>
            Tu banco. Tus datos.
            <br />
            <span>Nosotros no tocamos tus credenciales.</span>
          </h2>
          <p>
            La lectura de transacciones ocurre con autorización del usuario. FinovAI usa esos movimientos para detectar
            patrones, no para operar tu dinero.
          </p>

          <div className="landing-security-list">
            {proof.map((item) => (
              <div key={item.title}>
                <Check aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-security-visual-stack">
          <BankNetworkAnimation />
        </div>
      </div>
    </section>
  )
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <section id="faq" className="landing-section landing-section-white">
      <div className="landing-container landing-faq-grid">
        <div className="landing-faq-sticky">
          <Eyebrow>Preguntas frecuentes</Eyebrow>
          <h2>Lo que la gente pregunta antes de conectar su banco.</h2>
          <a href="mailto:contacto@finov.ai">
            ¿Otra pregunta? Escríbenos
            <ArrowRight aria-hidden="true" />
          </a>
        </div>

        <div className="landing-faq-list">
          {faqItems.map((item, index) => (
            <FaqItem
              key={item.question}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? -1 : index)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function LandingFooter({
  onConnect,
}: {
  onConnect: () => void
}) {
  return (
    <>
      <section className="landing-section landing-final-cta">
        <div className="landing-container">
          <h2>
            La fuga ya está ahí.
            <br />
            <span className="landing-gradient-text">Falta convertirla en patrimonio.</span>
          </h2>
          <div className="landing-cta-row landing-centered-row">
            <button className="landing-btn landing-btn-primary landing-btn-large" type="button" onClick={onConnect}>
              Conectar mi banco
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <p>Análisis gratis · Solo lectura · 90 segundos en conectar</p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-grid">
            <div>
              <div className="landing-wordmark landing-wordmark-light">
                <FinovaiLogo />
                <span>
                  finov<span>ai</span>
                </span>
              </div>
              <p>
                Copiloto financiero con IA para México y Latinoamérica. Encuentra fugas. Conviértelas en patrimonio.
              </p>
            </div>

            <FooterColumn
              title="Empresa"
              links={[
                { label: 'Sobre nosotros', href: '/sobre-nosotros' },
                { label: 'Para empresas', href: '/empresas' },
                { label: 'Aliados', href: '/aliados' },
                { label: 'Carreras', href: '/carreras' },
                { label: 'Prensa', href: '/prensa' },
              ]}
            />
            <FooterColumn
              title="Legal"
              links={[
                { label: 'Privacidad', href: '/privacidad' },
                { label: 'Términos', href: '/terminos' },
                { label: 'Seguridad', href: '/seguridad' },
                { label: 'Cookies', href: '/cookies' },
              ]}
            />
          </div>

          <div className="landing-footer-bottom">
            <span>© 2026 FinovAI · Hecho para México</span>
            <span>FinovAI no es una entidad financiera. Las inversiones se ejecutan por terceros.</span>
          </div>
        </div>
      </footer>
    </>
  )
}

function SectionHeader({
  eyebrow,
  title,
  muted,
  align = 'left',
}: {
  eyebrow: string
  title: string
  muted?: string
  align?: 'left' | 'center'
}) {
  return (
    <div className={`landing-section-header landing-section-header-${align}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2>
        {title}
        {muted ? (
          <>
            <br />
            <span>{muted}</span>
          </>
        ) : null}
      </h2>
    </div>
  )
}

function Eyebrow({ children }: { children: string }) {
  return <div className="landing-eyebrow">{children}</div>
}

function StepCard({
  icon,
  step,
  title,
  body,
  children,
}: {
  icon: React.ReactNode
  step: string
  title: string
  body: string
  children: React.ReactNode
}) {
  return (
    <article className="landing-step-card">
      <div className="landing-step-icon">{icon}</div>
      <span>{step}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="landing-step-preview">{children}</div>
    </article>
  )
}

function MiniLeak({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div>
      <span>
        {icon}
        {label}
      </span>
      <strong>-{value}/mes</strong>
    </div>
  )
}

function LeakRow({ leak }: { leak: LeakItem }) {
  const Icon = getLeakIcon(leak.icon)

  return (
    <article className="landing-leak-row">
      <div className="landing-leak-icon" style={{ '--leak-color': leak.color } as CSSProperties}>
        <Icon aria-hidden="true" />
      </div>
      <div>
        <h3>{leak.title}</h3>
        <p>{leak.subtitle}</p>
      </div>
      <div className="landing-leak-amount">
        <strong>-${formatCurrency(leak.month)}</strong>
        <span>${formatCurrency(leak.year)} / año</span>
      </div>
    </article>
  )
}

function CalcSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
  presets,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format: (value: number) => string
  hint?: string
  presets?: Array<{ label: string; value: number }>
}) {
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div className="landing-slider-control">
      <div>
        <label>{label}</label>
        <strong>{format(value)}</strong>
      </div>
      <input
        className="landing-range"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--range-progress': `${percent}%` } as CSSProperties}
        aria-label={label}
      />
      {hint ? <p>{hint}</p> : null}
      {presets ? (
        <div className="landing-presets">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={value === preset.value ? 'is-active' : undefined}
              onClick={() => onChange(preset.value)}
            >
              {preset.label} · ${formatCurrency(preset.value)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ResultBox({ label, value, tone }: { label: string; value: number; tone: 'dark' | 'teal' | 'blue' }) {
  return (
    <div className={`landing-result-box landing-result-${tone}`}>
      <span>{label}</span>
      <strong>${formatCurrency(Math.round(value))}</strong>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span>
      <i style={{ background: color }} />
      {label}
    </span>
  )
}

function FaqItem({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <article className="landing-faq-item">
      <button type="button" onClick={onToggle} aria-expanded={isOpen}>
        <span>{item.question}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      <div className={isOpen ? 'is-open' : undefined}>
        <p>{item.answer}</p>
      </div>
    </article>
  )
}

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div className="landing-footer-column">
      <strong>{title}</strong>
      {links.map((link) => (
        <a key={link.label} href={link.href}>
          {link.label}
        </a>
      ))}
    </div>
  )
}

export function FinovaiLogo() {
  const gradientId = useId().replace(/:/g, '')

  return (
    <svg viewBox="0 0 428 196" fill="none" aria-hidden="true">
      <path
        d="M221.86 110.385C221.86 22.3852 333.86 -25.6148 393.86 38.3852C453.86 102.385 393.86 190.385 341.86 150.385C309.86 126.385 221.86 110.385 221.86 110.385ZM221.86 110.385C221.86 110.385 133.86 94.3852 93.86 70.3852C33.86 22.3852 -26.14 102.385 33.86 158.385C93.86 214.385 221.86 182.385 221.86 110.385Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="22"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={gradientId} x1="9" y1="9" x2="418" y2="9" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2B7AE8" />
          <stop offset="0.5" stopColor="#00D4AA" />
          <stop offset="1" stopColor="#2B7AE8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function getLeakIcon(icon: LeakItem['icon']) {
  if (icon === 'coffee') return Coffee
  if (icon === 'repeat') return Repeat2
  if (icon === 'food') return Utensils
  if (icon === 'taxi') return CreditCard
  return Banknote
}

function formatCurrency(value: number) {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 0 })
}

function buildProjectionChart(
  points: Array<{ month: number; value: number; contributed: number }>,
  months: number,
  years: number
) {
  const width = 600
  const height = 280
  const pad = { left: 60, right: 30, top: 30, bottom: 40 }
  const chartWidth = width - pad.left - pad.right
  const chartHeight = height - pad.top - pad.bottom
  const maxY = Math.max(...points.map((point) => point.value), 1)
  const toPoint = (month: number, value: number) => ({
    x: pad.left + (month / months) * chartWidth,
    y: pad.top + (1 - value / maxY) * chartHeight,
  })
  const investedPath = points
    .map((point, index) => {
      const pos = toPoint(point.month, point.value)
      return `${index === 0 ? 'M' : 'L'} ${pos.x} ${pos.y}`
    })
    .join(' ')
  const principalPath = points
    .map((point, index) => {
      const pos = toPoint(point.month, point.contributed)
      return `${index === 0 ? 'M' : 'L'} ${pos.x} ${pos.y}`
    })
    .join(' ')
  const endPoint = toPoint(months, points.at(-1)?.value || 0)
  const areaPath = `${investedPath} L ${pad.left + chartWidth} ${pad.top + chartHeight} L ${pad.left} ${
    pad.top + chartHeight
  } Z`

  return {
    maxY,
    investedPath,
    principalPath,
    areaPath,
    endPoint,
    years,
  }
}
