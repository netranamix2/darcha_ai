import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'

let fineMotion: MediaQueryList | undefined
let frame: number | undefined
const pending = new Map<HTMLElement, (bounds: DOMRect) => void>()

function flush() {
  frame = undefined
  if (!fineMotion?.matches) {
    pending.clear()
    return
  }

  const measurements = Array.from(pending, ([element, paint]) => ({
    paint,
    bounds: element.getBoundingClientRect(),
  }))
  pending.clear()
  measurements.forEach(({ paint, bounds }) => paint(bounds))
}

export function usePointerFrame() {
  const target = useRef<HTMLElement>()

  const cancel = useCallback(() => {
    if (target.current) pending.delete(target.current)
    if (pending.size === 0 && frame !== undefined) {
      cancelAnimationFrame(frame)
      frame = undefined
    }
  }, [])

  useEffect(() => cancel, [cancel])

  function schedule<T extends HTMLElement>(
    event: PointerEvent<T>,
    paint: (element: T, bounds: DOMRect, x: number, y: number) => void,
  ) {
    if (event.pointerType !== 'mouse') return
    fineMotion ??= matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    if (!fineMotion.matches) return
    const { currentTarget, clientX, clientY } = event
    target.current = currentTarget
    pending.set(currentTarget, (bounds) => paint(currentTarget, bounds, clientX, clientY))
    frame ??= requestAnimationFrame(flush)
  }

  return { schedule, cancel }
}
