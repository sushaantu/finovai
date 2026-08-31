import type {
  DashboardResponse,
  FinanceActionPlan,
  FinanceTransaction,
  FinancialProfile,
  SyncfyCredential,
} from '@finovai/core'
import {
  DEFAULT_FINANCE_CURRENCY,
  INVESTMENT_CATEGORY,
  buildCategoryAnalysis,
  buildFinancialSummary,
  projectInvestmentContribution,
} from '@finovai/core'
import type { TransactionType } from './types'
import { formatCardCurrency } from './format'

export function createPreviewTransaction(
  id: string,
  date: string,
  category: string,
  description: string,
  amount: number,
  type: TransactionType = 'expense'
): FinanceTransaction {
  return {
    id,
    email: 'demo@finov.ai',
    date,
    type,
    amount,
    currency: DEFAULT_FINANCE_CURRENCY,
    category,
    description,
    merchant: description,
    notes: null,
    source: 'syncfy',
    confidence: 0.94,
    rawSource: 'syncfy-preview',
    cartolaImportId: null,
    created_at: `${date}T12:00:00.000Z`,
  }
}

export function createPreviewDashboardResponse(email: string): DashboardResponse {
  const transactions: FinanceTransaction[] = [
    createPreviewTransaction('preview-may-1', '2026-05-01', 'Sueldo', 'Nómina', 52000, 'income'),
    createPreviewTransaction('preview-may-2', '2026-05-02', 'Transferencias', 'Renta departamento', 16500),
    createPreviewTransaction('preview-may-3', '2026-05-06', 'Supermercado', 'City Market', 2200),
    createPreviewTransaction('preview-may-4', '2026-05-09', 'Comida fuera', 'Restaurante', 980),
    createPreviewTransaction('preview-may-5', '2026-05-14', 'Suscripciones', 'Netflix', 299),
    createPreviewTransaction('preview-may-6', '2026-05-18', 'Transporte', 'Uber', 610),
    createPreviewTransaction('preview-1', '2026-06-01', 'Sueldo', 'Nómina', 52000, 'income'),
    createPreviewTransaction('preview-2', '2026-06-01', 'Transferencias', 'Renta departamento', 16500),
    createPreviewTransaction('preview-3', '2026-06-02', 'Supermercado', 'City Market', 2840),
    createPreviewTransaction('preview-4', '2026-06-03', 'Suscripciones', 'Netflix', 299),
    createPreviewTransaction('preview-5', '2026-06-04', 'Transporte', 'Uber', 480),
    createPreviewTransaction('preview-6', '2026-06-05', 'Comida fuera', 'Starbucks', 185),
    createPreviewTransaction('preview-7', '2026-06-06', 'Comida fuera', 'Starbucks', 165),
    createPreviewTransaction('preview-8', '2026-06-07', 'Compras', 'Amazon MX', 1450),
    createPreviewTransaction('preview-9', '2026-06-08', 'Suscripciones', 'Spotify', 129),
    createPreviewTransaction('preview-10', '2026-06-09', 'Salud', 'Farmacia Guadalajara', 780),
    createPreviewTransaction('preview-11', '2026-06-10', 'Ocio', 'Cinemex', 620),
    createPreviewTransaction('preview-12', '2026-06-11', 'Transporte', 'Didi', 360),
    createPreviewTransaction('preview-13', '2026-06-12', 'Comida fuera', 'Starbucks', 195),
    createPreviewTransaction('preview-14', '2026-06-13', 'Impuestos', 'SAT pago provisional', 3800),
    createPreviewTransaction('preview-15', '2026-06-14', INVESTMENT_CATEGORY, 'Bitso compra recurrente', 2500),
  ].map((transaction) => ({ ...transaction, email }))

  const summary = buildFinancialSummary(transactions)
  const profile: FinancialProfile = {
    email,
    currency: DEFAULT_FINANCE_CURRENCY,
    monthlyIncome: 52000,
    monthlyBudget: 39000,
    categoryBudgets: {
      Transferencias: 17000,
      Supermercado: 6000,
      'Comida fuera': 1800,
      Suscripciones: 900,
      Transporte: 1800,
      [INVESTMENT_CATEGORY]: 3000,
      Impuestos: 3500,
    },
  }
  const categoryAnalysis = buildCategoryAnalysis(transactions, summary, profile)
  const investmentProjection = projectInvestmentContribution(summary.estimatedSavingsOpportunity)
  const actionPlan: FinanceActionPlan = {
    monthlySavingsTarget: summary.estimatedSavingsOpportunity,
    topOpportunities: [
      {
        id: 'preview-coffee',
        kind: 'merchant_leak',
        title: 'Café entre semana',
        body: 'Starbucks aparece varias veces en pocos días. Reducir dos visitas por semana libera margen sin cambiar gastos fijos.',
        sourceLabel: 'Starbucks',
        estimatedMonthlySavings: 1480,
      },
      {
        id: 'preview-subscriptions',
        kind: 'recurring',
        title: 'Suscripciones pequeñas',
        body: 'Netflix y Spotify no son grandes solos, pero juntos ya son una fuga recurrente revisable.',
        sourceLabel: 'Suscripciones',
        estimatedMonthlySavings: 428,
      },
    ],
    investmentProjection,
    nextActions: [
      {
        id: 'preview-plan',
        label: 'Plan semanal',
        body: 'Convierte estas fugas en una meta automática de ahorro.',
        target: 'chat',
      },
      {
        id: 'preview-invest',
        label: 'Ruta de inversión',
        body: 'Simula el margen mensual como aportación futura.',
        target: 'partner',
      },
    ],
  }

  return {
    success: true,
    email,
    transactions,
    profile,
    summary,
    categoryAnalysis,
    insights: [
      {
        id: 'preview-leak',
        title: 'Fuga principal',
        value: 'Comida fuera',
        body: 'El gasto repetido en cafés y salidas pequeñas tiene margen de reducción inmediato.',
        tone: 'watch',
      },
      {
        id: 'preview-investable',
        title: 'Ahorro invertible',
        value: formatCardCurrency(summary.estimatedSavingsOpportunity, DEFAULT_FINANCE_CURRENCY),
        body: 'FinovAI puede transformar ese margen en próximos pasos de inversión.',
        tone: 'good',
      },
    ],
    actionPlan,
  }
}

export function createPreviewSyncfyCredentials(): SyncfyCredential[] {
  return [
    {
      id: 'preview-bbva',
      syncfyCredentialId: 'preview-bbva',
      siteName: 'BBVA México',
      status: 'synced',
      lastSuccessfulSyncAt: '2026-06-02T12:00:00.000Z',
      lastPullAt: '2026-06-02T12:00:00.000Z',
      cooldownSeconds: 0,
      ready: true,
    },
    {
      id: 'preview-amex',
      syncfyCredentialId: 'preview-amex',
      siteName: 'American Express',
      status: 'synced',
      lastSuccessfulSyncAt: '2026-06-02T12:00:00.000Z',
      lastPullAt: '2026-06-02T12:00:00.000Z',
      cooldownSeconds: 0,
      ready: true,
    },
    {
      id: 'preview-bitso',
      syncfyCredentialId: 'preview-bitso',
      siteName: 'Bitso',
      status: 'synced',
      lastSuccessfulSyncAt: '2026-06-02T12:00:00.000Z',
      lastPullAt: '2026-06-02T12:00:00.000Z',
      cooldownSeconds: 0,
      ready: true,
    },
  ]
}
