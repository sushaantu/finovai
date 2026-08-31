import {
  createDashboardClientSecret,
  ensureDashboardSessionTable,
  error,
  getAppOrigin,
  getDashboardClientSecret,
  isFeatureEnabled,
  isProductionEnv,
  json,
  normalizeSignupEmail,
  sha256Hex,
  timingSafeStringEqual,
  upsertLead,
  verifyDashboardEmailAccess,
} from '../lib/shared'
import type {
  EmailLoginChallengeRow,
  Env,
} from '../lib/shared'
import {
  ensureEmailAuthTables,
  getOrCreateUserByEmail,
} from '../lib/db'

const EMAIL_LOGIN_TOKEN_BYTES = 32

const EMAIL_LOGIN_TTL_SECONDS = 15 * 60

const EMAIL_LOGIN_MAX_ATTEMPTS = 5

async function issueDashboardEmailSession(env: Env, email: string): Promise<{ clientSecret: string }> {
  await ensureDashboardSessionTable(env)
  const user = await getOrCreateUserByEmail(env.DB, email)
  const clientSecret = createDashboardClientSecret()
  const clientSecretHash = await sha256Hex(clientSecret)
  await env.DB.prepare(
    `INSERT INTO dashboard_sessions (email, client_secret_hash, created_at, last_used_at, user_id)
     VALUES (?, ?, datetime("now"), datetime("now"), ?)
     ON CONFLICT(email) DO UPDATE SET
       client_secret_hash = excluded.client_secret_hash,
       last_used_at = datetime("now"),
       user_id = excluded.user_id`
  )
    .bind(email, clientSecretHash, user.id)
    .run()

  return { clientSecret }
}

async function createOrVerifyDashboardEmailSession(
  env: Env,
  request: Request,
  email: string
): Promise<{ ok: true; clientSecret?: string } | { ok: false; status: number; message: string }> {
  if (!isProductionEnv(env)) return { ok: true }

  const suppliedSecret = getDashboardClientSecret(request)
  if (suppliedSecret) {
    const verified = await verifyDashboardEmailAccess(env, request, email)
    if (verified.ok) return { ok: true }
  }

  return { ok: true, ...(await issueDashboardEmailSession(env, email)) }
}

function isEmailAuthRequired(env: Env): boolean {
  return isProductionEnv(env) && isFeatureEnabled(env.EMAIL_AUTH_REQUIRED)
}

function createEmailLoginCode(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const value = new DataView(bytes.buffer).getUint32(0)
  return String(value % 1_000_000).padStart(6, '0')
}

function normalizeRedirectPath(value: unknown): string {
  if (typeof value !== 'string') return '/dashboard'
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/dashboard'
  return trimmed.slice(0, 120)
}

function buildLoginLink(env: Env, request: Request, email: string, token: string, redirectPath: string): string {
  const loginUrl = new URL(redirectPath, getAppOrigin(env, request))
  loginUrl.searchParams.set('email', email)
  loginUrl.searchParams.set('login_token', token)
  return loginUrl.toString()
}

async function sendDashboardLoginEmail(env: Env, email: string, code: string, loginLink: string): Promise<void> {
  if (!env.EMAIL) {
    throw new Error('Cloudflare Email Sending is not configured')
  }

  const fromEmail = env.EMAIL_FROM || 'noreply@mail.finov.ai'
  const text = [
    'Tu acceso a FinovAI',
    '',
    `Código: ${code}`,
    '',
    `También puedes entrar con este enlace: ${loginLink}`,
    '',
    'Este acceso vence en 15 minutos. Si no lo pediste, ignora este correo.',
  ].join('\n')

  await env.EMAIL.send({
    to: email,
    from: { email: fromEmail, name: 'FinovAI' },
    replyTo: fromEmail,
    subject: 'Tu acceso a FinovAI',
    text,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#071326">
        <h1 style="font-size:20px">Tu acceso a FinovAI</h1>
        <p>Usa este código para entrar:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
        <p><a href="${loginLink}">Entrar a FinovAI</a></p>
        <p style="color:#536275">Este acceso vence en 15 minutos. Si no lo pediste, ignora este correo.</p>
      </div>
    `,
  })
}

async function createEmailLoginChallenge(
  env: Env,
  request: Request,
  email: string,
  source: string,
  redirectPath: string
): Promise<{ id: string; debugCode?: string; debugToken?: string }> {
  await ensureEmailAuthTables(env)
  const id = crypto.randomUUID()
  const token = createDashboardClientSecret()
  const code = createEmailLoginCode()
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + EMAIL_LOGIN_TTL_SECONDS
  const tokenHash = await sha256Hex(token)
  const codeHash = await sha256Hex(code)
  const normalizedRedirectPath = normalizeRedirectPath(redirectPath)

  await env.DB.prepare(
    `INSERT INTO email_login_challenges (
      id, email, token_hash, code_hash, source, redirect_path, attempts, created_at, expires_at, consumed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`
  )
    .bind(id, email, tokenHash, codeHash, source, normalizedRedirectPath, now, expiresAt)
    .run()

  if (env.EMAIL) {
    await sendDashboardLoginEmail(env, email, code, buildLoginLink(env, request, email, token, normalizedRedirectPath))
    return { id }
  }

  if (new URL(request.url).hostname === 'localhost' || new URL(request.url).hostname === '127.0.0.1') {
    return { id, debugCode: code, debugToken: token }
  }

  throw new Error('Cloudflare Email Sending is not configured')
}

async function findEmailLoginChallenge(
  env: Env,
  email: string,
  input: { code?: string; token?: string }
): Promise<{ ok: true; challenge: EmailLoginChallengeRow } | { ok: false; status: number; message: string }> {
  await ensureEmailAuthTables(env)
  const now = Math.floor(Date.now() / 1000)

  if (input.token) {
    const tokenHash = await sha256Hex(input.token)
    const challenge = await env.DB.prepare(
      `SELECT * FROM email_login_challenges
       WHERE email = ? AND token_hash = ? AND consumed_at IS NULL AND expires_at > ?
       LIMIT 1`
    )
      .bind(email, tokenHash, now)
      .first<EmailLoginChallengeRow>()

    return challenge
      ? { ok: true, challenge }
      : { ok: false, status: 401, message: 'El enlace de acceso expiró o no es válido.' }
  }

  if (!input.code) {
    return { ok: false, status: 400, message: 'Código o enlace requerido.' }
  }

  const challenge = await env.DB.prepare(
    `SELECT * FROM email_login_challenges
     WHERE email = ? AND consumed_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(email, now)
    .first<EmailLoginChallengeRow>()

  if (!challenge) {
    return { ok: false, status: 401, message: 'El código expiró o no es válido.' }
  }
  if (challenge.attempts >= EMAIL_LOGIN_MAX_ATTEMPTS) {
    return { ok: false, status: 429, message: 'Demasiados intentos. Pide un nuevo código.' }
  }

  const suppliedHash = await sha256Hex(input.code)
  if (!(await timingSafeStringEqual(suppliedHash, challenge.code_hash))) {
    await env.DB.prepare(`UPDATE email_login_challenges SET attempts = attempts + 1 WHERE id = ?`)
      .bind(challenge.id)
      .run()
    return { ok: false, status: 401, message: 'Código incorrecto.' }
  }

  return { ok: true, challenge }
}

async function verifyEmailLoginChallenge(
  env: Env,
  email: string,
  input: { code?: string; token?: string }
): Promise<{ ok: true; clientSecret: string } | { ok: false; status: number; message: string }> {
  const result = await findEmailLoginChallenge(env, email, input)
  if (!result.ok) return result

  await env.DB.prepare(`UPDATE email_login_challenges SET consumed_at = ? WHERE id = ?`)
    .bind(Math.floor(Date.now() / 1000), result.challenge.id)
    .run()

  return { ok: true, ...(await issueDashboardEmailSession(env, email)) }
}

export async function handleAuthRoutes(request: Request, env: Env, url: URL): Promise<Response | null> {
    if ((url.pathname === '/api/signup' || url.pathname === '/api/auth/request-link') && request.method === 'POST') {
      const { email, name, diagnosticData, source, redirectPath } = (await request.json()) as {
        email: string
        name?: string
        diagnosticData?: string
        source?: string
        redirectPath?: string
      }

      const normalizedEmail = normalizeSignupEmail(email)
      if (!normalizedEmail) {
        return error('Correo inválido')
      }

      await getOrCreateUserByEmail(env.DB, normalizedEmail)

      if (url.pathname === '/api/auth/request-link' || isEmailAuthRequired(env)) {
        let challenge: { debugCode?: string; debugToken?: string }
        try {
          challenge = await createEmailLoginChallenge(
            env,
            request,
            normalizedEmail,
            source || 'email-auth',
            redirectPath || '/dashboard'
          )
        } catch (challengeError) {
          console.error('Email auth challenge failed:', challengeError)
          return error('Correo transaccional no configurado. Activa el envío de correo de Cloudflare para mail.finov.ai.', 503)
        }

        await upsertLead(env, normalizedEmail, name, diagnosticData)

        return json({
          success: true,
          email: normalizedEmail,
          verificationRequired: true,
          expiresInSeconds: EMAIL_LOGIN_TTL_SECONDS,
          debugCode: challenge.debugCode,
          debugToken: challenge.debugToken,
        })
      }

      const access = await createOrVerifyDashboardEmailSession(env, request, normalizedEmail)
      if (!access.ok) return error(access.message, access.status)

      await upsertLead(env, normalizedEmail, name, diagnosticData)

      return json({ success: true, email: normalizedEmail, clientSecret: access.clientSecret })
    }

    if (url.pathname === '/api/auth/verify' && request.method === 'POST') {
      const { email, code, token, source } = (await request.json()) as {
        email?: string
        code?: string
        token?: string
        source?: string
      }
      const normalizedEmail = normalizeSignupEmail(email)
      if (!normalizedEmail) {
        return error('Correo inválido')
      }

      await getOrCreateUserByEmail(env.DB, normalizedEmail)

      const verified = await verifyEmailLoginChallenge(env, normalizedEmail, {
        code: typeof code === 'string' ? code.trim() : undefined,
        token: typeof token === 'string' ? token.trim() : undefined,
      })
      if (!verified.ok) return error(verified.message, verified.status)

      await upsertLead(env, normalizedEmail, '', JSON.stringify({
        source: source || 'email-auth-verified',
        verifiedAt: new Date().toISOString(),
      }))

      return json({ success: true, email: normalizedEmail, clientSecret: verified.clientSecret })
    }

  return null
}
