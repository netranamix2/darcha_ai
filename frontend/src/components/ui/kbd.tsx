import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

export function Kbd({ className, ...props }: ComponentPropsWithoutRef<'kbd'>) {
  return <kbd {...props} className={cn('ui-kbd', className)} />
}
