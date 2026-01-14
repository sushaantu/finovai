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
    <section className="py-24 px-6 bg-stone-950">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 mb-4">
            Calcula tu índice
          </span>
          <h2 className="font-display text-3xl md:text-4xl text-stone-100">
            ¿Qué tan ordenadas están tus finanzas?
          </h2>
          <p className="text-stone-400 mt-4">
            Responde 5 preguntas y descubre tu Índice de Orden Financiero
          </p>
        </div>

        {/* Quiz card */}
        <div className="p-8 rounded-2xl bg-stone-900/50 border border-stone-800">
          {!showResult ? (
            <>
              {/* Progress */}
              <div className="mb-8">
                <div className="flex justify-between text-sm text-stone-500 mb-2">
                  <span>Pregunta {currentQuestion + 1} de {QUESTIONS.length}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Question */}
              <h3 className="font-display text-xl md:text-2xl text-stone-100 mb-6">
                {QUESTIONS[currentQuestion].text}
              </h3>

              {/* Options */}
              <div className="space-y-3">
                {QUESTIONS[currentQuestion].options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleAnswer(QUESTIONS[currentQuestion].id, option.value)}
                    className="w-full text-left p-4 rounded-xl border border-stone-700 text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Result */
            <div className="text-center">
              <p className="text-sm text-stone-500 uppercase tracking-wide">Tu índice de orden financiero</p>

              {/* Score */}
              <div className="my-8">
                <span className="font-display text-7xl text-amber-400">
                  {calculateScore()}
                </span>
                <span className="text-stone-500 text-lg ml-2">/ 100</span>
              </div>

              {/* Message */}
              <div className="mb-8">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-500/10 text-sm text-amber-400 mb-3">
                  {getScoreMessage(calculateScore()).stage}
                </span>
                <p className="text-lg text-stone-300">
                  {getScoreMessage(calculateScore()).message}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={resetQuiz}
                  className="px-6 py-3 rounded-full border border-stone-700 text-stone-300 font-medium"
                >
                  Volver a calcular
                </button>
                <button className="px-6 py-3 rounded-full bg-amber-50 text-stone-900 font-medium">
                  Mejorar mi índice
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
