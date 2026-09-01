import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, CheckCircle2, ChevronDown, KeyRound, Lock, Menu, Repeat, ShieldCheck, Unlink, X } from 'lucide-react'
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface LandingPageProps {
  email: string | null
  onConnect: () => void
  onLogin: () => void
  onSignup: () => void
  onLogout: () => void
}

interface FaqItem {
  question: string
  answer: string
}

interface ChatExchange {
  question: string
  answer: string
  /** Rendered under the answer as a small proof-of-work chart. */
  bars: Array<{ label: string; value: number; tone: 'blue' | 'teal' | 'muted' }>
}

/** The three questions the dashboard itself suggests on first load. */
const heroQuestions = [
  '¿Dónde está mi fuga principal?',
  '¿Qué puedo ahorrar esta semana?',
  '¿Qué patrón se repite?',
]

const chatExchanges: ChatExchange[] = [
  {
    question: '¿Dónde está mi fuga principal?',
    answer:
      'Tu mayor gasto de agosto está en Comida fuera: $8,430 (34% del gasto). Después viene Transporte: $3,120 · Suscripciones: $894.',
    bars: [
      { label: 'Comida fuera', value: 100, tone: 'blue' },
      { label: 'Transporte', value: 37, tone: 'muted' },
      { label: 'Suscripciones', value: 11, tone: 'muted' },
    ],
  },
  {
    question: '¿Qué patrón se repite?',
    answer:
      'Detecté 23 cargos de café al mes y 5 suscripciones activas que no tocas desde marzo. Juntos son $3,444 mensuales en piloto automático.',
    bars: [
      { label: 'Café diario', value: 74, tone: 'blue' },
      { label: 'Suscripciones', value: 26, tone: 'teal' },
    ],
  },
  {
    question: '¿Qué puedo ahorrar esta semana?',
    answer:
      'Con tu ingreso, un objetivo realista es $2,550 al mes sin tocar lo esencial. Empieza cancelando las 5 suscripciones dormidas: $894 recuperados hoy.',
    bars: [
      { label: 'Gasto actual', value: 100, tone: 'muted' },
      { label: 'Margen', value: 28, tone: 'teal' },
    ],
  },
]

const banks = [
  { label: 'BBVA', logoSrc: '/bank-logos/bbva.svg' },
  { label: 'Santander', logoSrc: '/bank-logos/santander.svg' },
  { label: 'Banorte', logoSrc: '/bank-logos/banorte.svg' },
  { label: 'Banamex', logoSrc: '/bank-logos/banamex.svg' },
  { label: 'HSBC', logoSrc: '/bank-logos/hsbc.svg' },
  { label: 'Scotiabank', logoSrc: '/bank-logos/scotiabank.svg' },
  { label: 'Inbursa', logoSrc: '/bank-logos/inbursa.svg' },
  { label: 'Banregio', logoSrc: '/bank-logos/banregio.svg' },
  { label: 'Hey Banco', logoSrc: '/bank-logos/hey-banco.svg' },
  { label: 'AmEx', logoSrc: '/bank-logos/amex.svg' },
  { label: 'Bitso', logoSrc: '/bank-logos/bitso.svg' },
]

const faqItems: FaqItem[] = [
  {
    question: '¿Puede FinovAI mover dinero de mi cuenta?',
    answer:
      'No. FinovAI lee movimientos con tu autorización y los analiza. No inicia transferencias, retiros ni pagos, y no tiene forma técnica de hacerlo.',
  },
  {
    question: '¿Qué bancos puedo conectar?',
    answer:
      'BBVA México, Santander, Banorte IXE, Banamex, HSBC, Scotiabank, Inbursa, Banregio, Hey Banco y American Express, además de fuentes compatibles como el SAT y Bitso. La disponibilidad depende de la cobertura vigente y del tipo de cuenta.',
  },
  {
    question: '¿Cuánto cuesta?',
    answer:
      'Conectar tu banco y preguntarle a FinovAI es gratis. Más adelante FinovAI podrá conectarte con plataformas de inversión aliadas cuando tengas margen de ahorro identificado.',
  },
  {
    question: '¿Dónde quedan mis credenciales bancarias?',
    answer:
      'Nunca pasan por FinovAI. La conexión ocurre dentro del widget del agregador y las llaves de conexión se usan solo en el servidor, nunca en tu navegador. Puedes revocar el acceso cuando quieras.',
  },
]

export default function LandingPage({ email, onConnect, onLogin, onSignup, onLogout }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Every in-page CTA is the same intent: start. Someone already signed in has
  // no signup to do, so they go straight to the panel instead.
  const handleStart = () => {
    setIsMenuOpen(false)
    if (email) onConnect()
    else onSignup()
  }

  const handleLogin = () => {
    setIsMenuOpen(false)
    onLogin()
  }

  return (
    <div className="finovai-landing landing-v2">
      <LandingNav
        email={email}
        isMenuOpen={isMenuOpen}
        onToggleMenu={() => setIsMenuOpen((current) => !current)}
        onConnect={handleStart}
        onLogin={handleLogin}
        onLogout={onLogout}
      />
      <main>
        <HeroSection onConnect={handleStart} />
        <PressBar />
        <ConnectSection onConnect={handleStart} />
        <AskSection onConnect={handleStart} />
        <LeaksSection onConnect={handleStart} />
        <SecuritySection />
        <FaqSection />
        <FinalCtaSection onConnect={handleStart} />
      </main>
      <LandingFooter />
    </div>
  )
}

function LandingNav({
  email,
  isMenuOpen,
  onToggleMenu,
  onConnect,
  onLogin,
  onLogout,
}: {
  email: string | null
  isMenuOpen: boolean
  onToggleMenu: () => void
  onConnect: () => void
  onLogin: () => void
  onLogout: () => void
}) {
  const isScrolled = useIsScrolled(40)
  const navLinks = [
    { label: 'Conectar', href: '#conectar' },
    { label: 'Preguntar', href: '#preguntar' },
    { label: 'Seguridad', href: '#seguridad' },
  ]

  return (
    <header className={isScrolled || isMenuOpen ? 'landing-nav is-scrolled' : 'landing-nav'}>
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
              <button className="landing-btn landing-btn-solid" type="button" onClick={onLogout}>
                Salir
              </button>
            </>
          ) : (
            <>
              <button className="landing-btn landing-btn-ghost" type="button" onClick={onLogin}>
                Iniciar sesión
              </button>
              <button className="landing-btn landing-btn-solid" type="button" onClick={onConnect}>
                Empezar
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
          <button className="landing-btn landing-btn-solid" type="button" onClick={onConnect}>
            {email ? 'Abrir panel' : 'Empezar'}
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </header>
  )
}

function HeroSection({ onConnect }: { onConnect: () => void }) {
  const typed = useTypewriter(heroQuestions)

  return (
    <section id="top" className="landing-hero">
      <div className="landing-hero-sky" aria-hidden="true" />
      <div className="landing-hero-fade" aria-hidden="true" />

      <div className="landing-hero-inner">
        <DisplayTitle accent="Pregúntale" rest="a tu dinero." />

        <p className="landing-hero-lede">FinovAI es tu copiloto financiero con IA.</p>
        <p className="landing-hero-body">
          Conecta tu banco y pregunta en español a dónde se está yendo tu dinero, qué se repite cada mes y
          cuánto podrías ahorrar. Respuestas sobre tus movimientos reales, no consejos genéricos.
        </p>

        <button className="landing-btn landing-btn-solid landing-btn-lg" type="button" onClick={onConnect}>
          Conectar mi banco
          <ArrowRight aria-hidden="true" />
        </button>

        <button
          className="landing-fake-input"
          type="button"
          onClick={onConnect}
          aria-label="Conectar mi banco y hacerle la primera pregunta a tu dinero"
        >
          <span className="landing-fake-input-text" aria-hidden="true">
            {typed}
            <i className="landing-caret" aria-hidden="true" />
          </span>
          <span className="landing-fake-input-send" aria-hidden="true">
            <ArrowUp />
          </span>
        </button>

        <div className="landing-hero-meta">
          <span>
            <Lock aria-hidden="true" /> Solo lectura
          </span>
          <span aria-hidden="true">·</span>
          <span>Sin tarjeta</span>
          <span aria-hidden="true">·</span>
          <span>90 segundos</span>
        </div>
      </div>
    </section>
  )
}

const pressMentions = [
  {
    name: 'Mexico Business News',
    logo: '/press/mexico-business-news.png',
    alt: 'Mexico Business News',
    url: 'https://mexicobusiness.news/cloudanddata/news/turning-money-leaks-investments-finovai',
    height: 20,
  },
  {
    name: 'El Financiero Bloomberg · Factor Fintech',
    logo: '/press/bloomberg.png',
    alt: 'El Financiero Bloomberg',
    url: 'https://www.youtube.com/watch?v=nUDtyTAzh0U',
    height: 18,
  },
  {
    name: 'El Economista · ProChile',
    logo: '/press/el-economista.png',
    alt: 'El Economista',
    url: 'https://www.eleconomista.com.mx/mercados/financiamiento-traves-grupo-bolsa-mexicana-crecio-24-20260120-796157.html',
    height: 13,
  },
]

function PressBar() {
  return (
    <aside className="landing-press-bar" aria-label="Menciones en medios">
      <span className="landing-press-label">Destacado en</span>
      <div className="landing-press-logos">
        {pressMentions.map((item) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="landing-press-item"
            title={item.name}
          >
            <img
              src={item.logo}
              alt={item.alt}
              style={{ maxHeight: `${item.height}px` }}
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </aside>
  )
}

function ConnectSection({ onConnect }: { onConnect: () => void }) {
  return (
    <section id="conectar" className="landing-section">
      <div className="landing-section-head">
        <Eyebrow>Conecta</Eyebrow>
        <DisplayTitle accent="Conecta" rest="tus cuentas" size="md" />
        <p>
          Bancos mexicanos, tarjetas, SAT y Bitso. FinovAI sincroniza tus movimientos y los ordena solo — sin hojas
          de cálculo, sin capturar nada a mano.
        </p>
        <button className="landing-btn landing-btn-quiet" type="button" onClick={onConnect}>
          Conectar mi banco
        </button>
      </div>

      <BankMarquee />

      {/* FinovAI Bento Suite */}
      <div className="landing-bento-grid">
        {/* Row 1: Hero Showcase */}
        <div className="landing-bento-hero-row">
          <div className="landing-bento-card">
            <div className="landing-bento-head">
              <div className="landing-bento-live-tag">
                <span className="landing-bento-pulse-dot" />
                <span>Sincronización en vivo</span>
              </div>
              <h3 className="landing-bento-title">Monitorea cada movimiento</h3>
              <p className="landing-bento-body">
                Tus cuentas bancarias, tarjetas, SAT y Bitso en un solo flujo limpio, categorizado al segundo.
              </p>
            </div>
            <div className="landing-bento-visual">
              <TransactionsMock />
            </div>
          </div>

          <div className="landing-bento-card">
            <div className="landing-bento-head">
              <span className="landing-bento-tag">Mapa de capital</span>
              <h3 className="landing-bento-title">Visualiza tu flujo completo</h3>
              <p className="landing-bento-body">
                Ingresos vs gastos fijos, suscripciones y margen real de ahorro en un solo mapa visual claro.
              </p>
            </div>
            <div className="landing-bento-visual">
              <CapitalMapMock />
            </div>
          </div>
        </div>

        {/* Row 2: Secondary Feature Row */}
        <div className="landing-bento-sub-row">
          <div className="landing-bento-card">
            <div className="landing-bento-head">
              <span className="landing-bento-tag">Auditoría de fugas</span>
              <h3 className="landing-bento-title-sm">Elimina cobros dormidos</h3>
              <p className="landing-bento-body-sm">
                Suscripciones inactivas y microgastos recurrentes identificados antes de afectar tu quincena.
              </p>
            </div>
            <div className="landing-bento-visual">
              <LeaksBentoMock />
            </div>
          </div>

          <div className="landing-bento-card">
            <div className="landing-bento-head">
              <span className="landing-bento-tag">Copiloto IA</span>
              <h3 className="landing-bento-title-sm">Pregúntale a tu dinero</h3>
              <p className="landing-bento-body-sm">
                Sin fórmulas ni tablas complejas. Pregunta en español y obtén respuestas exactas sobre tus números.
              </p>
            </div>
            <div className="landing-bento-visual">
              <AiChatBentoMock />
            </div>
          </div>

          <div className="landing-bento-card">
            <div className="landing-bento-head">
              <span className="landing-bento-tag">Seguridad total</span>
              <h3 className="landing-bento-title-sm">Solo lectura. Cero riesgos</h3>
              <p className="landing-bento-body-sm">
                Cifrado AES-256 de grado bancario. FinovAI jamás puede mover tu dinero ni guardar contraseñas.
              </p>
            </div>
            <div className="landing-bento-visual">
              <SecurityBentoMock />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function AskSection({ onConnect }: { onConnect: () => void }) {
  return (
    <section id="preguntar" className="landing-section landing-section-ask">
      <div className="landing-section-head">
        <Eyebrow>Pregunta</Eyebrow>
        <DisplayTitle accent="Pregunta" rest="lo que sea" size="md" />
        <p>
          FinovAI responde con tus números, no con generalidades. Cada respuesta sale de tus movimientos
          conectados y puedes ver de dónde salió.
        </p>
      </div>

      <ChatDemo />

      <button className="landing-btn landing-btn-solid landing-btn-lg" type="button" onClick={onConnect}>
        Probar con mis movimientos
        <ArrowRight aria-hidden="true" />
      </button>
    </section>
  )
}

function LeaksSection({ onConnect }: { onConnect: () => void }) {
  const rows = [
    { title: 'Café diario', detail: '23 cargos al mes', month: 2550 },
    { title: 'Suscripciones dormidas', detail: '5 activas, 0 usadas', month: 894 },
    { title: 'Delivery nocturno', detail: 'Viernes y sábados', month: 3180 },
  ]
  const total = rows.reduce((sum, row) => sum + row.month, 0)

  return (
    <section id="fugas" className="landing-section">
      <div className="landing-section-head">
        <Eyebrow>El resultado</Eyebrow>
        <DisplayTitle accent="Encuentra" rest="lo que se fuga" size="md" />
        <p>
          No es que gastes de más. Es que una parte de tu dinero sale en automático, en cargos tan pequeños
          que nunca los revisas. FinovAI los junta y te dice cuánto suman.
        </p>
      </div>

      <div className="landing-leaks">
        <div className="landing-leak-list">
          {rows.map((row) => (
            <div className="landing-leak-row" key={row.title}>
              <div>
                <strong>{row.title}</strong>
                <span>{row.detail}</span>
              </div>
              <b>-${formatCurrency(row.month)}</b>
            </div>
          ))}
          <div className="landing-leak-row landing-leak-total">
            <div>
              <strong>Total al mes</strong>
              <span>Margen que puedes recuperar</span>
            </div>
            <b>${formatCurrency(total)}</b>
          </div>
        </div>

        <aside className="landing-leak-panel">
          <Eyebrow>Si lo apartas cada mes</Eyebrow>
          <div className="landing-leak-figure">
            ${formatCurrency(total * 12)}
            <span>al año</span>
          </div>
          <p>
            Ese margen es tuyo desde el primer mes. Cuando quieras hacerlo crecer, FinovAI te muestra opciones
            de inversión de terceros regulados — la decisión y el movimiento son tuyos.
          </p>
          <button className="landing-btn landing-btn-quiet" type="button" onClick={onConnect}>
            Ver mi margen real
            <ArrowRight aria-hidden="true" />
          </button>
        </aside>
      </div>
    </section>
  )
}

function SecuritySection() {
  const proof = [
    {
      icon: Lock,
      title: 'Solo lectura',
      body: 'FinovAI lee movimientos. No puede mover, transferir ni autorizar pagos desde tus cuentas.',
    },
    {
      icon: KeyRound,
      title: 'Sin credenciales nuestras',
      body: 'Tus claves bancarias nunca pasan por FinovAI. La conexión ocurre en el widget del agregador.',
    },
    {
      icon: Unlink,
      title: 'Revocable cuando quieras',
      body: 'Desconecta desde tu banco, desde el agregador o desde FinovAI y dejamos de leer al instante.',
    },
  ]

  return (
    <section id="seguridad" className="landing-section landing-section-security">
      <div className="landing-section-head">
        <Eyebrow>Seguridad</Eyebrow>
        <DisplayTitle accent="Tu banco." rest="Tus datos." size="md" />
        <p>FinovAI no es una entidad financiera y no custodia tu dinero. Solo lo entiende.</p>
      </div>

      <div className="landing-proof">
        {proof.map((item) => {
          const Icon = item.icon

          return (
            <div className="landing-proof-item" key={item.title}>
              <Icon aria-hidden="true" />
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(-1)
  const panelId = useId()

  return (
    <section id="faq" className="landing-section landing-section-faq">
      <div className="landing-section-head">
        <Eyebrow>Preguntas</Eyebrow>
        <DisplayTitle accent="Antes" rest="de conectar" size="sm" />
      </div>

      <div className="landing-faq">
        {faqItems.map((item, index) => (
          <article className="landing-faq-item" key={item.question}>
            <button
              type="button"
              aria-expanded={openIndex === index}
              aria-controls={`${panelId}-${index}`}
              onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
            >
              <span>{item.question}</span>
              <ChevronDown aria-hidden="true" />
            </button>
            <div id={`${panelId}-${index}`} className={openIndex === index ? 'is-open' : undefined}>
              <p>{item.answer}</p>
            </div>
          </article>
        ))}
      </div>

      <a className="landing-faq-contact" href="mailto:contacto@finov.ai">
        ¿Otra pregunta? Escríbenos
        <ArrowRight aria-hidden="true" />
      </a>
    </section>
  )
}

function FinalCtaSection({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="landing-final">
      <div className="landing-hero-sky landing-hero-sky-flipped" aria-hidden="true" />
      <div className="landing-final-inner">
        <DisplayTitle accent="Empieza" rest="por preguntar." as="h2" />
        <p>Conecta una cuenta y hazle la primera pregunta a tu dinero.</p>
        <button className="landing-btn landing-btn-solid landing-btn-lg" type="button" onClick={onConnect}>
          Conectar mi banco
          <ArrowRight aria-hidden="true" />
        </button>
        <span className="landing-final-meta">Gratis · Solo lectura · Sin tarjeta</span>
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-grid">
        <div>
          <div className="landing-wordmark">
            <FinovaiLogo />
            <span>
              finov<span>ai</span>
            </span>
          </div>
          <p>Copiloto financiero con IA para México y Latinoamérica.</p>
        </div>

        <FooterColumn
          title="Empresa"
          links={[
            { label: 'Sobre nosotros', href: '/sobre-nosotros' },
            { label: 'Para empresas', href: '/empresas' },
            { label: 'Aliados', href: '/aliados' },
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
        <span>
          FinovAI no es una entidad financiera ni asesor de inversiones registrado. Las inversiones se
          ejecutan con terceros regulados.
        </span>
      </div>
    </footer>
  )
}

/* ---------------------------------------------------------------- pieces */

function DisplayTitle({
  accent,
  rest,
  size = 'lg',
  as,
}: {
  accent: string
  rest: string
  size?: 'lg' | 'md' | 'sm'
  /** Heading level is independent of size: only the hero is the page's h1. */
  as?: 'h1' | 'h2'
}) {
  const Tag = as ?? (size === 'lg' ? 'h1' : 'h2')

  return (
    <Tag className={`landing-display landing-display-${size}`}>
      <em>{accent}</em> {rest}
    </Tag>
  )
}

function Eyebrow({ children }: { children: string }) {
  return <div className="landing-eyebrow">{children}</div>
}

function BankMarquee() {
  const track = [...banks, ...banks]

  return (
    <div className="landing-marquee" role="group" aria-label="Instituciones conectables">
      <div className="landing-marquee-track">
        {track.map((bank, index) => (
          <div className="landing-marquee-item" key={`${bank.label}-${index}`} aria-hidden={index >= banks.length}>
            <img src={bank.logoSrc} alt={index < banks.length ? bank.label : ''} loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatDemo() {
  const [index, setIndex] = useState(0)
  const reduceMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reduceMotion) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % chatExchanges.length)
    }, 5200)
    return () => window.clearInterval(timer)
  }, [reduceMotion])

  const exchange = chatExchanges[index]

  return (
    <div className="landing-chat">
      <div className="landing-chat-head">
        <span className="landing-chat-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>FinovAI · Chat</span>
      </div>

      <div className="landing-chat-body" key={index}>
        <div className="landing-bubble landing-bubble-user">{exchange.question}</div>

        <div className="landing-bubble landing-bubble-ai">
          <p>{exchange.answer}</p>
          <div className="landing-bars">
            {exchange.bars.map((bar) => (
              <div className="landing-bar-row" key={bar.label}>
                <span>{bar.label}</span>
                <div className="landing-bar-track">
                  <i className={`landing-bar landing-bar-${bar.tone}`} style={{ width: `${bar.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="landing-chat-suggestions">
        {chatExchanges.map((item, itemIndex) => (
          <button
            key={item.question}
            type="button"
            className={itemIndex === index ? 'is-active' : undefined}
            onClick={() => setIndex(itemIndex)}
          >
            {item.question}
          </button>
        ))}
      </div>
    </div>
  )
}

function TransactionsMock() {
  const transactions = [
    {
      name: 'Starbucks Reforma',
      tag: 'Café diario',
      date: '1 sep',
      amount: '-$95',
      recurring: false,
      isIncome: false,
      logo: '/brand-logos/starbucks.svg',
      brand: '#006241',
      // Square glyph, knocked out white the way the real app icon reads.
      logoStyle: { width: 21, height: 21 },
      mono: true,
    },
    {
      name: 'Netflix México',
      tag: 'Suscripción',
      date: '1 sep',
      amount: '-$219',
      recurring: true,
      isIncome: false,
      logo: '/brand-logos/netflix.svg',
      // Netflix's own UI black rather than pure #000, which vanished into the
      // row at 1.1:1.
      brand: '#141414',
      // The only mark here whose colour *is* the identity, so it keeps its
      // own red gradient instead of being knocked out. Tall 0.55 ratio.
      logoStyle: { width: 13, height: 23 },
      mono: false,
    },
    {
      name: 'Uber Eats',
      tag: 'Comida fuera',
      date: '31 ago',
      amount: '-$340',
      recurring: false,
      isIncome: false,
      logo: '/brand-logos/uber-eats.svg',
      brand: '#06C167',
      logoStyle: { width: 21, height: 21 },
      mono: true,
    },
    {
      name: 'BBVA Nómina',
      tag: 'Depósito quincenal',
      date: '31 ago',
      amount: '+$28,400',
      recurring: true,
      isIncome: true,
      logo: '/brand-logos/bbva.svg',
      brand: '#004580',
      // Wide 3.34 wordmark, so it is sized on width. The final "A" is the
      // arch, so it can't be cropped to a square mark -- it fills instead.
      logoStyle: { width: 31, height: 10 },
      mono: true,
    },
  ]

  return (
    <div className="landing-tx-container">
      {transactions.map((tx) => (
        <div className={`landing-tx-row ${tx.isIncome ? 'is-income' : ''}`} key={tx.name}>
          <div className="landing-tx-left">
            <span className="landing-tx-icon" style={{ background: tx.brand }} aria-hidden="true">
              <img
                className={tx.mono ? 'is-mono' : undefined}
                src={tx.logo}
                alt=""
                style={tx.logoStyle}
                loading="lazy"
              />
            </span>
            <div>
              <strong>{tx.name}</strong>
              <span>{tx.tag} · {tx.date}</span>
            </div>
          </div>
          <div className="landing-tx-right">
            {tx.recurring ? (
              <Repeat className="landing-tx-repeat" aria-label="Recurrente" />
            ) : null}
            <b className={tx.isIncome ? 'is-positive' : undefined}>{tx.amount}</b>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Capital map, built on the shadcn `chart-bar-mixed` pattern (registry deps
 * `card` + `chart`, both already vendored in src/components/ui). One bar per
 * destination, ranked, with the amount and share trailing each bar.
 */
const capitalConfig = {
  amount: { label: 'Monto' },
  ahorro: { label: 'Ahorro', color: '#00D4AA' },
  hogar: { label: 'Hogar', color: '#F8BF5E' },
  transporte: { label: 'Transporte', color: '#B293F9' },
  viajes: { label: 'Viajes', color: '#7EADF9' },
  comida: { label: 'Comida', color: '#5BCFE3' },
  salud: { label: 'Salud', color: '#F88095' },
} satisfies ChartConfig

const capitalData = [
  { key: 'ahorro', amount: 26799, pct: 42, fill: 'var(--color-ahorro)' },
  { key: 'hogar', amount: 18628, pct: 30, fill: 'var(--color-hogar)' },
  { key: 'transporte', amount: 5803, pct: 9, fill: 'var(--color-transporte)' },
  { key: 'viajes', amount: 5160, pct: 8, fill: 'var(--color-viajes)' },
  { key: 'comida', amount: 4891, pct: 8, fill: 'var(--color-comida)' },
  { key: 'salud', amount: 1910, pct: 3, fill: 'var(--color-salud)' },
]

function CapitalMapMock() {
  return (
    <div className="landing-capital-map">
      <div className="landing-capital-map-head">
        <span>Ingresos + rendimientos</span>
        <b>$65,400</b>
      </div>

      <ChartContainer config={capitalConfig} className="landing-capital-chart">
        <BarChart
          accessibilityLayer
          data={capitalData}
          layout="vertical"
          margin={{ left: 0, right: 4 }}
          barCategoryGap={9}
        >
          <YAxis
            dataKey="key"
            type="category"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={86}
            tick={{ fill: 'var(--v2-ink)', fontSize: 12.5, fontWeight: 500 }}
            tickFormatter={(value) => capitalConfig[value as keyof typeof capitalConfig]?.label ?? value}
          />
          <XAxis dataKey="amount" type="number" domain={[0, (dataMax: number) => dataMax * 1.46]} hide />
          <YAxis
            yAxisId="share"
            dataKey="key"
            type="category"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickMargin={0}
            width={44}
            tick={{ fill: 'var(--v2-ink-muted)', fontSize: 12, fontWeight: 500 }}
            tickFormatter={(value) =>
              `${capitalData.find((row) => row.key === value)?.pct ?? 0}%`
            }
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="amount" radius={5} isAnimationActive={false}>
            <LabelList
              dataKey="amount"
              position="right"
              offset={10}
              className="landing-capital-value"
              formatter={(value: unknown) => `$${formatCurrency(Number(value ?? 0))}`}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}

function LeaksBentoMock() {
  return (
    <div className="landing-bento-leaks">
      <div className="landing-bento-leak-item">
        <div className="landing-bento-leak-info">
          <strong>5 suscripciones dormidas</strong>
          <span>Sin uso en más de 90 días</span>
        </div>
        <b className="landing-bento-leak-val">-$894/mes</b>
      </div>
      <div className="landing-bento-leak-item">
        <div className="landing-bento-leak-info">
          <strong>Café diario · 23 cargos</strong>
          <span>Lunes a viernes 8:40 am</span>
        </div>
        <b className="landing-bento-leak-val">-$2,550/mes</b>
      </div>
      <div className="landing-bento-leak-pill">
        <span>Margen identificado</span>
        <strong>+$3,444 MXN / mes</strong>
      </div>
    </div>
  )
}

function AiChatBentoMock() {
  return (
    <div className="landing-bento-chat">
      <div className="landing-bento-chat-msg landing-bento-chat-user">
        <span>¿Cuánto gasté en delivery este mes?</span>
      </div>
      <div className="landing-bento-chat-msg landing-bento-chat-ai">
        <div className="landing-bento-chat-ai-head">
          <span>FinovAI Copiloto</span>
        </div>
        <p>
          Llevas <b>$3,180 MXN</b> en 9 pedidos de Uber Eats y Rappi. Es un <b>38% más</b> que el mes pasado.
        </p>
      </div>
    </div>
  )
}

function SecurityBentoMock() {
  return (
    <div className="landing-bento-security">
      <div className="landing-bento-sec-badge">
        <div className="landing-bento-sec-icon">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <strong>Cifrado AES-256</strong>
          <span>Conexión cifrada de extremo a extremo</span>
        </div>
      </div>
      <div className="landing-bento-sec-list">
        <div className="landing-bento-sec-item">
          <CheckCircle2 className="size-3.5" style={{ color: '#00D4AA' }} />
          <span>Acceso 100% de solo lectura</span>
        </div>
        <div className="landing-bento-sec-item">
          <CheckCircle2 className="size-3.5" style={{ color: '#00D4AA' }} />
          <span>Sin credenciales en navegador</span>
        </div>
      </div>
    </div>
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

/* ----------------------------------------------------------------- hooks */

/** Types each phrase out, holds, deletes, then moves to the next one. */
function useTypewriter(phrases: string[]) {
  const [text, setText] = useState('')
  const stateRef = useRef({ phrase: 0, char: 0, deleting: false })
  const reduceMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reduceMotion) {
      setText(phrases[0])
      return
    }

    let timer = 0

    const tick = () => {
      const state = stateRef.current
      const current = phrases[state.phrase]

      if (!state.deleting) {
        state.char += 1
        setText(current.slice(0, state.char))
        if (state.char >= current.length) {
          state.deleting = true
          timer = window.setTimeout(tick, 2200)
          return
        }
        timer = window.setTimeout(tick, 55)
        return
      }

      state.char -= 1
      setText(current.slice(0, state.char))
      if (state.char <= 0) {
        state.deleting = false
        state.phrase = (state.phrase + 1) % phrases.length
        timer = window.setTimeout(tick, 320)
        return
      }
      timer = window.setTimeout(tick, 24)
    }

    timer = window.setTimeout(tick, 600)
    return () => window.clearTimeout(timer)
  }, [phrases, reduceMotion])

  return text
}

/** True once the page has scrolled far enough that the nav sits over content. */
function useIsScrolled(threshold: number) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return scrolled
}

function usePrefersReducedMotion() {
  const query = useMemo(
    () => (typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)')),
    []
  )
  const [reduce, setReduce] = useState(() => query?.matches ?? false)

  useEffect(() => {
    if (!query) return
    const onChange = (event: MediaQueryListEvent) => setReduce(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [query])

  return reduce
}

function formatCurrency(value: number) {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 0 })
}
