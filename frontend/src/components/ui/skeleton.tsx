import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn('ui-skeleton', className)} aria-hidden="true" />
}
