interface CTAProps {
  onChatOpen: () => void
}

export default function CTA({ onChatOpen }: CTAProps) {
  return (
    <section className="py-24 px-6 bg-neutral-900">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-3xl bg-neutral-800/30 border border-neutral-700/50 p-12 md:p-16 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-700/50 border border-neutral-600/50 text-xs uppercase tracking-wider text-neutral-400 mb-6">
            Empieza Hoy
          </span>

          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-neutral-100 mb-4">
            Tu mejor inversión es
            <br />
            <span className="text-emerald-400 font-serif italic">tener un sistema</span>
          </h2>

          <p className="text-lg text-neutral-400 mb-10 max-w-lg mx-auto">
            Empieza ordenando tu casa financiera. Nuestro asesor IA te guiará en tu diagnóstico inicial.
          </p>

          <button
            onClick={onChatOpen}
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-neutral-900 font-medium rounded-full hover:bg-white transition-colors duration-300 shadow-lg"
          >
            Habla con FinovAI
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>

          <p className="text-sm text-neutral-500 mt-6">
            Sin tarjeta de crédito • Gratis para empezar
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-neutral-500">
            <span>Con dato, no con vibes</span>
            <span>•</span>
            <span>Plan {">"} impulso</span>
            <span>•</span>
            <span>Menos ruido, más proceso</span>
          </div>
        </div>
      </div>
    </section>
  )
}
