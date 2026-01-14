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
    question: '¿Necesito saber de finanzas?',
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
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="py-24 px-6 bg-stone-900">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 mb-4">
            FAQ
          </span>
          <h2 className="font-display text-3xl md:text-4xl text-stone-100">
            Preguntas frecuentes
          </h2>
        </div>

        {/* FAQ items */}
        <div className="space-y-3">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl bg-stone-800/30 border border-stone-800"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-stone-200 pr-4">
                  {faq.question}
                </span>
                <svg
                  className={`w-5 h-5 text-stone-500 flex-shrink-0 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-5 pb-5">
                  <p className="text-stone-400">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="text-center mt-10">
          <p className="text-stone-500">
            ¿Otra pregunta?{' '}
            <a href="mailto:hola@finovai.com" className="text-amber-400">
              Escríbenos
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
