type JsonRecord = Record<string, unknown>

const OFFICIAL_SAMPLE_BASE_URL = 'https://opendata-api.syncfy.com/v1'
const DEFAULT_APP_BASE_URL = 'https://sync.paybook.com/v1'
const ACME_SITES = {
  normal: {
    idSite: '56cf5728784806f72b8b4568',
    label: 'ACME Normal Simple Auth',
    credentials: { username: 'test', password: 'test' },
  },
  sampleData: {
    idSite: '61aec45361f37158fad6e44b',
    label: 'ACME Sample Data Simple Auth',
    credentials: { username: 'test', password: 'test' },
  },
}

function parseArgs() {
  const args = new Map<string, string | true>()
  for (let index = 2; index < Bun.argv.length; index += 1) {
    const arg = Bun.argv[index]
    if (!arg.startsWith('--')) continue

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2)
    if (inlineValue !== undefined) {
      args.set(rawKey, inlineValue)
      continue
    }

    const next = Bun.argv[index + 1]
    if (next && !next.startsWith('--')) {
      args.set(rawKey, next)
      index += 1
    } else {
      args.set(rawKey, true)
    }
  }
  return args
}

async function readDevVars() {
  try {
    const text = await Bun.file('.dev.vars').text()
    const values = new Map<string, string>()
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index === -1) continue
      const key = trimmed.slice(0, index).trim()
      const rawValue = trimmed.slice(index + 1).trim()
      values.set(key, rawValue.replace(/^["']|["']$/g, ''))
    }
    return values
  } catch {
    return new Map<string, string>()
  }
}

function envValue(name: string, devVars: Map<string, string>) {
  return process.env[name] || devVars.get(name) || ''
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '')
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
}

function responseEnvelope(data: unknown) {
  const record = asRecord(data)
  return {
    rid: typeof record?.rid === 'string' ? record.rid : null,
    code: typeof record?.code === 'number' ? record.code : null,
    status: typeof record?.status === 'boolean' ? record.status : null,
    message: typeof record?.message === 'string' ? record.message : null,
    response: record && 'response' in record ? record.response : null,
  }
}

function maskKey(key: string) {
  return key ? { configured: true, last4: key.slice(-4), length: key.length } : { configured: false }
}

async function requestJson(baseUrl: string, path: string, init: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const text = await response.text()
  let data: unknown = null
  try {
    data = JSON.parse(text)
  } catch {
    data = text || null
  }
  const envelope = responseEnvelope(data)
  return {
    httpStatus: response.status,
    ok: response.ok && envelope.status !== false,
    rid: envelope.rid,
    code: envelope.code,
    status: envelope.status,
    message: envelope.message,
    response: envelope.response,
  }
}

function summarizeResult(result: Awaited<ReturnType<typeof requestJson>>) {
  return {
    httpStatus: result.httpStatus,
    ok: result.ok,
    rid: result.rid,
    code: result.code,
    status: result.status,
    message: result.message,
  }
}

function getString(value: unknown, key: string) {
  const record = asRecord(value)
  const fieldValue = record?.[key]
  return typeof fieldValue === 'string' ? fieldValue : ''
}

async function pollJob(baseUrl: string, token: string, statusUrl: string, seconds: number) {
  const deadline = Date.now() + seconds * 1000
  const path = statusUrl.startsWith('http')
    ? new URL(statusUrl).pathname + new URL(statusUrl).search
    : statusUrl
  const snapshots: Array<{ code: number | null; message: string | null; rid: string | null }> = []

  while (Date.now() < deadline) {
    await Bun.sleep(3000)
    const status = await requestJson(baseUrl, path, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const response = status.response
    const responseArray = Array.isArray(response) ? response : Array.isArray(response?.response) ? response.response : []
    const last = asRecord(responseArray[responseArray.length - 1])
    const code = typeof last?.code === 'number' ? last.code : status.code
    const message = typeof last?.message === 'string' ? last.message : status.message
    snapshots.push({ code, message, rid: status.rid })
    if (code !== null && code >= 200) return snapshots
  }

  return snapshots
}

async function runProbe(options: {
  apiKey: string
  baseUrl: string
  site: typeof ACME_SITES[keyof typeof ACME_SITES]
  pollSeconds: number
}) {
  const idExternal = `finovai-probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const user = await requestJson(options.baseUrl, '/users?pretty=1', {
    method: 'POST',
    headers: { Authorization: `API_KEY api_key=${options.apiKey}` },
    body: JSON.stringify({
      name: 'FinovAI Syncfy Probe',
      id_external: idExternal,
    }),
  })

  const idUser = getString(user.response, 'id_user')
  const session = idUser ? await requestJson(options.baseUrl, '/sessions?pretty=1', {
    method: 'POST',
    headers: { Authorization: `API_KEY api_key=${options.apiKey}` },
    body: JSON.stringify({ id_user: idUser }),
  }) : null

  const token = getString(session?.response, 'token')
  const credential = token ? await requestJson(options.baseUrl, '/credentials/pulls?pretty=1', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      id_site: options.site.idSite,
      credentials: options.site.credentials,
    }),
  }) : null

  const idCredential = getString(credential?.response, 'id_credential')
  const statusUrl = getString(credential?.response, 'status')
  const job = token && statusUrl && options.pollSeconds > 0
    ? await pollJob(options.baseUrl, token, statusUrl, options.pollSeconds)
    : []
  const transactions = token && idCredential && (job.length === 0 || job.some((item) => item.code !== null && item.code >= 200))
    ? await requestJson(options.baseUrl, `/transactions?pretty=1&id_credential=${encodeURIComponent(idCredential)}&limit=10&skip=0`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    : null
  const transactionResponse = transactions?.response
  const transactionRecord = asRecord(transactionResponse)
  const transactionRows = Array.isArray(transactionResponse)
    ? transactionResponse.length
    : Array.isArray(transactionRecord?.transactions)
      ? transactionRecord.transactions.length
      : null

  return {
    baseUrl: options.baseUrl,
    site: {
      idSite: options.site.idSite,
      label: options.site.label,
    },
    user: {
      ...summarizeResult(user),
      idUser: Boolean(idUser),
    },
    session: session ? {
      ...summarizeResult(session),
      token: Boolean(token),
    } : null,
    credential: credential ? {
      ...summarizeResult(credential),
      idCredential: Boolean(idCredential),
      statusUrl: Boolean(statusUrl),
    } : null,
    job,
    transactions: transactions ? {
      ...summarizeResult(transactions),
      rows: transactionRows,
    } : null,
  }
}

const args = parseArgs()
const devVars = await readDevVars()
const apiKey = String(args.get('api-key') || envValue('SYNCFY_API_KEY', devVars))
const syncfyEnv = String(args.get('syncfy-env') || envValue('SYNCFY_ENV', devVars)).toLowerCase()
const allowProduction = Boolean(args.get('allow-production'))
const pollSeconds = Number(args.get('poll-seconds') || 0)

if (!apiKey) {
  throw new Error('SYNCFY_API_KEY is missing. Set it in the shell or .dev.vars.')
}

if (syncfyEnv !== 'sandbox' && !allowProduction) {
  throw new Error(`Refusing credential-create probe outside sandbox. SYNCFY_ENV=${syncfyEnv || 'missing'}.`)
}

const configuredBase = normalizeBaseUrl(String(args.get('base-url') || envValue('SYNCFY_API_BASE_URL', devVars) || DEFAULT_APP_BASE_URL))
const baseUrls = args.has('base-url')
  ? [configuredBase]
  : [...new Set([OFFICIAL_SAMPLE_BASE_URL, configuredBase].map(normalizeBaseUrl))]
const selectedSite = String(args.get('site') || 'normal') as keyof typeof ACME_SITES
const sites = selectedSite === 'all'
  ? Object.values(ACME_SITES)
  : [ACME_SITES[selectedSite] || ACME_SITES.normal]

const results = []
for (const baseUrl of baseUrls) {
  for (const site of sites) {
    results.push(await runProbe({ apiKey, baseUrl, site, pollSeconds }))
  }
}

const passed = results.some((result) => result.credential?.ok && result.credential.idCredential)

console.log(JSON.stringify({
  ok: passed,
  syncfyEnv,
  apiKey: maskKey(apiKey),
  pollSeconds,
  results,
}, null, 2))

if (!passed) {
  process.exit(1)
}
