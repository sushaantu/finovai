interface Env {
  DB: D1Database
  AI: Ai
  ASSETS: Fetcher
  ENVIRONMENT: string
  KAPSO_API_KEY?: string
  KAPSO_PHONE_NUMBER_ID?: string
  SESSION_SECRET?: string
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface User {
  id: number
  phone: string
  phone_verified: number
  display_name: string | null
  couple_id: number | null
  created_at: string
}

interface Session {
  id: number
  user_id: number
  token: string
  expires_at: string
}

// =====================
// HELPER FUNCTIONS
// =====================

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizePhone(phone: string): string {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '')
  // Ensure it starts with +
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized
  }
  return normalized
}

async function sendWhatsAppOTP(env: Env, phone: string, code: string): Promise<boolean> {
  if (!env.KAPSO_API_KEY || !env.KAPSO_PHONE_NUMBER_ID) {
    console.log('Kapso not configured, OTP code:', code)
    return true // Dev mode: pretend it sent
  }

  // Remove + prefix for WhatsApp API (expects just digits)
  const whatsappNumber = phone.startsWith('+') ? phone.slice(1) : phone

  try {
    const response = await fetch(
      `https://api.kapso.ai/meta/whatsapp/v24.0/${env.KAPSO_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': env.KAPSO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: whatsappNumber,
          type: 'text',
          text: {
            body: `Tu código de verificación de FinovAI es: ${code}\n\nVálido por 5 minutos.`,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Kapso API error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to send WhatsApp OTP:', error)
    return false
  }
}

async function getSessionUser(env: Env, token: string): Promise<User | null> {
  if (!token) return null

  const session = await env.DB.prepare(
    `SELECT s.*, u.* FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  )
    .bind(token)
    .first<Session & User>()

  if (!session) return null

  // Update last_used_at
  await env.DB.prepare(`UPDATE sessions SET last_used_at = datetime('now') WHERE token = ?`)
    .bind(token)
    .run()

  return {
    id: session.user_id,
    phone: session.phone,
    phone_verified: session.phone_verified,
    display_name: session.display_name,
    couple_id: session.couple_id,
    created_at: session.created_at,
  }
}

function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return null
}

// =====================
// SYSTEM PROMPT
// =====================

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

// =====================
// MAIN HANDLER
// =====================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

// =====================
// API HANDLER
// =====================

async function handleAPI(request: Request, env: Env, url: URL): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: corsHeaders })

  const error = (message: string, status = 400) => json({ error: message }, status)

  try {
    // =====================
    // AUTH ENDPOINTS
    // =====================

    // Send OTP
    if (url.pathname === '/api/auth/send-otp' && request.method === 'POST') {
      const body = (await request.json()) as { phone: string }
      const phone = normalizePhone(body.phone)

      if (!phone || phone.length < 10) {
        return error('Numero de telefono invalido')
      }

      // Rate limit: check recent OTPs for this phone
      const recentOTP = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM otp_verifications
         WHERE phone = ? AND created_at > datetime('now', '-1 minute')`
      )
        .bind(phone)
        .first<{ count: number }>()

      if (recentOTP && recentOTP.count >= 1) {
        return error('Espera un minuto antes de solicitar otro codigo', 429)
      }

      // Generate and store OTP
      const otpCode = generateOTP()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes

      await env.DB.prepare(
        `INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at, created_at)
         VALUES (?, ?, 'login', ?, datetime('now'))`
      )
        .bind(phone, otpCode, expiresAt)
        .run()

      // Send via WhatsApp
      const sent = await sendWhatsAppOTP(env, phone, otpCode)
      if (!sent) {
        return error('Error enviando codigo. Intenta de nuevo.', 500)
      }

      return json({ success: true, expiresIn: 300 })
    }

    // Verify OTP
    if (url.pathname === '/api/auth/verify-otp' && request.method === 'POST') {
      const body = (await request.json()) as { phone: string; code: string }
      const phone = normalizePhone(body.phone)
      const code = body.code?.trim()

      if (!phone || !code) {
        return error('Telefono y codigo son requeridos')
      }

      // Find valid OTP
      const otp = await env.DB.prepare(
        `SELECT * FROM otp_verifications
         WHERE phone = ? AND otp_code = ? AND expires_at > datetime('now') AND verified_at IS NULL
         ORDER BY created_at DESC LIMIT 1`
      )
        .bind(phone, code)
        .first<{ id: number; attempts: number }>()

      if (!otp) {
        // Increment attempts on most recent OTP
        await env.DB.prepare(
          `UPDATE otp_verifications SET attempts = attempts + 1
           WHERE phone = ? AND expires_at > datetime('now') AND verified_at IS NULL`
        )
          .bind(phone)
          .run()

        return error('Codigo invalido o expirado', 401)
      }

      // Check max attempts
      if (otp.attempts >= 3) {
        return error('Demasiados intentos. Solicita un nuevo codigo.', 429)
      }

      // Mark OTP as verified
      await env.DB.prepare(`UPDATE otp_verifications SET verified_at = datetime('now') WHERE id = ?`)
        .bind(otp.id)
        .run()

      // Find or create user
      let user = await env.DB.prepare(`SELECT * FROM users WHERE phone = ?`).bind(phone).first<User>()

      let isNewUser = false
      if (!user) {
        isNewUser = true
        await env.DB.prepare(
          `INSERT INTO users (phone, phone_verified, created_at, updated_at) VALUES (?, 1, datetime('now'), datetime('now'))`
        )
          .bind(phone)
          .run()

        user = await env.DB.prepare(`SELECT * FROM users WHERE phone = ?`).bind(phone).first<User>()
      } else {
        // Update phone_verified
        await env.DB.prepare(
          `UPDATE users SET phone_verified = 1, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(user.id)
          .run()
      }

      // Create session
      const sessionToken = generateSessionToken()
      const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

      await env.DB.prepare(
        `INSERT INTO sessions (user_id, token, expires_at, created_at, last_used_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`
      )
        .bind(user!.id, sessionToken, sessionExpires)
        .run()

      return json({
        success: true,
        token: sessionToken,
        user: {
          id: user!.id,
          phone: user!.phone,
          displayName: user!.display_name,
          coupleId: user!.couple_id,
        },
        isNewUser,
      })
    }

    // Get current user
    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      const token = getAuthToken(request)
      if (!token) {
        return error('No autorizado', 401)
      }

      const user = await getSessionUser(env, token)
      if (!user) {
        return error('Sesion invalida', 401)
      }

      // Get partner info if coupled
      let partner = null
      if (user.couple_id) {
        partner = await env.DB.prepare(
          `SELECT id, phone, display_name FROM users
           WHERE couple_id = ? AND id != ?`
        )
          .bind(user.couple_id, user.id)
          .first()
      }

      return json({
        user: {
          id: user.id,
          phone: user.phone,
          displayName: user.display_name,
          coupleId: user.couple_id,
        },
        partner,
      })
    }

    // Logout
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const token = getAuthToken(request)
      if (token) {
        await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run()
      }
      return json({ success: true })
    }

    // =====================
    // USER ENDPOINTS
    // =====================

    // Update user profile
    if (url.pathname === '/api/users/me' && request.method === 'PATCH') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      const body = (await request.json()) as { displayName?: string }

      if (body.displayName !== undefined) {
        await env.DB.prepare(
          `UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(body.displayName, user.id)
          .run()
      }

      return json({ success: true })
    }

    // =====================
    // CONVERSATION ENDPOINTS
    // =====================

    // List user's conversations
    if (url.pathname === '/api/conversations' && request.method === 'GET') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      // Get conversations where user is owner or participant
      const conversations = await env.DB.prepare(
        `SELECT DISTINCT c.*,
          (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.created_at > COALESCE((SELECT last_read_at FROM conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = ?), '1970-01-01')) as unread_count
         FROM conversations c
         LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE c.owner_id = ? OR cp.user_id = ?
         ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`
      )
        .bind(user.id, user.id, user.id)
        .all()

      return json({ conversations: conversations.results })
    }

    // Create new conversation
    if (url.pathname === '/api/conversations' && request.method === 'POST') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      const body = (await request.json()) as {
        type?: 'private_ai' | 'couple_ai' | 'couple_direct'
        title?: string
      }

      const conversationType = body.type || 'private_ai'
      const title = body.title || null

      // For couple conversations, verify user is in a couple
      if ((conversationType === 'couple_ai' || conversationType === 'couple_direct') && !user.couple_id) {
        return error('Necesitas estar en pareja para crear esta conversacion', 400)
      }

      // Create conversation
      const result = await env.DB.prepare(
        `INSERT INTO conversations (conversation_type, owner_id, couple_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
        .bind(conversationType, user.id, user.couple_id || null, title)
        .run()

      const conversationId = result.meta.last_row_id

      // Add owner as participant
      await env.DB.prepare(
        `INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at)
         VALUES (?, ?, 'owner', datetime('now'))`
      )
        .bind(conversationId, user.id)
        .run()

      // For couple conversations, add partner
      if (user.couple_id && conversationType !== 'private_ai') {
        const partner = await env.DB.prepare(
          `SELECT id FROM users WHERE couple_id = ? AND id != ?`
        )
          .bind(user.couple_id, user.id)
          .first<{ id: number }>()

        if (partner) {
          await env.DB.prepare(
            `INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at)
             VALUES (?, ?, 'member', datetime('now'))`
          )
            .bind(conversationId, partner.id)
            .run()
        }
      }

      return json({
        id: conversationId,
        type: conversationType,
        title,
        created_at: new Date().toISOString(),
      })
    }

    // Get messages for a conversation
    const messagesMatch = url.pathname.match(/^\/api\/conversations\/(\d+)\/messages$/)
    if (messagesMatch && request.method === 'GET') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      const conversationId = parseInt(messagesMatch[1])
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const before = url.searchParams.get('before') // message ID for pagination

      // Verify user has access to conversation
      const hasAccess = await env.DB.prepare(
        `SELECT 1 FROM conversations c
         LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE c.id = ? AND (c.owner_id = ? OR cp.user_id = ?)`
      )
        .bind(conversationId, user.id, user.id)
        .first()

      if (!hasAccess) {
        return error('No tienes acceso a esta conversacion', 403)
      }

      // Get messages
      let query = `SELECT m.*, u.display_name as sender_name, u.phone as sender_phone
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ? AND m.deleted_at IS NULL`

      const params: (string | number)[] = [conversationId]

      if (before) {
        query += ` AND m.id < ?`
        params.push(parseInt(before))
      }

      query += ` ORDER BY m.created_at DESC LIMIT ?`
      params.push(limit)

      const messages = await env.DB.prepare(query).bind(...params).all()

      // Update last_read_at for this user
      await env.DB.prepare(
        `UPDATE conversation_participants SET last_read_at = datetime('now')
         WHERE conversation_id = ? AND user_id = ?`
      )
        .bind(conversationId, user.id)
        .run()

      return json({
        messages: messages.results.reverse(), // Return in chronological order
        hasMore: messages.results.length === limit,
      })
    }

    // Send message to a conversation
    if (messagesMatch && request.method === 'POST') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      const conversationId = parseInt(messagesMatch[1])
      const body = (await request.json()) as { content: string }

      if (!body.content?.trim()) {
        return error('El mensaje no puede estar vacio')
      }

      // Verify user has access
      const conversation = await env.DB.prepare(
        `SELECT c.* FROM conversations c
         LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE c.id = ? AND (c.owner_id = ? OR cp.user_id = ?)`
      )
        .bind(conversationId, user.id, user.id)
        .first<{ id: number; conversation_type: string; couple_id: number | null }>()

      if (!conversation) {
        return error('No tienes acceso a esta conversacion', 403)
      }

      // Insert user message
      const userMsgResult = await env.DB.prepare(
        `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, created_at)
         VALUES (?, ?, 'user', ?, 'text', datetime('now'))`
      )
        .bind(conversationId, user.id, body.content.trim())
        .run()

      const userMessageId = userMsgResult.meta.last_row_id

      // Update conversation last_message_at
      await env.DB.prepare(
        `UPDATE conversations SET last_message_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(conversationId)
        .run()

      // For AI conversations, generate AI response
      let aiMessage = null
      if (conversation.conversation_type === 'private_ai' || conversation.conversation_type === 'couple_ai') {
        // Get conversation history for context
        const history = await env.DB.prepare(
          `SELECT sender_type, content FROM messages
           WHERE conversation_id = ? AND deleted_at IS NULL
           ORDER BY created_at DESC LIMIT 20`
        )
          .bind(conversationId)
          .all<{ sender_type: string; content: string }>()

        const messagesForAI = [
          { role: 'system' as const, content: SYSTEM_PROMPT },
          ...history.results.reverse().map((m) => ({
            role: (m.sender_type === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: m.content,
          })),
        ]

        const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: messagesForAI,
          max_tokens: 500,
        })

        const aiContent = (aiResponse as { response: string }).response

        // Insert AI message
        const aiMsgResult = await env.DB.prepare(
          `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, created_at)
           VALUES (?, NULL, 'ai', ?, 'text', datetime('now'))`
        )
          .bind(conversationId, aiContent)
          .run()

        // Update conversation last_message_at again
        await env.DB.prepare(
          `UPDATE conversations SET last_message_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ?`
        )
          .bind(conversationId)
          .run()

        aiMessage = {
          id: aiMsgResult.meta.last_row_id,
          sender_type: 'ai',
          content: aiContent,
          created_at: new Date().toISOString(),
        }
      }

      return json({
        userMessage: {
          id: userMessageId,
          sender_type: 'user',
          sender_id: user.id,
          content: body.content.trim(),
          created_at: new Date().toISOString(),
        },
        aiMessage,
      })
    }

    // =====================
    // LEGACY ENDPOINTS
    // =====================

    // Chat endpoint (legacy - works without auth for landing page)
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const { messages } = (await request.json()) as { messages: Message[] }

      const messagesWithSystem = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ]

      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: messagesWithSystem,
        max_tokens: 500,
      })

      const aiMessage = (response as { response: string }).response

      return json({ message: aiMessage })
    }

    // Lead signup endpoint (legacy)
    if (url.pathname === '/api/signup' && request.method === 'POST') {
      const { email, name, diagnosticData } = (await request.json()) as {
        email: string
        name: string
        diagnosticData?: string
      }

      if (!email || !email.includes('@')) {
        return error('Email invalido')
      }

      await env.DB.prepare(
        'INSERT INTO leads (email, name, diagnostic_data, created_at) VALUES (?, ?, ?, datetime("now"))'
      )
        .bind(email, name || '', diagnosticData || '')
        .run()

      return json({ success: true })
    }

    // Health check
    if (url.pathname === '/api/health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() })
    }

    return error('Not found', 404)
  } catch (err) {
    console.error('API Error:', err)
    return json({ error: 'Internal server error', details: String(err) }, 500)
  }
}
