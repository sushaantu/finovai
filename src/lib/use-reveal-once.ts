import { useEffect, useRef, useState, type RefObject } from 'react'

export function useRevealOnce<T extends Element = HTMLElement>(threshold = 0.15): {
  ref: RefObject<T | null>
  isVisible: boolean
} {
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const target = ref.current
    if (!target) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setIsVisible(true)
        observer.disconnect()
      },
      { threshold }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, isVisible }
}
