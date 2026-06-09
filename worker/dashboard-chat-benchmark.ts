export type DashboardBenchmarkStage = 'diagnostico' | 'control' | 'ahorro' | 'liquidacion_de_deuda' | 'inversion'

export interface DashboardChatBenchmarkRubric {
  requiresRealUserNumbers: boolean
  requiresIncomeProportionalAdvice: boolean
  blocksInvestmentWhenDebtIsActive: boolean
  requiresInvestmentDisclaimer: boolean
  invalidDestinations: string[]
}

export interface DashboardChatBenchmarkCase {
  id: string
  question: string
  expectedStage: DashboardBenchmarkStage
  category: string
  rubric: DashboardChatBenchmarkRubric
}

export const DASHBOARD_CHAT_BENCHMARK_VERSION = 'finovai-dashboard-chat-v1'

const INVALID_DASHBOARD_DESTINATIONS = ['Revisar recurrentes']

function benchmarkCase(
  id: string,
  question: string,
  expectedStage: DashboardBenchmarkStage,
  category: string
): DashboardChatBenchmarkCase {
  const incomeProportional = expectedStage !== 'diagnostico' ||
    /(gano|ganar|alcanza|ingreso|deuda)/i.test(question)
  const investmentRelated = expectedStage === 'inversion' ||
    /(invert|inversion|cetes|gbm|afore|retiro|bolsa|dolares)/i.test(question)

  return {
    id,
    question,
    expectedStage,
    category,
    rubric: {
      requiresRealUserNumbers: true,
      requiresIncomeProportionalAdvice: incomeProportional,
      blocksInvestmentWhenDebtIsActive: /deuda.*invert|invert.*deuda|todavia tengo deudas/i.test(question),
      requiresInvestmentDisclaimer: investmentRelated,
      invalidDestinations: INVALID_DASHBOARD_DESTINATIONS,
    },
  }
}

export const DASHBOARD_CHAT_BENCHMARK_CASES: DashboardChatBenchmarkCase[] = [
  benchmarkCase('diagnostico-01', 'Como estan mis finanzas en realidad?', 'diagnostico', 'Diagnóstico inicial'),
  benchmarkCase('diagnostico-02', 'En que se me va el dinero?', 'diagnostico', 'Diagnóstico inicial'),
  benchmarkCase('diagnostico-03', 'Estoy gastando mas de lo que gano?', 'diagnostico', 'Diagnóstico inicial'),
  benchmarkCase('diagnostico-04', 'Cuanto necesito ganar para vivir tranquilo?', 'diagnostico', 'Diagnóstico inicial'),
  benchmarkCase('diagnostico-05', 'Que tan sano es mi nivel de deuda?', 'diagnostico', 'Diagnóstico inicial'),
  benchmarkCase('control-01', 'Ayudame a hacer un presupuesto.', 'control', 'Presupuesto y control'),
  benchmarkCase('control-02', 'Cuanto deberia gastar en renta/comida/transporte?', 'control', 'Presupuesto y control'),
  benchmarkCase('control-03', 'Quiero gastar menos este mes, donde recorto?', 'control', 'Presupuesto y control'),
  benchmarkCase('control-04', 'Cuanto me gasto en cosas que no necesito?', 'control', 'Presupuesto y control'),
  benchmarkCase('control-05', 'Recuerdame cuanto llevo gastado esta quincena.', 'control', 'Presupuesto y control'),
  benchmarkCase('control-06', 'Que suscripciones puedo cancelar?', 'control', 'Presupuesto y control'),
  benchmarkCase('control-07', 'Como controlo mis compras a meses sin intereses (MSI)?', 'control', 'Presupuesto y control'),
  benchmarkCase('ahorro-01', 'Cuanto deberia tener ahorrado?', 'ahorro', 'Ahorro y fondo de emergencia'),
  benchmarkCase('ahorro-02', 'Como armo mi fondo de emergencia?', 'ahorro', 'Ahorro y fondo de emergencia'),
  benchmarkCase('ahorro-03', 'Donde guardo mi fondo para que no pierda valor?', 'ahorro', 'Ahorro y fondo de emergencia'),
  benchmarkCase('ahorro-04', 'Cuanto puedo ahorrar realista al mes?', 'ahorro', 'Ahorro y fondo de emergencia'),
  benchmarkCase('ahorro-05', 'Quiero ahorrar para una meta, como le hago?', 'ahorro', 'Ahorro y fondo de emergencia'),
  benchmarkCase('ahorro-06', 'Me conviene la tanda?', 'ahorro', 'Ahorro y fondo de emergencia'),
  benchmarkCase('deuda-01', 'Que deuda pago primero?', 'liquidacion_de_deuda', 'Deudas'),
  benchmarkCase('deuda-02', 'Cuanto me cuesta realmente mi tarjeta de credito?', 'liquidacion_de_deuda', 'Deudas'),
  benchmarkCase('deuda-03', 'Me conviene pagar minimo o mas?', 'liquidacion_de_deuda', 'Deudas'),
  benchmarkCase('deuda-04', 'Deberia usar mis ahorros para pagar deudas?', 'liquidacion_de_deuda', 'Deudas'),
  benchmarkCase('deuda-05', 'Como salgo del buro de credito?', 'liquidacion_de_deuda', 'Deudas'),
  benchmarkCase('deuda-06', 'Me conviene una compra de deuda o consolidacion?', 'liquidacion_de_deuda', 'Deudas'),
  benchmarkCase('deuda-07', 'Puedo invertir si todavia tengo deudas?', 'liquidacion_de_deuda', 'Deudas'),
  benchmarkCase('inversion-01', 'Ya ordene mis gastos, como empiezo a invertir?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-02', 'Cuanto necesito para empezar a invertir?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-03', 'Que son los CETES y como los compro?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-04', 'Donde invierto: CETES, Nu, GBM, Afore voluntaria?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-05', 'Cuanto puedo ganar si invierto X al mes?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-06', 'Que es mejor, CETES o pagare bancario?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-07', 'Que riesgo tiene cada inversion?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-08', 'Me conviene invertir en dolares?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-09', 'Como diversifico sin saber mucho?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-10', 'Cuando podre comprar casa/coche?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-11', 'Cuanto necesito para mi retiro?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-12', 'Voy bien para mis metas?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-13', 'Como logro mi independencia financiera?', 'inversion', 'Inversión y metas'),
  benchmarkCase('ahorro-07', 'Quiero ahorrar mi aguinaldo, que hago con el?', 'ahorro', 'Ahorro y fondo de emergencia'),
  benchmarkCase('control-08', 'Como puedo ganar mas dinero?', 'control', 'Presupuesto y control'),
  benchmarkCase('control-09', 'Cuanto deberia pedir de aumento?', 'control', 'Presupuesto y control'),
  benchmarkCase('control-10', 'Me conviene un segundo ingreso o freelance?', 'control', 'Presupuesto y control'),
  benchmarkCase('inversion-14', 'Tengo que pagar impuestos por mis inversiones?', 'inversion', 'Inversión y metas'),
  benchmarkCase('control-11', 'Como bajo lo que pago de impuestos legalmente?', 'control', 'Presupuesto y control'),
  benchmarkCase('inversion-15', 'Las aportaciones a mi Afore me ayudan en impuestos?', 'inversion', 'Inversión y metas'),
  benchmarkCase('control-12', 'Debo darme de alta en el SAT si hago freelance?', 'control', 'Presupuesto y control'),
  benchmarkCase('control-13', 'Como dejo de gastar de mas?', 'control', 'Presupuesto y control'),
  benchmarkCase('diagnostico-06', 'Por que nunca me alcanza si gano bien?', 'diagnostico', 'Diagnóstico inicial'),
  benchmarkCase('control-14', 'Dame un consejo financiero para hoy.', 'control', 'Presupuesto y control'),
  benchmarkCase('control-15', 'Que hago con mi quincena cuando me caiga?', 'control', 'Presupuesto y control'),
  benchmarkCase('ahorro-08', 'Nu, Hey Banco o Klar para guardar mi dinero?', 'ahorro', 'Ahorro y fondo de emergencia'),
  benchmarkCase('inversion-16', 'Es seguro CetesDirecto?', 'inversion', 'Inversión y metas'),
  benchmarkCase('ahorro-09', 'Que es una SOFIPO y es confiable?', 'ahorro', 'Ahorro y fondo de emergencia'),
  benchmarkCase('inversion-17', 'Me conviene cambiar de Afore?', 'inversion', 'Inversión y metas'),
  benchmarkCase('inversion-18', 'Donde abro mi primera cuenta de inversion en bolsa?', 'inversion', 'Inversión y metas'),
]

export function getDashboardChatBenchmarkSummary() {
  const byStage = DASHBOARD_CHAT_BENCHMARK_CASES.reduce<Record<DashboardBenchmarkStage, number>>((totals, item) => {
    totals[item.expectedStage] += 1
    return totals
  }, {
    diagnostico: 0,
    control: 0,
    ahorro: 0,
    liquidacion_de_deuda: 0,
    inversion: 0,
  })

  return {
    version: DASHBOARD_CHAT_BENCHMARK_VERSION,
    total: DASHBOARD_CHAT_BENCHMARK_CASES.length,
    byStage,
  }
}
