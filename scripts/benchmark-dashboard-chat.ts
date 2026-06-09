import {
  DASHBOARD_CHAT_BENCHMARK_CASES,
  DASHBOARD_CHAT_BENCHMARK_VERSION,
  type DashboardChatBenchmarkCase,
} from '../worker/dashboard-chat-benchmark'

export interface DashboardChatBenchmarkAnswer {
  id: string
  answer: string
  model?: string
}

export interface DashboardChatBenchmarkResult {
  id: string
  question: string
  expectedStage: DashboardChatBenchmarkCase['expectedStage'] | 'unknown'
  passed: boolean
  issues: string[]
}

export interface DashboardChatBenchmarkScore {
  version: string
  total: number
  passed: number
  failures: number
  score: number
  results: DashboardChatBenchmarkResult[]
}

const BENCHMARK_BY_ID = new Map(DASHBOARD_CHAT_BENCHMARK_CASES.map((item) => [item.id, item]))
const MONEY_PATTERN = /\b(?:MXN|CLP|\$)\s*[\d.,]+|[\d.,]+\s*(?:MXN|CLP)\b/i
const PERCENT_PATTERN = /\b\d+(?:[.,]\d+)?\s*%/
const COUNT_PATTERN = /\b\d+\s+(?:cargo|cargos|veces|movimiento|movimientos)\b/i
const INCOME_PATTERN = /\b(?:ingreso|ingresos|gana|ganas|sueldo|salario|nomina|nómina|del ingreso)\b/i
const INVESTMENT_PATTERN = /\b(?:invertir|inversion|inversión|cetes|gbm|afore|bolsa|dolares|dólares)\b/i
const DEBT_PRIORITY_PATTERN = /\b(?:deuda|tarjeta|interes|interés|liquidar|liquidacion|liquidación|pagar|prioriza|priorizar)\b/i
const DISCLAIMER_PATTERN = /\b(?:informacion general|información general|no asesoria|no asesoría|asesoria personalizada|asesoría personalizada)\b/i
const GENERIC_FIXED_AMOUNT_PATTERN = /(^|[^\d])(?:10[,. ]?000|10000|15[,. ]?000|15000|20[,. ]?000|20000)([^\d]|$)/

export function scoreDashboardChatBenchmarkAnswers(
  answers: DashboardChatBenchmarkAnswer[]
): DashboardChatBenchmarkScore {
  const results = answers.map((answer) => scoreOneBenchmarkAnswer(answer))
  const passed = results.filter((result) => result.passed).length
  const total = results.length

  return {
    version: DASHBOARD_CHAT_BENCHMARK_VERSION,
    total,
    passed,
    failures: total - passed,
    score: total > 0 ? Math.round((passed / total) * 100) : 0,
    results,
  }
}

function scoreOneBenchmarkAnswer(answer: DashboardChatBenchmarkAnswer): DashboardChatBenchmarkResult {
  const benchmarkCase = BENCHMARK_BY_ID.get(answer.id)
  if (!benchmarkCase) {
    return {
      id: answer.id,
      question: '',
      expectedStage: 'unknown',
      passed: false,
      issues: ['unknown-case'],
    }
  }

  const text = answer.answer.trim()
  const issues: string[] = []

  if (!text) issues.push('missing-answer')

  if (benchmarkCase.rubric.requiresRealUserNumbers && !hasRealUserNumberSignal(text)) {
    issues.push('missing-real-user-numbers')
  }

  if (benchmarkCase.rubric.requiresIncomeProportionalAdvice && !hasIncomeProportionalSignal(text)) {
    issues.push('missing-income-proportional-advice')
  }

  if (
    benchmarkCase.rubric.blocksInvestmentWhenDebtIsActive &&
    INVESTMENT_PATTERN.test(text) &&
    !DEBT_PRIORITY_PATTERN.test(text)
  ) {
    issues.push('investment-mentioned-while-debt-active')
  }

  if (
    benchmarkCase.rubric.requiresInvestmentDisclaimer &&
    INVESTMENT_PATTERN.test(text) &&
    !DISCLAIMER_PATTERN.test(text)
  ) {
    issues.push('missing-investment-disclaimer')
  }

  for (const destination of benchmarkCase.rubric.invalidDestinations) {
    if (text.toLowerCase().includes(destination.toLowerCase())) {
      issues.push(`invalid-destination:${destination}`)
    }
  }

  if (GENERIC_FIXED_AMOUNT_PATTERN.test(text) && !hasIncomeProportionalSignal(text)) {
    issues.push('generic-fixed-amount')
  }

  return {
    id: benchmarkCase.id,
    question: benchmarkCase.question,
    expectedStage: benchmarkCase.expectedStage,
    passed: issues.length === 0,
    issues,
  }
}

function hasRealUserNumberSignal(text: string) {
  return MONEY_PATTERN.test(text) || PERCENT_PATTERN.test(text) || COUNT_PATTERN.test(text)
}

function hasIncomeProportionalSignal(text: string) {
  return PERCENT_PATTERN.test(text) && INCOME_PATTERN.test(text)
}

async function readAnswers(path: string): Promise<DashboardChatBenchmarkAnswer[]> {
  const raw = await Bun.file(path).text()
  const trimmed = raw.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as DashboardChatBenchmarkAnswer[]
  }

  return trimmed
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DashboardChatBenchmarkAnswer)
}

function getArgValue(args: string[], name: string) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

async function runCli() {
  const args = Bun.argv.slice(2)

  if (args.includes('--print-cases')) {
    console.log(JSON.stringify({
      version: DASHBOARD_CHAT_BENCHMARK_VERSION,
      cases: DASHBOARD_CHAT_BENCHMARK_CASES,
    }, null, 2))
    return
  }

  const answersPath = getArgValue(args, '--answers')
  if (!answersPath) {
    console.error('Usage: bun scripts/benchmark-dashboard-chat.ts --print-cases | --answers <answers.jsonl>')
    process.exitCode = 1
    return
  }

  const answers = await readAnswers(answersPath)
  const score = scoreDashboardChatBenchmarkAnswers(answers)
  console.log(JSON.stringify(score, null, 2))
  process.exitCode = score.failures > 0 ? 1 : 0
}

if (import.meta.main) {
  await runCli()
}
