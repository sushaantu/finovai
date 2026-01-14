export default function Journey() {
  const stages = [
    {
      number: "0",
      bgColor: "bg-amber-500",
      title: "Ordena tu casa",
      subtitle: "Entiende tu situación actual",
      description: "Diagnosticamos tus hábitos, mapeamos tu flujo de dinero y creamos la estructura base que necesitas.",
      items: ["Diagnóstico de hábitos", "Mapa de ingresos y gastos", "Estructura y reglas claras"],
    },
    {
      number: "1",
      bgColor: "bg-violet-500",
      title: "Crea margen",
      subtitle: "De supervivencia a estabilidad",
      description: "Optimizamos gastos, automatizamos ahorro y tomamos decisiones conscientes para que te quede dinero.",
      items: ["Optimización de gastos", "Ahorro automatizado", "Prioridades definidas"],
    },
    {
      number: "2",
      bgColor: "bg-emerald-500",
      title: "Invierte con sistema",
      subtitle: "De estabilidad a crecimiento",
      description: "Con margen real, creamos tu perfil de inversión y tu asesor IA personalizado te guía paso a paso.",
      items: ["Plan de inversión", "Asesor IA personalizado", "Seguimiento continuo"],
    },
  ]

  return (
    <section id="como-funciona" className="py-24 px-6 bg-neutral-950">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center px-4 py-2 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-xs uppercase tracking-wider text-neutral-400 mb-6">
            La Ruta FinovAI
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-neutral-100 leading-tight">
            Tres etapas hacia tu
          </h2>
          <p className="font-serif text-4xl md:text-5xl lg:text-6xl text-emerald-400 italic mt-2">
            libertad financiera
          </p>
          <p className="text-lg text-neutral-400 mt-6 max-w-2xl mx-auto">
            Primero ordenas la casa, luego compras acciones. El patrimonio no empieza invirtiendo, empieza teniendo estructura.
          </p>
        </div>

        {/* Stages - Horizontal cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {stages.map((stage, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800"
            >
              {/* Number badge */}
              <div className={`w-10 h-10 rounded-full ${stage.bgColor} flex items-center justify-center mb-5`}>
                <span className="text-white font-bold">{stage.number}</span>
              </div>

              {/* Label */}
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
                Etapa {stage.number}
              </p>

              {/* Title */}
              <h3 className="font-display text-xl text-neutral-100 mb-1">
                {stage.title}
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                {stage.subtitle}
              </p>

              {/* Description */}
              <p className="text-neutral-400 text-sm mb-5 leading-relaxed">
                {stage.description}
              </p>

              {/* Items */}
              <div className="space-y-2">
                {stage.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm text-neutral-400"
                  >
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div className="mt-20 text-center">
          <p className="font-serif text-3xl md:text-4xl text-neutral-600 italic">
            "Antes de invertir, hay que ordenar la casa."
          </p>
        </div>
      </div>
    </section>
  )
}
