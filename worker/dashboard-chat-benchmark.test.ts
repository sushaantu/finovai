import { expect, test } from 'bun:test'

import {
  DASHBOARD_CHAT_BENCHMARK_CASES,
  getDashboardChatBenchmarkSummary,
} from './dashboard-chat-benchmark'

test('dashboard chat benchmark covers FinovAI FAQ stages and model-gating criteria', () => {
  const summary = getDashboardChatBenchmarkSummary()
  const ids = new Set(DASHBOARD_CHAT_BENCHMARK_CASES.map((item) => item.id))
  const stages = new Set(DASHBOARD_CHAT_BENCHMARK_CASES.map((item) => item.expectedStage))

  expect(DASHBOARD_CHAT_BENCHMARK_CASES).toHaveLength(55)
  expect(ids.size).toBe(DASHBOARD_CHAT_BENCHMARK_CASES.length)
  expect(stages).toEqual(new Set(['diagnostico', 'control', 'ahorro', 'liquidacion_de_deuda', 'inversion']))
  expect(summary.total).toBe(55)
  expect(summary.byStage.liquidacion_de_deuda).toBe(7)
  expect(summary.byStage.inversion).toBe(18)

  expect(DASHBOARD_CHAT_BENCHMARK_CASES.every((item) => item.rubric.requiresRealUserNumbers)).toBe(true)
  expect(
    DASHBOARD_CHAT_BENCHMARK_CASES.filter((item) => item.rubric.requiresIncomeProportionalAdvice).length
  ).toBeGreaterThan(20)

  expect(
    DASHBOARD_CHAT_BENCHMARK_CASES.find((item) => item.question === 'Puedo invertir si todavia tengo deudas?')?.rubric
  ).toMatchObject({
    blocksInvestmentWhenDebtIsActive: true,
    requiresIncomeProportionalAdvice: true,
  })
  expect(
    DASHBOARD_CHAT_BENCHMARK_CASES.find((item) => item.question === 'Cuanto puedo ahorrar realista al mes?')?.rubric
  ).toMatchObject({
    requiresIncomeProportionalAdvice: true,
  })
})
