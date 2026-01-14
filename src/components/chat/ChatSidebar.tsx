import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Sparkles, Send, Loader2, FileText, MessageSquarePlus, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuthFlow } from '@/components/auth'
import ConversationList from './ConversationList'
import MessageThread from './MessageThread'

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: number
  conversation_type: string
  title: string | null
  last_message: string | null
  unread_count: number
  created_at: string
  last_message_at: string | null
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `¡Hola! Soy el asistente de FinovAI 👋

Estoy aquí para ayudarte a entender tu situación financiera actual y ver cómo podemos ayudarte a ordenar tu casa financiera.

Para empezar, cuéntame: **¿Cómo describirías tu relación actual con el dinero?**

Por ejemplo:
• ¿Tienes control de lo que entra y sale cada mes?
• ¿Logras ahorrar algo consistentemente?
• ¿O sientes que el dinero "se va" sin saber bien a dónde?`,
}

// Number of user messages before offering the report
const MESSAGES_BEFORE_REPORT_OFFER = 5

export default function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
  const { isAuthenticated, user, token } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [pendingReportRequest, setPendingReportRequest] = useState(false)

  // Guest chat state (unauthenticated)
  const [guestMessages, setGuestMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [guestInput, setGuestInput] = useState('')
  const [isGuestLoading, setIsGuestLoading] = useState(false)
  const [hasOfferedReport, setHasOfferedReport] = useState(false)

  // Authenticated state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [view, setView] = useState<'chat' | 'list' | 'thread'>('chat')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      inputRef.current?.focus()
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [guestMessages])

  // When user authenticates with pending report, save conversation
  useEffect(() => {
    if (isAuthenticated && pendingReportRequest && token) {
      saveGuestConversation()
    }
  }, [isAuthenticated, pendingReportRequest, token])

  // Fetch conversations when authenticated and viewing list
  useEffect(() => {
    if (isAuthenticated && isOpen && token && view === 'list') {
      fetchConversations()
    }
  }, [isAuthenticated, isOpen, token, view])

  const saveGuestConversation = async () => {
    if (!token || guestMessages.length <= 1) return

    try {
      // Create a new conversation
      const convResponse = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'private_ai' }),
      })

      if (convResponse.ok) {
        const newConv = await convResponse.json()

        // Send all guest messages to save them (skip initial AI message)
        for (const msg of guestMessages.slice(1)) {
          if (msg.role === 'user') {
            await fetch(`/api/conversations/${newConv.id}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ content: msg.content }),
            })
          }
        }

        // Reset guest state and show success
        setPendingReportRequest(false)
        setGuestMessages([INITIAL_MESSAGE])
        setHasOfferedReport(false)

        // Switch to conversation list
        setView('list')
        fetchConversations()
      }
    } catch (error) {
      console.error('Failed to save conversation:', error)
    }
  }

  const fetchConversations = async () => {
    if (!token) return
    setIsLoadingConversations(true)
    try {
      const response = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setIsLoadingConversations(false)
    }
  }

  const createConversation = async (type: 'private_ai' | 'couple_ai' = 'private_ai') => {
    if (!token) return

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      })

      if (response.ok) {
        const newConv = await response.json()
        const fullConv: Conversation = {
          id: newConv.id,
          conversation_type: newConv.type,
          title: newConv.title,
          last_message: null,
          unread_count: 0,
          created_at: newConv.created_at,
          last_message_at: null,
        }
        setConversations((prev) => [fullConv, ...prev])
        setActiveConversation(fullConv)
        setView('thread')
      }
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestInput.trim() || isGuestLoading) return

    const userMessage: Message = { role: 'user', content: guestInput.trim() }
    setGuestMessages((prev) => [...prev, userMessage])
    setGuestInput('')
    setIsGuestLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...guestMessages, userMessage],
        }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()
      let aiMessage = data.message

      // Count user messages
      const userMessageCount = guestMessages.filter((m) => m.role === 'user').length + 1

      // After enough messages, offer the report (only once)
      if (userMessageCount >= MESSAGES_BEFORE_REPORT_OFFER && !hasOfferedReport) {
        setHasOfferedReport(true)
        aiMessage += `\n\n---\n\n📊 **¿Te gustaría recibir un diagnóstico personalizado?**\n\nBasado en lo que me has contado, puedo prepararte un mini-reporte con:\n• Tu etapa financiera actual\n• 3 acciones prioritarias para tu caso\n• Recursos específicos para empezar\n\nSolo necesito tu WhatsApp para enviártelo.`
      }

      setGuestMessages((prev) => [...prev, { role: 'assistant', content: aiMessage }])
    } catch {
      setGuestMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Lo siento, hubo un error. Por favor, intenta de nuevo.',
        },
      ])
    } finally {
      setIsGuestLoading(false)
    }
  }

  const handleRequestReport = () => {
    setPendingReportRequest(true)
    setShowAuth(true)
  }

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv)
    setView('thread')
  }

  const handleBackToList = () => {
    setView('list')
    setActiveConversation(null)
    fetchConversations()
  }

  const handleAuthSuccess = () => {
    setShowAuth(false)
    if (pendingReportRequest) {
      // Will be handled by useEffect
    } else {
      setView('list')
      fetchConversations()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-white/10 bg-zinc-900 shadow-2xl sm:w-[420px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20">
                  <Sparkles className="size-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">FinovAI Chat</h2>
                  <p className="text-xs text-zinc-500">Tu asesor financiero</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAuthenticated && view === 'chat' && (
                  <button
                    onClick={() => setView('list')}
                    className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    Mis chats
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {/* Guest chat view (default, works without auth) */}
              {view === 'chat' && (
                <div className="flex h-full flex-col">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    <div className="space-y-4">
                      {guestMessages.map((message, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index < 3 ? index * 0.1 : 0 }}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                              message.role === 'user'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/5 text-zinc-300'
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {message.content}
                            </p>
                          </div>
                        </motion.div>
                      ))}

                      {/* Typing indicator */}
                      {isGuestLoading && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex justify-start"
                        >
                          <div className="rounded-2xl bg-white/5 px-4 py-3">
                            <div className="flex gap-1.5">
                              <span className="size-2 animate-bounce rounded-full bg-zinc-500" />
                              <span className="size-2 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '0.15s' }} />
                              <span className="size-2 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '0.3s' }} />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Report CTA - shown after offer */}
                      {hasOfferedReport && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex justify-center py-2"
                        >
                          <button
                            onClick={handleRequestReport}
                            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40"
                          >
                            <FileText className="size-4" />
                            Quiero mi diagnóstico
                          </button>
                        </motion.div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Input */}
                  <form onSubmit={handleGuestSubmit} className="border-t border-white/10 p-4">
                    <div className="flex gap-3">
                      <input
                        ref={inputRef}
                        type="text"
                        value={guestInput}
                        onChange={(e) => setGuestInput(e.target.value)}
                        placeholder="Escribe tu mensaje..."
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                        disabled={isGuestLoading}
                      />
                      <button
                        type="submit"
                        disabled={isGuestLoading || !guestInput.trim()}
                        className="flex size-12 items-center justify-center rounded-xl bg-emerald-500 text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isGuestLoading ? (
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
              )}

              {/* Conversation list view (authenticated) */}
              {view === 'list' && isAuthenticated && (
                <div className="flex h-full flex-col">
                  {/* New chat buttons */}
                  <div className="flex gap-2 border-b border-white/5 p-4">
                    <button
                      onClick={() => {
                        setGuestMessages([INITIAL_MESSAGE])
                        setHasOfferedReport(false)
                        setView('chat')
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/10 py-3 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
                    >
                      <MessageSquarePlus className="size-4" />
                      Nueva conversación
                    </button>
                    {user?.coupleId && (
                      <button
                        onClick={() => createConversation('couple_ai')}
                        className="flex items-center justify-center gap-2 rounded-xl bg-pink-500/10 px-4 py-3 text-sm font-medium text-pink-400 transition-colors hover:bg-pink-500/20"
                      >
                        <Users className="size-4" />
                      </button>
                    )}
                  </div>

                  {/* Conversations list */}
                  <ConversationList
                    conversations={conversations}
                    isLoading={isLoadingConversations}
                    onSelect={handleSelectConversation}
                    activeId={activeConversation?.id}
                  />
                </div>
              )}

              {/* Message thread view (authenticated) */}
              {view === 'thread' && isAuthenticated && activeConversation && (
                <MessageThread
                  conversation={activeConversation}
                  token={token!}
                  onBack={handleBackToList}
                  onConversationUpdate={(conv) => {
                    setActiveConversation(conv)
                    setConversations((prev) =>
                      prev.map((c) => (c.id === conv.id ? conv : c))
                    )
                  }}
                />
              )}
            </div>
          </motion.div>

          {/* Auth modal */}
          <AuthFlow
            isOpen={showAuth}
            onClose={() => {
              setShowAuth(false)
              setPendingReportRequest(false)
            }}
            onSuccess={handleAuthSuccess}
          />
        </>
      )}
    </AnimatePresence>
  )
}
