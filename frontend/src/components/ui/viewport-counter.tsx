import { useEffect, useMemo, useRef } from 'react'
import { cn } from '../../lib/cn'

const duration = 440

function formatTotal(format: Intl.NumberFormat, value: number) {
  return format.formatToParts(value).map((part) => part.type === 'group' ? '\u00a0' : part.value).join('')
}

export function ViewportCounter({ value, locale, className }: {
  value: number
  locale: string
  className?: string
}) {
  const format = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const counter = useRef<HTMLSpanElement>(null)
  const finished = useRef(false)
  const total = formatTotal(format, value)

  useEffect(() => {
    const element = counter.current
    if (!element) return
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    if (!('IntersectionObserver' in window) || preference.matches || finished.current) {
      element.textContent = total
      return
    }

    let frame = 0
    let start: number | undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      observer.disconnect()
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.45 })

    function stop() {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }

    function tick(time: number) {
      if (!element) return
      start ??= time
      const progress = Math.min((time - start) / duration, 1)
      if (progress < 1) {
      element.textContent = formatTotal(format, Math.round(value * (1 - (1 - progress) ** 3)))
        frame = requestAnimationFrame(tick)
      } else {
        element.textContent = total
        finished.current = true
      }
    }

    function updatePreference() {
      if (!preference.matches || !element) return
      stop()
      element.textContent = total
      finished.current = true
    }

    element.textContent = formatTotal(format, 0)
    observer.observe(element)
    preference.addEventListener('change', updatePreference)
    return () => {
      stop()
      preference.removeEventListener('change', updatePreference)
    }
  }, [format, total, value])

  return (
    <span className={cn('ui-counter', className)}>
      <span className="sr-only">{total}</span>
      <span className="ui-counter__spacer" aria-hidden="true">{total}</span>
      <span ref={counter} aria-hidden="true">{total}</span>
    </span>
  )
}
