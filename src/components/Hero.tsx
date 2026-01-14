import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { ChevronRight, ArrowDown, Shield, Sparkles } from 'lucide-react'
import { IPhoneMockup } from 'react-device-mockup'

interface HeroProps {
  onChatOpen: () => void
}

export default function Hero({ onChatOpen }: HeroProps) {
  const [displayText, setDisplayText] = useState('')
  const fullText = '¿En qué se me va el dinero?'
  const [isTyping, setIsTyping] = useState(true)
  const [chartVisible, setChartVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setChartVisible(true), 800)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (isTyping && displayText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setDisplayText(fullText.slice(0, displayText.length + 1))
      }, 70)
      return () => clearTimeout(timeout)
    } else if (displayText.length === fullText.length) {
      const timeout = setTimeout(() => {
        setIsTyping(false)
        setTimeout(() => {
          setDisplayText('')
          setIsTyping(true)
        }, 2500)
      }, 1500)
      return () => clearTimeout(timeout)
    }
  }, [displayText, isTyping])

  const chartBars = [35, 42, 38, 55, 48, 62, 58, 70, 65, 78, 73]

  return (
    <section className="relative overflow-hidden">
      <div className="pb-12 pt-28 sm:py-24 md:pb-32 lg:pb-36 lg:pt-44">
        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-12">
          {/* Mobile: Stack layout, Desktop: Side by side */}
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
            {/* Text content */}
            <div className="max-w-xl text-center lg:max-w-2xl lg:text-left">
              {/* Tagline */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm text-emerald-400">
                  <Sparkles className="size-3.5 sm:size-4" />
                  Tu asesor financiero con IA
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                className="mt-6 text-balance text-4xl font-medium tracking-tight sm:mt-8 sm:text-5xl md:text-6xl lg:mt-10 xl:text-7xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <span className="text-white">Ordena tu casa</span>
                <br />
                <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                  financiera
                </span>
              </motion.h1>

              {/* Typing effect */}
              <motion.div
                className="mt-4 h-7 sm:mt-6 sm:h-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <span className="text-base italic text-zinc-400 sm:text-lg">
                  "{displayText}
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-emerald-400 sm:h-5" />
                  "
                </span>
              </motion.div>

              {/* Description */}
              <motion.p
                className="mt-4 text-balance text-base text-zinc-400 sm:mt-6 sm:text-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                FinovAI te ayuda a entender tus finanzas, crear estructura y, cuando estés listo, invertir con claridad.
                <span className="text-zinc-300"> Sin humo, con proceso.</span>
              </motion.p>

              {/* CTAs */}
              <motion.div
                className="mt-8 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:justify-center lg:justify-start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Button
                  onClick={onChatOpen}
                  size="lg"
                  className="h-11 w-full rounded-full bg-emerald-500 px-6 text-base font-medium text-white hover:bg-emerald-400 hover:shadow-[0_20px_40px_rgba(16,185,129,0.25)] sm:h-12 sm:w-auto sm:pl-6 sm:pr-4"
                >
                  <span className="text-nowrap">Habla con FinovAI</span>
                  <ChevronRight className="ml-1 size-5" />
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="h-11 w-full rounded-full px-6 text-base text-zinc-300 hover:bg-white/5 hover:text-white sm:h-12 sm:w-auto"
                >
                  <a href="#como-funciona">
                    <span className="text-nowrap">Ver cómo funciona</span>
                    <ArrowDown className="ml-2 size-4" />
                  </a>
                </Button>
              </motion.div>

              {/* Trust indicators */}
              <motion.div
                className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs sm:mt-10 sm:gap-6 sm:text-sm lg:justify-start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <span className="flex items-center gap-2 text-zinc-500">
                  <Shield className="size-4 text-emerald-500" />
                  Datos protegidos
                </span>
                <span className="size-1 rounded-full bg-zinc-700" />
                <span className="flex items-center gap-2 text-zinc-500">
                  <svg className="size-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Gratis para empezar
                </span>
              </motion.div>

              {/* Partner collaboration feature */}
              <motion.div
                className="mt-6 flex justify-center sm:mt-8 lg:justify-start"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <div className="inline-flex items-center gap-3 rounded-2xl border border-pink-500/20 bg-pink-500/5 px-4 py-3">
                  <div className="flex -space-x-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-semibold text-white ring-2 ring-zinc-900">
                      T
                    </div>
                    <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-xs font-semibold text-white ring-2 ring-zinc-900">
                      P
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Finanzas en pareja</p>
                    <p className="text-xs text-zinc-500">Invita a tu pareja y gestionen juntos</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Phone Mockup */}
            <motion.div
              className="flex-shrink-0"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
            >
              <div className="relative">
                {/* Glow effect behind phone */}
                <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-emerald-500/20 via-transparent to-violet-500/10 blur-3xl" />

                {/* iPhone Mockup */}
                <div className="relative">
                  <IPhoneMockup
                    screenWidth={280}
                    screenType="island"
                    frameColor="#1a1a1a"
                    statusbarColor="transparent"
                    hideStatusBar
                  >
                    <div className="absolute inset-0 flex flex-col justify-between bg-zinc-900 px-4 pb-6 pt-12">
                      {/* Financial Index Card */}
                      <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Tu Índice Financiero</p>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                            +12 pts
                          </span>
                        </div>

                        <div className="mb-1 flex items-baseline gap-1">
                          <span className="text-4xl font-semibold tabular-nums text-emerald-400">73</span>
                          <span className="text-xs text-zinc-500">/ 100</span>
                        </div>

                        {/* Animated chart */}
                        <div className="mb-3 mt-4 flex h-16 items-end gap-[2px]">
                          {chartBars.map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-sm transition-all duration-700 ease-out"
                              style={{
                                height: chartVisible ? `${h}%` : '0%',
                                background: i === chartBars.length - 1
                                  ? 'linear-gradient(180deg, #34d399 0%, #10b981 100%)'
                                  : 'rgba(16, 185, 129, 0.2)',
                                transitionDelay: `${i * 50}ms`
                              }}
                            />
                          ))}
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3">
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-zinc-500">Gastos</p>
                            <p className="mt-0.5 text-sm font-semibold text-white">$2,450</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-zinc-500">Ahorro</p>
                            <p className="mt-0.5 text-sm font-semibold text-emerald-400">$580</p>
                          </div>
                        </div>
                      </div>

                      {/* Middle section */}
                      <div className="flex-1 flex flex-col justify-center gap-3 py-4">
                        {/* AI Suggestion */}
                        <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-transparent p-3">
                          <div className="flex items-start gap-2">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/20">
                              <Sparkles className="size-3.5 text-violet-400" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-violet-300">FinovAI dice:</p>
                              <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-400">
                                Podrías ahorrar $100 más reduciendo suscripciones.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick actions - pinned to bottom */}
                      <div className="flex gap-2">
                        <div className="flex-1 rounded-xl border border-white/5 bg-white/5 py-3 text-center">
                          <span className="text-[10px] text-zinc-400">Ver gastos</span>
                        </div>
                        <div className="flex-1 rounded-xl border border-emerald-500/20 bg-emerald-500/10 py-3 text-center">
                          <span className="text-[10px] font-medium text-emerald-400">Preguntar</span>
                        </div>
                      </div>
                    </div>
                  </IPhoneMockup>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Background video/image with gradient overlay */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
            style={{ backgroundImage: "url('/hero2.png')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/70 to-zinc-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <a href="#como-funciona" className="flex flex-col items-center gap-2 text-zinc-600 transition-colors hover:text-zinc-400">
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <ArrowDown className="size-4 animate-bounce" />
        </a>
      </motion.div>
    </section>
  )
}
