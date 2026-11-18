import type { ComponentPropsWithoutRef } from 'react'
import type { Level } from '../../api/types'
import { cn } from '../../lib/cn'

type StatusPillProps = ComponentPropsWithoutRef<'span'> & { level: Level }

export function StatusPill({ level, className, ...props }: StatusPillProps) {
  return <span {...props} className={cn('ui-status-pill', className)} data-level={level} />
}
