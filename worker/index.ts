interface Env {
  DB: D1Database
  AI: Ai
  ASSETS: Fetcher
  ENVIRONMENT: string
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// System prompt for FinovAI agent
const SYSTEM_PROMPT = `Eres el asistente de FinovAI Academy, una academia de orden financiero.

TU MISIÓN:
Ayudar a las personas a entender su situación financiera actual y guiarlas hacia el orden financiero antes de pensar en invertir.

FILOSOFÍA CORE DE FINOVAI:
- "Primero ordenas la casa, luego compras acciones"
- El patrimonio no empieza invirtiendo, empieza teniendo estructura
- Hay 3 etapas:
  1. Etapa 0: Ordenar la casa (hábitos, flujo de dinero, estructura)
  2. Etapa 1: Crear margen (optimizar, ahorrar, automatizar)
  3. Etapa 2: Invertir con sistema (cuando hay margen real)

TU ROL EN ESTA CONVERSACIÓN:
1. Hacer preguntas para entender la situación actual del usuario
2. Identificar en qué etapa están (0, 1 o 2)
3. Mostrar empatía y no juzgar
4. Dar pequeños insights útiles
5. Cuando tengas suficiente información (5-7 intercambios), invitar a registrarse para continuar

PREGUNTAS CLAVE A EXPLORAR:
- ¿Tienen control de ingresos y gastos?
- ¿Saben cuánto gastan en cada categoría?
- ¿Logran ahorrar algo cada mes?
- ¿Tienen deudas?
- ¿Han intentado invertir antes?
- ¿Qué les ha impedido ordenar sus finanzas?

TONO:
- Cercano pero profesional
- Sin tecnicismos innecesarios
- Directo pero empático
- Como un amigo que sabe de finanzas

IMPORTANTE:
- NO des consejos de inversión específicos
- NO prometas rendimientos
- NO uses jerga financiera compleja
- SÍ valida sus preocupaciones
- SÍ muestra que hay solución
- SÍ explica que el orden viene antes de invertir

Responde siempre en español. Mantén las respuestas concisas (2-4 párrafos máximo).`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url)
    }

    // Serve static files (React app)
    return env.ASSETS.fetch(request)
  },
}

async function handleAPI(request: Request, env: Env, url: URL): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  try {
    // Chat endpoint
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const { messages } = (await request.json()) as { messages: Message[] }

      // Add system prompt
      const messagesWithSystem = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ]

      // Call Cloudflare Workers AI
      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: messagesWithSystem,
        max_tokens: 500,
      })

      // Check if user should be prompted to sign up (after 5+ user messages)
      const userMessages = messages.filter((m) => m.role === 'user').length
      let aiMessage = (response as { response: string }).response

      if (userMessages >= 5 && !aiMessage.toLowerCase().includes('registr')) {
        aiMessage +=
          '\n\n---\n\n¿Te gustaría continuar con un diagnóstico más completo? Podemos crear un plan personalizado para ti. Solo necesito que te registres para guardar tu progreso.'
      }

      return new Response(JSON.stringify({ message: aiMessage }), {
        headers: corsHeaders,
      })
    }

    // Lead signup endpoint
    if (url.pathname === '/api/signup' && request.method === 'POST') {
      const { email, name, diagnosticData } = (await request.json()) as {
        email: string
        name: string
        diagnosticData?: string
      }

      // Validate email
      if (!email || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Email inválido' }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      // Insert into D1
      await env.DB.prepare(
        'INSERT INTO leads (email, name, diagnostic_data, created_at) VALUES (?, ?, ?, ?)'
      )
        .bind(email, name || '', diagnosticData || '', new Date().toISOString())
        .run()

      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders,
      })
    }

    // Health check
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('API Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}
