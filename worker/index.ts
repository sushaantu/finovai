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

interface ButtonOption {
  label: string
  value: string
  variant?: 'primary' | 'secondary'
}

interface QuizQuestion {
  id: string
  text: string
  options: { value: number; label: string }[]
}

// =====================
// QUIZ CONFIGURATION
// =====================

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'income_tracking',
    text: '¿Sabes exactamente cuánto dinero entra cada mes?',
    options: [
      { value: 3, label: 'Sí, al centavo' },
      { value: 2, label: 'Más o menos' },
      { value: 1, label: 'No realmente' },
      { value: 0, label: 'No tengo idea' },
    ],
  },
  {
    id: 'expense_tracking',
    text: '¿Sabes en qué se va tu dinero cada mes?',
    options: [
      { value: 3, label: 'Sí, tengo todo categorizado' },
      { value: 2, label: 'Tengo una idea general' },
      { value: 1, label: 'Solo las cosas grandes' },
      { value: 0, label: 'El dinero desaparece' },
    ],
  },
  {
    id: 'savings',
    text: '¿Logras ahorrar algo cada mes?',
    options: [
      { value: 3, label: 'Sí, automáticamente' },
      { value: 2, label: 'A veces, cuando puedo' },
      { value: 1, label: 'Rara vez' },
      { value: 0, label: 'No me queda nada' },
    ],
  },
  {
    id: 'emergency_fund',
    text: '¿Tienes un fondo de emergencia?',
    options: [
      { value: 3, label: 'Sí, más de 3 meses de gastos' },
      { value: 2, label: 'Algo, pero no suficiente' },
      { value: 1, label: 'Muy poco' },
      { value: 0, label: 'No tengo nada guardado' },
    ],
  },
  {
    id: 'debt',
    text: '¿Cómo está tu situación de deudas?',
    options: [
      { value: 3, label: 'No tengo deudas / solo hipoteca' },
      { value: 2, label: 'Deudas controladas, pago a tiempo' },
      { value: 1, label: 'Tengo deudas que me cuestan' },
      { value: 0, label: 'Las deudas me abruman' },
    ],
  },
]

function getScoreResult(score: number): { stage: string; message: string; color: string } {
  if (score >= 70) {
    return {
      stage: 'Etapa 2',
      message: 'Estás listo para invertir con sistema. Tu base financiera es sólida.',
      color: 'emerald',
    }
  }
  if (score >= 40) {
    return {
      stage: 'Etapa 1',
      message: 'Tienes base, pero necesitas crear más margen antes de invertir.',
      color: 'amber',
    }
  }
  return {
    stage: 'Etapa 0',
    message: 'Empecemos ordenando tu casa financiera. Es el primer paso hacia la libertad.',
    color: 'violet',
  }
}

function questionToButtons(question: QuizQuestion): ButtonOption[] {
  return question.options.map((opt, idx) => ({
    label: opt.label,
    value: `quiz_answer_${question.id}_${opt.value}`,
    variant: idx === 0 ? 'primary' : 'secondary' as 'primary' | 'secondary',
  }))
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
  let normalized = phone.replace(/[^\d+]/g, '')
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized
  }
  return normalized
}

async function sendWhatsAppOTP(env: Env, phone: string, code: string): Promise<boolean> {
  if (!env.KAPSO_API_KEY || !env.KAPSO_PHONE_NUMBER_ID) {
    console.log('Kapso not configured, OTP code:', code)
    return true
  }

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
      console.error('Kapso API error:', await response.text())
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
// QUIZ STATE MANAGEMENT
// =====================

interface QuizState {
  active: boolean
  currentQuestion: number
  answers: Record<string, number>
}

async function getQuizState(env: Env, conversationId: number): Promise<QuizState> {
  const result = await env.DB.prepare(
    `SELECT metadata FROM conversations WHERE id = ?`
  )
    .bind(conversationId)
    .first<{ metadata: string | null }>()

  if (result?.metadata) {
    try {
      const data = JSON.parse(result.metadata)
      return data.quiz || { active: false, currentQuestion: 0, answers: {} }
    } catch {
      return { active: false, currentQuestion: 0, answers: {} }
    }
  }
  return { active: false, currentQuestion: 0, answers: {} }
}

async function updateQuizState(env: Env, conversationId: number, quizState: QuizState): Promise<void> {
  const result = await env.DB.prepare(
    `SELECT metadata FROM conversations WHERE id = ?`
  )
    .bind(conversationId)
    .first<{ metadata: string | null }>()

  let metadata: Record<string, unknown> = {}
  if (result?.metadata) {
    try {
      metadata = JSON.parse(result.metadata)
    } catch {
      metadata = {}
    }
  }

  metadata.quiz = quizState

  await env.DB.prepare(
    `UPDATE conversations SET metadata = ? WHERE id = ?`
  )
    .bind(JSON.stringify(metadata), conversationId)
    .run()
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
5. Cuando tengas suficiente información, invitar a profundizar

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

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url)
    }

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

    if (url.pathname === '/api/auth/send-otp' && request.method === 'POST') {
      const body = (await request.json()) as { phone: string }
      const phone = normalizePhone(body.phone)

      if (!phone || phone.length < 10) {
        return error('Numero de telefono invalido')
      }

      const recentOTP = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM otp_verifications
         WHERE phone = ? AND created_at > datetime('now', '-1 minute')`
      )
        .bind(phone)
        .first<{ count: number }>()

      if (recentOTP && recentOTP.count >= 1) {
        return error('Espera un minuto antes de solicitar otro codigo', 429)
      }

      const otpCode = generateOTP()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

      await env.DB.prepare(
        `INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at, created_at)
         VALUES (?, ?, 'login', ?, datetime('now'))`
      )
        .bind(phone, otpCode, expiresAt)
        .run()

      const sent = await sendWhatsAppOTP(env, phone, otpCode)
      if (!sent) {
        return error('Error enviando codigo. Intenta de nuevo.', 500)
      }

      return json({ success: true, expiresIn: 300 })
    }

    if (url.pathname === '/api/auth/verify-otp' && request.method === 'POST') {
      const body = (await request.json()) as { phone: string; code: string }
      const phone = normalizePhone(body.phone)
      const code = body.code?.trim()

      if (!phone || !code) {
        return error('Telefono y codigo son requeridos')
      }

      const otp = await env.DB.prepare(
        `SELECT * FROM otp_verifications
         WHERE phone = ? AND otp_code = ? AND expires_at > datetime('now') AND verified_at IS NULL
         ORDER BY created_at DESC LIMIT 1`
      )
        .bind(phone, code)
        .first<{ id: number; attempts: number }>()

      if (!otp) {
        await env.DB.prepare(
          `UPDATE otp_verifications SET attempts = attempts + 1
           WHERE phone = ? AND expires_at > datetime('now') AND verified_at IS NULL`
        )
          .bind(phone)
          .run()

        return error('Codigo invalido o expirado', 401)
      }

      if (otp.attempts >= 3) {
        return error('Demasiados intentos. Solicita un nuevo codigo.', 429)
      }

      await env.DB.prepare(`UPDATE otp_verifications SET verified_at = datetime('now') WHERE id = ?`)
        .bind(otp.id)
        .run()

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
        await env.DB.prepare(
          `UPDATE users SET phone_verified = 1, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(user.id)
          .run()
      }

      const sessionToken = generateSessionToken()
      const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

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

    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      let partner = null
      if (user.couple_id) {
        partner = await env.DB.prepare(
          `SELECT id, phone, display_name FROM users WHERE couple_id = ? AND id != ?`
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

    if (url.pathname === '/api/conversations' && request.method === 'GET') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

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

      if ((conversationType === 'couple_ai' || conversationType === 'couple_direct') && !user.couple_id) {
        return error('Necesitas estar en pareja para crear esta conversacion', 400)
      }

      const result = await env.DB.prepare(
        `INSERT INTO conversations (conversation_type, owner_id, couple_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
        .bind(conversationType, user.id, user.couple_id || null, title)
        .run()

      const conversationId = result.meta.last_row_id

      await env.DB.prepare(
        `INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at)
         VALUES (?, ?, 'owner', datetime('now'))`
      )
        .bind(conversationId, user.id)
        .run()

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

    const messagesMatch = url.pathname.match(/^\/api\/conversations\/(\d+)\/messages$/)
    
    if (messagesMatch && request.method === 'GET') {
      const token = getAuthToken(request)
      if (!token) return error('No autorizado', 401)

      const user = await getSessionUser(env, token)
      if (!user) return error('Sesion invalida', 401)

      const conversationId = parseInt(messagesMatch[1])
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const before = url.searchParams.get('before')

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

      await env.DB.prepare(
        `UPDATE conversation_participants SET last_read_at = datetime('now')
         WHERE conversation_id = ? AND user_id = ?`
      )
        .bind(conversationId, user.id)
        .run()

      return json({
        messages: messages.results.reverse(),
        hasMore: messages.results.length === limit,
      })
    }

    // Send message to a conversation (with quiz support)
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

      const messageContent = body.content.trim()

      // Insert user message
      const userMsgResult = await env.DB.prepare(
        `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, created_at)
         VALUES (?, ?, 'user', ?, 'text', datetime('now'))`
      )
        .bind(conversationId, user.id, messageContent)
        .run()

      const userMessageId = userMsgResult.meta.last_row_id

      await env.DB.prepare(
        `UPDATE conversations SET last_message_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(conversationId)
        .run()

      // Handle AI response for AI conversations
      let aiMessage = null
      if (conversation.conversation_type === 'private_ai' || conversation.conversation_type === 'couple_ai') {
        
        // Check for quiz commands
        if (messageContent === 'start_quiz') {
          // Start the quiz
          const quizState: QuizState = { active: true, currentQuestion: 0, answers: {} }
          await updateQuizState(env, conversationId, quizState)

          const firstQuestion = QUIZ_QUESTIONS[0]
          const buttons = questionToButtons(firstQuestion)

          const aiMsgResult = await env.DB.prepare(
            `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata, created_at)
             VALUES (?, NULL, 'ai', ?, 'buttons', ?, datetime('now'))`
          )
            .bind(
              conversationId,
              `¡Perfecto! Empecemos con tu diagnóstico financiero.\n\n**Pregunta 1 de ${QUIZ_QUESTIONS.length}:**\n${firstQuestion.text}`,
              JSON.stringify({ buttons })
            )
            .run()

          aiMessage = {
            id: aiMsgResult.meta.last_row_id,
            sender_type: 'ai',
            content: `¡Perfecto! Empecemos con tu diagnóstico financiero.\n\n**Pregunta 1 de ${QUIZ_QUESTIONS.length}:**\n${firstQuestion.text}`,
            message_type: 'buttons',
            metadata: JSON.stringify({ buttons }),
            created_at: new Date().toISOString(),
          }

        } else if (messageContent === 'skip_quiz') {
          // User skipped the quiz, continue with normal chat
          const aiContent = '¡Sin problema! Cuando quieras conocer tu índice financiero, solo dímelo.\n\n¿En qué puedo ayudarte hoy?'
          
          const aiMsgResult = await env.DB.prepare(
            `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, created_at)
             VALUES (?, NULL, 'ai', ?, 'text', datetime('now'))`
          )
            .bind(conversationId, aiContent)
            .run()

          aiMessage = {
            id: aiMsgResult.meta.last_row_id,
            sender_type: 'ai',
            content: aiContent,
            message_type: 'text',
            created_at: new Date().toISOString(),
          }

        } else if (messageContent.startsWith('quiz_answer_')) {
          // Handle quiz answer
          const quizState = await getQuizState(env, conversationId)
          
          if (quizState.active) {
            // Parse the answer: quiz_answer_{questionId}_{value}
            const parts = messageContent.replace('quiz_answer_', '').split('_')
            const answerValue = parseInt(parts[parts.length - 1])
            const questionId = parts.slice(0, -1).join('_')

            // Store answer
            quizState.answers[questionId] = answerValue
            quizState.currentQuestion++

            if (quizState.currentQuestion < QUIZ_QUESTIONS.length) {
              // Next question
              const nextQuestion = QUIZ_QUESTIONS[quizState.currentQuestion]
              const buttons = questionToButtons(nextQuestion)

              await updateQuizState(env, conversationId, quizState)

              const aiMsgResult = await env.DB.prepare(
                `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata, created_at)
                 VALUES (?, NULL, 'ai', ?, 'buttons', ?, datetime('now'))`
              )
                .bind(
                  conversationId,
                  `**Pregunta ${quizState.currentQuestion + 1} de ${QUIZ_QUESTIONS.length}:**\n${nextQuestion.text}`,
                  JSON.stringify({ buttons })
                )
                .run()

              aiMessage = {
                id: aiMsgResult.meta.last_row_id,
                sender_type: 'ai',
                content: `**Pregunta ${quizState.currentQuestion + 1} de ${QUIZ_QUESTIONS.length}:**\n${nextQuestion.text}`,
                message_type: 'buttons',
                metadata: JSON.stringify({ buttons }),
                created_at: new Date().toISOString(),
              }

            } else {
              // Quiz complete - calculate score
              const total = Object.values(quizState.answers).reduce((sum, val) => sum + val, 0)
              const maxPossible = QUIZ_QUESTIONS.length * 3
              const score = Math.round((total / maxPossible) * 100)
              const { stage, message, color } = getScoreResult(score)

              // Reset quiz state
              quizState.active = false
              await updateQuizState(env, conversationId, quizState)

              // Insert score result message
              const scoreResult = await env.DB.prepare(
                `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata, created_at)
                 VALUES (?, NULL, 'ai', ?, 'score_result', ?, datetime('now'))`
              )
                .bind(
                  conversationId,
                  `Tu Índice Financiero: ${score}/100`,
                  JSON.stringify({ score, stage, stageMessage: message, color })
                )
                .run()

              // Insert follow-up message with CTAs
              const ctaButtons: ButtonOption[] = [
                { label: '📋 Ver mi plan personalizado', value: 'view_plan', variant: 'primary' },
                { label: '💬 Hablar con un asesor', value: 'talk_advisor', variant: 'secondary' },
                { label: '🔄 Volver a hacer el test', value: 'start_quiz', variant: 'secondary' },
              ]

              const followUpResult = await env.DB.prepare(
                `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata, created_at)
                 VALUES (?, NULL, 'ai', ?, 'buttons', ?, datetime('now'))`
              )
                .bind(
                  conversationId,
                  '¿Qué te gustaría hacer ahora?',
                  JSON.stringify({ buttons: ctaButtons })
                )
                .run()

              aiMessage = {
                id: followUpResult.meta.last_row_id,
                sender_type: 'ai',
                content: '¿Qué te gustaría hacer ahora?',
                message_type: 'buttons',
                metadata: JSON.stringify({ buttons: ctaButtons }),
                created_at: new Date().toISOString(),
                // Include score result as a previous message
                _scoreResult: {
                  id: scoreResult.meta.last_row_id,
                  sender_type: 'ai',
                  content: `Tu Índice Financiero: ${score}/100`,
                  message_type: 'score_result',
                  metadata: JSON.stringify({ score, stage, stageMessage: message, color }),
                  created_at: new Date().toISOString(),
                },
              }
            }
          }

        } else if (messageContent === 'view_plan' || messageContent === 'talk_advisor') {
          // Handle CTA clicks
          const ctaResponse = messageContent === 'view_plan'
            ? '¡Excelente decisión! Basado en tu índice financiero, te recomendamos empezar con nuestro programa de orden financiero.\n\n📱 Pronto recibirás información sobre los siguientes pasos.\n\n¿Tienes alguna pregunta mientras tanto?'
            : '¡Perfecto! Un asesor de FinovAI se pondrá en contacto contigo pronto.\n\n📞 Mientras tanto, ¿hay algo específico que quieras preparar para la llamada?'

          const aiMsgResult = await env.DB.prepare(
            `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, created_at)
             VALUES (?, NULL, 'ai', ?, 'text', datetime('now'))`
          )
            .bind(conversationId, ctaResponse)
            .run()

          aiMessage = {
            id: aiMsgResult.meta.last_row_id,
            sender_type: 'ai',
            content: ctaResponse,
            message_type: 'text',
            created_at: new Date().toISOString(),
          }

        } else {
          // Regular AI conversation
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

          const aiMsgResult = await env.DB.prepare(
            `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, created_at)
             VALUES (?, NULL, 'ai', ?, 'text', datetime('now'))`
          )
            .bind(conversationId, aiContent)
            .run()

          aiMessage = {
            id: aiMsgResult.meta.last_row_id,
            sender_type: 'ai',
            content: aiContent,
            message_type: 'text',
            created_at: new Date().toISOString(),
          }
        }

        await env.DB.prepare(
          `UPDATE conversations SET last_message_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ?`
        )
          .bind(conversationId)
          .run()
      }

      return json({
        userMessage: {
          id: userMessageId,
          sender_type: 'user',
          sender_id: user.id,
          content: messageContent,
          message_type: 'text',
          created_at: new Date().toISOString(),
        },
        aiMessage,
      })
    }

    // =====================
    // LEGACY ENDPOINTS
    // =====================

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

    if (url.pathname === '/api/health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() })
    }

    return error('Not found', 404)
  } catch (err) {
    console.error('API Error:', err)
    return json({ error: 'Internal server error', details: String(err) }, 500)
  }
}
