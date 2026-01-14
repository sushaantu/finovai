import { useState, useRef, useEffect } from 'react'
import { motion } from 'motion/react'
import { Phone, ChevronDown, Loader2 } from 'lucide-react'

interface PhoneInputProps {
  onSubmit: (phone: string) => Promise<void>
  isLoading?: boolean
  error?: string | null
}

const countryCodes = [
  { code: '+52', country: 'MX', flag: '🇲🇽' },
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+34', country: 'ES', flag: '🇪🇸' },
  { code: '+57', country: 'CO', flag: '🇨🇴' },
  { code: '+54', country: 'AR', flag: '🇦🇷' },
  { code: '+56', country: 'CL', flag: '🇨🇱' },
  { code: '+51', country: 'PE', flag: '🇵🇪' },
]

export default function PhoneInput({ onSubmit, isLoading, error }: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0])
  const [phoneNumber, setPhoneNumber] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullPhone = `${selectedCountry.code}${phoneNumber.replace(/\D/g, '')}`
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
          {/* Country code selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex h-12 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-white transition-colors hover:border-white/20 hover:bg-white/10"
            >
              <span className="text-lg">{selectedCountry.flag}</span>
              <span className="text-sm text-zinc-300">{selectedCountry.code}</span>
              <ChevronDown className="size-4 text-zinc-500" />
            </button>

            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl"
              >
                {countryCodes.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      setSelectedCountry(country)
                      setShowDropdown(false)
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5 ${
                      selectedCountry.code === country.code ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <span className="text-lg">{country.flag}</span>
                    <span className="text-sm text-zinc-300">{country.code}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Phone input */}
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
