import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

type SurfaceProps = ComponentPropsWithoutRef<'div'> & {
  /** `raised` adds a soft shadow, `subtle` is a flat tinted fill. */
  variant?: 'default' | 'raised' | 'subtle'
}

/** A solid white panel with a hairline border. Frosted glass is only for floating layers. */
export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { variant = 'default', className, ...props }, ref,
) {
  return <div {...props} ref={ref} className={cn('ui-surface', className)} data-variant={variant} />
})

type GlassPanelProps = ComponentPropsWithoutRef<'div'> & {
  variant?: 'default' | 'elevated' | 'subtle'
  blur?: boolean
}

/**
 * @deprecated Kept only so the staff panel builds until it is redesigned. Use `Surface`.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { variant = 'default', blur, className, ...props }, ref,
) {
  return (
    <Surface
      {...props}
      ref={ref}
      data-blur={blur === false ? 'off' : undefined}
      variant={variant === 'elevated' ? 'raised' : 'default'}
      className={cn('glass-panel', className)}
    />
  )
})
