import { motion } from 'motion/react'
import { MessageSquare, Users, Sparkles, Loader2 } from 'lucide-react'

interface Conversation {
  id: number
  conversation_type: string
  title: string | null
  last_message: string | null
  unread_count: number
  created_at: string
  last_message_at: string | null
}

interface ConversationListProps {
  conversations: Conversation[]
  isLoading: boolean
  onSelect: (conversation: Conversation) => void
  activeId?: number
}

export default function ConversationList({
  conversations,
  isLoading,
  onSelect,
  activeId,
}: ConversationListProps) {
  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'couple_ai':
        return <Users className="size-4 text-pink-400" />
      case 'couple_direct':
        return <MessageSquare className="size-4 text-violet-400" />
      default:
        return <Sparkles className="size-4 text-emerald-400" />
    }
  }

  const getConversationTitle = (conv: Conversation) => {
    if (conv.title) return conv.title
    switch (conv.conversation_type) {
      case 'couple_ai':
        return 'Chat de pareja con FinovAI'
      case 'couple_direct':
        return 'Chat con tu pareja'
      default:
        return 'Chat con FinovAI'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Ayer'
    } else if (days < 7) {
      return date.toLocaleDateString('es', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('es', { month: 'short', day: 'numeric' })
    }
  }

  const truncateMessage = (message: string | null) => {
    if (!message) return 'Sin mensajes'
    return message.length > 50 ? message.slice(0, 50) + '...' : message
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/5">
          <MessageSquare className="size-6 text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-400">No tienes conversaciones</p>
        <p className="mt-1 text-xs text-zinc-500">
          Crea una nueva para empezar a chatear
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv, index) => (
        <motion.button
          key={conv.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onSelect(conv)}
          className={`flex w-full items-start gap-3 border-b border-white/5 px-4 py-4 text-left transition-colors hover:bg-white/5 ${
            activeId === conv.id ? 'bg-white/5' : ''
          }`}
        >
          {/* Icon */}
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
              conv.conversation_type === 'couple_ai'
                ? 'bg-pink-500/10'
                : conv.conversation_type === 'couple_direct'
                  ? 'bg-violet-500/10'
                  : 'bg-emerald-500/10'
            }`}
          >
            {getConversationIcon(conv.conversation_type)}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="truncate text-sm font-medium text-white">
                {getConversationTitle(conv)}
              </h4>
              <span className="shrink-0 text-xs text-zinc-500">
                {formatDate(conv.last_message_at || conv.created_at)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-zinc-500">
              {truncateMessage(conv.last_message)}
            </p>
          </div>

          {/* Unread badge */}
          {conv.unread_count > 0 && (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-semibold text-white">
              {conv.unread_count > 9 ? '9+' : conv.unread_count}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  )
}
