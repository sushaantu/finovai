import { useState, useEffect, useRef } from 'react'

interface Question {
  id: string
  text: string
  options: { value: number; label: string }[]
}

const QUESTIONS: Question[] = [
  {
    id: 'income_tracking',
    text: '¿Sabes exactamente cuánto dinero entra cada mes?',
    options: [
      { value: 3, label: 'Sí, al centavo' },
      { value: 2, label: 'Más o menos' },
      { value: 1, label: 'No realmente' },
      { value: 0, label: 'No tengo idea' },
    ],
  },
  {
    id: 'expense_tracking',
    text: '¿Sabes en qué se va tu dinero cada mes?',
    options: [
      { value: 3, label: 'Sí, tengo todo categorizado' },
      { value: 2, label: 'Tengo una idea general' },
      { value: 1, label: 'Solo las cosas grandes' },
      { value: 0, label: 'El dinero desaparece' },
    ],
  },
  {
    id: 'savings',
    text: '¿Logras ahorrar algo cada mes?',
    options: [
      { value: 3, label: 'Sí, automáticamente' },
      { value: 2, label: 'A veces, cuando puedo' },
      { value: 1, label: 'Rara vez' },
      { value: 0, label: 'No me queda nada' },
    ],
  },
  {
    id: 'emergency_fund',
    text: '¿Tienes un fondo de emergencia?',
    options: [
      { value: 3, label: 'Sí, más de 3 meses de gastos' },
      { value: 2, label: 'Algo, pero no suficiente' },
      { value: 1, label: 'Muy poco' },
      { value: 0, label: 'No tengo nada guardado' },
    ],
  },
  {
    id: 'debt',
    text: '¿Cómo está tu situación de deudas?',
    options: [
      { value: 3, label: 'No tengo deudas / solo hipoteca' },
      { value: 2, label: 'Deudas controladas, pago a tiempo' },
      { value: 1, label: 'Tengo deudas que me cuestan' },
      { value: 0, label: 'Las deudas me abruman' },
    ],
  },
]

export default function FinancialIndex() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [showResult, setShowResult] = useState(false)
  const [animatedScore, setAnimatedScore] = useState(0)

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

  const handleAnswer = (questionId: string, value: number) => {
    setAnswers({ ...answers, [questionId]: value })

    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      setShowResult(true)
    }
  }

  const calculateScore = () => {
    const total = Object.values(answers).reduce((sum, val) => sum + val, 0)
    const maxPossible = QUESTIONS.length * 3
    return Math.round((total / maxPossible) * 100)
  }

  // Animate score counting up
  useEffect(() => {
    if (showResult) {
      const targetScore = calculateScore()
      let current = 0
      const increment = targetScore / 40
      const timer = setInterval(() => {
        current += increment
        if (current >= targetScore) {
          setAnimatedScore(targetScore)
          clearInterval(timer)
        } else {
          setAnimatedScore(Math.round(current))
        }
      }, 25)
      return () => clearInterval(timer)
    }
  }, [showResult])

  const getScoreMessage = (score: number) => {
    if (score >= 70) return { stage: 'Etapa 2', message: 'Estás listo para invertir con sistema', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' }
    if (score >= 40) return { stage: 'Etapa 1', message: 'Tienes base, pero necesitas crear más margen', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' }
    return { stage: 'Etapa 0', message: 'Empecemos ordenando tu casa financiera', color: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/20' }
  }

  const resetQuiz = () => {
    setCurrentQuestion(0)
    setAnswers({})
    setShowResult(false)
    setAnimatedScore(0)
  }

  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100

  return (
    <section ref={sectionRef} className="relative py-32 px-6 bg-[--color-bg-secondary] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 grid-bg opacity-15" />
      <div className="glow-emerald bottom-0 left-1/2 -translate-x-1/2 opacity-20" />

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-12 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <span className="inline-flex items-center px-4 py-2 rounded-full glass text-[11px] uppercase tracking-widest text-[--color-text-dim] font-semibold mb-8">
            Calcula Tu Índice
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-[--color-text]">
            ¿Qué tan ordenadas están
          </h2>
          <p className="font-serif text-4xl md:text-5xl lg:text-6xl text-emerald-400 italic mt-3">
            tus finanzas?
          </p>
          <p className="text-[--color-text-muted] mt-6 text-lg">
            Responde 5 preguntas y descubre tu Índice de Orden Financiero
          </p>
        </div>

        {/* Quiz card */}
        <div className={`max-w-2xl mx-auto transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`} style={{ transitionDelay: '200ms' }}>
          <div className="p-8 md:p-10 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] backdrop-blur-sm">
            {!showResult ? (
              <>
                {/* Progress */}
                <div className="flex justify-between items-center text-sm text-[--color-text-dim] mb-3">
                  <span className="font-medium">Pregunta {currentQuestion + 1} de {QUESTIONS.length}</span>
                  <span className="font-semibold text-emerald-400">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-10">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Question */}
                <h3 className="font-display text-xl md:text-2xl text-[--color-text] mb-8 leading-relaxed">
                  {QUESTIONS[currentQuestion].text}
                </h3>

                {/* Options */}
                <div className="space-y-3">
                  {QUESTIONS[currentQuestion].options.map((option, i) => (
                    <button
                      key={option.value}
                      onClick={() => handleAnswer(QUESTIONS[currentQuestion].id, option.value)}
                      className="w-full text-left p-5 rounded-2xl border border-white/10 text-[--color-text-muted] hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-[--color-text] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 group"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <span className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm font-medium group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10 transition-all">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Result */
              <div className="text-center py-6">
                <p className="text-[11px] text-[--color-text-dim] uppercase tracking-widest font-semibold mb-2">Tu índice de orden financiero</p>

                {/* Score with animation */}
                <div className="my-10 relative">
                  {/* Glow behind score */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-40 h-40 rounded-full bg-emerald-500/20 blur-3xl" />
                  </div>
                  <span className="font-display text-8xl md:text-9xl stat-number-animated relative">
                    {animatedScore}
                  </span>
                  <span className="text-[--color-text-dim] text-xl ml-2 relative">/ 100</span>
                </div>

                {/* Message */}
                <div className="mb-10">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full ${getScoreMessage(calculateScore()).bgColor} ${getScoreMessage(calculateScore()).borderColor} border text-sm ${getScoreMessage(calculateScore()).color} font-medium mb-4`}>
                    {getScoreMessage(calculateScore()).stage}
                  </span>
                  <p className="text-xl text-[--color-text-secondary] font-medium">
                    {getScoreMessage(calculateScore()).message}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={resetQuiz}
                    className="px-8 py-4 rounded-full border border-white/10 text-[--color-text-secondary] font-medium hover:border-white/20 hover:bg-white/5 transition-all duration-300"
                  >
                    Volver a calcular
                  </button>
                  <button className="px-8 py-4 rounded-full bg-emerald-500 text-white font-semibold transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_20px_40px_rgba(16,185,129,0.3)]">
                    Mejorar mi índice
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
