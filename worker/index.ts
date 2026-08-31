import { runScheduled } from './cron'
import { error, json } from './lib/shared'
import type { Env } from './lib/shared'
import { handleAuthRoutes } from './routes/auth'
import { handleFinanceRoutes } from './routes/finance'
import { handleSyncfyRoutes } from './routes/syncfy'

// =====================
// MAIN HANDLER
// =====================

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-FinovAI-Dashboard-Secret, X-FinovAI-Admin-Secret',
        },
      })
    }

    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url, ctx)
    }

    return new Response('Not Found', { status: 404 })
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduled(env))
  },
}

// =====================
// API HANDLER
// =====================

async function handleAPI(request: Request, env: Env, url: URL, ctx?: ExecutionContext): Promise<Response> {
  try {
    const response =
      (await handleAuthRoutes(request, env, url)) ??
      (await handleSyncfyRoutes(request, env, url, ctx)) ??
      (await handleFinanceRoutes(request, env, url))

    return response ?? error('Not found', 404)
  } catch (err) {
    console.error('API Error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
}
