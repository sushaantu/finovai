export default function Journey() {
  const stages = [
    {
      number: "01",
      title: "Ordena tu casa",
      subtitle: "Entiende tu situación actual",
      description: "Diagnosticamos tus hábitos, mapeamos tu flujo de dinero y creamos la estructura base que necesitas.",
      items: ["Diagnóstico de hábitos", "Mapa de ingresos y gastos", "Estructura y reglas claras"],
    },
    {
      number: "02",
      title: "Crea margen",
      subtitle: "De supervivencia a estabilidad",
      description: "Optimizamos gastos, automatizamos ahorro y tomamos decisiones conscientes para que te quede dinero.",
      items: ["Optimización de gastos", "Ahorro automatizado", "Prioridades definidas"],
    },
    {
      number: "03",
      title: "Invierte con sistema",
      subtitle: "De estabilidad a crecimiento",
      description: "Con margen real, creamos tu perfil de inversión y tu asesor IA personalizado te guía paso a paso.",
      items: ["Plan de inversión", "Asesor IA personalizado", "Seguimiento continuo"],
    },
  ]

  return (
    <section id="como-funciona" className="py-24 px-6 bg-stone-950">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 mb-4">
            La ruta FinovAI
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-stone-100">
            Tres etapas hacia tu libertad financiera
          </h2>
          <p className="text-lg text-stone-400 mt-4 max-w-2xl mx-auto">
            Primero ordenas la casa, luego compras acciones.
          </p>
        </div>

        {/* Stages */}
        <div className="space-y-6">
          {stages.map((stage, index) => (
            <div
              key={index}
              className="p-8 rounded-2xl bg-stone-900/50 border border-stone-800"
            >
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Number */}
                <span className="text-4xl font-display text-amber-500/30">
                  {stage.number}
                </span>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="font-display text-xl text-stone-100">
                    {stage.title}
                  </h3>
                  <p className="text-sm text-stone-500 mt-1">
                    {stage.subtitle}
                  </p>
                  <p className="text-stone-400 mt-3">
                    {stage.description}
                  </p>

                  {/* Items */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {stage.items.map((item, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 rounded-full bg-stone-800/50 text-sm text-stone-400"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div className="mt-16 text-center">
          <p className="font-serif text-2xl md:text-3xl text-stone-500 italic">
            "Antes de invertir, hay que ordenar la casa."
          </p>
        </div>
      </div>
    </section>
  )
}
