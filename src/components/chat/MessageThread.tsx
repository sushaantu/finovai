import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, Send, Loader2, Sparkles } from 'lucide-react'

interface Conversation {
  id: number
  conversation_type: string
  title: string | null
  last_message: string | null
  unread_count: number
  created_at: string
  last_message_at: string | null
}

interface Message {
  id: number
  sender_id: number | null
  sender_type: 'user' | 'ai' | 'system'
  sender_name?: string | null
  content: string
  created_at: string
}

interface MessageThreadProps {
  conversation: Conversation
  token: string
  onBack: () => void
  onConversationUpdate: (conv: Conversation) => void
}

const INITIAL_AI_MESSAGE = `¡Hola! Soy el asistente de FinovAI.

Estoy aquí para ayudarte a entender tu situación financiera actual y ver cómo podemos ayudarte a ordenar tu casa financiera.

Para empezar, cuéntame: **¿Cómo describirías tu relación actual con el dinero?**`

export default function MessageThread({
  conversation,
  token,
  onBack,
  onConversationUpdate,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchMessages()
  }, [conversation.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages)
        setHasMore(data.hasMore)

        // If no messages, show initial AI greeting
        if (data.messages.length === 0) {
          setMessages([
            {
              id: 0,
              sender_id: null,
              sender_type: 'ai',
              content: INITIAL_AI_MESSAGE,
              created_at: new Date().toISOString(),
            },
          ])
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSending) return

    const messageContent = input.trim()
    setInput('')
    setIsSending(true)

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: Date.now(),
      sender_id: null,
      sender_type: 'user',
      content: messageContent,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: messageContent }),
      })

      if (response.ok) {
        const data = await response.json()

        // Update with real IDs
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempUserMsg.id
              ? { ...m, id: data.userMessage.id, sender_id: data.userMessage.sender_id }
              : m
          )
        )

        // Add AI response if present
        if (data.aiMessage) {
          setMessages((prev) => [
            ...prev,
            {
              id: data.aiMessage.id,
              sender_id: null,
              sender_type: 'ai',
              content: data.aiMessage.content,
              created_at: data.aiMessage.created_at,
            },
          ])
        }

        // Update conversation last message
        onConversationUpdate({
          ...conversation,
          last_message: data.aiMessage?.content || messageContent,
          last_message_at: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
      setInput(messageContent) // Restore input
    } finally {
      setIsSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getConversationTitle = () => {
    if (conversation.title) return conversation.title
    switch (conversation.conversation_type) {
      case 'couple_ai':
        return 'Chat de pareja con FinovAI'
      case 'couple_direct':
        return 'Chat con tu pareja'
      default:
        return 'Chat con FinovAI'
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Sparkles className="size-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">{getConversationTitle()}</h3>
            <p className="text-xs text-zinc-500">FinovAI siempre disponible</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index < 3 ? index * 0.1 : 0 }}
                className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.sender_type === 'user'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/5 text-zinc-300'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </p>
                  <p
                    className={`mt-1 text-[10px] ${
                      message.sender_type === 'user' ? 'text-emerald-200' : 'text-zinc-500'
                    }`}
                  >
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </motion.div>
            ))}

            {/* Typing indicator when waiting for AI */}
            {isSending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="size-2 animate-bounce rounded-full bg-zinc-500" />
                    <span
                      className="size-2 animate-bounce rounded-full bg-zinc-500"
                      style={{ animationDelay: '0.15s' }}
                    />
                    <span
                      className="size-2 animate-bounce rounded-full bg-zinc-500"
                      style={{ animationDelay: '0.3s' }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-white/10 p-4">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="flex size-12 items-center justify-center rounded-xl bg-emerald-500 text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-500"
          >
            {isSending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Send className="size-5" />
            )}
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-zinc-500">
          FinovAI puede cometer errores. Verifica la información importante.
        </p>
      </form>
    </div>
  )
}
