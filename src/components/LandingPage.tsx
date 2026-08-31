import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, ChevronDown, KeyRound, Lock, Menu, Sparkles, Unlink, X } from 'lucide-react'

interface LandingPageProps {
  email: string | null
  onConnect: () => void
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

export default function LandingPage({ email, onConnect, onLogout }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleConnect = () => {
    setIsMenuOpen(false)
    onConnect()
  }

  return (
    <div className="finovai-landing landing-v2">
      <LandingNav
        email={email}
        isMenuOpen={isMenuOpen}
        onToggleMenu={() => setIsMenuOpen((current) => !current)}
        onConnect={handleConnect}
        onLogout={onLogout}
      />
      <main>
        <HeroSection onConnect={handleConnect} />
        <ConnectSection onConnect={handleConnect} />
        <AskSection onConnect={handleConnect} />
        <LeaksSection onConnect={handleConnect} />
        <SecuritySection />
        <FaqSection />
        <FinalCtaSection onConnect={handleConnect} />
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
  onLogout,
}: {
  email: string | null
  isMenuOpen: boolean
  onToggleMenu: () => void
  onConnect: () => void
  onLogout: () => void
}) {
  const navLinks = [
    { label: 'Conectar', href: '#conectar' },
    { label: 'Preguntar', href: '#preguntar' },
    { label: 'Seguridad', href: '#seguridad' },
  ]

  return (
    <header className="landing-nav">
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
              <button className="landing-btn landing-btn-ghost" type="button" onClick={onConnect}>
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

        <button className="landing-fake-input" type="button" onClick={onConnect}>
          <span className="landing-fake-input-text">
            {typed}
            <i className="landing-caret" aria-hidden="true" />
          </span>
          <span className="landing-fake-input-send" aria-hidden="true">
            <ArrowUp />
          </span>
        </button>

        <p className="landing-spine">Conecta tus cuentas. Pregunta lo que sea.</p>

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

function ConnectSection({ onConnect }: { onConnect: () => void }) {
  const cards = [
    {
      label: 'Movimientos',
      title: 'Todo en un solo lugar',
      body: 'Tus cuentas y tarjetas sincronizadas, con cada transacción categorizada automáticamente.',
      visual: <MovementsMock />,
    },
    {
      label: 'Categorías',
      title: 'A dónde se va, por rubro',
      body: 'FinovAI ordena tu gasto por categoría para que veas el peso real de cada hábito.',
      visual: <CategoriesMock />,
    },
    {
      label: 'Patrones',
      title: 'Lo que se repite cada mes',
      body: 'Suscripciones dormidas, cargos hormiga y recurrencias que nadie revisa.',
      visual: <PatternsMock />,
    },
  ]

  return (
    <section id="conectar" className="landing-section">
      <div className="landing-section-head">
        <Eyebrow>Conecta</Eyebrow>
        <DisplayTitle accent="Conecta" rest="tus cuentas" size="md" />
        <p>
          Bancos mexicanos, tarjetas, SAT y Bitso. FinovAI trae tus movimientos y los ordena solo — sin hojas
          de cálculo, sin capturar nada a mano.
        </p>
        <button className="landing-btn landing-btn-quiet" type="button" onClick={onConnect}>
          Conectar mi banco
        </button>
      </div>

      <BankMarquee />

      <div className="landing-cards">
        {cards.map((card) => (
          <article className="landing-card" key={card.title}>
            <div className="landing-card-visual">{card.visual}</div>
            <div className="landing-card-copy">
              <span>{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function AskSection({ onConnect }: { onConnect: () => void }) {
  return (
    <section id="preguntar" className="landing-section landing-section-ask">
      <div className="landing-section-head">
        <Sparkles className="landing-spark" aria-hidden="true" />
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
              onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
            >
              <span>{item.question}</span>
              <ChevronDown aria-hidden="true" />
            </button>
            <div className={openIndex === index ? 'is-open' : undefined}>
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
        <DisplayTitle accent="Empieza" rest="por preguntar." />
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
}: {
  accent: string
  rest: string
  size?: 'lg' | 'md' | 'sm'
}) {
  const Tag = size === 'lg' ? 'h1' : 'h2'

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
    <div className="landing-marquee" aria-label="Instituciones conectables">
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

function MovementsMock() {
  const rows = [
    { name: 'Starbucks Reforma', tag: 'Comida fuera', amount: '-$95' },
    { name: 'Uber Eats', tag: 'Comida fuera', amount: '-$340' },
    { name: 'Netflix', tag: 'Suscripciones', amount: '-$219' },
    { name: 'Nómina', tag: 'Ingreso', amount: '+$28,400' },
  ]

  return (
    <div className="landing-mock landing-mock-movements">
      <span className="landing-mock-label">Movimientos</span>
      {rows.map((row) => (
        <div className="landing-mock-row" key={row.name}>
          <div>
            <strong>{row.name}</strong>
            <span>{row.tag}</span>
          </div>
          <b className={row.amount.startsWith('+') ? 'is-positive' : undefined}>{row.amount}</b>
        </div>
      ))}
    </div>
  )
}

function CategoriesMock() {
  const slices = [
    { label: 'Comida fuera', value: 34, tone: 'blue' },
    { label: 'Transporte', value: 22, tone: 'teal' },
    { label: 'Súper', value: 18, tone: 'muted' },
    { label: 'Suscripciones', value: 12, tone: 'muted' },
  ]

  return (
    <div className="landing-mock landing-mock-categories">
      <span className="landing-mock-label">Categorías · Agosto</span>
      {slices.map((slice) => (
        <div className="landing-bar-row" key={slice.label}>
          <span>{slice.label}</span>
          <div className="landing-bar-track">
            <i className={`landing-bar landing-bar-${slice.tone}`} style={{ width: `${slice.value * 2.6}%` }} />
          </div>
          <b>{slice.value}%</b>
        </div>
      ))}
    </div>
  )
}

function PatternsMock() {
  return (
    <div className="landing-mock landing-mock-patterns">
      <span className="landing-mock-label">Patrones detectados</span>
      <div className="landing-pattern-card">
        <strong>5 suscripciones dormidas</strong>
        <span>Sin uso desde marzo</span>
        <b>$894 / mes</b>
      </div>
      <div className="landing-pattern-card">
        <strong>Café · 23 cargos</strong>
        <span>Lunes a viernes, 8:40am</span>
        <b>$2,550 / mes</b>
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
