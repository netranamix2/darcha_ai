import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function FieldFrame({ children, className, icon }: {
  children: ReactNode
  className?: string
  icon?: ReactNode
}) {
  return (
    <span className={cn('ui-field-wrap', className)} data-icon={icon ? 'true' : undefined}>
      {icon && <span className="ui-field-icon" aria-hidden="true">{icon}</span>}
      {children}
      <span className="ui-field-ring" aria-hidden="true" />
    </span>
  )
}
