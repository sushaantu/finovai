import { useState } from 'react'

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
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [showResult, setShowResult] = useState(false)

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

  const getScoreMessage = (score: number) => {
    if (score >= 70) return { stage: 'Etapa 2', message: 'Estás listo para invertir con sistema' }
    if (score >= 40) return { stage: 'Etapa 1', message: 'Tienes base, pero necesitas crear más margen' }
    return { stage: 'Etapa 0', message: 'Empecemos ordenando tu casa financiera' }
  }

  const resetQuiz = () => {
    setCurrentQuestion(0)
    setAnswers({})
    setShowResult(false)
  }

  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100

  return (
    <section className="py-24 px-6 bg-neutral-950">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-800/60 border border-neutral-700/50 text-xs uppercase tracking-wider text-neutral-400 mb-4">
            Calcula Tu Índice
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl text-neutral-100">
            ¿Qué tan ordenadas están
            <br />
            <span className="text-emerald-400 font-serif italic">tus finanzas?</span>
          </h2>
          <p className="text-neutral-400 mt-4">
            Responde 5 preguntas y descubre tu Índice de Orden Financiero
          </p>
        </div>

        {/* Quiz card */}
        <div className="max-w-2xl mx-auto">
          <div className="p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800">
            {!showResult ? (
              <>
                {/* Progress */}
                <div className="flex justify-between items-center text-sm text-neutral-500 mb-2">
                  <span>Pregunta {currentQuestion + 1} de {QUESTIONS.length}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1 bg-neutral-800 rounded-full overflow-hidden mb-8">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Question */}
                <h3 className="font-display text-xl md:text-2xl text-neutral-100 mb-6">
                  {QUESTIONS[currentQuestion].text}
                </h3>

                {/* Options */}
                <div className="space-y-3">
                  {QUESTIONS[currentQuestion].options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleAnswer(QUESTIONS[currentQuestion].id, option.value)}
                      className="w-full text-left p-4 rounded-xl border border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Result */
              <div className="text-center">
                <p className="text-sm text-neutral-500 uppercase tracking-wide">Tu índice de orden financiero</p>

                {/* Score */}
                <div className="my-8">
                  <span className="font-display text-7xl text-emerald-400">
                    {calculateScore()}
                  </span>
                  <span className="text-neutral-500 text-lg ml-2">/ 100</span>
                </div>

                {/* Message */}
                <div className="mb-8">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-sm text-emerald-400 mb-3">
                    {getScoreMessage(calculateScore()).stage}
                  </span>
                  <p className="text-lg text-neutral-300">
                    {getScoreMessage(calculateScore()).message}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={resetQuiz}
                    className="px-6 py-3 rounded-full border border-neutral-700 text-neutral-300 font-medium hover:border-neutral-600 transition-colors"
                  >
                    Volver a calcular
                  </button>
                  <button className="px-6 py-3 rounded-full bg-white text-neutral-900 font-medium hover:bg-white transition-colors">
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
