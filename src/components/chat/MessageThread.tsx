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

interface ButtonOption {
  label: string
  value: string
  variant?: 'primary' | 'secondary'
}

interface Message {
  id: number
  sender_id: number | null
  sender_type: 'user' | 'ai' | 'system'
  sender_name?: string | null
  content: string
  message_type?: 'text' | 'buttons' | 'score_result'
  metadata?: string | null
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

¿Te gustaría conocer tu Índice Financiero? Es un diagnóstico rápido de 5 preguntas.`

const INITIAL_BUTTONS: ButtonOption[] = [
  { label: '✨ Sí, vamos', value: 'start_quiz', variant: 'primary' },
  { label: 'Tal vez después', value: 'skip_quiz', variant: 'secondary' },
]

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
  const [activeButtons, setActiveButtons] = useState<ButtonOption[] | null>(null)
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

        // If no messages, show initial AI greeting with buttons
        if (data.messages.length === 0) {
          setMessages([
            {
              id: 0,
              sender_id: null,
              sender_type: 'ai',
              content: INITIAL_AI_MESSAGE,
              message_type: 'text',
              created_at: new Date().toISOString(),
            },
          ])
          setActiveButtons(INITIAL_BUTTONS)
        } else {
          // Check if last AI message has buttons
          const lastAiMessage = [...data.messages].reverse().find((m: Message) => m.sender_type === 'ai')
          if (lastAiMessage?.message_type === 'buttons' && lastAiMessage.metadata) {
            try {
              const metadata = JSON.parse(lastAiMessage.metadata)
              if (metadata.buttons) {
                setActiveButtons(metadata.buttons)
              }
            } catch (e) {
              // Invalid metadata, ignore
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleButtonClick = async (option: ButtonOption) => {
    // Clear buttons immediately
    setActiveButtons(null)
    
    // Send the button value as a message
    await sendMessage(option.value, option.label)
  }

  const sendMessage = async (content: string, displayContent?: string) => {
    if (!content.trim() || isSending) return

    const messageContent = content.trim()
    const displayText = displayContent || messageContent
    setInput('')
    setIsSending(true)

    // Optimistically add user message (show display text)
    const tempUserMsg: Message = {
      id: Date.now(),
      sender_id: null,
      sender_type: 'user',
      content: displayText,
      message_type: 'text',
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

        // Update messages with actual IDs
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempUserMsg.id
              ? { ...data.userMessage, content: displayText }
              : m
          )
        )

        // Add AI response if present
        if (data.aiMessage) {
          setMessages((prev) => [...prev, data.aiMessage])

          // Check if AI message has buttons
          if (data.aiMessage.message_type === 'buttons' && data.aiMessage.metadata) {
            try {
              const metadata = JSON.parse(data.aiMessage.metadata)
              if (metadata.buttons) {
                setActiveButtons(metadata.buttons)
              }
            } catch (e) {
              // Invalid metadata
            }
          }
        }

        // Update conversation in parent
        onConversationUpdate({
          ...conversation,
          last_message: displayText,
          last_message_at: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSending) return
    await sendMessage(input.trim())
  }

  const renderMessage = (message: Message) => {
    const isUser = message.sender_type === 'user'
    const isAI = message.sender_type === 'ai'

    // Parse metadata for special message types
    let metadata: any = null
    if (message.metadata) {
      try {
        metadata = JSON.parse(message.metadata)
      } catch (e) {
        // Invalid JSON
      }
    }

    // Render score result
    if (message.message_type === 'score_result' && metadata) {
      const { score, stage, stageMessage, color } = metadata
      const colorClasses: Record<string, string> = {
        emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
        amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400',
        violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-400',
      }
      const colorClass = colorClasses[color] || colorClasses.violet

      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`max-w-[85%] p-6 rounded-2xl bg-gradient-to-br ${colorClass} border`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider font-semibold">{stage}</span>
          </div>
          <div className="text-4xl font-display font-bold mb-2">{score}/100</div>
          <p className="text-[--color-text-dim]">{stageMessage}</p>
        </motion.div>
      )
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`max-w-[85%] ${isUser ? 'ml-auto' : ''}`}
      >
        {/* Sender indicator for AI */}
        {isAI && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-emerald-500 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs text-[--color-text-dim]">FinovAI</span>
          </div>
        )}

        <div
          className={`p-4 rounded-2xl ${
            isUser
              ? 'bg-gradient-to-br from-violet-500/20 to-violet-500/10 border border-violet-500/20'
              : 'glass'
          }`}
        >
          <p className="text-sm text-[--color-text] whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        </div>

        <span className="text-[10px] text-[--color-text-dim] mt-1 block px-1">
          {new Date(message.created_at).toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </motion.div>
    )
  }

  const renderButtons = () => {
    if (!activeButtons || activeButtons.length === 0) return null

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap gap-2 mt-4 px-4"
      >
        {activeButtons.map((button, index) => (
          <button
            key={index}
            onClick={() => handleButtonClick(button)}
            disabled={isSending}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              button.variant === 'primary'
                ? 'bg-gradient-to-r from-violet-500 to-emerald-500 text-white hover:opacity-90 shadow-lg shadow-violet-500/20'
                : 'glass hover:bg-white/10 text-[--color-text]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {button.label}
          </button>
        ))}
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[--color-text-dim]" />
        </button>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-[--color-text]">
            {conversation.title || 'Chat con FinovAI'}
          </h3>
          <p className="text-xs text-[--color-text-dim]">Tu asesor financiero</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id}>{renderMessage(message)}</div>
          ))
        )}

        {/* Active buttons */}
        {renderButtons()}

        {/* Typing indicator */}
        {isSending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-emerald-500 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <div className="glass px-4 py-2 rounded-2xl">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                <span
                  className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <span
                  className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-white/5"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeButtons ? 'O escribe tu mensaje...' : 'Escribe tu mensaje...'}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-[--color-text] placeholder-[--color-text-dim] focus:outline-none focus:border-violet-500/50 transition-colors"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-emerald-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
