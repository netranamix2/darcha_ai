import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'

type BadgeProps = ComponentPropsWithoutRef<'span'> & { tone?: Tone; dot?: boolean }

/** Small tinted label. Coloured tones are reserved for statuses. */
export function Badge({ tone = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span {...props} className={cn('ui-badge', className)} data-tone={tone}>
      {dot && <span className="ui-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

type StatusDotProps = ComponentPropsWithoutRef<'span'> & { tone: Exclude<Tone, 'accent'> }

/** Dot + text, no fill. The default way to show a status. */
export function StatusDot({ tone, className, children, ...props }: StatusDotProps) {
  return (
    <span {...props} className={cn('ui-status', className)} data-tone={tone}>
      <span className="ui-dot" aria-hidden="true" />
      {children}
    </span>
  )
}
