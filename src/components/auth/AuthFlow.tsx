import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Sparkles } from 'lucide-react'
import PhoneInput from './PhoneInput'
import OTPInput from './OTPInput'
import { useAuth } from '@/hooks/useAuth'

interface AuthFlowProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

type AuthStep = 'phone' | 'otp' | 'success'

export default function AuthFlow({ isOpen, onClose, onSuccess }: AuthFlowProps) {
  const [step, setStep] = useState<AuthStep>('phone')
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuth()

  const handleSendOTP = async (phoneNumber: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error enviando código')
      }

      setPhone(phoneNumber)
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error enviando código')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (code: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Código inválido')
      }

      // Store token and user data
      login(data.token, data.user)
      setStep('success')

      // Call success callback after brief animation
      setTimeout(() => {
        onSuccess?.()
        onClose()
        // Reset state for next time
        setStep('phone')
        setPhone('')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error verificando código')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setError(null)
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error reenviando código')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error reenviando código')
    }
  }

  const handleBack = () => {
    setStep('phone')
    setError(null)
  }

  const handleClose = () => {
    onClose()
    // Reset state after close animation
    setTimeout(() => {
      setStep('phone')
      setPhone('')
      setError(null)
    }, 300)
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
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
              {/* Decorative gradient */}
              <div className="pointer-events-none absolute -top-24 left-1/2 size-48 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />

              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute right-4 top-4 rounded-full p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="size-5" />
              </button>

              {/* Content */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  {step === 'phone' && (
                    <motion.div
                      key="phone"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <PhoneInput
                        onSubmit={handleSendOTP}
                        isLoading={isLoading}
                        error={error}
                      />
                    </motion.div>
                  )}

                  {step === 'otp' && (
                    <motion.div
                      key="otp"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <OTPInput
                        phone={phone}
                        onSubmit={handleVerifyOTP}
                        onBack={handleBack}
                        onResend={handleResendOTP}
                        isLoading={isLoading}
                        error={error}
                      />
                    </motion.div>
                  )}

                  {step === 'success' && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-8 text-center"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                        className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600"
                      >
                        <Sparkles className="size-8 text-white" />
                      </motion.div>
                      <h2 className="text-xl font-semibold text-white">¡Bienvenido!</h2>
                      <p className="mt-2 text-sm text-zinc-400">
                        Tu cuenta está lista
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
