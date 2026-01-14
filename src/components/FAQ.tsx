import { useState } from 'react'

const FAQS = [
  {
    question: '¿FinovAI es gratis?',
    answer: 'Sí, puedes empezar gratis y usar las funciones básicas sin costo. Tenemos planes premium con características avanzadas.',
  },
  {
    question: '¿Mis datos están seguros?',
    answer: 'Absolutamente. Usamos encriptación de grado bancario, solo acceso de lectura, nunca almacenamos contraseñas y jamás vendemos tu información.',
  },
  {
    question: '¿Necesito saber de finanzas para usar FinovAI?',
    answer: 'Para nada. FinovAI está diseñado para personas que quieren ordenar sus finanzas desde cero. Te guiamos paso a paso.',
  },
  {
    question: '¿FinovAI me dice en qué invertir?',
    answer: 'Primero te ayudamos a ordenar tu casa financiera. Cuando tengas margen real, nuestro asesor IA te orienta según tu perfil.',
  },
  {
    question: '¿En qué países está disponible?',
    answer: 'México, Colombia, Chile, Perú, Brasil y Argentina. Pronto más países de Latinoamérica.',
  },
  {
    question: '¿Cómo es diferente de otras apps de finanzas?',
    answer: 'No te bombardeamos con gráficos confusos. Primero te ayudamos a crear estructura y hábitos. Solo cuando estés listo, hablamos de inversión.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="py-24 px-6 bg-neutral-950">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-xs uppercase tracking-wider text-neutral-400 mb-4">
            FAQ
          </span>
          <h2 className="font-display text-3xl md:text-4xl text-neutral-100">
            Preguntas frecuentes
          </h2>
        </div>

        {/* FAQ items - centered */}
        <div className="max-w-2xl mx-auto space-y-3">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl bg-neutral-900/50 border border-neutral-800 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-neutral-800/30 transition-colors"
              >
                <span className="font-medium text-neutral-200 pr-4">
                  {faq.question}
                </span>
                <svg
                  className={`w-5 h-5 text-neutral-500 flex-shrink-0 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === index ? 'max-h-48' : 'max-h-0'
                }`}
              >
                <div className="px-5 pb-5">
                  <p className="text-neutral-400">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="text-center mt-10">
          <p className="text-neutral-500">
            ¿Tienes otra pregunta?{' '}
            <a href="mailto:hola@finov.ai" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Escríbenos
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
