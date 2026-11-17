import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<'textarea'>>(function Textarea(
  { className, ...props }, ref,
) {
  return <textarea {...props} ref={ref} className={cn('ui-textarea', className)} />
})
