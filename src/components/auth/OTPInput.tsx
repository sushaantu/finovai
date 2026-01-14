import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react'
import { motion } from 'motion/react'
import { Shield, Loader2, ArrowLeft } from 'lucide-react'

interface OTPInputProps {
  phone: string
  onSubmit: (code: string) => Promise<void>
  onBack: () => void
  onResend: () => Promise<void>
  isLoading?: boolean
  error?: string | null
}

export default function OTPInput({ phone, onSubmit, onBack, onResend, isLoading, error }: OTPInputProps) {
  const [code, setCode] = useState<string[]>(Array(6).fill(''))
  const [resendCooldown, setResendCooldown] = useState(60)
  const [isResending, setIsResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  useEffect(() => {
    const fullCode = code.join('')
    if (fullCode.length === 6 && !code.includes('')) {
      onSubmit(fullCode)
    }
  }, [code, onSubmit])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pastedData) {
      const newCode = [...code]
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i]
      }
      setCode(newCode)
      inputRefs.current[Math.min(pastedData.length, 5)]?.focus()
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return
    setIsResending(true)
    try {
      await onResend()
      setResendCooldown(60)
    } finally {
      setIsResending(false)
    }
  }

  const formatPhone = (phone: string) => {
    // Show last 4 digits only
    return `****${phone.slice(-4)}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="size-4" />
        <span>Cambiar número</span>
      </button>

      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20">
          <Shield className="size-6 text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">Verifica tu número</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Enviamos un código de 6 dígitos a{' '}
          <span className="text-zinc-300">{formatPhone(phone)}</span>
        </p>
      </div>

      {/* OTP Input boxes */}
      <div className="mb-6 flex justify-center gap-2">
        {code.map((digit, index) => (
          <motion.input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={isLoading}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`size-12 rounded-xl border text-center text-xl font-semibold outline-none transition-all sm:size-14 sm:text-2xl ${
              digit
                ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                : 'border-white/10 bg-white/5 text-white'
            } focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50`}
          />
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="mb-4 flex items-center justify-center gap-2 text-emerald-400">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Verificando...</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 text-center text-sm text-red-400"
        >
          {error}
        </motion.p>
      )}

      {/* Resend code */}
      <div className="text-center">
        {resendCooldown > 0 ? (
          <p className="text-sm text-zinc-500">
            Reenviar código en{' '}
            <span className="tabular-nums text-zinc-400">{resendCooldown}s</span>
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={isResending}
            className="text-sm text-emerald-400 transition-colors hover:text-emerald-300 disabled:opacity-50"
          >
            {isResending ? 'Reenviando...' : '¿No recibiste el código? Reenviar'}
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-zinc-500">
        El código expira en 5 minutos
      </p>
    </motion.div>
  )
}
