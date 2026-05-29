import { useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'

import { FinovaiLogo } from './LandingPage'

type StaticPageKind = 'legal' | 'company'

interface StaticPageSection {
  title: string
  body: string[]
}

interface StaticPageData {
  kind: StaticPageKind
  eyebrow: string
  title: string
  intro: string
  updated?: string
  sections: StaticPageSection[]
  cta?: {
    label: string
    href: string
  }
}

export type StaticPageSlug =
  | 'privacy'
  | 'terms'
  | 'security'
  | 'cookies'
  | 'about'
  | 'business'
  | 'partners'
  | 'careers'
  | 'press'

const CONTACT_EMAIL = 'contacto@finov.ai'
const UPDATED_AT = '29 de mayo de 2026'

const staticPages: Record<StaticPageSlug, StaticPageData> = {
  privacy: {
    kind: 'legal',
    eyebrow: 'Legal',
    title: 'Aviso de privacidad',
    intro:
      'Este aviso resume cómo FinovAI trata datos personales y financieros para operar el diagnóstico de fugas, la conexión vía Syncfy y las proyecciones ilustrativas de inversión.',
    updated: UPDATED_AT,
    sections: [
      {
        title: 'Qué datos usamos',
        body: [
          'Datos de cuenta como email, estado de sesión y preferencias básicas.',
          'Datos de acceso passwordless, como códigos de inicio de sesión, links de acceso, hashes de tokens y timestamps de expiración.',
          'Datos transaccionales obtenidos con tu autorización a través de Syncfy Open Data: comercios, fechas, importes, divisas, saldos y referencias disponibles.',
          'Datos técnicos necesarios para operar el servicio, diagnosticar errores y dar soporte, incluyendo identificadores de Syncfy, credenciales agregadas, eventos webhook y rid de errores cuando aplique.',
        ],
      },
      {
        title: 'Para qué los usamos',
        body: [
          'Para conectar tu banco, billetera digital o información fiscal mediante Syncfy; importar movimientos; detectar patrones de gasto; calcular oportunidades de ahorro; mostrar proyecciones ilustrativas; y preparar recomendaciones o conexiones con plataformas de inversión aliadas.',
          'También usamos datos para seguridad, prevención de abuso, soporte técnico, trazabilidad de sincronizaciones y mejora del producto.',
        ],
      },
      {
        title: 'Con quién se comparte',
        body: [
          'Syncfy procesa la conexión con instituciones financieras y fiscales cuando decides vincular una cuenta.',
          'Cloudflare puede procesar emails transaccionales de acceso, infraestructura, seguridad y entrega de contenido.',
          'Podemos compartir información necesaria con proveedores de infraestructura, soporte y análisis que nos ayudan a operar FinovAI.',
          'Si eliges avanzar con una plataforma de inversión aliada, te mostraremos el contexto antes de enviar o capturar datos para ese tercero. FinovAI no ejecuta inversiones dentro de la app.',
        ],
      },
      {
        title: 'Tus controles',
        body: [
          'Puedes dejar de compartir datos desconectando tus credenciales desde el banco, Syncfy o FinovAI cuando el control esté disponible.',
          `Para solicitar acceso, corrección, eliminación u oposición sobre tus datos, escríbenos a ${CONTACT_EMAIL}.`,
        ],
      },
    ],
    cta: { label: 'Escribir a privacidad', href: `mailto:${CONTACT_EMAIL}` },
  },
  terms: {
    kind: 'legal',
    eyebrow: 'Legal',
    title: 'Términos de uso',
    intro:
      'Estos términos describen el uso de FinovAI como copiloto financiero para encontrar fugas de dinero y convertirlas en decisiones de ahorro e inversión.',
    updated: UPDATED_AT,
    sections: [
      {
        title: 'Qué hace FinovAI',
        body: [
          'FinovAI analiza transacciones autorizadas por el usuario, identifica patrones de gasto, sugiere oportunidades de ahorro y muestra proyecciones educativas basadas en supuestos.',
          'FinovAI no es banco, casa de bolsa, asesor financiero registrado ni entidad financiera. No custodia dinero, no inicia pagos, no transfiere fondos y no ejecuta inversiones.',
        ],
      },
      {
        title: 'Conexión con terceros',
        body: [
          'La conexión bancaria, fiscal o de billeteras digitales ocurre mediante Syncfy.',
          'Las plataformas de inversión aliadas son servicios de terceros. Cualquier apertura de cuenta, inversión, rendimiento, comisión o riesgo se rige por los términos de ese tercero.',
        ],
      },
      {
        title: 'Proyecciones y recomendaciones',
        body: [
          'Las cifras de crecimiento son ilustrativas y dependen de supuestos como aportación, plazo y rendimiento. No son garantía de resultados.',
          'El usuario es responsable de revisar si una decisión financiera es adecuada para su situación, perfil de riesgo y obligaciones fiscales.',
        ],
      },
      {
        title: 'Uso aceptable',
        body: [
          'Debes usar FinovAI con datos propios o datos que tengas autorización para compartir.',
          'No debes intentar vulnerar la app, extraer datos de otros usuarios, evadir límites técnicos ni usar el servicio para fraude o actividades ilegales.',
        ],
      },
    ],
    cta: { label: 'Contactar a FinovAI', href: `mailto:${CONTACT_EMAIL}` },
  },
  security: {
    kind: 'legal',
    eyebrow: 'Legal',
    title: 'Seguridad',
    intro:
      'La seguridad de FinovAI se diseña alrededor de una idea simple: leer movimientos para analizarlos, sin mover dinero desde la app.',
    updated: UPDATED_AT,
    sections: [
      {
        title: 'Modelo de conexión',
        body: [
          'Usamos el widget de Syncfy para crear o actualizar credenciales. FinovAI no debe pedirte credenciales bancarias fuera de ese flujo.',
          'La API key de Syncfy se usa en backend. El navegador usa sesiones o tokens de alcance limitado para iniciar el flujo de conexión.',
          'El acceso a cuenta está diseñado como passwordless: enviamos códigos o links por email y no almacenamos contraseñas.',
        ],
      },
      {
        title: 'Lo que FinovAI no hace',
        body: [
          'No iniciamos pagos, retiros, transferencias ni movimientos de inversión.',
          'No prometemos que una conexión bancaria esté siempre disponible; depende de Syncfy, de la institución conectada y del consentimiento vigente del usuario.',
        ],
      },
      {
        title: 'Operación y soporte',
        body: [
          'Guardamos identificadores técnicos de Syncfy, credenciales sincronizadas, eventos webhook y rid de errores para soporte, auditoría y sincronización.',
          'Los códigos de acceso expiran y se guardan como hashes para validar la sesión sin conservar el código en texto claro.',
          `Si detectas un problema de seguridad, escribe a ${CONTACT_EMAIL} con una descripción clara, pasos de reproducción y capturas si aplican.`,
        ],
      },
    ],
    cta: { label: 'Reportar seguridad', href: `mailto:${CONTACT_EMAIL}` },
  },
  cookies: {
    kind: 'legal',
    eyebrow: 'Legal',
    title: 'Cookies y almacenamiento local',
    intro:
      'FinovAI usa almacenamiento técnico para que la experiencia funcione y para recordar estados básicos del producto.',
    updated: UPDATED_AT,
    sections: [
      {
        title: 'Uso actual',
        body: [
          'Usamos almacenamiento local para recordar datos básicos de sesión, como el email usado para abrir el dashboard.',
          'También podemos guardar un secreto de sesión del navegador para mantener tu dashboard autenticado. Si borras el almacenamiento local, tendrás que iniciar sesión de nuevo.',
          'Cloudflare y proveedores integrados pueden usar cookies o almacenamiento técnico para seguridad, entrega de contenido, sesión o prevención de abuso.',
        ],
      },
      {
        title: 'Analítica y marketing',
        body: [
          'Si agregamos herramientas de analítica, atribución o marketing, actualizaremos esta página para describirlas y ofrecer los controles correspondientes.',
        ],
      },
      {
        title: 'Control del navegador',
        body: [
          'Puedes borrar cookies y almacenamiento local desde tu navegador. Al hacerlo, algunas funciones como sesión, dashboard o conexión pueden requerir iniciar de nuevo.',
        ],
      },
    ],
  },
  about: {
    kind: 'company',
    eyebrow: 'Empresa',
    title: 'Sobre FinovAI',
    intro:
      'FinovAI está construyendo un copiloto financiero para México y Latinoamérica: conecta tus movimientos, encuentra fugas invisibles y convierte ese margen en una ruta hacia inversión.',
    sections: [
      {
        title: 'Qué problema resolvemos',
        body: [
          'Muchas personas no necesitan otra gráfica de gastos: necesitan ver qué dinero se escapa, cuánto podría crecer y qué siguiente paso tomar.',
          'FinovAI analiza transacciones autorizadas vía Syncfy para detectar patrones como cafés frecuentes, suscripciones olvidadas, entregas nocturnas o gastos repetidos por día de la semana.',
        ],
      },
      {
        title: 'Cómo funciona el modelo',
        body: [
          'El usuario conecta sus cuentas, FinovAI identifica oportunidades de ahorro y muestra una proyección ilustrativa de lo que ese dinero podría representar si se invierte con constancia.',
          'Cuando el usuario quiere dar el siguiente paso, FinovAI puede conectarlo con plataformas de inversión para México y Latinoamérica. La inversión se ejecuta con esos terceros, no dentro de FinovAI.',
        ],
      },
      {
        title: 'Nuestra regla de producto',
        body: [
          'FinovAI trabaja con lectura transaccional. No inicia pagos, retiros, transferencias ni operaciones de inversión desde la app.',
          'La conexión bancaria ocurre mediante Syncfy, por lo que FinovAI puede enfocarse en análisis, claridad y recomendaciones accionables.',
        ],
      },
    ],
    cta: { label: 'Conectar mi banco', href: '/dashboard' },
  },
  business: {
    kind: 'company',
    eyebrow: 'Empresa',
    title: 'Para empresas',
    intro:
      'FinovAI ayuda a empleadores, fintechs y plataformas financieras a convertir datos transaccionales autorizados en decisiones de ahorro e inversión más claras para sus usuarios.',
    sections: [
      {
        title: 'Bienestar financiero para empleados',
        body: [
          'Los empleados conectan sus cuentas vía Syncfy y reciben un diagnóstico práctico: dónde se fuga el dinero, qué hábitos se repiten y cuánto podría crecer ese margen si se invierte con disciplina.',
          'Esto convierte un beneficio financiero en una experiencia medible, personalizada y orientada a acción.',
        ],
      },
      {
        title: 'Experiencias embebidas para fintechs',
        body: [
          'FinovAI puede funcionar como capa de inteligencia sobre transacciones autorizadas: clasificación de gastos, detección de patrones, oportunidades de ahorro y proyecciones educativas.',
          'El objetivo es ayudar a que los usuarios entiendan su comportamiento financiero antes de elegir una cuenta, producto o plataforma de inversión.',
        ],
      },
      {
        title: 'Canal hacia inversión',
        body: [
          'El modelo comercial conecta personas con intención real de ahorrar con portales de inversión relevantes para México y Latinoamérica.',
          'FinovAI no ejecuta inversiones ni custodia dinero. La apertura, idoneidad, ejecución y riesgos pertenecen a la plataforma aliada que el usuario decida usar.',
        ],
      },
    ],
    cta: { label: 'Hablar de alianzas', href: `mailto:${CONTACT_EMAIL}` },
  },
  partners: {
    kind: 'company',
    eyebrow: 'Empresa',
    title: 'Aliados',
    intro:
      'FinovAI gana cuando conecta usuarios con intención real de ahorro con plataformas de inversión y servicios financieros relevantes.',
    sections: [
      {
        title: 'Plataformas de inversión',
        body: [
          'Buscamos aliados que puedan recibir usuarios que ya entendieron su fuga mensual, tienen una meta concreta y quieren explorar una ruta de inversión.',
          'La experiencia debe ser clara sobre riesgos, comisiones, requisitos, idoneidad y responsabilidades del tercero.',
        ],
      },
      {
        title: 'Datos y open finance',
        body: [
          'Syncfy es la base de conexión de FinovAI para bancos, SAT y fuentes compatibles en México.',
          'Sobre esa capa, FinovAI crea análisis de patrones, contexto para el usuario y oportunidades de ahorro accionables.',
        ],
      },
      {
        title: 'Distribución y educación financiera',
        body: [
          'También nos interesan equipos que quieran llevar diagnósticos financieros simples a audiencias de México y LATAM.',
          'La prioridad es que el usuario vea el impacto de sus hábitos y pueda tomar una decisión informada sin sentir que está recibiendo una venta genérica.',
        ],
      },
    ],
    cta: { label: 'Proponer alianza', href: `mailto:${CONTACT_EMAIL}` },
  },
  careers: {
    kind: 'company',
    eyebrow: 'Empresa',
    title: 'Carreras',
    intro:
      'Estamos construyendo FinovAI alrededor de producto financiero, datos transaccionales, seguridad y partnerships para México y Latinoamérica.',
    sections: [
      {
        title: 'Qué tipo de trabajo hacemos',
        body: [
          'Diseñamos flujos donde una persona conecta su banco, entiende sus fugas de dinero y ve una ruta realista para convertir ahorro en inversión.',
          'Eso exige ingeniería full-stack, integración con Syncfy, seguridad de datos financieros, diseño de producto fintech y análisis aplicado a transacciones.',
        ],
      },
      {
        title: 'Perfiles que nos interesan',
        body: [
          'Producto financiero, diseño de experiencias fintech, ingeniería full-stack, data/AI aplicada a transacciones y partnerships en LATAM.',
          'Valoramos experiencia en fintech, open finance, datos sensibles, UX de confianza y distribución de productos financieros.',
        ],
      },
    ],
    cta: { label: 'Enviar interés', href: `mailto:${CONTACT_EMAIL}` },
  },
  press: {
    kind: 'company',
    eyebrow: 'Empresa',
    title: 'Prensa',
    intro:
      'FinovAI es un copiloto financiero para México y Latinoamérica que detecta fugas de dinero y ayuda a convertir ahorro potencial en rutas hacia inversión.',
    sections: [
      {
        title: 'Resumen',
        body: [
          'FinovAI ayuda a usuarios en México y Latinoamérica a conectar transacciones vía Syncfy, detectar fugas de dinero y convertir ahorro potencial en rutas hacia inversión.',
          'La propuesta combina open finance, análisis transaccional y alianzas con plataformas de inversión. FinovAI no es banco, no custodia dinero y no ejecuta inversiones dentro de la app.',
        ],
      },
      {
        title: 'Ángulo de mercado',
        body: [
          'El usuario no solo ve en qué gastó: entiende qué gasto repetido podría recortar y cuánto podría representar si lo invierte durante varios años.',
          'FinovAI se enfoca en el mercado mexicano y latinoamericano, donde la conexión bancaria autorizada y la educación financiera práctica pueden reducir la distancia entre intención de ahorro e inversión real.',
        ],
      },
    ],
    cta: { label: 'Contacto de prensa', href: `mailto:${CONTACT_EMAIL}` },
  },
}

export function getStaticPage(pathname: string): StaticPageSlug | null {
  const normalized = pathname.replace(/^\/+|\/+$/g, '')
  const routeMap: Record<string, StaticPageSlug> = {
    privacidad: 'privacy',
    privacy: 'privacy',
    terminos: 'terms',
    términos: 'terms',
    terms: 'terms',
    seguridad: 'security',
    security: 'security',
    cookies: 'cookies',
    'sobre-nosotros': 'about',
    about: 'about',
    empresas: 'business',
    business: 'business',
    aliados: 'partners',
    partners: 'partners',
    carreras: 'careers',
    careers: 'careers',
    prensa: 'press',
    press: 'press',
  }

  return routeMap[normalized] ?? null
}

export default function StaticPage({ slug }: { slug: StaticPageSlug }) {
  const page = staticPages[slug]

  return (
    <div className="finovai-landing static-marketing-page">
      <StaticMarketingNav />

      <main className="static-marketing-main">
        <div className="landing-blob landing-blob-blue" />
        <div className="landing-blob landing-blob-teal" />

        <div className="landing-container static-marketing-content">
          <a href="/" className="static-back-link">
            Volver al inicio
          </a>

          <div className="landing-eyebrow">{page.eyebrow}</div>

          <h1>{page.title}</h1>
          <p className="static-marketing-intro">{page.intro}</p>

          {page.updated ? <p className="static-updated">Última actualización: {page.updated}</p> : null}

          <div className="static-section-list">
            {page.sections.map((section) => (
              <section key={section.title} className="static-info-card">
                <h2>{section.title}</h2>
                <div>
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {page.cta ? (
            <a href={page.cta.href} className="landing-btn landing-btn-primary landing-btn-large static-page-cta">
              {page.cta.label}
              <ArrowRight aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </main>

      <StaticMarketingFooter />
    </div>
  )
}

function StaticMarketingNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navLinks = [
    { label: 'Inicio', href: '/' },
    { label: 'Cómo funciona', href: '/#como-funciona' },
    { label: 'Seguridad', href: '/#seguridad' },
    { label: 'Preguntas', href: '/#faq' },
  ]

  return (
    <header className="landing-nav">
      <div className="landing-container">
        <div className="landing-nav-inner">
          <a className="landing-wordmark" href="/" aria-label="FinovAI inicio">
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
            <a className="landing-btn landing-btn-ghost" href="/dashboard">
              Iniciar sesión
            </a>
            <a className="landing-btn landing-btn-primary landing-btn-compact" href="/dashboard">
              Conectar mi banco
              <ArrowRight aria-hidden="true" />
            </a>
          </div>

          <button
            className="landing-menu-button"
            type="button"
            aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>

        {isMenuOpen ? (
          <div className="landing-mobile-menu">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)}>
                {link.label}
              </a>
            ))}
            <a className="landing-btn landing-btn-primary" href="/dashboard">
              Conectar mi banco
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
        ) : null}
      </div>
    </header>
  )
}

function StaticMarketingFooter() {
  return (
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
            <p>Copiloto financiero para México y Latinoamérica. Encuentra fugas. Conviértelas en patrimonio.</p>
          </div>

          <StaticFooterColumn
            title="Empresa"
            links={[
              { label: 'Sobre nosotros', href: '/sobre-nosotros' },
              { label: 'Para empresas', href: '/empresas' },
              { label: 'Aliados', href: '/aliados' },
              { label: 'Carreras', href: '/carreras' },
              { label: 'Prensa', href: '/prensa' },
            ]}
          />
          <StaticFooterColumn
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
  )
}

function StaticFooterColumn({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
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
