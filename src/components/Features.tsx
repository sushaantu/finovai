export default function Features() {
  const features = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "Índice de Orden Financiero",
      description: "Tu score de 0-100 que mide qué tan ordenadas están tus finanzas. Trackea tu progreso mes a mes.",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      title: "Pregúntale a FinovAI",
      description: "Tu asesor financiero 24/7. Pregunta lo que sea sobre tus finanzas y recibe respuestas personalizadas.",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      title: "Plan personalizado",
      description: "No templates genéricos. Tu plan basado en tu situación real, tus metas y tu tolerancia al riesgo.",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Alertas inteligentes",
      description: "Te avisamos cuando algo no cuadra: gastos inusuales, oportunidades de ahorro, fechas importantes.",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Tracking de metas",
      description: "Visualiza tu progreso hacia tus objetivos financieros. Celebra cada milestone alcanzado.",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      title: "Contenido educativo",
      description: "Aprende sobre finanzas personales con guías prácticas y lecciones diseñadas para ti.",
    },
  ]

  return (
    <section id="caracteristicas" className="py-24 px-6 bg-neutral-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-xs uppercase tracking-wider text-neutral-400 mb-4">
            Características
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-neutral-100">
            Todo lo que necesitas
            <br />
            <span className="text-emerald-400 font-serif italic">en un solo lugar</span>
          </h2>
          <p className="text-lg text-neutral-400 mt-4 max-w-xl mx-auto">
            Herramientas diseñadas para darte claridad, control y confianza sobre tu dinero.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-neutral-800/30 border border-neutral-800 hover:border-neutral-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-400 mb-4">
                {feature.icon}
              </div>
              <h3 className="font-medium text-neutral-100 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-neutral-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
