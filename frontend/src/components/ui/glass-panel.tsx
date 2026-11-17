import { forwardRef, useRef, type ComponentPropsWithoutRef } from 'react'
import { usePointerFrame } from '../../hooks/usePointerFrame'
import { cn } from '../../lib/cn'

type GlassPanelProps = ComponentPropsWithoutRef<'div'> & {
  variant?: 'default' | 'elevated' | 'subtle'
  blur?: boolean
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { variant = 'default', blur = true, className, children, onPointerMove, onPointerLeave, ...props }, ref,
) {
  const spotlight = useRef<HTMLSpanElement>(null)
  const pointer = usePointerFrame()

  function followPointer(_panel: HTMLDivElement, bounds: DOMRect, x: number, y: number) {
    const light = spotlight.current
    if (!light) return
    light.style.setProperty('--spot-x', `${x - bounds.left}px`)
    light.style.setProperty('--spot-y', `${y - bounds.top}px`)
  }

  return (
    <div
      {...props}
      ref={ref}
      className={cn('glass-panel', variant !== 'default' && `glass-panel--${variant}`, className)}
      data-blur={blur ? undefined : 'off'}
      onPointerMove={(event) => {
        onPointerMove?.(event)
        if (!event.defaultPrevented) pointer.schedule(event, followPointer)
      }}
      onPointerLeave={(event) => {
        pointer.cancel()
        onPointerLeave?.(event)
      }}
    >
      <span ref={spotlight} className="glass-panel__spotlight" aria-hidden="true" />
      {children}
    </div>
  )
})
