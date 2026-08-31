import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, Loader2 } from 'lucide-react'

import { getFinanceCategoriesForType } from '@finovai/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TransactionType } from '../lib/types'
import { normalizeQuestion } from '../lib/format'
import { FINANCE_SCROLLBAR_CLASS } from '../lib/styles'

export function CategorySearchSelect({
  disabled,
  onSelect,
  type,
  value,
}: {
  disabled?: boolean
  onSelect: (category: string) => void
  type: TransactionType
  value: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const options = getFinanceCategoriesForType(type)
  const normalizedQuery = normalizeQuestion(query)
  const filteredOptions = options.filter((option) => (
    normalizeQuestion(option).includes(normalizedQuery)
  ))

  const updateDropdownPosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return

    const width = Math.max(rect.width, 240)
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12))
    setDropdownStyle({
      left,
      top: Math.min(rect.bottom + 6, window.innerHeight - 320),
      width,
    })
  }

  useLayoutEffect(() => {
    if (!isOpen) return

    updateDropdownPosition()
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
    return () => {
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) setQuery('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  return (
    <div className="min-w-40 max-w-56">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full min-w-0 justify-between px-2 text-left font-normal"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">{value}</span>
        {disabled ? <Loader2 className="size-3.5 animate-spin" /> : null}
      </Button>

      {isOpen ? (
        <div
          ref={panelRef}
          className="fixed z-50 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
          style={dropdownStyle}
        >
          <Input
            value={query}
            className="h-8"
            placeholder="Buscar categoría"
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsOpen(false)
              if (event.key === 'Enter' && filteredOptions[0]) {
                event.preventDefault()
                onSelect(filteredOptions[0])
                setIsOpen(false)
              }
            }}
          />
          <div className={cn('mt-2 flex max-h-44 flex-col gap-1 overflow-y-auto', FINANCE_SCROLLBAR_CLASS)} role="listbox">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  className={cn(
                    'flex min-w-0 items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                    option === value && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => {
                    onSelect(option)
                    setIsOpen(false)
                  }}
                >
                  <span className="min-w-0 truncate">{option}</span>
                  {option === value ? <Check className="size-3.5" /> : null}
                </button>
              ))
            ) : (
              <p className="px-2 py-2 text-sm text-muted-foreground">Sin resultados</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
