import { useState, useRef, useEffect } from 'react'
import { motion } from 'motion/react'
import { Phone, Loader2 } from 'lucide-react'

interface PhoneInputProps {
  onSubmit: (phone: string) => Promise<void>
  isLoading?: boolean
  error?: string | null
}

export default function PhoneInput({ onSubmit, isLoading, error }: PhoneInputProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullPhone = `+52${phoneNumber.replace(/\D/g, '')}`
    await onSubmit(fullPhone)
  }

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhoneNumber(formatted)
  }

  const isValidPhone = phoneNumber.replace(/\D/g, '').length >= 10

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/20">
          <Phone className="size-6 text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">Ingresa tu teléfono</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Te enviaremos un código por WhatsApp
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <div className="flex h-12 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3">
            <span className="text-lg">🇲🇽</span>
            <span className="text-sm text-zinc-300">+52</span>
          </div>

          <input
            ref={inputRef}
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneChange}
            placeholder="55 1234 5678"
            className="h-12 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder-zinc-500 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
            disabled={isLoading}
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-red-400"
          >
            {error}
          </motion.p>
        )}

        <button
          type="submit"
          disabled={!isValidPhone || isLoading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-semibold text-white transition-all hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-500 disabled:hover:shadow-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              <span>Enviando...</span>
            </>
          ) : (
            <span>Enviar código</span>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-500">
        Al continuar, aceptas nuestros{' '}
        <a href="#" className="text-emerald-400 hover:underline">
          términos de servicio
        </a>{' '}
        y{' '}
        <a href="#" className="text-emerald-400 hover:underline">
          política de privacidad
        </a>
      </p>
    </motion.div>
  )
}
