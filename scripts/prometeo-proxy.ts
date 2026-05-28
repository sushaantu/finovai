type ProxyPayload = {
  path?: string
  method?: string
  headers?: Record<string, string>
  body?: string
}

const DEFAULT_BASE_URL = 'https://banking.sandbox.prometeoapi.com'
const DEFAULT_PORT = 8791

async function loadLocalEnv() {
  const vars: Record<string, string> = {}

  try {
    const file = await Bun.file('.dev.vars').text()
    for (const line of file.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separator = trimmed.indexOf('=')
      if (separator === -1) continue

      vars[trimmed.slice(0, separator)] = trimmed.slice(separator + 1)
    }
  } catch {
    // .dev.vars is optional; Bun still loads normal .env values automatically.
  }

  return vars
}

const localEnv = await loadLocalEnv()
const apiKey = process.env.PROMETEO_API_KEY || localEnv.PROMETEO_API_KEY
const baseUrl = (process.env.PROMETEO_API_BASE_URL || localEnv.PROMETEO_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
const port = Number(process.env.PROMETEO_PROXY_PORT || localEnv.PROMETEO_PROXY_PORT || DEFAULT_PORT)

if (!apiKey) {
  throw new Error('PROMETEO_API_KEY is required for the Prometeo proxy')
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname !== '/prometeo') {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    const payload = await request.json() as ProxyPayload
    if (!payload.path?.startsWith('/')) {
      return Response.json({ error: 'Invalid Prometeo path' }, { status: 400 })
    }

    const headers = new Headers(payload.headers)
    headers.set('X-API-Key', apiKey)

    const response = await fetch(`${baseUrl}${payload.path}`, {
      method: payload.method || 'GET',
      headers,
      body: payload.body,
    })
    const contentType = response.headers.get('content-type') || 'application/json'

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': contentType,
      },
    })
  },
})

console.log(`Prometeo proxy ready on http://127.0.0.1:${port}/prometeo`)
