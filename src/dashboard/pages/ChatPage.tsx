import { useEffect, type RefObject } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Bot, Landmark, Loader2, SendHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input'
import { PromptSuggestion } from '@/components/ui/prompt-suggestion'
import { ThinkingBar } from '@/components/ui/thinking-bar'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { MessageResponse } from '@/components/ai-elements/message-response'
import { Shimmer } from '@/components/ai-elements/shimmer'
import { cn } from '@/lib/utils'
import { finalizeDashboardChatAnswer } from '@finovai/core'
import { useSendChatMessage } from '@finovai/core/react'
import type { DashboardChatChartType, DashboardChatMessage, PendingChatAnswer } from '../lib/types'
import {
  CHAT_TOOLTIP_CLASS,
  CHAT_TOOLTIP_POSITION,
  CHAT_TOOLTIP_WRAPPER_STYLE,
  CASHFLOW_CHART_CONFIG,
  SINGLE_VALUE_CHART_CONFIG,
} from '../lib/styles'
import { formatCardCurrency, formatMonth, formatShortMonth } from '../lib/format'
import { getCategoryTrendChartData } from '../lib/analytics'
import {
  DASHBOARD_CHAT_SUGGESTIONS,
  buildDashboardChatAnswer,
  buildDashboardChatOpening,
  getDashboardChatChartCategory,
  getDashboardChatChartType,
} from '../lib/chat'
import type { DashboardPage } from '../lib/routing'
import { useDashboardModel, type DashboardModelOptions } from '../lib/use-dashboard-model'

export interface ChatController {
  chatInput: string
  setChatInput: (value: string) => void
  chatMessages: DashboardChatMessage[]
  setChatMessages: React.Dispatch<React.SetStateAction<DashboardChatMessage[]>>
  pendingChatAnswer: PendingChatAnswer | null
  setPendingChatAnswer: (value: PendingChatAnswer | null) => void
  chatMessagesEndRef: RefObject<HTMLDivElement | null>
  /** A question handed over from another page via "Analizar con FinovAI". */
  pendingQuestionRef: RefObject<string | null>
}

interface ChatPageProps {
  email: string
  modelOptions: DashboardModelOptions
  chat: ChatController
  onNavigate: (page: DashboardPage) => void
}

export function ChatPage({ email, modelOptions, chat, onNavigate }: ChatPageProps) {
  const {
    chatCurrency,
    chatProfile,
    chatSummary,
    chatTransactions,
    categoryChartData,
    cashflowChartData,
    savingsChartData,
    recurringChartData,
    connectActionLabel,
    hasConnectedInstitution,
    hasReconnectRequiredCredential,
    hasTransactions,
    projectedSavingsValue,
    transactions,
  } = useDashboardModel(email, modelOptions)

  const {
    chatInput,
    setChatInput,
    chatMessages,
    setChatMessages,
    pendingChatAnswer,
    setPendingChatAnswer,
    chatMessagesEndRef,
    pendingQuestionRef,
  } = chat

  const activeEmail = email
  const sendChat = useSendChatMessage(email)

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages, chatMessagesEndRef, pendingChatAnswer])

  // Seeds (and re-seeds) the opening assistant message for this account.
  useEffect(() => {
    setChatMessages((current) => {
      const firstMessage = current[0]
      const welcomeId = `welcome-${activeEmail}-confirmed-${transactions.length}`
      if (firstMessage?.id === welcomeId) return current

      return [
        {
          id: welcomeId,
          role: 'assistant',
          content: buildDashboardChatOpening(
            chatTransactions,
            hasConnectedInstitution,
            hasReconnectRequiredCredential
          ),
        },
        ...current.filter((message) => !message.id.startsWith(`welcome-${activeEmail}`)),
      ]
    })
  }, [
    activeEmail,
    chatTransactions,
    hasConnectedInstitution,
    hasReconnectRequiredCredential,
    setChatMessages,
    transactions.length,
  ])

  const queueDashboardChatAnswer = (question: string) => {
    if (!question) return
    if (pendingChatAnswer) return

    const startedAt = Date.now()
    setChatMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: question },
    ])
    setPendingChatAnswer({ question, startedAt })
    setChatInput('')
    window.setTimeout(() => {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 0)

    void (async () => {
      let answer = ''
      let model: string | undefined
      let chatError: string | null = null

      if (activeEmail) {
        try {
          const response = await sendChat.mutateAsync(question)
          answer = response.answer
          model = response.model
        } catch (error) {
          chatError = error instanceof Error ? error.message : 'No pudimos conectar con el modelo financiero.'
        }
      }

      if (!activeEmail || chatError) {
        answer = buildDashboardChatAnswer(
          question,
          chatTransactions,
          chatSummary,
          chatCurrency,
          false,
          hasConnectedInstitution,
          hasReconnectRequiredCredential,
          chatProfile
        )
        if (chatError) model = 'análisis local'
      }

      answer = finalizeDashboardChatAnswer(answer)

      const chart = getDashboardChatChartType(question, chatTransactions, chatSummary)
      const chartCategory = chart === 'category-trend' ? getDashboardChatChartCategory(question) : undefined
      const reasoningDuration = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000))

      setChatMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: answer,
          chart,
          chartCategory,
          reasoning: model
            ? `Modelo: ${model}${chatError ? `\nModelo remoto no ejecutado: ${chatError}` : ''}`
            : undefined,
          reasoningDuration,
        },
      ])
      setPendingChatAnswer(null)
    })()
  }

  const submitDashboardChatInput = () => {
    queueDashboardChatAnswer(chatInput.trim())
  }

  const askDashboardQuestion = (question: string) => {
    queueDashboardChatAnswer(question)
  }

  // Another page routed a question here ("Analizar con FinovAI"); run it once.
  useEffect(() => {
    const handedOver = pendingQuestionRef.current
    if (!handedOver) return
    pendingQuestionRef.current = null
    queueDashboardChatAnswer(handedOver)
  })

  const renderChatChart = (chart?: DashboardChatChartType, chartCategory?: string) => {
    if (!chart) return null

    if (chart === 'category-trend') {
      const category = chartCategory || chatSummary.topSpendingCategory
      const data = getCategoryTrendChartData(chatTransactions, category, chatSummary.dataCoverage)
      if (data.length === 0) return null

      const total = data.reduce((sum, item) => sum + item.amount, 0)
      const peak = [...data].sort((a, b) => b.amount - a.amount)[0]

      return (
        <div className="mt-3 rounded-lg bg-background/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Evolución mensual
              </p>
              <p className="mt-1 text-sm font-semibold leading-tight">{category}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Total
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {formatCardCurrency(total, chatCurrency)}
              </p>
            </div>
          </div>
          <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="mt-3 h-40 w-full aspect-auto">
            <LineChart data={data} margin={{ left: 4, right: 12, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} />
              <YAxis hide domain={[0, 'dataMax']} />
              <ChartTooltip
                cursor={false}
                position={CHAT_TOOLTIP_POSITION}
                wrapperStyle={CHAT_TOOLTIP_WRAPPER_STYLE}
                content={(
                  <ChartTooltipContent
                    className={CHAT_TOOLTIP_CLASS}
                    formatter={(value) => (
                      <>
                        <span className="text-muted-foreground">{category}</span>
                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                          {formatCardCurrency(Number(value), chatCurrency)}
                        </span>
                      </>
                    )}
                  />
                )}
              />
              <Line
                dataKey="amount"
                type="monotone"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
          {peak ? (
            <p className="mt-2 text-xs leading-snug text-muted-foreground">
              Pico: {formatShortMonth(peak.month)} con {formatCardCurrency(peak.amount, chatCurrency)}.
            </p>
          ) : null}
        </div>
      )
    }

    if (chart === 'categories') {
      const data = categoryChartData.slice(0, 4)
      if (data.length === 0) return null

      return (
        <div className="mt-3 rounded-lg bg-background/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Categorías
              </p>
              <p className="mt-1 text-sm font-semibold leading-tight">{data[0].category}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              {data[0].share}%
            </p>
          </div>
          <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="mt-2 h-32 w-full aspect-auto">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 6, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                dataKey="label"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                tickMargin={4}
                width={108}
              />
              <ChartTooltip
                cursor={false}
                position={CHAT_TOOLTIP_POSITION}
                wrapperStyle={CHAT_TOOLTIP_WRAPPER_STYLE}
                content={(
                  <ChartTooltipContent
                    className={CHAT_TOOLTIP_CLASS}
                    hideLabel
                    formatter={(value, name, item) => (
                      <>
                        <span className="text-muted-foreground">
                          {String(item?.payload?.category || name)}
                        </span>
                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                          {formatCardCurrency(Number(value), chatCurrency)}
                        </span>
                      </>
                    )}
                  />
                )}
              />
              <Bar dataKey="amount" radius={5}>
                {data.map((item) => (
                  <Cell key={item.category} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )
    }

    if (chart === 'daily-spend') {
      const data = cashflowChartData.filter((item) => item.spending > 0 || item.income > 0)
      if (data.length === 0) return null

      return (
        <div className="mt-3 rounded-lg bg-background/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Gasto diario
              </p>
              <p className="mt-1 text-sm font-semibold leading-tight">{formatMonth(chatSummary.month)}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              {formatCardCurrency(chatSummary.monthlySpending, chatCurrency)}
            </p>
          </div>
          <ChartContainer config={CASHFLOW_CHART_CONFIG} className="mt-2 h-36 w-full aspect-auto">
            <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} minTickGap={18} />
              <YAxis hide domain={[0, 'dataMax']} />
              <ChartTooltip
                cursor={false}
                position={CHAT_TOOLTIP_POSITION}
                wrapperStyle={CHAT_TOOLTIP_WRAPPER_STYLE}
                content={(
                  <ChartTooltipContent
                    className={CHAT_TOOLTIP_CLASS}
                    formatter={(value, name) => (
                      <>
                        <span className="text-muted-foreground">
                          {name === 'income' ? 'Ingresos' : 'Gastos'}
                        </span>
                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                          {formatCardCurrency(Number(value), chatCurrency)}
                        </span>
                      </>
                    )}
                  />
                )}
              />
              <Area
                dataKey="spending"
                type="natural"
                fill="var(--color-spending)"
                fillOpacity={0.18}
                stroke="var(--color-spending)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      )
    }

    if (chart === 'savings') {
      const data = savingsChartData
      if (data.length === 0) return null

      return (
        <div className="mt-3 rounded-lg bg-primary/10 p-3 text-foreground shadow-[inset_0_0_0_1px_rgba(40,114,68,0.18)] dark:shadow-[inset_0_0_0_1px_rgba(114,215,134,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary">
                Ahorro invertible
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatCardCurrency(chatSummary.estimatedSavingsOpportunity, chatCurrency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                10 años
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-primary">
                {formatCardCurrency(projectedSavingsValue, chatCurrency)}
              </p>
            </div>
          </div>
          <ChartContainer config={SINGLE_VALUE_CHART_CONFIG} className="mt-2 h-28 w-full aspect-auto">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 6, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickMargin={4} width={108} />
              <ChartTooltip
                cursor={false}
                position={CHAT_TOOLTIP_POSITION}
                wrapperStyle={CHAT_TOOLTIP_WRAPPER_STYLE}
                content={(
                  <ChartTooltipContent
                    className={CHAT_TOOLTIP_CLASS}
                    hideLabel
                    formatter={(value, name, item) => (
                      <>
                        <span className="text-muted-foreground">
                          {String(item?.payload?.category || name)}
                        </span>
                        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                          {formatCardCurrency(Number(value), chatCurrency)}
                        </span>
                      </>
                    )}
                  />
                )}
              />
              <Bar dataKey="amount" radius={5} fill="var(--primary)" />
            </BarChart>
          </ChartContainer>
        </div>
      )
    }

    const data = recurringChartData
    if (data.length === 0) return null

    const maxRecurringAmount = Math.max(...data.map((item) => item.amount), 1)
    const recurringTotal = data.reduce((total, item) => total + item.amount, 0)

    return (
      <div className="mt-3 rounded-lg bg-background/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Patrones recurrentes
            </p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Impacto estimado = veces detectadas por monto promedio.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Top {data.length}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {formatCardCurrency(recurringTotal, chatCurrency)}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          {data.map((item, index) => {
            const width = Math.max(8, Math.round((item.amount / maxRecurringAmount) * 100))

            return (
              <div key={item.description} className="rounded-md bg-card/80 p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight" title={item.description}>
                      {index + 1}. {item.description}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                      {item.count} cargos · prom. {formatCardCurrency(item.averageAmount, chatCurrency)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatCardCurrency(item.amount, chatCurrency)}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${width}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderChatReasoning = ({
    isStreaming,
    reasoning,
    duration,
  }: {
    isStreaming: boolean
    reasoning: string
    duration?: number
  }) => (
    <Reasoning
      className="mb-3 rounded-md bg-background/45 p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
      defaultOpen={isStreaming}
      duration={duration}
      isStreaming={isStreaming}
    >
      <ReasoningTrigger
        className="text-xs"
        getThinkingMessage={(streaming, seconds) => {
          if (streaming || seconds === 0) {
            return <Shimmer duration={1}>Analizando movimientos...</Shimmer>
          }

          return <span>Analizado en {seconds || 1}s</span>
        }}
      />
      <ReasoningContent className="mt-2 text-xs leading-relaxed">
        {reasoning}
      </ReasoningContent>
    </Reasoning>
  )

  const renderDashboardPromptSuggestions = (isMobile = false) => (
    (() => {
      const showConnectPrompt = !hasTransactions && !hasConnectedInstitution
      const questions = DASHBOARD_CHAT_SUGGESTIONS.slice(0, showConnectPrompt ? 2 : 3)

      return (
        <div
          className={cn(
            'flex min-w-0 max-w-full gap-2',
            isMobile ? '-mx-1 flex-nowrap overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap'
          )}
        >
          {showConnectPrompt ? (
            <PromptSuggestion
              type="button"
              variant="secondary"
              size="sm"
              className={cn('rounded-full', isMobile && 'shrink-0')}
            onClick={() => onNavigate('syncfy')}
            disabled={Boolean(pendingChatAnswer)}
          >
            <Landmark data-icon="inline-start" />
            {connectActionLabel}
          </PromptSuggestion>
          ) : null}
          {questions.map((question) => (
            <PromptSuggestion
              key={question}
              type="button"
              variant="outline"
              size="sm"
              className={cn('rounded-full', isMobile && 'shrink-0')}
              disabled={Boolean(pendingChatAnswer)}
              onClick={() => askDashboardQuestion(question)}
            >
              {question}
            </PromptSuggestion>
          ))}
        </div>
      )
    })()
  )

  const renderDashboardChatMessage = (message: DashboardChatMessage, isMobile = false) => {
    const isAssistant = message.role === 'assistant'
    const hasRichChart = isAssistant && Boolean(message.chart)

    return (
      <Message
        key={message.id}
        className={cn(
          'group w-full min-w-0',
          isAssistant ? 'justify-start' : 'justify-end',
          !isMobile && isAssistant && 'items-start'
        )}
      >
        {isAssistant && !isMobile ? (
          <MessageAvatar
            src=""
            alt="FinovAI"
            fallback="F"
            className="mt-1 border border-[#2B7AE8]/20 bg-[#2B7AE8]/10 text-blue-700 dark:text-[#9dc2ff]"
          />
        ) : null}
        <div
          className={cn(
            'flex min-w-0 flex-col gap-1',
            hasRichChart
              ? isAssistant && !isMobile ? 'max-w-full flex-1' : 'w-full max-w-full'
              : isMobile ? 'max-w-[88%]' : 'max-w-[86%]',
            !isAssistant && 'items-end'
          )}
        >
          {!isMobile ? (
            <div className={cn('flex items-center gap-2 text-[0.7rem] text-muted-foreground', !isAssistant && 'justify-end')}>
              <span>{isAssistant ? 'FinovAI' : 'Tú'}</span>
              {isAssistant && message.chart ? <span>· gráfico incluido</span> : null}
            </div>
          ) : null}
          <MessageContent
            className={cn(
              'min-w-0 rounded-2xl px-3 py-2 text-sm leading-relaxed break-words shadow-none [overflow-wrap:anywhere]',
              isAssistant
                ? 'bg-card/80 text-card-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]'
                : 'bg-[#00D4AA] text-[#04111f] shadow-[0_12px_30px_rgba(0,212,170,0.18)]',
              hasRichChart && 'w-full max-w-full',
              !isMobile && isAssistant && 'rounded-tl-md',
              !isMobile && !isAssistant && 'rounded-tr-md'
            )}
          >
            {isAssistant && message.reasoning
              ? renderChatReasoning({
                isStreaming: false,
                reasoning: message.reasoning,
                duration: message.reasoningDuration,
              })
              : null}
            {isAssistant ? (
              <MessageResponse>{message.content}</MessageResponse>
            ) : (
              <p>{message.content}</p>
            )}
            {isAssistant ? renderChatChart(message.chart, message.chartCategory) : null}
          </MessageContent>
        </div>
        {!isAssistant && !isMobile ? (
          <MessageAvatar
            src=""
            alt="Usuario"
            fallback="T"
            className="mt-5 border border-border/70 bg-secondary text-foreground"
          />
        ) : null}
      </Message>
    )
  }

  const renderPendingChatMessage = (isMobile = false) => (
    <Message className="w-full min-w-0 justify-start">
      {!isMobile ? (
        <MessageAvatar
          src=""
          alt="FinovAI"
          fallback="F"
          className="mt-1 border border-[#2B7AE8]/20 bg-[#2B7AE8]/10 text-blue-700 dark:text-[#9dc2ff]"
        />
      ) : null}
      <MessageContent
        className={cn(
          'min-w-0 rounded-2xl rounded-tl-md bg-card/80 px-3 py-2 text-sm leading-relaxed text-card-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]',
          isMobile ? 'max-w-full' : 'max-w-[92%]'
        )}
      >
        <ThinkingBar text="Analizando movimientos..." />
      </MessageContent>
    </Message>
  )

  const renderFinanceChatComposer = () => (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-3">
      {renderDashboardPromptSuggestions()}
      <PromptInput
        value={chatInput}
        onValueChange={setChatInput}
        onSubmit={submitDashboardChatInput}
        isLoading={Boolean(pendingChatAnswer)}
        disabled={Boolean(pendingChatAnswer)}
        className="min-w-0 rounded-[1.65rem] border-border/80 bg-card px-2 py-2 shadow-[0_8px_28px_rgba(16,24,20,0.08)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
      >
        <PromptInputTextarea
          className="max-h-40 min-h-11 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground sm:text-base"
          placeholder="Mensaje a FinovAI"
          disabled={Boolean(pendingChatAnswer)}
        />
        <PromptInputActions className="items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            size="icon"
            className="size-9 rounded-full bg-foreground text-background hover:bg-foreground/85"
            disabled={!chatInput.trim() || Boolean(pendingChatAnswer)}
            aria-label="Enviar mensaje"
            onClick={submitDashboardChatInput}
          >
            {pendingChatAnswer ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </Button>
        </PromptInputActions>
      </PromptInput>
    </div>
  )

  const renderFinanceCockpitHome = () => {
    return (
      <div className="flex h-[calc(100vh-1.5rem)] min-h-[680px] min-w-0 flex-col bg-background sm:h-[calc(100vh-2.5rem)] lg:h-[calc(100vh-3.5rem)]">
        <header className="shrink-0 border-b border-border/70 px-4 py-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-[1000px] items-center">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">Chat financiero</h1>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden" aria-live="polite">
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5">
            {chatMessages.length > 0 ? (
              chatMessages.map((message) => renderDashboardChatMessage(message))
            ) : (
              <div className="flex min-h-[46vh] flex-col items-center justify-center text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-5" />
                </div>
                <h2 className="mt-4 text-2xl font-medium tracking-normal">Pregunta sobre tus finanzas</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Puedo revisar fugas, recurrentes, días atípicos, categorías y ahorro invertible.
                </p>
              </div>
            )}
            {pendingChatAnswer ? renderPendingChatMessage() : null}
            <div ref={chatMessagesEndRef} />
          </div>
        </div>

        <footer className="shrink-0 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          {renderFinanceChatComposer()}
        </footer>
      </div>
    )
  }

  return renderFinanceCockpitHome()
}
