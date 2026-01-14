interface CTAProps {
  onChatOpen: () => void
}

export default function CTA({ onChatOpen }: CTAProps) {
  return (
    <section className="py-24 px-6 bg-stone-950">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-stone-100 mb-4">
          Tu mejor inversión es tener un sistema
        </h2>

        <p className="text-lg text-stone-400 mb-10">
          Empieza ordenando tu casa financiera. Nuestro asesor IA te guiará en tu diagnóstico inicial.
        </p>

        <button
          onClick={onChatOpen}
          className="inline-flex items-center gap-3 px-8 py-4 bg-amber-50 text-stone-900 font-medium rounded-full"
        >
          Habla con FinovAI
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>

        <p className="text-sm text-stone-500 mt-6">
          Sin tarjeta de crédito · Gratis para empezar
        </p>
      </div>
    </section>
  )
}
