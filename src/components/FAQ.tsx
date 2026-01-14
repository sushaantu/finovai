import { useState, useEffect, useRef } from 'react'

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
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.2 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="faq" className="relative py-32 px-6 bg-[--color-bg-secondary]">
      {/* Background */}
      <div className="absolute inset-0 grid-bg opacity-10" />

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <span className="inline-flex items-center px-4 py-2 rounded-full glass text-[11px] uppercase tracking-widest text-[--color-text-dim] font-semibold mb-8">
            FAQ
          </span>
          <h2 className="font-display text-4xl md:text-5xl text-[--color-text]">
            Preguntas frecuentes
          </h2>
        </div>

        {/* FAQ items - centered */}
        <div className="max-w-2xl mx-auto space-y-3">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className={`rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] overflow-hidden transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${index * 80 + 200}ms` }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.02] transition-colors group"
              >
                <span className="font-medium text-[--color-text] pr-4 group-hover:text-emerald-400 transition-colors">
                  {faq.question}
                </span>
                <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  openIndex === index ? 'bg-emerald-500/10' : ''
                }`}>
                  <svg
                    className={`w-4 h-4 text-[--color-text-dim] transition-all duration-300 ${
                      openIndex === index ? 'rotate-180 text-emerald-400' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  openIndex === index ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-6 pb-6">
                  <p className="text-[--color-text-muted] leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className={`text-center mt-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '700ms' }}>
          <p className="text-[--color-text-muted]">
            ¿Tienes otra pregunta?{' '}
            <a href="mailto:hola@finov.ai" className="text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-4">
              Escríbenos
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
