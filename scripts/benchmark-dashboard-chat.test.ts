import { expect, test } from 'bun:test'

import { DASHBOARD_CHAT_BENCHMARK_CASES } from '../worker/dashboard-chat-benchmark'
import { scoreDashboardChatBenchmarkAnswers } from './benchmark-dashboard-chat'

test('dashboard chat benchmark scorer catches generic and unsafe model answers', () => {
  const passingAnswers = DASHBOARD_CHAT_BENCHMARK_CASES.map((item) => ({
    id: item.id,
    answer: item.rubric.requiresInvestmentDisclaimer
      ? 'Con ingreso MXN 60.000, usa 10% del ingreso: MXN 6.000. Información general, no asesoría personalizada.'
      : 'Con ingreso MXN 60.000, usa 10% del ingreso: MXN 6.000 y revisa 3 cargos reales.',
  }))
  const passing = scoreDashboardChatBenchmarkAnswers(passingAnswers)

  expect(passing.total).toBe(55)
  expect(passing.failures).toBe(0)

  const failing = scoreDashboardChatBenchmarkAnswers([
    {
      id: 'deuda-07',
      answer: 'Invierte 10000 en CETES y listo.',
    },
  ])

  expect(failing.failures).toBeGreaterThan(0)
  expect(failing.results[0].issues).toContain('missing-income-proportional-advice')
  expect(failing.results[0].issues).toContain('investment-mentioned-while-debt-active')
  expect(failing.results[0].issues).toContain('generic-fixed-amount')
})
