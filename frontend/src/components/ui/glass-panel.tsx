import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

type GlassPanelProps = ComponentPropsWithoutRef<'div'> & {
  variant?: 'default' | 'elevated' | 'subtle'
  blur?: boolean
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { variant = 'default', blur = true, className, children, ...props }, ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={cn('glass-panel', variant !== 'default' && `glass-panel--${variant}`, className)}
      data-blur={blur ? undefined : 'off'}
    >
      {children}
    </div>
  )
})
