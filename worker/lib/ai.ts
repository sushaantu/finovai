import {
  asRecord,
} from './shared'
import type {
  Env,
  Message,
} from './shared'

const LOCAL_AI_FALLBACK =
  'Estoy corriendo en modo local. La IA real necesita Cloudflare AI Gateway o ANTHROPIC_API_KEY para ejecutarse, pero puedes probar la interfaz, el registro por correo y el flujo del producto.'

const DEFAULT_PRODUCT_CHAT_MODEL = 'claude-opus-4-8'

const DEFAULT_COMPAT_CHAT_MODEL = 'anthropic/claude-opus-4-7'

const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '711cb78717605db93e601e6a06e7eeec'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

const ANTHROPIC_API_VERSION = '2023-06-01'

export function getProductChatModel(env: Pick<Env, 'ANTHROPIC_CHAT_MODEL' | 'ANTHROPIC_MODEL'>): string {
  return env.ANTHROPIC_CHAT_MODEL?.trim() || env.ANTHROPIC_MODEL?.trim() || DEFAULT_PRODUCT_CHAT_MODEL
}

export function getGatewayCompatChatModel(env: Pick<Env, 'CLOUDFLARE_AI_GATEWAY_COMPAT_MODEL'>): string {
  return env.CLOUDFLARE_AI_GATEWAY_COMPAT_MODEL?.trim() || DEFAULT_COMPAT_CHAT_MODEL
}

export function getDashboardChatModel(
  env: Pick<
    Env,
    | 'ANTHROPIC_CHAT_MODEL'
    | 'ANTHROPIC_MODEL'
    | 'CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT'
    | 'CLOUDFLARE_AI_GATEWAY_COMPAT_MODEL'
  >
): string {
  if (env.CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT?.trim()) return getGatewayCompatChatModel(env)
  return getProductChatModel(env)
}

function buildAnthropicMessagePayload(messages: Message[]) {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n')
  const chatMessages = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))

  return { system, messages: chatMessages }
}

function buildCompatChatCompletionMessages(messages: Message[]) {
  return messages
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
    .filter((message) => message.content.trim())
}

function extractAnthropicResponseText(data: unknown): string | null {
  const record = asRecord(data)
  if (!record) return null

  const content = Array.isArray(record.content) ? record.content : []
  const parts = content
    .map((part) => {
      const partRecord = asRecord(part)
      return typeof partRecord?.text === 'string' ? partRecord.text : ''
    })
    .filter(Boolean)

  return parts.join('\n').trim() || null
}

function extractCompatContentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (typeof part === 'string') return part
      const partRecord = asRecord(part)
      return typeof partRecord?.text === 'string' ? partRecord.text : ''
    })
    .filter(Boolean)
    .join('\n')
}

function extractCompatChatCompletionText(data: unknown): string | null {
  const record = asRecord(data)
  if (!record) return null

  const choices = Array.isArray(record.choices) ? record.choices : []
  for (const choice of choices) {
    const choiceRecord = asRecord(choice)
    const message = asRecord(choiceRecord?.message)
    const delta = asRecord(choiceRecord?.delta)
    const text = extractCompatContentText(message?.content || delta?.content).trim()
    if (text) return text
  }

  return null
}

function getCloudflareAIGatewayUrl(env: Env): string | null {
  const gatewayId = env.CLOUDFLARE_AI_GATEWAY_ID?.trim()
  if (!gatewayId) return null

  const accountId = env.CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID?.trim() || DEFAULT_CLOUDFLARE_ACCOUNT_ID
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/anthropic/v1/messages`
}

function getCloudflareAIGatewayCompatEndpoint(env: Env): string | null {
  return env.CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT?.trim() || null
}

function getGatewayCompatRequestConfig(env: Env): { url: string; headers: Record<string, string> } | null {
  const url = getCloudflareAIGatewayCompatEndpoint(env)
  if (!url) return null

  const gatewayToken = env.CLOUDFLARE_AI_GATEWAY_TOKEN?.trim()
  const providerApiKey = env.ANTHROPIC_API_KEY?.trim()
  if (!gatewayToken && !providerApiKey) return null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const byokAlias = env.CLOUDFLARE_AI_GATEWAY_BYOK_ALIAS?.trim()
  if (gatewayToken) headers['cf-aig-authorization'] = `Bearer ${gatewayToken}`
  if (byokAlias) headers['cf-aig-byok-alias'] = byokAlias
  if (!gatewayToken && providerApiKey) headers.Authorization = `Bearer ${providerApiKey}`

  return { url, headers }
}

function getAnthropicRequestConfig(env: Env): { url: string; headers: Record<string, string> } | null {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': ANTHROPIC_API_VERSION,
  }
  const gatewayUrl = getCloudflareAIGatewayUrl(env)

  if (gatewayUrl) {
    const gatewayToken = env.CLOUDFLARE_AI_GATEWAY_TOKEN?.trim()
    const byokAlias = env.CLOUDFLARE_AI_GATEWAY_BYOK_ALIAS?.trim()
    if (!gatewayToken && !env.ANTHROPIC_API_KEY) return null
    if (gatewayToken) headers['cf-aig-authorization'] = `Bearer ${gatewayToken}`
    if (byokAlias) headers['cf-aig-byok-alias'] = byokAlias
    if (!gatewayToken && env.ANTHROPIC_API_KEY) headers['x-api-key'] = env.ANTHROPIC_API_KEY
    return { url: gatewayUrl, headers }
  }

  if (!env.ANTHROPIC_API_KEY) return null
  headers['x-api-key'] = env.ANTHROPIC_API_KEY
  return { url: ANTHROPIC_MESSAGES_URL, headers }
}

async function runCompatAIResponse(
  env: Env,
  messages: Message[],
  requestConfig: { url: string; headers: Record<string, string> },
  maxTokens = 700
): Promise<string> {
  const response = await fetch(requestConfig.url, {
    method: 'POST',
    headers: requestConfig.headers,
    body: JSON.stringify({
      model: getGatewayCompatChatModel(env),
      max_tokens: maxTokens,
      messages: buildCompatChatCompletionMessages(messages),
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = asRecord(asRecord(data)?.error)
    const message = typeof error?.message === 'string' ? error.message : 'Cloudflare AI Gateway no respondió correctamente.'
    throw new Error(message)
  }

  const answer = extractCompatChatCompletionText(data)
  if (!answer) {
    throw new Error('Cloudflare AI Gateway respondió sin texto.')
  }

  return answer
}

export async function runAIResponse(env: Env, messages: Message[], allowLocalFallback: boolean, maxTokens = 700): Promise<string> {
  const compatEndpoint = getCloudflareAIGatewayCompatEndpoint(env)
  if (compatEndpoint) {
    const requestConfig = getGatewayCompatRequestConfig(env)
    if (!requestConfig) {
      if (allowLocalFallback) return LOCAL_AI_FALLBACK
      throw new Error('CLOUDFLARE_AI_GATEWAY_COMPAT_ENDPOINT needs CLOUDFLARE_AI_GATEWAY_TOKEN or ANTHROPIC_API_KEY')
    }
    return runCompatAIResponse(env, messages, requestConfig, maxTokens)
  }

  const requestConfig = getAnthropicRequestConfig(env)
  if (!requestConfig) {
    if (allowLocalFallback) return LOCAL_AI_FALLBACK
    throw new Error('CLOUDFLARE_AI_GATEWAY_ID with CLOUDFLARE_AI_GATEWAY_TOKEN, or ANTHROPIC_API_KEY, is not configured')
  }

  const { system, messages: anthropicMessages } = buildAnthropicMessagePayload(messages)
  const response = await fetch(requestConfig.url, {
    method: 'POST',
    headers: requestConfig.headers,
    body: JSON.stringify({
      model: getProductChatModel(env),
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: anthropicMessages,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const errorRecord = asRecord(asRecord(data)?.error)
    const message = typeof errorRecord?.message === 'string' ? errorRecord.message : 'Anthropic no respondió correctamente.'
    throw new Error(message)
  }

  const answer = extractAnthropicResponseText(data)
  if (!answer) {
    throw new Error('Anthropic respondió sin texto.')
  }

  return answer
}
