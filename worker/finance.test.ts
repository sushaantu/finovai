import { expect, test } from 'bun:test'

import worker, {
  buildFinancialInsights,
  buildFinancialSummary,
  inferFinanceCategory,
  normalizeFinancialAmount,
  normalizeFinancialDate,
  parseCsvCartola,
  parsePdfCartolaText,
  type FinanceTransaction,
} from './index'

type BoundParams = Array<string | number | null>

interface DashboardResponse {
  email: string
  transactions: FinanceTransaction[]
  summary: {
    monthlySpending: number
  }
}

interface CartolaImportResponse {
  importId: string
  rows: Array<{
    id: string
    date: string
    type: 'income' | 'expense'
    amount: number
    currency: string
    category: string
    description: string
    merchant: string
    confidence: number
    rawSource: string
  }>
}

class MockD1 {
  leads = new Map<string, Record<string, unknown>>()
  profiles = new Map<string, { email: string; currency: string }>()
  dashboardSessions = new Map<string, { email: string; client_secret_hash: string }>()
  transactions: Record<string, unknown>[] = []
  imports: Record<string, unknown>[] = []
  invites: Record<string, unknown>[] = []

  prepare(sql: string) {
    const db = this

    return {
      bind(...params: BoundParams) {
        return {
          async run() {
            return db.run(sql, params)
          },
          async first<T>() {
            return db.first<T>(sql, params)
          },
          async all<T>() {
            return db.all<T>(sql, params)
          },
        }
      },
      async run() {
        return db.run(sql, [])
      },
      async first<T>() {
        return db.first<T>(sql, [])
      },
      async all<T>() {
        return db.all<T>(sql, [])
      },
    }
  }

  async run(sql: string, params: BoundParams) {
    if (sql.includes('INSERT INTO financial_profiles')) {
      const [email, currency] = params
      this.profiles.set(String(email), { email: String(email), currency: String(currency) })
    }

    if (sql.includes('INSERT INTO leads')) {
      const [email, name, diagnosticData] = params
      this.leads.set(String(email), {
        id: 1,
        email,
        name,
        diagnostic_data: diagnosticData,
        stage: 'stage_0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    if (sql.includes('INSERT INTO dashboard_sessions')) {
      const [email, clientSecretHash] = params
      this.dashboardSessions.set(String(email), {
        email: String(email),
        client_secret_hash: String(clientSecretHash),
      })
    }

    if (sql.includes('UPDATE dashboard_sessions')) {
      return { success: true, meta: { last_row_id: 1 } }
    }

    if (sql.includes('INSERT INTO transactions')) {
      const [
        id,
        email,
        date,
        type,
        amount,
        currency,
        category,
        description,
        merchant,
        notes,
        source,
        confidence,
        rawSource,
        cartolaImportId,
      ] = params

      this.transactions.push({
        id,
        email,
        date,
        type,
        amount,
        currency,
        category,
        description,
        merchant,
        notes,
        source,
        confidence,
        raw_source: rawSource,
        cartola_import_id: cartolaImportId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    if (sql.includes('INSERT INTO cartola_imports')) {
      const [id, email, fileName, fileType, rowCount, metadataJson] = params
      this.imports.push({
        id,
        email,
        file_name: fileName,
        file_type: fileType,
        row_count: rowCount,
        accepted_count: 0,
        status: 'parsed',
        metadata_json: metadataJson,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    if (sql.includes('UPDATE cartola_imports')) {
      const [acceptedCount, importId, email] = params
      const record = this.imports.find((item) => item.id === importId && item.email === email)
      if (record) {
        record.accepted_count = acceptedCount
        record.status = 'confirmed'
      }
    }

    if (sql.includes('INSERT INTO household_invites')) {
      const [id, inviterEmail, inviteeEmail] = params
      const existing = this.invites.find(
        (item) => item.inviter_email === inviterEmail && item.invitee_email === inviteeEmail
      )

      if (existing) {
        existing.status = 'pending'
        existing.updated_at = new Date().toISOString()
      } else {
        this.invites.push({
          id,
          inviter_email: inviterEmail,
          invitee_email: inviteeEmail,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    }

    return { success: true, meta: { last_row_id: 1 } }
  }

  async first<T>(sql: string, params: BoundParams): Promise<T | null> {
    if (sql.includes('SELECT * FROM transactions WHERE id = ? AND email = ?')) {
      const [id, email] = params
      return (this.transactions.find((item) => item.id === id && item.email === email) || null) as T | null
    }

    if (sql.includes('SELECT * FROM leads WHERE email = ?')) {
      const [email] = params
      return (this.leads.get(String(email)) || null) as T | null
    }

    if (sql.includes('SELECT client_secret_hash FROM dashboard_sessions WHERE email = ?')) {
      const [email] = params
      return (this.dashboardSessions.get(String(email)) || null) as T | null
    }

    if (sql.includes('SELECT id FROM cartola_imports WHERE id = ? AND email = ?')) {
      const [id, email] = params
      const record = this.imports.find((item) => item.id === id && item.email === email)
      return (record ? { id: record.id } : null) as T | null
    }

    if (sql.includes('SELECT * FROM household_invites') && sql.includes('invitee_email = ?')) {
      const [inviterEmail, inviteeEmail] = params
      return (this.invites.find(
        (item) => item.inviter_email === inviterEmail && item.invitee_email === inviteeEmail
      ) || null) as T | null
    }

    return null
  }

  async all<T>(sql: string, params: BoundParams): Promise<{ results: T[] }> {
    if (sql.includes('SELECT * FROM transactions')) {
      const [email] = params
      const results = this.transactions
        .filter((item) => item.email === email)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))) as T[]
      return { results }
    }

    if (sql.includes('SELECT * FROM household_invites')) {
      const [email] = params
      const results = this.invites.filter((item) => item.inviter_email === email) as T[]
      return { results }
    }

    return { results: [] }
  }
}

function createEnv(environment = 'test') {
  return {
    DB: new MockD1(),
    AI: { run: async () => ({ response: '' }) },
    ENVIRONMENT: environment,
  }
}

function sampleTransaction(overrides: Partial<FinanceTransaction>): FinanceTransaction {
  return {
    id: crypto.randomUUID(),
    email: 'user@example.com',
    date: '2026-05-01',
    type: 'expense',
    amount: 1000,
    currency: 'CLP',
    category: 'Otro',
    description: 'Movimiento',
    merchant: 'Movimiento',
    notes: null,
    source: 'manual',
    confidence: 1,
    rawSource: null,
    cartolaImportId: null,
    created_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

function roundTestMoney(value: number) {
  return Math.round(value * 100) / 100
}

test('normalizeFinancialAmount handles Chilean and Mexican formats', () => {
  expect(normalizeFinancialAmount('$1.234,56')).toBe(1234.56)
  expect(normalizeFinancialAmount('1,234.56')).toBe(1234.56)
  expect(normalizeFinancialAmount('-2.650')).toBe(-2650)
  expect(normalizeFinancialAmount('123,45')).toBe(123.45)
})

test('normalizeFinancialDate accepts ISO, day-first, and bank-style dates', () => {
  expect(normalizeFinancialDate('2026-05-20')).toBe('2026-05-20')
  expect(normalizeFinancialDate('20/05/2026')).toBe('2026-05-20')
  expect(normalizeFinancialDate('20-may-26')).toBe('2026-05-20')
  expect(normalizeFinancialDate('31/02/2026')).toBeNull()
})

test('inferFinanceCategory recognizes common Mexico cartola merchants', () => {
  expect(inferFinanceCategory('DLO*UBER EATS', 'expense')).toBe('Comida fuera')
  expect(inferFinanceCategory('REST BALBOA LERMA', 'expense')).toBe('Comida fuera')
  expect(inferFinanceCategory('WM EXPRESS HOMERO', 'expense')).toBe('Supermercado')
  expect(inferFinanceCategory('AMERICAN EXPRESS 01429', 'expense')).toBe('Deuda')
  expect(inferFinanceCategory('SPEI ENVIADO STP', 'expense')).toBe('Transferencias')
  expect(inferFinanceCategory('RETIRO CAJERO AUTOMATICO', 'expense')).toBe('Retiros')
  expect(inferFinanceCategory('ONLYFANS.COM*A', 'expense')).toBe('Ocio')
  expect(inferFinanceCategory('ZOOM.COM 888-799-9666', 'expense')).toBe('Suscripciones')
})

test('parseCsvCartola maps debit and credit rows into draft movements', () => {
  const rows = parseCsvCartola(`fecha,descripcion,cargo,abono,categoria
20/05/2026,Uber trip,"4.500",,Transporte
21/05/2026,Sueldo mensual,,1.200.000,Sueldo`)

  expect(rows).toHaveLength(2)
  expect(rows[0].type).toBe('expense')
  expect(rows[0].amount).toBe(4500)
  expect(rows[1].type).toBe('income')
  expect(rows[1].category).toBe('Sueldo')
  expect(rows[0].rawSource).toContain('Uber trip')
})

test('parsePdfCartolaText returns low-confidence review rows', () => {
  const rows = parsePdfCartolaText(`
20/05/2026 UBER TRIP -4.500 845.000
21/05/2026 NETFLIX -6.990 838.010
`)

  expect(rows).toHaveLength(2)
  expect(rows[0].confidence).toBeLessThan(0.75)
  expect(rows[0].rawSource).toContain('UBER TRIP')
})

test('parsePdfCartolaText extracts every BBVA Mexico movement from statement text', () => {
  const movements = [
    '27/MAR 27/MAR UBER RIDE 89.97 RFC: DME 180122DU4',
    '27/MAR 27/MAR UBER RIDE 196.09 RFC: DME 180122DU4',
    '27/MAR 27/MAR KSK*RESTA NIUSUSHIMEXI 571.00 96,633.64 96,633.64 RFC: NSM',
    '30/MAR 28/MAR ONLYFANS.COM*A 315.93 USD 17.40TC018.1568AUT: 155528',
    '30/MAR 30/MAR PAGO CUENTA DE TERCERO 25,000.00 BNET 2992743434 acapulco',
    '30/MAR 30/MAR PAGO CUENTA DE TERCERO 10,000.00 BNET 0117274084 cal c26 y c27',
    '30/MAR 30/MAR SPEI ENVIADO BANORTE 20,229.00 41,088.71 40,759.71 2702260arrieno Abril',
    '31/MAR 31/MAR SAT 395.00 REF:04262BK7680049375295 CIE:0844985',
    '31/MAR 30/MAR PAGO CUENTA DE TERCERO 900.00 BNET 1587468345 marzo',
    '31/MAR 30/MAR NETFLIX MEXICO 329.00 39,464.71 39,464.71 RFC: NME',
    '01/ABR 01/ABR SPEI RECIBIDOSTP 150,333.80 189,798.51 189,798.51 Retiro desde Fintual',
    '04/ABR 06/ABR RET CAJ OTRO BCO COM IVA 3,034.80 186,763.71 189,252.56',
    '05/ABR 06/ABR SPEI ENVIADO SANTANDER 20,000.00 166,763.71 189,252.56 transfer',
    '06/ABR 02/ABR COMPENSACION POR RETRASO 0.01 Referencia COMP SPEI',
    '06/ABR 06/ABR SPEI ENVIADO BANAMEX 6,800.00 perros',
    '06/ABR 04/ABR UBER EATS 545.96 159,417.76 159,165.95 RFC: UPM',
    '07/ABR 06/ABR DLO*UBER EATS 251.81 159,165.95 159,165.95 RFC: DME',
    '09/ABR 09/ABR SPEI ENVIADO SANTANDER 4,500.00 Cerati',
    '09/ABR 08/ABR STRIPE *SOFIA SOFIASER 400.00 154,265.95 154,265.95',
    '10/ABR 10/ABR AMERICAN EXPRESS 01429 122.24 154,143.71 154,143.71',
    '11/ABR 13/ABR SPEI RECIBIDOSANTANDER 310.00 154,453.71 153,810.71',
    '13/ABR 11/ABR BPK*REST PASTA MESTIZA 264.00 RFC: YERO',
    '13/ABR 11/ABR MERPAGO*PIPAL17 69.00 RFC: MAG',
    '13/ABR 13/ABR SPEI ENVIADO BANORTE 17,400.00 Registro Finovai',
    '13/ABR 13/ABR SPEI DEVUELTOBANORTE 17,400.00 Registro Finovai',
    '13/ABR 13/ABR SPEI ENVIADO BANORTE 17,400.00 pago registro',
    '13/ABR 12/ABR OXXO SONORA 72.00 RFC: CCO',
    '13/ABR 12/ABR WM EXPRESS HOMERO 252.01 RFC: NWM',
    '13/ABR 12/ABR DLO*TDA UBER RIDES 179.97 136,216.73 134,756.56',
    '14/ABR 14/ABR SPEI RECIBIDOINBURSA 8,750.00 Transferencia electronica',
    '14/ABR 14/ABR AMERICAN EXPRESS 01429 27,746.10 340114263461004',
    '14/ABR 13/ABR OPLINEA*SIEMBRATAQUPOL 903.90 RFC: OLI',
    '14/ABR 13/ABR SMARTPY*RESTMONARCH 129.00 RFC: MCH',
    '14/ABR 13/ABR DLO*UBER RIDES 70.00 RFC: UPM',
    '14/ABR 13/ABR ZOOM.COM 888-799-9666 357.27 115,760.46 113,358.75',
    '15/ABR 14/ABR OVG PALACIO DEPORTES 450.00 RFC: OHM',
    '15/ABR 14/ABR OVG PALACIO DEPORTES 400.00 RFC: OHM',
    '15/ABR 14/ABR DLO*UBER RIDES 469.98 114,440.48 112,657.45',
    '16/ABR 14/ABR REST BALBOA LERMA 1,016.60 RFC: PCE',
    '16/ABR 15/ABR COFFEE HAUS 75.00 RFC: HACS',
    '16/ABR 14/ABR DLO*TDA UBER RIDES 65.13 RFC: UPM',
    '16/ABR 15/ABR D LOCAL*SPOTIFY 139.00 RFC: RSM',
    '16/ABR 15/ABR DLO*UBER RIDES 487.30 112,657.45 112,657.45',
    '17/ABR 17/ABR PAGO CUENTA DE TERCERO 8,750.00 121,407.45 121,407.45 BNET bot',
    '20/ABR 18/ABR UBER EATS 526.63 RFC: DME',
    '20/ABR 20/ABR RETIRO CAJERO AUTOMATICO 1,000.00 119,880.82 118,847.99',
    '21/ABR 21/ABR SPEI ENVIADO STP 20,000.00 18032601111111',
    '21/ABR 21/ABR SPEI ENVIADO STP 20,000.00 1803260111111',
    '21/ABR 21/ABR SPEI ENVIADO STP 20,000.00 1803260111111',
    '21/ABR 21/ABR SPEI ENVIADO STP 20,000.00 1803260111111',
    '21/ABR 21/ABR SPEI ENVIADO STP 20,000.00 1803260111111',
    '21/ABR 20/ABR BAR CARAMELOS LERMA 246.40 RFC: CTE',
    '21/ABR 20/ABR PESCADITO MEXICO 271.40 RFC: EAC',
    '21/ABR 20/ABR UBER EATS 515.03 RFC: DME',
    '21/ABR 21/ABR Google YouTubePremium 159.00 18,688.99 18,364.54',
    '23/ABR 21/ABR DLO*UBER EATS 324.45 RFC: DME',
    '23/ABR 22/ABR UBER RIDE 99.98 RFC: DME',
    '23/ABR 22/ABR UBER RIDE 85.67 18,178.89 18,178.89',
    '24/ABR 24/ABR AMERICAN EXPRESS 01429 10,094.46 340114263461004',
    '24/ABR 24/ABR ONLYFANS.COM*A 101.01 7,983.42 7,983.42 USD 5.79TC017.4455AUT: 445287',
  ]
  const rows = parsePdfCartolaText(`
    BBVA MEXICO Periodo DEL 27/03/2026 AL 26/04/2026
    Detalle de Movimientos Realizados ${movements.join(' ')}
    Total de Movimientos TOTAL IMPORTE CARGOS 275,051.09 TOTAL MOVIMIENTOS CARGOS 54
    TOTAL IMPORTE ABONOS 185,543.81 TOTAL MOVIMIENTOS ABONOS 6
  `)
  const income = rows.filter((row) => row.type === 'income')
  const expenses = rows.filter((row) => row.type === 'expense')

  expect(rows).toHaveLength(60)
  expect(income).toHaveLength(6)
  expect(expenses).toHaveLength(54)
  expect(roundTestMoney(income.reduce((total, row) => total + row.amount, 0))).toBe(185_543.81)
  expect(roundTestMoney(expenses.reduce((total, row) => total + row.amount, 0))).toBe(275_051.09)
  expect(rows[0]).toMatchObject({ date: '2026-03-27', description: 'UBER RIDE', amount: 89.97, currency: 'MXN' })
  expect(rows[59]).toMatchObject({ date: '2026-04-24', description: 'ONLYFANS.COM*A', amount: 101.01, currency: 'MXN' })
  expect(rows.find((row) => row.description === 'DLO*UBER EATS')).toMatchObject({ category: 'Comida fuera' })
  expect(rows.find((row) => row.description === 'AMERICAN EXPRESS 01429')).toMatchObject({ category: 'Deuda' })
  expect(rows.find((row) => row.description === 'SPEI ENVIADO STP')).toMatchObject({ category: 'Transferencias' })
  expect(rows.find((row) => row.description === 'WM EXPRESS HOMERO')).toMatchObject({ category: 'Supermercado' })
  expect(expenses.filter((row) => row.category === 'Otro')).toHaveLength(0)
})

test('buildFinancialSummary and insights are deterministic from persisted transactions', () => {
  const transactions = [
    sampleTransaction({ date: '2026-05-01', type: 'income', amount: 1_200_000, category: 'Sueldo', description: 'Sueldo' }),
    sampleTransaction({ date: '2026-05-02', type: 'expense', amount: 35_000, category: 'Supermercado', description: 'Jumbo' }),
    sampleTransaction({ date: '2026-05-03', type: 'expense', amount: 120_000, category: 'Comida fuera', description: 'Restaurantes' }),
    sampleTransaction({ date: '2026-04-20', type: 'expense', amount: 6_990, category: 'Suscripciones', description: 'Netflix', merchant: 'Netflix' }),
    sampleTransaction({ date: '2026-05-20', type: 'expense', amount: 6_990, category: 'Suscripciones', description: 'Netflix', merchant: 'Netflix' }),
  ]

  const summary = buildFinancialSummary(transactions)
  const insights = buildFinancialInsights(summary, transactions)

  expect(summary.month).toBe('2026-05')
  expect(summary.monthlyIncome).toBe(1_200_000)
  expect(summary.monthlySpending).toBe(161_990)
  expect(summary.topSpendingCategory).toBe('Comida fuera')
  expect(summary.recurringExpenses[0].description).toBe('Netflix')
  expect(summary.estimatedSavingsOpportunity).toBeGreaterThan(0)
  expect(insights.map((insight) => insight.id)).toContain('net-balance')
})

test('manual transaction endpoint persists and reloads by email', async () => {
  const env = createEnv()
  const response = await worker.fetch(new Request('http://local.test/api/transactions/manual', {
    method: 'POST',
    body: JSON.stringify({
      email: 'USER@Example.com',
      date: '20/05/2026',
      type: 'expense',
      amount: '12.500',
      category: 'Comida fuera',
      description: 'Almuerzo',
    }),
  }), env)

  expect(response.status).toBe(201)
  const created = await response.json() as DashboardResponse
  expect(created.email).toBe('user@example.com')
  expect(created.transactions).toHaveLength(1)
  expect(created.transactions[0].source).toBe('manual')

  const reload = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com'), env)
  const dashboard = await reload.json() as DashboardResponse
  expect(dashboard.transactions).toHaveLength(1)
  expect(dashboard.summary.monthlySpending).toBe(12500)
})

test('cartola import creates review rows without persisting transactions', async () => {
  const env = createEnv()
  const formData = new FormData()
  formData.append('email', 'user@example.com')
  formData.append('file', new File([
    'fecha,descripcion,cargo\n20/05/2026,Uber,4.500',
  ], 'cartola.csv', { type: 'text/csv' }))

  const importResponse = await worker.fetch(new Request('http://local.test/api/cartola/import', {
    method: 'POST',
    body: formData,
  }), env)
  const imported = await importResponse.json() as CartolaImportResponse

  expect(imported.rows).toHaveLength(1)
  expect(env.DB.transactions).toHaveLength(0)

  const reload = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com'), env)
  const dashboard = await reload.json() as DashboardResponse
  expect(dashboard.transactions).toHaveLength(0)
})

test('cartola confirm persists only selected draft rows', async () => {
  const env = createEnv()
  const formData = new FormData()
  formData.append('email', 'user@example.com')
  formData.append('file', new File([
    `fecha,descripcion,cargo
20/05/2026,Uber,4.500
21/05/2026,Netflix,6.990`,
  ], 'cartola.csv', { type: 'text/csv' }))

  const importResponse = await worker.fetch(new Request('http://local.test/api/cartola/import', {
    method: 'POST',
    body: formData,
  }), env)
  const imported = await importResponse.json() as CartolaImportResponse

  const confirmResponse = await worker.fetch(new Request('http://local.test/api/cartola/confirm', {
    method: 'POST',
    body: JSON.stringify({
      email: 'user@example.com',
      importId: imported.importId,
      rows: imported.rows.map((row, index) => ({ ...row, selected: index === 0 })),
    }),
  }), env)
  const confirmed = await confirmResponse.json() as DashboardResponse & { imported: number }

  expect(confirmed.imported).toBe(1)
  expect(confirmed.transactions).toHaveLength(1)
  expect(confirmed.transactions[0].description).toBe('Uber')
})

test('production dashboard APIs require the browser session secret', async () => {
  const env = createEnv('production')

  const signupResponse = await worker.fetch(new Request('http://local.test/api/signup', {
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com' }),
  }), env)
  expect(signupResponse.status).toBe(200)
  const signup = await signupResponse.json() as { clientSecret?: string }
  expect(signup.clientSecret).toBeTruthy()

  const blocked = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com'), env)
  expect(blocked.status).toBe(401)

  const wrongSecret = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com', {
    headers: { 'x-finovai-dashboard-secret': 'wrong' },
  }), env)
  expect(wrongSecret.status).toBe(401)

  const allowed = await worker.fetch(new Request('http://local.test/api/transactions?email=user@example.com', {
    headers: { 'x-finovai-dashboard-secret': signup.clientSecret || '' },
  }), env)
  expect(allowed.status).toBe(200)
})

test('household invite endpoint persists spouse email by financial profile', async () => {
  const env = createEnv()
  const response = await worker.fetch(new Request('http://local.test/api/household/invite', {
    method: 'POST',
    body: JSON.stringify({
      email: 'USER@Example.com',
      spouseEmail: 'SPOUSE@Example.com',
    }),
  }), env)

  expect(response.status).toBe(201)
  const invited = await response.json() as {
    email: string
    invite: { inviteeEmail: string; status: string }
    invites: Array<{ inviteeEmail: string }>
  }
  expect(invited.email).toBe('user@example.com')
  expect(invited.invite.inviteeEmail).toBe('spouse@example.com')
  expect(invited.invite.status).toBe('pending')

  const reload = await worker.fetch(new Request('http://local.test/api/household?email=user@example.com'), env)
  const household = await reload.json() as { invites: Array<{ inviteeEmail: string }> }
  expect(household.invites).toHaveLength(1)
  expect(household.invites[0].inviteeEmail).toBe('spouse@example.com')
})
